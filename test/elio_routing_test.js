const Elio = require('../Elio');
const request = require('request');
const crypto = require('crypto');

const privateKey =
`-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQCrGNI30r9R9XDZw6GuVrVxLgd+Em96NEwkQW53ihfU9/vbzajL
pzIanVxF7fMIvR21PrJk4SUYT9jIL1qkLZ2YSR0Fhtco+18yl53UQyw20xlol1qr
bJFINao9Bj8J7U+WTpzK1Xrxn3ylYCXnbAVBOxACxGqBnXDLJxwBww0A/wIDAQAB
AoGBAIU/73hKSXYrEJiII4MDRIvArVUiRm+GC0axLrcqdSUHfL7SjIMO05amtxY/
GufTYS+mhIjMT3d/t/Uv7Aew/uo1BJno+sx5PU5ntKq7j3Kj9QHZMqz4pFqwswyS
X0fFBPfJYqXRwqyFKpH3kN3sE+VueKbYLhmZF8e8ZO9ArtgBAkEA06Jxwc5YAyuc
T3Cz8CRIPrGFyyfb7CWe6fmn0GWscmBf2bhkg0/nkEd0i0SLZiDz0TM0wQijZRrC
c0l51Z6m3wJBAM725Bziq3jf7Wi+IJBfLG+c0oQHw+OGDA8cnTVO4bZBkOhSG0Ou
LX2tc23S95B5zVJHRVeKYsIeqCPJ90mRieECQEztSUhXRuqwGXtOzjlGFvSi9q0n
6ermqeMGmpdHve09Vtn/Cpoom1V4g8Zzve/7nmS2pkBccXg4x+G8HYsmxiUCQFrr
3aTO85OjlFGajQW/ue7Cjz0PiEARKIUPBgVgRQpjXXyibXXbNALtSzNpJfcje071
HoJpuh8bhrRKSsfYFyECQC95Obs1Nt/Rgfodm0Sf/ZbFwHqKJRXs1sGbW2JnrQvL
tZwMednOBZB58DJC9zUTgWU9+q4qQqKUBtW9xDzE26o=
-----END RSA PRIVATE KEY-----`;

const publicKey = 
`-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCrGNI30r9R9XDZw6GuVrVxLgd+
Em96NEwkQW53ihfU9/vbzajLpzIanVxF7fMIvR21PrJk4SUYT9jIL1qkLZ2YSR0F
htco+18yl53UQyw20xlol1qrbJFINao9Bj8J7U+WTpzK1Xrxn3ylYCXnbAVBOxAC
xGqBnXDLJxwBww0A/wIDAQAB
-----END PUBLIC KEY-----`;

const GET_JSON_FROM_RESPONSE = (response, callback) => {
  let body = "";
  response.on('data', (chunk) => body += chunk);
  response.on('end', function () {
    try {
      let data = JSON.parse(body);
      callback(null, data);
    } catch(error) {
      callback(error);
    }
  });
};

describe('Elio Routing Test Suite', function () {
  const port = 8091;
  let elio, f1_digest, f2_digest;
  const signSource = (source) => {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(source);
    return sign.sign(Buffer.from(privateKey)).toString('hex')
  };

  before(function (done) {
    elio = new Elio({
      port,
      maxNodes: 3,
      ttl: 30000
    });

    elio.setIdentityResolver((identity, callback) => {
      if (identity === 'test') callback(null, Buffer.from(publicKey));
      else return callback(new Error("Bad identity"));
    });

    elio.on('ready', done);
  });

  it('should create a new instance', function () {
    expect(elio).to.have.property('deploy');
    expect(elio).to.have.property('undeploy');
    expect(elio).to.have.property('invoke');
    expect(elio).to.have.property('listDeployments');
  });

  it('should deploy new functions', function (done) {
    const s1 = `
      module.exports = (context, callback) => callback(null, {
        result: context.name || "echo"
      });
    `;
    const s2 = `
      module.exports = (context, callback) => callback(null, {
        result: context.name || "echo",
        type: 's2'
      });
    `;
    elio.deploy('test', s1, signSource(s1), (error, digest) => {
      expect(error).to.be.null;
      f1_digest = digest;
      elio.deploy('test', s2, signSource(s2), (error, digest) => {
        expect(error).to.be.null;
        f2_digest = digest;
        expect(elio.listDeployments().map((r) => r[0])).to.have.members([f1_digest, f2_digest]);
        done();
      });
    });
  });

  it('should create a route for the function', function () {
    elio.assignRoute('my_test_function', f1_digest);
    expect(elio.getRoute('my_test_function')).to.equal(f1_digest);
    expect(elio.listRoutes()).to.have.deep.members([{
      route: 'my_test_function',
      digest: f1_digest
    }]);
  });

  it('should create a route through endpoint', function (done) {
    request({
      method: "PUT",
      url: `http://localhost:${port}/routes/ep_route/${f2_digest}`,
    }, function (error, response, buffer) {
      if (error) throw error;

      expect(buffer).to.not.be.undefined;
      expect(elio.getRoute('ep_route')).to.equal(f2_digest);
      expect(elio.listRoutes()).to.include.deep.members([{
        route: 'ep_route',
        digest: f2_digest
      }]);
      done();
    });
  });

  it('should delete a route through endpoint', function (done) {
    request({
      method: "DELETE",
      url: `http://localhost:${port}/routes/ep_route/`,
    }, function (error, response, buffer) {
      if (error) throw error;

      expect(buffer).to.not.be.undefined;
      expect(elio.getRoute('ep_route')).to.be.undefined;
      expect(elio.listRoutes()).to.not.have.members([f2_digest]);
      done();
    });
  });

  it('should invoke a routed function through access point', function (done) {
    request(`http://localhost:${port}/invoke/my_test_function`).on('response', function (response, body) {
      expect(response.statusCode).to.be.equal(200);
      GET_JSON_FROM_RESPONSE(response, (error, body) => {
        expect(body).to.be.eql({
          result: 'echo'
        });
        done();
      });
    }).on('error', function (error) {
      throw error;
    });
  });

  it('should invoke a function through local API', function (done) {
    elio.invokeRoute('my_test_function', { name: 'test' }, (error, response) => {
      if (error) throw error;
      expect(response).to.eql({
        result: 'test'
      });
      done();
    });
  });

  it('should swap a route', function (done) {
    elio.assignRoute('my_test_function', f2_digest);

    elio.invokeRoute('my_test_function', { name: 'test' }, (error, response) => {
      if (error) throw error;
      expect(response).to.eql({
        result: 'test',
        type: 's2'
      });
      done();
    });
  })

  it('should remove a route', function (done) {
    elio.removeRoute('my_test_function');

    elio.invokeRoute('my_test_function', { name: 'test' }, (error, response) => {
      expect(error).to.not.be.undefined;
      request(`http://localhost:${port}/invoke/my_test_function`).on('response', function (response, body) {
        expect(response.statusCode).to.be.equal(404);
        done();
      }).on('error', function (error) {
        throw error;
      });
    });
  });
});
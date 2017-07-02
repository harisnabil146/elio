const Elio = require('../Elio');
const request = require('request');
const crypto = require('crypto');

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

describe('Elio Integration Test Suite', function () {
  const port = 8090;
  let elio, f1_digest;
  const createHMAC = (encrypted_source) => crypto.createHmac('sha256', 'test_secret').update(encrypted_source).digest('hex');

  before(function (done) {
    elio = new Elio({
      port,
      maxNodes: 3,
      ttl: 30000
    });

    elio.setSecretResolver((identity, callback) => {
      if (identity === 'test') callback(null, 'test_secret');
      else return callback(new Error("Bad HMAC"));
    });

    elio.setEncryptionResolver((identity, encryptedSource, callback) => {
      callback(null, encryptedSource);
    });

    elio.on('ready', done);
  });

  it('should create a new instance', function () {
    expect(elio).to.have.property('deploy');
    expect(elio).to.have.property('undeploy');
    expect(elio).to.have.property('invoke');
    expect(elio).to.have.property('listDeployments');
  });

  it('should deploy new function', function (done) {
    const source = `
      module.exports = (context, callback) => callback(null, {
        result: context.name || "echo"
      });
    `;
    elio.deploy('test', source, createHMAC(source), (error, digest) => {
      expect(error).to.be.null;
      expect(digest).to.be.equal(createHMAC(source));
      f1_digest = digest;
      done();
    });
  });

  it('should list function under available deployments', function () {
    expect(elio.listDeployments().map((r) => r[0])).to.have.members([f1_digest]);
  });

  it('should invoke a function through access point', function (done) {
    request(`http://localhost:${port}/${f1_digest}`).on('response', function (response, body) {
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
    elio.invoke(f1_digest, { name: 'test' }, (error, response) => {
      if (error) throw error;
      expect(response).to.eql({
        result: 'test'
      });
      done();
    });
  });

  it('should undeploy a function', function (done) {
    elio.undeploy(f1_digest, function (error) {
      if (error) throw error;

      expect(elio.listDeployments().map((r) => r[0])).to.not.have.members([f1_digest]);
      done();
    });
  });

  it('should return correct http code when invoking deleted or unknown digests', function (done) {
    request(`http://localhost:${port}/${f1_digest}`).on('response', function (response, body) {
      expect(response.statusCode).to.be.equal(404);
      done();
    }).on('error', function (error) {
      throw error;
    });
  });
});
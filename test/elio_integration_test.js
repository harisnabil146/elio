const Elio = require('../Elio');

describe('Elio Integration Test Suite', function () {
  let elio;

  before(function (done) {
    elio = new Elio({
      port: 8090,
      maxNodes: 3,
      ttl: 30000
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
    elio.deploy(`
      module.exports = (context, callback) => callback(null, context.name || "echo");
    `, (error, digest) => {
      expect(error).to.be.null;
      expect(digest).to.be.an('array');
      expect(digest).to.have.length.gte(1);
      expect(digest[0]).to.be.a('string');
      expect(digest[0]).to.have.length.gte(1);
      done();
    });
  });
});
// Cluster Node Daemon
const vm = require('vm');
const cluster = require('cluster');
const anyBody = require('body/any');
const AccessPoint = require('./AccessPoint');
const { runInNewContext } = vm;
const node = Math.random();

/* - Access Point - */
const _AP_ROUTER = (action, callback) => {
  switch (action.type) {
    case 'INVOKE_NO_PARAM':
      REF_INVOKE(action.ref, action.query, callback);
    break;

    case 'INVOKE_WITH_PARAMS':
      anyBody(req, res, {}, (error, body) => {
        if (error) return callback(new Error("Failed to parse body"));
        else REF_INVOKE(action.ref, {
          query: action.query,
          body: body
        }, callback);
      });
    break;

    default:
      return callback(new Error("Failed to identity request type."));
  }
};
new AccessPoint(8080, (...args) => _AP_ROUTER(...args));
/* - ------------ - */
const REFAllocationMap = new Map();

const ALLOCATE_REF = (digest, ref) => {
  REFAllocationMap.set(digest, ref);
};

const SAFE_DEPLOY = (digest, source, callback) => {
  const sandbox = {
    module: {},
    console: console,
    setTimeout,
    clearTimeout,
    setImmediate
  };
  runInNewContext(new Buffer(source).toString('utf8'), sandbox);

  (function (allocate, callback) {
    allocate(digest, sandbox.module.exports);
    callback(null, digest);
  })(ALLOCATE_REF, callback);
};

const REF_INVOKE = (digest, context, callback) => {
  if (REFAllocationMap.has(digest)) REFAllocationMap.get(digest)(context || {}, (error, response) => {
    if (error) return callback(error);
    response.wid = node;
    callback(null, response);
  });
  else callback(new Error("Digest was not found"));
};

const HANDLE_REF_ACK_FACTORY = (id) => (error, response) => {
  if (!process.send) return;
  else if (error) return process.send({ type: 'ACK', id, error, status: 'ERROR' });
  else return process.send({ type: 'ACK', id, response, status: 'OK' });
};

const HANDLE_IPC_MESSAGE = function (packet) {
  if (!packet || (typeof packet !== 'object') || !packet.type) return;

  switch (packet.type) {
    case 'REFDeploy':
      return SAFE_DEPLOY(packet.digest, packet.source, HANDLE_REF_ACK_FACTORY(packet.id));
  }
};

process.on('message', HANDLE_IPC_MESSAGE);

process.on('uncaughtException', (error) => {
  process.send({ type: 'uncaughtException', error, status: 'ERROR' })
});

module.exports = HANDLE_IPC_MESSAGE;
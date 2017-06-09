// Cluster Node Daemon
const vm = require('vm');
const { runInNewContext } = vm;
const REFAllocationMap = new Map();

const ALLOCATE_REF = (digest, ref) => {
  REFAllocationMap.set(digest, ref);
};

const DEALLOCATE_REF = (digest) => {
  REFAllocationMap.delete(digest);
};

const REF_DEPLOY = (digest, source, callback) => {
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

const REF_UNDEPLOY = function (digest, callback) {
  callback(null, DEALLOCATE_REF(digest));
};

const REF_INVOKE_FROM_ALLOCATION = function (digest, context, callback) {
  REFAllocationMap.get(digest)(context || {}, callback);
};

const REF_INVOKE = (digest, context, callback) => {
  try {
    if (REFAllocationMap.has(digest)) REF_INVOKE_FROM_ALLOCATION(digest, context, callback);
    else callback(new Error("Digest was not found"));
  } catch (error) {
    callback(error);
  }
};

const HANDLE_REF_ACK_FACTORY = (id) => (error, response, meta) => {
  if (!process.send) return;
  else if (error) return process.send({ type: 'ACK', id, error: error.message, status: 'ERROR' });
  else return process.send({ type: 'ACK', id, response, status: 'OK', meta });
};

const HANDLE_IPC_MESSAGE = function (packet) {
  if (!packet || (typeof packet !== 'object') || !packet.type) return;

  switch (packet.type) {
    case 'REFDeploy':
    return REF_DEPLOY(packet.digest, packet.source, HANDLE_REF_ACK_FACTORY(packet.id));

    case 'REFInvoke':
    return REF_INVOKE(packet.digest, packet.context, HANDLE_REF_ACK_FACTORY(packet.id));

    case 'REFUndeploy':
    return REF_UNDEPLOY(packet.digest, HANDLE_REF_ACK_FACTORY(packet.id));

    case 'PING':
    return HANDLE_REF_ACK_FACTORY(packet.id)(null, { pong: true });
  }
};

process.on('message', HANDLE_IPC_MESSAGE);

process.on('uncaughtException', (error) => {
  process.send({ type: 'uncaughtException', error, status: 'ERROR' })
});

module.exports = HANDLE_IPC_MESSAGE;
const IPC_MESSAGE = require('./lib/ClusterNode');

IPC_MESSAGE({
  id: 'test',
  type: 'REFDeploy',
  digest: 'DIGITEST',
  source: `
    module.exports = function x(context, callback) {
      setTimeout(() => {
        console.log({ context });
        callback();
      }, 600);
    };
  `
});

IPC_MESSAGE({
  id: 'test1',
  type: 'REFInvoke',
  digest: 'DIGITEST',
  context: {
    test: true
  }
});
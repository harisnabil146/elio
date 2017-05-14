const cluster = require('cluster');

class ClusterManager {
  constructor(totalNodes, ttl) {
    this._totalNodes = totalNodes;
    this.nodes = new Set();
    this.availableNodes = new Set();
    this._nodeTTL = ttl || (60 * 5 * 1000); // Maximum of 5 minutes scheduling and 10 minutes runtime

    cluster.setupMaster({
      exec: './ClusterNode.js',
      args: ['--ttl', this._nodeTTL],
      silent: true
    });
  }

  spinup() {
    const node = cluster.fork();

    node.on('exit', (code, signal) => {
      if (signal) {
        console.log(`worker was killed by signal: ${signal}`);
      } else if (code !== 0) {
        console.log(`worker exited with error code: ${code}`);
      } else {
        console.log('worker success!');
      }
      this.nodes.delete(node);
    });

    node.on('disconnect', () => this.nodes.delete(node) && this.availableNodes.delete(node));

    setTimeout(() => {
      this.graceFullyKillNode(node, this._nodeTTL);
    }, this._nodeTTL);

    this.availableNodes.add(node);
    this.nodes.add(node);
  }

  graceFullyKillNode(node, ttl) {
    this.nodes.availableNodes.delete(node);
    node.disconnect();

    if (ttl) {
      setTimeout(() => {
        if (!node.exitedAfterDisconnect) this.killNode(node);
      }, ttl);
    }
  }

  killNode(node) {
    this.availableNodes.delete(node);
    this.nodes.delete(node);
    node.kill('SIGTERM');
  }
}

module.exports = ClusterManager;
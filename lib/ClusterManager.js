const cluster = require('cluster');
const shortid = require('shortid');
const DistributionMap = require('./DistributionMap');

class ClusterManager {
  constructor(totalNodes, ttl) {
    this._totalNodes = totalNodes;
    this.nodes = new Set();
    this.distributionMap = new DistributionMap();
    this._awaiting = new Map();
    this._nodeTTL = ttl || (60 * 5 * 1000); // Maximum of 5 minutes scheduling and 10 minutes runtime

    cluster.setupMaster({
      exec: './lib/ClusterNode.js',
      args: ['--ttl', this._nodeTTL],
      silent: true
    });

    this.rebalance();
  }

  _handleMessage(message) {
    if (!message || (typeof message !== 'object') || !message.id) return;

    if (message.type === 'uncaughtException') return console.error("uncaughtException", message);

    if (this._awaiting.has(message.id)) {
      this._awaiting.get(message.id)(message.error, message.response);
      this._awaiting.delete(message.id);
    }
  }

  rebalance() {
    const additionalNodes = this._totalNodes - this.distributionMap.size;

    if (additionalNodes < 1) return;
    for (let i = 0; i < additionalNodes; i++) {
      this.fork();
    }
  }

  fork() {
    const node = cluster.fork();

    node.on('exit', (code, signal) => {
      if (signal) {
        console.log(`Node was killed by signal: ${signal}`);
      } else if (code !== 0) {
        console.log(`Node exited with error code: ${code}`);
      } else {
        console.log(`Node ${node.id} has finished execution.`);
      }
      this.distributionMap.delete(node);
      this.nodes.delete(node);
      this.rebalance();
    });

    node.on('disconnect', () => this.nodes.delete(node) && this.distributionMap.delete(node) && this.rebalance());

    node.on('message', (message) => this._handleMessage(message, node));

    setTimeout(() => {
      this.graceFullyKillNode(node, this._nodeTTL);
    }, this._nodeTTL);

    this.distributionMap.add(node);
    this.nodes.add(node);
  }

  graceFullyKillNode(node, ttl) {
    this.distributionMap.delete(node);
    node.disconnect();
    this.rebalance();

    if (ttl) {
      setTimeout(() => {
        if (!node.exitedAfterDisconnect) this.killNode(node);
      }, ttl);
    }
  }

  killNode(node) {
    this.distributionMap.delete(node);
    this.nodes.delete(node);
    node.kill('SIGTERM');
  }

  allocate(digest, source, callback) {
    this.unicast({
      type: 'REFDeploy',
      digest,
      source
    }, this.distributionMap.allocateResource(digest), callback);
  }

  anycast(digest, message, callback) {
    let node = this.distributionMap.getAvailableProvider(digest);
    if (!node) return callback(new Error("No providers were found"));

    this.unicast(message, node, callback);
  }

  unicast(message, node, callback) {
    message.id = shortid.generate();
    this._awaiting.set(message.id, callback);

    node.send(message);
  }

  broadcast(message) {
    this.distributionMap.forEach((node) => node.send(message));
  }
}

module.exports = ClusterManager;
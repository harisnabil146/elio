const cluster = require('cluster');
const shortid = require('shortid');

class ClusterManager {
  constructor(totalNodes, ttl) {
    this._totalNodes = totalNodes;
    this.nodes = new Set();
    this.availableNodes = new Set();
    this._awaiting = new Map();
    this._nodeTTL = ttl || (60 * 5 * 1000); // Maximum of 5 minutes scheduling and 10 minutes runtime

    cluster.setupMaster({
      exec: './lib/ClusterNode.js',
      args: ['--ttl', this._nodeTTL],
      silent: false
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
    const additionalNodes = this._totalNodes - this.availableNodes.size;

    if (additionalNodes < 1) return;
    for (let i = 0; i < additionalNodes; i++) {
      this.fork();
    }
  }

  fork() {
    const node = cluster.fork();

    node.on('exit', (code, signal) => {
      if (signal) {
        console.log(`worker was killed by signal: ${signal}`);
      } else if (code !== 0) {
        console.log(`worker exited with error code: ${code}`);
      } else {
        console.log('worker success!');
      }
      this.availableNodes.delete(node);
      this.nodes.delete(node);
      this.rebalance();
    });

    node.on('disconnect', () => this.nodes.delete(node) && this.availableNodes.delete(node) && this.rebalance());

    node.on('message', (message) => this._handleMessage(message, node));

    setTimeout(() => {
      this.graceFullyKillNode(node, this._nodeTTL);
    }, this._nodeTTL);

    this.availableNodes.add(node);
    this.nodes.add(node);
  }

  graceFullyKillNode(node, ttl) {
    this.availableNodes.delete(node);
    node.disconnect();
    this.rebalance();

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

  unicast(message, node, callback) {
    const aNodes = [...this.availableNodes];
    const selectedNode = node || aNodes[Math.floor(Math.random()*aNodes.length)];
    message.id = shortid.generate();
    this._awaiting.set(message.id, callback);

    selectedNode.send(message);
  }

  broadcast(message) {
    this.availableNodes.forEach((node) => node.send(message));
  }
}

module.exports = ClusterManager;
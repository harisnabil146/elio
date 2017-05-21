const cluster = require('cluster');
const shortid = require('shortid');
const UniformDistributionMap = require('./UniformDistributionMap');

class ClusterManager {
  constructor(totalNodes, ttl) {
    this._totalNodes = totalNodes;
    this._allocations = new Map();
    this.nodes = new Set();
    this.stats = {
      trackedTimeSum: 0,
      trackedTimeTotal: 0,
      start_time: process.hrtime()
    };
    this.distributionMap = new UniformDistributionMap();
    this._awaiting = new Map();
    this._nodeTTL = ttl || (60 * 5 * 1000); // Maximum of 5 minutes scheduling and 10 minutes runtime

    setInterval(() => {
      console.log(this.getTrackedStats());
    }, 5000);

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
    const error = (message.status === 'ERROR')?new Error(message.error):null;

    if (this.hasScheduledTask(message.id)) {
      const task = this.getScheduledTask(message.id);
      const duration = process.hrtime(task.time);
      task.callback(error, message.response);
      if (task.time) this.trackTime(duration[0] * 1e9 + duration[1]);
    }
  }

  hasScheduledTask(id) {
    return this._awaiting.has(id);
  }

  getScheduledTask(id) {
    const task = this._awaiting.get(id);
    this._awaiting.delete(id);
    return task;
  }

  scheduleTask(id, callback) {
    this._awaiting.set(id, {
      callback,
      time: process.hrtime()
    });
  }

  getTrackedStats() {
    const { trackedTimeSum, trackedTimeTotal, start_time } = this.stats;
    const average = Math.floor(trackedTimeSum / trackedTimeTotal);
    const averageMilisecond = Math.floor(average / 1000000);
    const start_time_diff = process.hrtime(start_time);
    const runtime = start_time_diff[0] * 1e9 + start_time_diff[1];
    
    return {
      trackedTimeTotal,
      trackedTimeSum,
      runtime,
      overtime: trackedTimeSum - runtime,
      average,
      averageMilisecond
    };
  }

  trackTime(time) {
    this.stats.trackedTimeSum += time;
    this.stats.trackedTimeTotal++;
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

    node.on('online', () => this._allocations.forEach((source, digest) => {
      console.log("DEPLOYING", digest, source);
      this.unicast({
        type: 'REFDeploy',
        digest,
        source
      }, node, () => { /** @todo: Add redeploy and reporting in case of deployment failure */});
    }));

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
    this._allocations.set(digest, source);
    this.broadcast({
      type: 'REFDeploy',
      digest,
      source
    }, callback);
  }

  anycast(digest, message, callback) {
    const provider = this.distributionMap.getAvailableProvider(digest);
    if (!provider || !Array.isArray(provider) || !provider[0]) return callback(new Error("No providers were found"));

    this.unicast(message, provider[0], callback);
  }

  unicast(message, node, callback) {
    if (!message.id) message.id = shortid.generate();
    this.scheduleTask(message.id, callback);

    node.send(message);
  }

  broadcast(message, callback) {
    let queue = [];
    let queued = 0;
    let canceled = false;

    const parallelWrapper = (id) => (error, response) => {
      if (canceled) return;
      else if (error) {
        canceled = true;
        return callback(error);
      }
      
      if (queue.indexOf(id) !== -1) queue[queue.indexOf(id)] = response;
      if (--queued <= 0) return callback(null, queue);
    };

    this.distributionMap.forEach((node, size) => {
      message.id = shortid.generate();
      this.unicast(message, node, parallelWrapper(message.id));
      queue.push(message.id);
      queued++;
    });
  }
}

module.exports = ClusterManager;
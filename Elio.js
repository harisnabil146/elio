const vm = require('vm');
const { runInNewContext } = vm;
const crypto = require('crypto');
const anyBody = require('body/any');
const EventEmitter = require('events').EventEmitter;

const AccessPoint = require('./lib/AccessPoint');
const ClusterManager = require('./lib/ClusterManager');
const REF = require('./lib/REF');

class Elio extends EventEmitter {
  constructor(config) {
    super();

    const { port, maxNodes, ttl } = config;
    this._readyCriteria = {
      nodesReady: false,
      apReady: false
    };
    this._hasBeenReadyBefore = false;
    this._internalSourceRegistry = new Map();
    this._clusterManager = new ClusterManager(maxNodes || 5, ttl || 300000);
    this._clusterManager.once('online', () => this._completeCriteria('nodesReady'));
    this._resolvers = {
      IDENTITY: (identity, callback) => callback(new Error("No Identity Resolver was registered"))
    };
    new AccessPoint(port, (...args) => this._AP_ROUTER(...args), () => this._completeCriteria('apReady'));
  }

  _completeCriteria(key) {
    this._readyCriteria[key] = true;

    // Attempt to invalidate ready state
    for (const innerKey in this._readyCriteria) {
      if (this._readyCriteria[innerKey] !== true) return;
    }

    // Otherwise we are ready
    if (!this._hasBeenReadyBefore) {
      this._hasBeenReadyBefore = true;
      this.emit('ready');
    }
  }

  _AP_ROUTER(action, callback) {
    switch (action.type) {
      case 'INVOKE_NO_PARAM':
        this.invoke(action.ref, action.query, callback);
      break;

      case 'INVOKE_WITH_PARAMS':
        anyBody(req, res, {}, (error, body) => {
          if (error) return callback(new Error("Failed to parse body"));
          else this.invoke(action.ref, {
            query: action.query,
            body: body
          }, callback);
        });
      break;

      case 'UNDEPLOY':
        this.undeploy(action.ref);
        callback(null, { status: 'OK' });
      break;

      case 'DEPLOY':
        if (action.stream) {
          let source = '';

          action.stream.on('data', (chunk) => source += chunk);
          action.stream.on('end', () => {
            this.deploy(action.headers['x-identity'], source, action.headers['authorization'], (error, digest) => {
              if (error) return callback(error);
              callback(null, { status: 'OK', digest });
            });
          });
        } else {
          return callback(new Error("No body was received"));
        }
      break;

      default:
      return callback(new Error("Failed to identity request type."));
    }
  }

  setIdentityResolver(handler) {
    this._resolvers.IDENTITY = handler; 
  }

  unsafe_deploy(digest, source, callback) {
    this._clusterManager.allocate(digest, source, callback);
    this.emit('deploy', digest, source);
  }

  invoke(digest, context, callback) {
    this._clusterManager.anycast(digest, {
      type: 'REFInvoke',
      digest,
      context
    }, callback);
  }

  deploy(identity, source, signature, callback) {
    // Verify Message Signature (RSA-SHA256)
    this._resolvers.IDENTITY(identity, (error, publicKey) => {
      if (error) return callback(error);
      if (!publicKey || !Buffer.isBuffer(publicKey)) return callback(new Error("Invalid identity"));

      const RSA_SHA_256 = crypto.createVerify('RSA-SHA256');
      RSA_SHA_256.update(source);

      if (RSA_SHA_256.verify(publicKey, signature, 'hex')) {
        const ref = new REF(signature, source.length);
        // Override publicKey Buffer in memory
        publicKey.fill && publicKey.fill('0');
        // Deploy Source
        this.unsafe_deploy(ref.digest, source, (error) => callback(error, signature));
      } else {
        return callback(new Error("Bad signature"));
      }
    });
  }

  undeploy(digest, callback) {
    this._clusterManager.deallocate(digest, callback);
    this.emit('undeploy', digest);
  }

  listDeployments() {
    return Array.from(this._clusterManager.getAllocations());
  }
}

module.exports = Elio;
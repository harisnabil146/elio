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
      HMAC_SECRET: (identity, callback) => callback(new Error("No Hmac Resolver was registered")),
      ENCRYPTION: (identity, callback) => callback(new Error("No Encryption Resolver was registered"))
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

  setHmacResolver(handler) {
    this._resolvers.HMAC_SECRET = handler; 
  }

  setEncryptionResolver(handler) {
    this._resolvers.ENCRYPTION = handler;
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

  deploy(identity, encrypted_source, hmac_header, callback) {
    // Verify Message Authentication Code (MAC -> SHA256:Hex)
    this._resolvers.HMAC_SECRET(identity, (error, secret) => {
      if (error) return callback(error);
      const hmac = crypto.createHmac('sha256', secret);
      const digest = hmac.update(encrypted_source).digest('hex');

      if (digest !== hmac_header) return callback(new Error("Bad HMAC header"));

      // Decrypt source based on given Encryption key
      this._resolvers.ENCRYPTION(identity, encrypted_source, (error, source) => {
        if (error) return callback(error);
        const ref = new REF(digest, source.length);

        try {
          // Deploy Source
          this.unsafe_deploy(ref.digest, source, (error) => callback(error, digest));
        } catch (error) {
          return callback(error);
        }
      });
    });
  }

  undeploy(digest, callback) {
    this._clusterManager.deallocate(digest, callback);
    this.emit('undeploy', digest, source);
  }

  listDeployments() {
    return Array.from(this._clusterManager.getAllocations());
  }
}

module.exports = Elio;
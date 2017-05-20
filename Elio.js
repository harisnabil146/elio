const vm = require('vm');
const { runInNewContext } = vm;
const crypto = require('crypto');
const anyBody = require('body/any');

const AccessPoint = require('./lib/AccessPoint');
const ClusterManager = require('./lib/ClusterManager');
const REF = require('./lib/REF');

class Elio {
  constructor(port) {
    this._internalSourceRegistry = new Map();
    this._clusterManager = new ClusterManager(5, 300000);
    new AccessPoint(port, (...args) => this._AP_ROUTER(...args));
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
          let buffer = '';
          action.stream.on('data', (chunk) => buffer += chunk);
          action.stream.on('end', () => {
            this.deploy(buffer, 1, (error, digest) => {
              if (error) return callback(new Error("Failed to deploy"));
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

  _setSource(digest, source) {
    this._internalSourceRegistry.set(digest, source);
  }

  _getSource(digest) {
    return this._internalSourceRegistry.get(digest);
  }

  _hasSource(digest) {
    return this._internalSourceRegistry.has(digest);
  }

  _removeSource(digest) {
    return this._internalSourceRegistry.delete(digest);
  }

  _safe_deploy(digest, source, callback) {
    this._clusterManager.allocate(digest, source, callback);
    /*const sandbox = {
      module: {},
      console: console
    };
    runInNewContext(source, sandbox);

    (function (setSource, callback) {
      setSource(ref.digest, sandbox.module.exports);
      callback(null, ref.digest);
    })(this._setSource.bind(this), callback)*/
  }

  invoke(digest, context, callback) {
    this._clusterManager.anycast(digest, {
      type: 'REFInvoke',
      digest,
      context
    }, callback);
    /*if (this._hasSource(digest)) this._getSource(digest)(context || {}, callback);
    else callback(new Error("Digest was not found"));*/
  }

  deploy(source, shards, callback) {
    let ref = new REF();
    ref.digest = crypto.createHash('sha1').update(source).digest('hex');
    ref.length = source.length;

    try {
      this._safe_deploy(ref.digest, source, callback);
    } catch (error) {
      return callback(error);
    }
    /** @todo: Pipe stream to end node or datastore */
  }

  undeploy(digest) {
    this._removeSource(digest);
  }
}

module.exports = Elio;
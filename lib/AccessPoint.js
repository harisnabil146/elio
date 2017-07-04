const http = require('http');
const TYPE_UNROUTED = Symbol('unrouted');
const TYPE_ROUTED = Symbol('routed');

class AccessPoint {
  constructor(port, handler, callback) {
    this._handler = handler;

    http.createServer((req, res) => {
      const _URL_PARTS_ = req.url.split('/');
      const basePath = _URL_PARTS_[1].toLowerCase();
      const parts = _URL_PARTS_.slice(2);
      const method = req.method;

      if (basePath === 'source') {
        if ((method === 'GET') && (parts.length)) {
          this.handler(res, this.TYPE_INVOKE_NO_PARAM(parts[0], req.query, TYPE_UNROUTED));
        } else if ((method === 'POST') && (parts.length)) {
          this.handler(res, this.TYPE_INVOKE_WITH_PARAMS(parts[0], req.query, TYPE_UNROUTED));
        } else if ((method === 'DELETE') && (parts.length)) {
          this.handler(res, this.TYPE_UNDEPLOY(parts[0], TYPE_UNROUTED));
        } else if ((method === 'PUT') && (parts[0] === '')) {
          this.handler(res, this.TYPE_DEPLOY(req, TYPE_UNROUTED));
        }
      } else if (basePath === 'route') {
        res.statusCode = 501;
        return res.end("Not implemented");
      } else {
        res.statusCode = 404;
        return res.end("Not found");
      }
    }).listen(port || 5272, callback);
  }

  TYPE_INVOKE_NO_PARAM(ref, query, routing) {    
    return {
      type: 'INVOKE_NO_PARAM',
      isRouted: (routing === TYPE_ROUTED),
      ref,
      query
    };
  }

  TYPE_INVOKE_WITH_PARAMS(ref, query, routing) {
    return {
      type: 'INVOKE_WITH_PARAMS',
      isRouted: (routing === TYPE_ROUTED),
      ref,
      query
    };
    /** @todo: Parse body */
  }

  TYPE_UNDEPLOY(ref, routing) {
    return {
      type: 'UNDEPLOY',
      isRouted: (routing === TYPE_ROUTED),
      ref
    };
  }

  TYPE_DEPLOY(request, routing) {
    return {
      type: 'DEPLOY',
      isRouted: (routing === TYPE_ROUTED),
      headers: request.headers,
      stream: request
    };
  }

  handler(res, action) {
    this._handler(action, (error, result) => {
      if (error) {
        res.writeHead(error.code || 500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ error: error.message }));
      } else {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(result));
      }
    });
  }
}

module.exports = AccessPoint;
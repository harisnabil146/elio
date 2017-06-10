const http = require('http');

class AccessPoint {
  constructor(port, handler, callback) {
    http.createServer((req, res) => {
      let action = {};

      if ((req.method === 'GET') && (req.url.split('/').length === 2)) {
        action.type = 'INVOKE_NO_PARAM';
        action.ref = req.url.split('/')[1];
        action.query = req.query;
      } else if ((req.method === 'POST') && (req.url.split('/').length === 2)) {
        action.type = 'INVOKE_WITH_PARAMS';
        action.ref = req.url.split('/')[1];
        action.query = req.query;
        /** @todo: Parse body */
      } else if ((req.method === 'DELETE') && (req.url.split('/').length === 2)) {
        action.type = 'UNDEPLOY';
        action.ref = req.url.split('/')[1];
      } else if ((req.method === 'PUT') && (req.url === '/')) {
        action.type = 'DEPLOY';
        action.stream = req;
      }

      handler(action, (error, result) => {
        if (error) {
          res.writeHead(error.code || 500, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ error: error.message }));
        } else {
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify(result));
        }
      });
    }).listen(port || 5272, callback);
  }
}

module.exports = AccessPoint;
const Elio = require('./Elio');
const service = new Elio({
  port: 8000,
  maxNodes: 3
});

service.setHmacResolver((identity, callback) => {
  if (identity === 'test') callback(null, 'test');
  else return callback(new Error("Bad HMAC"));
});

service.setEncryptionResolver((identity, encryptedSource, callback) => {
  callback(null, encryptedSource);
});
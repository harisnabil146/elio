const fs = require('fs');
const Elio = require('./Elio');
const app = new Elio(8080);

app.deploy(fs.readFileSync('./examples/HelloWorld.js'), 0, (error, digest) => {
  if (error) throw error;
  console.log({ digest });
});
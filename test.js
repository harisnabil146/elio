const fs = require('fs');
const Elio = require('./Elio');
const app = new Elio(8080);

setTimeout(() => {
  app.deploy(fs.readFileSync('./examples/HelloWorld.js'), (error, digest) => {
    if (error) throw error;
    console.log("Deployed", { digest });
  });
  app.deploy(fs.readFileSync('./examples/ExceptionalFunction.js'), (error, digest) => {
    if (error) throw error;
    console.log("Deployed", { digest });
  });
}, 500);
const fs = require('fs');
const Elio = require('./Elio');
const app = new Elio(8080);

setTimeout(() => {
  app.deploy(fs.readFileSync('./examples/HelloWorld.js'), 0, (error, digest) => {
    if (error) throw error;
    console.log("Deployed", { digest });
  });
}, 500);
const message = "Hello World";

console.log("HELLO WORLD V1");

module.exports = (context, callback) => {
  if (context.body) {
    callback(null, { message, body });
  } else {
    callback(null, { message });
  }
};
const message = "Hello World";

console.log("HELLO WORLD V1");

module.exports = (context, callback) => {
  callback(null, { message });
};
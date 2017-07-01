// Remotely Executed Function
class REF {
  constructor(digest, length) {
    this.digest = digest;
    this.length = parseInt(length, 10) || 0;
  }
}

module.exports = REF;
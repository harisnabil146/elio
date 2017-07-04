const crypto = require('crypto');
const hmac = crypto.createHmac('sha256', 'a secret');

const privateKey =
`-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQCrGNI30r9R9XDZw6GuVrVxLgd+Em96NEwkQW53ihfU9/vbzajL
pzIanVxF7fMIvR21PrJk4SUYT9jIL1qkLZ2YSR0Fhtco+18yl53UQyw20xlol1qr
bJFINao9Bj8J7U+WTpzK1Xrxn3ylYCXnbAVBOxACxGqBnXDLJxwBww0A/wIDAQAB
AoGBAIU/73hKSXYrEJiII4MDRIvArVUiRm+GC0axLrcqdSUHfL7SjIMO05amtxY/
GufTYS+mhIjMT3d/t/Uv7Aew/uo1BJno+sx5PU5ntKq7j3Kj9QHZMqz4pFqwswyS
X0fFBPfJYqXRwqyFKpH3kN3sE+VueKbYLhmZF8e8ZO9ArtgBAkEA06Jxwc5YAyuc
T3Cz8CRIPrGFyyfb7CWe6fmn0GWscmBf2bhkg0/nkEd0i0SLZiDz0TM0wQijZRrC
c0l51Z6m3wJBAM725Bziq3jf7Wi+IJBfLG+c0oQHw+OGDA8cnTVO4bZBkOhSG0Ou
LX2tc23S95B5zVJHRVeKYsIeqCPJ90mRieECQEztSUhXRuqwGXtOzjlGFvSi9q0n
6ermqeMGmpdHve09Vtn/Cpoom1V4g8Zzve/7nmS2pkBccXg4x+G8HYsmxiUCQFrr
3aTO85OjlFGajQW/ue7Cjz0PiEARKIUPBgVgRQpjXXyibXXbNALtSzNpJfcje071
HoJpuh8bhrRKSsfYFyECQC95Obs1Nt/Rgfodm0Sf/ZbFwHqKJRXs1sGbW2JnrQvL
tZwMednOBZB58DJC9zUTgWU9+q4qQqKUBtW9xDzE26o=
-----END RSA PRIVATE KEY-----`;

const publicKey = 
`-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCrGNI30r9R9XDZw6GuVrVxLgd+
Em96NEwkQW53ihfU9/vbzajLpzIanVxF7fMIvR21PrJk4SUYT9jIL1qkLZ2YSR0F
htco+18yl53UQyw20xlol1qrbJFINao9Bj8J7U+WTpzK1Xrxn3ylYCXnbAVBOxAC
xGqBnXDLJxwBww0A/wIDAQAB
-----END PUBLIC KEY-----`;

const source = Buffer.from(`
console.log("HELLO WORLD V2");

module.exports = (context, callback) => {
  callback(null, { message: "Test", test: new Error("Hello"), no: parseFloat('22.55') });
};`);

const sign = crypto.createSign('RSA-SHA256');
sign.update(source);

console.log('SIGNATURE', sign.sign(privateKey).toString('hex'));
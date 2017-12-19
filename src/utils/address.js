var crypto = require('crypto')
var base58check = require('./base58check')
var bignum = require('bignumber')
const NORMAL_PREFIX = 'A' // A

module.exports = {
  isAddress: function (address) {
    if (typeof address !== 'string') {
      return false
    }
    if (!/^[0-9]{1,20}$/g.test(address)) {
      if (!base58check.decodeUnsafe(address.slice(1))) {
        return false
      }
      /*if (['A'].indexOf(address[0]) == -1) {
        return false
      }*/
    }
    return true
  },

  isBase58CheckAddress: function (address) {
    if (typeof address !== 'string') {
      return false
    }
    if (!base58check.decodeUnsafe(address.slice(1))) {
      return false
    }
    /*if (['A'].indexOf(address[0]) == -1) {
      return false
    }*/
    return true
  },

  generateBase58CheckAddress: function (publicKey) {
    if (typeof publicKey === 'string') {
      publicKey = Buffer.from(publicKey, 'hex')
    }
    /*var h1 = crypto.createHash('sha256').update(publicKey).digest()
    var h2 = crypto.createHash('ripemd160').update(h1).digest()
    return NORMAL_PREFIX + base58check.encode(h2)*/

    console.log("generate...");
    var hash = crypto.createHash('sha256').update(publicKey).digest();
    var temp = new Buffer(8);
    for (var i = 0; i < 8; i++) {
      temp[i] = hash[7 - i];
    }

    var id = bignum.fromBuffer(temp).toString();
    return id;

  },
}
# browserify-bignum #

A JavaScript implementation of [node-bignum](https://github.com/justmoon/node-bignum) forked from the wonderful work done by MikeMcl as [bignumber.js](https://github.com/MikeMcl/bignumber.js)

## Usage
API functionality should be identical to that of [node-bignum](https://github.com/justmoon/node-bignum). However, a few methods are missing:
* BigNumber.prime(bits, safe=true)
* .toNumber()
* .and(n)
* .or(n)
* .xor(n)
* .invertm(n)
* .rand()
* .probPrime()
* .root(n)
* .shiftLeft(n)
* .shiftRight(n)
* .gcd(n)
* .jacobi(n)

*I have no intention of implementing them* if you would like to do so and submit a pull request I would happily accept it. I wrote this library so I could browserify [node-srp](https://github.com/mozilla/node-srp) which does not require any of the above mentioned methods.

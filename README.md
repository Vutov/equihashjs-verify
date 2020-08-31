# equihashjs-verify

[![NPM](https://img.shields.io/npm/v/equihashjs-verify.svg)](https://www.npmjs.com/package/equihashjs-verify)
[![Build Status](https://travis-ci.org/Vutov/equihashjs-verify.svg?branch=master)](https://travis-ci.org/Vutov/equihashjs-verify)

JavaScript check for valid Equihash solutions. Ported from ZCASH on Python

> ZCASH implementation: https://github.com/zcash/zcash/blob/master/qa/rpc-tests/test_framework/equihash.py

## Installation

``` bash
npm install equihashjs-verify
```

Node version: >= 10. Older versions may work but not testable because mocha dropped the support.

## Usage

````javascript
var eq = require('equihashjs-verify')

var equihash = new eq.Equihash(eq.networks.bitcoingold)

var header = new Buffer(..., 'hex') // include nonce in the header
var solution = new Buffer(..., 'hex') // do not include byte size preamble "fd4005"

var valid = equihash.verify(header, solution)
//returns boolean
````

````javascript
var eq = require('equihashjs-verify')

var equihash = new eq.Equihash(eq.networks.bitcoingold)

var header = new Buffer(..., 'hex') // nonce may not be included in the header
var solution = new Buffer(..., 'hex') // do not include byte size preamble "fd4005"
var nonce = new Buffer(..., 'hex')

var valid = equihash.verify(header, solution, nonce)
//returns boolean
````

## Example:

[Verify](https://github.com/Vutov/equihashjs-verify/blob/master/test/equihash.test.js#L16)

var assert = require('assert');
var Equihash = require('../src/equihash')
var NETWORKS = require('../src/networks')
var fixtures = require('./equihash.fixtures')

describe('Equihash', function () {
    'use strict'
    
    describe('Verify', function () {
        fixtures.valid.forEach(fixture => {
            it('should return true when valid ' + fixture.description, function () {
                let equihash = new Equihash(NETWORKS[fixture.network])
                let valid = false
                if (fixture.nonce) {
                    valid = equihash.verify(Buffer.from(fixture.header, 'hex'), Buffer.from(fixture.solution, 'hex'), Buffer.from(fixture.nonce, 'hex'))
                } else {
                    valid = equihash.verify(Buffer.from(fixture.header, 'hex'), Buffer.from(fixture.solution, 'hex'))
                }

                assert.ok(valid);
            });
        });

        fixtures.invalid.forEach(fixture => {
            it('should return false when not valid ' + fixture.description, function () {
                let valid = true
                let equihash = new Equihash(NETWORKS[fixture.network])

                // Node < 8 - buffer throw exception when wrong hex
                try {
                    let header = Buffer.from(fixture.header, 'hex'),
                    solution =  Buffer.from(fixture.solution, 'hex'),
                    nonce = fixture.nonce ? Buffer.from(fixture.nonce, 'hex') : null

                    valid = equihash.verify(header, solution, nonce)
                } catch(ex) {
                    console.log(ex)
                    valid = false;
                }
                
                assert.ok(!valid);
            });
        });

        fixtures.exception.forEach(fixture => {
            it('should throw exception when ' + fixture.description, function () {
                let equihash = new Equihash(NETWORKS[fixture.network])
                try {
                    if (fixture.nonce) {
                        equihash.verify(Buffer.from(fixture.header, 'hex'), Buffer.from(fixture.solution, 'hex'), Buffer.from(fixture.nonce, 'hex'))
                    } else {
                        equihash.verify(Buffer.from(fixture.header, 'hex'), Buffer.from(fixture.solution, 'hex'))
                    }
                } catch (ex) {
                    assert.ok(ex != null);
                    return
                }

                assert.fail();
            });
        });
    });
});

// # ZCASH implementation: https://github.com/zcash/zcash/blob/master/qa/rpc-tests/test_framework/equihash.py
var blake2b = require('blake2b')
var _ = require('lodash')
var Networks = require('./networks')

function Equihash(network) {
    this.network = network || Networks.bitcoingold
}

Equihash.prototype = function () {
    // DEBUG = true
    // VERBOSE = true
    'use strict'

    let word_size = 32,
        word_mask = 1 * Math.pow(2, 32) - 1, // (1 << word_size) - 1 overflow
        
        padLeft = function(str, size) {
            while (str.length < size) {
                str = "0" + str;
            }

            return str
        },

        assert = function (condition, message) {
            if (!condition) {
                message = message || "Assertion failed";
                if (typeof Error !== "undefined") {
                    throw new Error(message);
                }
                throw message; // Fallback
            }
        },

        // Ported
        expand_array = function (inp, out_len, bit_len, byte_pad) {
            byte_pad = byte_pad || 0
            assert(bit_len >= 8 && word_size >= 7 + bit_len)

            let out_width = Math.trunc((bit_len + 7) / 8) + byte_pad
            assert(out_len == Math.trunc(8 * out_width * inp.length / bit_len))
            let out = Buffer.alloc(out_len)

            let bit_len_mask = (1 << bit_len) - 1

            // # The acc_bits least-significant bits of acc_value represent a bit sequence
            // # in big-endian order.
            let acc_bits = 0
            let acc_value = 0

            let j = 0
            for (let i = 0; i < inp.length; i++) {
                acc_value = ((acc_value << 8) & word_mask) | inp[i]
                acc_bits += 8

                // # When we have bit_len or more bits in the accumulator, write the next
                // # output element.
                if (acc_bits >= bit_len) {
                    acc_bits -= bit_len
                    for (let x = byte_pad; x < out_width; x++) {
                        out[j + x] = (
                            // # Big-endian
                            acc_value >> (acc_bits + (8 * (out_width - x - 1)))
                        ) & (
                                // # Apply bit_len_mask across byte boundaries
                                (bit_len_mask >> (8 * (out_width - x - 1))) & 0xFF
                            )
                    }

                    j += out_width
                }
            }

            return out
        },

        // function compress_array(inp, out_len, bit_len, byte_pad = 0) {
        //     // assert bit_len >= 8 and word_size >= 7+bit_len

        //     var in_width = (bit_len + 7)//8 + byte_pad
        //     // assert out_len == bit_len*len(inp)//(8*in_width)
        //     var out = bytearray(out_len)

        //     var bit_len_mask = (1 << bit_len) - 1

        //     // # The acc_bits least-significant bits of acc_value represent a bit sequence
        //     // # in big-endian order.
        //     var acc_bits = 0
        //     var acc_value = 0

        //     var j = 0
        //     for (var i = 0; i < out_len.length; i++) {
        //         // # When we have fewer than 8 bits left in the accumulator, read the next
        //         // # input element.
        //         if (acc_bits < 8) {
        //             acc_value = ((acc_value << bit_len) & word_mask) | inp[j]
        //             for (var x = byte_pad; x < in_width; x++) {
        //                 acc_value = acc_value | (
        //                     (
        //                         // # Apply bit_len_mask across byte boundaries
        //                         inp[j + x] & ((bit_len_mask >> (8 * (in_width - x - 1))) & 0xFF)
        //                     ) << (8 * (in_width - x - 1))) // # Big-endian
        //             }
        //             j += in_width
        //             acc_bits += bit_len
        //         }
        //         acc_bits -= 8
        //         out[i] = (acc_value >> acc_bits) & 0xFF
        //     }

        //     return out
        // }

        // Ported
        get_indices_from_minimal = function (minimal, bit_len) {
            let eh_index_size = 4
            assert(Math.trunc((bit_len + 7) / 8) <= eh_index_size)
            let len_indices = Math.trunc(8 * eh_index_size * minimal.length / bit_len)
            let byte_pad = eh_index_size - Math.trunc((bit_len + 7) / 8)
            let expanded = expand_array(minimal, len_indices, bit_len, byte_pad)

            let data = []
            for (let i = 0; i < len_indices; i += eh_index_size) {
                data.push(expanded.readUInt32BE(i, i + 4))
            }

            return data
        },

        // function get_minimal_from_indices(indices, bit_len) {
        //     var eh_index_size = 4
        //     // assert (bit_len+7)//8 <= eh_index_size
        //     var len_indices = len(indices) * eh_index_size
        //     var min_len = bit_len * len_indices//(8*eh_index_size)
        //     var byte_pad = eh_index_size - (bit_len + 7)//8
        //     var byte_indices = ''//bytearray(b''.join([struct.pack('>I', i) for i in indices]))
        //     return compress_array(byte_indices, min_len, bit_len, byte_pad)
        // }

        // Ported
        hash_nonce = function (digest, nonce) {
            for (let i = 7; i >= 0; i--) {
                let buf = Buffer.alloc(4)
                let num = nonce.readUInt32BE(4 * i, 4 * (i + 1))
                buf.writeUIntLE(num, 0, 4)
                digest.update(buf)
            }
        },

        // Ported
        hash_xi = function (digest, xi) {
            let buf = Buffer.alloc(4)
            buf.writeUInt32LE(xi, 0, 4)
            digest.update(buf)
            return digest //# For chaining
        },

        // Ported
        count_zeroes = function (h) {
            // # Convert to binary string
            let res = ''
            for (let i = 0; i < h.length; i++) {
                res += padLeft(h[i].toString(2), 8)
            }

            // # Count leading zeroes
            return (res + '1').indexOf('1')
        },

        // Ported
        has_collision = function (ha, hb, i, l) {
            let res = []
            for (let j = Math.trunc((i - 1) * l / 8); j < Math.trunc(i * l / 8); j++) {
                res.push(ha[j] == hb[j])
            }

            return res.every(x => x === true);
        },

        // Ported
        distinct_indices = function (a, b) {
            for (let i = 0; i < a.length; i++) {
                for (let j = 0; j < b.length; j++) {
                    if (a[i] === b[j]) {
                        return false
                    }
                }
            }

            return true
        },

        // Ported
        xor = function (ha, hb) {
            let zip = _.zip(ha, hb)
            let res = []
            for (let i = 0; i < zip.length; i++) {
                res.push(zip[i][0] ^ zip[i][1])
            }

            return Buffer.from(res)
        },

        // function gbp_basic(digest, n, k) {
        //     // '''Implementation of Basic Wagner's algorithm for the GBP.'''
        //     validate_params(n, k)
        //     var collision_length = n / (k + 1)
        //     var hash_length = (k + 1) * ((collision_length + 7) / 8)
        //     var indices_per_hash_output = 512 / n

        //     // # 1) Generate first list
        //     if (DEBUG) {
        //         console.log('Generating first list')
        //     }

        //     var X = []
        //     var tmp_hash = ''
        //     for (var i = 0; i < 2 ** (collision_length + 1); i++) {
        //         var r = i % indices_per_hash_output
        //         if (r == 0) {
        //             // # X_i = H(I||V||x_i)
        //             var curr_digest = digest.copy()
        //             hash_xi(curr_digest, i / indices_per_hash_output)
        //             tmp_hash = curr_digest.digest()
        //         }
        //         X.append(
        //             // expand_array(bytearray(tmp_hash[r*n/8:(r+1)*n/8]),
        //             //              hash_length, collision_length),
        //             // (i,)
        //         )
        //     }

        //     // # 3) Repeat step 2 until 2n/(k+1) bits remain
        //     for (i = 1; i < k; i++) {
        //         if (DEBUG) {
        //             console.log('Round ' + i + ':')
        //         }

        //         // # 2a) Sort the list
        //         if (DEBUG) {
        //             console.log('- Sorting list')
        //         }

        //         X.sort(key = itemgetter(0))

        //         if (DEBUG && VERBOSE) {
        //             for (var Xi in X) { // Xi in X[-32:]{
        //                 console.log(print_hash(Xi[0]) + ' ' + Xi[1])
        //             }
        //         }

        //         if (DEBUG) {
        //             console.log('- Finding collisions')
        //         }

        //         var Xc = []
        //         while (X.length > 0) {
        //             // # 2b) Find next set of unordered pairs with collisions on first n/(k+1) bits
        //             j = 1
        //             while (j < X.length) {
        //                 if (!has_collision(X[-1][0], X[-1 - j][0], i, collision_length)) {
        //                     break
        //                 }

        //                 j += 1
        //             }

        //             // # 2c) Store tuples (X_i ^ X_j, (i, j)) on the table
        //             for (var l = 0; l < j - 1; l++) {
        //                 for (var m = l + 1; m < j; m++) {
        //                     // # Check that there are no duplicate indices in tuples i and j
        //                     if (distinct_indices(X[-1 - l][1], X[-1 - m][1])) {
        //                         if (X[-1 - l][1][0] < X[-1 - m][1][0]) {
        //                             concat = X[-1 - l][1] + X[-1 - m][1]
        //                         }
        //                         else {
        //                             concat = X[-1 - m][1] + X[-1 - l][1]
        //                         }

        //                         Xc.append((xor(X[-1 - l][0], X[-1 - m][0]), concat))
        //                     }
        //                 }
        //             }

        //             // # 2d) Drop this set
        //             while (j > 0) {
        //                 X.pop(-1)
        //                 j -= 1
        //             }
        //         }

        //         // # 2e) Replace previous list with new list
        //         X = Xc
        //     }
        //     // # k+1) Find a collision on last 2n(k+1) bits
        //     if (DEBUG) {
        //         console.log('Final round:')
        //         console.log('- Sorting list')
        //     }

        //     X.sort(key = itemgetter(0))
        //     if (DEBUG && VERBOSE) {
        //         for (var Xi in X) {//[-32:]:
        //             console.log(print_hash(Xi[0]) + ' ' + Xi[1])
        //         }
        //     }
        //     if (DEBUG) {
        //         console.log('- Finding collisions')
        //     }
        //     solns = []
        //     while (X.length > 0) {
        //         var j = 1
        //         while (j < X.length) {
        //             if (!(has_collision(X[-1][0], X[-1 - j][0], k, collision_length)) &&
        //                 has_collision(X[-1][0], X[-1 - j][0], k + 1, collision_length)) {
        //                 break
        //             }

        //             j += 1
        //         }

        //         for (var l = 0; l < j - 1; l++) {
        //             for (var m = l + 1; l < j; l++) {
        //                 res = xor(X[-1 - l][0], X[-1 - m][0])
        //                 if (count_zeroes(res) == 8 * hash_length && distinct_indices(X[-1 - l][1], X[-1 - m][1])) {
        //                     if (DEBUG && VERBOSE) {
        //                         console.log('Found solution:')
        //                         console.log('- ' + print_hash(X[-1 - l][0]) + ' ' + X[-1 - l][1])
        //                         console.log('- ' + (print_hash(X[-1 - m][0]) + ' ' + X[-1 - m][1]))
        //                     }
        //                     if (X[-1 - l][1][0] < X[-1 - m][1][0]) {
        //                         solns.append(list(X[-1 - l][1] + X[-1 - m][1]))
        //                     } else {
        //                         solns.append(list(X[-1 - m][1] + X[-1 - l][1]))
        //                     }
        //                 }
        //             }
        //         }
        //         // # 2d) Drop this set
        //         while (j > 0) {
        //             X.pop(-1)
        //             j -= 1
        //         }
        //     }

        //     return //[get_minimal_from_indices(soln, collision_length+1) for soln in solns]
        // }

        // Ported
        gbp_validate = function (createDigest, minimal, n, k) {
            validate_params(n, k)
            var collision_length = n / (k + 1)
            var hash_length = (k + 1) * (Math.trunc((collision_length + 7) / 8))
            var indices_per_hash_output = Math.trunc(512 / n)
            var solution_width = Math.trunc((1 << k) * (collision_length + 1) / 8)

            if (minimal.length != solution_width) {
                console.log('Invalid solution length: ' + minimal.length + ' (expected ' + solution_width + ')')
                return false
            }

            let X = []
            let indices = get_indices_from_minimal(minimal, collision_length + 1)
            for (let m = 0; m < indices.length; m++) {
                let i = indices[m]
                let r = i % indices_per_hash_output
                // # X_i = H(I||V||x_i)
                let curr_digest = createDigest()
                hash_xi(curr_digest, Math.trunc(i / indices_per_hash_output))
                let tmp_hash = curr_digest.digest()
                let slice = tmp_hash.slice(Math.trunc(r * n / 8), Math.trunc((r + 1) * n / 8))
                X.push([
                    expand_array(slice, hash_length, collision_length),
                    [i]
                ])
            }

            for (let r = 1; r < k + 1; r++) {
                let Xc = []
                for (let i = 0; i < X.length; i += 2) {
                    if (!has_collision(X[i][0], X[i + 1][0], r, collision_length)) {
                        console.log('Invalid solution: invalid collision length between StepRows')
                        return false
                    }
                    if (X[i + 1][1][0] < X[i][1][0]) {
                        console.log('Invalid solution: Index tree incorrectly ordered')
                        return false
                    }
                    if (!distinct_indices(X[i][1], X[i + 1][1])) {
                        console.log('Invalid solution: duplicate indices')
                        return false
                    }

                    Xc.push([xor(X[i][0], X[i + 1][0]), _.union(X[i][1], X[i + 1][1])])
                }

                X = Xc
            }

            if (X.length != 1) {
                console.log('Invalid solution: incorrect length after end of rounds: ' + X.length)
                return false
            }

            if (count_zeroes(X[0][0]) != 8 * hash_length) {
                console.log('Invalid solution: incorrect number of zeroes: ' + count_zeroes(X[0][0]))
                return false
            }

            return true
        },

        // Ported
        zcash_person = function (n, k) {
            let buf = Buffer.alloc(16)
            buf.write('ZcashPoW', 0, 8, 'utf8')
            buf.writeUIntLE(n, 8, 4)
            buf.writeUIntLE(k, 12, 4)

            return buf;
        },

        // function print_hash(h) {
        //     if (type(h) == bytearray) {
        //         return ''//.join('{0:02x}'.format(x, 'x') for x in h)
        //     } else {
        //         return ''//.join('{0:02x}'.format(ord(x), 'x') for x in h)
        //     }
        // }

        // Ported
        validate_params = function (n, k) {
            if (k >= n) {
                throw new Error('n must be larger than k')
            }
            if (((n / (k + 1)) + 1) >= 32) {
                throw new Error('Parameters must satisfy n/(k+1)+1 < 32')
            }
        },

        // Ported
        is_gbp_valid = function (header, nNonce, nSolution, n, k) {
            n = n || 48
            k = k || 5
            // # H(I||...
            let createDigest = function () {
                let digest = blake2b(Math.trunc((512 / n)) * Math.trunc(n / 8), null, null, zcash_person(n, k))
                digest.update(header.slice(0, 108))
                hash_nonce(digest, nNonce)

                return digest
            }

            return gbp_validate(createDigest, nSolution, n, k)
        },

        verify = function (header, solution, nonce) {
            assert(Buffer.isBuffer(header), 'Header must be Buffer')
            assert(header.length >= 108, 'Header must be at least 108 long')
            assert(Buffer.isBuffer(solution), 'Solution must be Buffer')

            if (nonce) {
                assert(Buffer.isBuffer(nonce), 'Nonce must be Buffer')
            } else {
                assert(header.length >= 140, 'Header must contain nonce')
                var nonceHex = header.slice(140-32, 140).toString('hex').match(/.{2}/g).reverse().join("")
                nonce = Buffer.from(nonceHex, 'hex')
            }

            return is_gbp_valid(header, nonce, solution, this.network.n, this.network.k)
        }

    return {
        verify: verify
    }
}()

module.exports = Equihash
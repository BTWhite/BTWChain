const async = require('async');
const request = require('request');
const ip = require('ip');
const util = require('util');
const extend = require('extend');
const crypto = require('crypto');
const bignum = require('bignumber');
const Router = require('../utils/router.js');
const slots = require('../utils/slots.js');
const sandboxHelper = require('../utils/sandbox.js');
const LimitCache = require('../utils/limit-cache.js');
const shell = require('../utils/shell.js');

// Private fields
var modules, library, self, __cur = {}, shared = {};

__cur.headers = {};
__cur.loaded = false;
__cur.messages = {};
__cur.invalidTrsCache = new LimitCache();
__cur.unconfirmedBuff = [];
__cur.unconfirmedTimer = null;
__cur.judgesList = [];
__cur.judgeBuff = [];
__cur.judgeCache = [];
__cur.judgeSlot = null;

// Constructor
function Transport(cb, scope) {
    library = scope;
    self = this;
    self.__private = __cur;
    __cur.attachApi();

    setImmediate(cb, null, self);
}

// Private methods
__cur.attachApi = function () {
    var router = new Router();

    router.use(function (req, res, next) {
        if (req.url.startsWith("/judge")) return next();
        if (modules && __cur.loaded && !modules.loader.syncing()) return next();
        res.status(429).send({success: false, error: "Blockchain is loading"});
    });

    router.use(function (req, res, next) {
        var peerIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if (!peerIp) {
            return res.status(500).send({success: false, error: "Wrong header data"});
        }

        req.headers['port'] = parseInt(req.headers['port']);

        req.sanitize(req.headers, {
            type: "object",
            properties: {
                os: {
                    type: "string",
                    maxLength: 64
                },
                'magic': {
                    type: 'string',
                    maxLength: 8
                },
                'version': {
                    type: 'string',
                    maxLength: 11
                }
            },
            required: ['magic', 'version']
        }, function (err, report, headers) {
            if (err) return next(err);
            if (!report.isValid) return res.status(500).send({success: false, error: report.issues});

            if (req.headers['magic'] !== library.config.magic) {
                return res.status(500).send({
                    success: false,
                    error: "Request is made on the wrong network",
                    expected: library.config.magic,
                    received: req.headers['magic']
                });
            }
            // if (peerIp == "127.0.0.1") {
            //   return next();
            // }
            if (!req.headers.version) {
                return next();
            }
            var peer = {
                ip: ip.toLong(peerIp),
                port: headers.port,
                state: 2,
                os: headers.os,
                version: headers.version
            };

            if (req.body && req.body.dappId) {
                peer.dappId = req.body.dappId;
            }

            if (peer.port && peer.port > 0 && peer.port <= 65535) {
                if (modules.peer.isCompatible(peer.version)) {
                    peer.version && modules.peer.update(peer);
                } else {
                    return res.status(500).send({
                        success: false,
                        error: "Version is not comtibleVersion"
                    });
                }
            }

            next();
        });

    });

    router.get('/list', function (req, res) {
        res.set(__cur.headers);
        modules.peer.listWithDApp({limit: 100}, function (err, peers) {
            return res.status(200).json({peers: !err ? peers : []});
        })
    });

    router.get("/blocks/common", function (req, res, next) {
        res.set(__cur.headers);

        req.sanitize(req.query, {
            type: "object",
            properties: {
                max: {
                    type: 'integer'
                },
                min: {
                    type: 'integer'
                },
                ids: {
                    type: 'string',
                    format: 'splitarray'
                }
            },
            required: ['max', 'min', 'ids']
        }, function (err, report, query) {
            if (err) return next(err);
            if (!report.isValid) return res.json({success: false, error: report.issue});


            var max = query.max;
            var min = query.min;
            var ids = query.ids.split(",");
            var escapedIds = ids.map(function (id) {
                return "'" + id + "'";
            });

            if (!escapedIds.length) {
                report = library.scheme.validate(req.headers, {
                    type: "object",
                    properties: {
                        port: {
                            type: "integer",
                            minimum: 1,
                            maximum: 65535
                        },
                        magic: {
                            type: "string",
                            maxLength: 8
                        }
                    },
                    required: ['port', 'magic']
                });

                var peerIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                var peerStr = peerIp ? peerIp + ":" + (isNaN(parseInt(req.headers['port'])) ? 'unkwnown' : parseInt(req.headers['port'])) : 'unknown';
                library.logger.log('Invalid common block request, ban 60 min', peerStr);

                if (report) {
                    modules.peer.state(ip.toLong(peerIp), parseInt(req.headers['port']), 0, 3600);
                }

                return res.json({success: false, error: "Invalid block id sequence"});
            }

            library.dbLite.query("select max(height), id, previousBlock, timestamp from blocks where id in (" + escapedIds.join(',') + ") and height >= $min and height <= $max", {
                "max": max,
                "min": min
            }, {
                "height": Number,
                "id": String,
                "previousBlock": String,
                "timestamp": Number
            }, function (err, rows) {
                if (err) {
                    return res.json({success: false, error: "Database error"});
                }

                var commonBlock = rows.length ? rows[0] : null;
                return res.json({success: true, common: commonBlock});
            });
        });
    });

    router.get("/blocks", function (req, res) {
        res.set(__cur.headers);

        req.sanitize(req.query, {
            type: 'object',
            properties: {lastBlockId: {type: 'string'}}
        }, function (err, report, query) {
            if (err) return next(err);
            if (!report.isValid) return res.json({success: false, error: report.issues});

            // Get 1400+ blocks with all data (joins) from provided block id
            var blocksLimit = 200;
            if (query.limit) {
                blocksLimit = Math.min(blocksLimit, Number(query.limit))
            }

            modules.blocks.loadBlocksData({
                limit: blocksLimit,
                lastId: query.lastBlockId
            }, {plain: true}, function (err, data) {
                res.status(200);
                if (err) {
                    return res.json({blocks: ""});
                }

                res.json({blocks: data});

            });
        });
    });

    router.post("/judge/blocks", function t(req, res) {
        if(self.hasUnknownJudges()) {
            library.bus.message("searchJudges");
        }

        res && res.set(__cur.headers);
        var block = req.body.block;
        if (typeof req.body.block == 'string') {
            block = library.protobuf.decodeBlock(new Buffer(req.body.block, 'base64'));
        }

        var votes = req.body.votes;
        if (typeof req.body.votes == 'string') {
            votes = library.protobuf.decodeBlockVotes(new Buffer(req.body.votes, 'base64'));
        }

        try {
            block = library.base.block.objectNormalize(block);
            votes = library.base.consensus.normalizeVotes(votes);
        } catch (e) {
            library.logger.log('normalize block or votes object error: ' + e.toString());
            library.logger.log('Block ' + (block ? block.id : 'null') + ' is not valid, ban 60 min');

            return res && res.sendStatus(200);
        }

        var myJudges = [];
        var activeKeypairs = [];
        async.series([
            function (cb) {
                modules.blocks.verifyBlock(block, votes, function (err) {
                    if (err) {
                        return cb("Failed to verify block: " + err);
                    }
                    library.logger.debug("verify block ok");
                    library.dbLite.query("SELECT id FROM blocks WHERE id=$id", {id: block.id}, ['id'], function (err, rows) {
                        if (err) {
                            return cb("Failed to query blocks from db: " + err);
                        }
                        var bId = rows.length && rows[0].id;
                        if (bId && save) {
                            return cb("Block already exists: " + block.id);
                        }

                        modules.delegates.validateBlockSlot(block, function (err) {
                            if (err) {
                                return cb("Can't verify slot: " + err);
                            } else {
                                cb();
                            }
                        });
                    });
                });
            },
            function (cb) {
                modules.transport.getMyJudges(function(err, judges) {
                    if (err) {
                        cb(err);
                    }
                    myJudges = judges;
                    cb();
                });
            },
            function (cb) {

                modules.delegates.getActiveDelegateKeypairs(block.height, function (err, delegates) {
                    if (err) {
                        return cb(err);
                    }
                    for (var j = myJudges.length - 1; j >= 0; j--) {
                        for (var i = delegates.length - 1; i >= 0; i--) {
                            if(myJudges[j] == delegates[i].publicKey.toString("hex")) {
                                activeKeypairs.push(delegates[i]);
                            }

                        }
                    }
                    cb();
                });
            },
            function (cb) {
                if (myJudges.length === 0) {
                    return cb(); 
                }
                
                var judgeVotes = library.base.consensus.createVotes(activeKeypairs, block);
                var data = req.body;

                library.logger.debug("Judges sign, count: " + activeKeypairs.length);

                __cur.judgeSelect(block, votes, judgeVotes, function (result) {
                    if (result == null) return;

                    data.judgeVotes = library.protobuf.encodeBlockVotes(result).toString('base64');
                    // library.logger.log(data)
                    var processed = false;
                    modules.transport.broadcastJudges({api: '/judge/accept', data: data, method: "POST"}, cb, function(err, data, judge) {
                        if (__cur.judgesSucc == undefined || __cur.judgesSucc == null || __cur.judgesSucc == NaN) {
                            __cur.judgesSucc = 0;
                        }

                        if (__cur.judgesErr == undefined || __cur.judgesErr == null || __cur.judgesSucc == NaN) {
                            __cur.judgesErr = 0;
                        }

                        if (err) {    
                            __cur.judgesErr++;
                            library.logger.debug(judge.publicKey + " error: " + err);
                        } else {
                            __cur.judgesSucc++;
                        }


                        if(__cur.judgesSucc + __cur.judgesErr >= __cur.judgesList.length) {
                            var done = function() {
                                __cur.judgeDecision(block.height, function(err, blockId) {
                                    if(err) {
                                        library.logger.error(err);
                                        return;
                                    }
                                    
                                    var judges = library.base.consensus.getJudges();

                                    for(var i = 0; i < judges.length; i++) {
                                        if(processed == true) {
                                            break;
                                        }
                                        var item = __cur.judgeBuff[block.height][judges[i]];
                                        if(item == null) continue;

                                        if(item.block.id == blockId) {
                                            if (__cur.judgeCache[blockId]) {
                                                break;
                                            }
                                            __cur.judgeCache[blockId] = true;

                                            library.logger.debug("Proccessing block " + blockId);
                                            modules.blocks.processBlock(item.block, item.votes, true, true, false, function (err) {
                                                if (err) {
                                                    library.logger.error("Failed to process confirmed block height: " + item.block.height + " id: " + item.block.id + " error: " + err);
                                                    return;
                                                }
                                                library.logger.log('Sending new block id: ' + item.block.id);
                                                processed = true;
                                            });
                                            break;
                                        }
                                    }
                                });
                            }
                            if (__cur.judgesErr > 0) {
                                setTimeout(done, 2000);
                            } else {
                                done();
                            }
                            
                        }
                    });
                });   
            }
        ], function (err) {
            if (err) {
                library.logger.error("Judges verify block error: " + err);
            }
            res && res.sendStatus(200);
        });
        

    });

    router.post("/judge/accept", function(req, res) {
        res.set(__cur.headers);
        if (typeof req.body.block == 'string') {
            req.body.block = library.protobuf.decodeBlock(new Buffer(req.body.block, 'base64'));
        }
        
        if (typeof req.body.votes == 'string') {
            req.body.votes = library.protobuf.decodeBlockVotes(new Buffer(req.body.votes, 'base64'));
        }

        if (typeof req.body.judgeVotes == 'string') {
            req.body.judgeVotes = library.protobuf.decodeBlockVotes(new Buffer(req.body.judgeVotes, 'base64'));
        }

        
        __cur.judgeSelect(req.body.block, req.body.votes, req.body.judgeVotes, function(result) {
            
            res.sendStatus(200);
        });
        
    });

    router.post("/blocks", function (req, res) {
        res.set(__cur.headers);

        var peerIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        var peerStr = peerIp ? peerIp + ":" + (isNaN(parseInt(req.headers['port'])) ? 'unkwnown' : parseInt(req.headers['port'])) : 'unknown';
        if (typeof req.body.block == 'string') {
            req.body.block = library.protobuf.decodeBlock(new Buffer(req.body.block, 'base64'));
        }
        if (typeof req.body.votes == 'string') {
            req.body.votes = library.protobuf.decodeBlockVotes(new Buffer(req.body.votes, 'base64'));
        }
        try {
            var block = library.base.block.objectNormalize(req.body.block);
            var votes = library.base.consensus.normalizeVotes(req.body.votes);
        } catch (e) {
            library.logger.log('normalize block or votes object error: ' + e.toString());
            library.logger.log('Block ' + (block ? block.id : 'null') + ' is not valid, ban 60 min', peerStr);

            if (peerIp && req.headers['port'] > 0 && req.headers['port'] < 65536) {
                modules.peer.state(ip.toLong(peerIp), parseInt(req.headers['port']), 0, 3600);
            }

            return res.sendStatus(200);
        }

        
        library.bus.message('receiveBlock', block, votes);
        res.sendStatus(200);
    });

    router.post("/votes", function (req, res) {
        res.set(__cur.headers);

        library.scheme.validate(req.body, {
            type: "object",
            properties: {
                height: {
                    type: "integer",
                    minimum: 1
                },
                id: {
                    type: "string",
                    maxLength: 64,
                },
                signatures: {
                    type: "array",
                    minLength: 1,
                    maxLength: 101,
                }
            },
            required: ["height", "id", "signatures"]
        }, function (err) {
            if (err) {
                return res.status(200).json({success: false, error: "Schema validation error"});
            }
            library.bus.message('receiveVotes', req.body);
            res.sendStatus(200);
        });
    });

    router.post("/propose", function (req, res) {
        res.set(__cur.headers);
        if (typeof req.body.propose == 'string') {
            req.body.propose = library.protobuf.decodeBlockPropose(new Buffer(req.body.propose, 'base64'));
        }
        library.scheme.validate(req.body.propose, {
            type: "object",
            properties: {
                height: {
                    type: "integer",
                    minimum: 1
                },
                id: {
                    type: "string",
                    maxLength: 64,
                },
                timestamp: {
                    type: "integer"
                },
                generatorPublicKey: {
                    type: "string",
                    format: "publicKey"
                },
                address: {
                    type: "string"
                },
                hash: {
                    type: "string",
                    format: "hex"
                },
                signature: {
                    type: "string",
                    format: "signature"
                }
            },
            required: ["height", "id", "timestamp", "generatorPublicKey", "address", "hash", "signature"]
        }, function (err) {
            if (err) {
                return res.status(200).json({success: false, error: "Schema validation error"});
            }

            library.bus.message('receivePropose', req.body.propose);
            res.sendStatus(200);
        });
    });

    router.post('/signatures', function (req, res) {
        res.set(__cur.headers);

        library.scheme.validate(req.body, {
            type: "object",
            properties: {
                signature: {
                    type: "object",
                    properties: {
                        transaction: {
                            type: "string"
                        },
                        signature: {
                            type: "string",
                            format: "signature"
                        }
                    },
                    required: ['transaction', 'signature']
                }
            },
            required: ['signature']
        }, function (err) {
            if (err) {
                return res.status(200).json({success: false, error: "Validation error"});
            }

            modules.multisignatures.processSignature(req.body.signature, function (err) {
                if (err) {
                    return res.status(200).json({success: false, error: "Process signature error"});
                } else {
                    return res.status(200).json({success: true});
                }
            });
        });
    });

    router.get('/signatures', function (req, res) {
        res.set(__cur.headers);

        var unconfirmedList = modules.transactions.getUnconfirmedTransactionList();
        var signatures = [];

        async.eachSeries(unconfirmedList, function (trs, cb) {
            if (trs.signatures && trs.signatures.length) {
                signatures.push({
                    transaction: trs.id,
                    signatures: trs.signatures
                });
            }

            setImmediate(cb);
        }, function () {
            return res.status(200).json({success: true, signatures: signatures});
        });
    });

    router.get("/transactions", function (req, res) {
        res.set(__cur.headers);
        // Need to process headers from peer
        res.status(200).json({transactions: modules.transactions.getUnconfirmedTransactionList()});
    });

    router.post("/transactions", function (req, res) {
        //console.log(req.body);
        var lastBlock = modules.blocks.getLastBlock();
        var lastSlot = slots.getSlotNumber(lastBlock.timestamp);
        /*if (slots.getNextSlot() - lastSlot >= 12) {
            //library.logger.error("OS INFO", shell.getInfo());
            library.logger.error("Blockchain is not ready", {
                getNextSlot: slots.getNextSlot(),
                lastSlot: lastSlot,
                lastBlockHeight: lastBlock.height
            });
            return res.status(200).json({success: false, error: "Blockchain is not ready"});
        }*/

        res.set(__cur.headers);

        var peerIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        var peerStr = peerIp ? peerIp + ":" + (isNaN(req.headers['port']) ? 'unknown' : req.headers['port']) : 'unknown';
        
        if ((!!req.body) && (req.body.constructor === Object)) {
            if (typeof req.body.transaction == 'string') {
                req.body.transaction = library.protobuf.decodeTransaction(new Buffer(req.body.transaction, 'base64'));
            }

            return process(req.body.transaction, req, function(data) {
                return res.status(200).json(data);
            })

        } else if (!Array.isArray(req.body)) {
            library.logger.error("transactions list parse error", {
                raw: req.body,
                type: typeof req.body
            });
            return {success: false, error: "Invalid transaction list body"};
        } 

        var results = [];
        for (var i = req.body.length - 1; i >= 0; i--) {
            if (typeof req.body[i].transaction == 'string') {
                req.body[i].transaction = library.protobuf.decodeTransaction(new Buffer(req.body[i].transaction, 'base64'));
            }
            process(req.body[i].transaction, req, function(data) {
                results.push(data);
            })
            
        }

        if(results.length == 1) {
            return res.status(200).json(results[0]);
        } else {
            return res.status(200).json(results);
        }
        

        function process(trs, req, cb) {
            try {
                var transaction = library.base.transaction.objectNormalize(trs);
                transaction.asset = transaction.asset || {}
            } catch (e) {
                library.logger.error("transaction parse error", {
                    raw: trs,
                    trs: transaction,
                    error: e.toString()
                });
                library.logger.log('Received transaction ' + (transaction ? transaction.id : 'null') + ' is not valid, ban 60 min', peerStr);

                if (peerIp && req.headers['port'] > 0 && req.headers['port' < 65536]) {
                    modules.peer.state(ip.toLong(peerIp), req.headers['port'], 0, 3600);
                }

                return cb({success: false, error: "Invalid transaction body"});
            }

            if (__cur.invalidTrsCache.has(transaction.id)) {
                library.logger.debug("Already processed transaction " + transaction.id);
                return cb({success: false, error: "Already processed transaction"  + transaction.id});
            }

            library.balancesSequence.add(function (cb) {
                if (modules.transactions.hasUnconfirmedTransaction(transaction)) {
                    return cb('Already exists');
                }
                library.logger.log('Received transaction ' + transaction.id + ' from peer ' + peerStr);
                modules.transactions.receiveTransactions([transaction], cb);
            }, function (err, transactions) {
                if (err) {
                    library.logger.warn('Receive invalid transaction,id is', transaction.id, err);
                    __cur.invalidTrsCache.set(transaction.id, true);
                    return cb({success: false, error: err})
                } else {
                    return cb({success: true, transactionId: transactions[0].id});
                }
            });
        }
    });

    router.get('/height', function (req, res) {
        res.set(__cur.headers);
        res.status(200).json({
            height: modules.blocks.getLastBlock().height
        });
    });

    router.post("/dapp/message", function (req, res) {
        res.set(__cur.headers);

        try {
            if (!req.body.dappId) {
                return res.status(200).json({success: false, error: "missed dappId"});
            }
            if (!req.body.timestamp || !req.body.hash) {
                return res.status(200).json({
                    success: false,
                    error: "missed hash sum"
                });
            }
            var newHash = __cur.hashsum(req.body.body, req.body.timestamp);
            if (newHash !== req.body.hash) {
                return res.status(200).json({success: false, error: "wrong hash sum"});
            }
        } catch (e) {
            return res.status(200).json({success: false, error: e.toString()});
        }

        if (__cur.messages[req.body.hash]) {
            return res.sendStatus(200);
        }

        __cur.messages[req.body.hash] = true;
        modules.dapps.message(req.body.dappId, req.body.body, function (err, body) {
            if (!err && body.error) {
                err = body.error;
            }

            if (err) {
                return res.status(200).json({success: false, error: err});
            }

            library.bus.message('message', req.body, true);
            res.status(200).json(extend({}, body, {success: true}));
        });
    });

    router.post("/dapp/request", function (req, res) {
        res.set(__cur.headers);

        try {
            if (!req.body.dappId) {
                return res.status(200).json({success: false, error: "missed dappId"});
            }
            if (!req.body.timestamp || !req.body.hash) {
                return res.status(200).json({
                    success: false,
                    error: "missed hash sum"
                });
            }
            var newHash = __cur.hashsum(req.body.body, req.body.timestamp);
            if (newHash !== req.body.hash) {
                return res.status(200).json({success: false, error: "wrong hash sum"});
            }
        } catch (e) {
            return res.status(200).json({success: false, error: e.toString()});
        }

        modules.dapps.request(req.body.dappId, req.body.body.method, req.body.body.path, {query: req.body.body.query}, function (err, body) {
            if (!err && body.error) {
                err = body.error;
            }

            if (err) {
                return res.status(200).json({success: false, error: err});
            }
            res.status(200).json(extend({}, {success: true}, body));
        });
    });

    router.post("/dappReady", function (req, res) {
        res.set(__cur.headers);

        library.scheme.validate(req.body, {
            type: "object",
            properties: {
                dappId: {
                    type: "string",
                    length: 64
                }
            },
            required: ["dappId"]
        }, function (err) {
            if (err) {
                return res.status(200).json({success: false, error: "Schema validation error"});
            }
            res.sendStatus(200);
        });
    });

    router.post('/judge', function (req, res) {
        res.set(__cur.headers);

        library.scheme.validate(req.body, {
            type: "object",
            properties: {
                judge: {
                    type: "object"
                }
            },
            required: ["judge"]
        }, function (err) {
            if (err) {
                library.logger.log(err);
                return res.status(200).json({success: false, error: "Schema validation error"});
            }

            self.addJudge(req.body.judge, function (err) {
                if (err) {
                    library.logger.debug("Received invalid judge: " + err);
                } else {
                    library.logger.debug("Judge accepted: " + req.body.judge.publicKey);
                }

                return res.sendStatus(200);
            });
            
            
        });
    });

    router.get('/judge', function(req, res) {
        res.set(__cur.headers);
        res.status(200).json(__cur.judgesList);
    });

    router.use(function (req, res, next) {
        res.status(500).send({success: false, error: "API endpoint not found"});
    });

    library.network.app.use('/peer', router);

    library.network.app.use(function (err, req, res, next) {
        if (!err) return next();
        library.logger.error(req.url, err.toString());
        res.status(500).send({success: false, error: err.toString()});
    });
}

__cur.hashsum = function (obj) {
    var buf = new Buffer(JSON.stringify(obj), 'utf8');
    var hashdig = crypto.createHash('sha256').update(buf).digest();
    var temp = new Buffer(8);
    for (var i = 0; i < 8; i++) {
        temp[i] = hashdig[7 - i];
    }

    return bignum.fromBuffer(temp).toString();
};

__cur.judgeSelect = function (block, votes, judgeVotes, cb) {
    var result = {
        id: judgeVotes.id,
        height: judgeVotes.height,
        signatures: []
    };

    async.eachSeries(judgeVotes.signatures, function (vote, cb) {
        if (!library.base.consensus.isValidJudge(vote.key.toString("hex"))) {
            library.logger.warn("Received invalid judge: " + vote.key.toString("hex"));
            return cb();
        }

        if (!library.base.consensus.verifyVote(block.height, block.id, vote)) {
            library.logger.warn("Received invalid vote by judge: " + vote.key.toString("hex"));
            return cb();
        }

        if(!util.isArray(__cur.judgeBuff[block.height])) {
            __cur.judgeBuff[block.height] = [];
        }

        if(__cur.judgeBuff[block.height][vote.key.toString("hex")] != null) {
            library.logger.debug("Judge " + vote.key.toString("hex") + " already select block");
            return cb();
        }

        __cur.judgeBuff[block.height][vote.key.toString("hex")] = {block: block, votes: votes};
        library.logger.debug("Judge " + vote.key.toString("hex") + " select block " + block.id + " with height " + block.height);
        result.signatures.push(vote);
        cb();
    }, function() {
        cb && cb(result);
    });
}

__cur.judgeDecision = function(height, resultCb) {
    if (!util.isArray(__cur.judgeBuff[height])) {
        return cb(false);
    }

    var versions = [];
    async.series([
        function (cb) {
            var judges = library.base.consensus.getJudges();

            for (var i = judges.length - 1; i >= 0; i--) {
                var blockId = null;
                if (__cur.judgeBuff[height][judges[i]] != null) {
                    blockId = __cur.judgeBuff[height][judges[i]].block.id;
                }

                for (var j = versions.length - 1; j >= 0; j--) {
                    if (versions[j] == blockId) {
                        continue;
                    }
                }
                if (blockId != null) {
                    versions.push(blockId);
                }
            }
            cb();
        },
        function (cb) {
            if (versions.length == 0) {
                cb();
                return resultCb("No offers for blocks", null);
            } else if (versions.length == 1) {
                cb();
                return resultCb(null, versions[0]);
            } else {
                var tmp = versions.sort(function(a, b){
                    if(a < b) return -1;
                    if(a > b) return 1;
                    return 0;
                });
                return resultCb(null, tmp[0]);
            }
        }
    ]);
}

Transport.prototype.hasUnknownJudges = function () {
  var judges = library.base.consensus.getJudges();

  if (__cur.judgesList.length < judges.length || judges.length == 0) {
    return true;
  }
  return false;
}

Transport.prototype.getMyJudges = function (cb) {
    modules.delegates.getActiveDelegateKeypairs(modules.blocks.getLastBlock().height, function (err, activeKeypairs) {
        
        if (err) {
            cb("Failed to get active keypairs: " + err);
        } else {
            var judges = library.base.consensus.getJudges();
            var result = [];
            for (var i = activeKeypairs.length - 1; i >= 0; i--) {
                
                var publicKey = activeKeypairs[i].publicKey.toString("hex");
                var j = judges.indexOf(publicKey);
                if(j != -1) {
                    result.push(judges[j]);
                }
            }
            cb(null, result);
        }
    });
}

Transport.prototype.addJudge = function (judge, cb) {
    for (var i = __cur.judgesList.length - 1; i >= 0; i--) {
        if (__cur.judgesList[i].publicKey == judge.publicKey) {
            return cb('Judge already processed: ' + judge.publicKey);
        }
    }
    var judges = library.base.consensus.getJudges();

    for (var i = judges.length - 1; i >= 0; i--) {
        if (judges[i] == judge.publicKey) {
            __cur.judgesList.push(judge);
            library.bus.message("judge", judge, true);
            return cb();
        }
    }
    
    return cb('Judge is not valid: ' + judge.publicKey);
}

Transport.prototype.broadcast = function (config, options, cb, itemCb) {

    config.limit = 30;
    modules.peer.list(config, function (err, peers) {        
        if (!err) {
            async.eachLimit(peers, 5, function (peer, cb) {
                self.getFromPeer(peer, options, itemCb);

                setImmediate(cb);
            }, function () {
                cb && cb(null, {body: null, peer: peers});
            })
        } else {
            cb && setImmediate(cb, err);
        }
    });
};

Transport.prototype.broadcastJudges = function(options, cb, itemCb) {
   var cache = [];
   if (__cur.judgesList == null) return;

   async.eachLimit(__cur.judgesList, 5, function (judge, cb) {
        if(cache[judge.address]) {
            itemCb && itemCb(null, null, judge);
            return setImmediate(cb);
        }

        cache[judge.address] = true;
        self.getFromPeer({address: judge.address}, options, function(err, data) {
            itemCb && itemCb(err, data, judge);
        });

        setImmediate(cb);
    }, function () {
        cb && cb(null, {body: null});
    })
}

Transport.prototype.getFromRandomPeer = function (config, options, cb) {
    if (typeof options == 'function') {
        cb = options;
        options = config;
        config = {};
    }
    config.limit = 1;
    modules.peer.list(config, function (err, peers) {
        if (!err && peers.length) {
            var peer = peers[0];
            self.getFromPeer(peer, options, cb);
        } else {
            modules.peer.reset();
            return cb(err || "No peers in db");
        }
    });
    // async.retry(20, function (cb) {

    // }, function (err, results) {
    //   cb(err, results)
    // });
};

/**
 * Send request to selected peer
 * @param {object} peer Peer object
 * @param {object} options Request lib params with special value `api` which should be string name of peer's module
 * web method
 * @param {function} cb Result Callback
 * @returns {*|exports} Request lib request instance
 * @private
 * @example
 *
 * // Send gzipped request to peer's web method /peer/blocks.
 * .getFromPeer(peer, { api: '/blocks', gzip: true }, function (err, data) {
 *  // Process request
 * });
 */
Transport.prototype.getFromPeer = function (peer, options, cb) {
    var url;
    if (options.api) {
        url = '/peer' + options.api
    } else {
        url = options.url;
    }
    if (peer.address) {
        url = 'http://' + peer.address + url;

    } else {
        url = 'http://' + ip.fromLong(peer.ip) + ':' + peer.port + url;
    }
    var req = {
        url: url,
        method: options.method,
        json: true,
        headers: extend({}, __cur.headers, options.headers),
        timeout: library.config.peers.options.timeout,
        forever: true
    };
    if (Object.prototype.toString.call(options.data) === "[object Object]" || util.isArray(options.data)) {
        req.json = options.data;
    } else {
        req.body = options.data;
    }

    return request(req, function (err, response, body) {
        if (err || response.statusCode != 200) {
            library.logger.debug('Request', {
                url: req.url,
                statusCode: response ? response.statusCode : 'unknown',
                err: err,
                content: body
            });

            if (peer) {
                // TODO use ban instead of remove
                if (err && (err.code == "ETIMEDOUT" || err.code == "ESOCKETTIMEDOUT" || err.code == "ECONNREFUSED")) {
                    modules.peer.remove(peer.ip, peer.port, function (err) {
                        if (!err) {
                            library.logger.info('Removing peer ' + req.method + ' ' + req.url)
                        }
                    });
                } else {
                    if (!options.not_ban) {
                        if (response == null || response.statusCode == null || response.statusCode != 429) {
                            modules.peer.state(peer.ip, peer.port, 0, 600, function (err) {
                                if (!err) {
                                    library.logger.info('Ban 10 min ' + req.method + ' ' + req.url);
                                }
                            });    
                        }
                    }
                }
            }
            cb && cb(err || ('request status code' + response.statusCode), {body: body, peer: peer});
            return;
        } else {
            library.logger.debug(req.method + " " + req.url);
        }

        response.headers['port'] = parseInt(response.headers['port']);

        var report = library.scheme.validate(response.headers, {
            type: "object",
            properties: {
                os: {
                    type: "string",
                    maxLength: 64
                },
                port: {
                    type: "integer",
                    minimum: 1,
                    maximum: 65535
                },
                'magic': {
                    type: "string",
                    maxLength: 8
                },
                version: {
                    type: "string",
                    maxLength: 11
                }
            },
            required: ['port', 'magic', 'version']
        });

        if (!report) {
            return cb && cb(null, {body: body, peer: peer});
        }

        var port = response.headers['port'];
        var version = response.headers['version'];
        if (port > 0 && port <= 65535 && version == library.config.version) {
            modules.peer.update({
                ip: peer.ip,
                port: port,
                state: 2,
                os: response.headers['os'],
                version: version
            });
        } else if (!modules.peer.isCompatible(version)) {
            library.logger.debug("Remove uncompatible peer " + peer.ip, version);
            modules.peer.remove(peer.ip, port);
        }

        cb && cb(null, {body: body, peer: peer});
    });
}

Transport.prototype.sandboxApi = function (call, args, cb) {
    sandboxHelper.callMethod(shared, call, args, cb);
};

// Events
Transport.prototype.onBind = function (scope) {
    modules = scope;

    __cur.headers = {
        os: modules.system.getOS(),
        version: modules.system.getVersion(),
        port: modules.system.getPort(),
        magic: modules.system.getMagic()
    }
};

Transport.prototype.onBlockchainReady = function () {
    __cur.loaded = true;

    if (self.hasUnknownJudges()) {
        library.bus.message("searchJudges");
    } 
};

Transport.prototype.onSignature = function (signature, broadcast) {
    if (broadcast) {
        self.broadcast({}, {api: '/signatures', data: {signature: signature}, method: "POST"});
        library.network.io.sockets.emit('signature/change', {});
    }
};

Transport.prototype.onJudge = function (judge, broadcast) {

    if (broadcast) {
        self.broadcast({}, {api: '/judge', data: {judge: judge}, method: "POST"});
    }
}

Transport.prototype.onClearJudges = function() {
    __cur.judgesList = [];
}

Transport.prototype.onUnconfirmedTransaction = function (transaction, broadcast) {    
    function sendTransactions() {
        self.broadcast({}, {api: '/transactions', data: __cur.unconfirmedBuff, method: "POST"});
        __cur.unconfirmedBuff = [];
        __cur.unconfirmedTimer = null;
    }

    if (broadcast) {
        var data = {
            transaction: library.protobuf.encodeTransaction(transaction).toString('base64')
        };

        if (__cur.unconfirmedTimer != null) {
            clearTimeout(__cur.unconfirmedTimer);
            __cur.unconfirmedTimer = null;
        }

        __cur.unconfirmedBuff.push(data);
        
        if (__cur.unconfirmedBuff.length > 200) {
            sendTransactions();
        } else {
             __cur.unconfirmedTimer = setTimeout(sendTransactions, 800);
        }
        library.network.io.sockets.emit('transactions/change', {});
    }
};

Transport.prototype.onSearchJudges = function () {
    self.broadcast({}, {api: '/judge', data: {}, method: "GET"}, null, function (err, data) {
        if (err != null) {
            return library.logger.log(err);
        }
        for (var i = data.body.length - 1; i >= 0; i--) {
            
            if (library.base.consensus.isValidJudge(data.body[i])) {
                self.addJudge(data.body[i], function(err) {
                    if (err) {
                        library.logger.debug("Received invalid judge: " + err);
                    } else {
                        library.logger.debug("Judge accepted: " + data.body[i].publicKey);
                    }
                });
            } else {
                library.logger.warn("Invalid judge " + data.body[i].publicKey);
            }
        }
    });
}

Transport.prototype.onNewBlock = function (block, votes, broadcast) {
    __cur.judgesSucc = 0;
    __cur.judgesErr = 0;
    __cur.judgeBuff = [];
    __cur.judgeCache = [];

    if (broadcast) {
        var data = {
            block: library.protobuf.encodeBlock(block).toString('base64'),
            votes: library.protobuf.encodeBlockVotes(votes).toString('base64')
        };
        self.broadcast({}, {api: '/blocks', data: data, method: "POST"});
        library.network.io.sockets.emit('blocks/change', {});
    }
};

Transport.prototype.onNewPropose = function (propose, broadcast) {
    library.logger.log("judgeSlot: " + library.base.consensus.calcJudgeSlot());
    if (__cur.judgeSlot == null) {
        __cur.judgeSlot = library.base.consensus.calcJudgeSlot();
    }

    if(__cur.judgeSlot != library.base.consensus.calcJudgeSlot()) {
        library.logger.log("Calcing new judges: ");
        modules.round.calcJudges(modules.blocks.getLastBlock().height, function(err, judges) {
            library.logger.log("Judges: " + judges);
            __cur.judgeSlot = library.base.consensus.calcJudgeSlot();
        });
    }

    if (broadcast) {
        var data = {
            propose: library.protobuf.encodeBlockPropose(propose).toString('base64')
        };
        self.broadcast({}, {api: '/propose', data: data, method: "POST"});
    }
};

Transport.prototype.onDappReady = function (dappId, broadcast) {
    if (broadcast) {
        var data = {
            dappId: dappId
        };
        self.broadcast({}, {api: '/dappReady', data: data, method: "POST"})
    }
};

Transport.prototype.sendVotes = function (votes, address) {
    self.getFromPeer({address: address}, {
        api: '/votes',
        data: votes,
        method: "POST"
    });
};

Transport.prototype.onMessage = function (msg, broadcast) {
    if (broadcast) {
        self.broadcast({dappId: msg.dappId}, {api: '/dapp/message', data: msg, method: "POST"});
    }
};

Transport.prototype.cleanup = function (cb) {
    __cur.loaded = false;
    cb();
};

// Shared
shared.message = function (msg, cb) {
    msg.timestamp = (new Date()).getTime();
    msg.hash = __cur.hashsum(msg.body, msg.timestamp);

    self.broadcast({dappId: msg.dappId}, {api: '/dapp/message', data: msg, method: "POST"});

    cb(null, {});
};

shared.request = function (msg, cb) {
    msg.timestamp = (new Date()).getTime();
    msg.hash = __cur.hashsum(msg.body, msg.timestamp);

    if (msg.body.peer) {
        self.getFromPeer(msg.body.peer, {
            api: '/dapp/request',
            data: msg,
            method: "POST"
        }, cb);
    } else {
        self.getFromRandomPeer({dappId: msg.dappId}, {api: '/dapp/request', data: msg, method: "POST"}, cb);
    }
};

// Export
module.exports = Transport;

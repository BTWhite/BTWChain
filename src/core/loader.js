const async = require('async');
const ip = require("ip");
const bignum = require('bignumber');
const Router = require('../utils/router.js');
const sandboxHelper = require('../utils/sandbox.js');
const slots = require('../utils/slots.js');

require('colors');

// Private fields
var modules, library, self, __cur = {}, shared = {};

__cur.loaded = false;
__cur.isActive = false;
__cur.loadingLastBlock = null;
__cur.genesisBlock = null;
__cur.total = 0;
__cur.blocksToSync = 0;
__cur.syncIntervalId = null;

// Constructor
function Loader(cb, scope) {
    library = scope;
    __cur.genesisBlock = __cur.loadingLastBlock = library.genesisblock;
    self = this;
    self.__private = __cur;
    __cur.attachApi();

    setImmediate(cb, null, self);
}

// Private methods
__cur.attachApi = function () {
    var router = new Router();

    router.map(shared, {
        "get /status": "status",
        "get /status/sync": "sync"
    });

    library.network.app.use('/api/loader', router);
    library.network.app.use(function (err, req, res, next) {
        if (!err) return next();
        library.logger.error(req.url, err.toString());
        res.status(500).send({success: false, error: err.toString()});
    });
};

__cur.syncTrigger = function (turnOn) {
    if (turnOn === false && __cur.syncIntervalId) {
        clearTimeout(__cur.syncIntervalId);
        __cur.syncIntervalId = null;
    }
    if (turnOn === true && !__cur.syncIntervalId) {
        setImmediate(function nextSyncTrigger() {
            library.network.io.sockets.emit('loader/sync', {
                blocks: __cur.blocksToSync,
                height: modules.blocks.getLastBlock().height
            });
            __cur.syncIntervalId = setTimeout(nextSyncTrigger, 1000);
        });
    }
};

__cur.loadFullDb = function (peer, cb) {
    var peerStr = peer ? ip.fromLong(peer.ip) + ":" + peer.port : 'unknown';
    var commonBlockId = __cur.genesisBlock.block.id;
    library.logger.debug("Loading blocks from genesis from " + peerStr);
    modules.blocks.loadBlocksFromPeer(peer, commonBlockId, cb);
};

__cur.findUpdate = function (lastBlock, peer, cb) {
    var peerStr = peer ? ip.fromLong(peer.ip) + ":" + peer.port : 'unknown';
    library.logger.info("Looking for common block with " + peerStr);
    modules.blocks.getCommonBlock(peer, lastBlock.height, function (err, commonBlock) {
        if (err || !commonBlock) {
            library.logger.error("Failed to get common block", err);
            return cb();
        }

        library.logger.info("Found common block " + commonBlock.id + " (at " + commonBlock.height + ")" + " with peer " + peerStr + ", last block height is " + lastBlock.height);
        var toRemove = lastBlock.height - commonBlock.height;

        if (toRemove >= 5) {
            library.logger.error("long fork, ban 60 min", peerStr);
            modules.peer.state(peer.ip, peer.port, 0, 3600);
            return cb();
        }

        var unconfirmedTrs = modules.transactions.getUnconfirmedTransactionList(true);
        library.logger.info('Undo unconfirmed transactions', unconfirmedTrs)
        modules.transactions.undoUnconfirmedList(function (err) {
            if (err) {
                library.logger.error('Failed to undo uncomfirmed transactions', err);
                return process.exit(0);
            }

            function rollbackBlocks(cb) {
                if (commonBlock.id == lastBlock.id) {
                    return cb();
                }

                async.series([
                    function (next) {
                        var currentRound = modules.round.calc(lastBlock.height);
                        var backRound = modules.round.calc(commonBlock.height);
                        var backHeight = commonBlock.height;
                        if (currentRound != backRound || lastBlock.height % 101 === 0) {
                            if (backRound == 1) {
                                backHeight = 1;
                            } else {
                                backHeight = backHeight - backHeight % 101;
                            }
                            modules.blocks.getBlock({height: backHeight}, function (err, result) {
                                if (result && result.block) {
                                    commonBlock = result.block;
                                }
                                next(err);
                            })
                        } else {
                            next();
                        }
                    },
                    function (next) {
                        library.logger.info('start to roll back blocks before ' + commonBlock.height);
                        next();
                        //modules.round.directionSwap('backward', lastBlock, next);
                    },
                    function (next) {
			next();
                        library.bus.message('deleteBlocksBefore', commonBlock);
                        //modules.blocks.deleteBlocksBefore(commonBlock, next);
                    },
                    function (next) {
			next();
                        //modules.round.directionSwap('forward', lastBlock, next);
                    }
                ], function (err) {
                    if (err) {
                        library.logger.error("Failed to rollback blocks before " + commonBlock.height, err);
                        process.exit(1);
                        return;
                    }
                    cb();
                });
            }

            async.series([
                async.apply(rollbackBlocks),
                function (next) {
                    library.logger.debug("Loading blocks from peer " + peerStr);

                    modules.blocks.loadBlocksFromPeer(peer, commonBlock.id, function (err, lastValidBlock) {
                        if (err) {
                            library.logger.error("Failed to load blocks, ban 60 min: " + peerStr, err);
                            modules.peer.state(peer.ip, peer.port, 0, 3600);
                        }
                        next();
                    });
                },
                function (next) {
                    modules.transactions.receiveTransactions(unconfirmedTrs, function (err) {
                        if (err) {
                            library.logger.error('Failed to redo unconfirmed transactions', err);
                        }
                        next();
                    });
                }
            ], cb)
        });
    });
};

__cur.loadBlocks = function (lastBlock, cb) {
    modules.transport.getFromRandomPeer({
        api: '/height',
        method: 'GET'
    }, function (err, data) {
        var peerStr = data && data.peer ? ip.fromLong(data.peer.ip) + ":" + data.peer.port : 'unknown';
        if (err || !data.body) {
            library.logger.log("Failed to get height from peer: " + peerStr);
            return cb();
        }

        library.logger.info("Check blockchain on " + peerStr);
        data.body.height = parseInt(data.body.height);

        var report = library.scheme.validate(data.body, {
            type: "object",
            properties: {
                "height": {
                    type: "integer",
                    minimum: 0
                }
            }, required: ['height']
        });

        if (!report) {
            library.logger.log("Failed to parse blockchain height: " + peerStr + "\n" + library.scheme.getLastError());
            return cb();
        }

        if (bignum(modules.blocks.getLastBlock().height).lt(data.body.height)) { // Diff in chainbases
            __cur.blocksToSync = data.body.height;

            if (lastBlock.id != __cur.genesisBlock.block.id) { // Have to find common block
                __cur.findUpdate(lastBlock, data.peer, cb);
            } else { // Have to load full db
                __cur.loadFullDb(data.peer, cb);
            }
        } else {
            cb();
        }
    });
};

__cur.loadSignatures = function (cb) {
    modules.transport.getFromRandomPeer({
        api: '/signatures',
        method: 'GET',
        not_ban: true
    }, function (err, data) {
        if (err) {
            return cb();
        }
        library.scheme.validate(data.body, {
            type: "object",
            properties: {
                signatures: {
                    type: "array",
                    uniqueItems: true
                }
            },
            required: ['signatures']
        }, function (err) {
            if (err) {
                return cb();
            }
            library.sequence.add(function loadSignatures(cb) {
                async.eachSeries(data.body.signatures, function (signature, cb) {
                    async.eachSeries(signature.signatures, function (s, cb) {
                        modules.multisignatures.processSignature({
                            signature: s,
                            transaction: signature.transaction
                        }, function (err) {
                            setImmediate(cb);
                        });
                    }, cb);
                }, cb);
            }, cb);
        });
    });
};

__cur.loadUnconfirmedTransactions = function (cb) {
    modules.transport.getFromRandomPeer({
        api: '/transactions',
        method: 'GET'
    }, function (err, data) {
        if (err) {
            return cb()
        }
        var report = library.scheme.validate(data.body, {
            type: "object",
            properties: {
                transactions: {
                    type: "array",
                    uniqueItems: true
                }
            },
            required: ['transactions']
        });

        if (!report) {
            return cb();
        }

        var transactions = data.body.transactions;
        for (var i = 0; i < transactions.length; i++) {
            try {
                transactions[i] = library.base.transaction.objectNormalize(transactions[i]);
            } catch (e) {
                var peerStr = data.peer ? ip.fromLong(data.peer.ip) + ":" + data.peer.port : 'unknown';
                library.logger.log('Transaction ' + (transactions[i] ? transactions[i].id : 'null') + ' is not valid, ban 60 min', peerStr);
                modules.peer.state(data.peer.ip, data.peer.port, 0, 3600);
                return setImmediate(cb);
            }
        }

        var trs = [];
        for (var i = 0; i < transactions.length; ++i) {
            if (!modules.transactions.hasUnconfirmedTransaction(transactions[i])) {
                trs.push(transactions[i]);
            }
        }
        library.balancesSequence.add(function (cb) {
            modules.transactions.receiveTransactions(trs, cb);
        }, cb);
    });
};

__cur.loadBalances = function (cb) {
    library.model.getAllNativeBalances(function (err, results) {
        if (err) return cb('Failed to load native balances: ' + err);
        for (let i = 0; i < results.length; ++i) {
            let {address, balance} = results[i];
            library.balanceCache.setNativeBalance(address, balance)
        }
        library.balanceCache.commit();
        cb(null)
    })
};

__cur.loadBlockChain = function (cb) {
    var offset = 0, limit = Number(library.config.loading.loadPerIteration) || 1000;
    var verify = library.config.loading.verifyOnLoading;

    function load(count) {
        verify = true;
        __cur.total = count;

        library.base.account.removeTables(function (err) {
            if (err) {
                throw err;
            } else {
                library.base.account.createTables(function (err) {
                    if (err) {
                        throw err;
                    } else {
                        async.until(
                            function () {
                                return count < offset
                            }, function (cb) {
                                if (count > 1) {
                                    library.logger.info("Rebuilding blockchain, current block height:" + offset);
                                }
                                setImmediate(function () {
                                    modules.blocks.loadBlocksOffset(limit, offset, verify, function (err, lastBlockOffset) {
                                        if (err) {
                                            return cb(err);
                                        }

                                        offset = offset + limit;
                                        __cur.loadingLastBlock = lastBlockOffset;

                                        cb();
                                    });
                                })
                            }, function (err) {
                                if (err) {
                                    library.logger.error('loadBlocksOffset', err);
                                    if (err.block) {
                                        library.logger.error('Blockchain failed at ', err.block.height)
                                        modules.blocks.simpleDeleteAfterBlock(err.block.id, function (err, res) {
                                            if (err) return cb(err)
                                            library.logger.error('Blockchain clipped');
                                            __cur.loadBalances(cb);
                                        })
                                    } else {
                                        cb(err);
                                    }
                                } else {
                                    library.logger.info('Blockchain ready');
                                    __cur.loadBalances(cb);
                                }
                            }
                        )
                    }
                });
            }
        });
    }

    library.base.account.createTables(function (err) {
        if (err) {
            throw err;
        } else {
            library.dbLite.query("select count(*) from mem_accounts where blockId = (select id from blocks where numberOfTransactions > 0 order by height desc limit 1)", {'count': Number}, function (err, rows) {
                if (err) {
                    throw err;
                }

                var reject = !(rows[0].count);

                modules.blocks.count(function (err, count) {
                    if (err) {
                        return library.logger.error('Failed to count blocks', err)
                    }

                    library.logger.info('Blocks ' + count);

                    // Check if previous loading missed
                    // if (reject || verify || count == 1) {
                    if (verify || count == 1) {
                        load(count);
                    } else {
                        library.dbLite.query(
                            "UPDATE mem_accounts SET u_isDelegate=isDelegate,u_secondSignature=secondSignature,u_username=username,u_balance=balance,u_delegates=delegates,u_multisignatures=multisignatures"
                            , function (err, updated) {
                                if (err) {
                                    library.logger.error(err);
                                    library.logger.info("Failed to verify db integrity 1");
                                    load(count);
                                } else {
                                    library.dbLite.query("select a.blockId, b.id from mem_accounts a left outer join blocks b on b.id = a.blockId where b.id is null", {}, ['a_blockId', 'b_id'], function (err, rows) {
                                        if (err || rows.length > 0) {
                                            library.logger.error(err || "Encountered missing block, looks like node went down during block processing");
                                            library.logger.info("Failed to verify db integrity 2");
                                            load(count);
                                        } else {
                                            // Load delegates
                                            library.dbLite.query("SELECT lower(hex(publicKey)) FROM mem_accounts WHERE isDelegate=1", ['publicKey'], function (err, delegates) {
                                                if (err || delegates.length == 0) {
                                                    library.logger.error(err || "No delegates, reload database");
                                                    library.logger.info("Failed to verify db integrity 3");
                                                    load(count);
                                                } else {
                                                    modules.blocks.loadBlocksOffset(1, count, verify, function (err, lastBlock) {
                                                        if (err) {
                                                            library.logger.error(err || "Unable to load last block");
                                                            library.logger.info("Failed to verify db integrity 4");
                                                            load(count);
                                                        } else {
                                                            library.logger.info('Blockchain ready');
                                                            __cur.loadBalances(cb);
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                    }

                });
            });
        }
    });
};

// Public methods
Loader.prototype.syncing = function () {
    return !!__cur.syncIntervalId;
};

Loader.prototype.sandboxApi = function (call, args, cb) {
    sandboxHelper.callMethod(shared, call, args, cb);
};

Loader.prototype.startSyncBlocks = function () {
    library.logger.debug('startSyncBlocks enter');
    if (__cur.isActive || !__cur.loaded || self.syncing()) return;
    __cur.isActive = true;

    if (modules.transport.hasUnknownJudges()) {
        library.logger.debug("Judges not ready");
        library.bus.message("searchJudges");
    } else {
        library.logger.debug("Judges ready");
    }

    library.sequence.add(function syncBlocks(cb) {
        library.logger.debug('startSyncBlocks enter sequence');
        __cur.syncTrigger(true);
        var lastBlock = modules.blocks.getLastBlock();
        __cur.loadBlocks(lastBlock, cb);
    }, function (err) {
        err && library.logger.error('loadBlocks timer:', err);
        __cur.syncTrigger(false);
        __cur.blocksToSync = 0;

        __cur.isActive = false;
        library.logger.debug('startSyncBlocks end');
    });
};

// Events
Loader.prototype.onPeerReady = function () {
    setImmediate(function nextSync() {
        var lastBlock = modules.blocks.getLastBlock();
        var lastSlot = slots.getSlotNumber(lastBlock.timestamp);
        if (slots.getNextSlot() - lastSlot >= 3) {
            self.startSyncBlocks();
        }
        setTimeout(nextSync, 10 * 1000);
    });

    setImmediate(function nextLoadUnconfirmedTransactions() {
        if (!__cur.loaded || self.syncing()) return;
        __cur.loadUnconfirmedTransactions(function (err) {
            err && library.logger.error('loadUnconfirmedTransactions timer:', err);
            setTimeout(nextLoadUnconfirmedTransactions, 14 * 1000)
        });

    });

    setImmediate(function nextLoadSignatures() {
        if (!__cur.loaded) return;
        __cur.loadSignatures(function (err) {
            err && library.logger.error('loadSignatures timer:', err);

            setTimeout(nextLoadSignatures, 14 * 1000)
        });
    });
};

Loader.prototype.onBind = function (scope) {
    modules = scope;
    __cur.loadBlockChain(function (err) {
        if (err) {
            library.logger.error('Failed to load blockchain', err);
            return process.exit(1)
        }
        library.bus.message('blockchainReady');
    });
};

Loader.prototype.onBlockchainReady = function () {
    __cur.loaded = true;
};

Loader.prototype.cleanup = function (cb) {
    __cur.loaded = false;
    cb();
    // if (!__cur.isActive) {
    //   cb();
    // } else {
    //   setImmediate(function nextWatch() {
    //     if (__cur.isActive) {
    //       setTimeout(nextWatch, 1 * 1000)
    //     } else {
    //       cb();
    //     }
    //   });
    // }
};

// Shared
shared.status = function (req, cb) {
    cb(null, {
        loaded: __cur.loaded,
        now: __cur.loadingLastBlock.height,
        blocksCount: __cur.total
    });
};

shared.sync = function (req, cb) {
    cb(null, {
        syncing: self.syncing(),
        blocks: __cur.blocksToSync,
        height: modules.blocks.getLastBlock().height
    });
};

// Export
module.exports = Loader;

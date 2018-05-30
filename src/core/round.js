const async = require('async');
const slots = require('../utils/slots.js');
const amount = require('../utils/amount.js');
const sandboxHelper = require('../utils/sandbox.js');
const constants = require('../utils/constants.js');

// Private fields
var modules, library, self, __cur = {}, shared = {};

__cur.loaded = false;

__cur.feesByRound = {};
__cur.rewardsByRound = {};
__cur.delegatesByRound = {};
__cur.unFeesByRound = {};
__cur.unRewardsByRound = {};
__cur.unDelegatesByRound = {};

const CLUB_BONUS_RATIO = 0.2;

// Constructor
function Round(cb, scope) {
    library = scope;
    self = this;
    self.__private = __cur;
    setImmediate(cb, null, self);
}

// Round changes
function RoundChanges(round, back) {
    var roundFees, roundRewards;
    if (!back) {
        roundFees = parseInt(__cur.feesByRound[round]) || 0;
        roundRewards = (__cur.rewardsByRound[round] || []);
    } else {
        roundFees = parseInt(__cur.unFeesByRound[round]) || 0;
        roundRewards = (__cur.unRewardsByRound[round] || []);
    }

    this.at = function (index) {
        var ratio = global.featureSwitch.enableClubBonus ? (1 - CLUB_BONUS_RATIO) : 1;
        var totalDistributeFees = Math.floor(roundFees * ratio);
        var fees = Math.floor(totalDistributeFees / slots.delegates);
        var feesRemaining = totalDistributeFees - (fees * slots.delegates);
        var rewards = Math.floor(parseInt(roundRewards[index]) * ratio) || 0;

        return {
            fees: fees,
            feesRemaining: feesRemaining,
            rewards: rewards,
            balance: fees + rewards
        };
    };

    this.getClubBonus = function () {
        var fees = roundFees - Math.floor(roundFees * (1 - CLUB_BONUS_RATIO))
        var rewards = 0;
        for (let i = 0; i < roundRewards.length; ++i) {
            let reward = parseInt(roundRewards[i])
            rewards += (reward - Math.floor(reward * (1 - CLUB_BONUS_RATIO)))
        }
        return fees + rewards
    }
}

Round.prototype.loaded = function () {
    return __cur.loaded;
};

// Public methods
Round.prototype.calc = function (height) {
    return Math.floor(height / slots.delegates) + (height % slots.delegates > 0 ? 1 : 0);
};

Round.prototype.getVotes = function (round, cb) {
    library.dbLite.query("select delegate, amount from ( " +
        "select m.delegate, sum(m.amount) amount, m.round from mem_round m " +
        "group by m.delegate, m.round " +
        ") where round = $round", {round: round}, {delegate: String, amount: Number}, function (err, rows) {
        cb(err, rows)
    });
};

Round.prototype.flush = function (round, cb) {
    library.dbLite.query("delete from mem_round where round = $round", {round: round}, cb);
};

Round.prototype.directionSwap = function (direction, lastBlock, cb) {
    cb()
    // if (direction == 'backward') {
    //   __cur.feesByRound = {};
    //   __cur.rewardsByRound = {};
    //   __cur.delegatesByRound = {};
    //   self.flush(self.calc(lastBlock.height), cb);
    // } else {
    //   __cur.unFeesByRound = {};
    //   __cur.unRewardsByRound = {};
    //   __cur.unDelegatesByRound = {};
    //   self.flush(self.calc(lastBlock.height), cb);
    // }
};

Round.prototype.backwardTick = function (block, previousBlock, cb) {
    function done(err) {
        if (err) {
            library.logger.error("Round backward tick failed: " + err);
        } else {
            library.logger.debug("Round backward tick completed", {
                block: block,
                previousBlock: previousBlock
            });
        }
        cb && cb(err);
    }

    modules.accounts.mergeAccountAndGet({
        publicKey: block.generatorPublicKey,
        producedblocks: -1,
        blockId: block.id,
        round: modules.round.calc(block.height)
    }, function (err) {
        if (err) {
            return done(err);
        }

        var round = self.calc(block.height);

        var prevRound = self.calc(previousBlock.height);

        // __cur.unFeesByRound[round] = (__cur.unFeesByRound[round] || 0);
        // __cur.unFeesByRound[round] += block.totalFee;

        // __cur.unRewardsByRound[round] = (__cur.unRewardsByRound[round] || []);
        // __cur.unRewardsByRound[round].push(block.reward);

        // __cur.unDelegatesByRound[round] = __cur.unDelegatesByRound[round] || [];
        // __cur.unDelegatesByRound[round].push(block.generatorPublicKey);

        __cur.feesByRound[round] = (__cur.feesByRound[round] || 0);
        __cur.feesByRound[round] -= block.totalFee;

        __cur.rewardsByRound[round] = (__cur.rewardsByRound[round] || []);
        __cur.rewardsByRound[round].pop()

        __cur.delegatesByRound[round] = __cur.delegatesByRound[round] || [];
        __cur.delegatesByRound[round].pop()

        if (prevRound === round && previousBlock.height !== 1) {
            return done();
        }

        if (__cur.unDelegatesByRound[round].length !== slots.delegates && previousBlock.height !== 1) {
            return done();
        }
        library.logger.warn('Unexpected roll back cross round', {
            round: round,
            prevRound: prevRound,
            block: block,
            previousBlock: previousBlock
        });
        process.exit(1);
        // FIXME process the cross round rollback
        var outsiders = [];
        async.series([
            function (cb) {
                if (block.height === 1) {
                    return cb();
                }
                modules.delegates.generateDelegateList(block.height, function (err, roundDelegates) {
                    if (err) {
                        return cb(err);
                    }
                    for (var i = 0; i < roundDelegates.length; i++) {
                        if (__cur.unDelegatesByRound[round].indexOf(roundDelegates[i]) == -1) {
                            if (global.featureSwitch.fixVoteNewAddressIssue) {
                                outsiders.push(modules.accounts.generateAddressByPublicKey2(roundDelegates[i]));
                            } else {
                                outsiders.push(modules.accounts.generateAddressByPublicKey(roundDelegates[i]));
                            }
                        }
                    }
                    cb();
                });
            },
            function (cb) {
                if (!outsiders.length) {
                    return cb();
                }
                var escaped = outsiders.map(function (item) {
                    return "'" + item + "'";
                });

                library.dbLite.query('update mem_accounts set missedblocks = missedblocks - 1 where address in (' + escaped.join(',') + ')', function (err, data) {
                    cb(err);
                });
            },
            // function (cb) {
            //   self.getVotes(round, function (err, votes) {
            //     if (err) {
            //       return cb(err);
            //     }
            //     async.eachSeries(votes, function (vote, cb) {
            //       library.dbLite.query('update mem_accounts set vote = vote + $amount where address = $address', {
            //         address: modules.accounts.generateAddressByPublicKey(vote.delegate),
            //         amount: vote.amount
            //       }, cb);
            //     }, function (err) {
            //       self.flush(round, function (err2) {
            //         cb(err || err2);
            //       });
            //     })
            //   });
            // },
            function (cb) {
                var roundChanges = new RoundChanges(round, true);

                async.forEachOfSeries(__cur.unDelegatesByRound[round], function (delegate, index, next) {
                    var changes = roundChanges.at(index);
                    var changeBalance = changes.balance;
                    var changeFees = changes.fees;
                    var changeRewards = changes.rewards;

                    if (index === 0) {
                        changeBalance += changes.feesRemaining;
                        changeFees += changes.feesRemaining;
                    }

                    

                    

                    modules.accounts.mergeAccountAndGet({
                        publicKey: delegate,
                        balance: -changeBalance,
                        u_balance: -changeBalance,
                        blockId: block.id,
                        round: modules.round.calc(block.height),
                        fees: -changeFees,
                        rewards: -changeRewards
                    }, next);

                    

                }, cb);
            },
            function (cb) {
                // distribute club bonus
                if (!global.featureSwitch.enableClubBonus) {
                    return cb()
                }
                var bonus = '-' + new RoundChanges(round).getClubBonus()
                var dappId = global.state.clubInfo.transactionId
                const BONUS_CURRENCY = 'XAS'
                library.logger.info('Btw witness club get new bonus: ' + bonus)
                library.balanceCache.addAssetBalance(dappId, BONUS_CURRENCY, bonus)
                library.model.updateAssetBalance(BONUS_CURRENCY, bonus, dappId, cb)
            },
            function (cb) {
                self.getVotes(round, function (err, votes) {
                    if (err) {
                        return cb(err);
                    }
                    async.eachSeries(votes, function (vote, cb) {
                        var address = null
                        if (global.featureSwitch.fixVoteNewAddressIssue) {
                            address = modules.accounts.generateAddressByPublicKey2(vote.delegate)
                        } else {
                            address = modules.accounts.generateAddressByPublicKey(vote.delegate)
                        }
                        library.dbLite.query('update mem_accounts set vote = vote + $amount where address = $address', {
                            address: address,
                            amount: vote.amount
                        }, cb);
                    }, function (err) {
                        self.flush(round, function (err2) {
                            cb(err || err2);
                        });
                    })
                });
            }
        ], function (err) {
            delete __cur.unFeesByRound[round];
            delete __cur.unRewardsByRound[round];
            delete __cur.unDelegatesByRound[round];
            done(err)
        });
    });
};

Round.prototype.tick = function (block, cb) {
    function done(err) {
        if (err) {
            library.logger.error("Round tick failed: " + err);
        } else {
            library.logger.debug("Round tick completed", {
                block: block
            });
        }
        cb && setImmediate(cb, err);
    }
    modules.accounts.mergeAccountAndGet({
        publicKey: block.generatorPublicKey,
        producedblocks: 1,
        blockId: block.id,
        round: modules.round.calc(block.height)
    }, function (err) {
        if (err) {
	       return done(err);
        }
        var round = self.calc(block.height);

        __cur.feesByRound[round] = (__cur.feesByRound[round] || 0);
        __cur.feesByRound[round] += block.totalFee;

        __cur.rewardsByRound[round] = (__cur.rewardsByRound[round] || []);
        __cur.rewardsByRound[round].push(block.reward);

        __cur.delegatesByRound[round] = __cur.delegatesByRound[round] || [];
        __cur.delegatesByRound[round].push(block.generatorPublicKey);

        var nextRound = self.calc(block.height + 1);
        var insiders = [];

        

        if (round === nextRound && block.height !== 1) {
            return done();
        }

        if (__cur.delegatesByRound[round].length !== slots.delegates && block.height !== 1 && block.height !== 101) {
            return done();
        }

        var outsiders = [];
        var daoBalance = 0;
        var daoFees = 0;
        var daoRewards = 0;
        async.series([
            function (cb) {
                if (block.height === 1) {
                    return cb();
                }
                modules.delegates.generateDelegateList(block.height, function (err, roundDelegates) {
                    if (err) {
                        return cb(err);
                    }
                    for (var i = 0; i < roundDelegates.length; i++) {
                        if (__cur.delegatesByRound[round].indexOf(roundDelegates[i]) == -1) {
                            if (global.featureSwitch.fixVoteNewAddressIssue) {
                                outsiders.push(modules.accounts.generateAddressByPublicKey2(roundDelegates[i]));
                            } else {
                                outsiders.push(modules.accounts.generateAddressByPublicKey(roundDelegates[i]));
                            }
                        }
                    }
                    return cb();
                });
            },
            function (cb) {
                if (!outsiders.length) {
                    return cb();
                }
                var escaped = outsiders.map(function (item) {
                    return "'" + item + "'";
                });

                library.dbLite.query('update mem_accounts set missedblocks = missedblocks + 1 where address in (' + escaped.join(',') + ')', function (err, data) {
                    cb(err);
                });                
            },
            function (cb) {
                // TODO, is mainnet
                if (!outsiders.length) {
                    return cb();
                }
                var escaped = outsiders.map(function (item) {
                    return "'" + item + "'";
                });

                library.dbLite.query('update mem_accounts set fallrate = fallrate + 1, vote = vote - '+ constants.fallrateAmount +' where vote >= '+ constants.fallrateAmount +' and address in (' + escaped.join(',') + ')', function (err, data) {
                    cb(err);
                });
            },
            function (cb) {
                var escaped = __cur.delegatesByRound[round].map(function (item) {
                    if (global.featureSwitch.fixVoteNewAddressIssue) {
                        return "'" + modules.accounts.generateAddressByPublicKey2(item) + "'";
                    } else {
                        return "'" + modules.accounts.generateAddressByPublicKey(item) + "'";
                    }
                });
                
                library.dbLite.query('update mem_accounts set fallrate = fallrate - 1, vote = vote + '+ constants.fallrateAmount +'  where fallrate > 0 and address in (' + escaped.join(',') + ')', function (err, data) {
                    return cb(err);
                });
            },
            // function (cb) {
            //   self.getVotes(round, function (err, votes) {
            //     if (err) {
            //       return cb(err);
            //     }
            //     async.eachSeries(votes, function (vote, cb) {
            //       library.dbLite.query('update mem_accounts set vote = vote + $amount where address = $address', {
            //         address: modules.accounts.generateAddressByPublicKey(vote.delegate),
            //         amount: vote.amount
            //       }, cb);
            //     }, function (err) {
            //       self.flush(round, function (err2) {
            //         cb(err || err2);
            //       });
            //     })
            //   });
            // },
            function (cb) {
                var roundChanges = new RoundChanges(round);
                
                async.forEachOfSeries(__cur.delegatesByRound[round], function (delegate, index, next) {
                    var changes = roundChanges.at(index);
                    var changeBalance = changes.balance;
                    var changeFees = changes.fees;
                    var changeRewards = changes.rewards;
                    if (index === __cur.delegatesByRound[round].length - 1) {
                        changeBalance += changes.feesRemaining;
                        changeFees    += changes.feesRemaining;
                    }


                    if(block.height >= 580500) {

                        var realChangeBalance   = changeBalance / 100000000;
                        var realChangeFees      = changeFees / 100000000;
                        var realChangeRewards   = changeRewards / 100000000;

                        var delegateBalance     = parseFloat((((realChangeBalance/100)*60) * 100000000).toFixed(0));
                        var delegateFees        = parseFloat((((realChangeFees/100)*60) * 100000000).toFixed(0));
                        var delegateRewards     = parseFloat((((realChangeRewards/100)*60) * 100000000).toFixed(0));

                        daoBalance              += parseFloat((((realChangeBalance/100)*40) * 100000000).toFixed(0));
                        daoFees                 += parseFloat(((realChangeFees/100)*40) * 100000000).toFixed(0);
                        daoRewards              += parseFloat((((realChangeRewards/100)*40) * 100000000).toFixed(0));


                        modules.accounts.mergeAccountAndGet({
                            publicKey: delegate,
                            balance: delegateBalance,
                            u_balance: delegateBalance,
                            blockId: block.id,
                            round: modules.round.calc(block.height),
                            fees: delegateFees,
                            rewards: delegateRewards
                        }, next);
                    } else {
                        modules.accounts.mergeAccountAndGet({
                            publicKey: delegate,
                            balance: changeBalance,
                            u_balance: changeBalance,
                            blockId: block.id,
                            round: modules.round.calc(block.height),
                            fees: changeFees,
                            rewards: changeRewards
                        }, next);
                    }

                }, cb);
            },
            function (cb) {
                if(block.height >= 580500) {
                    modules.accounts.mergeAccountAndGet({
                        address: constants.daoAddress,
                        balance: daoBalance,
                        u_balance: daoBalance,
                        blockId: block.id,
                        round: modules.round.calc(block.height),
                        fees: daoFees,
                        rewards: daoRewards
                    }, cb);
                } else return cb();
            },
            function (cb) {
                // distribute club bonus
                if (!global.featureSwitch.enableClubBonus) {
                    return cb()
                }
                var bonus = new RoundChanges(round).getClubBonus()
                var dappId = global.state.clubInfo.transactionId
                const BONUS_CURRENCY = 'XAS'
                library.logger.info('Btw witness club get new bonus: ' + bonus)
                library.balanceCache.addAssetBalance(dappId, BONUS_CURRENCY, bonus)
                library.model.updateAssetBalance(BONUS_CURRENCY, bonus, dappId, cb)
            },
            function (cb) {
                self.getVotes(round, function (err, votes) {
                    if (err) {
                        return cb(err);
                    }
                    async.eachSeries(votes, function (vote, cb) {
                        var address = null
                        if (global.featureSwitch.fixVoteNewAddressIssue) {
                            address = modules.accounts.generateAddressByPublicKey2(vote.delegate)
                        } else {
                            address = modules.accounts.generateAddressByPublicKey(vote.delegate)
                        }
                        library.dbLite.query('update mem_accounts set vote = vote + $amount where address = $address', {
                            address: address,
                            amount: vote.amount
                        }, cb);
                    }, function (err) {
                        library.bus.message('finishRound', round);
                        self.flush(round, function (err2) {
                            cb(err || err2);
                        });
                    })
                });
            },
            function (cb) {
                // Fix NaN asset balance issue caused by flowed amount validate function

                if (round === 33348) {
                    library.balanceCache.setAssetBalance('ABrWsCGv25nahd4qqZ7bofj3MuSfpSX1Rg', 'ABSORB.YLB', '32064016000000')
                    library.balanceCache.setAssetBalance('A5Hyw75AHCthHnevjpyP9J4146uXvHTX4P', 'ABSORB.YLB', '15932769000000')
                    var sql = 'update mem_asset_balances set balance = "32064016000000" where currency="ABSORB.YLB" and address="ABrWsCGv25nahd4qqZ7bofj3MuSfpSX1Rg";' +
                        'update mem_asset_balances set balance = "15932769000000" where currency="ABSORB.YLB" and address="A5Hyw75AHCthHnevjpyP9J4146uXvHTX4P";'
                    library.dbLite.query(sql, cb)
                } else {
                    cb()
                }
            }
        ], function (err) {
            delete __cur.feesByRound[round];
            delete __cur.rewardsByRound[round];
            delete __cur.delegatesByRound[round];

            done(err);
        });
    });
};

Round.prototype.sandboxApi = function (call, args, cb) {
    sandboxHelper.callMethod(shared, call, args, cb);
};

// Events
Round.prototype.onBind = function (scope) {
    modules = scope;
};

Round.prototype.onBlockchainReady = function () {
    var round = self.calc(modules.blocks.getLastBlock().height);
    library.dbLite.query("select sum(b.totalFee), GROUP_CONCAT(b.reward), GROUP_CONCAT(lower(hex(b.generatorPublicKey))) from blocks b where (select (cast(b.height / 101 as integer) + (case when b.height % 101 > 0 then 1 else 0 end))) = $round",
        {
            round: round
        },
        {
            fees: Number,
            rewards: Array,
            delegates: Array
        }, function (err, rows) {
            __cur.feesByRound[round] = rows[0].fees;
            __cur.rewardsByRound[round] = rows[0].rewards;
            __cur.delegatesByRound[round] = rows[0].delegates;
            __cur.loaded = true;
        });
};

Round.prototype.onFinishRound = function (round) {
    library.network.io.sockets.emit('rounds/change', {number: round});
};

Round.prototype.cleanup = function (cb) {
    __cur.loaded = false;
    cb();
};

// Shared

// Export
module.exports = Round;

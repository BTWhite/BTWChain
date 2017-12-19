var dblite = require('../dblite');
var async = require('async');
var path = require('path');

var isWin = /^win/.test(process.platform);
//var isMac = /^darwin/.test(process.platform);
if (isWin) {
	dblite.bin = path.join(process.cwd(), 'bin', 'sqlite3.exe');
}

module.exports.connect = function (connectString, cb) {
  var db = dblite(connectString);
  var sql = [
    "CREATE TABLE IF NOT EXISTS blocks (id VARCHAR(64) PRIMARY KEY, version INT NOT NULL, timestamp INT NOT NULL, height BIGINT NOT NULL, previousBlock VARCHAR(64), numberOfTransactions INT NOT NULL, totalAmount BIGINT NOT NULL, totalFee BIGINT NOT NULL, reward BIGINT NOT NULL, payloadLength INT NOT NULL, payloadHash BINARY(32) NOT NULL, generatorPublicKey BINARY(32) NOT NULL, blockSignature BINARY(64) NOT NULL, FOREIGN KEY ( previousBlock ) REFERENCES blocks ( id ) ON DELETE SET NULL)",
    "CREATE TABLE IF NOT EXISTS trs (id VARCHAR(64) PRIMARY KEY, blockId VARCHAR(64) NOT NULL, type TINYINT NOT NULL, timestamp INT NOT NULL, senderPublicKey BINARY(32) NOT NULL, senderId VARCHAR(50) NOT NULL, recipientId VARCHAR(50), amount BIGINT NOT NULL, fee BIGINT NOT NULL, signature BINARY(64) NOT NULL, signSignature BINARY(64), requesterPublicKey BINARY(32), signatures TEXT, args VARCHAR(4096), message VARCHAR(256), FOREIGN KEY(blockId) REFERENCES blocks(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS signatures (transactionId VARCHAR(64) NOT NULL PRIMARY KEY, publicKey BINARY(32) NOT NULL, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS delegates(username VARCHAR(20) NOT NULL, transactionId VARCHAR(64) NOT NULL, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS votes(votes TEXT, transactionId VARCHAR(64) NOT NULL, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS forks_stat(delegatePublicKey BINARY(32) NOT NULL, blockTimestamp INT NOT NULL, blockId VARCHAR(64) NOT NULL, blockHeight INT NOT NULL, previousBlock VARCHAR(64) NOT NULL, cause INT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS multisignatures(min INT NOT NULL, lifetime INT NOT NULL, keysgroup TEXT NOT NULL, transactionId VARCHAR(64) NOT NULL, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS dapps(transactionId VARCHAR(64) NOT NULL, name VARCHAR(32) NOT NULL, description VARCHARH(160), tags VARCHARH(160), link TEXT, type INTEGER NOT NULL, category INTEGER NOT NULL, icon TEXT, delegates TEXT, unlockDelegates, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS intransfer(dappId VARCHAR(20) NOT NULL, currency VARCHAR(22) NOT NULL, amount VARCHAR(50), transactionId VARCHAR(64) NOT NULL, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS outtransfer(transactionId VARCHAR(64) NOT NULL, currency VARCHAR(22) NOT NULL, amount VARCHAR(50) NOT NULL, dappId VARCHAR(20) NOT NULL, outtransactionId VARCHAR(64) NOT NULL UNIQUE, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS peers (id INTEGER NOT NULL PRIMARY KEY, ip INTEGER NOT NULL, port TINYINT NOT NULL, state TINYINT NOT NULL, os VARCHAR(64), version VARCHAR(11), clock INT)",
    "CREATE TABLE IF NOT EXISTS peers_dapp (peerId INT NOT NULL, dappId VARCHAR(20) NOT NULL, FOREIGN KEY(peerId) REFERENCES peers(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS storages(content VARBINARY(4096), transactionId VARCHAR(64) NOT NULL, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",

    // UIA transactions
    "CREATE TABLE IF NOT EXISTS issuers(name VARCHAR(16) NOT NULL PRIMARY KEY, desc VARCHAR(4096) NOT NULL, issuerId VARCHAR(50), transactionId VARCHAR(64) NOT NULL, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS assets(name VARCHAR(22) NOT NULL PRIMARY KEY, desc VARCHAR(4096) NOT NULL, maximum VARCHAR(50) NOT NULL, precision TINYINT NOT NULL, strategy TEXT, quantity VARCHAR(50), issuerName VARCHAR(16) NOT NULL, acl TINYINT, writeoff TINYINT, allowWriteoff TINYINT, allowWhitelist TINYINT, allowBlacklist TINYINT, transactionId VARCHAR(64) NOT NULL, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS flags(currency VARCHAR(22) NOT NULL, flag TINYINT NOT NULL, flagType TINYINT NOT NULL, transactionId VARCHAR(64) NOT NULL, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS issues(currency VARCHAR(22) NOT NULL, amount VARCHAR(50) NOT NULL, transactionId VARCHAR(64) NOT NULL, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS acls(currency VARCHAR(22) NOT NULL, flag TINYINT NOT NULL, operator CHAR(1) NOT NULL, list TEXT NOT NULL, transactionId VARCHAR(64) NOT NULL, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS transfers(currency VARCHAR(22) NOT NULL, amount VARCHAR(50) NOT NULL, transactionId VARCHAR(64) NOT NULL, FOREIGN KEY(transactionId) REFERENCES trs(id) ON DELETE CASCADE)",
    
    // UIA states
    "CREATE TABLE IF NOT EXISTS mem_asset_balances(currency VARCHAR(22) NOT NULL, address VARCHAR(64) NOT NULL, balance VARCHAR(50) NOT NULL)",
    "CREATE TABLE IF NOT EXISTS acl_white(currency VARCHAR(22) NOT NULL, address VARCHAR(50) NOT NULL)",
    "CREATE TABLE IF NOT EXISTS acl_black(currency VARCHAR(22) NOT NULL, address VARCHAR(50) NOT NULL)",

    // UIA indexs
    "CREATE INDEX IF NOT EXISTS issuers_trs_id ON issuers(transactionId)",
    "CREATE INDEX IF NOT EXISTS issuers_issuer_id ON issuers(issuerId)",
    "CREATE INDEX IF NOT EXISTS assets_trs_id ON assets(transactionId)",
    "CREATE INDEX IF NOT EXISTS assets_issuer_name ON assets(issuerName)",
    "CREATE INDEX IF NOT EXISTS flags_trs_id ON flags(transactionId)",
    "CREATE INDEX IF NOT EXISTS issues_trs_id ON issues(transactionId)",
    "CREATE INDEX IF NOT EXISTS acls_trs_id ON acls(transactionId)",
    "CREATE INDEX IF NOT EXISTS transfers_trs_id ON transfers(transactionId)",
    "CREATE INDEX IF NOT EXISTS transfers_trs_currency ON transfers(currency)",
    "CREATE INDEX IF NOT EXISTS balance_address on mem_asset_balances(address)",
    "CREATE INDEX IF NOT EXISTS balance_currency on mem_asset_balances(currency)",
    "CREATE INDEX IF NOT EXISTS acl_white_index on acl_white(currency, address)",
    "CREATE INDEX IF NOT EXISTS acl_black_index on acl_black(currency, address)",
    "CREATE INDEX IF NOT EXISTS acl_white_currency on acl_black(currency)",
    "CREATE INDEX IF NOT EXISTS acl_black_currency on acl_black(currency)",

    // Indexes
    "CREATE UNIQUE INDEX IF NOT EXISTS blocks_height ON blocks(height)",
    "CREATE UNIQUE INDEX IF NOT EXISTS blocks_previousBlock ON blocks(previousBlock)",
    "CREATE UNIQUE INDEX IF Not EXISTS out_transaction_id ON outtransfer(outTransactionId)",
    "CREATE UNIQUE INDEX IF NOT EXISTS peers_unique ON peers(ip, port)",
    "CREATE UNIQUE INDEX IF NOT EXISTS peers_dapp_unique ON peers_dapp(peerId, dappId)",
    "CREATE INDEX IF NOT EXISTS blocks_generator_public_key ON blocks(generatorPublicKey)",
    // "CREATE INDEX IF NOT EXISTS blocks_reward ON blocks(reward)",
    // "CREATE INDEX IF NOT EXISTS blocks_totalFee ON blocks(totalFee)",
    // "CREATE INDEX IF NOT EXISTS blocks_totalAmount ON blocks(totalAmount)",
    // "CREATE INDEX IF NOT EXISTS blocks_numberOfTransactions ON blocks(numberOfTransactions)",
    // "CREATE INDEX IF NOT EXISTS blocks_timestamp ON blocks(timestamp)",
    "drop index if exists blocks_reward",
    "drop index if exists blocks_totalFee",
    "drop index if exists blocks_totalAmount",
    "drop index if exists blocks_numberOfTransactions",
    "drop index if exists blocks_timestamp",
    "CREATE INDEX IF NOT EXISTS trs_block_id ON trs(blockId)",
    "CREATE INDEX IF NOT EXISTS trs_sender_id ON trs(senderId)",
    "CREATE INDEX IF NOT EXISTS trs_recipient_id ON trs(recipientId)",
    "CREATE INDEX IF NOT EXISTS trs_senderPublicKey on trs(senderPublicKey)",
    "CREATE INDEX IF NOT EXISTS trs_type on trs(type)",
    "CREATE INDEX IF NOT EXISTS trs_timestamp on trs(timestamp)",
    "CREATE INDEX IF NOT EXISTS trs_message on trs(message)",
    "CREATE INDEX IF NOT EXISTS signatures_trs_id ON signatures(transactionId)",
    "CREATE INDEX IF NOT EXISTS votes_trs_id ON votes(transactionId)",
    "CREATE INDEX IF NOT EXISTS delegates_trs_id ON delegates(transactionId)",
    "CREATE INDEX IF NOT EXISTS multisignatures_trs_id ON multisignatures(transactionId)",
    "CREATE INDEX IF NOT EXISTS dapps_trs_id ON dapps(transactionId)",
    "CREATE INDEX IF NOT EXISTS dapps_name ON dapps(name)",
    "CREATE INDEX IF NOT EXISTS storages_trs_id ON storages(transactionId)",
    "PRAGMA foreign_keys=ON",
    "PRAGMA synchronous=OFF",
    "PRAGMA journal_mode=MEMORY",
    "PRAGMA default_cache_size=10000",
    "PRAGMA locking_mode=EXCLUSIVE"
  ];

  var post = [
    "UPDATE peers SET state = 1, clock = null where state != 0"
  ];

  async.eachSeries(sql, function (command, cb) {
    db.query(command, function (err, data) {
      cb(err, data);
    });
  }, function (err) {
    if (err) {
      return cb(err);
    }

    var migration = {};

    db.query("PRAGMA user_version", function (err, rows) {
      if (err) {
        return cb(err);
      }

      var currentVersion = rows[0] || 0;

      var nextVersions = Object.keys(migration).sort().filter(function (ver) {
        return ver > currentVersion;
      });

      async.eachSeries(nextVersions, function (ver, cb) {
        async.eachSeries(migration[ver], function (command, cb) {
          db.query(command, function (err, data) {
            cb(err, data);
          });
        }, function (err) {
          if (err) {
            return cb(err);
          }

          db.query("PRAGMA user_version = " + ver, function (err, data) {
            cb(err, data);
          });
        });
      }, function (err) {
        if (err) {
          return cb(err);
        }

        async.eachSeries(post, function (command, cb) {
          db.query(command, function (err, data) {
            cb(err, data);
          });
        }, function (err) {
          cb(err, db);
        });
      });
    });
  });
}

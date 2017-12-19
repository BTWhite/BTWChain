const async = require('async');
const jsonSql = require('json-sql')();
jsonSql.setDialect("sqlite");
const extend = require('extend');
const sandboxHelper = require('../utils/sandbox.js');

// Private fields
var modules, library, self, __cur = {}, shared = {};

__cur.loaded = false;

__cur.DOUBLE_DOUBLE_QUOTES = /""/g;
__cur.SINGLE_QUOTES = /'/g;
__cur.SINGLE_QUOTES_DOUBLED = "''";

// Constructor
function Sql(cb, scope) {
    library = scope;
    self = this;
    self.__private = __cur;

    setImmediate(cb, null, self);
}

__cur.escape = function (what) {
    switch (typeof what) {
        case 'string':
            return "'" + what.replace(
                __cur.SINGLE_QUOTES, __cur.SINGLE_QUOTES_DOUBLED
            ) + "'";
        case 'object':
            if (what == null) {
                return 'null';
            } else if (Buffer.isBuffer(what)) {
                return "X'" + what.toString('hex') + "'";
            } else {
                return ("'" + JSON.stringify(what).replace(
                    __cur.SINGLE_QUOTES, __cur.SINGLE_QUOTES_DOUBLED
                ) + "'");
            }
        case 'boolean':
            return what ? '1' : '0'; // 1 => true, 0 => false
        case 'number':
            if (isFinite(what)) return '' + what;
    }
    throw new Error('unsupported data', typeof what);
};

__cur.pass = function (obj, dappid) {
    for (var property in obj) {
        if (typeof obj[property] == "object") {
            __cur.pass(obj[property], dappid);
        }
        if (property == "table") {
            obj[property] = "dapp_" + dappid + "_" + obj[property];
        }
        if (property == "join" && obj[property].length === undefined) {
            for (var table in obj[property]) {
                var tmp = obj[property][table];
                delete obj[property][table];
                obj[property]["dapp_" + dappid + "_" + table] = tmp;
            }
        }
        if (property == "on" && !obj.alias) {
            for (var firstTable in obj[property]) {
                var secondTable = obj[property][firstTable];
                delete obj[property][firstTable];

                var firstTableRaw = firstTable.split(".");
                firstTable = "dapp_" + dappid + "_" + firstTableRaw[0];

                var secondTableRaw = secondTable.split(".");
                secondTable = "dapp_" + dappid + "_" + secondTableRaw[0];

                obj[property][firstTable] = secondTable;
            }
        }
    }
};

// Private methods
__cur.query = function (action, config, cb) {
    var sql = null;

    function done(err, data) {
        if (err) {
            err = err.toString();
        }

        cb(err, data);
    }

    if (action != "batch") {
        __cur.pass(config, config.dappid);

        var defaultConfig = {
            type: action
        };

        try {
            sql = jsonSql.build(extend({}, config, defaultConfig));
        } catch (e) {
            return done(e.toString());
        }

        if (action == "select") {
            // console.log(sql.query, sql.values)
            library.dbLite.query(sql.query, sql.values, null, done);
        } else {
            library.dbLite.query(sql.query, sql.values, done);
        }
    } else {
        var batchPack = [];
        async.until(
            function () {
                batchPack = config.values.splice(0, 10);
                return batchPack.length == 0;
            }, function (cb) {
                var fields = Object.keys(config.fields).map(function (field) {
                    return __cur.escape(config.fields[field]);
                });
                sql = "INSERT INTO " + "dapp_" + config.dappid + "_" + config.table + " (" + fields.join(",") + ") ";
                var rows = [];
                batchPack.forEach(function (value, rowIndex) {
                    var currentRow = batchPack[rowIndex];
                    var fields = [];
                    for (var i = 0; i < currentRow.length; i++) {
                        fields.push(__cur.escape(currentRow[i]));
                    }
                    rows.push("select " + fields.join(","));
                });
                sql = sql + " " + rows.join(" UNION ");
                library.dbLite.query(sql, {}, cb);
            }, done);
    }
};

// Public methods
Sql.prototype.createTables = function (dappid, config, cb) {
    if (!config) {
        return cb("Invalid table format");
    }

    var sqles = [];
    for (var i = 0; i < config.length; i++) {
        config[i].table = "dapp_" + dappid + "_" + config[i].table;
        if (config[i].type == "table") {
            config[i].type = "create";
            if (config[i].foreignKeys) {
                for (var n = 0; n < config[i].foreignKeys.length; n++) {
                    config[i].foreignKeys[n].table = "dapp_" + dappid + "_" + config[i].foreignKeys[n].table;
                }
            }
        } else if (config[i].type == "index") {
            config[i].type = "index";
        } else {
            return setImmediate(cb, "Unknown table type: " + config[i].type);
        }

        var sql = jsonSql.build(config[i]);
        sqles.push(sql.query);
    }

    async.eachSeries(sqles, function (command, cb) {
        library.dbLite.query(command, function (err, data) {
            cb(err, data);
        });
    }, function (err) {
        setImmediate(cb, err, self);
    });
};

/*
 Drop tables functional
 */
Sql.prototype.dropTables = function (dappid, config, cb) {
    var tables = [];
    for (var i = 0; i < config.length; i++) {
        config[i].table = "dapp_" + dappid + "_" + config[i].table;
        tables.push({name: config[i].table.replace(/[^\w_]/gi, ''), type: config[i].type});
    }

    async.eachSeries(tables, function (table, cb) {
        if (table.type == "table") {
            library.dbLite.query("DROP TABLE IF EXISTS " + table.name, function (err, rows) {
                setImmediate(cb, err);
            });
        } else if (table.type == "index") {
            library.dbLite.query("DROP INDEX IF EXISTS " + table.name, function (err, rows) {
                setImmediate(cb, err);
            })
        } else {
            setImmediate(cb);
        }
    }, cb);
};

Sql.prototype.sandboxApi = function (call, args, cb) {
    sandboxHelper.callMethod(shared, call, args, cb);
};

// Events
Sql.prototype.onBind = function (scope) {
    modules = scope;
};

Sql.prototype.onBlockchainReady = function () {
    __cur.loaded = true;
};

// Shared
shared.select = function (req, cb) {
    var config = extend({}, req.body, {dappid: req.dappid});
    __cur.query.call(this, "select", config, cb);
};

shared.batch = function (req, cb) {
    var config = extend({}, req.body, {dappid: req.dappid});
    __cur.query.call(this, "batch", config, cb);
};

shared.insert = function (req, cb) {
    var config = extend({}, req.body, {dappid: req.dappid});
    __cur.query.call(this, "insert", config, cb);
};

shared.update = function (req, cb) {
    var config = extend({}, req.body, {dappid: req.dappid});
    __cur.query.call(this, "update", config, cb);
};

shared.remove = function (req, cb) {
    var config = extend({}, req.body, {dappid: req.dappid});
    __cur.query.call(this, "remove", config, cb);
};

module.exports = Sql;

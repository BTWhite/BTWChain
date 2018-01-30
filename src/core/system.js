const os = require("os");
const sandboxHelper = require('../utils/sandbox.js');
const slots = require('../utils/slots.js');
const Router = require('../utils/router.js');
const shell = require('../utils/shell.js');

let modules, library, self, __cur = {}, shared = {};

__cur.version = '';
__cur.osName = '';
__cur.port = '';

function System(cb, scope) {
    library = scope;
    self = this;
    self.__private = __cur;

    __cur.version = library.config.version;
    __cur.port = library.config.port;
    __cur.magic = library.config.magic;
    __cur.osName = os.platform() + os.release();

    __cur.attachApi();

    setImmediate(cb, null, self);
}

// Private methods
__cur.attachApi = function () {
    var router = new Router();

    router.use(function (req, res, next) {
        if (modules) return next();
        res.status(500).send({ success: false, error: "Blockchain is loading" });
    });

    router.map(shared, {
        "get /": "getSystemInfo"
    });

    router.use(function (req, res, next) {
        res.status(500).send({ success: false, error: "API endpoint not found" });
    });

    library.network.app.use('/api/system', router);
    library.network.app.use(function (err, req, res, next) {
        if (!err) return next();
        library.logger.error(req.url, err.toString());
        res.status(500).send({ success: false, error: err.toString() });
    });
};


//Shared methods
shared.getSystemInfo = function (req, cb) {

    var lastBlock = modules.blocks.getLastBlock();
    var systemInfo = shell.getOsInfo();

    return cb(null, {
        os: os.platform() +"_"+ os.release(),
        version: library.config.version,
        timestamp : Date.now(),

        lastBlock:{
            height: lastBlock.height,
            timestamp : slots.getRealTime(lastBlock.timestamp),
            behind: slots.getNextSlot() - (slots.getSlotNumber(lastBlock.timestamp) +1)
        },

        systemLoad:{
            cores : systemInfo.cpucore,
            loadAverage : systemInfo.loadavg,
            freeMem: systemInfo.memfreemb,
            totalMem: systemInfo.memtotalmb
        }
    });
};

System.prototype.getOS = function () {
    return __cur.osName;
};

System.prototype.getVersion = function () {
    return __cur.version;
};

System.prototype.getPort = function () {
    return __cur.port;
};

System.prototype.getMagic = function () {
    return __cur.magic;
};

System.prototype.sandboxApi = function (call, args, cb) {
    sandboxHelper.callMethod(shared, call, args, cb);
};

System.prototype.onBind = function (scope) {
    modules = scope;
};

module.exports = System;
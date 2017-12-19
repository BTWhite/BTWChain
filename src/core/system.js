const os = require("os");
const sandboxHelper = require('../utils/sandbox.js');

// Private fields
var modules, library, self, __cur = {}, shared = {};

__cur.version = null;
__cur.osName = null;
__cur.port = null;

// Constructor
function System(cb, scope) {
    library = scope;
    self = this;
    self.__private = __cur;

    __cur.version = library.config.version;
    __cur.port = library.config.port;
    __cur.magic = library.config.magic;
    __cur.osName = os.platform() + os.release();

    setImmediate(cb, null, self);
}

// Private methods

// Public methods
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

// Events
System.prototype.onBind = function (scope) {
    modules = scope;
};

// Export
module.exports = System;

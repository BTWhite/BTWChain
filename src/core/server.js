const util = require('util');
const async = require('async');
const path = require('path');
const Router = require('../utils/router.js');
const sandboxHelper = require('../utils/sandbox.js');

// Private fields
var modules, library, self, __cur = {}, shared = {};

__cur.loaded = false;

// Constructor
function Server(cb, scope) {
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
        if (modules) return next();
        res.status(500).send({success: false, error: "Blockchain is loading"});
    });
    router.get('/', function (req, res) {
        if (__cur.loaded) {
            res.render('wallet.html', {layout: false});
        } else {
            res.render('index.html');
        }
    });
    router.get('/api/blocks/totalsupply', function (req, res) {
        res.status(200).send('' + modules.blocks.getSupply() / 100000000);
    });
    router.get('/api/blocks/circulatingsupply', function (req, res) {
        res.status(200).send('' + modules.blocks.getCirculatingSupply() / 100000000);
    });
    router.get('/dapps/:id', function (req, res) {
        res.render('dapps/' + req.params.id + '/index.html');
    });
    router.use(function (req, res, next) {
        if (req.url.indexOf('/api/') == -1 && req.url.indexOf('/peer/') == -1) {
            return res.redirect('/');
        }
        next();
        // res.status(500).send({ success: false, error: 'api not found' });
    });
    library.network.app.use('/', router);
};

// Public methods
Server.prototype.sandboxApi = function (call, args, cb) {
    sandboxHelper.callMethod(shared, call, args, cb);
};

// Events
Server.prototype.onBind = function (scope) {
    modules = scope;
};

Server.prototype.onBlockchainReady = function () {
    __cur.loaded = true;
};

Server.prototype.cleanup = function (cb) {
    __cur.loaded = false;
    cb();
};

// Export
module.exports = Server;

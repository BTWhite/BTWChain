const assert = require('assert');
const crypto = require('crypto');
const program = require('commander');
const path = require('path');
const fs = require('fs');
const async = require('async');
const Logger = require('./src/logger');
const init = require('./src/init');

/**
 * @type {{version: string, buildVersion: string, config: string, genesis: string, basePath: string, htmlPath: string, dappsPath: string, netVersion: string, blockchainFile: string, debug: string[]}}
 */
let defaultConfig = {
    version: '1.1.11',
    buildVersion: 'rc',
    config: 'config.json',
    genesis: 'genesis.json',
    basePath: './',
    htmlPath: 'layout',
    dappsPath: 'dapps',
    netVersion: 'mainnet',
    blockchainFile: 'blockchain.db',
    debug: ['logs', 'debug.log'],
    minVersion: '1.1.7'
};


/**
 * @type {{genesis: node.genesis, init: node.init}}
 */
let node = {
    /**
     * @param scope
     * @param block
     */
    genesis: function(scope, block) {
        try {
            let payloadHash = crypto.createHash('sha256');
            let payloadLength = 0;
            for (let i = 0; i < block.transactions.length; ++i) {
                let trs = block.transactions[i];
                let bytes = scope.base.transaction.getBytes(trs);
                payloadLength += bytes.length;
                payloadHash.update(bytes);
            }
            let id = scope.base.block.getId(block);
            assert.equal(payloadLength, block.payloadLength, 'Unexpected payloadLength');
            assert.equal(payloadHash.digest().toString('hex'), block.payloadHash, 'Unexpected payloadHash');
            assert.equal(id, block.id, 'Unexpected block id');
        } catch (e) {
            assert(false, 'Failed to verify genesis block: ' + e);
        }
    },

    /**
     * @param def
     */
    init: function(def) {
        process.stdin.resume();

        /** @namespace program.base */
        let baseDir = program.base || def.basePath;

        /** @namespace program.config */
        let appConfigFile = path.join(baseDir, def.config);
        if (program.config) {
            appConfigFile = path.resolve(process.cwd(), program.config);
        }
        let appConfig = JSON.parse(fs.readFileSync(appConfigFile, 'utf8'));

        if (!appConfig.dapp.masterpassword) {
            let randomstring = require("randomstring");
            appConfig.dapp.masterpassword = randomstring.generate({
                length: 12,
                readable: true,
                charset: 'alphanumeric'
            });
            fs.writeFileSync(appConfigFile, JSON.stringify(appConfig, null, 2), "utf8");
        }

        appConfig.version = def.version;
        appConfig.baseDir = baseDir;
        appConfig.buildVersion = def.buildVersion;
        appConfig.netVersion = process.env.NET_VERSION || def.netVersion;
        appConfig.publicDir = path.join(baseDir, def.htmlPath);
        appConfig.minVersion = def.minVersion;

        if(typeof appConfig.forging.secret == 'undefined') {
            appConfig.forging.secret = JSON.parse(fs.readFileSync("delegates.json", 'utf8'));
        }

        /** @namespace program.dapps */
        appConfig.dappsDir = program.dapps || path.join(baseDir, def.dappsPath);
        global.Config = appConfig;

        let genesisblockFile = path.join(baseDir, def.genesis);

        /** @namespace program.genesisblock */
        if (program.genesisblock) {
            genesisblockFile = path.resolve(process.cwd(), program.genesisblock);
        }
        let genesisblock = JSON.parse(fs.readFileSync(genesisblockFile, 'utf8'));

        /** @namespace program.port */
        if (program.port) {
            appConfig.port = program.port;
        }

        /** @namespace program.address */
        if (program.address) {
            appConfig.address = program.address;
        }

        /** @namespace program.peers */
        if (program.peers) {
            if (typeof program.peers === 'string') {
                appConfig.peers.list = program.peers.split(',').map(function (peer) {
                    peer = peer.split(":");
                    return {
                        ip: peer.shift(),
                        port: peer.shift() || appConfig.port
                    };
                });
            } else {
                appConfig.peers.list = [];
            }
        }

        if (appConfig.netVersion === def.netVersion) {
            //CODE:
        }

        /** @namespace program.log */
        if (program.log) {
            appConfig.logLevel = program.log;
        }

        let protoFile = path.join(baseDir, 'src', 'index.proto');
        if (!fs.existsSync(protoFile)) {
            console.log('Failed: proto file not exists!');
            return;
        }

        /** @namespace program.daemon */
        if (program.daemon) {
            console.log('BTW server started as daemon ...');
            require('daemon')({cwd: process.cwd()});
        }

        /** @namespace program.deamon */
        let logger = new Logger({
            filename: path.join(baseDir, def.debug[0], def.debug[1]),
            echo: program.deamon ? null : appConfig.logLevel,
            errorLevel: appConfig.logLevel
        });

        /** @namespace program.blockchain */
        let options = {
            dbFile: program.blockchain || path.join(baseDir, def.blockchainFile),
            appConfig: appConfig,
            genesisblock: genesisblock,
            logger: logger,
            protoFile: protoFile
        };

        /** @namespace program.reindex */
        if (program.reindex) {
            appConfig.loading.verifyOnLoading = true;
        }

        global.featureSwitch = {};
        global.state = {};

        init(options, function (err, scope) {
            if (err) {
                scope.logger.fatal(err);
                process.exit(1);
                return;
            }
            node.genesis(scope, scope.genesisblock.block);

            /** @namespace program.execute */
            if (program.execute) {
                // only for debug use
                // require(path.resolve(program.execute))(scope);
            }

            /** @namespace scope.bus */
            scope.bus.message('bind', scope.modules);
            global.modules = scope.modules;

            /** @namespace scope.logger */
            scope.logger.info('Modules ready and launched');
            if (!scope.config.publicIp) {
                scope.logger.warn('Failed to get public ip, block forging MAY not work!');
            }

            process.once('cleanup', function () {
                scope.logger.info('Cleaning up...');
                async.eachSeries(scope.modules, function (module, cb) {
                    if (typeof (module.cleanup) === 'function') {
                        module.cleanup(cb);
                    } else {
                        setImmediate(cb);
                    }
                }, function (err) {
                    if (err) {
                        scope.logger.error('Error while cleaning up', err);
                    } else {
                        scope.logger.info('Cleaned up successfully');
                    }
                    /** @namespace scope.dbLite */
                    scope.dbLite.close();
                    process.exit(1);
                });
            });

            process.once('SIGTERM', function () {
                process.emit('cleanup');
            });

            process.once('exit', function () {
                scope.logger.info('process exited');
            });

            process.once('SIGINT', function () {
                process.emit('cleanup');
            });

            process.on('uncaughtException', function (err) {
                scope.logger.fatal('uncaughtException', {message: err.message, stack: err.stack});
                process.emit('cleanup');
            });

            if (typeof gc !== 'undefined') {
                setInterval(function () {
                    gc();
                }, 60000);
            }
        });
    }
};

node.init(defaultConfig);

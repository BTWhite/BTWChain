const path = require('path');
const util = require('util');
const moment = require('moment');
const gulp = require('gulp');
const shell = require('gulp-shell');
const replace = require('gulp-replace');
const webpack = require('webpack-stream');
const nodeExternals = require('webpack-node-externals');
const pk = require('./package');

var format = util.format;
var buildTime = moment().format('HH:mm:ss DD/MM/YYYY');

function build(osVersion, netVersion) {
    var dir = 'btw-' + osVersion + '-' + pk.version + '-' + netVersion;
    var fullpath = path.join(__dirname, 'build', dir);
    var cmds = [];
    cmds.push(format('cd %s && mkdir -p public dapps tmp logs bin', fullpath));
    cmds.push(format('cp -r package.json btwd init proto %s', fullpath));
    if (netVersion !== 'localnet') {
        cmds.push(format('sed -i "s/testnet/%s/g" %s/btwd', netVersion, fullpath));
        cmds.push(format('cp config-%s.json %s/config.json', netVersion, fullpath));
        cmds.push(format('cp genesisBlock-%s.json %s/genesisBlock.json', netVersion, fullpath));
    } else {
        cmds.push(format('cp config.json %s/', fullpath));
        cmds.push(format('cp genesisBlock.json %s/', fullpath));
        cmds.push(format('cp bin/sqlite3.exe %s/', fullpath));
    }
    if (osVersion === 'linux') {
        cmds.push(format('cp `which node` %s/bin/', fullpath));
    }
    cmds.push(format('cp -r public/dist %s/public/', fullpath));
    cmds.push(format('cd %s && npm install --production', fullpath));
    cmds.push(format('cd %s/.. && tar zcf %s.tar.gz %s', fullpath, dir, dir));
    return gulp.src('app.js')
        .pipe(webpack({
            output: {
                filename: 'app.js'
            },
            target: 'node',
            context: __dirname,
            node: {
                __filename: true,
                __dirname: true
            },
            externals: [nodeExternals()]
        }))
        .pipe(replace('localnet', netVersion))
        .pipe(replace('development', buildTime))
        .pipe(gulp.dest(fullpath))
        .pipe(shell(cmds));
}

function buildSource(netVersion) {
    var dir = 'btw-' + 'linux' + '-' + pk.version + '-' + netVersion;
    var fullpath = path.join(__dirname, 'build', dir);
    return gulp.src('app.js')
        .pipe(webpack({
            output: {
                filename: 'app.js'
            },
            target: 'node',
            context: __dirname,
            node: {
                __filename: true,
                __dirname: true
            },
            externals: [nodeExternals()]
        }))
        .pipe(replace('localnet', netVersion))
        .pipe(replace('development', buildTime))
        .pipe(gulp.dest(fullpath));
}

gulp.task('build-src-main', function () {
    return buildSource('mainnet');
});

gulp.task('win64-build-local', function () {
    return build('win64', 'localnet');
});

gulp.task('linux-build-local', function () {
    return build('linux', 'localnet');
});

gulp.task('win64-build-test', function () {
    return build('win64', 'testnet');
});

gulp.task('linux-build-test', function () {
    return build('linux', 'testnet');
});

gulp.task('win64-build-main', function () {
    return build('win64', 'mainnet');
});

gulp.task('linux-build-main', function () {
    return build('linux', 'mainnet');
});
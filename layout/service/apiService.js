angular.module('btw').service('apiService', function ($http, $rootScope, $location, nodeService) {
    function json2url(json) {
        let arr = [];
        let str = '';
        for (let i in json) {
            str = i + '=' + json[i];
            arr.push(str);
        }
        return arr.join('&');
    }
    function fetch(url, data, method, postHeaders) {
        for (let k in data) {
            if (url.indexOf(':' + k) !== -1) {
                url = url.replace(':' + k, data[k]);
                delete data[k];
            }
        }
        let server = nodeService.getCurrentServer();
        if (!nodeService.isStaticServer()) {
            let retryTimes = 0;
            while ((!server.isServerAvalible(true)) && (retryTimes++ < 10)) {
                console.log("current server unavalible");
                nodeService.changeServer(true);
                server = nodeService.getCurrentServer();
            }
        }
        let realUrl = server.serverUrl + url;
        let promise = (method.toLowerCase() === 'get') ? $http.get(realUrl + '?' + json2url(data)) : $http.post(realUrl, data, postHeaders);
        let PromiseWrapper = function (promise) {
            this.promise = promise;
            this.success = function (successFunc) {
                promise.success(function (data, status, headers, config) {
                    server.updateStatus(headers);
                    successFunc(data, status, headers, config);
                });
                return this;
            };
            this.error = function (errorFunc) {
                this.promise.error(function (data, status, headers, config) {
                    server.updateStatus(headers);
                    errorFunc(data, status, headers, config);
                });
                return this;
            }
        };
        return new PromiseWrapper(promise);
    }
    this.login = function (params) {
        return fetch('/api/accounts/open2', params, 'post');
    };
    this.account = function (params) {
        return fetch('/api/accounts', params, 'get');
    };
    this.transactions = function (params) {
        return fetch('/api/transactions', params, 'get');
    };
    this.myvotes = function (params) {
        return fetch('/api/accounts/delegates', params, 'get');
    };
    this.blocks = function (params) {
        return fetch('/api/blocks', params, 'get');
    };
    this.blockforging = function (params) {
        return fetch('/api/delegates/get', params, 'get');
    };
    this.delegates = function (params) {
        return fetch('/api/delegates', params, 'get');
    };
    this.votetome = function (params) {
        return fetch('/api/delegates/voters', params, 'get');
    };
    this.peer = function (params) {
        return fetch('/api/peers', params, 'get');
    };
    this.blockDetail = function (params) {
        return fetch('/api/blocks/get', params, 'get');
    };
    this.accountdetail = function (params) {
        return fetch('/api/accounts', params, 'get');
    };
    this.appList = function (params) {
        return fetch('/api/dapps', params, 'get');
    };
    this.appInstalled = function (params) {
        return fetch('/api/dapps/installed', params, 'get');
    };
    this.forgingStatus = function (params) {
        return fetch('/api/delegates/forging/status', params, 'get');
    };
    this.myBalances = function (params) {
        return fetch('/api/uia/balances/:address', params, 'get');
    };
    this.myAssets = function (params) {
        return fetch('/api/uia/issuers/:name/assets', params, 'get');
    };
    this.issuer = function (params) {
        return fetch('/api/uia/issuers/:address', params, 'get');
    };
    this.assetAcl = function (params) {
        return fetch('/api/uia/assets/:name/acl/:flag', params, 'get');
    };
    this.myAssetTransactions = function (params) {
        return fetch('/api/uia/transactions/my/:address', params, 'get');
    };
    this.appBalance = function (params) {
        return fetch('/api/dapps/balances/:appId', params, 'get')
    };
    this.uiaAssetApi = function (params) {
        return fetch('/api/uia/assets/:name', params, 'get')
    };
    this.uiaAssetListApi = function (params) {
        return fetch('/api/uia/assets', params, 'get')
    };
    this.broadcastTransaction = function (trans) {
        return fetch('/peer/transactions', {transaction: trans}, 'post', {headers: {'magic': '5f5b3cf6', 'version': ''}});
    };

    this.storage = function(params) {
        return fetch('/api/storages/get', params, 'get');
    }
});
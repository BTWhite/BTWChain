angular.module('btw').service('postSerivice', function ($http, $translate, $rootScope, apiService, nodeService) {
    function canRetry(ret){
        return ret.error && /blockchain/.test(ret.error.toLowerCase()) && (!nodeService.isStaticServer()) ;
    }
    let postService = this;
    this.postWithRetry = function(trans, countDown, callback){
        let retryOrCallbak = function(data){
            if (countDown <= 0){
                callback(1, data);
                return;
            }
            nodeService.changeServer(true);
            postService.postWithRetry(trans, countDown-1, callback);
        };
        apiService.broadcastTransaction(trans).success(function(data, status, headers, config){
            if (data.success){
                callback(null, data);
                return;
            } else if (canRetry(data)){
                retryOrCallbak(data);
                return;
            }
            appMain.Toaster(data.error, 'Error', 'danger');
            callback(null, data);
        }).error(function(data, status, headers, config){
            retryOrCallbak(data);
        });
    };
    this.retryPost = function(createTransFunc, callback, retryTimes){
        let trans = (typeof createTransFunc === "function" ? createTransFunc() : createTransFunc);
        let maxRetry = retryTimes | 5;
        this.postWithRetry(trans, maxRetry, callback);
    };
    this.post = function (trans) {
        return apiService.broadcastTransaction(trans);
    };
    this.writeoff = function (trans) {
        return apiService.broadcastTransaction(trans);
    }
});
angular.module('btw').controller('reduceaclCtrl', function ($scope, $rootScope, apiService, ipCookie, $location, $window, NgTableParams, userService, postSerivice, $translate) {
    $rootScope.userlogin = true;
    $rootScope.active = 'acl';
    $scope.comfirmDialog = false;
    $rootScope.secpwd = userService.secondPublicKey;
    $scope.updateAcl = function () {
        $scope.createTransaction();
        $scope.comfirmDialog = true;
        $rootScope.isBodyMask = true;
    };
    $scope.createTransaction = function () {
        let currency = $rootScope.reduceACL.name;
        let flag = $rootScope.reduceACL.acl;
        let operator = '-'; // '+'， ‘-’
        let list = [];
        angular.forEach($rootScope.checkdelitem, function (data, index, array) {
            list.push(index);
        });
        if (!userService.secondPublicKey) {
            $scope.secondPassword = '';
        }
        return BtwJS.uia.createAcl(currency, operator, flag, list, userService.secret, $scope.secondPassword);
    };
    $rootScope.checkdelitem = {};
    $scope.checkitem = function (i) {
        let key = i.address;
        if (!$rootScope.checkdelitem[key]) {
            $rootScope.checkdelitem[key] = i;
        } else {
            delete $rootScope.checkdelitem[key];
        }
    };
    $scope.comfirmDialogClose = function () {
        $rootScope.isBodyMask = false;
        $scope.comfirmDialog = false;
    };
    $scope.comfirmSub = function () {
        postSerivice.retryPost($scope.createTransaction, function (err, res) {
            if (err === null) {
                if (res.success === true) {
                    $scope.secondPassword = '';
                    appMain.Toaster($translate.instant('INF_OPERATION_SUCCEEDED'), 'Success', 'success');
                    $scope.comfirmDialogClose();
                }
            }
        })
    };
    $scope.init = function () {
        $scope.listparams = new NgTableParams({
            page: 1,
            count: 10,
            sorting: {
                height: 'desc'
            }
        }, {
            total: 0,
            counts: [],
            getData: function ($defer, params) {
                apiService.assetAcl({
                    name: $rootScope.reduceACL.name,
                    flag: $rootScope.reduceACL.acl,
                    limit: params.count(),
                    offset: (params.page() - 1) * params.count()
                }).success(function (res) {
                    params.total(res.count);
                    $defer.resolve(res.list);
                }).error(function (res) {
                    appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                });
            }
        });
    }
});

angular.module('btw').controller('addaclCtrl', function ($scope, $rootScope, apiService, ipCookie, $location, $window, NgTableParams, userService, postSerivice, $translate) {
    $rootScope.userlogin = true;
    $rootScope.active = 'acl';
    $scope.comfirmDialog = false;
    $rootScope.secpwd = userService.secondPublicKey;
    $scope.sub = function () {
        $scope.comfirmDialog = true;
        $rootScope.isBodyMask = true;

    };
    $scope.comfirmDialogClose = function () {
        $rootScope.isBodyMask = false;
        $scope.comfirmDialog = false;
    };
    $scope.createTransaction = function () {
        let currency = $rootScope.addACL.name;
        let flagType = 1;
        let flag = $rootScope.addACL.acl;
        let operator = '+';
        let list = $scope.addList.split('\n') || [];
        if (!userService.secondPublicKey) {
            $scope.secondPassword = '';
        }
        return BtwJS.uia.createAcl(currency, operator, flag, list, userService.secret, $scope.secondPassword);
    };
    $scope.comfirmSub = function () {
        postSerivice.retryPost($scope.createTransaction, function (err, res) {
            if (err === null) {
                if (res.success === true) {
                    $scope.secondPassword = '';
                    $scope.addList = '';
                    appMain.Toaster($translate.instant('INF_OPERATION_SUCCEEDED'), 'Success', 'success');
                    $scope.comfirmDialogClose();
                }
            }
        })
    }
});

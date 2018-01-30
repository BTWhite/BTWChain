angular.module('btw').controller('transferCtrl', function ($scope, $rootScope, $filter, apiService, ipCookie, $http, $window, userService, postSerivice, $translate) {
    $rootScope.userlogin = true;
    $scope.isSendSuccess = true;
    $scope.userService = userService;
    $scope.fee = '0.1';

    $rootScope.sendtransferinfo = false;
    $rootScope.showsendtransfer = function (i) {
        $rootScope.currencyName = '';
        $rootScope.isBodyMask = true;
        $scope.i = i;
        $rootScope.$broadcast('sendtransfer', $scope.i)
    };
    $rootScope.$on('sendtransfer', function () {
        $scope.sent = userService.address;
        $rootScope.sendtransferinfo = true;
        $('#transferCtrl').modal('show');
    });
    $scope.calculateFee = function () {
        if ($scope.amount && Number($scope.amount) > 0) {
            let amount = parseFloat(($scope.amount * 100000000).toFixed(0));
            let fee = BtwJS.transaction.calculateFee(amount);
            $scope.fee = $filter('xasFilter')(fee);
        }
    };
    $scope.createTransaction = function () {
        let amount = parseFloat(($scope.amount * 100000000).toFixed(0));
        let message = $scope.message;
        if (!$rootScope.currencyName) {
            return BtwJS.transaction.createTransaction(String($scope.fromto), amount, message, userService.secret, $scope.secondPassword);
        } else {
            amount = ($scope.amount * Math.pow(10, $rootScope.precision)).toFixed(0);
            return BtwJS.uia.createTransfer(String($rootScope.currencyName), amount, String($scope.fromto), message, userService.secret, $scope.secondPassword)
        }
    };
    $scope.sentMsg = function () {
        if (!$scope.fromto) {
            appMain.Toaster($translate.instant('ERR_NO_RECIPIENT_ADDRESS'), 'Error', 'danger');
            return;
        }
        if ($scope.fromto === userService.address) {
            appMain.Toaster($translate.instant('ERR_RECIPIENT_EQUAL_SENDER'), 'Error', 'danger');
            return;
        }
        if (!$scope.amount || Number($scope.amount) <= 0) {
            appMain.Toaster($translate.instant('ERR_AMOUNT_INVALID'), 'Error', 'danger');
            return;
        }
        let amount = parseFloat(($scope.amount * 100000000).toFixed(0));
        let fee = 10000000;
        if (userService.secondPublicKey && !$scope.secondPassword) {
            appMain.Toaster($translate.instant('ERR_NO_SECND_PASSWORD'), 'Error', 'danger');
            return;
        }
        if (!userService.secondPublicKey) {
            $scope.secondPassword = '';
        }
        let message = $scope.message;
        if (message && message.length > 256) {
            appMain.Toaster($translate.instant('ERR_INVALID_REMARK'), 'Error', 'danger');
            return;
        }
        if (!$rootScope.currencyName) {
            if (amount + fee > userService.balance) {
                appMain.Toaster($translate.instant('ERR_BALANCE_NOT_ENOUGH'), 'Error', 'danger');
                return;
            }
        } else {
            amount = ($scope.amount * Math.pow(10, $rootScope.precision)).toFixed(0);
        }
        $scope.isSendSuccess = false;
        postSerivice.retryPost($scope.createTransaction, function (err, res) {
            $scope.isSendSuccess = true;
            if (err === null) {
                if (res.success === true) {
                    $scope.fromto = '';
                    $scope.amount = '';
                    $scope.secondPassword = '';
                    $scope.message = '';
                    $('#transferCtrl').modal('hide');
                    appMain.Toaster($translate.instant('INF_TRANSFER_SUCCESS'), 'Success', 'success');
                } else {
                    if (res.error.indexOf('Insufficient') > -1) {
                        appMain.Toaster($translate.instant('ERR_BALANCE_NOT_ENOUGH'), 'Error', 'danger');
                    } else if(res.error.indexOf('locked') > -1) {
                        appMain.Toaster($translate.instant('ALREADY_LOCKED'), 'Error', 'danger');
                    }
                }
            }
        })
    };
    $scope.resetSent = function () {
        $scope.isSendSuccess = true;
    }
});

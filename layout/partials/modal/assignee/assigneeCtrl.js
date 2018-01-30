angular.module('btw').controller('assigneeCtrl', function ($scope, $rootScope, apiService, ipCookie, $location, $http, userService, postSerivice, $translate) {
    $scope.userService = userService;
    $scope.createTransaction = function () {
        return BtwJS.delegate.createDelegate($scope.userName, userService.secret, $scope.secondpassword)
    };
    $scope.nextstep = function () {
        let reg = /^(?![0-9]+$)(?![a-zA-Z]+$)[0-9A-Za-z]{8,16}$/;
        let usernamereg = /^[a-z0-9!@$&_.]{2,}$/;
        let isAddress = /^[0-9]{1,21}$/g;
        if (!$scope.userName) {
            appMain.Toaster($translate.instant('ERR_DELEGATE_NAME_EMPTY'), 'Error', 'danger');
            return false;
        }
        if (isAddress.test($scope.userName)) {
            appMain.Toaster($translate.instant('ERR_DELEGATE_NAME_ADDRESS'), 'Error', 'danger');
            return false;
        }
        if (!usernamereg.test($scope.userName)) {
            appMain.Toaster($translate.instant('ERR_DELEGATE_NAME_FORMAT'), 'Error', 'danger');
            return false;
        }
        if (userService.secondPublicKey && !reg.test($scope.secondpassword)) {
            appMain.Toaster($translate.instant('ERR_SECOND_PASSWORD_FORMAT'), 'Error', 'danger');
            return false;
        }
        postSerivice.retryPost($scope.createTransaction, function (err, res) {
            if (err === null) {
                if (res.success === true) {
                    appMain.Toaster($translate.instant('INF_REGISTER_SUCCESS'), 'Success', 'success');
                    $scope.userName = '';
                    $('#assigneeCtrl').modal('hide');
                } else {
                    appMain.Toaster(res.error, 'Error', 'danger');
                }
            } else if (err === 'adjust') {
                appMain.Toaster($translate.instant('ADJUST_TIME_YOURSELF'), 'Error', 'danger');
            } else {
                appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
            }
        })
    };
});

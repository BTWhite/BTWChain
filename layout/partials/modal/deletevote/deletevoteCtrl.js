angular.module('btw').controller('deletevoteCtrl', function ($scope, $rootScope, apiService, ipCookie, $location, $http, userService, postSerivice, $translate) {
    $rootScope.deletevotetoinfo = false;
    $scope.userService = userService;
    $scope.createTransaction = function () {
        return BtwJS.vote.createVote($rootScope.deletevoteContent, userService.secret, $scope.secondpassword)
    };
    $scope.checkvoteto = function (params) {
        let reg = /^(?![0-9]+$)(?![a-zA-Z]+$)[0-9A-Za-z]{8,16}$/;
        if (userService.secondPublicKey && !reg.test($scope.secondpassword)) {
            appMain.Toaster($translate.instant('ERR_SECOND_PASSWORD_FORMAT'), 'Error', 'danger');
            return false;
        }
        postSerivice.retryPost($scope.createTransaction, function (err, res) {
            if (err === null) {
                if (res.success === true) {
                    $rootScope.coedobj = {};
                    $rootScope.checkobj = {};
                    $rootScope.$emit('downvoteSuccess');
                    $('#deletevoteCtrl').modal('hide');
                    appMain.Toaster($translate.instant('INF_DELETE_SUCCESS'), 'Success', 'success');
                }
            }
        })
    };
});

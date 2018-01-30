angular.module('btw').controller('votetoCtrl', function ($scope, $rootScope, apiService, ipCookie, $location, $http, userService, postSerivice, $translate) {
    $rootScope.votetoinfo = false;
    $scope.userService = userService;
    $scope.createTransaction = function() {
        return BtwJS.vote.createVote($rootScope.voteContent, userService.secret, $scope.secondpassword);
    };
    $scope.checkvoteto = function () {
        let reg = /^(?![0-9]+$)(?![a-zA-Z]+$)[0-9A-Za-z]{8,16}$/;
        if (userService.secondPublicKey && !reg.test($scope.secondpassword)) {
            appMain.Toaster($translate.instant('ERR_SECOND_PASSWORD_FORMAT'), 'Error', 'danger');
            return false;
        }
        postSerivice.retryPost($scope.createTransaction, function(err, res) {
            if (err === null) {
                if (res.success === true) {
                    $rootScope.checkobj = {};
                    $rootScope.coedobj = {};
                    $rootScope.$emit('upvoteSuccess');
                    $('#votetoCtrl').modal('hide');
                    appMain.Toaster($translate.instant('INF_VOTE_SUCCESS'), 'Success', 'success');
                }
            }
        })
    };
});

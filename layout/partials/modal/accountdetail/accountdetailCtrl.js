angular.module('btw').controller('accountdetailCtrl', function ($scope, $rootScope, apiService, ipCookie, $location, $translate) {
    $rootScope.accountdetailinfo = false;
    $rootScope.$on('accountdetail', function (d, data) {
        $scope.address = data;
        apiService.accountdetail({
            address: $scope.address
        }).success(function (res) {
            if (res.success === true) {
                $rootScope.accountdetailinfo = true;
                $scope.account = res.account;
                $('#accountdetailCtrl').modal('show');
            }
        }).error(function () {
            appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
        })
    });
});


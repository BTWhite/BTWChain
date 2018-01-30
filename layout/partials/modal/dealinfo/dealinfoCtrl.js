angular.module('btw').controller('dealinfoCtrl', function ($scope, $rootScope, apiService, ipCookie, $location, $translate) {
    $rootScope.dealdetailinfo = false;
    $rootScope.showdetailInfo = function (i) {
        $scope.accountdetailinfo = false;
        $scope.dealdetailinfo = false;
        $scope.i = i;
        $rootScope.$broadcast('detail', $scope.i)
    };
    $rootScope.showaccountdetailInfo = function (i) {
        $scope.blockdetailinfo = false;
        $scope.dealdetailinfo = false;
        $scope.i = i;
        $rootScope.$broadcast('accountdetail', $scope.i)
    };
    $rootScope.$on('jiaoyi', function (d, data) {
        if (typeof data === 'object') {
            $scope.blockId = data.id;
        } else {
            $scope.blockId = data;
        }
        if (!$scope.blockId) {
            return;
        }
        apiService.transactions({
            blockId: $scope.blockId
        }).success(function (res) {
            if (res.success === true) {
                $rootScope.dealdetailinfo = true;
                $rootScope.isBodyMask = true;
                $rootScope.blockdetailinfo = false;
                $rootScope.accountdetailinfo = false;
                $scope.transactions = res.transactions;
                $('#dealinfoCtrl').modal('show');
            }
        }).error(function () {
            appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
        })
    });
});

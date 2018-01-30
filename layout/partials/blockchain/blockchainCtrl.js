angular.module('btw').controller('blockchainCtrl', function ($scope, $rootScope, apiService, ipCookie, $location, $window, NgTableParams, $translate) {
    $rootScope.active = 'blockchain';
    $rootScope.userlogin = true;
    $rootScope.progress = true;
    $rootScope.table = false;

    $rootScope.showdealInfo = function (i) {
        $rootScope.blockdetailinfo = false;
        $rootScope.accountdetailinfo = false;
        $scope.i = i;
        $rootScope.$broadcast('jiaoyi', $scope.i)
    };
    $scope.searchres = false;
    $rootScope.showdetailInfo = function (i) {
        $rootScope.accountdetailinfo = false;
        $rootScope.dealdetailinfo = false;
        $scope.i = i;
        $rootScope.$broadcast('detail', $scope.i)
    };
    $rootScope.showaccountdetailInfo = function (i) {
        $rootScope.blockdetailinfo = false;
        $rootScope.dealdetailinfo = false;
        $scope.i = i;
        $rootScope.$broadcast('accountdetail', $scope.i)
    };
    $scope.init = function () {
        $scope.blockchaintableparams = new NgTableParams({
            page: 1,
            count: 20,
            sorting: {
                height: 'desc'
            }
        }, {
            total: 0,
            getData: function ($defer, params) {
                apiService.blocks({
                    limit: params.count(),
                    orderBy: 'height:desc',
                    offset: (params.page() - 1) * params.count()
                }).success(function (res) {
                    $rootScope.progress = false;
                    $rootScope.table = true;
                    params.total(res.count);
                    $defer.resolve(res.blocks);
                    appMain.PopovetInit();
                }).error(function (res) {
                    appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                });
            }
        });
    };

    $scope.searchBlock = function () {
        if (!$scope.search) {
            $scope.init();
        }
        apiService.blockDetail({
            height: $scope.search
        }).success(function (res) {
            $scope.blockchaintableparams = new NgTableParams({
                page: 1,
                count: 2
            }, {
                total: 1,
                data: [res.block]
            });
        });
    }
});

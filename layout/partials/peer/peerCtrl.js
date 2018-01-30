angular.module('btw').controller('peerCtrl', function ($scope, $rootScope, apiService, ipCookie, $location, $window, NgTableParams, $translate) {
    $rootScope.active = 'peer';
    $rootScope.userlogin = true;
    $rootScope.progress = true;
    $rootScope.table = false;
    $rootScope.showdealInfo = function (i) {
        $scope.i = i;
        $rootScope.$broadcast('jiaoyi', $scope.i)
    };
    $scope.init = function () {
        $scope.pertableparams = new NgTableParams({
            page: 1,
            count: 20,
            sorting: {
                height: 'desc'
            }
        }, {
            total: 0,
            counts: [],
            getData: function ($defer, params) {
                apiService.peer({
                    limit: params.count(),
                    offset: (params.page() - 1) * params.count()
                }).success(function (res) {
                    params.total(res.totalCount);
                    for (let i = 0; i < res.peers.length; ++i) {
                        res.peers[i].ip = res.peers[i].ip.replace(/^[0-9]+.[0-9]+/, '*.*');
                    }
                    $defer.resolve(res.peers);
                    $rootScope.progress = false;
                    $rootScope.table = true;
                }).error(function (res) {
                    appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                });
            }
        });
    };
});

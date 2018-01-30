angular.module('btw').controller('voteCtrl', function ($scope, $rootScope, apiService, ipCookie, $location, $window, NgTableParams, userService, $translate) {
    $rootScope.active = 'vote';
    $rootScope.userlogin = true;
    $scope.letin = true;
    $scope.hosting = false;
    $scope.mgvotecord = false;
    $rootScope.progress = true;
    $rootScope.table = false;
    $rootScope.hostinginfo = false;

    $rootScope.showaccountdetailInfo = function (i) {
        $rootScope.blockdetailinfo = false;
        $rootScope.dealdetailinfo = false;
        $scope.i = i;
        $rootScope.$broadcast('accountdetail', $scope.i)
    };
    $scope.letinchange = function () {
        $scope.letin = true;
        $scope.hosting = false;
        $scope.mgvotecord = false;
        $scope.tableparams = new NgTableParams({
            page: 1,
            count: 20,
            sorting: {
                height: 'desc'
            }
        }, {
            total: 0,
            counts: [],
            getData: function ($defer, params) {
                apiService.delegates({
                    address: userService.address,
                    orderBy: 'rate:asc',
                    limit: params.count(),
                    offset: (params.page() - 1) * params.count()
                }).success(function (res) {
                    params.total(res.totalCount);
                    $scope.delegateCount = res.totalCount;
                    $defer.resolve(res.delegates);
                }).error(function (res) {
                    appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                });
            }
        });
    };
    $scope.hostingchange = function () {
        $scope.letin = false;
        $scope.hosting = true;
        $scope.mgvotecord = false;
        $scope.tableparams3 = new NgTableParams({
            page: 1,
            count: 20,
            sorting: {
                height: 'desc'
            }
        }, {
            total: 0,
            counts: [],
            getData: function ($defer, params) {
                apiService.votetome({
                    publicKey: userService.publicKey,
                    orderBy: 'rate:asc',
                    limit: params.count(),
                    offset: (params.page() - 1) * params.count()
                }).success(function (res) {
                    $scope.totalVoter = res.accounts.length;
                    $defer.resolve(res.accounts);
                }).error(function (res) {
                    appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                });
            }
        });
    };
    $scope.mgvotecordchange = function () {
        $scope.letin = false;
        $scope.hosting = false;
        $scope.mgvotecord = true;
        $scope.tableparams2 = new NgTableParams({
            page: 1,
            count: 20,
            sorting: {
                height: 'desc'
            }
        }, {
            total: 0,
            counts: [],
            getData: function ($defer, params) {
                apiService.myvotes({
                    address: userService.address,
                    orderBy: 'rate:asc',
                    limit: params.count(),
                    offset: (params.page() - 1) * params.count()
                }).success(function (res) {
                    params.total(res.totalCount);
                    $scope.myvoteCount = res.delegates.length;
                    $defer.resolve(res.delegates);
                }).error(function (res) {
                    appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                });
            }
        });
    };
    if ($scope.letin) {
        $scope.tableparams = new NgTableParams({
            page: 1,
            count: 20,
            sorting: {
                height: 'desc'
            }
        }, {
            total: 0,
            counts: [],
            getData: function ($defer, params) {
                apiService.delegates({
                    address: userService.address,
                    orderBy: 'rate:asc',
                    limit: params.count(),
                    offset: (params.page() - 1) * params.count()
                }).success(function (res) {
                    $rootScope.progress = false;
                    $rootScope.table = true;
                    params.total(res.totalCount);
                    $scope.delegateCount = res.totalCount;
                    $defer.resolve(res.delegates);
                }).error(function (res) {
                    appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                });
            }
        });
    }
    $scope.checkitem = function (i) {
        if ($scope.letin) {
            let key = i.username;
            if (!$rootScope.checkobj[key]) {
                $rootScope.checkobj[key] = i;
            } else {
                delete $rootScope.checkobj[key];
            }
        }
    };
    $scope.checkitem2 = function (i) {
        if ($scope.mgvotecord) {
            let key = i.username;
            if (!$rootScope.coedobj[key]) {
                $rootScope.coedobj[key] = i;
            } else {
                delete $rootScope.coedobj[key];
            }
        }
    };
    $scope.votetoShowInfo = function () {
        if ($scope.mgvotecord) {
            let deletevoteContent = [];
            let showdelusername = {};
            angular.forEach($rootScope.coedobj, function (data, index, array) {
                deletevoteContent.push('-' + data.publicKey);
                showdelusername[data.username] = {
                    "username": data.username,
                    "address": data.address
                }
            });
            if (!deletevoteContent.length) {
                appMain.Toaster($translate.instant('ERR_AT_LEAST_SELECT_ONE_DELEGATE'), 'Error', 'danger');
            } else if (deletevoteContent.length > 33) {
                appMain.Toaster($translate.instant('ERR_NO_MORE_THAN_33'), 'Error', 'danger');
            } else {
                $('#deletevoteCtrl').modal('show');
                $rootScope.deletevotetoinfo = true;
                $rootScope.isBodyMask = true;
                $rootScope.showdelusername = showdelusername;
                $rootScope.deletevoteContent = deletevoteContent;
            }
        }
        if ($scope.letin) {
            let voteContent = [];
            let showusername = {};
            angular.forEach($rootScope.checkobj, function (data, index, array) {
                voteContent.push('+' + data.publicKey);
                showusername[data.username] = {
                    "username": data.username,
                    "address": data.address
                }
            });
            if (!voteContent.length) {
                appMain.Toaster($translate.instant('ERR_AT_LEAST_SELECT_ONE_DELEGATE'), 'Error', 'danger');
            } else if (voteContent.length > 33) {
                appMain.Toaster($translate.instant('ERR_VOTE_NO_MORE_THAN_33'), 'Error', 'danger');
            } else {
                $('#votetoCtrl').modal('show');
                $rootScope.votetoinfo = true;
                $rootScope.isBodyMask = true;
                $rootScope.showusername = showusername;
                $rootScope.voteContent = voteContent;
            }
        }
    };
    $rootScope.$on('upvoteSuccess', function () {
        if ($scope.tableparams) {
            $scope.tableparams.reload();
        }
    });
    $rootScope.$on('downvoteSuccess', function () {
        if ($scope.tableparams2) {
            $scope.tableparams2.reload();
        }
    });
});

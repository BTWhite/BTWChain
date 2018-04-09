angular.module('btw').controller('homeCtrl', function ($scope, $rootScope, $filter, apiService, $http, ipCookie, $location, $interval, NgTableParams, $window, userService, $translate) {
    $rootScope.active = 'home';
    $rootScope.userlogin = true;
    $rootScope.progress = true;
    $rootScope.info = false;
    $rootScope.table = false;
    $scope.searchStr = "";
    $scope.search = function() {
        console.log($scope.searchStr);
        let url = 'https://bitwhite.info';
        if($scope.searchStr.length > 60) {
            $window.open(url + '/tx/' + $scope.searchStr);
        } else $window.open(url + '/address/' + $scope.searchStr);
    };
    $scope.acceptShowInfo = function (i) {
        $rootScope.acceptinfo = true;
        $rootScope.isBodyMask = true;
    };
    $scope.init = function (params) {
        apiService.account({
            address: userService.address
        }).success(function (res) {
            if (res.success === true) {
                $rootScope.account = res.account;
                $scope.latestBlock = res.latestBlock;
                $scope.version = res.version;
                userService.update(res.account, res.latestBlock);
                $rootScope.balance = userService.balance;
                $rootScope.username = userService.username;
                console.log(userService);
                $scope.userService = userService;
                jiaoyi(userService.address, userService.publicKey);
            }
        }).error(function (res) {
            appMain.Toaster(res.error, 'Error', 'danger');
        });
    };
    function jiaoyi(recipientId, senderPublicKey) {
		$scope.hometableparams = new NgTableParams({
			page: 1,
			count: 15,
			sorting: {
				height: 'desc'
			}
		}, {
				total: 0,
				counts: [],
				getData: function ($defer, params) {
					apiService.transactions({
						recipientId: recipientId,
						senderPublicKey: userService.publicKey,
						orderBy: 't_timestamp:desc',
						limit: params.count(),
						offset: (params.page() - 1) * params.count()
					}).success(function (res) {
						if (res.success === true) {
                            $rootScope.progress = false;
							params.total(res.count);
							$defer.resolve(res.transactions);
							if (!res.count) {
                                $rootScope.info = true;
                                $rootScope.table = false;
                            } else {
                                $rootScope.info = false;
                                $rootScope.table = true;
                                appMain.PopovetInit();
                                let DataChar = [], LabelChar = [];
                                $.each(res.transactions, function (k, i) {
                                    let FullDate = BtwJS.utils.format.fullTimestamp(i.timestamp);
                                    let str = FullDate.split(' ');
                                    let amount = $filter('xasFilter')(i.amount);
                                    DataChar.push(amount);
                                    LabelChar.push(str[0]);
                                });
                                DataChar.reverse();
                                LabelChar.reverse();
                                appMain.CharTransfer(DataChar, LabelChar);
                            }
						} else {
                            appMain.Toaster(res.error, 'Error', 'danger');
						}
                }).error(function (res) {
                    appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                });
            }
        });
    }
});

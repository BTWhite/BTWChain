angular.module('btw').controller('applicationCtrl', function ($scope, $rootScope, apiService, ipCookie, $location, $window, NgTableParams, userService, $translate, postSerivice) {
    $rootScope.active = 'application';
    $rootScope.userlogin = true;
    $scope.newapplication = true;
    $scope.installed = false;
    $scope.isShowBalance = false;
    $scope.precisionMap = {};
    $scope.init = function (params) {
        apiService.account({
            address: userService.address
        }).success(function (res) {
            if (res.success === true) {
                userService.update(res.account, res.latestBlock);
                $scope.userService = userService;
            }
        }).error(function (res) {
            appMain.Toaster(res.error, 'Error', 'danger');
        });
        apiService.uiaAssetListApi().success(function (assetsRes) {
            const assets = assetsRes.assets;
            let i;
            if (!assets) {
                $scope.currencys = [{key: '0', value: 'BTW'}];
                return;
            } else {
                for (i = 0; i < assetsRes.assets.length; i++) {
                    $scope.precisionMap[assetsRes.assets[i].name] = assetsRes.assets[i].precision;
                }
            }
            let uiaAssets = [];
            for (i = 0; i < assets.length; i++) {
                uiaAssets.push({
                    key: i + 1 + '',
                    value: assets[i].name
                })
            }
            $scope.currencys = [{key: '0', value: 'BTW'}].concat(uiaAssets)
        }).error(function (res) {
            appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
        })
    };
    $scope.newapplicationchange = function () {
        $scope.newapplication = true;
        $scope.installed = false;
        $scope.applist = new NgTableParams({
            page: 1,
            count: 20,
            sorting: {
                height: 'desc'
            }
        }, {
            total: 0,
            counts: [],
            getData: function ($defer, params) {
                apiService.appList({
                    limit: params.count(),
                    offset: (params.page() - 1) * params.count()
                }).success(function (res) {
                    params.total(res.count);
                    $defer.resolve(res.dapps);
                }).error(function (res) {
                    appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                });
            }
        });
    };
    $scope.newapplicationchange();
    $scope.installedchange = function () {
        $scope.newapplication = false;
        $scope.installed = true;
        $scope.appinstalled = new NgTableParams({
            page: 1,
            count: 20
        }, {
            total: 0,
            counts: [],
            getData: function ($defer) {
                apiService.appInstalled({}).success(function (res) {
                    $defer.resolve(res.dapps);
                }).error(function (res) {
                    appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                });
            }
        });
    };
    $scope.depositDapp = function (dapp) {
        $scope.depositedDapp = dapp;
    };
    $scope.showBalance = function (dapp) {
        apiService.appBalance({
            appId: dapp.transactionId
        }).success(function (balancesRes) {
            if (!balancesRes.balances) {
                $scope.showBalances = balancesRes.balances;
                return;
            }
            for (let i = 0; i < balancesRes.balances.length; i++) {
                let balance = balancesRes.balances[i];
                if (balance.currency === 'BTW') {
                    balance.quantityShow = 100000000;
                }
            }
            $scope.showBalances = balancesRes.balances;
            let tableHeight = $scope.showBalances.length > 4 ? 370 : ($scope.showBalances.length + 1) * 70 + 20;
            $scope.tableStyle = {
                height: tableHeight + 'px',
                top: 'calc(50% - ' + tableHeight / 2 + 'px)'
            };
            if ($scope.showBalances.length > 4) {
                $scope.tableStyle['overflow-y'] = 'scroll';
            }
            $scope.isShowBalance = true;
        }).error(function (res) {
            appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
        })
    };
    $scope.closeShowBalance = function () {
        $scope.isShowBalance = false;
        $scope.showBalances = [];
        console.log($scope.showBalances);
    };
    $scope.closeDeposit = function () {
        $scope.depositedDapp = null;
        $scope.amount = 0;
        $scope.secondPassword = '';
    };
    // Remake create
    $scope.createTransaction = function () {
        if ($scope.currency.value === 'BTW') {
            let amount = parseFloat(($scope.amount * 100000000).toFixed(0));
            return BtwJS.transfer.createInTransfer($scope.depositedDapp.transactionId, $scope.currency.value, amount, userService.secret, $scope.secondPassword);
        } else {
            let precisionSpecial = $scope.precisionMap[$scope.currency.value];
            let amount = parseFloat(($scope.amount * (Math.pow( 10, precisionSpecial))).toFixed(0));
            return BtwJS.transfer.createInTransfer($scope.depositedDapp.transactionId, $scope.currency.value, amount, userService.secret, $scope.secondPassword);
        }
    };
    $scope.sentMsg = function () {
        let transaction;
        if (!$scope.depositedDapp) {
            appMain.Toaster($translate.instant('ERR_NO_RECIPIENT_ADDRESS'), 'Error', 'danger');
            return false;
        }
        if ($scope.depositedDapp.transactionId === userService.address) {
            appMain.Toaster($translate.instant('ERR_RECIPIENT_EQUAL_SENDER'), 'Error', 'danger');
            return false;
        }
        if (!$scope.amount || Number($scope.amount) <= 0) {
            appMain.Toaster($translate.instant('ERR_AMOUNT_INVALID'), 'Error', 'danger');
            return false;
        }
        if ($scope.currency.value === 'BTW') {
            let amount = parseFloat(($scope.amount * 100000000).toFixed(0));
            let fee = 10000000;
            if (amount + fee > userService.balance) {
                appMain.Toaster($translate.instant('ERR_BALANCE_NOT_ENOUGH'), 'Error', 'danger');
                return false;
            }
        }
        if (userService.secondPublicKey && !$scope.secondPassword) {
            appMain.Toaster($translate.instant('ERR_NO_SECND_PASSWORD'), 'Error', 'danger');
            return false;
        }
        if (!$scope.currency || !$scope.currency.value) {
            appMain.Toaster($translate.instant('ERR_NO_DEPOSIT_COIN'), 'Error', 'danger');
            return false
        }
        if (!userService.secondPublicKey) {
            $scope.secondPassword = '';
        }
        postSerivice.retryPost($scope.createTransaction, function (err, res) {
            if (err === null) {
                if (res.success === true) {
                    $scope.amount = '';
                    $scope.secondPassword = '';
                    $scope.depositedDapp = null;
                    appMain.Toaster($translate.instant('DEPOSIT_SUCCESS'), 'Success', 'success');
                } else if (res.error.indexOf('Old address') !== -1 || res.error.indexOf('old address') !== -1 || res.error.indexOf('Old address') !== -1 || res.error.indexOf('Digital address') !== -1) {
                    appMain.Toaster('dapp does not support old address (numeric address), please use the latest letter address (base58 format)', 'Error', 'danger');
                }
            }
        })
    }
});

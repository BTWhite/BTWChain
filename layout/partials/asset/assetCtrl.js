angular.module('btw').controller('assetCtrl', function ($scope, $rootScope, apiService, ipCookie, $location, $window, NgTableParams, userService, postSerivice, $translate, $uibModal) {
    $rootScope.active = 'asset';
    $rootScope.userlogin = true;
    $rootScope.isBodyMask = false;
    $scope.comfirmDialog = false;
    $rootScope.secpwd = userService.secondPublicKey;
    $scope.init = function () {
        checkTab();
        apiService.issuer({
            address: userService.address
        }).success(function (res) {
            if (res.success === true) {
                $scope.monname = res.issuer.name;
                $scope.mondesc = res.issuer.desc;
                userService.isStatus(true);
                userService.isName(res.issuer.name);
                $scope.issuerStatus = userService.issuerStatus;

            } else {
                userService.isStatus(false);
                $scope.issuerStatus = userService.issuerStatus;

            }
        }).error(function (res) {
            appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
        })
    };
    $scope.assetprofile = true;
    $scope.registerpublish = false;
    $scope.registerasset = false;
    $scope.myAssets = false;
    $scope.operationRecord = false;
    $scope.allowValueRange = [
        {key: '0', value: $translate.instant('NOT_ALLOW')},
        {key: '1', value: $translate.instant('ALLOW')}
    ];
    function checkTab() {
        switch (userService.tab) {
            case 1:
                $scope.assetprofilechange();
                break;
            case 2:
                $scope.registerpublishchange();
                break;
            case 3:
                $scope.registerAssetchange();
                break;
            case 4:
                $scope.myAssetschange();
                break;
            case 5:
                $scope.operationRecordchange();
                break;
            default:
                $scope.assetprofilechange();
        }
    }

    // Asset Overview
    $scope.assetprofilechange = function () {
        $scope.assetprofile = true;
        $scope.registerpublish = false;
        $scope.registerasset = false;
        $scope.myAssets = false;
        $scope.operationRecord = false;
        userService.saveTab(1);
        if ($scope.assetprofiletableparams) {
            $scope.assetprofiletableparams.reload();
        } else {
            $scope.assetprofiletableparams = new NgTableParams({
                page: 1,
                count: 20,
                sorting: {
                    height: 'desc'
                }
            }, {
                total: 0,
                getData: function ($defer, params) {
                    apiService.myBalances({
                        limit: params.count(),
                        offset: (params.page() - 1) * params.count(),
                        address: userService.address
                    }).success(function (res) {
                        params.total(res.count);
                        $defer.resolve(res.balances);
                    }).error(function (res) {
                        appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                    });
                }
            });
        }
    };
    $scope.registerpublishchange = function () {
        $scope.registerpublish = true;
        $scope.assetprofile = false;
        $scope.registerasset = false;
        $scope.myAssets = false;
        $scope.operationRecord = false;
        userService.saveTab(2);
    };
    $scope.registerPublish = function () {
        if (userService.issuerStatus) {
            appMain.Toaster('You have registered the publisher', 'Error', 'danger');
            return false;
        }
        let name = $scope.monname;
        let desc = $scope.mondesc;
        if (!$scope.monname || !$scope.mondesc) {
            appMain.Toaster('You must enter the publisher name and description', 'Error', 'danger');
            return false;
        }

        if (!userService.secondPublicKey) {
            $scope.rpsecondPassword = '';
        }
        $scope.publishtrs = BtwJS.uia.createIssuer(name, desc, userService.secret, $scope.rpsecondPassword);
        $scope.comfirmDialog = true;
        $scope.dialogNUM = 1;
        $rootScope.isBodyMask = true;
    };
    //Registered assets
    $scope.registerAssetchange = function () {
        $scope.assetprofile = false;
        $scope.registerpublish = false;
        $scope.registerasset = true;
        $scope.myAssets = false;
        $scope.operationRecord = false;
        userService.saveTab(3);
    };
    //Registered assets
    $scope.registerAsset = function () {
        if (!userService.issuerStatus) {
            appMain.Toaster('You have not registered a publisher yet', 'Error', 'danger');
            return false;
        }
        let reg = /^[A-Z]{3,6}$/;
        if (!reg.test($scope.publishName)) {
            appMain.Toaster('Please enter 3-6 capital letters', 'Error', 'danger');
            return false;
        }
        let name = $scope.monname + '.' + $scope.publishName;
        let desc = $scope.publishDesc;
        let maximum = $scope.topLimt;
        let precision = Number($scope.precision);
        let strategy = $scope.strategy;
        if (!desc) {
            appMain.Toaster('Please enter an asset description', 'Error', 'danger');
            return false;
        }
        if (!parseInt(maximum)) {
            appMain.Toaster('The typ rate you entered is incorrect', 'Error', 'danger');
            return false;
        }
        if (!precision || precision < 0 || precision > 16) {
            appMain.Toaster('The asset you entered is not accurate', 'Error', 'danger');
            return false;
        }
        if (String($scope.precision).indexOf('.') !== -1) {
            appMain.Toaster('The precision must be an integer from 0 to 16', 'Error', 'danger');
            return false;
        }
        if (!userService.secondPublicKey) {
            $scope.rasecondPassword = '';
        }
        let realMaximum = parseInt(maximum) * Math.pow(10, precision);
        let allowWriteoff = $scope.selectedAllowWriteoff ? Number($scope.selectedAllowWriteoff.key) : 0;
        let allowWhitelist = $scope.selectedAllowWhitelist ? Number($scope.selectedAllowWhitelist.key) : 0;
        let allowBlacklist = $scope.selectedAllowBlacklist ? Number($scope.selectedAllowBlacklist.key) : 0;
        $scope.assetTrs = BtwJS.uia.createAsset(String(name), String(desc), String(realMaximum), precision, strategy, allowWriteoff, allowWhitelist, allowBlacklist, userService.secret, $scope.rasecondPassword);
        $scope.dialogNUM = 2;
        $scope.comfirmDialog = true;
        $rootScope.isBodyMask = true;
    };
    $scope.myAssetschange = function () {
        $scope.assetprofile = false;
        $scope.registerpublish = false;
        $scope.registerasset = false;
        $scope.myAssets = true;
        $scope.operationRecord = false;
        userService.saveTab(4);
        if ($scope.myAss) {
            $scope.myAss.reload();
        } else {
            $scope.myAss = new NgTableParams({
                page: 1,
                count: 10
            }, {
                total: 0,
                page: 1,
                count: 20,
                counts: [],
                getData: function ($defer, params) {
                    apiService.myAssets({
                        name: userService.name,
                        limit: params.count(),
                        offset: (params.page() - 1) * params.count()
                    }).success(function (res) {
                        params.total(res.count);
                        $defer.resolve(res.assets);
                    }).error(function (res) {
                        appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                    });
                }
            });
        }

    };
    $scope.operationRecordchange = function () {
        $scope.assetprofile = false;
        $scope.registerpublish = false;
        $scope.registerasset = false;
        $scope.myAssets = false;
        $scope.operationRecord = true;
        userService.saveTab(5);
        if ($scope.operationRecordparams) {
            $scope.operationRecordparams.reload()
        } else {
            $scope.operationRecordparams = new NgTableParams({
                page: 1,
                count: 20
            }, {
                total: 0,
                counts: [],
                getData: function ($defer, params) {
                    apiService.myAssetTransactions({
                        address: userService.address,
                        orderBy: 't_timestamp:desc',
                        limit: params.count(),
                        offset: (params.page() - 1) * params.count()
                    }).success(function (res) {
                        params.total(res.count);
                        $defer.resolve(res.transactions);
                    }).error(function (res) {
                        appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                    });
                }
            });
        }
    };
    $scope.dealBigNumber = function(num) {
        let dealNumB = new BigNumber(num);
        let dealNum = (dealNumB.toFormat(0)).toString();
        return dealNum.replace(/,/g, '');
    };
    $scope.myWriteOff = function (i) {
        $scope.moneyName = i.name;
        $rootScope.isBodyMask = true;
        $scope.myAss.writeoff = true;
    };
    $scope.writeoff_submit = function () {
        let currency = $scope.moneyName;
        let flagType = 2;
        let flag = 1;
        if (!userService.secondPublicKey) {
            $scope.wosecondPassword = '';
        }
        let transaction = BtwJS.uia.createFlags(currency, flagType, flag, userService.secret, $scope.wosecondPassword);
        postSerivice.writeoff(transaction).success(function (res) {
            if (res.success === true) {
                $scope.wosecondPassword = '';
                $scope.myAss.writeoff = false;
                $rootScope.isBodyMask = false;
                appMain.Toaster($translate.instant('INF_OPERATION_SUCCEEDED'), 'Success', 'success');
            } else {
                appMain.Toaster(res.error, 'Error', 'danger');
            }
        }).error(function (res) {
            appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
        });
    };
    $scope.writeoffClose = function () {
        $rootScope.isBodyMask = false;
        $scope.myAss.writeoff = false;
    };
    $scope.myPublish = function (i) {
        $scope.myAss.publish = true;
        $scope.myPublishmoneyName = i.name;
        $scope.currentAsset = i;
        $rootScope.isBodyMask = true;
    };
    $scope.publish_submit = function () {
        $scope.myAss.publish = false;
        $rootScope.isBodyMask = false;
        if (!$scope.myPublishmoneyName) {
            return;
        }
        if (!$scope.amount) {
            appMain.Toaster('You must enter the issue amount', 'Error', 'danger');
            return false;
        }
        if (!parseInt($scope.amount)) {
            appMain.Toaster('The amount you entered is incorrect', 'Error', 'danger');
            return false;
        }
        let realAmount = $scope.dealBigNumber(parseInt($scope.amount) * Math.pow(10, $scope.currentAsset.precision));
        let trs = BtwJS.uia.createIssue($scope.myPublishmoneyName, String(realAmount), userService.secret, $scope.pbsecondPassword);
        postSerivice.writeoff(trs).success(function (res) {
            if (res.success === true) {
                $scope.pbsecondPassword = '';
                $scope.myAss.publish = false;
                $rootScope.isBodyMask = false;
                appMain.Toaster($translate.instant('INF_OPERATION_SUCCEEDED'), 'Success', 'success');
            } else {
                appMain.Toaster(res.error, 'Error', 'danger');
            }
        }).error(function (res) {
            appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
        });
    };
    $scope.publishClose = function () {
        $rootScope.isBodyMask = false;
        $scope.myAss.publish = false;
    };
    $scope.models = [
        {value: 0, name: 'Blacklist mode'},
        {value: 1, name: 'White list mode'}
    ];
    $scope.mymodel = $scope.models[1];
    $scope.mySettings = function (i) {
        $scope.moneyName = i.name;
        if (i.acl === 0) {
            $scope.acl = 1;
        } else if (i.acl === 1) {
            $scope.acl = 0;
        }

        $scope.myAss.set = true;
        $rootScope.isBodyMask = true;
    };
    $scope.settings_submit = function () {
        $scope.myAss.set = false;
        $rootScope.isBodyMask = false;
        let currency = $scope.moneyName;
        let flagType = 1;
        let flag = $scope.acl;
        if (!userService.secondPublicKey) {
            $scope.setsecondPassword = '';
        }
        let trs = BtwJS.uia.createFlags(currency, flagType, flag, userService.secret, $scope.setsecondPassword);
        postSerivice.writeoff(trs).success(function (res) {
            if (res.success === true) {
                $scope.setsecondPassword = '';
                $scope.myAss.set = false;
                $rootScope.isBodyMask = false;
                appMain.Toaster($translate.instant('INF_OPERATION_SUCCEEDED'), 'Success', 'success');
            } else {
                appMain.Toaster(res.error, 'Error', 'danger');
            }
        }).error(function (res) {
            appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
        });
    };
    $scope.settingsClose = function () {
        $rootScope.isBodyMask = false;
        $scope.myAss.set = false;
    };
    $scope.comfirmDialogClose = function () {
        $rootScope.isBodyMask = false;
        $scope.comfirmDialog = false;
    };
    $scope.comfirmSub = function () {
        let trs;
        if ($scope.dialogNUM === 1) {
            trs = $scope.publishtrs;

        } else if ($scope.dialogNUM === 2) {
            trs = $scope.assetTrs;
        }
        postSerivice.post(trs).success(function (res) {
            if (res.success === true) {
                if ($scope.dialogNUM === 1) {
                    $scope.monname = '';
                    $scope.mondesc = '';
                    $scope.rpsecondPassword = '';
                    userService.isName($scope.monname);
                } else if ($scope.dialogNUM === 2) {
                    $scope.publishName = '';
                    $scope.publishDesc = '';
                    $scope.topLimt = '';
                    $scope.precision = '';
                    $scope.strategy = '';
                    $scope.rasecondPassword = '';
                }
                appMain.Toaster($translate.instant('INF_OPERATION_SUCCEEDED'), 'Success', 'success');
                $scope.comfirmDialogClose();
            } else {
                appMain.Toaster(res.error, 'Error', 'danger');
            }
        }).error(function (res) {
            appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
        });
    };

    $scope.myAddPlus = function (i) {

        $rootScope.addACL = i;
        $location.path('/add-acl');
    };
    $scope.myreduceACL = function (i) {
        $rootScope.reduceACL = i;
        $location.path('/reduce-acl');
    };
    $scope.transferView = function (i, num) {
        let data;
        if (num === 1) {
            data = i.currency;
        } else if (num === 2) {
            data = i.name;
        }
        $rootScope.currencyName = data;
        $rootScope.precision = i.precision;
        $location.path('/pay');
    };


});

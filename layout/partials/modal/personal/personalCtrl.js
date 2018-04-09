angular.module('btw').controller('personalCtrl', function ($scope, $rootScope, apiService, ipCookie, $window, $http, userService, postSerivice, $translate) {
    $rootScope.userlogin = true;
    $scope.lockStatus = '';
    $scope.lockHeight = '';
    $scope.accountInfo = true;
    $scope.passwordInfo = false;
    $scope.positionInfo = false;
    $scope.timeLeft = '';
    $scope.qrcode = false;
    $scope.qrcode_address = false;
    $scope.string = $rootScope.qrcode;
    $scope.string_address = userService.address;

    $rootScope.personalinfo = false;
    $rootScope.showpersonalinfo = function (i) {
        $rootScope.isBodyMask = true;
        $scope.i = i;
        $rootScope.$broadcast('personal', $scope.i)
    };
    $rootScope.$on('personal', function (param) {
        apiService.account({
            address: userService.address
        }).success(function (res) {
            if (res.success === true) {
                $rootScope.personalinfo = true;
                $scope.account = res.account;
                $scope.latestBlock = res.latestBlock;
                $scope.version = res.version;
                userService.update(res.account, res.latestBlock);
                $scope.userService = userService;
                $scope.string = $rootScope.qrcode;
                $scope.string_address = userService.address;
                $scope.positionLockStatus();
                $scope.isLocksure = userService.latestBlockHeight <= userService.lockHeight;
                $('#personalCtrl').modal('show');
            }
        }).error(function (res) {
            appMain.Toaster(res.error, 'Error', 'danger');
        });
    });
    $scope.accountchange = function () {
        $scope.accountInfo = true;
        $scope.positionInfo = $scope.passwordInfo = !$scope.accountInfo;
    };
    $scope.passwordchange = function () {
        $scope.passwordInfo = true;
        $scope.accountInfo = $scope.positionInfo = !$scope.passwordInfo;
    };
    $scope.positionchange = function () {
        $scope.positionInfo = true;
        $scope.accountInfo = $scope.passwordInfo = !$scope.positionInfo;
    };
    $scope.setStatus = function () {
        let label = userService.secondPublicKey ? 'ALREADY_SET' : 'NOT_SET';
        return $translate.instant(label);
    };
    $scope.positionLockStatus = function () {
        if (userService.lockHeight !== 0) {
            let a = $translate.instant('FRAGIL_PRE');
            let b = $translate.instant('FRAGIL_LAT');
            if (Number(userService.lockHeight) > Number(userService.latestBlockHeight)) {
                return $scope.lockStatus = a + userService.lockHeight + b;
            } else {
                return $scope.lockStatus = $translate.instant('NOT_SET_ALREADYUNBLOCK');
            }
        } else {
            return $scope.lockStatus = $translate.instant('NOT_SET_BLOCKHEIGHT');
        }
    };
    $scope.showQrcode = function() {
        $rootScope.isBodyMaskWhite = true;
        $scope.qrcode = true;
    };
    $scope.showQrcode_address = function() {
        $rootScope.isBodyMaskWhite = true;
        $scope.qrcode_address = true;
    };
    $scope.Close = function () {
        $rootScope.isBodyMaskWhite = false;
        $scope.qrcode = false;
        $scope.qrcode_address = false;
    };
    $scope.isLock = function () {
        return Number(userService.lockHeight) > Number(userService.latestBlockHeight);
    };
    $scope.userService = userService;
    $scope.createTrsPsd = function() {
        return BtwJS.signature.createSignature(userService.secret, $scope.secondpassword);
    };
    $scope.createTrsLok = function() {
        let lockHeight = Number($scope.block_number);
        return BtwJS.transaction.createLock(lockHeight, userService.secret, $scope.secondpassword);
    };
    $scope.setPassWord = function () {
        let reg = /^(?![0-9]+$)(?![a-zA-Z]+$)[0-9A-Za-z]{8,16}$/;
        if (!$scope.secondpassword || !$scope.confirmPassword) {
            appMain.Toaster($translate.instant('ERR_NO_SECND_PASSWORD'), 'Error', 'danger');
            return;
        }
        let secondPwd = $scope.secondpassword.trim();
        let confirmPwd = $scope.confirmPassword.trim();
        if (secondPwd !== confirmPwd) {
            appMain.Toaster($translate.instant('ERR_TWO_INPUTS_NOT_EQUAL'), 'Error', 'danger');
        } else if (!reg.test(secondPwd)) {
            appMain.Toaster($translate.instant('ERR_PASSWORD_INVALID_FORMAT'), 'Error', 'danger');
        } else if (reg.test(secondPwd) && reg.test(confirmPwd) && secondPwd === confirmPwd) {
            postSerivice.retryPost($scope.createTrsPsd, function(err, res) {
                if (err === null) {
                    if (res.success === true) {
                        $scope.passwordsure = true;
                        appMain.Toaster($translate.instant('INF_SECND_PASSWORD_SET_SUCCESS'), 'Succes', 'succes');
                    } else {
                        appMain.Toaster(res.error, 'Error', 'danger');
                    }
                }
            })
        }
    };
    $scope.setPositionLock = function () {
        if (!$scope.block_number) {
            appMain.Toaster($translate.instant('ERR_POSITIONLOCK_EMPTY'), 'Error', 'danger');
            return;
        }

        let lockHeight = Number($scope.block_number);
        let diffHeight = lockHeight - userService.latestBlockHeight;

        if (diffHeight <= 0 || diffHeight >= 10000000) {
            appMain.Toaster('Invalid lock height', 'Error', 'danger');
            return;
        }

        if (userService.secondPublicKey && !$scope.secondpassword) {
            appMain.Toaster($translate.instant('ERR_NO_SECND_PASSWORD'), 'Error', 'danger');
            return;
        }

        if (!userService.secondPublicKey) {
            $scope.secondPassword = '';
        }

        postSerivice.retryPost($scope.createTrsLok, function(err, res) {
            if (err === null) {
                if (res.success === true) {
                    appMain.Toaster($translate.instant('INF_POSITIONLOCK_SET_SUCCESS'), 'Succes', 'succes');
                    $scope.positionLockStatus();
                    $scope.isLocksure = true;
                }
            }
        })
    };
    $scope.calTimeLeft = function () {
        if (!$scope.block_number) return;
        let lockHeight = Number($scope.block_number);
        let diffHeight = lockHeight - userService.latestBlockHeight;
        let sec = diffHeight * 10;
        let min = 0;
        let hou = 0;
        let day = 0;
        let ab = $translate.instant('FRAGIL_ABOUT');
        let d = $translate.instant('FRAGIL_DAY');
        let h = $translate.instant('FRAGIL_HOUR');
        let m = $translate.instant('FRAGIL_MIN');
        let r = $translate.instant('FRAGIL_RANGE');
        let u = $translate.instant('FRAGIL_UNLOCK');
        if (diffHeight > 0 && diffHeight < 10000000) {
            if (sec > 60) {
                min = sec / 60;
                sec = sec % 60;
                if (min > 60) {
                    hou = min / 60;
                    min = min % 60;
                    if (hou > 24) {
                        day = hou / 24;
                        hou = hou % 24;
                    }
                }
            }
            $scope.timeLeft = ab + parseInt(day) + d + parseInt(hou) + h + parseInt(min) + m + parseInt(sec) + u;
        } else {
            $scope.timeLeft = r;
        }
    };
});


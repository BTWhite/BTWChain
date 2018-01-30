angular.module('btw').controller('loginCtrl', function ($scope, $rootScope, apiService, ipCookie, $window, $location, userService, $translate) {
    $rootScope.userlogin = false;
    $rootScope.register = true;
    $rootScope.creatpwd = false;
    $rootScope.checkpwd = false;
    $rootScope.homedata = {};
    $rootScope.qrcode = undefined;
    $rootScope.secret = '';
    $rootScope.newpublicKey = '';
    $scope.confirmCheckbox = false;
    $scope.secret = localStorage.getItem("lastsecret");
    $scope.txtDownloaded = false;
    $scope.languages = [
        {key: 'en-us', value: 'English'}
    ];
    $scope.changeLanguage = function () {
        if (!$scope.selectedLanguage) {
            let key = $translate.proposedLanguage();
            for (let i = 0; i < $scope.languages.length; ++i) {
                if ($scope.languages[i].key === key) {
                    $scope.selectedLanguage = $scope.languages[i];
                    break;
                }
            }
        }
        $translate.use($scope.selectedLanguage.key);
        $scope.languageIcon = '/assets/common/' + $scope.selectedLanguage.key + '.png';
    };
    $scope.changeLanguage();
    $scope.init = function (params) {
        if ($scope.secret) {
            $rootScope.qrcode = $scope.secret;
            $rootScope.secret = $scope.secret;
            if (!Mnemonic.isValid($scope.secret)) {
                return false;
            }
            let publicKey = BtwJS.crypto.getKeys($scope.secret).publicKey;
            $rootScope.qrstr = $scope.secret;
            $rootScope.publickey = publicKey;
            apiService.login({
                publicKey: publicKey
            }).success(function (res) {
                $rootScope.homedata = res;
                if (res.success === true) {
                    userService.setData($scope.secret, publicKey, res.account, res.latestBlock);
                    $rootScope.isLogin = true;
                    $location.path('/home');
                }
            });
        }
    };
    $scope.newuser = function () {
        $rootScope.register = false;
        $rootScope.creatpwd = true;
        $rootScope.checkpwd = false;
        let code = new Mnemonic(Mnemonic.Words.ENGLISH);
        $scope.newsecret = code.toString();
        $rootScope.newpublicKey = BtwJS.crypto.getKeys($scope.newsecret).publicKey
    };
    $scope.saveLogin = true;
    $scope.backto = function () {
        $rootScope.register = true;
        $rootScope.creatpwd = false;
        $rootScope.checkpwd = false;
    };
    $scope.close = function () {
        $rootScope.register = true;
        $rootScope.creatpwd = false;
        $rootScope.checkpwd = false;
    };
    $scope.lastcheck = function () {
        if (!$scope.confirmCheckbox) {
            appMain.Toaster('You must confirm checkbox', 'Info', 'info');
            return false;
        }
        if ($scope.newsecret === $scope.lastsecret) {
            $rootScope.qrcode = $scope.newsecret;
            apiService.login({
                publicKey: $rootScope.newpublicKey
            }).success(function (res) {
                $rootScope.homedata = res;
                if (res.success === true) {
                    $rootScope.secret = $scope.newsecret;
                    userService.setData($scope.newsecret, $rootScope.newpublicKey, res.account, res.latestBlock);
                    $rootScope.isLogin = true;
                    $location.path('/home');
                }
            }).error(function (res) {
                appMain.Toaster(res.error, 'Error', 'danger');
            });
        } else {
            appMain.Toaster($translate.instant('ERR_PASSWORD_NOT_EQUAL'), 'Error', 'danger');
        }
    };
    $scope.saveTxt = function (filename) {
        let text = $scope.newsecret.trim();
        let address = BtwJS.crypto.getAddress($rootScope.newpublicKey);
        let link = document.createElement("a");
        link.setAttribute("target", "_blank");
        if (Blob !== undefined) {
            let blob = new Blob([text], {type: "text/plain"});
            link.setAttribute("href", URL.createObjectURL(blob));
        } else {
            link.setAttribute("href", "data:text/plain," + encodeURIComponent(text));
        }
        link.setAttribute("download", filename + ".txt");
        $scope.txtDownloaded = true;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    $scope.registerin = function () {
        if (!$scope.secret) {
            appMain.Toaster($translate.instant('ERR_INPUT_PASSWORD'), 'Error', 'danger');
            return false;
        }
        $rootScope.qrcode = $scope.secret;
        $rootScope.secret = $scope.secret;
        if (!Mnemonic.isValid($scope.secret)) {
            appMain.Toaster($translate.instant('ERR_VIOLATE_BIP39'), 'Error', 'danger');
            return false;
        }
        let publicKey = BtwJS.crypto.getKeys($scope.secret).publicKey;
        $rootScope.qrstr = $scope.secret;
        $rootScope.publickey = publicKey;
        apiService.login({
            publicKey: publicKey
        }).success(function (res) {
            $rootScope.homedata = res;
            if (res.success === true) {
                localStorage.setItem("lastsecret", $scope.secret);
                userService.setData($scope.secret, publicKey, res.account, res.latestBlock);
                $rootScope.isLogin = true;
                $location.path('/home');
            } else {
                appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
            }
        }).error(function (res) {
            appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
        })
    };
    $scope.nextStep = function () {
        if (!$scope.txtDownloaded) {
            appMain.Toaster('You must download the secret words', 'Error', 'danger');
            return false;
        }
        $rootScope.register = false;
        $rootScope.creatpwd = false;
        $rootScope.checkpwd = true;
    }
});

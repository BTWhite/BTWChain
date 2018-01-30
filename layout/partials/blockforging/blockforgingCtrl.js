angular.module('btw').controller('blockforgingCtrl', function($scope, $rootScope, apiService, ipCookie, $location,$window,NgTableParams,userService, $translate) {
	$rootScope.active = 'blockforging';
	$rootScope.userlogin = true;
    $rootScope.progress = true;
    $rootScope.table = false;
    $rootScope.info = false;
	$scope.setInfo = function () {};
	$scope.forgingStatus = function () {
		let label = $scope.forgingEnabled ? 'FORGING_ENABLE' : 'FORGING_DISABLE';
		return $translate.instant(label);
	};
	$scope.init = function() {
		apiService.blockforging({
			publicKey:userService.publicKey
		}).success(function (res) {
			if(res.success === true){
				$scope.delegate = res.delegate
			}
		});
		apiService.forgingStatus({
			publicKey:userService.publicKey
		}).success(function (res) {
			if(res.success === true){
				$scope.forgingEnabled = res.enabled
			}
		});
		$scope.blockforgingtableparams = new NgTableParams({
			page: 1,
			count: 20,
			sorting: {
				height: 'desc'
			}
		}, {
			total: 0,
			counts: [],
			getData: function($defer,params) {
				apiService.blocks({
					generatorPublicKey:userService.publicKey,
					limit: params.count(),
					orderBy: 'height:desc',
					offset: (params.page() - 1) * params.count()
				}).success(function(res) {
                    $rootScope.progress = false;
					params.total(res.count);
                    if (!res.count) {
                        $rootScope.info = true;
                        $rootScope.table = false;
                    } else {
                        $rootScope.info = false;
                        $rootScope.table = true;
                    }
					$defer.resolve(res.blocks);
				}).error(function(res) {
                    appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Success', 'success');
				});
			}
		});
	};
});

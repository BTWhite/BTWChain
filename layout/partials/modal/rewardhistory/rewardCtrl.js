angular.module('btw').controller('rewardCtrl', function ($scope, $rootScope, apiService, ipCookie, $window, $http, userService, postSerivice, $translate) {
   

    $scope.history = [];
    $rootScope.rewardinfo = false;
    $rootScope.showrewardinfo = function (i) {
        
        $rootScope.rewardinfo = true;
        $rootScope.$broadcast('reward', i);
    };
    $rootScope.$on('reward', function (param, i) {
        $scope.history = i;
        
        $('#rewardCtrl').modal('show');
    });
});


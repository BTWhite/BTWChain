angular.module('btw').filter('savecheckpbulish', function ($rootScope) {
    return function (key) {
        return !!$rootScope.checkdelitem[key];
    }
});

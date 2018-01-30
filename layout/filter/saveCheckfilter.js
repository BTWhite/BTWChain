angular.module('btw').filter('saveCheckfilter', function ($rootScope) {
    return function (key) {
        return !!($rootScope.checkobj[key] || $rootScope.coedobj[key]);
    }
});

angular.module('btw').filter('saveCodeFilter', function ($rootScope) {
    return function (key) {
        return !!$rootScope.coedobj[key];
    }
});

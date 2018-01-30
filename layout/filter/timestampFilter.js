angular.module('btw').filter('timestampFilter', function($filter) {
    return function (timestamp) {
        return BtwJS.utils.format.fullTimestamp(timestamp);
    }
});

angular.module('btw').filter('timeAgoFilter', function($filter) {
	return function (time, fullTime) {
		if (fullTime) {
			return $filter('timestampFilter')(time);
		}
		return BtwJS.utils.format.timeAgo(time);
	}
});

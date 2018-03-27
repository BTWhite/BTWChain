angular.module('btw').filter('addressFilter', function () {
    return function (obj) {

        if(obj.username != "") {
            console.log(obj, obj.username, 'username');
            return obj.username;
        } else {
            console.log(obj, obj.address, 'address');
            return obj.address;
        }
    }
});

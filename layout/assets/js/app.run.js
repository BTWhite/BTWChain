angular.module('btw').run(function ($rootScope, $location, ipCookie, apiService, $window, userService, nodeService) {
    $rootScope.isBodyMask = false;
    $rootScope.isBodyMaskWhite = false;
    $rootScope.isLoading = true;
    $rootScope.userlogin = false;
    $rootScope.checkobj = {};
    $rootScope.coedobj = {};
    $rootScope.startWith = null;
    $rootScope.$on('$routeChangeStart', function (scope, next, current) {
        $rootScope.isLoading = false;
        if (!userService.secret) {

            if($rootScope.startWith == null) {
                $rootScope.startWith = $location.path();
            }
            $location.path('/login');
        } 
    });
    $rootScope.assigneeShowInfo = function () {
        $rootScope.assigneeinfo = true;
        $rootScope.isBodyMask = true;
        $('#assigneeCtrl').modal('show');

    };
    $rootScope.quitout=function(){
        localStorage.removeItem("lastsecret");
        $window.location.href="#/login";
    };
    let serverUrl = $location.protocol() +"://"+$location.host()+":"+$location.port()||80;
    if ($location.protocol().toLower === "https"){
        nodeService.staticServer(serverUrl);
    }
    else{
        nodeService.dynamicServers($location.protocol() +"://"+$location.host()+":"+$location.port()||80);
    }
});
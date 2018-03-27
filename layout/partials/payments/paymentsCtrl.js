angular.module('btw').controller('paymentsCtrl', function ($scope, $rootScope, apiService, ipCookie, $window, $location, userService, $translate, NgTableParams,postSerivice,userService) {

	$scope.selectedRate = 0;
	$scope.selectedCoins = 0;
	$scope.fee = BtwJS.transaction.calculateFee(1);
	
    $rootScope.active = 'payments';
    
    $scope.to = null;
    $scope.amount = null;
    $scope.totalVoter = 0;
    $scope.ranges = [];
    $scope.accounts = [];
    $scope.history = [];

    $scope.getFrom = function() {
        if($scope.ranges.length == 0) return 0;
        return $scope.ranges[$scope.ranges.length-1].to;
    }

    $scope.addRange = function() {

        if($scope.getFrom()+1 > $scope.to) {
            appMain.Toaster("Error! Min to " + ($scope.getFrom()+1), 'Error', 'danger');
            return;
        } else if($scope.amount < 1) {
            appMain.Toaster("Amount error!", 'Error', 'danger');
            return;
        }

        if($scope.to > $scope.totalVoter) {
            appMain.Toaster("Max voters: " + $scope.totalVoter, 'Error', 'danger');
            return;
        }

        if(isNaN($scope.to) || isNaN($scope.amount)) {
            appMain.Toaster("Use only numerical symbols", 'Error', 'danger');
            return;
        }

        var summ = ($scope.to - $scope.getFrom())*($scope.amount+$scope.fee/100000000);
        
        if(summ >= $rootScope.balance/100000000) {
            appMain.Toaster("Invalid balance", 'Error', 'danger');
            return;
        }
        var i = $scope.ranges.length;
        $scope.ranges[i] = {
            from: $scope.getFrom(), 
            to: $scope.to, 
            amount: $scope.amount,
            price: summ
        };
        
        for(var j = $scope.ranges[i].from; j < $scope.ranges[i].to; j++) {
            $scope.accounts[j].reward = $scope.amount;
        }
    }  
    
    $scope.clearLast = function() {
        $scope.ranges.pop();
    }
    $scope.getTotally = function() {
        var summ = 0;
        for (var i = $scope.ranges.length - 1; i >= 0; i--) {
           summ += $scope.ranges[i].price;
        }
        return summ.toFixed(4);   
    }
    $scope.clearRanges = function() {
        $scope.ranges = [];
    }

    $scope.createStorage = function(ranges, accounts) {
        var accountsArr = [];
        for(var i = 0; i < accounts.length; i++) {
            if(accounts[i].reward > 0){
                var j = accountsArr.length;

                accountsArr[j] = {
                    address: accounts[i].address, 
                    username: accounts[i].username,
                    reward: accounts[i].reward
                };
            }
            
        }
        var object = {
            type: "reward", 
            data: {
                ranges: ranges,
                accounts: accountsArr
            }
        };
        hex = $scope.convertToHex(angular.toJson(object));
        return BtwJS.storage.createStorage(String(hex), userService.secret, $scope.secondPassword);
    }
    $scope.init = function (params) {


        $scope.tableparams = new NgTableParams({
            page: 1,
            count: 20,
            sorting: {
                height: 'desc'
            }
        }, {
            total: 0,
            counts: [],
            getData: function ($defer, params) {
				apiService.votetome({
                    publicKey: userService.publicKey,
                    orderBy: 'rate:desc',
                    limit: params.count(),
                    offset: (params.page() - 1) * params.count()
                }).success(function (res) {
                    $scope.totalVoter = res.accounts.length;
                    
                    var temp;
					for(var i=0,j=res.accounts.length-1; i<j; i++,j--) {
					    temp = res.accounts[j];
					    res.accounts[j] = res.accounts[i];
					    res.accounts[i] = temp;
					}

                    $scope.accounts = res.accounts;
                    $defer.resolve(res.accounts);
                }).error(function (res) {
                    appMain.Toaster($translate.instant('ERR_SERVER_ERROR'), 'Error', 'danger');
                });
            }
        });

        apiService.transactions({
            recipientId: userService.address,
            senderPublicKey: userService.publicKey,
            orderBy: 't_timestamp:desc',
            limit: 100,
            offset: 0
        }).success(function (res) {
            if (res.success === true) {

                for (var j =0, i = res.transactions.length - 1; i >= 0; i--) {
                    if(res.transactions[i].type == 8) {
                        
                        
                        $scope.getRewardInfo(res.transactions[i], j, function(obj, j) {
                            if(obj == null) return;
                            
                            if($scope.history[j] == undefined) {
                                $scope.history[j] = obj;
                            }
                        });
                        j++;  
                    }   
                }
            } else {
                console.log(res);
                alert("error!");
            }
        });

        

	}

    $scope.getRewardInfo = function(tx, i, cb) {
        
        var content = localStorage.getItem('st-'+tx.id);
        if(content != null) {            
            cb(angular.fromJson($scope.convertFromHex(content)), i);
        } else {
            apiService.storage({id: tx.id}).success(function(res) {
                var obj = angular.fromJson($scope.convertFromHex(res.asset.storage.content));
                obj = $scope.objNormalize(obj, tx);
                localStorage.setItem('st-'+res.id, $scope.convertToHex(angular.toJson(obj)));
                cb(obj, i);
            });
        }

    }
    $scope.objNormalize = function(obj, tx) {
        
        obj.amount = 0;
        for (var i = 0; i < obj.data.accounts.length; i++) {
            obj.amount += parseInt(obj.data.accounts[i].reward);
        }
        
        obj.timestamp = tx.timestamp;
        return obj;
    }

    $scope.convertFromHex = function(hex) {
        var hex = hex.toString();//force conversion
        var str = '';
        for (var i = 0; i < hex.length; i += 2)
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        return str;
    }

    $scope.convertToHex = function(str) {
        var hex = '';
        for(var i=0;i<str.length;i++) {
            hex += ''+str.charCodeAt(i).toString(16);
        }
        return hex;
    }

    $scope.send = function() {
        var time = Date.now();
        var count = 0, summ = 0, error = false;
        if($scope.ranges.length === 0) {
            return appMain.Toaster("You must select a Range", 'Error', 'danger');
        }
        for (var i = $scope.accounts.length - 1; i >= 0; i--) {
            if($scope.accounts[i].reward > 0) {
                postSerivice.retryPost($scope.createTransaction($scope.accounts[i].address, $scope.accounts[i].reward, time), function (err, res) {
                   
                    if (err !== null) {
                        if (res.error.indexOf('Insufficient') > -1) {
                            appMain.Toaster($translate.instant('ERR_BALANCE_NOT_ENOUGH'), 'Error', 'danger');
                        } else if(res.error.indexOf('locked') > -1) {
                            appMain.Toaster($translate.instant('ALREADY_LOCKED'), 'Error', 'danger');
                        }
                        error = true;
                    }
                });
                count++;
                summ += $scope.accounts[i].reward;
            }
        }

        var tr = $scope.createStorage($scope.ranges, $scope.accounts);
        
        postSerivice.retryPost(tr, function (err, res) {
            // localStorage.getItem();
            if (err !== null) {
                if (res.error.indexOf('Insufficient') > -1) {
                    appMain.Toaster($translate.instant('ERR_BALANCE_NOT_ENOUGH'), 'Error', 'danger');
                } else if(res.error.indexOf('locked') > -1) {
                    appMain.Toaster($translate.instant('ALREADY_LOCKED'), 'Error', 'danger');
                }
            } else if(!error) {
                appMain.Toaster("You have sent all the awards successfully", 'Success', 'success');
            } else {
                appMain.Toaster("An error occurred while sending the awards", 'Error', 'danger');
            }
        });

        
    }

    $scope.createTransaction = function (to, count, time) {
        let amount = parseFloat((count * 100000000).toFixed(0));
        
        return BtwJS.transaction.createTransaction(String(to), amount, "reward["+ time +"]", userService.secret, $scope.secondPassword);
    };

	$scope.select = function (height) {
		$scope.selectedRate = height;
		$("#paymentsModal").modal('show');
	}
});

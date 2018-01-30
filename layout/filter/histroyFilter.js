angular.module('btw').filter('histroyFilter', function($filter) {
	return function (i) {
        let content = '';
		if (i.type === 9) {
			content='Registered the publisher ' + i.asset.uiaIssuer.name
		} else if(i.type === 10){
			content = 'Registered assets ' + i.asset.uiaAsset.name
		} else if(i.type === 11&& i.asset.uiaFlags.flagType === 1){
			let arr = ['Blacklist mode','White list mode'];
			content = 'assets ' + i.asset.uiaFlags.currency + ' Access control is set to '+ arr[i.asset.uiaFlags.flag]
		} else if(i.type === 11&& i.asset.uiaFlags.flagType === 2){
			content = 'assets ' + i.asset.uiaFlags.currency + ' Was canceled'
		} else if(i.type === 12){
			content = 'assets ' + i.asset.uiaAcl.currency + ' Updated access control list'
		} else if(i.type === 13){
			content = 'assets ' + i.asset.uiaIssue.currency + ' New issue ' + (i.asset.uiaIssue.amountShow || '?')
		} else if(i.type === 14){
			content = 'assets ' + i.asset.uiaTransfer.currency + ' From ' + i.senderId+' Transfer ' + (i.asset.uiaTransfer.amountShow || '?') + ' To ' +i.recipientId
		}
		return $filter('timestampFilter')(i.timestamp) + ' ' + content;
	}
});
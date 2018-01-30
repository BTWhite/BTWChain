angular.module('btw').filter('feeFilter', function () {
    return function (fee) {
        if (!fee) {
            return 0;
        }
        let r = fee.toFixed(8);
        let clear = "";
        let findValue = false;
        for (let i = r.length - 1; i >= 0; i--) {
            if (findValue) {
                clear += r[i];
            } else {
                if (r[i] != '0') {
                    findValue = true;
                    clear += r[i];
                }
            }
        }
        let result = clear.split("").reverse().join("");
        if (result[result.length - 1] === '.') {
            result = result.substr(0, result.length - 1);
        }
        return result;
    }
});

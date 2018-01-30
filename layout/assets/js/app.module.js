let app = angular.module('btw', ['ngRoute', 'ui.bootstrap', 'ngTable', 'ipCookie', 'pascalprecht.translate', 'ja.qr']);

app.config(function ($httpProvider) {
    $httpProvider.defaults.headers.post['Content-Type'] = 'application/json';
    $httpProvider.defaults.headers.put['Content-Type'] = 'application/json';
    $httpProvider.defaults.headers.common = { "request-node-status":"yes"};
});

app.config(function ($translateProvider) {
    /** @namespace navigator.browserLanguage */
    let browserLang = navigator.browserLanguage ? navigator.browserLanguage : navigator.language;
    let defaultLang = 'en-us';
    if (browserLang && browserLang.indexOf('zh') > -1) {
        defaultLang = 'zh-cn';
    }
    console.log(browserLang, defaultLang);
    for (let lang in window.Translations) {
        $translateProvider.translations(lang, window.Translations[lang]);
    }
    $translateProvider.preferredLanguage(defaultLang);
    $translateProvider.useSanitizeValueStrategy(null);
});
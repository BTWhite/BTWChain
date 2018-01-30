let appMain;
appMain = {
    Toaster: function (message, title, priority) {
        $.toaster({ message : message, title : title, priority : priority, settings: {
                timeout: 2500
            }
        });
    },
    BlockCountSync: function () {
        setInterval(
            function () {
                $.getJSON( "/api/blocks/getheight", function( data ) {
                    $('#sync-block').text(data.height);
                });
            }, 10000
        );
    },
    MenuRoute: function (el) {
        if (!/Mobi/.test(navigator.userAgent)) {
            if ($(el).attr('data-toggle') === 'false') {
                $(el).attr('data-toggle', 'true');
                $('.leftmenu').css({
                    'width': '200px'
                });
                $('.content').css({
                    'margin-left': '200px'
                });
                $('.leftmenu > ul > a > li > span').each(function (index, value) {
                    $(value).removeClass('hide').addClass('show');
                });
            } else {
                $(el).attr('data-toggle', 'false');
                $('.leftmenu').css({
                    'width': '80px'
                });
                $('.content').css({
                    'margin-left': '80px'
                });
                $('.leftmenu > ul > a > li > span').each(function (index, value) {
                    $(value).removeClass('show').addClass('hide');
                });
            }
        }
    },
    CharLoad: false,
    CharDestory: function (config) {
        if (!/Mobi/.test(navigator.userAgent)) {
            if (this.CharLoad) {
                this.CharLoad.destroy();
            }
            setTimeout(function () {
                appMain.CharLoad = new Chart(document.getElementById("canvas").getContext("2d"), config);
            }, 1000);
        }
    },
    CharTransfer: function (DataChar, LabelChar) {
        let config = {
            type: 'line',
            data: {
                labels: LabelChar,
                datasets: [{
                    label: "Bit White",
                    backgroundColor: '#6a92b0',
                    borderColor: '#6a92b0',
                    data: DataChar,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                title:{
                    display:true,
                    text:'Transactions Char'
                },
                tooltips: {
                    mode: 'index',
                    intersect: false,
                },
                hover: {
                    mode: 'nearest',
                    intersect: true
                },
                scales: {
                    xAxes: [{
                        display: true,
                        scaleLabel: {
                            display: false,
                            labelString: 'Month'
                        }
                    }],
                    yAxes: [{
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: 'Value'
                        }
                    }]
                }
            }
        };
        this.CharDestory(config);
    },
    PopovetInit: function () {
        $('body').popover({
            placement: 'top',
            container: 'body',
            trigger: 'hover',
            html: true,
            animation: false,
            selector: '[data-toggle="popover"]'
        });
    },
    Carousel: function () {
        $('.crypto-carousel').owlCarousel({
            loop:true,
            margin:15,
            responsiveClass:true,
            responsive:{
                0:{
                    items:1,
                    nav:false
                },
                600:{
                    items:3,
                    nav:false
                },
                1200:{
                    items:4,
                    nav:false,
                    loop:false
                }
            }
        })
    }
};
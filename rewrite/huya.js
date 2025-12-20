
/*
####################################################################
# 配置区
####################################################################
[filter_local]
# 拦截虎牙插播广告视频流与图片资源
host-suffix, ad-img.huya.com, reject
host-suffix, ad-video.huya.com, reject
host-suffix, ads-sc.huya.com, reject
host-suffix, business.huya.com, reject
host, ias.huya.com, reject
host, adid.huya.com, reject
host, sniper.huya.com, reject



[rewrite_local]
# 拦截直播间广告配置、启动广告及 Banner
^https?:\/\/zt\.huya\.com\/.*\/mobile\/index\.html url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/huya.js
^https?+:\/\/business\.msstatic\.com\/advertiser\/ - reject-200
^https?:\/\/cdnfile1\.msstatic\.com\/cdnfile\/appad\/ - reject-img

[mitm]
hostname = *.huya.com, analytics.huya.com, business.huya.com, cdnfile1.msstatic.com



*/

/*
 * 
 * 仅移除广告
 */


let body = $response.body;

// 1. 注入强力隐藏 CSS (预防性屏蔽)
const styleInject = `
<style>
    /* 借鉴你提供的选择器 */
    .pic.J_pic, #ab-banner, .small-handle-tip, .common-popup, 
    .room-sidebar-top, .room-mod-ggTop, #J_roomGgTop, .room-gg-top,
    div[data-is-ad="true"], .competition_cont_center_wrap {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }
</style>
`;

// 2. 注入你的 JS 逻辑 (动态监控并模拟点击)
const scriptInject = `
<script>
(function() {
    'use strict';
    const closeButtonSelectors = ['.ps.ps_close.J_close', '.close-btn', '.popup-close-btn', '.css-9pa8cd'];
    
    function killAds() {
        // 尝试模拟点击关闭按钮
        closeButtonSelectors.forEach(selector => {
            const btn = document.querySelector(selector);
            if (btn && typeof btn.click === 'function') {
                btn.click();
            }
        });
        
        // 针对某些顽固 iframe，直接移除
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(f => {
            if (!f.id.includes('login')) f.remove();
        });
    }

    // 每秒执行一次，持续检测
    const timerId = setInterval(killAds, 1000);
    
    // 5秒后如果还没关掉，尝试强制隐藏主体
    setTimeout(() => {
        document.querySelectorAll('.common-popup').forEach(el => el.style.display = 'none');
    }, 5000);
})();
</script>
`;

// 插入到 HTML 结构中
body = body.replace('</head>', styleInject + '</head>');
body = body.replace('</body>', scriptInject + '</body>');

$done({ body });

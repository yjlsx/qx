#!name=酷狗音乐调试
#!desc=功能调试
#!category=KuGoumusic
#!author=bb

[Rule]
# > (静态资源/弹窗拒绝)
URL-REGEX, ^https:\/\/vipssr\.kugou\.com\/static\/js\/async\/flexPayPopup, REJECT
URL-REGEX, ^https:\/\/fx\.service\.kugou\.com\/fx\/activity\/register\/center\/sidebar\/configV2$, REJECT
URL-REGEX, ^https:\/\/service1\.fanxing\.kugou\.com\/video\/mo\/live\/pull\/mutiline\/cfg, REJECT

# > (广告域名拒绝)
DOMAIN, webvoobssdl.kugou.com, REJECT
DOMAIN, ad.tencentmusic.com, REJECT
DOMAIN, ads.service.kugou.com, REJECT
DOMAIN, adsfile.kugou.com, REJECT
DOMAIN, mdpfilebssdlbig.kugou.com, REJECT
DOMAIN, adserviceretry.kugou.com, REJECT

# > (开屏广告IP拒绝)
IP-CIDR, 157.255.11.247/32, REJECT, no-resolve
IP-CIDR, 111.206.99.202/32, REJECT, no-resolve


[Script]


酷狗_K歌 = type=http-response, pattern=^https?:\/\/(nacsing\.kugou\.com|acsing\.service\.kugou\.com|vipos\.kugou\.com|gateway\.kugou\.com|gamecenter\.kugou\.com|acsing\.tx\.kugou\.com)\/(sing7\/json\/v2\/user\/login|ccktv\/v1\/ktv_room\/room\/room_config|fxsing\/vip\/member\/info|sing7\/homepage\/json\/v3\/vip\/tip|v4\/price\/get_tips|vipenergy\/v2\/entrance\/vip_center_user_info|fxsing\/vip\/user\/info|sing7\/homepage\/json\/v3\/cdn\/kroom_tab_enter|v1\/home\/member_game|sing7\/homepage\/json\/v3\/cdn\/kroom_tab\/banners), requires-body=true, max-size=0, script-path=https://raw.githubusercontent.com/Yu9191/Rewrite/refs/heads/main/kugouksong.js

[MITM]
hostname = %APPEND% *.kugou.com, *.*.kugou.com
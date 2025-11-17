/*
[rewrite_local]
^https:\/\/wx-shangou\.meituan\.com\/quickbuy\/v1\/order\/detail url script-request-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/meituancx.js



[mitm]
hostname = wx-shangou.meituan.com

*/



// 脚本只拦截第二个请求并转换为第一个请求
if ($request.url.indexOf("wx-shangou.meituan.com/quickbuy/v1/order/detail") != -1) {
    // 解析原请求 body
    let originalBody = $request.body;
    let params = {};
    originalBody.split("&").forEach(item => {
        let [key, value] = item.split("=");
        params[key] = decodeURIComponent(value);
    });

    // 构造第一个接口的请求 body
    let newBody = `optimus_code=10&optimus_risk_level=71&order_view_id=${params.id}&switch_version=1&wm_latitude=${params.wm_latitude}&wm_longitude=${params.wm_longitude}&wm_actual_latitude=${params.wm_actual_latitude}&wm_actual_longitude=${params.wm_actual_longitude}&wmUuidDeregistration=0&wmUserIdDeregistration=0&openh5_uuid=${params.uuid}&uuid=${params.uuid}&_token=eJx...`; // _token 保持固定或自行生成

    // 构造新请求
    let newRequest = {
        url: "https://i.waimai.meituan.com/openh5/order/manager/v3/detail?_=" + Date.now() + "&yodaReady=h5&csecplatform=4&csecversion=4.1.1",
        method: "POST",
        headers: {
            "mtgsig": '{"a1":"1.2","a2":' + Date.now() + ',"a3":"0xx047y540005y4z09xxu1094v05xzyw802wu47z8648795862w964v5","a5":"...","a6":"...","a8":"62a1f5af5cbeae263bea84070700e44c","a9":"4.1.1,7,191","a10":"ad","x0":4,"d1":"..."}',
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": $request.headers["User-Agent"] || "",
            "Cookie": $request.headers["Cookie"] || "",
            "Referer": "https://h5.waimai.meituan.com/"
        },
        body: newBody
    };

    // 发起新请求
    $task.fetch(newRequest).then(response => {
        $done({body: response.body});
    }, reason => {
        $done({body: reason.error});
    });

} else {
    $done({});
}

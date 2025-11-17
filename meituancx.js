/*
[rewrite_local]
^https:\/\/wx-shangou\.meituan\.com\/quickbuy\/v1\/order\/detail url script-request-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/meituancx.js



[mitm]
hostname = wx-shangou.meituan.com

*/



// 1. 请求1的信息
const req1 = $request;
const originalBody = req1.body || "";

// 从请求1 body里提取订单号 id=xxxxxxxx
const orderIdMatch = originalBody.match(/(?:^|&)id=(\d+)/);
const orderId = orderIdMatch ? orderIdMatch[1] : null;

if (!orderId) {
    console.log(" 未从请求1 body 中提取到订单号 id=xxx");
    $done({});
}

// 打印订单号
console.log(" 捕获订单号: " + orderId);

// 2. 构造请求2的 body（只替换 order_view_id）
let forwardBody = `optimus_code=10&optimus_risk_level=71&order_view_id=${orderId}&switch_version=1&wm_latitude=25004542&wm_longitude=102734686&wm_actual_latitude=25006364&wm_actual_longitude=102734353&wmUuidDeregistration=0&wmUserIdDeregistration=0&openh5_uuid=197df528c7ec8-0019ebd34e6b4a-286f4f35-505c8-197df528c7ec8&uuid=197df528c7ec8-0019ebd34e6b4a-286f4f35-505c8-197df528c7ec8&_token=eJxNkV1zojAUhv9LbpcBAvkAZ3oBaP1ai6Yo6E4vRBAQUAQU687%2B9w2tbZnJTJ485%2BRNMvkLynEAelCGVIYCuIYl6AEoyiIBAqgrXqFEVXVV0TUNYgHsOk6VMSWyAPxy1Qe9P6ouC4Sob61gfP0hNITehB9SEB9tx5g3gLiui6onSTEWm22SbxMxD5P6sj2Ku1MufSopT45BeJNOWVLV%2FE5fe5qmEaPTKcrCtlmMUwnw3NxpcxUVCxgprUhbweftdwFhKszbUv2pCFcaFCDP%2FmCqd1jrMH0w4owerAiIPPqxzhl3GHX4KwfyvfKDVc7dc%2BUf%2Fr4PEZDeZrYvmPGf4bJKoiOncPKeHZyBHd2NGQslqxn76WS0Hhvw4o3O5t2cMWNiFCtr1NcX5WV5zq6eTsk%2B%2FXU017KuuH5Tss2QZmdW7HI8MxNjWhbQgoeVmzuv5LbaMJZadO6qztSJ7ODqaoqvHBYsfomH5rvLFsPF1rvjfO4o2OvTaXh7tvN9n%2B6pH26agO1sdZ7iODmFnnMYeFdi%2BoE3KFhZVVMb2RbKDDfJtODlZS2FrpG%2FXpaTAaF2OrDC5e99rkB5lzrjgBXP0dMT%2BPcfpye5Lg%3D%3D`;

// 3. 请求2地址
const forwardUrl = `https://i.waimai.meituan.com/openh5/order/manager/v3/detail`;

// 4. 替换 Host、Referer 等关键字段
let newHeaders = JSON.parse(JSON.stringify(req1.headers));
newHeaders["Host"] = "i.waimai.meituan.com";
newHeaders["Origin"] = "https://h5.waimai.meituan.com";
newHeaders["Referer"] = "https://h5.waimai.meituan.com/";

// 5. 发起请求2
$task.fetch({
    url: forwardUrl,
    method: "POST",
    headers: newHeaders,
    body: forwardBody
}).then(resp => {

    let body = resp.body;

    // === 如果你想修改返回给 App 的订单信息，在这里改 ===
    try {
        let json = JSON.parse(body);

        // 示例：改订单时间
        // json.data.order_info.ctime = "2099-12-31 23:59:59";

        body = JSON.stringify(json);
    } catch (e) {
        console.log("响应体不是 JSON，跳过修改");
    }

    // 返回“请求2”的结果给美团 App
    $done({
        status: resp.status,
        headers: resp.headers,
        body: body
    });

}, err => {
    console.log("转发失败：" + err);
    $done({});
});

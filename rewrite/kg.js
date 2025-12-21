/*
[rewrite_local]

^https?:\/\/gateway\.kugou\.com\/v3\/external\/order\/query_latest url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg.js

[mitm]
hostname =  gateway.kugou.com, 
*/



let url = $request.url;

if (/\/v3\/external\/order\/query_latest/.test(url)) {
    let body = $response.body;

    try {
        let obj = JSON.parse(body);

        // 强制 VIP 相应字段
        obj.status = 1;
        obj.data.is_vip = 1;              
        obj.data.vip_type = 4;            
        obj.data.vip_end_time   = "2099-12-31 23:59:59";
        obj.data.m_end_time     = "2099-12-31 23:59:59";
        obj.data.is_latest_ordered = 1;

        body = JSON.stringify(obj);
    } catch (err) {
        console.log("VIP rewrite error: " + err);
    }

    $done({ body });
    
} else {
    $done({});
}

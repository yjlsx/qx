/*
[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc$ url script-response-body xiaocan_close_popup.js

[mitm]
hostname = gw.xiaocantech.com


*/



const method = $request.headers["methodname"] || $request.headers["Methodname"];

if (method !== "SilkwormMobileMarketingService.GetUserMarketingInfoV2") {
    // 非弹窗接口，直接放行
    $done({});
} else {
    let body = $response.body;

    try {
        let obj = JSON.parse(body);

        // ---- 关键字段处理（基于你提供的真实数据结构） ----

        // 总的强制弹窗字段
        if (obj.if_force_screen !== undefined) {
            obj.if_force_screen = false;
        }

        // 弹窗信息字段（这里是 user_force_screen）
        if (obj.user_force_screen) {
            obj.user_force_screen = null;   // 直接置空，不给任何弹窗内容
        }

        // 庆祝弹窗（比如任务、节日弹窗）
        if (obj.if_celebrate !== undefined) {
            obj.if_celebrate = false;
        }

        // 其它可能触发引导弹窗的字段
        if (obj.if_page_gift !== undefined) obj.if_page_gift = false;
        if (obj.if_receive_add_gift !== undefined) obj.if_receive_add_gift = false;
        if (obj.if_promotion_muster !== undefined) obj.if_promotion_muster = false;

        // 用户营销信息里的提醒弹窗
        if (obj.user_marketing) {
            obj.user_marketing.if_in_app_review = false;
            obj.user_marketing.if_order_show_course = false;
            obj.user_marketing.if_show_course = false;
            obj.user_marketing.if_complaint_no_read = false;
            obj.user_marketing.sign_notify = 0;
            obj.user_marketing.promotion_notify = 0;
        }

        // 免费抽奖显示（有时也会弹框）
        if (obj.show_free_lottery) {
            obj.show_free_lottery.if_show = false;
            obj.show_free_lottery.if_new = false;
        }

        $done({ body: JSON.stringify(obj) });

    } catch (e) {
        console.log("parse error: " + e);
        $done({ body });
    }
}

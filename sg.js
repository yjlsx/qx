/*
####################################################################
# 配置区
####################################################################

[rewrite_local]
# 1. 订单列表接口（淘宝闪购/饿了么）
^https:\/\/waimai-guide\.ele\.me\/h5\/mtop\.alsc\.order\.fulfillment\.queryorderlist.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/sg.js

# 2. 订单详情接口
^https:\/\/alsc-buy2\.ele\.me\/h5\/mtop\.alsc\.eleme\.order\.detail\.miniapp\.build.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/sg.js


[mitm]
hostname = waimai-guide.ele.me, alsc-buy2.ele.me

*/


// === 你只要改这里 ===
const TARGET_ORDER_ID = "8082816203169093930";  // 江西菜馆订单号
const TARGET_STORE_KEYWORD = "江西菜馆";        // 店铺名关键词（备用匹配）
const LIST_STATUS_TITLE = "已送达";             // 列表页状态条文案
const DETAIL_STATUS_TITLE = "订单已送达";       // 详情页时间线文案
// =====================


(() => {
    const url = $request.url;
    let body = $response.body;
    if (!body || !body.trim().startsWith("{")) return $done({});

    try {
        const obj = JSON.parse(body);

        if (url.includes("mtop.alsc.order.fulfillment.queryorderlist")) {
            modifyOrderList(obj);
        } else if (url.includes("mtop.alsc.eleme.order.detail.miniapp.build")) {
            modifyOrderDetail(obj);
        }

        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        console.log(`[淘宝闪购重写错误] ${e.message}`);
        $done({});
    }
})();

/**
 * 判断订单对象是否是目标订单（列表页字段）
 */
function isTargetOrder(order) {
    if (!order) return false;
    if (order.eleMeOrderId === TARGET_ORDER_ID || order.orderId === TARGET_ORDER_ID) return true;
    return typeof order.storeName === "string" && order.storeName.includes(TARGET_STORE_KEYWORD);
}

/**
 * 判断详情页响应是否属于目标订单
 */
function isTargetDetail(data) {
    if (!data) return false;
    const baseInfo = data.order_detail_base_info || {};
    const ids = [baseInfo.alsc_order_id, baseInfo.order_id, baseInfo.eos_id];
    if (ids.includes(TARGET_ORDER_ID)) return true;
    const food = data.order_detail_food || {};
    return typeof food.restaurant_name === "string" && food.restaurant_name.includes(TARGET_STORE_KEYWORD);
}

/**
 * 列表页：状态条改为已送达，去掉退款进度按钮
 */
function modifyOrderList(obj) {
    const orderList = obj?.data?.result?.orderList;
    if (!Array.isArray(orderList)) return;

    let changed = 0;
    orderList.forEach((order) => {
        if (!isTargetOrder(order)) return;

        order.orderStatusBar = { highlight: false, title: LIST_STATUS_TITLE };

        if (Array.isArray(order.orderActionButtonList)) {
            order.orderActionButtonList = order.orderActionButtonList.filter(
                (btn) =>
                    btn &&
                    btn.type !== "REFUND_DETAIL" &&
                    !String(btn.title || "").includes("退款")
            );
        }
        changed++;
    });

    if (changed > 0) console.log(`[淘宝闪购列表] 已将 ${changed} 个目标订单改为已送达并去掉退款按钮`);
}

/**
 * 详情页：去掉退款卡片、退款按钮、退款时间线，改为订单已送达
 */
function modifyOrderDetail(obj) {
    const data = obj?.data;
    if (!isTargetDetail(data)) return;

    // 1. 删除退款卡片
    delete data.order_detail_refund_card;

    // 2. 去掉"你操作了退款"标题和退款相关按钮
    if (data.order_detail_function_area) {
        data.order_detail_function_area.title = "";
        if (Array.isArray(data.order_detail_function_area.operations)) {
            data.order_detail_function_area.operations = data.order_detail_function_area.operations.filter(
                (op) => op && op.action !== "refund" && op.action !== "refundProcess"
            );
        }
    }

    // 3. 补全"送至 xxx"地址信息（和完整已送达订单一致）
    const receiving = data.order_detail_base_info?.receiving_info;
    if (data.order_detail_function_area && receiving) {
        const firstText = receiving.address || "";
        const secondText = `${receiving.consignee || ""} ${receiving.phone || ""}`.trim();
        data.order_detail_function_area.sub_title = {
            firstText,
            secondText,
            text: `${firstText} ${secondText}`.trim(),
            type: 2
        };
    }

    // 4. 右侧列表去掉"食品安全问题理赔"等退款/理赔入口
    if (data.order_detail_right_list?.orderDetailRightList) {
        data.order_detail_right_list.orderDetailRightList = data.order_detail_right_list.orderDetailRightList.filter(
            (item) =>
                item &&
                item.code !== "CLAIM_CARD" &&
                !String(item.title || "").includes("理赔") &&
                !String(item.title || "").includes("退款")
        );
    }

    // 5. 顶部导航时间线改为已送达
    if (data.order_detail_navigation?.timeline) {
        setDeliveredTimeline(data.order_detail_navigation.timeline);
    }

    // 6. 地图时间线改为已送达并删除退款节点
    if (data.order_detail_map?.timeline) {
        const timeline = data.order_detail_map.timeline;
        setDeliveredTimeline(timeline);

        if (Array.isArray(timeline.nodes)) {
            timeline.nodes = timeline.nodes.filter(
                (node) => node && !String(node.title || "").includes("退款")
            );
            const lastNode = timeline.nodes[timeline.nodes.length - 1];
            if (lastNode) {
                lastNode.nodeStatus = "HAPPENING";
                lastNode.processing_type = 1;
            }
        }
    }

    console.log("[淘宝闪购详情] 已去掉退款信息并改为订单已送达");
}

/**
 * 统一修改时间线标题
 */
function setDeliveredTimeline(timeline) {
    timeline.title = DETAIL_STATUS_TITLE;
    if (Array.isArray(timeline.rich_title)) {
        timeline.rich_title.forEach((item) => {
            if (item && typeof item.text === "string") item.text = DETAIL_STATUS_TITLE;
        });
    }
}

/*
[rewrite_local]
# 1. 京东订单列表重写 (匹配 orderList 接口)
^https?:\/\/api\.m\.jd\.com\/client\.action\?functionId=orderList url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/jd.js

# 2. 京东订单详情重写 (匹配 orderDetail 接口)
^https?:\/\/api\.m\.jd\.com\/client\.action\?t=\d+&loginType=2&loginWQBiz=golden-trade&appid=m_core&client=iPhone&clientVersion=&build url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/jd.js


[mitm]
hostname = api.m.jd.com

*
*/

// Quantumult X Script: jd_order_all_in_one.js
// JD 订单列表和订单详情统一重写脚本

// ===================================
// ⚙️ 用户可配置项 (已使用您提供的数值)
// ===================================

// --- 订单列表页 (List) 配置 ---
// ⚠️ 填写您要修改的订单的【原始订单编号】。如果留空 ""，则修改列表中的第一个订单。
const LIST_TARGET_ORDER_ID = "325329166009";
const LIST_NEW_PRICE = "13.88";           // 列表页上显示的新价格
const LIST_NEW_DATE = "2025-11-08 10:02:20"; // 列表页上的下单时间

// --- 订单详情页 (Detail) 配置 ---
const DETAIL_NEW_ORDER_ID = "364645328524"; // 详情页显示的新订单编号
const DETAIL_NEW_DATE_BASE = "2025-11-08";  // 新的日期
const DETAIL_NEW_TIME_BASE = "10:02:20";   // 新的基本时间 (用于下单时间)
const DETAIL_NEW_PAY_TIME = "2025-11-08 10:03:12"; // 新的支付时间
const DETAIL_NEW_COMPLETE_TIME = "2025-11-08 10:40:08"; // 新的订单完成/送达时间
const DETAIL_NEW_EXPECTED_DELIVERY_TIME = "2025-11-08 10:00-10:20"; // 新的期望配送时间
const DETAIL_NEW_CURRENT_TIME = "2025-11-08 10:04:47"; // 模拟服务器返回的当前时间
const DETAIL_FACT_PRICE = 13.88; // 最终实付金额 (保持不变)
const DETAIL_NEW_PRODUCT_PRICE = 13.88; // 详情页显示的新商品总额

// --- 不变的费用/优惠 (用于详情页价格计算) ---
const DETAIL_FREIGHT_FEE = 0.00; // 运费
const DETAIL_PACKAGING_FEE = 2.00; // 打包费
const DETAIL_DISCOUNT_1 = 11.00; // 商品优惠1
const DETAIL_DISCOUNT_2 = 7.00; // 商品优惠2

// ===================================
// 🛠️ 脚本主体 (请勿随意修改)
// ===================================

let obj;
try {
    obj = JSON.parse($response.body);
} catch (e) {
    console.log("JSON parsing error: " + e);
    $done({});
    return;
}

// 判断当前处理的接口
const isOrderList = obj && obj.orderList;
const isOrderDetail = obj && obj.body && obj.body.orderCommonVo;

// *** ✅ 关键日志：判断接口类型 ***
if (isOrderList) {
    console.log("✅ [JD Rewrite] INTERFACE: Matched Order LIST (functionId=orderList).");
} else if (isOrderDetail) {
    console.log("✅ [JD Rewrite] INTERFACE: Matched Order DETAIL.");
} else {
    console.log("⚠️ [JD Rewrite] INTERFACE: Response structure not recognized as OrderList or OrderDetail. Exiting.");
    $done({});
    return;
}

// --- 1. 处理订单列表接口 ---
if (isOrderList) {
    if (obj.orderList && obj.orderList.length > 0) {
        
        let targetOrder = null;

        if (LIST_TARGET_ORDER_ID) {
            // 查找指定订单号的订单
            targetOrder = obj.orderList.find(order => 
                order.orderCommonVo && order.orderCommonVo.orderId === LIST_TARGET_ORDER_ID
            );
            // *** ✅ 关键日志：查找目标订单 ***
            console.log(`[JD Rewrite] LIST SEARCH: Attempting to find order ID: ${LIST_TARGET_ORDER_ID}.`);
        } else {
            // 如果未指定订单号，则修改第一个订单
            targetOrder = obj.orderList[0];
            console.log(`[JD Rewrite] LIST SEARCH: No target ID set. Modifying the FIRST order in the list.`);
        }

        if (targetOrder) {
            const currentID = targetOrder.orderCommonVo ? targetOrder.orderCommonVo.orderId : 'ID_UNKNOWN';
            console.log(`🎉 [JD Rewrite] LIST FOUND & MODIFYING: ID ${currentID}. New Price: ${LIST_NEW_PRICE}, New Date: ${LIST_NEW_DATE}`);

            // 1. 修改订单价格 (orderTotal字段)
            if (targetOrder.orderTotal) {
                targetOrder.orderTotal.currentOrderPrice = LIST_NEW_PRICE; 
                targetOrder.orderTotal.payPrice = LIST_NEW_PRICE; 
                targetOrder.orderTotal.orderActualPrice = LIST_NEW_PRICE;
                targetOrder.orderTotal.finalPrice = LIST_NEW_PRICE;
                console.log(`-> Price fields (orderTotal) set to: ${LIST_NEW_PRICE}`);
            }
            
            // 2. 修改时间
            if (targetOrder.orderCommonVo) {
                targetOrder.orderCommonVo.dateSubmit = LIST_NEW_DATE;
                console.log(`-> Submission Date set to: ${LIST_NEW_DATE}`);
            }

            // 3. 修改商品列表中的价格和名称显示
            if (targetOrder.orderWareList && targetOrder.orderWareList.length > 0) {
                const ware = targetOrder.orderWareList[0];
                ware.price = LIST_NEW_PRICE; 
                if (ware.priceList && ware.priceList.length > 0) {
                    ware.priceList[0].price = LIST_NEW_PRICE;
                }
                if (targetOrder.totalPrice) {
                    targetOrder.totalPrice.value = LIST_NEW_PRICE;
                }
                
                ware.name = `【列表修改】您的商品名称已被修改 (原ID: ${currentID})`;
                console.log(`-> Ware Name and Price modified in orderWareList.`);
            }
            console.log(`✨ [JD Rewrite] LIST SCRIPT COMPLETED.`);

        } else if (LIST_TARGET_ORDER_ID) {
            // *** ❌ 关键日志：目标订单未找到 ***
            console.log(`❌ [JD Rewrite] LIST ERROR: Order ID ${LIST_TARGET_ORDER_ID} NOT FOUND in the current list segment.`);
        }
    } else {
        // *** ⚠️ 关键日志：列表为空 ***
        console.log("⚠️ [JD Rewrite] LIST WARNING: orderList array is empty or null. No modifications performed.");
    }
}

// --- 2. 处理订单详情接口 ---
else if (isOrderDetail) {
    const data = obj.body;
    console.log(`🎉 [JD Rewrite] DETAIL START: Applying new Order ID ${DETAIL_NEW_ORDER_ID} and Price ${DETAIL_FACT_PRICE}.`);

    // --- 价格计算和修改 (先计算确保平衡) ---
    
    // 价格平衡公式：商品总额 + 运费 + 打包费 - 优惠1 - 优惠2 - 促销立减 = 实付金额
    // 需计算的促销立减金额：(商品总额 + 运费 + 打包费 - 优惠1 - 优惠2 - 实付金额)
    const NEW_PROMOTION_REDUCTION_CALCULATED = DETAIL_NEW_PRODUCT_PRICE + DETAIL_FREIGHT_FEE + DETAIL_PACKAGING_FEE - DETAIL_DISCOUNT_1 - DETAIL_DISCOUNT_2 - DETAIL_FACT_PRICE;
    console.log(`-> Calculated NEW_PROMOTION_REDUCTION_CALCULATED: ${NEW_PROMOTION_REDUCTION_CALCULATED.toFixed(2)}`);

    // 1. 价格信息 orderPriceInfo
    if (data.orderPriceInfo) {
        data.orderPriceInfo.factPrice = DETAIL_FACT_PRICE.toFixed(2); 
        console.log(`-> Fact Price (实付金额) set to: ${DETAIL_FACT_PRICE.toFixed(2)}`);

        data.orderPriceInfo.billsList.forEach(item => {
            const moneyFloat = parseFloat(item.money.replace(/[^\d.-]/g, ''));
            
            if (item.title === "商品总额" && item.extraInfo && item.extraInfo.id === "productPrice") {
                item.money = `¥ ${DETAIL_NEW_PRODUCT_PRICE.toFixed(2)}`;
            } else if (item.title === "运费" && item.extraInfo && item.extraInfo.id === "freightFee") {
                item.money = `+ ¥ ${DETAIL_FREIGHT_FEE.toFixed(2)}`; 
            } else if (item.title === "打包费" && moneyFloat === 2.00) {
                item.money = `+ ¥ ${DETAIL_PACKAGING_FEE.toFixed(2)}`; 
            } else if (item.title === "促销立减" && moneyFloat === -25.00) {
                // 确保促销立减的金额是负值，并与计算结果匹配
                item.money = `- ¥ ${Math.abs(NEW_PROMOTION_REDUCTION_CALCULATED).toFixed(2)}`;
                console.log(`-> Promotion Reduction (促销立减) modified based on calculation.`);
            } else if (item.title === "商品优惠" && moneyFloat === -11.00) {
                item.money = `- ¥ ${DETAIL_DISCOUNT_1.toFixed(2)}`; 
            } else if (item.title === "商品优惠" && moneyFloat === -9.00) {
                item.money = `- ¥ ${DETAIL_DISCOUNT_2.toFixed(2)}`; 
            }
        });
    }
    console.log("-> Bills List (价格明细) modification completed.");

    // --- 订单号和时间修改 ---
    
    // 2. 进度列表 ProgressList (物流/地址)
    if (data.progressList && data.progressList.length > 0) {
        if (data.progressList[0] && data.progressList[0].tip) {
            data.progressList[0].tip = DETAIL_NEW_COMPLETE_TIME;
        }
    }

    // 3. 订单通用信息 orderCommonVo
    if (data.orderCommonVo) {
        data.orderCommonVo.dateSubmit = `${DETAIL_NEW_DATE_BASE} ${DETAIL_NEW_TIME_BASE}`;
        data.orderCommonVo.orderCompleteTime = DETAIL_NEW_COMPLETE_TIME;
    }

    // 4. 汇总信息 SummaryList (用户可见的订单信息汇总)
    if (data.summaryList) {
        data.summaryList.forEach(item => {
            if (item.title === "订单编号：") {
                item.content = DETAIL_NEW_ORDER_ID;
            } else if (item.title === "下单时间：") {
                item.content = `${DETAIL_NEW_DATE_BASE} ${DETAIL_NEW_TIME_BASE}`;
            } else if (item.title === "支付时间：") {
                item.content = DETAIL_NEW_PAY_TIME;
            } else if (item.title === "期望配送时间：") {
                item.content = DETAIL_NEW_EXPECTED_DELIVERY_TIME;
            } else if (item.title === "门店名称：") {
                item.content = "饭福星·炭火烤肉拌饭·烤排饭（昆明店）"; 
            }
        });
        console.log("-> Summary List (订单汇总信息) updated with new times and ID.");
    }

    // 5. 基础信息 baseInfo
    if (data.baseInfo) {
        data.baseInfo.currentTime = DETAIL_NEW_CURRENT_TIME; 
    }

    // 6. 商店列表 ShopList (商品价格)
    if (data.shopList && data.shopList[0] && data.shopList[0].orderWareList && data.shopList[0].orderWareList[0]) {
        const ware = data.shopList[0].orderWareList[0];
        ware.price = DETAIL_NEW_PRODUCT_PRICE.toFixed(2);
        ware.priceList[0].price = DETAIL_NEW_PRODUCT_PRICE.toFixed(2);
        ware.name = "招牌烤肉饭+大脸鸡排+烤肠/煎蛋/饮料三选一"; 

        // 更新商店下的商品总额显示
        data.shopList[0].shopTotalNum = `¥ ${DETAIL_NEW_PRODUCT_PRICE.toFixed(2)}`; 
        console.log("-> Shop List (商品信息) updated with new name and price.");
    }
    console.log("✨ [JD Rewrite] DETAIL SCRIPT COMPLETED.");
}

$done({body: JSON.stringify(obj)});
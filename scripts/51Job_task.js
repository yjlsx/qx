/**
 * 前程无忧 - 用户任务列表移除
 * 对应 Loon: response.json.delete("resultbody.availableTaskList")
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.resultbody && obj.resultbody.availableTaskList) {
        delete obj.resultbody.availableTaskList;
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("51Job task: " + e.message);
}
$done({ body });

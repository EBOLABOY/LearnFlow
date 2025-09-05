// SmartEdu Agent - 页面注入脚本
// 负责执行需要在页面主世界（Main World）完成的高权限操作
(() => {
    'use strict';
    
    // 创建命名空间，避免全局污染
    const ns = (window.DeepLearnSmartEduAgent ||= {});
    
    console.log('[深学助手] SmartEdu Agent 正在初始化...');
    
    // 全局变量定义（从油猴脚本迁移）
    ns.g_headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "sdp-app-id": null,
        "Authorization": null
    };
    ns.g_user_id = null;
    ns.g_fulls_json = null;
    
    // 保存原始 XMLHttpRequest
    const originalXMLHttpRequest = window.XMLHttpRequest;
    
    // 核心功能：XHR 劫持（从油猴脚本迁移）
    ns.initXHRIntercept = function() {
        console.log('[深学助手] 开始初始化 XHR 拦截器...');
        
        // 重写 XMLHttpRequest
        window.XMLHttpRequest = function () {
            const xhr = new originalXMLHttpRequest();

            // 保存原始的 open、send 和 setRequestHeader 方法
            const originalOpen = xhr.open;
            const originalSend = xhr.send;
            const originalSetRequestHeader = xhr.setRequestHeader;

            // 重写 open 方法
            xhr.open = function (method, url, async, user, password) {
                this._method = method;
                this._url = url;
                return originalOpen.apply(this, arguments);
            };

            // 重写 setRequestHeader 方法
            xhr.setRequestHeader = function (header, value) {
                // 保存headers
                this._headers = this._headers || {};
                this._headers[header] = value;
                // 保存token
                if (header in ["sdp-app-id", "Authorization"]) {
                    ns.g_headers[header] = value;
                }
                return originalSetRequestHeader.apply(this, arguments);
            };

            // 重写 send 方法
            xhr.send = function (data) {
                // 监听 readyState 的变化
                this.addEventListener('readystatechange', function () {
                    if (this.readyState === 4) { // 请求完成
                        // 处理响应数据
                        if (this._url && this._url.includes('fulls.json')) { // 根据需要修改 URL 条件
                            try {
                                ns.g_fulls_json = JSON.parse(this.responseText);
                                console.log('[深学助手] 成功获取 fulls.json:', ns.g_fulls_json);
                            } catch (e) {
                                console.warn('[深学助手] fulls.json获取失败：', e);
                            }
                        }
                    }
                });

                return originalSend.apply(this, arguments);
            };

            return xhr;
        };
        
        // 保持原型链完整
        window.XMLHttpRequest.prototype = originalXMLHttpRequest.prototype;
        console.log('[深学助手] XHR 拦截器初始化完成');
    };
    
    // 用户ID获取功能（从油猴脚本迁移）
    ns.getUserId = function() {
        if (ns.g_user_id) {
            return ns.g_user_id;
        }

        try {
            let user = JSON.parse(localStorage.getItem("X-EDU-WEB-USER"));
            ns.g_user_id = user.user_id;
            console.log('[深学助手] 获取用户ID:', ns.g_user_id);
            return ns.g_user_id;
        } catch (e) {
            console.error('[深学助手] 获取用户ID失败:', e);
            return null;
        }
    };
    
    // 获取课程完成状态（从油猴脚本迁移）
    ns.getFullsJson = function() {
        return ns.g_fulls_json;
    };
    
    // 处理节点的递归函数（从油猴脚本迁移）
    ns.processNode = function(node) {
        if (node.child_nodes && node.child_nodes.length > 0) {
            // 如果有子节点，递归处理
            for (const cnode of node.child_nodes) {
                ns.processNode(cnode);
            }
        } else {
            let fulls_json = ns.getFullsJson();
            if (!fulls_json) {
                console.warn('[深学助手] fulls_json 数据不可用，跳过节点处理');
                return;
            }
            
            // 最深层节点，进行请求操作
            let vid = node.relations.activity.activity_resources[0].resource_id;
            let position = node.relations.activity.study_time;
            console.log(`[深学助手] 【${fulls_json.activity_set_name}】【${node.node_name}】【${vid}】`);
            
            try {
                let method = "PUT";
                let url = "https://x-study-record-api.ykt.eduyun.cn/v1/resource_learning_positions/"
                + vid + "/" + ns.getUserId();
                
                // 创建xhr请求
                const xhr = new originalXMLHttpRequest();
                xhr.open(method, url, true);
                
                // 设置headers
                for (const key in ns.g_headers) {
                    if (ns.g_headers[key]) {
                        xhr.setRequestHeader(key, ns.g_headers[key]);
                    }
                }
                
                xhr.onload = function () {
                    if (xhr.status === 200 || xhr.status === 201) {
                        console.log('[深学助手] 秒过请求成功:', xhr.responseText);
                    } else {
                        console.error('[深学助手] 秒过请求失败:', xhr.status);
                    }
                };
                
                // 篡改视频进度
                xhr.send(JSON.stringify({"position": position - 5}));
            } catch (e) {
                console.log("[深学助手] 秒过失败：", e);
            }
        }
    };
    
    // 核心功能：执行秒过操作（从油猴脚本迁移）
    ns.executeFakeXHR = function() {
        let fulls_json = ns.getFullsJson();
        console.log("[深学助手] 执行秒过操作", fulls_json);
        
        if (!fulls_json || !fulls_json.nodes) {
            console.warn('[深学助手] fulls_json 数据不可用或格式错误');
            // 通知控制器数据不可用
            window.postMessage({
                target: 'deeplearn-smartedu-controller',
                command: 'FAKE_XHR_ERROR',
                payload: 'fulls_json 数据不可用'
            }, '*');
            return;
        }
        
        for (const node of fulls_json.nodes) {
            ns.processNode(node);
        }
        
        // 通知控制器秒过完成
        window.postMessage({
            target: 'deeplearn-smartedu-controller',
            command: 'FAKE_XHR_COMPLETED',
            payload: `处理了 ${fulls_json.nodes.length} 个节点`
        }, '*');
    };
    
    // 监听来自 Content Script 的命令
    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data || event.data.target !== 'deeplearn-smartedu-agent') {
            return;
        }
        
        const { command, payload } = event.data;
        console.log('[深学助手] Agent 收到命令:', command);
        
        switch (command) {
            case 'INIT_XHR_INTERCEPT':
                ns.initXHRIntercept();
                break;
                
            case 'EXECUTE_FAKE_XHR':
                ns.executeFakeXHR();
                break;
                
            case 'GET_USER_ID':
                window.postMessage({
                    target: 'deeplearn-smartedu-controller',
                    command: 'USER_ID_RESPONSE',
                    payload: ns.getUserId()
                }, '*');
                break;
                
            case 'GET_FULLS_JSON':
                window.postMessage({
                    target: 'deeplearn-smartedu-controller',
                    command: 'FULLS_JSON_RESPONSE',
                    payload: ns.getFullsJson()
                }, '*');
                break;
                
            default:
                console.warn('[深学助手] 未知命令:', command);
        }
    });
    
    // 自动初始化 XHR 拦截器
    ns.initXHRIntercept();
    
    // 发送就绪状态通知给 Controller
    setTimeout(() => {
        window.postMessage({
            target: 'deeplearn-smartedu-controller',
            command: 'AGENT_READY',
            payload: {
                timestamp: Date.now(),
                version: '2.0',
                capabilities: ['xhr-intercept', 'fake-xhr', 'user-data']
            }
        }, '*');
        console.log('[深学助手] Agent 就绪状态已通知给 Controller');
    }, 100); // 延迟100ms确保其他初始化完成
    
    console.log('[深学助手] SmartEdu Agent 初始化完成');
    
})();
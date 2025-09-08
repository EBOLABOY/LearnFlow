// SmartEdu Agent - 页面注入脚本
// 负责执行需要在页面主世界（Main World）完成的高权限操作
(() => {
    'use strict';
    // 限定消息来源为当前页面源，防止跨源消息滥用
    const TARGET_ORIGIN = window.location.origin;
    const AGENT_VERSION = (window && window.__DEEPLEARN_ASSISTANT_VERSION__) || 'unknown';
    
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
                if (["sdp-app-id", "Authorization"].includes(header)) {
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

    // 兼容 fetch 的拦截与 fulls.json 捕获
    ns.initFetchIntercept = function() {
        try {
            if (!window.fetch) return;
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
                try {
                    const headers = (init && init.headers) ? new Headers(init.headers) : null;
                    if (headers) {
                        try {
                            ['sdp-app-id', 'Authorization'].forEach((k) => {
                                const v = headers.get(k);
                                if (v) ns.g_headers[k] = v;
                            });
                        } catch {}
                    }
                } catch {}
                const p = originalFetch.apply(this, arguments);
                try {
                    p.then((resp) => {
                        try {
                            const url = (typeof input === 'string') ? input : (input && input.url) || '';
                            if (url && url.indexOf('fulls.json') !== -1) {
                                resp.clone().json().then((data) => {
                                    ns.g_fulls_json = data;
                                    console.log('[深学助手] (fetch) 成功获取 fulls.json');
                                }).catch(() => {});
                            }
                        } catch {}
                    }).catch(() => {});
                } catch {}
                return p;
            };
            console.log('[深学助手] fetch 拦截器初始化完成');
        } catch (e) {
            console.warn('[深学助手] 初始化 fetch 拦截失败:', e);
        }
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
    
    // 增强功能：主动拉取课程结构
    ns.fetchCourseStructure = async function() {
        console.log('[深学助手] 主动拉取课程结构...');
        
        // 方法1：从页面数据层提取（增强版）
        try {
            // 尝试从多个可能的全局变量获取
            const possibleGlobals = [
                'window.__INITIAL_STATE__',
                'window.__NUXT__',
                'window.__NEXT_DATA__',
                'window.pageData',
                'window.courseData',
                'window._courseInfo',
                'window.APP_DATA'
            ];
            
            for (const globalPath of possibleGlobals) {
                try {
                    const obj = eval(globalPath);
                    if (obj) {
                        // 深度搜索包含nodes的对象
                        const found = ns.findCourseData(obj);
                        if (found) {
                            ns.g_fulls_json = found;
                            console.log(`[深学助手] 从${globalPath}成功提取课程结构`);
                            return ns.g_fulls_json;
                        }
                    }
                } catch {}
            }
            
            // 尝试从 localStorage 获取所有相关数据
            const storageKeys = Object.keys(localStorage).filter(key => 
                key.includes('course') || key.includes('activity') || 
                key.includes('lesson') || key.includes('study')
            );
            
            for (const key of storageKeys) {
                try {
                    const data = localStorage.getItem(key);
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (parsed && (parsed.nodes || parsed.activities || parsed.lessons)) {
                            // 转换为标准格式
                            if (parsed.nodes) {
                                ns.g_fulls_json = parsed;
                            } else {
                                ns.g_fulls_json = ns.convertToStandardFormat(parsed);
                            }
                            console.log(`[深学助手] 从localStorage[${key}]成功获取课程结构`);
                            return ns.g_fulls_json;
                        }
                    }
                } catch {}
            }
            
            // 尝试从 sessionStorage 获取
            const sessionKeys = Object.keys(sessionStorage).filter(key => 
                key.includes('course') || key.includes('activity')
            );
            
            for (const key of sessionKeys) {
                try {
                    const data = sessionStorage.getItem(key);
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (parsed && parsed.nodes) {
                            ns.g_fulls_json = parsed;
                            console.log(`[深学助手] 从sessionStorage[${key}]成功获取课程结构`);
                            return ns.g_fulls_json;
                        }
                    }
                } catch {}
            }
        } catch (e) {
            console.warn('[深学助手] 页面数据层提取失败:', e);
        }
        
        // 方法2：智能API请求（增强版）
        try {
            // 从多个地方尝试获取ID
            const ids = ns.extractCourseIds();
            
            if (ids.courseId || ids.activitySetId) {
                // 尝试多个可能的API端点
                const apiEndpoints = [
                    `https://x-study-record-api.ykt.eduyun.cn/v1/activity_sets/${ids.activitySetId || ids.courseId}/fulls.json`,
                    `https://basic.smartedu.cn/api/course/${ids.courseId}/structure`,
                    `https://teacher.ykt.eduyun.cn/api/activity/${ids.activitySetId}/full`,
                    `/api/course/structure?id=${ids.courseId}` // 相对路径
                ];
                
                for (const apiUrl of apiEndpoints) {
                    try {
                        const result = await ns.tryFetchApi(apiUrl);
                        if (result) {
                            ns.g_fulls_json = result;
                            console.log(`[深学助手] 从API成功获取课程结构: ${apiUrl}`);
                            // 缓存结果
                            try {
                                localStorage.setItem('X-EDU-COURSE-DATA', JSON.stringify(result));
                                localStorage.setItem('X-EDU-COURSE-DATA-TIME', Date.now().toString());
                            } catch {}
                            return ns.g_fulls_json;
                        }
                    } catch {}
                }
            }
        } catch (e) {
            console.error('[深学助手] 主动API请求失败:', e);
        }
        
        // 方法3：智能DOM提取（增强版）
        try {
            const courseNodes = [];
            
            // 更多可能的选择器
            const selectors = [
                '.video-item',
                '.lesson-item', 
                '.course-section',
                '.course-chapter-item',
                '.study-item',
                '[data-resource-id]',
                '[data-video-id]',
                '.fish-collapse-item',
                '.activity-item',
                '.content-item'
            ];
            
            const videoElements = document.querySelectorAll(selectors.join(', '));
            
            videoElements.forEach((elem, index) => {
                // 更智能的ID提取
                const videoId = 
                    elem.getAttribute('data-video-id') || 
                    elem.getAttribute('data-resource-id') ||
                    elem.getAttribute('data-activity-id') ||
                    elem.getAttribute('id') ||
                    elem.querySelector('a')?.getAttribute('href')?.match(/[a-f0-9-]{36}/)?.[0];
                
                // 更智能的标题提取
                const videoTitle = 
                    elem.querySelector('.title, .name, .lesson-name, h3, h4')?.textContent?.trim() ||
                    elem.getAttribute('title') ||
                    elem.getAttribute('data-title') ||
                    `课程${index + 1}`;
                
                // 更智能的时长提取
                const duration = 
                    elem.getAttribute('data-duration') ||
                    elem.querySelector('.duration, .time')?.textContent?.match(/\d+/)?.[0] ||
                    300;
                
                // 检查完成状态
                const isCompleted = 
                    elem.classList.contains('completed') ||
                    elem.querySelector('.icon_checkbox_fill') ||
                    elem.getAttribute('data-completed') === 'true';
                
                if (videoId && !isCompleted) { // 只处理未完成的
                    courseNodes.push({
                        node_name: videoTitle,
                        node_id: videoId,
                        relations: {
                            activity: {
                                activity_resources: [{
                                    resource_id: videoId,
                                    resource_type: 'video'
                                }],
                                study_time: parseInt(duration)
                            }
                        },
                        child_nodes: []
                    });
                }
            });
            
            if (courseNodes.length > 0) {
                ns.g_fulls_json = {
                    activity_set_name: document.title || '智慧教育课程',
                    activity_set_id: ns.extractCourseIds().activitySetId || 'unknown',
                    nodes: courseNodes
                };
                console.log(`[深学助手] 从页面DOM成功提取${courseNodes.length}个未完成课程节点`);
                return ns.g_fulls_json;
            }
        } catch (e) {
            console.warn('[深学助手] DOM提取失败:', e);
        }
        
        return null;
    };
    
    // 辅助函数：深度搜索包含课程数据的对象
    ns.findCourseData = function(obj, depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 5) return null;
        
        // 检查是否包含nodes
        if (obj.nodes && Array.isArray(obj.nodes)) {
            return obj;
        }
        
        // 递归搜索
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const result = ns.findCourseData(obj[key], depth + 1);
                if (result) return result;
            }
        }
        
        return null;
    };
    
    // 辅助函数：转换非标准格式到标准格式
    ns.convertToStandardFormat = function(data) {
        const nodes = [];
        
        if (data.activities) {
            data.activities.forEach(activity => {
                nodes.push({
                    node_name: activity.name || activity.title,
                    relations: {
                        activity: {
                            activity_resources: [{
                                resource_id: activity.id || activity.resource_id
                            }],
                            study_time: activity.duration || 300
                        }
                    },
                    child_nodes: []
                });
            });
        }
        
        if (data.lessons) {
            data.lessons.forEach(lesson => {
                if (lesson.videos) {
                    lesson.videos.forEach(video => {
                        nodes.push({
                            node_name: video.title || lesson.title,
                            relations: {
                                activity: {
                                    activity_resources: [{
                                        resource_id: video.id
                                    }],
                                    study_time: video.duration || 300
                                }
                            },
                            child_nodes: []
                        });
                    });
                }
            });
        }
        
        return nodes.length > 0 ? { nodes, activity_set_name: '课程' } : null;
    };
    
    // 辅助函数：提取课程ID
    ns.extractCourseIds = function() {
        const ids = {};
        
        // 从URL参数提取
        const urlParams = new URLSearchParams(window.location.search);
        ids.courseId = urlParams.get('courseId') || urlParams.get('course_id') || urlParams.get('id');
        ids.activitySetId = urlParams.get('activity_set_id') || urlParams.get('activitySetId');
        
        // 从URL路径提取
        const pathMatch = window.location.pathname.match(/([a-f0-9-]{36})/);
        if (pathMatch) {
            ids.pathId = pathMatch[1];
        }
        
        // 从页面元素提取
        const metaId = document.querySelector('meta[name="course-id"]')?.getAttribute('content');
        if (metaId) ids.metaId = metaId;
        
        return ids;
    };
    
    // 辅助函数：尝试API请求
    ns.tryFetchApi = async function(url) {
        return new Promise((resolve) => {
            const xhr = new originalXMLHttpRequest();
            xhr.open('GET', url, true);
            
            // 设置headers
            for (const key in ns.g_headers) {
                if (ns.g_headers[key]) {
                    xhr.setRequestHeader(key, ns.g_headers[key]);
                }
            }
            
            xhr.timeout = 5000; // 5秒超时
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data && (data.nodes || data.activities)) {
                            resolve(data);
                        } else {
                            resolve(null);
                        }
                    } catch {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            };
            
            xhr.onerror = xhr.ontimeout = () => resolve(null);
            xhr.send();
        });
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
    
    // 核心功能：执行秒过操作（增强版 - 支持主动拉取）
    ns.executeFakeXHR = async function() {
        let fulls_json = ns.getFullsJson();
        console.log("[深学助手] 执行秒过操作", fulls_json);
        
        // 如果没有fulls_json，尝试主动获取
        if (!fulls_json || !fulls_json.nodes) {
            console.log('[深学助手] fulls_json 不存在，尝试主动获取...');
            
            try {
                // 尝试主动拉取课程结构
                fulls_json = await ns.fetchCourseStructure();
                
                if (!fulls_json || !fulls_json.nodes) {
                    // 如果还是获取失败，尝试延迟后再试一次（页面可能还在加载）
                    console.log('[深学助手] 首次获取失败，等待2秒后重试...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    fulls_json = await ns.fetchCourseStructure();
                }
            } catch (e) {
                console.error('[深学助手] 主动获取课程结构失败:', e);
            }
        }
        
        // 再次检查是否成功获取
        if (!fulls_json || !fulls_json.nodes) {
            console.warn('[深学助手] fulls_json 数据仍然不可用');
            // 通知控制器数据不可用
            window.postMessage({
                target: 'deeplearn-smartedu-controller',
                command: 'FAKE_XHR_ERROR',
                payload: '无法获取课程结构数据，请刷新页面重试'
            }, TARGET_ORIGIN);
            return;
        }
        
        console.log('[深学助手] 开始处理课程节点，总数:', fulls_json.nodes.length);
        
        // 处理所有节点
        for (const node of fulls_json.nodes) {
            ns.processNode(node);
        }
        
        // 通知控制器秒过完成
        window.postMessage({
            target: 'deeplearn-smartedu-controller',
            command: 'FAKE_XHR_COMPLETED',
            payload: `成功处理 ${fulls_json.nodes.length} 个课程节点`
        }, TARGET_ORIGIN);
    };
    
    // 监听来自 Content Script 的命令
    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data || event.data.target !== 'deeplearn-smartedu-agent' || event.origin !== TARGET_ORIGIN) {
            return;
        }
        
        const { command, payload } = event.data;
        console.log('[深学助手] Agent 收到命令:', command);
        
        switch (command) {
            case 'INIT_XHR_INTERCEPT':
                ns.initXHRIntercept();
                ns.initFetchIntercept();
                break;
                
            case 'EXECUTE_FAKE_XHR':
                ns.executeFakeXHR();
                break;
                
            case 'GET_USER_ID':
                window.postMessage({
                    target: 'deeplearn-smartedu-controller',
                    command: 'USER_ID_RESPONSE',
                    payload: ns.getUserId()
                }, TARGET_ORIGIN);
                break;
                
            case 'GET_FULLS_JSON':
                window.postMessage({
                    target: 'deeplearn-smartedu-controller',
                    command: 'FULLS_JSON_RESPONSE',
                    payload: ns.getFullsJson()
                }, TARGET_ORIGIN);
                break;
                
            case 'DIAGNOSE_COURSE_DATA':
                // 诊断功能：检查课程数据获取状态
                ns.diagnoseCourseData();
                break;
                
            case 'FORCE_FETCH_COURSE':
                // 强制获取课程结构
                ns.fetchCourseStructure().then(result => {
                    window.postMessage({
                        target: 'deeplearn-smartedu-controller',
                        command: 'FORCE_FETCH_RESPONSE',
                        payload: result ? '成功获取课程结构' : '获取失败'
                    }, TARGET_ORIGIN);
                });
                break;
                
            default:
                console.warn('[深学助手] 未知命令:', command);
        }
    });
    
    // 诊断功能：检查课程数据获取能力
    ns.diagnoseCourseData = async function() {
        const diagnosis = {
            timestamp: new Date().toISOString(),
            status: {},
            recommendations: []
        };
        
        // 检查当前fulls_json状态
        diagnosis.status.currentData = ns.g_fulls_json ? '已获取' : '未获取';
        if (ns.g_fulls_json) {
            diagnosis.status.nodeCount = ns.g_fulls_json.nodes ? ns.g_fulls_json.nodes.length : 0;
        }
        
        // 检查Headers
        diagnosis.status.headers = {
            'sdp-app-id': ns.g_headers['sdp-app-id'] ? '已设置' : '未设置',
            'Authorization': ns.g_headers['Authorization'] ? '已设置' : '未设置'
        };
        
        // 检查用户ID
        diagnosis.status.userId = ns.getUserId() ? '已获取' : '未获取';
        
        // 检查URL参数
        const ids = ns.extractCourseIds();
        diagnosis.status.courseIds = ids;
        
        // 检查localStorage
        const storageKeys = Object.keys(localStorage).filter(key => 
            key.includes('course') || key.includes('activity')
        );
        diagnosis.status.localStorage = `找到${storageKeys.length}个相关键`;
        
        // 检查DOM元素
        const videoElements = document.querySelectorAll(
            '.video-item, .lesson-item, .course-section, [data-resource-id]'
        );
        diagnosis.status.domElements = `找到${videoElements.length}个可能的课程元素`;
        
        // 生成建议
        if (!ns.g_fulls_json) {
            diagnosis.recommendations.push('fulls.json未获取，建议刷新页面或手动触发获取');
        }
        if (!ns.g_headers['Authorization']) {
            diagnosis.recommendations.push('授权头未设置，可能需要先登录');
        }
        if (!ids.courseId && !ids.activitySetId) {
            diagnosis.recommendations.push('无法从URL提取课程ID，检查是否在正确的课程页面');
        }
        
        console.log('[深学助手] 诊断结果:', diagnosis);
        
        // 发送诊断结果给控制器
        window.postMessage({
            target: 'deeplearn-smartedu-controller',
            command: 'DIAGNOSIS_RESULT',
            payload: diagnosis
        }, TARGET_ORIGIN);
        
        return diagnosis;
    };
    
    // 自动初始化 XHR 拦截器
    ns.initXHRIntercept();
    ns.initFetchIntercept();
    
    // 发送就绪状态通知给 Controller
    setTimeout(() => {
        window.postMessage({
            target: 'deeplearn-smartedu-controller',
            command: 'AGENT_READY',
            payload: {
                timestamp: Date.now(),
                version: AGENT_VERSION,
                capabilities: ['xhr-intercept', 'fake-xhr', 'user-data']
            }
        }, TARGET_ORIGIN);
        console.log('[深学助手] Agent 就绪状态已通知给 Controller');
    }, 100); // 延迟100ms确保其他初始化完成
    
    console.log('[深学助手] SmartEdu Agent 初始化完成');
    
})();

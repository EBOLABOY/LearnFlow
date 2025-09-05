// SmartEdu Automation - 自动化流程控制
// 负责 DOM 操作、页面逻辑判断和流程控制
(() => {
    const ns = (window.DeepLearn ||= {});
    const siteNS = (ns.sites ||= {});
    const smartedu = (siteNS.smartedu ||= {});
    const util = ns.util; // 使用现有工具库
    
    // 默认配置（从统一数据源获取）
    const smarteduConfig = ns.sites.smartedu; // 引用统一配置
    const DEFAULT_CONFIG = {
        courseName: smarteduConfig.PLATFORM_CONFIG.courseName,
        homeUrl: smarteduConfig.PLATFORM_CONFIG.homeUrl,
        courseUrls: smarteduConfig.getCourseUrls(),
        lessons: smarteduConfig.getDefaultLessons(),
        watchInterval: smarteduConfig.PLATFORM_CONFIG.watchInterval,
        autoNext: smarteduConfig.PLATFORM_CONFIG.autoNext
    };
    
    let config = DEFAULT_CONFIG;
    let isRunning = false;
    let watchTimer = null;
    let tick = 0;
    let pageNumber = null;
    let pageCount = null;
    
    // Agent 握手状态管理
    let agentReady = false;
    let pendingAgentCommands = [];
    
    const AGENT_READY_TIMEOUT = 10000; // 10秒超时
    
    // 初始化自动化模块
    smartedu.initAutomation = async function() {
        console.log('[深学助手] SmartEdu 自动化模块初始化中...');
        
        try {
            // 1. 注入 Agent 脚本并等待握手完成
            const agentSuccess = await injectAgent();
            if (agentSuccess) {
                console.log('[深学助手] Agent 握手成功，所有功能可用');
            } else {
                console.warn('[深学助手] Agent 握手失败，某些功能可能不可用');
            }
            
            // 2. 加载用户配置
            await loadConfig();
            console.log('[深学助手] 配置加载完成:', config);
            
            // 3. 检查是否启用自动化
            checkAutoMode();
            
            // 4. 监听来自 Agent 的消息
            window.addEventListener('message', handleAgentMessage);
            
            // 5. 监听页面 PDF 消息
            window.addEventListener('message', handlePDFMessage);
            
            // 6. 设置键盘快捷键（用于调试）
            setupKeyboardShortcuts();
            
        } catch (error) {
            console.error('[深学助手] 自动化模块初始化失败:', error);
            showMessage('❌ 模块初始化失败', 5000);
        }
    };
    
    // 注入 Agent 脚本
    function injectAgent() {
        return new Promise((resolve, reject) => {
            const agentScript = document.createElement('script');
            agentScript.src = chrome.runtime.getURL('src/sites/smartedu/agent.js');
            (document.head || document.documentElement).appendChild(agentScript);
            
            agentScript.onload = () => {
                agentScript.remove();
                console.log('[深学助手] Agent 脚本注入成功，等待握手...');
                
                // 设置超时机制
                const timeout = setTimeout(() => {
                    console.warn('[深学助手] Agent 握手超时，继续执行但可能功能受限');
                    agentReady = false;
                    resolve(false); // 超时但不拒绝，允许继续执行
                }, AGENT_READY_TIMEOUT);
                
                // 监听 Agent 就绪消息（一次性）
                const handleAgentReady = (event) => {
                    if (event.source === window && 
                        event.data?.target === 'deeplearn-smartedu-controller' && 
                        event.data?.command === 'AGENT_READY') {
                        
                        clearTimeout(timeout);
                        window.removeEventListener('message', handleAgentReady);
                        
                        agentReady = true;
                        console.log('[深学助手] Agent 握手成功！能力:', event.data.payload.capabilities);
                        
                        // 执行挂起的命令
                        processPendingAgentCommands();
                        
                        resolve(true);
                    }
                };
                
                window.addEventListener('message', handleAgentReady);
            };
            
            agentScript.onerror = () => {
                console.error('[深学助手] Agent 脚本注入失败');
                reject(new Error('Agent script injection failed'));
            };
        });
    }
    
    // 加载用户配置
    function loadConfig() {
        return new Promise((resolve) => {
            chrome.storage.sync.get('smartEduConfig', (data) => {
                if (data.smartEduConfig) {
                    // 合并用户配置与默认配置
                    config = { ...DEFAULT_CONFIG, ...data.smartEduConfig };
                    
                    // 处理特殊配置格式
                    if (data.smartEduConfig.lessons && Array.isArray(data.smartEduConfig.lessons)) {
                        config.lessons = data.smartEduConfig.lessons;
                    }
                    
                    if (data.smartEduConfig.courseUrl) {
                        config.customCourseUrl = data.smartEduConfig.courseUrl;
                    }
                    
                    if (data.smartEduConfig.watchInterval) {
                        config.watchInterval = data.smartEduConfig.watchInterval;
                    }
                }
                resolve();
            });
        });
    }
    
    // 检查是否启用自动模式
    function checkAutoMode() {
        chrome.storage.sync.get('enabledSites', (data) => {
            const enabledSites = data.enabledSites || {};
            const currentDomain = location.hostname;
            const isEnabled = enabledSites[currentDomain] !== false;
            
            if (isEnabled) {
                console.log('[深学助手] 自动模式已启用，开始执行...');
                setTimeout(() => {
                    startMainLogic();
                }, 2000); // 延时2秒开始
            } else {
                console.log('[深学助手] 自动模式未启用或站点被禁用');
            }
        });
    }
    
    // 向 Agent 发送命令（带握手检查）
    function sendCommandToAgent(command, payload = null) {
        const commandData = {
            target: 'deeplearn-smartedu-agent',
            command: command,
            payload: payload,
            timestamp: Date.now()
        };
        
        if (agentReady) {
            console.log(`[深学助手] 发送命令给 Agent: ${command}`);
            window.postMessage(commandData, '*');
        } else {
            console.log(`[深学助手] Agent 未就绪，命令入队: ${command}`);
            pendingAgentCommands.push(commandData);
        }
    }
    
    // 处理挂起的 Agent 命令
    function processPendingAgentCommands() {
        if (pendingAgentCommands.length > 0) {
            console.log(`[深学助手] 执行 ${pendingAgentCommands.length} 个挂起的命令`);
            pendingAgentCommands.forEach(commandData => {
                console.log(`[深学助手] 执行挂起命令: ${commandData.command}`);
                window.postMessage(commandData, '*');
            });
            pendingAgentCommands = [];
        }
    }
    
    // 处理来自 Agent 的消息
    function handleAgentMessage(event) {
        if (event.source !== window || !event.data || event.data.target !== 'deeplearn-smartedu-controller') {
            return;
        }
        
        const { command, payload } = event.data;
        console.log('[深学助手] Controller 收到 Agent 消息:', command, payload);
        
        switch (command) {
            case 'AGENT_READY':
                // 这个消息已经在注入时处理过了，这里只是记录
                console.log('[深学助手] Agent 状态确认：已就绪');
                break;
                
            case 'USER_ID_RESPONSE':
                console.log('[深学助手] 用户ID:', payload);
                break;
                
            case 'FULLS_JSON_RESPONSE':
                console.log('[深学助手] 课程数据:', payload);
                break;
                
            case 'FAKE_XHR_COMPLETED':
                console.log('[深学助手] 秒过操作完成:', payload);
                showMessage('✅ 秒过操作完成！', 3000);
                break;
                
            case 'FAKE_XHR_ERROR':
                console.warn('[深学助手] 秒过操作失败:', payload);
                showMessage('❌ 秒过操作失败: ' + payload, 5000);
                break;
                
            default:
                console.log('[深学助手] 未处理的 Agent 消息:', command, payload);
        }
    }
    
    // 处理 PDF 相关消息（从油猴脚本迁移）
    function handlePDFMessage(event) {
        if (!event.data) return;
        
        const data = event.data;
        console.log('[深学助手] PDF 消息:', data.type);
        
        if (data.type === "pdfPlayerInitPage") {
            pageNumber = data.data.pageNumber;
            pageCount = data.data.pageCount;
            console.log(`[深学助手] PDF文档初始化: pageNumber=>${pageNumber}, pageCount=>${pageCount}`);
        }
    }
    
    // 设置键盘快捷键
    function setupKeyboardShortcuts() {
        document.addEventListener("keydown", function (event) {
            console.log('[深学助手] 键盘事件:', event.code);
            
            if (event.code === "KeyG") {
                // 触发秒过操作
                showMessage('🚀 执行秒过操作...', 3000);
                sendCommandToAgent('EXECUTE_FAKE_XHR');
            } else if (event.code === "KeyT") {
                // 测试功能
                showMessage('🔧 测试功能', 2000);
                console.log('[深学助手] 测试功能触发');
            }
        });
    }
    
    // 通知系统管理器（使用 Shadow DOM 防止样式污染）
    const NotificationManager = {
        shadowHost: null,
        shadowRoot: null,
        
        // 初始化 Shadow DOM
        init() {
            if (this.shadowHost) return; // 避免重复初始化
            
            // 创建 Shadow Host 元素
            this.shadowHost = document.createElement('div');
            this.shadowHost.id = 'deeplearn-smartedu-notifications';
            this.shadowHost.style.cssText = `
                position: fixed;
                top: 0;
                right: 0;
                z-index: 2147483647;
                pointer-events: none;
                width: 0;
                height: 0;
            `;
            
            // 创建 Shadow Root
            this.shadowRoot = this.shadowHost.attachShadow({ mode: 'closed' });
            
            // 注入样式到 Shadow DOM
            const style = document.createElement('style');
            style.textContent = `
                :host {
                    all: initial;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 
                                 Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                }
                
                .notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 2147483647;
                    pointer-events: none;
                    max-width: 400px;
                }
                
                .notification {
                    background: #4CAF50;
                    color: white;
                    padding: 16px 20px;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.24), 0 4px 8px rgba(0,0,0,0.12);
                    margin-bottom: 12px;
                    font-size: 14px;
                    line-height: 1.4;
                    word-wrap: break-word;
                    pointer-events: auto;
                    cursor: pointer;
                    transform: translateX(100%);
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    opacity: 0;
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255,255,255,0.1);
                }
                
                .notification.show {
                    transform: translateX(0);
                    opacity: 1;
                }
                
                .notification.error {
                    background: #f44336;
                    border-color: rgba(255,255,255,0.15);
                }
                
                .notification.warning {
                    background: #FF9800;
                    color: #333;
                }
                
                .notification.info {
                    background: #2196F3;
                }
                
                .notification:hover {
                    transform: translateX(0) scale(1.02);
                    box-shadow: 0 12px 40px rgba(0,0,0,0.3);
                }
                
                .notification-content {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }
                
                .notification-icon {
                    flex-shrink: 0;
                    font-size: 18px;
                    margin-top: 1px;
                }
                
                .notification-text {
                    flex: 1;
                    font-weight: 500;
                }
                
                .notification-close {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    width: 20px;
                    height: 20px;
                    border: none;
                    background: rgba(255,255,255,0.2);
                    color: inherit;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                }
                
                .notification-close:hover {
                    opacity: 1;
                    background: rgba(255,255,255,0.3);
                }
            `;
            
            // 创建通知容器
            const container = document.createElement('div');
            container.className = 'notification-container';
            
            this.shadowRoot.appendChild(style);
            this.shadowRoot.appendChild(container);
            
            // 将 Shadow Host 添加到页面
            document.documentElement.appendChild(this.shadowHost);
            
            console.log('[深学助手] Shadow DOM 通知系统已初始化');
        },
        
        // 显示通知
        show(message, type = 'success', duration = 3000) {
            this.init(); // 确保已初始化
            
            const container = this.shadowRoot.querySelector('.notification-container');
            
            // 创建通知元素
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            
            // 图标映射
            const icons = {
                success: '✅',
                error: '❌', 
                warning: '⚠️',
                info: 'ℹ️'
            };
            
            notification.innerHTML = `
                <div class="notification-content">
                    <div class="notification-icon">${icons[type] || icons.info}</div>
                    <div class="notification-text">${message}</div>
                </div>
                <button class="notification-close" title="关闭">×</button>
            `;
            
            // 绑定关闭事件
            const closeBtn = notification.querySelector('.notification-close');
            closeBtn.addEventListener('click', () => {
                this.remove(notification);
            });
            
            // 点击通知关闭
            notification.addEventListener('click', (e) => {
                if (e.target !== closeBtn) {
                    this.remove(notification);
                }
            });
            
            // 添加到容器
            container.appendChild(notification);
            
            // 触发动画
            requestAnimationFrame(() => {
                notification.classList.add('show');
            });
            
            // 自动移除
            if (duration > 0) {
                setTimeout(() => {
                    this.remove(notification);
                }, duration);
            }
            
            return notification;
        },
        
        // 移除通知
        remove(notification) {
            if (!notification || !notification.parentNode) return;
            
            notification.style.transform = 'translateX(100%) scale(0.8)';
            notification.style.opacity = '0';
            notification.style.marginBottom = '0';
            notification.style.height = '0';
            notification.style.paddingTop = '0';
            notification.style.paddingBottom = '0';
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        },
        
        // 清除所有通知
        clear() {
            if (!this.shadowRoot) return;
            
            const container = this.shadowRoot.querySelector('.notification-container');
            if (container) {
                const notifications = container.querySelectorAll('.notification');
                notifications.forEach(notification => {
                    this.remove(notification);
                });
            }
        },
        
        // 销毁通知系统
        destroy() {
            if (this.shadowHost && this.shadowHost.parentNode) {
                this.shadowHost.parentNode.removeChild(this.shadowHost);
            }
            this.shadowHost = null;
            this.shadowRoot = null;
        }
    };
    
    // 显示消息（使用 Shadow DOM 通知系统）
    function showMessage(message, duration = 3000, type = 'success') {
        // 根据消息内容自动判断类型
        if (!type || type === 'success') {
            if (message.includes('❌') || message.includes('失败') || message.includes('错误')) {
                type = 'error';
            } else if (message.includes('⚠️') || message.includes('警告')) {
                type = 'warning';
            } else if (message.includes('ℹ️') || message.includes('提示')) {
                type = 'info';
            }
        }
        
        return NotificationManager.show(message, type, duration);
    }
    
    // 开始主逻辑（从油猴脚本的 main 函数迁移）
    function startMainLogic() {
        console.log('[深学助手] 开始主逻辑...');
        
        const href = window.location.href;
        console.log('[深学助手] 当前页面:', href);
        
        // 判断当前页面类型并执行对应逻辑
        if (config.courseUrls.includes(href)) {
            console.log('[深学助手] 检测到课程页面，开始刷课处理');
            showMessage('📚 开始自动学习课程...', 5000);
            startWatching();
        } else if (href.includes('https://smartedu.gdtextbook.com/education/')) {
            console.log('[深学助手] 广东特色教育平台iframe处理');
            // 可以在这里添加广东特色平台的特殊处理
        } else if (href.includes('https://teacher.ykt.eduyun.cn/pdfjs/')) {
            console.log('[深学助手] PDF处理');
            startPDFReading();
        } else {
            console.log('[深学助手] 主页面，显示选择菜单');
            showMainMenu();
        }
    }
    
    // 显示主菜单（替代油猴脚本的 SweetAlert 菜单）
    function showMainMenu() {
        const menuHtml = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); 
                        z-index: 10000; padding: 24px; min-width: 400px; font-family: system-ui;">
                <h2 style="margin: 0 0 20px; text-align: center; color: #333;">深学助手 - 智慧教育平台</h2>
                <p style="text-align: center; color: #666; margin-bottom: 24px;">选择您要执行的操作：</p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button id="smartedu-start-courses" style="padding: 12px 24px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                        🚀 开始刷配置的课程<br><small style="opacity: 0.8;">${config.courseName}</small>
                    </button>
                    <button id="smartedu-current-page" style="padding: 12px 24px; background: #2196F3; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                        📖 只刷当前页的视频
                    </button>
                    <button id="smartedu-close-menu" style="padding: 12px 24px; background: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                        ❌ 退出
                    </button>
                </div>
            </div>
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;" id="smartedu-menu-overlay"></div>
        `;
        
        const menuContainer = document.createElement('div');
        menuContainer.innerHTML = menuHtml;
        document.body.appendChild(menuContainer);
        
        // 绑定事件
        document.getElementById('smartedu-start-courses').onclick = () => {
            menuContainer.remove();
            showMessage('🚀 开始刷课程...', 3000);
            nextCourse();
        };
        
        document.getElementById('smartedu-current-page').onclick = () => {
            menuContainer.remove();
            showMessage('📖 开始当前页面学习...', 3000);
            startWatching();
        };
        
        document.getElementById('smartedu-close-menu').onclick = () => {
            menuContainer.remove();
        };
        
        document.getElementById('smartedu-menu-overlay').onclick = () => {
            menuContainer.remove();
        };
    }
    
    // 跳转到下一个课程（从油猴脚本的 next 函数迁移）
    function nextCourse() {
        const href = window.location.href;
        const index = config.courseUrls.indexOf(href);
        
        if (index > -1) {
            if (index + 1 < config.courseUrls.length) {
                console.log(`[深学助手] 跳转到下一个课程 (${index + 1}/${config.courseUrls.length})`);
                window.location.href = config.courseUrls[index + 1];
            } else {
                console.log('[深学助手] 所有课程已完成，返回主页');
                window.location.href = config.homeUrl;
            }
        } else {
            console.log('[深学助手] 开始第一个课程');
            window.location.href = config.courseUrls[0];
        }
    }
    
    // 开始监控和自动操作（从油猴脚本的 watch 函数迁移）
    function startWatching() {
        if (isRunning) {
            console.log('[深学助手] 监控已在运行中');
            return;
        }
        
        isRunning = true;
        console.log('[深学助手] 开始监控循环...');
        
        const executeMainActions = () => {
            console.log(`[深学助手] tick[${String(++tick).padStart(9, "0")}]`);
            clickNext();
            playVideo();
            readPDF();
            autoAnswer();
        };
        
        // 首次执行
        setTimeout(executeMainActions, 1000);
        
        // 定期执行
        watchTimer = setInterval(executeMainActions, config.watchInterval);
    }
    
    // 停止监控
    function stopWatching() {
        isRunning = false;
        if (watchTimer) {
            clearInterval(watchTimer);
            watchTimer = null;
        }
        console.log('[深学助手] 监控循环已停止');
    }
    
    // 点击下一个视频（从油猴脚本的 click 函数迁移）
    function clickNext(autoNext = true) {
        // 判断是否满足学时要求
        if (config.lessons) {
            const href = window.location.href;
            const index = config.courseUrls.indexOf(href);
            const lesson = config.lessons[index];
            
            if (lesson !== undefined && lesson !== -1) {
                // 展开所有折叠头部
                let headers = document.getElementsByClassName("fish-collapse-header");
                for (let i = 0; i < headers.length; i++) {
                    headers[i].click();
                }
                
                let finished = document.getElementsByClassName("iconfont icon_checkbox_fill");
                console.log(`[深学助手] 当前页面已学完【${finished.length}】个视频，学时要求为【${lesson}】个视频，是否达标：${finished.length >= lesson}`);
                
                if (finished.length >= lesson) {
                    console.log('[深学助手] 当前课程已达到学时要求，跳转下一个');
                    stopWatching();
                    nextCourse();
                    return;
                }
            }
        }
        
        let targetIcon = null;
        
        function findIcon() {
            // 查找进行中的视频
            targetIcon = document.getElementsByClassName("iconfont icon_processing_fill")[0];
            // 查找未开始的视频
            if (!targetIcon) {
                targetIcon = document.getElementsByClassName("iconfont icon_checkbox_linear")[0];
            }
        }
        
        // 查找默认列表
        findIcon();
        
        // 展开其他列表并查找
        if (!targetIcon) {
            let headers = document.getElementsByClassName("fish-collapse-header");
            for (let i = 0; i < headers.length; i++) {
                headers[i].click();
                findIcon();
                if (targetIcon) {
                    break;
                }
            }
        }
        
        // 点击找到的视频
        if (targetIcon) {
            console.log('[深学助手] 找到下一个视频，点击播放');
            targetIcon.click();
        } else {
            if (autoNext && config.autoNext) {
                console.log('[深学助手] 当前页面所有视频已播放完，跳转下一个课程');
                stopWatching();
                nextCourse();
            } else {
                console.log('[深学助手] 当前页面所有视频已播放完');
                showMessage('✅ 当前页面所有视频已播放完！', 5000);
            }
        }
    }
    
    // 播放视频（从油猴脚本的 play 函数迁移）
    function playVideo(videoElement = null) {
        if (!videoElement) {
            videoElement = document.getElementsByTagName("video")[0];
        }
        
        if (videoElement) {
            videoElement.muted = true; // 静音播放
            videoElement.play();
            console.log('[深学助手] 视频开始播放');
        }
        
        // 关闭提示框（必须完整看完整个视频才可以获得该视频的学时）
        let confirmBtn = document.getElementsByClassName("fish-btn fish-btn-primary")[0];
        if (confirmBtn && confirmBtn.innerText.includes("知道了")) {
            confirmBtn.click();
            console.log('[深学助手] 关闭视频提示框');
        }
    }
    
    // 阅读 PDF（从油猴脚本的 read 函数迁移）
    function readPDF() {
        if (!pageCount) return;
        
        console.log(`[深学助手] PDF文档阅读: pageNumber=>${pageNumber}, pageCount=>${pageCount}`);
        
        let nextBtn = document.getElementById("next");
        if (nextBtn) {
            nextBtn.click();
        }
        
        if (pageCount) {
            // 跳到最后一页
            console.log(`[深学助手] PDF文档跳到最后一页: ${pageCount}`);
            window.postMessage({
                type: "pdfPlayerPageChangeing",
                data: {
                    pageNumber: pageCount,
                    pageCount: pageCount,
                }
            }, "*");
            
            // 然后跳回第一页
            setTimeout(() => {
                console.log('[深学助手] PDF文档跳到第一页...');
                window.postMessage({
                    type: "pdfPlayerPageChangeing",
                    data: {
                        pageNumber: 1,
                        pageCount: pageCount,
                    }
                }, "*");
            }, 1000);
            
            // 重置页数
            pageCount = null;
        }
    }
    
    // 开始 PDF 阅读模式
    function startPDFReading() {
        console.log('[深学助手] 开始 PDF 阅读模式');
        setInterval(readPDF, config.watchInterval);
    }
    
    // 自动答题（从油猴脚本的 answer 函数迁移）
    function autoAnswer() {
        let answerCount = 0;
        const maxAttempts = 3;
        
        const answerInterval = setInterval(() => {
            console.log('[深学助手] 自动答题检测...');
            
            // 选择第一个选项（通常是A）
            const firstOption = document.getElementsByClassName("nqti-check")[0];
            if (firstOption) {
                firstOption.click();
                console.log('[深学助手] 已选择答案');
                
                // 点击下一题/确定按钮
                for (let i = 0; i < 2; i++) {
                    const submitBtn = document.querySelector("div.index-module_footer_3r1Yy > button");
                    if (submitBtn) {
                        submitBtn.click();
                        console.log('[深学助手] 已提交答案');
                    }
                }
            }
            
            answerCount++;
            if (answerCount >= maxAttempts) {
                clearInterval(answerInterval);
            }
        }, 1000);
    }
    
    // 暴露给外部调用的接口
    smartedu.startWatching = startWatching;
    smartedu.stopWatching = stopWatching;
    smartedu.nextCourse = nextCourse;
    smartedu.isRunning = () => isRunning;
    smartedu.updateConfig = (newConfig) => {
        config = { ...config, ...newConfig };
        chrome.storage.sync.set({ smartEduConfig: config });
    };
    smartedu.triggerFakeXHR = () => {
        sendCommandToAgent('EXECUTE_FAKE_XHR');
    };
    
    // 通知系统接口
    smartedu.showMessage = showMessage;
    smartedu.clearNotifications = () => NotificationManager.clear();
    smartedu.destroyNotifications = () => NotificationManager.destroy();
    
    // Agent 状态查询
    smartedu.isAgentReady = () => agentReady;
    smartedu.getPendingCommandCount = () => pendingAgentCommands.length;
    
})();
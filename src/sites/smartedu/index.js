// SmartEdu Index - 模块入口和路由器
// 负责注册站点模块并处理URL路由
(() => {
    const ns = (window.DeepLearn ||= {});
    const registry = ns.registry;
    const siteNS = (ns.sites ||= {});
    const smartedu = (siteNS.smartedu ||= {});
    
    // 定义智慧教育平台站点模块
    const smartEduSite = {
        id: 'smartedu',
        name: '国家智慧教育平台',
        
        // 匹配支持的域名
        matches(loc) {
            const supportedHosts = [
                'www.smartedu.cn',
                'basic.smartedu.cn', 
                'smartedu.gdtextbook.com',
                'teacher.ykt.eduyun.cn'
            ];
            return supportedHosts.includes(loc.hostname);
        },
        
        // 初始化模块
        init() {
            const href = location.href;
            console.log('[深学助手] 检测到智慧教育平台页面:', href);
            
            // 根据 URL 路径进行路由
            if (this.shouldActivateAutomation(href)) {
                console.log('[深学助手] 启动智慧教育平台自动化模块');
                
                // 确保自动化模块已加载
                if (smartedu.initAutomation) {
                    // 延时启动，确保页面完全加载
                    setTimeout(() => {
                        smartedu.initAutomation();
                    }, 2000);
                } else {
                    console.warn('[深学助手] 自动化模块未正确加载');
                }
            } else {
                console.log('[深学助手] 当前页面不需要自动化处理');
            }
        },
        
        // 判断是否应该启动自动化
        shouldActivateAutomation(href) {
            // 课程详情页
            if (href.includes('/teacherTraining/courseDetail')) {
                return true;
            }
            
            // 学习页面
            if (href.includes('/study/')) {
                return true;
            }
            
            // 视频播放页面
            if (href.includes('/video/')) {
                return true;
            }
            
            // 考试页面
            if (href.includes('/exam/')) {
                return true;
            }
            
            // 培训页面
            if (href.includes('/training/')) {
                return true;
            }
            
            return false;
        }
    };
    
    // 注册站点模块
    if (registry && registry.register) {
        registry.register(smartEduSite);
        console.log('[深学助手] 智慧教育平台模块已注册');
    } else {
        console.error('[深学助手] 注册器未初始化，无法注册智慧教育平台模块');
    }
    
})();
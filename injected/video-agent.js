// Video Agent - 运行在页面主世界，负责访问Vue实例
// 职责：监控Vue状态，报告给Controller，执行主世界级别的操作

(function() {
    'use strict';
    
    const SOURCE_ID = 'deeplearn-video-agent';
    const TARGET_ORIGIN = window.location.origin;

    // 安全的消息发送函数
    function postToController(type, payload) {
        window.postMessage({ 
            source: SOURCE_ID, 
            type, 
            payload,
            timestamp: Date.now()
        }, TARGET_ORIGIN);
    }

    // 工具函数
    function getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    // Vue实例查找
    function findComponentInstance(vueInstance) {
        if (vueInstance && vueInstance.player && typeof vueInstance.timeQuestionStatus !== 'undefined') {
            return vueInstance;
        }
        if (vueInstance && vueInstance.$children && vueInstance.$children.length > 0) {
            for (const child of vueInstance.$children) {
                const found = findComponentInstance(child);
                if (found) return found;
            }
        }
        return null;
    }

    function findVueInstance() {
        const rootSelectors = ['#app', '.body-left', '.content', '.player-container'];
        for (const selector of rootSelectors) {
            const rootEl = document.querySelector(selector);
            if (rootEl && rootEl.__vue__) {
                const instance = findComponentInstance(rootEl.__vue__);
                if (instance) return instance;
            }
        }
        return null;
    }

    console.log('[深学助手] Video Agent 正在初始化...');

    // 尝试找到Vue实例
    let vm = null;
    let monitoringActive = false;

    const initInterval = setInterval(() => {
        vm = findVueInstance();
        if (vm) {
            clearInterval(initInterval);
            console.log('[深学助手] Vue实例已找到，开始监控');
            postToController('VUE_INSTANCE_FOUND', { success: true });
            startMonitoring();
        }
    }, 2000);

    // 15秒超时
    setTimeout(() => {
        if (!vm) {
            clearInterval(initInterval);
            console.error('[深学助手] 未能找到Vue实例');
            postToController('VUE_INSTANCE_FOUND', { success: false });
        }
    }, 15000);

    // 监控Vue状态
    function startMonitoring() {
        if (monitoringActive) return;
        monitoringActive = true;

        const monitorInterval = setInterval(() => {
            // 检查Vue实例状态，支持自愈恢复
            if (!vm || !vm.player) {
                console.warn('[深学助手] Vue实例丢失或过时，尝试重新查找...');
                vm = findVueInstance(); // 重新查找Vue实例
                if (!vm) {
                    console.error('[深学助手] 重新查找Vue实例失败，跳过本次检测');
                    postToController('VUE_INSTANCE_LOST', {});
                    return; // 本次跳过，但不停止监控
                }
                console.log('[深学助手] Vue实例恢复成功，继续监控');
                postToController('VUE_INSTANCE_RECOVERED', {});
            }

            // 检查中途弹题
            if (vm.timeQuestionStatus === true) {
                const question = vm.timeQuestionObj1;
                if (question && typeof question.popUpAnswer !== 'undefined') {
                    const correctAnswerValue = question.popUpAnswer;
                    const correctAnswerText = correctAnswerValue === 1 ? '正确' : '错误';
                    
                    postToController('TIME_QUESTION_DETECTED', {
                        correctAnswerText,
                        currentAnswer: vm.timeQuestionAnswer
                    });
                }
            }
            // 检查视频播放结束
            else if (vm.dialogVisible === true) {
                const isLastVideo = vm.key !== undefined && vm.list && vm.key >= vm.list.length - 1;
                
                postToController('VIDEO_ENDED', {
                    isLastVideo,
                    chapterId: getUrlParameter('chapterId'),
                    semesterId: getUrlParameter('semesterId')
                });
            }
            // 检查持续观看确认
            else if (vm.codeStatus === true) {
                postToController('CONTINUE_WATCH_REQUIRED', {});
            }
            // 检查播放器状态
            else {
                try {
                    if (vm.player.paused) {
                        postToController('VIDEO_PAUSED', {});
                    }
                } catch (e) {
                    // 静默处理
                }
            }
        }, 2500);

        // 监控将持续运行，直到页面关闭或扩展停用
        // 移除了30分钟超时限制，支持长时间学习场景
    }

    // 监听来自Controller的命令
    window.addEventListener('message', (event) => {
        // 安全检查
        if (event.source !== window || !event.data || 
            event.data.target !== SOURCE_ID || 
            event.origin !== TARGET_ORIGIN) {
            return;
        }

        const { command, payload } = event.data;
        console.log(`[深学助手] Agent收到命令: ${command}`, payload);

        switch (command) {
            case 'PLAY_VIDEO':
                try {
                    if (vm && vm.player) {
                        const playPromise = vm.player.play();
                        // 处理现代浏览器的自动播放策略限制
                        if (playPromise !== undefined) {
                            playPromise
                                .then(() => {
                                    postToController('VIDEO_PLAY_EXECUTED', { success: true });
                                })
                                .catch(error => {
                                    // 这是预料中的情况，浏览器阻止了自动播放
                                    console.warn(`[深学助手] 播放被浏览器策略阻止: ${error.name}. 等待用户交互。`);
                                    postToController('VIDEO_PLAY_EXECUTED', { 
                                        success: false, 
                                        error: error.message,
                                        reason: 'autoplay_blocked'
                                    });
                                });
                        } else {
                            // 旧版本播放器API，同步执行
                            postToController('VIDEO_PLAY_EXECUTED', { success: true });
                        }
                    }
                } catch (e) {
                    postToController('VIDEO_PLAY_EXECUTED', { success: false, error: e.message });
                }
                break;
                
            case 'CHANGE_VIDEO':
                try {
                    if (vm && typeof vm.changeVideo === 'function') {
                        vm.changeVideo();
                        postToController('VIDEO_CHANGE_EXECUTED', { success: true });
                    }
                } catch (e) {
                    postToController('VIDEO_CHANGE_EXECUTED', { success: false, error: e.message });
                }
                break;
                
            case 'HANDLE_LOGIN':
                try {
                    if (vm && typeof vm.handleLogin === 'function') {
                        vm.handleLogin();
                        postToController('LOGIN_HANDLED', { success: true });
                    }
                } catch (e) {
                    postToController('LOGIN_HANDLED', { success: false, error: e.message });
                }
                break;
                
            // case 'CONFIRM_TIME_QUESTION': // 已优化移除：页面Vue逻辑自动处理状态更新
            //     try {
            //         if (vm && vm.$nextTick) {
            //             vm.$nextTick(() => {
            //                 postToController('TIME_QUESTION_CONFIRMED', { success: true });
            //             });
            //         }
            //     } catch (e) {
            //         postToController('TIME_QUESTION_CONFIRMED', { success: false, error: e.message });
            //     }
            //     break;
        }
    });

    console.log('[深学助手] Video Agent 已加载，等待Vue实例...');

})();
// injected/agents/video-agent.js - V3 (Final Monkey Patching Version)

(() => {
    'use strict';
    // 防止重复注入
    if (window.__DEEPL_VIDEO_AGENT_PATCHED__) {
        console.log('[深学助手] Agent (V3) 已应用补丁，跳过。');
        return;
    }
    window.__DEEPL_VIDEO_AGENT_PATCHED__ = true;

    const SOURCE_ID = 'deeplearn-video-agent';
    const TARGET_ORIGIN = window.location.origin;

    console.log('[深学助手] Video Agent (V3 Patching Mode) 正在初始化...');

    // 安全的消息发送函数
    function postToController(type, payload) {
        try {
            window.postMessage({ source: SOURCE_ID, type, payload, timestamp: Date.now() }, TARGET_ORIGIN);
        } catch (e) {
            console.error('[深学助手] postMessage 失败:', e);
        }
    }

    // 1. Vue 实例查找函数
    function findVueInstance() {
        const rootEl = document.querySelector('.body-left');
        if (rootEl && rootEl.__vue__) {
            const vm = rootEl.__vue__;
            if (vm && vm.player && typeof vm.videoEnd === 'function') {
                console.log('[深学助手] 成功找到播放器 Vue 实例。');
                return vm;
            }
        }
        return null;
    }

    // 2. 核心：猴子补丁函数
    function applyMonkeyPatches(vm) {
        if (!vm || vm.__deeplearn_patched) {
            return;
        }

        console.log('[深学助手] 成功获取 Vue 实例，准备应用补丁...');

        // --- 补丁1: 禁用"持续观看"弹窗 (通过覆写定时器设置函数) ---
        // 源码确认存在 setTimeouts 方法
        if (typeof vm.setTimeouts === 'function' && typeof vm.handleLogin === 'function') {
            const originalSetTimeouts = vm.setTimeouts.bind(vm);
            vm.setTimeouts = function() {
                originalSetTimeouts();
                if (this.setTime) clearInterval(this.setTime);
                console.log('[深学助手] 补丁1已应用：禁用"持续观看"定时器');
            };

            const originalHandleLogin = vm.handleLogin.bind(vm);
            vm.handleLogin = function() {
                console.log('[深学助手] 补丁1已拦截：自动处理持续观看确认');
                this.codeStatus = false; // 直接设置状态为未弹窗
                return;
            };
        }

        // --- 补丁2: 拦截并自动处理"视频结束"弹窗 ---
        const originalVideoEnd = vm.videoEnd.bind(vm);
        vm.videoEnd = function(type) {
            console.log(`[深学助手] 补丁2已拦截：视频结束事件 (type=${type})`);
            
            // 不显示弹窗，直接执行切换逻辑
            this.dialogVisible = false;
            
            // 检查是否有更多视频
            const currentKey = this.key || 0;
            const videoList = this.list || [];
            
            if (currentKey + 1 < videoList.length) {
                // 有下一个视频，直接切换
                console.log('[深学助手] 检测到更多视频，自动切换到下一个');
                setTimeout(() => {
                    this.key = currentKey + 1;
                    this.getVideoDetail();
                }, 1000);
            } else {
                // 没有更多视频，跳转到章节测试
                console.log('[深学助手] 所有视频完成，准备跳转章节测试');
                setTimeout(() => {
                    const chapterId = new URLSearchParams(window.location.search).get('chapterId');
                    const semesterId = new URLSearchParams(window.location.search).get('semesterId');
                    
                    if (chapterId && semesterId) {
                        window.location.href = `/student/section?chapterId=${chapterId}&semesterId=${semesterId}`;
                    } else {
                        console.warn('[深学助手] 无法获取章节参数');
                    }
                }, 2000);
            }
            
            return; // 不调用原始函数
        };

        // --- 补丁3: 拦截并自动处理"中途弹题" ---
        // 基于源码分析，当 timeQuestionStatus 变为 true 时会显示中途弹题
        const originalTimeQuestionStatusSetter = function(value) {
            this._timeQuestionStatus = value;
            
            if (value === true) {
                console.log('[深学助手] 补丁3已拦截：中途弹题出现');
                
                // 延迟处理，模拟用户思考
                setTimeout(() => {
                    const questionObj = this.timeQuestionObj1;
                    if (questionObj && typeof questionObj.popUpAnswer !== 'undefined') {
                        // 自动选择正确答案
                        const correctAnswer = questionObj.popUpAnswer;
                        console.log(`[深学助手] 自动选择答案: ${correctAnswer}`);
                        
                        // 关闭弹题弹窗
                        this.timeQuestionStatus = false;
                        
                        // 继续播放视频
                        if (this.player) {
                            this.player.play();
                        }
                    }
                }, Math.random() * 2000 + 1000); // 1-3秒随机延迟
            }
        };

        // 使用 Object.defineProperty 来拦截 timeQuestionStatus 的设置
        if (!vm.hasOwnProperty('_timeQuestionStatus')) {
            vm._timeQuestionStatus = vm.timeQuestionStatus;
            Object.defineProperty(vm, 'timeQuestionStatus', {
                get: function() { return this._timeQuestionStatus; },
                set: originalTimeQuestionStatusSetter,
                configurable: true
            });
        }

        // --- 补丁4: 确保2倍速播放 ---
        if (vm.player && typeof vm.player.playbackRate !== 'undefined') {
            const checkPlaybackRate = () => {
                if (vm.player.playbackRate !== 2) {
                    vm.player.playbackRate = 2;
                    console.log('[深学助手] 补丁4已应用：设置2倍速播放');
                }
            };
            
            // 立即设置
            checkPlaybackRate();
            
            // 定期检查
            const speedInterval = setInterval(checkPlaybackRate, 3000);
            
            // 30分钟后清理定时器
            setTimeout(() => clearInterval(speedInterval), 30 * 60 * 1000);
        }

        vm.__deeplearn_patched = true;
        console.log('[深学助手] 所有补丁已成功应用！');
        postToController('PATCHES_APPLIED', { success: true });
    }

    // +++ 新增的环境自检（在主程序之前） +++
    // 如果页面上没有常见的视频播放器容器/元素，则认为不是视频播放页，静默休眠
    const isVideoPage = document.querySelector('video, .player-container, #player, .vjs-video-container');
    if (!isVideoPage) {
        console.log('[深学助手] Video Agent: 当前不是视频播放页，脚本将保持休眠。');
        return; // 提前退出，避免无效轮询与10秒超时噪音
    }
    // +++ 自检结束 +++

    // 3. 主程序：查找 Vue 实例并应用补丁
    let attempts = 0;
    const maxAttempts = 20; // 10秒超时
    
    const intervalId = setInterval(() => {
        const vm = findVueInstance();
        if (vm) {
            clearInterval(intervalId);
            applyMonkeyPatches(vm);
        } else {
            attempts++;
            if (attempts > maxAttempts) {
                clearInterval(intervalId);
                console.error('[深学助手] 10秒内未找到 Vue 实例。');
                postToController('VUE_INSTANCE_NOT_FOUND');
            }
        }
    }, 500);

})();

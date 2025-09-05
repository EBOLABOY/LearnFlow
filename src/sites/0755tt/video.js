(() => {
  const ns = (window.DeepLearn ||= {});
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});

  // Video Controller - 运行在隔离世界，负责DOM操作和决策
  tt.initVideo = function initVideo() {
    console.log('[深学助手] Video Controller 正在初始化...');

    // 工具函数
    function randomDelay(min, max) {
      return Math.floor(Math.random() * (max - min + 1) + min);
    }

    function simulateClick(element) {
      if (!element) return;
      const eventSequence = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      eventSequence.forEach(eventName => {
        const event = new MouseEvent(eventName, { 
          bubbles: true, 
          cancelable: true, 
          view: window 
        });
        element.dispatchEvent(event);
      });
    }

    // 发送命令给Agent
    function sendCommandToAgent(command, payload = {}) {
      window.postMessage({
        target: 'deeplearn-video-agent',
        command,
        payload,
        source: 'deeplearn-video-controller'
      }, window.location.origin);
    }

    // 1. 注入Agent脚本
    const agentScript = document.createElement('script');
    agentScript.src = chrome.runtime.getURL('injected/video-agent.js');
    agentScript.onload = () => {
      console.log('[深学助手] Video Agent 注入成功');
      agentScript.remove();
    };
    agentScript.onerror = () => {
      console.error('[深学助手] Video Agent 注入失败');
    };
    (document.head || document.documentElement).appendChild(agentScript);

    // 2. 监听来自Agent的消息
    window.addEventListener('message', (event) => {
      // 安全检查
      if (event.source !== window || 
          !event.data || 
          event.data.source !== 'deeplearn-video-agent' ||
          event.origin !== window.location.origin) {
        return;
      }

      const { type, payload } = event.data;
      console.log(`[深学助手] Controller收到消息: ${type}`, payload);

      // 3. 根据消息类型进行决策和DOM操作
      switch (type) {
        case 'VUE_INSTANCE_FOUND':
          if (payload.success) {
            console.log('[深学助手] Vue实例已找到，视频监控开始');
          } else {
            console.error('[深学助手] 未找到Vue实例，视频自动化无法启动');
          }
          break;

        case 'TIME_QUESTION_DETECTED':
          console.log('[深学助手] 检测到视频中途弹题');
          handleTimeQuestion(payload);
          break;

        case 'VIDEO_ENDED':
          console.log('[深学助手] 视频播放结束');
          handleVideoEnd(payload);
          break;

        case 'CONTINUE_WATCH_REQUIRED':
          console.log('[深学助手] 需要确认持续观看');
          handleContinueWatch();
          break;

        case 'VIDEO_PAUSED':
          console.log('[深学助手] 检测到视频暂停，尝试恢复播放');
          sendCommandToAgent('PLAY_VIDEO');
          break;

        case 'VUE_INSTANCE_LOST':
          console.warn('[深学助手] Vue实例丢失，等待自愈恢复');
          break;

        case 'VUE_INSTANCE_RECOVERED':
          console.log('[深学助手] Vue实例已恢复，监控继续正常运行');
          break;
      }
    });

    // 处理视频中途弹题
    function handleTimeQuestion(payload) {
      const { correctAnswerText } = payload;
      
      // DOM操作：查找并点击正确答案
      setTimeout(() => {
        const visibleWrapper = Array.from(document.querySelectorAll('.el-dialog__wrapper'))
          .find(w => w.style.display !== 'none');
        
        if (visibleWrapper) {
          const labels = Array.from(visibleWrapper.querySelectorAll('.el-radio__label'));
          const targetLabel = labels.find(label => label.innerText.trim() === correctAnswerText);
          
          if (targetLabel && targetLabel.parentElement) {
            console.log(`[深学助手] 点击正确答案: ${correctAnswerText}`);
            simulateClick(targetLabel.parentElement);
            
            // 延迟后点击确定按钮
            setTimeout(() => {
              const buttons = Array.from(visibleWrapper.querySelectorAll('.el-button span'));
              const confirmButton = buttons.find(span => span.innerText.trim() === '确 定');
              
              if (confirmButton && confirmButton.parentElement && !confirmButton.parentElement.disabled) {
                console.log('[深学助手] 点击确定按钮');
                simulateClick(confirmButton.parentElement);
                // sendCommandToAgent('CONFIRM_TIME_QUESTION'); // 优化：页面Vue逻辑应已自动处理状态更新
              }
            }, randomDelay(500, 1200));
          }
        }
      }, randomDelay(500, 1000));
    }

    // 处理视频播放结束
    function handleVideoEnd(payload) {
      const { isLastVideo, chapterId, semesterId } = payload;

      if (isLastVideo) {
        console.log('[深学助手] 最后一个视频播放完毕，准备跳转到章节测试');
        
        if (chapterId && semesterId) {
          const testPageUrl = `/student/section?chapterId=${chapterId}&semesterId=${semesterId}`;
          console.log(`[深学助手] 跳转至: ${testPageUrl}`);
          
          setTimeout(() => {
            window.location.href = testPageUrl;
          }, randomDelay(2000, 4000));
        } else {
          console.error('[深学助手] 无法获取章节信息，无法跳转');
        }
      } else {
        console.log('[深学助手] 切换到下一个视频');
        setTimeout(() => {
          sendCommandToAgent('CHANGE_VIDEO');
        }, randomDelay(1000, 2500));
      }
    }

    // 处理持续观看确认
    function handleContinueWatch() {
      console.log('[深学助手] 处理持续观看确认');
      setTimeout(() => {
        sendCommandToAgent('HANDLE_LOGIN');
      }, randomDelay(1000, 2500));
    }

    console.log('[深学助手] Video Controller 已启动');
  };
})();

(() => {
  const ns = (window.DeepLearn ||= {});
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});

  // Video Controller - 运行在隔离世界，负责DOM操作和决策
  tt.initVideo = function initVideo() {
    console.log('[深学助手] Video Controller 正在初始化 (Debugger 模式)...');

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

    // 监听来自Agent的消息
    window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data || event.data.source !== 'deeplearn-video-agent' || event.origin !== window.location.origin) {
        return;
      }
      const { type, payload } = event.data;
      console.log(`[深学助手] Controller收到消息: ${type}`, payload);

      switch (type) {
        case 'VUE_INSTANCE_FOUND':
          if (payload.success) console.log('[深学助手] Vue实例已找到，视频监控开启');
          else console.error('[深学助手] 未找到Vue实例，视频自动化无法启动');
          break;
        case 'TIME_QUESTION_DETECTED':
          console.log('[深学助手] 检测到视频中途弹题');
          handleTimeQuestionStable(payload);
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
          console.warn('[深学助手] Vue实例丢失，等待自愈...');
          break;
        case 'VUE_INSTANCE_RECOVERED':
          console.log('[深学助手] Vue实例已恢复，监控继续正常运行');
          break;
      }
    });

    // 处理视频中途弹题（稳健版）
    function handleTimeQuestionStable(payload) {
      const { correctAnswerText } = payload;
      setTimeout(() => {
        const wrappers = Array.from(document.querySelectorAll('.el-dialog__wrapper'));
        const visibleWrapper = wrappers.find(w => {
          try { const s = window.getComputedStyle(w); return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0'; } catch { return w.style.display !== 'none'; }
        });
        if (!visibleWrapper) return;

        const labels = Array.from(visibleWrapper.querySelectorAll('.el-radio__label'));
        let targetLabel = labels.find(label => (label.innerText || label.textContent || '').trim() === correctAnswerText);
        if (!targetLabel && labels.length > 0) targetLabel = labels[0];

        if (targetLabel && targetLabel.parentElement) {
          console.log(`[深学助手] 点击答案: ${(targetLabel.innerText||'').trim()}`);
          simulateClick(targetLabel.parentElement);

          setTimeout(() => {
            let confirmBtnEl = visibleWrapper.querySelector('.el-button--primary');
            if (!confirmBtnEl) {
              const spans = Array.from(visibleWrapper.querySelectorAll('.el-button span'));
              const span = spans.find(s => /确\s*认|确定/.test((s.innerText||'').trim()));
              confirmBtnEl = span ? span.parentElement : null;
            }
            if (!confirmBtnEl) {
              const allBtns = visibleWrapper.querySelectorAll('.el-button');
              confirmBtnEl = allBtns[allBtns.length - 1] || null;
            }
            if (confirmBtnEl && !confirmBtnEl.disabled) {
              console.log('[深学助手] 点击确认按钮');
              simulateClick(confirmBtnEl);
            }
          }, randomDelay(500, 1200));
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
          console.log(`[深学助手] 跳转 -> ${testPageUrl}`);
          setTimeout(() => { window.location.href = testPageUrl; }, randomDelay(2000, 4000));
        } else {
          console.error('[深学助手] 无法获取章节信息，无法跳转');
        }
      } else {
        console.log('[深学助手] 切换到下一个视频');
        setTimeout(() => { sendCommandToAgent('CHANGE_VIDEO'); }, randomDelay(1000, 2500));
      }
    }

    // 处理持续观看确认
    function handleContinueWatch() {
      console.log('[深学助手] 处理持续观看确认');
      setTimeout(() => { sendCommandToAgent('HANDLE_LOGIN'); }, randomDelay(1000, 2500));
    }

    console.log('[深学助手] Video Controller 已启动');
  };
})();


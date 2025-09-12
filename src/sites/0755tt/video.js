(() => {
  const ns = (window.DeepLearn ||= {});
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});
  
  // Video Controller - DOM观察者模式，模拟真实用户行为
  tt.initVideo = function initVideo() {
    console.log('[深学助手] Video Controller (DOM观察者模式) 正在初始化...');
    
    let observer = null;
    let speedInterval = null;

    // 1. 自动设置2倍速播放
    function setupAutoPlaybackSpeed() {
      speedInterval = setInterval(() => {
        const video = document.querySelector('video');
        if (video && video.playbackRate !== 2) {
          video.playbackRate = 2;
          console.log('[深学助手] 已自动设置 2 倍速播放');
        }
      }, 2000);
    }

    // 2. 创建DOM观察器
    function createDOMObserver() {
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.addedNodes.length > 0) {
            checkForPopups(mutation.addedNodes);
          }
        }
      });

      // 开始观察整个页面的变化
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      console.log('[深学助手] DOM观察器已启动，正在监视页面弹窗...');
    }

    // 3. 检查新添加的DOM节点
    async function checkForPopups(nodes) {
      for (const node of nodes) {
        if (node.nodeType !== 1 || !node.textContent) continue;

        const text = node.textContent.trim();

        // 处理"持续观看"确认弹窗
        if (text.includes('请点击确定，确认是否还在持续观看') || 
            text.includes('持续观看') || 
            text.includes('确认是否还在')) {
          console.log('[深学助手] 检测到"持续观看"确认弹窗');
          await handleContinueWatchDialog(node);
          return;
        }

        // 处理"视频结束"弹窗
        if (text.includes('恭喜完成该学习任务') || 
            text.includes('学习任务') ||
            text.includes('下个片段')) {
          console.log('[深学助手] 检测到"视频结束"弹窗');
          await handleVideoEndDialog(node);
          return;
        }

        // 处理"中途弹题"弹窗
        if (text.includes('开始答题') || 
            text.includes('弹题') ||
            (text.includes('题目') && text.includes('确定'))) {
          console.log('[深学助手] 检测到"中途弹题"弹窗');
          await handleQuestionDialog(node);
          return;
        }
      }
    }

    // 4. 处理"持续观看"确认弹窗
    async function handleContinueWatchDialog(dialogNode) {
      try {
        // 寻找确定按钮的多种可能选择器
        const buttonSelectors = [
          '.el-button--primary',
          '.el-button[type="primary"]', 
          'button:contains("确定")',
          'button:contains("确 定")',
          '.btn-primary',
          '[class*="confirm"]'
        ];

        let confirmButton = null;
        for (const selector of buttonSelectors) {
          confirmButton = dialogNode.querySelector(selector);
          if (confirmButton) break;
        }

        // 如果没有找到确定按钮，尝试文本匹配
        if (!confirmButton) {
          const buttons = dialogNode.querySelectorAll('button, .el-button');
          for (const btn of buttons) {
            if (btn.textContent && 
                (btn.textContent.includes('确定') || 
                 btn.textContent.includes('确 定') || 
                 btn.textContent.includes('OK'))) {
              confirmButton = btn;
              break;
            }
          }
        }

        if (confirmButton && !confirmButton.disabled) {
          // 模拟真实用户操作 - 短暂延迟后点击
          await sleep(randomDelay(800, 1500));
          simulateRealClick(confirmButton);
          showMessage('✅ 已自动确认持续观看', 2500, 'success');
        } else {
          console.warn('[深学助手] 未找到可点击的确认按钮');
        }
      } catch (error) {
        console.error('[深学助手] 处理持续观看弹窗时出错:', error);
      }
    }

    // 5. 处理"视频结束"弹窗
    async function handleVideoEndDialog(dialogNode) {
      try {
        // 优先寻找"下个片段"按钮
        const nextButtons = dialogNode.querySelectorAll('button, .el-button, .btn');
        let nextButton = null;
        
        for (const btn of nextButtons) {
          const btnText = btn.textContent?.trim() || '';
          if (btnText.includes('下个片段') || 
              btnText.includes('下一个') || 
              btnText.includes('继续') ||
              btnText.includes('下一节')) {
            nextButton = btn;
            break;
          }
        }

        if (nextButton && !nextButton.disabled) {
          await sleep(randomDelay(1000, 2000));
          simulateRealClick(nextButton);
          showMessage('✅ 视频完成，已自动切换到下一个片段', 2500, 'success');
        } else {
          // 没有下一个片段，准备跳转到章节测试
          console.log('[深学助手] 没有更多片段，准备跳转到章节测试');
          await navigateToChapterTest();
        }
      } catch (error) {
        console.error('[深学助手] 处理视频结束弹窗时出错:', error);
      }
    }

    // 6. 处理"中途弹题"弹窗
    async function handleQuestionDialog(dialogNode) {
      try {
        // 先查找题目和选项
        const questionContent = dialogNode.textContent;
        
        // 简单的题目处理 - 目前只支持自动确认
        // TODO: 未来可以集成智能答题逻辑
        const confirmButtons = dialogNode.querySelectorAll('button, .el-button');
        let confirmButton = null;
        
        for (const btn of confirmButtons) {
          const btnText = btn.textContent?.trim() || '';
          if (btnText.includes('确定') || btnText.includes('提交')) {
            confirmButton = btn;
            break;
          }
        }

        if (confirmButton && !confirmButton.disabled) {
          await sleep(randomDelay(1500, 3000)); // 模拟思考时间
          simulateRealClick(confirmButton);
          showMessage('✅ 已自动处理中途弹题', 2500, 'info');
        }
      } catch (error) {
        console.error('[深学助手] 处理中途弹题时出错:', error);
      }
    }

    // 7. 跳转到章节测试页面
    async function navigateToChapterTest() {
      try {
        const chapterId = getUrlParameter('chapterId');
        const semesterId = getUrlParameter('semesterId');
        
        if (chapterId && semesterId) {
          const testPageUrl = `/student/section?chapterId=${chapterId}&semesterId=${semesterId}`;
          console.log(`[深学助手] 准备跳转到章节测试: ${testPageUrl}`);
          
          showMessage('🏁 课程完成！正在跳转到章节测试...', 3000, 'info');
          
          setTimeout(() => {
            window.location.href = testPageUrl;
          }, randomDelay(2000, 4000));
        } else {
          // 修复无限刷新：不再自动刷新，只记录错误
          console.warn('[深学助手] 无法获取章节参数，可能当前页面不包含必要的URL参数');
          showMessage('⚠️ 视频已完成，但无法自动跳转到测试页面', 4000, 'info');
          
          // 尝试查找页面上的"下一步"或"章节测试"按钮
          setTimeout(() => {
            const nextButtons = document.querySelectorAll('button, .btn, .el-button, a');
            for (const btn of nextButtons) {
              const btnText = btn.textContent?.toLowerCase() || '';
              if (btnText.includes('测试') || btnText.includes('下一步') || btnText.includes('考试')) {
                simulateRealClick(btn);
                showMessage('✅ 找到测试按钮，已自动点击', 2500, 'success');
                return;
              }
            }
            console.log('[深学助手] 未找到可用的跳转按钮，请手动操作');
          }, 2000);
        }
      } catch (error) {
        console.error('[深学助手] 跳转时出错:', error);
        showMessage('❌ 跳转过程中出现错误', 3000, 'error');
      }
    }

    // 工具函数
    function simulateRealClick(element) {
      // 模拟真实用户点击行为
      const events = ['mousedown', 'mouseup', 'click'];
      events.forEach(eventType => {
        const event = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window
        });
        element.dispatchEvent(event);
      });
      
      console.log(`[深学助手] 已模拟点击: ${element.textContent?.trim() || element.className}`);
    }

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function randomDelay(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function getUrlParameter(name) {
      name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
      const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
      const results = regex.exec(location.search);
      return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    function showMessage(message, duration = 2500, type = 'info') {
      // 尝试使用全局的 util.showMessage，如果不存在则使用简单实现
      if (ns.util && ns.util.showMessage) {
        ns.util.showMessage(message, duration, type);
      } else {
        console.log(`[深学助手] ${message}`);
        
        // 简单的消息提示实现
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        `;
        
        document.body.appendChild(messageDiv);
        setTimeout(() => {
          if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
          }
        }, duration);
      }
    }

    // 清理函数
    function cleanup() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (speedInterval) {
        clearInterval(speedInterval);
        speedInterval = null;
      }
    }

    // 页面卸载时清理
    window.addEventListener('beforeunload', cleanup);

    // 初始化
    setupAutoPlaybackSpeed();
    createDOMObserver();

    console.log('[深学助手] Video Controller (DOM观察者模式) 已启动');
  };
})();


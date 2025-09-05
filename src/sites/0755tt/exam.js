(() => {
  const ns = (window.DeepLearn ||= {});
  const siteNS = (ns.sites ||= {});
  const tt = (siteNS.tt0755 ||= {});
  const { questionBank } = tt;

  // Exam Controller - 考试模块只需要DOM操作，不需要Agent
  tt.initExam = function initExam() {
    console.log('[深学助手] Exam Controller 正在初始化...');

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

    function answerIncorrectly(questionEl) {
      const checkboxes = questionEl.querySelectorAll('.el-checkbox');
      const radios = questionEl.querySelectorAll('.el-radio');
      if (checkboxes.length > 0) {
        const randomIndex = Math.floor(Math.random() * checkboxes.length);
        simulateClick(checkboxes[randomIndex]);
      } else if (radios.length > 0) {
        const randomIndex = Math.floor(Math.random() * radios.length);
        simulateClick(radios[randomIndex]);
      }
    }

    function answerCorrectly(questionEl, index) {
      const questionTitleEl = questionEl.querySelector('.subject-title');
      if (!questionTitleEl) {
        console.warn(`[深学助手] 第 ${index + 1} 题未找到题目标题元素`);
        return;
      }

      const questionText = questionTitleEl.innerText.trim();
      const correctAnswer = questionBank.get(questionText);
      
      if (correctAnswer) {
        console.log(`[深学助手] 回答第 ${index + 1} 题: "${questionText.substring(0, 20)}..." | 答案: ${correctAnswer}`);
        
        const checkboxes = questionEl.querySelectorAll('.el-checkbox');
        const radios = questionEl.querySelectorAll('.el-radio');
        
        if (checkboxes.length > 0) {
          const correctAnswers = correctAnswer.split(',');
          checkboxes.forEach(checkbox => {
            const label = checkbox.querySelector('.el-checkbox__label');
            if (label) {
              const optionLetter = label.innerText.trim().substring(0, 1);
              if (correctAnswers.includes(optionLetter) && !checkbox.classList.contains('is-checked')) {
                simulateClick(checkbox);
              }
            }
          });
        } else if (radios.length > 0) {
          let targetText;
          if (correctAnswer === 'T') targetText = '正确';
          else if (correctAnswer === 'F') targetText = '错误';
          else targetText = correctAnswer + '.';
          
          radios.forEach(radio => {
            const label = radio.querySelector('.el-radio__label');
            if (label && label.innerText.trim().startsWith(targetText) && !radio.classList.contains('is-checked')) {
              simulateClick(radio);
            }
          });
        }
      } else {
        console.warn(`[深学助手] 警告：题库中未找到问题: "${questionText}"`);
        // 后备方案：随机选择
        answerIncorrectly(questionEl);
      }
    }

    function submitExam(dialog) {
      const submitButton = Array.from(dialog.querySelectorAll('.el-dialog__footer button span'))
        .find(span => span.innerText.trim() === '确 定');
      if (submitButton && submitButton.parentElement) {
        console.log('[深学助手] 所有题目回答完毕，执行提交操作！');
        simulateClick(submitButton.parentElement);
      } else {
        console.error('[深学助手] 未找到提交试卷的"确定"按钮。');
      }
    }

    function answerQuestions() {
      console.log('[深学助手] 开始自动答题...');
      const examDialog = document.querySelector('.el-dialog__wrapper.preview');
      if (!examDialog || examDialog.style.display === 'none') {
        console.error('[深学助手] 未找到考试答题窗口。');
        return;
      }

      const allQuestionElements = examDialog.querySelectorAll('.previewQuestion > div > span > div');
      const totalQuestions = allQuestionElements.length;
      if (totalQuestions === 0) {
        console.error('[深学助手] 未找到任何题目元素。');
        return;
      }

      // 人性化策略：随机答错1-2道题
      const errorsToMake = Math.floor(Math.random() * 2) + 1;
      console.log(`[深学助手] 人性化策略: 本次将随机答错 ${errorsToMake} 道题。`);
      
      let questionIndices = Array.from({ length: totalQuestions }, (_, i) => i);
      for (let i = questionIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questionIndices[i], questionIndices[j]] = [questionIndices[j], questionIndices[i]];
      }
      const wrongAnswerIndices = new Set(questionIndices.slice(0, errorsToMake));
      console.log('[深学助手] 将在以下题目索引上故意答错 (索引从0开始):', Array.from(wrongAnswerIndices));

      allQuestionElements.forEach((questionEl, index) => {
        setTimeout(() => {
          try {
            if (wrongAnswerIndices.has(index)) {
              console.log(`[深学助手] 故意答错第 ${index + 1} 题...`);
              answerIncorrectly(questionEl);
            } else {
              answerCorrectly(questionEl, index);
            }
          } catch (error) {
            console.error(`[深学助手] 处理第 ${index + 1} 题时出错:`, error);
          }
        }, index * randomDelay(1000, 2000));
      });

      setTimeout(() => {
        submitExam(examDialog);
      }, totalQuestions * 2000 + 3000);
    }

    function confirmStart() {
      const confirmInterval = setInterval(() => {
        const dialogs = Array.from(document.querySelectorAll('.el-dialog__wrapper:not(.preview)'));
        const visibleDialog = dialogs.find(d => d.style.display !== 'none');

        if (visibleDialog) {
          const confirmButton = Array.from(visibleDialog.querySelectorAll('.el-dialog__footer button span'))
            .find(span => span.innerText.trim() === '确 定');
          if (confirmButton && confirmButton.parentElement) {
            console.log('[深学助手] 发现确认对话框，点击"确定"进入考试...');
            simulateClick(confirmButton.parentElement);
            clearInterval(confirmInterval);
            setTimeout(answerQuestions, randomDelay(2000, 3000));
          }
        }
      }, 1000);

      // 设置超时，避免无限等待
      setTimeout(() => {
        clearInterval(confirmInterval);
        console.warn('[深学助手] 确认对话框等待超时');
      }, 30000);
    }

    // 主初始化逻辑
    const startTestInterval = setInterval(() => {
      const startButton = Array.from(document.querySelectorAll('button span'))
        .find(span => span.innerText.trim().includes('开始测试'));
      if (startButton && startButton.parentElement) {
        console.log('[深学助手] 发现"开始测试"按钮，准备点击...');
        simulateClick(startButton.parentElement);
        clearInterval(startTestInterval);
        setTimeout(confirmStart, randomDelay(1000, 1500));
      }
    }, 2000);

    // 超时保护
    setTimeout(() => {
      clearInterval(startTestInterval);
      console.warn('[深学助手] 开始测试按钮查找超时');
    }, 60000);

    console.log('[深学助手] Exam Controller 已启动');
  };
})();


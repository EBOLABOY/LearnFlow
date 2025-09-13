// 深学助手设置页面 - 现代化版本

const CONFIG_KEY = 'automationConfig';
const SMARTEDU_CONFIG_KEY = 'smarteduConfig';

// 页面状态管理
const pageState = {
  currentSection: 'automation',
  config: null,
  smarteduConfig: null
};

// 默认配置
const DEFAULT_CONFIG = {
  humanizeEnabled: false,
  wrongAnswerRange: { min: 1, max: 3 },
  videoDelay: 3
};

const DEFAULT_SMARTEDU_CONFIG = {
  lessons: [10, 7, 2, 5, 17, 1, 1, 1],
  courseUrl: '',
  watchInterval: 3000
};

// DOM 元素获取
function getElements() {
  return {
    // 导航元素
    navLinks: document.querySelectorAll('.nav-link'),
    sections: document.querySelectorAll('.content-section'),

    // 状态消息
    statusMessage: document.getElementById('status-message'),

    // 版本和统计元素
    sidebarVersion: document.getElementById('sidebar-version'),
    extensionVersion: document.getElementById('extension-version'),
    platformCount: document.getElementById('platform-count'),
    questionCount: document.getElementById('question-count'),

    // 开关和输入元素
    humanizeSwitch: document.getElementById('humanize-enabled'),
    humanizeRangeGroup: document.getElementById('humanize-range-group'),
    wrongMin: document.getElementById('wrong-min'),
    wrongMax: document.getElementById('wrong-max'),
    videoDelay: document.getElementById('video-delay'),

    // 智慧教育平台元素
    smarteduInputs: Array.from({length: 8}, (_, i) =>
      document.getElementById(`smartedu-lesson-${i}`)
    ),
    smarteduCourseUrl: document.getElementById('smartedu-course-url'),
    smarteduWatchInterval: document.getElementById('smartedu-watch-interval'),

    // 按钮
    saveBtn: document.getElementById('save-btn'),
    resetBtn: document.getElementById('reset-btn')
  };
}

// 现代化开关交互
function initializeSwitches() {
  const elements = getElements();

  // 人性化答题开关
  if (elements.humanizeSwitch) {
    elements.humanizeSwitch.addEventListener('click', () => {
      const isEnabled = elements.humanizeSwitch.classList.contains('active');

      if (isEnabled) {
        elements.humanizeSwitch.classList.remove('active');
        elements.humanizeSwitch.dataset.enabled = 'false';
        elements.humanizeRangeGroup.style.opacity = '0.5';
        elements.humanizeRangeGroup.style.pointerEvents = 'none';
      } else {
        elements.humanizeSwitch.classList.add('active');
        elements.humanizeSwitch.dataset.enabled = 'true';
        elements.humanizeRangeGroup.style.opacity = '1';
        elements.humanizeRangeGroup.style.pointerEvents = 'auto';
      }

      // 添加视觉反馈动画
      elements.humanizeSwitch.style.transform = 'scale(0.95)';
      setTimeout(() => {
        elements.humanizeSwitch.style.transform = 'scale(1)';
      }, 150);
    });
  }
}

// 导航系统
function initializeNavigation() {
  const elements = getElements();

  elements.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = link.dataset.section;
      switchSection(sectionId);
    });
  });
}

function switchSection(sectionId) {
  const elements = getElements();

  // 更新导航状态
  elements.navLinks.forEach(link => {
    if (link.dataset.section === sectionId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // 切换内容区域
  elements.sections.forEach(section => {
    if (section.id === `${sectionId}-section`) {
      section.style.display = 'block';
      section.style.animation = 'slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    } else {
      section.style.display = 'none';
    }
  });

  pageState.currentSection = sectionId;
}

// 状态消息显示
function showStatusMessage(message, type = 'success') {
  const elements = getElements();

  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message status-${type}`;
  elements.statusMessage.style.display = 'block';
  elements.statusMessage.style.opacity = '0';
  elements.statusMessage.style.transform = 'translateY(-10px)';

  // 动画显示
  requestAnimationFrame(() => {
    elements.statusMessage.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    elements.statusMessage.style.opacity = '1';
    elements.statusMessage.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    elements.statusMessage.style.opacity = '0';
    elements.statusMessage.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      elements.statusMessage.style.display = 'none';
    }, 300);
  }, 3000);
}

// 配置加载与保存
async function loadConfigurations() {
  try {
    const result = await chrome.storage.local.get([CONFIG_KEY, 'smarteduConfig']);
    pageState.config = { ...DEFAULT_CONFIG, ...result[CONFIG_KEY] };
    pageState.smarteduConfig = { ...DEFAULT_SMARTEDU_CONFIG, ...result.smarteduConfig };

    updateUI();
    showStatusMessage('配置加载成功', 'success');
  } catch (error) {
    console.error('加载配置失败:', error);
    showStatusMessage('配置加载失败', 'error');
  }
}

async function saveConfigurations() {
  const elements = getElements();

  try {
    // 收集配置数据
    const config = {
      humanizeEnabled: elements.humanizeSwitch.classList.contains('active'),
      wrongAnswerRange: {
        min: parseInt(elements.wrongMin.value) || 1,
        max: parseInt(elements.wrongMax.value) || 3
      },
      videoDelay: parseInt(elements.videoDelay.value) || 3
    };

    const smarteduConfig = {
      lessons: elements.smarteduInputs.map(input => parseInt(input.value) || 1),
      courseUrl: elements.smarteduCourseUrl.value || '',
      watchInterval: parseInt(elements.smarteduWatchInterval.value) || 3000
    };

    // 保存到存储
    await chrome.storage.local.set({
      [CONFIG_KEY]: config,
      smarteduConfig: smarteduConfig
    });

    pageState.config = config;
    pageState.smarteduConfig = smarteduConfig;

    // 按钮动画反馈
    elements.saveBtn.style.transform = 'scale(0.95)';
    elements.saveBtn.textContent = '✅ 已保存';

    setTimeout(() => {
      elements.saveBtn.style.transform = 'scale(1)';
      elements.saveBtn.textContent = '💾 保存设置';
    }, 1000);

    showStatusMessage('设置保存成功！', 'success');
  } catch (error) {
    console.error('保存配置失败:', error);
    showStatusMessage('保存失败，请重试', 'error');
  }
}

// UI 更新
function updateUI() {
  const elements = getElements();
  const { config, smarteduConfig } = pageState;

  if (config) {
    // 更新开关状态
    if (config.humanizeEnabled) {
      elements.humanizeSwitch.classList.add('active');
      elements.humanizeSwitch.dataset.enabled = 'true';
      elements.humanizeRangeGroup.style.opacity = '1';
      elements.humanizeRangeGroup.style.pointerEvents = 'auto';
    } else {
      elements.humanizeSwitch.classList.remove('active');
      elements.humanizeSwitch.dataset.enabled = 'false';
      elements.humanizeRangeGroup.style.opacity = '0.5';
      elements.humanizeRangeGroup.style.pointerEvents = 'none';
    }

    // 更新输入值
    elements.wrongMin.value = config.wrongAnswerRange.min;
    elements.wrongMax.value = config.wrongAnswerRange.max;
    elements.videoDelay.value = config.videoDelay;
  }

  if (smarteduConfig) {
    elements.smarteduInputs.forEach((input, index) => {
      if (input && smarteduConfig.lessons[index] !== undefined) {
        input.value = smarteduConfig.lessons[index];
      }
    });

    elements.smarteduCourseUrl.value = smarteduConfig.courseUrl || '';
    elements.smarteduWatchInterval.value = smarteduConfig.watchInterval;
  }
}

// 重置配置
async function resetConfigurations() {
  const elements = getElements();

  try {
    await chrome.storage.local.set({
      [CONFIG_KEY]: DEFAULT_CONFIG,
      smarteduConfig: DEFAULT_SMARTEDU_CONFIG
    });

    pageState.config = { ...DEFAULT_CONFIG };
    pageState.smarteduConfig = { ...DEFAULT_SMARTEDU_CONFIG };

    updateUI();

    // 按钮动画反馈
    elements.resetBtn.style.transform = 'scale(0.95)';
    elements.resetBtn.textContent = '✅ 已重置';

    setTimeout(() => {
      elements.resetBtn.style.transform = 'scale(1)';
      elements.resetBtn.textContent = '🔄 重置设置';
    }, 1000);

    showStatusMessage('设置已重置为默认值', 'success');
  } catch (error) {
    console.error('重置配置失败:', error);
    showStatusMessage('重置失败，请重试', 'error');
  }
}

// 统计扩展信息
async function calculateExtensionStats() {
  const elements = getElements();

  try {
    const manifest = chrome.runtime.getManifest();

    // 1. 版本信息
    const version = `v${manifest.version}`;
    if (elements.sidebarVersion) {
      elements.sidebarVersion.textContent = version;
    }
    if (elements.extensionVersion) {
      elements.extensionVersion.textContent = version;
    }

    // 2. 计算支持的学习平台数量（排除本地测试和API域名）
    const learningPlatforms = manifest.host_permissions.filter(permission =>
      !permission.includes('localhost') &&
      !permission.includes('learn-flow-ashy.vercel.app') &&
      !permission.includes('sxapi.izlx.de')
    );
    const platformCount = learningPlatforms.length;
    if (elements.platformCount) {
      elements.platformCount.textContent = platformCount;
    }

    // 3. 更新题库信息显示（反映实际的API拦截智能答题方式）
    let questionInfo = '3000+';
    try {
      // 检查是否启用了API拦截答题功能
      const examAgentPath = 'injected/agents/exam-agent.js';
      const response = await fetch(chrome.runtime.getURL(examAgentPath));
      const agentContent = await response.text();

      // 检测API拦截功能是否存在
      const hasApiIntercept = agentContent.includes('EXAM_PAPER_RECEIVED') &&
                             agentContent.includes('SUBMIT_ANSWERS');

      if (hasApiIntercept) {
        questionInfo = '3000+';
      } else {
        // 回退检查本地题库
        const bankResponse = await fetch(chrome.runtime.getURL('src/sites/0755tt/questionBank.js'));
        const bankContent = await bankResponse.text();
        const mapMatches = bankContent.match(/new\s+Map\(\[(.*?)\]\)/s);

        if (mapMatches && mapMatches[1].trim()) {
          const entries = mapMatches[1].match(/\["[^"]+",\s*"[^"]+"\]/g);
          questionInfo = entries ? `${entries.length}题` : '本地题库为空';
        } else {
          questionInfo = '本地题库为空';
        }
      }
    } catch (error) {
      console.warn('无法检测答题方式:', error);
      questionInfo = '3000+';
    }

    if (elements.questionCount) {
      elements.questionCount.textContent = questionInfo;
    }

    return { version, platformCount, questionInfo };

  } catch (error) {
    console.error('计算扩展统计信息失败:', error);

    // 显示错误状态
    if (elements.sidebarVersion) elements.sidebarVersion.textContent = '获取失败';
    if (elements.extensionVersion) elements.extensionVersion.textContent = '获取失败';
    if (elements.platformCount) elements.platformCount.textContent = '获取失败';
    if (elements.questionCount) elements.questionCount.textContent = '获取失败';

    return null;
  }
}

// 页面初始化
async function initializePage() {
  const elements = getElements();

  // 优先计算并显示扩展统计信息
  await calculateExtensionStats();

  // 初始化各个模块
  initializeNavigation();
  initializeSwitches();

  // 绑定事件监听器
  if (elements.saveBtn) {
    elements.saveBtn.addEventListener('click', saveConfigurations);
  }

  if (elements.resetBtn) {
    elements.resetBtn.addEventListener('click', resetConfigurations);
  }

  // 输入验证
  [elements.wrongMin, elements.wrongMax].forEach(input => {
    if (input) {
      input.addEventListener('change', () => {
        const min = parseInt(elements.wrongMin.value) || 0;
        const max = parseInt(elements.wrongMax.value) || 0;

        if (min > max) {
          elements.wrongMax.value = min;
          showStatusMessage('最大值不能小于最小值，已自动调整', 'info');
        }
      });
    }
  });

  // 加载配置
  await loadConfigurations();

  // 默认显示第一个页面
  switchSection('automation');
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}
// 深学助手选项页面 - 简化版本

const CONFIG_KEY = 'automationConfig';

// 默认配置
const DEFAULT_CONFIG = {
  humanizeEnabled: false,  // 新增：人性化答错功能总开关
  wrongAnswerRange: { min: 1, max: 3 },
  videoDelay: 3,
  answerDelay: 2
};

// 智慧教育平台默认配置
const DEFAULT_SMARTEDU_CONFIG = {
  lessons: [10, 7, 2, 5, 17, 1, 1, 1], // 8门课程的课时配置
  courseUrl: '',
  watchInterval: 3000
};

// DOM 元素
const statusMessageElement = document.getElementById('status-message');
const supportedSitesCountElement = document.getElementById('supported-sites-count');
const currentVersionElement = document.getElementById('current-version');

// 配置表单元素
const humanizeEnabledElement = document.getElementById('humanize-enabled');
const humanizeRangeGroupElement = document.getElementById('humanize-range-group');
const wrongMinElement = document.getElementById('wrong-min');
const wrongMaxElement = document.getElementById('wrong-max');
const videoDelayElement = document.getElementById('video-delay');
const answerDelayElement = document.getElementById('answer-delay');

// 智慧教育平台配置表单元素
const smarteduLessonElements = [];
for (let i = 0; i < 8; i++) {
  smarteduLessonElements[i] = document.getElementById(`smartedu-lesson-${i}`);
}
const smarteduCourseUrlElement = document.getElementById('smartedu-course-url');
const smarteduWatchIntervalElement = document.getElementById('smartedu-watch-interval');

// 按钮元素
const saveButtonElement = document.getElementById('save-btn');
const resetButtonElement = document.getElementById('reset-btn');

// 显示状态消息
function showStatusMessage(message, type = 'success') {
  statusMessageElement.textContent = message;
  statusMessageElement.className = `status-message ${type}`;
  statusMessageElement.style.display = 'block';
  setTimeout(() => {
    statusMessageElement.style.display = 'none';
  }, 3000);
}

// 获取自动化配置
function getAutomationConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [CONFIG_KEY]: DEFAULT_CONFIG }, (data) => {
      resolve({ ...DEFAULT_CONFIG, ...data[CONFIG_KEY] });
    });
  });
}

// 获取智慧教育平台配置
function getSmartEduConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ smartEduConfig: DEFAULT_SMARTEDU_CONFIG }, (data) => {
      resolve({ ...DEFAULT_SMARTEDU_CONFIG, ...data.smartEduConfig });
    });
  });
}

// 保存自动化配置
function saveAutomationConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [CONFIG_KEY]: config }, resolve);
  });
}

// 保存智慧教育平台配置
function saveSmartEduConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ smartEduConfig: config }, resolve);
  });
}

// 显示版本信息
function loadVersionInfo() {
  try {
    const ver = (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '';
    if (currentVersionElement) currentVersionElement.textContent = ver ? `v${ver}` : '';
    if (supportedSitesCountElement) supportedSitesCountElement.textContent = '2'; // 0755TT + SmartEdu
  } catch {}
}

// 更新人性化范围配置的显示状态
function updateHumanizeRangeVisibility() {
  if (humanizeRangeGroupElement) {
    humanizeRangeGroupElement.style.opacity = humanizeEnabledElement.checked ? '1' : '0.5';
    humanizeRangeGroupElement.style.pointerEvents = humanizeEnabledElement.checked ? 'auto' : 'none';

    // 如果禁用，将范围设为0以确保不会答错
    if (!humanizeEnabledElement.checked) {
      wrongMinElement.value = 0;
      wrongMaxElement.value = 0;
    } else {
      // 如果启用且当前值为0，恢复默认值
      wrongMinElement.value = DEFAULT_CONFIG.wrongAnswerRange.min;
      wrongMaxElement.value = DEFAULT_CONFIG.wrongAnswerRange.max;
    }
  }
}

// 加载配置到表单
async function loadConfiguration() {
  try {
    const config = await getAutomationConfig();
    const smartEduConfig = await getSmartEduConfig();

    // 加载基础配置
    humanizeEnabledElement.checked = config.humanizeEnabled || false;
    wrongMinElement.value = config.wrongAnswerRange.min;
    wrongMaxElement.value = config.wrongAnswerRange.max;
    videoDelayElement.value = config.videoDelay;
    answerDelayElement.value = config.answerDelay;

    // 更新人性化范围显示状态
    updateHumanizeRangeVisibility();

    // 加载智慧教育平台配置
    for (let i = 0; i < 8; i++) {
      if (smarteduLessonElements[i]) {
        smarteduLessonElements[i].value = smartEduConfig.lessons[i] || DEFAULT_SMARTEDU_CONFIG.lessons[i] || 1;
      }
    }
    smarteduCourseUrlElement.value = smartEduConfig.courseUrl || '';
    smarteduWatchIntervalElement.value = smartEduConfig.watchInterval || 3000;

  } catch (error) {
    console.error('加载配置时出错:', error);
    showStatusMessage('加载配置失败', 'error');
  }
}

function validateConfiguration() {
  const wrongMin = parseInt(wrongMinElement.value);
  const wrongMax = parseInt(wrongMaxElement.value);
  const videoDelay = parseInt(videoDelayElement.value);
  const answerDelay = parseInt(answerDelayElement.value);

  // 智慧教育平台配置验证
  const watchInterval = parseInt(smarteduWatchIntervalElement.value);

  if (wrongMin < 0 || wrongMin > 10) {
    showStatusMessage('最小答错题数必须在0-10之间', 'error');
    wrongMinElement.focus();
    return false;
  }

  if (wrongMax < 0 || wrongMax > 10) {
    showStatusMessage('最大答错题数必须在0-10之间', 'error');
    wrongMaxElement.focus();
    return false;
  }

  if (wrongMin > wrongMax) {
    showStatusMessage('最小答错题数不能大于最大答错题数', 'error');
    wrongMinElement.focus();
    return false;
  }

  // 验证延迟设置
  if (videoDelay < 1 || videoDelay > 30) {
    showStatusMessage('视频播放间隔必须在1-30秒之间', 'error');
    videoDelayElement.focus();
    return false;
  }

  if (answerDelay < 1 || answerDelay > 10) {
    showStatusMessage('答题延迟必须在1-10秒之间', 'error');
    answerDelayElement.focus();
    return false;
  }

  // 智慧教育平台配置验证
  for (let i = 0; i < 8; i++) {
    if (smarteduLessonElements[i]) {
      const lessonValue = parseInt(smarteduLessonElements[i].value);
      if ((lessonValue < 1 || lessonValue > 50) && lessonValue !== -1) {
        showStatusMessage(`第${i + 1}门课程课时数必须在1-50之间或设为-1`, 'error');
        smarteduLessonElements[i].focus();
        return false;
      }
    }
  }

  if (watchInterval < 1000 || watchInterval > 10000) {
    showStatusMessage('监控间隔必须在1000-10000毫秒之间', 'error');
    smarteduWatchIntervalElement.focus();
    return false;
  }

  return true;
}

// 保存所有配置
async function saveAllConfiguration() {
  if (!validateConfiguration()) {
    return;
  }

  try {
    // 禁用保存按钮，防止重复点击
    saveButtonElement.disabled = true;
    saveButtonElement.textContent = '💾 保存中...';

    // 保存基础配置
    const config = {
      humanizeEnabled: humanizeEnabledElement.checked,
      wrongAnswerRange: {
        min: parseInt(wrongMinElement.value),
        max: parseInt(wrongMaxElement.value)
      },
      videoDelay: parseInt(videoDelayElement.value),
      answerDelay: parseInt(answerDelayElement.value)
    };
    await saveAutomationConfig(config);

    // 保存智慧教育平台配置
    const lessons = [];
    for (let i = 0; i < 8; i++) {
      if (smarteduLessonElements[i]) {
        lessons[i] = parseInt(smarteduLessonElements[i].value);
      }
    }

    const smartEduConfig = {
      lessons: lessons,
      courseUrl: smarteduCourseUrlElement.value.trim(),
      watchInterval: parseInt(smarteduWatchIntervalElement.value)
    };
    await saveSmartEduConfig(smartEduConfig);

    showStatusMessage('✅ 所有设置已保存成功！');

  } catch (error) {
    console.error('保存配置时出错:', error);
    showStatusMessage('保存失败，请重试', 'error');
  } finally {
    saveButtonElement.disabled = false;
    saveButtonElement.textContent = '💾 保存设置';
  }
}

// 重置所有配置
async function resetAllConfiguration() {
  const confirmReset = confirm('确定要重置所有设置吗？这将恢复默认配置。');

  if (!confirmReset) {
    return;
  }

  try {
    // 禁用重置按钮
    resetButtonElement.disabled = true;
    resetButtonElement.textContent = '🔄 重置中...';

    // 重置所有配置
    await saveAutomationConfig(DEFAULT_CONFIG);
    await saveSmartEduConfig(DEFAULT_SMARTEDU_CONFIG);

    // 重新加载配置到表单
    await loadConfiguration();

    showStatusMessage('✅ 设置已重置为默认配置！');
  } catch (error) {
    console.error('重置配置时出错:', error);
    showStatusMessage('重置失败，请重试', 'error');
  } finally {
    resetButtonElement.disabled = false;
    resetButtonElement.textContent = '🔄 重置设置';
  }
}

// 绑定按钮事件
function bindButtonEvents() {
  saveButtonElement.addEventListener('click', saveAllConfiguration);
  resetButtonElement.addEventListener('click', resetAllConfiguration);
}

// 绑定表单验证事件
function bindValidationEvents() {
  // 人性化开关事件
  humanizeEnabledElement.addEventListener('change', updateHumanizeRangeVisibility);

  // 实时验证答错题数范围
  wrongMinElement.addEventListener('input', () => {
    const min = parseInt(wrongMinElement.value);
    const max = parseInt(wrongMaxElement.value);
    if (min > max) {
      wrongMaxElement.value = min;
    }
  });

  wrongMaxElement.addEventListener('input', () => {
    const min = parseInt(wrongMinElement.value);
    const max = parseInt(wrongMaxElement.value);
    if (max < min) {
      wrongMinElement.value = max;
    }
  });
}

// 初始化页面
async function initializePage() {
  try {
    // 加载版本信息
    loadVersionInfo();

    // 加载配置
    await loadConfiguration();

    // 绑定事件
    bindButtonEvents();
    bindValidationEvents();

    // 初始化人性化范围显示状态
    updateHumanizeRangeVisibility();
  } catch (error) {
    console.error('初始化页面时出错:', error);
    showStatusMessage('页面初始化失败', 'error');
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializePage);
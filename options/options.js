// 深学助手选项页面 - 使用消息传递架构
// 通过chrome.runtime.sendMessage从后台脚本获取平台定义

const STORAGE_KEY = 'enabledSites';
const CONFIG_KEY = 'automationConfig';

// 默认配置
const DEFAULT_CONFIG = {
  wrongAnswerRange: { min: 0, max: 1 },
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
const siteListElement = document.getElementById('site-list');
const statusMessageElement = document.getElementById('status-message');
const supportedSitesCountElement = document.getElementById('supported-sites-count');
const currentVersionElement = document.getElementById('current-version');

// 配置表单元素
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
  statusMessageElement.className = `status-message status-${type}`;
  statusMessageElement.style.display = 'block';
  
  // 3秒后自动隐藏
  setTimeout(() => {
    statusMessageElement.style.display = 'none';
  }, 3000);
}

// 获取站点配置
function getSiteConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ [STORAGE_KEY]: {} }, (data) => {
      resolve(data[STORAGE_KEY] || {});
    });
  });
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

// 保存站点配置
function saveSiteConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: config }, resolve);
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

// 从后台脚本获取平台定义
function getPlatforms() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'getPlatformDefinitions' }, (response) => {
      if (chrome.runtime.lastError) {
        // 如果后台脚本出错或未响应
        return reject(chrome.runtime.lastError);
      }
      if (response) {
        resolve(response);
      } else {
        reject(new Error("未能从后台获取平台定义。"));
      }
    });
  });
}

// 创建平台项目HTML
function createPlatformItem(platform, enabled) {
  const domainsText = platform.domains.length > 1 ? 
    `包含 ${platform.domains.length} 个域名: ${platform.domains.join(', ')}` : 
    platform.domains[0];
    
  return `
    <div class="site-item" data-platform-id="${platform.id}">
      <div class="site-info">
        <div class="site-name">${platform.icon} ${platform.name}</div>
        <div class="site-url">${domainsText}</div>
        <div style="font-size: 12px; color: #888; margin-top: 4px;">${platform.description}</div>
      </div>
      <label class="switch">
        <input type="checkbox" ${enabled ? 'checked' : ''} data-platform-id="${platform.id}" />
        <span class="slider"></span>
      </label>
    </div>
  `;
}


// 渲染平台列表（使用消息传递获取数据）
async function renderPlatformList() {
  try {
    // 显示版本
    try {
      const ver = (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '';
      if (currentVersionElement) currentVersionElement.textContent = ver ? `v${ver}` : '';
    } catch {}
    // 不再等待 window.DeepLearnPlatforms，而是直接请求
    const platforms = await getPlatforms();
    const siteConfig = await getSiteConfig();
    
    let html = '';
    
    for (const platformId in platforms) {
      const platform = platforms[platformId];
      // 检查该平台所有域名是否都已启用
      const platformEnabled = platform.domains.every(domain => siteConfig[domain] !== false);
      html += createPlatformItem(platform, platformEnabled);
    }
    
    siteListElement.innerHTML = html;
    supportedSitesCountElement.textContent = Object.keys(platforms).length;
    
    bindPlatformToggleEvents();
    
  } catch (error) {
    console.error('渲染平台列表时出错:', error);
    showStatusMessage('加载平台列表失败', 'error');
  }
}

// 绑定平台开关事件（使用消息传递获取数据）
function bindPlatformToggleEvents() {
    const platformToggles = siteListElement.querySelectorAll('input[type="checkbox"][data-platform-id]');
  
    platformToggles.forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const platformId = e.target.dataset.platformId;
        const enabled = e.target.checked;
        
        try {
          const platforms = await getPlatforms();
          const platform = platforms[platformId];
          const config = await getSiteConfig();
          
          platform.domains.forEach(domain => {
            config[domain] = enabled;
          });
          
          await saveSiteConfig(config);
          showStatusMessage(`${platform.name} ${enabled ? '已启用' : '已禁用'}`);
          
        } catch (error) {
          console.error('保存平台配置时出错:', error);
          showStatusMessage('保存配置失败', 'error');
          // 恢复开关状态
          e.target.checked = !enabled;
        }
      });
    });
}

// 加载配置到表单
async function loadConfiguration() {
  try {
    const config = await getAutomationConfig();
    const smartEduConfig = await getSmartEduConfig();
    
    // 加载基础配置
    wrongMinElement.value = config.wrongAnswerRange.min;
    wrongMaxElement.value = config.wrongAnswerRange.max;
    videoDelayElement.value = config.videoDelay;
    answerDelayElement.value = config.answerDelay;
    
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
  
  // 验证答错题数范围
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
    showStatusMessage('保存设置失败', 'error');
  } finally {
    // 恢复按钮状态
    saveButtonElement.disabled = false;
    saveButtonElement.textContent = '💾 保存设置';
  }
}

// 重置所有配置
async function resetAllConfiguration() {
  const confirmReset = confirm('确定要重置所有设置吗？这将恢复默认配置并启用所有支持的站点。');
  
  if (!confirmReset) {
    return;
  }
  
  try {
    // 禁用重置按钮
    resetButtonElement.disabled = true;
    resetButtonElement.textContent = '🔄 重置中...';
    
    // 重置站点配置（全部启用）
    const platforms = await getPlatforms();
    const defaultSiteConfig = {};
    Object.values(platforms).forEach(platform => {
      platform.domains.forEach(domain => {
        defaultSiteConfig[domain] = true;
      });
    });
    await saveSiteConfig(defaultSiteConfig);
    
    // 重置自动化配置
    await saveAutomationConfig(DEFAULT_CONFIG);
    
    // 重置智慧教育平台配置
    await saveSmartEduConfig(DEFAULT_SMARTEDU_CONFIG);
    
    // 重新加载界面
    await renderPlatformList();
    await loadConfiguration();
    
    showStatusMessage('✅ 所有设置已重置为默认值！');
    
  } catch (error) {
    console.error('重置配置时出错:', error);
    showStatusMessage('重置设置失败', 'error');
  } finally {
    // 恢复按钮状态
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
    // 渲染平台列表
    await renderPlatformList();
    
    // 加载配置
    await loadConfiguration();
    
    // 绑定事件
    bindButtonEvents();
    bindValidationEvents();
    
    console.log('选项页面初始化完成');
    
  } catch (error) {
    console.error('初始化页面时出错:', error);
    showStatusMessage('页面初始化失败', 'error');
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializePage);

// 智能选择器解析引擎 - 优化版本
(() => {
  const ns = (window.DeepLearn ||= {});
  const resolver = (ns.selectorResolver ||= {});

  // 核心API：现在是唯一的查找入口，内置完整的自动回退逻辑
  resolver.resolve = function(selectorConfig, context = document, configKey = null) {
    // --- 调试代码开始 ---
    console.log(
        `%c[Resolver ENTRY] Key: %c${configKey || 'NULL'}%c, Selectors:`,
        'color: blue; font-weight: bold;',
        `color: ${configKey ? 'green' : 'red'}; font-weight: bold;`,
        'color: blue; font-weight: bold;',
        selectorConfig
    );
    // --- 调试代码结束 ---

    if (typeof selectorConfig === 'string') {
      return context.querySelectorAll(selectorConfig);
    }

    if (Array.isArray(selectorConfig)) {
      // 传统数组格式，依次尝试
      const result = trySelectors(selectorConfig, context);
      if (result.length > 0) {
        return result;
      }
      
      // 传统选择器全部失败，启动自适应发现
      return performIntelligentDiscovery(configKey, context);
    }

    if (typeof selectorConfig === 'object') {
      // 增强配置格式
      return resolveAdvancedConfig(selectorConfig, context);
    }

    return [];
  };

  // 尝试传统选择器数组
  function trySelectors(selectors, context) {
    for (const selector of selectors) {
      try {
        const elements = context.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`[选择器解析] 传统选择器成功: ${selector} (找到 ${elements.length} 个元素)`);
          return elements;
        }
      } catch (e) {
        console.warn(`[选择器解析] 无效选择器: ${selector}`, e);
      }
    }
    return [];
  }

  // 智能发现：基于configKey提示进行针对性发现
  function performIntelligentDiscovery(configKey, context) {
    if (!ns.adaptiveSelectors || !ns.adaptiveSelectors.discoverSelectors) {
      console.warn('[选择器解析] 自适应发现模块不可用');
      return [];
    }

    console.log(`[选择器解析] 传统选择器失败，启动智能发现 (提示: ${configKey})`);
    
    try {
      const discovered = ns.adaptiveSelectors.discoverSelectors();
      
      // 根据configKey提示，选择对应的发现结果
      let targetSelectors = [];
      switch (configKey) {
        case 'questionItems':
          targetSelectors = discovered.questionItems || [];
          break;
        case 'radioOptions':
          targetSelectors = discovered.radioOptions || [];
          break;
        case 'checkboxOptions':
          targetSelectors = discovered.checkboxOptions || [];
          break;
        case 'submitButtons':
          targetSelectors = discovered.submitButtons || [];
          break;
        default:
          // 无提示时，尝试所有发现的选择器
          targetSelectors = [
            ...(discovered.questionItems || []),
            ...(discovered.radioOptions || []),
            ...(discovered.checkboxOptions || []),
            ...(discovered.submitButtons || [])
          ];
      }

      // 使用发现的选择器进行查找
      for (const selector of targetSelectors) {
        try {
          const elements = context.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`[选择器解析] 智能发现成功: ${selector} (${configKey}) 找到 ${elements.length} 个元素`);
            return elements;
          }
        } catch (e) {
          console.warn(`[选择器解析] 发现的选择器无效: ${selector}`, e);
        }
      }
    } catch (e) {
      console.warn('[选择器解析] 智能发现失败:', e);
    }

    console.warn(`[选择器解析] 所有策略都失败了 (提示: ${configKey})`);
    return [];
  }

  // 解析增强配置（保持原有逻辑）
  function resolveAdvancedConfig(config, context) {
    const strategies = ['primary', 'semantic', 'structural', 'framework', 'discovery'];
    
    for (const strategy of strategies) {
      if (!config[strategy]) continue;

      if (strategy === 'discovery' && config.discovery === 'auto') {
        const discovered = performAutoDiscovery(config, context);
        if (discovered.length > 0) {
          console.log(`[自适应发现] 成功发现 ${discovered.length} 个元素`);
          return discovered;
        }
        continue;
      }

      const elements = trySelectors(config[strategy], context);
      if (elements.length > 0) {
        console.log(`[选择器解析] 通过 ${strategy} 策略成功匹配`);
        return elements;
      }
    }

    console.warn('[选择器解析] 所有策略都失败了');
    return [];
  }

  // 自动发现功能（保持原有逻辑）
  function performAutoDiscovery(config, context) {
    const configKey = getConfigKey(config);
    return performIntelligentDiscovery(configKey, context);
  }

  // 推测配置类型（保持原有逻辑）
  function getConfigKey(config) {
    if (config.primary) {
      const firstSelector = config.primary[0] || '';
      if (firstSelector.includes('radio')) return 'radioOptions';
      if (firstSelector.includes('checkbox')) return 'checkboxOptions';
      if (firstSelector.includes('question')) return 'questionItems';
      if (firstSelector.includes('button') || firstSelector.includes('确定')) return 'submitButtons';
    }
    return 'unknown';
  }

  // 统一的API接口
  resolver.querySelector = function(selectorConfig, context = document, configKey = null) {
    const elements = resolver.resolve(selectorConfig, context, configKey);
    return elements.length > 0 ? elements[0] : null;
  };

  resolver.querySelectorAll = function(selectorConfig, context = document, configKey = null) {
    return Array.from(resolver.resolve(selectorConfig, context, configKey));
  };

  console.log('[深学助手] 智能选择器解析引擎已加载 (优化版本)');
})();
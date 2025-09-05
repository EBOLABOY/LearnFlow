(() => {
  const ns = (window.DeepLearn ||= {});
  const bankNS = (ns.bank ||= {});

  // 通用题库管理模块
  // 用于扩展更多平台的题库支持

  // 题库合并函数
  bankNS.mergeBanks = function(target, source) {
    for (const [question, answer] of source.entries()) {
      target.set(question, answer);
    }
    return target;
  };

  // 题库统计函数
  bankNS.getStats = function(bank) {
    const stats = {
      total: bank.size,
      trueCount: 0,
      falseCount: 0,
      multiChoice: 0,
      singleChoice: 0
    };

    for (const [question, answer] of bank.entries()) {
      if (answer === 'T') stats.trueCount++;
      else if (answer === 'F') stats.falseCount++;
      else if (answer.includes(',')) stats.multiChoice++;
      else stats.singleChoice++;
    }

    return stats;
  };

  // 题库导出函数（用于调试）
  bankNS.exportToJson = function(bank, filename = 'questionBank.json') {
    const data = {};
    for (const [question, answer] of bank.entries()) {
      data[question] = answer;
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  console.log('[深学助手] 题库管理模块已加载');
})();
(() => {
  const ns = (window.DeepLearn ||= {});
  const bankNS = (ns.bank ||= {});

  // 初始化站点题库：默认空表，可按需填充。
  // 结构示例：
  // ["题目完整文本", "答案标识"]
  // 答案标识：'T'/'F' 表示判断；'A'|'B'|'C'|'D' 表示单选；'A,B' 这种逗号分隔表示多选。
  bankNS.questionBank = bankNS.questionBank || new Map([
    // ["示例：某题目的完整文本", "A"],
  ]);

  // 兼容旧逻辑：暴露全局别名供 exam.js 读取
  try { window.questionBank = bankNS.questionBank; } catch {}
})();


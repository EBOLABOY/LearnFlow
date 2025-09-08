const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const UglifyJS = require('uglify-js');
const esbuild = require('esbuild');

console.log('[深学助手构建] 开始构建混淆版本...');

// 以仓库根为基准
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 混淆配置
const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  debugProtection: false,
  debugProtectionInterval: 0,
  disableConsoleOutput: false,
  domainLock: [],
  domainLockRedirectUrl: 'about:blank',
  forceTransformStrings: [],
  identifierNamesGenerator: 'hexadecimal',
  identifiersPrefix: '',
  ignoreRequireImports: false,
  inputFileName: '',
  log: false,
  numbersToExpressions: true,
  optionsPreset: 'default',
  renameGlobals: false,
  renameProperties: false,
  renamePropertiesMode: 'safe',
  reservedNames: [],
  reservedStrings: [],
  seed: 0,
  selfDefending: true,
  simplify: true,
  sourceMap: true,
  sourceMapBaseUrl: '',
  sourceMapFileName: '',
  sourceMapMode: 'separate',
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.5,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: 'variable',
  stringArrayThreshold: 0.75,
  target: 'browser',
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
};

// 需要混淆的JavaScript文件列表（以仓库根为相对路径）
const jsFiles = [
  // popup.js 需要特殊处理，不在这里
  'src/platforms.js',
  'src/util.js',
  'src/bank.js', 
  'src/registry.js',
  'injected/agents/exam-agent.js',
  'injected/agents/video-agent.js',
  'src/sites/0755tt/questionBank.js',
  'src/sites/0755tt/video.js', 
  'src/sites/0755tt/exam.config.js',
  'src/sites/0755tt/exam.js',
  'src/sites/0755tt/index.js',
  'src/sites/smartedu/index.js',
  'src/sites/smartedu/automation.js',
  'src/sites/smartedu/agent.js',
  'src/sites/smartedu/config.js',
  'content/loader.js',
  'options/options.js',
  // 可选：通用注入桥
  'injected/common/message-bridge.js',
].filter((p) => fs.existsSync(path.join(rootDir, p)));

function writeObfuscatedWithMap(targetPath, obfuscationResult) {
  try {
    let code = obfuscationResult.getObfuscatedCode();
    const map = obfuscationResult.getSourceMap();
    if (obfuscationOptions.sourceMap && map) {
      const mapName = path.basename(targetPath) + '.map';
      if (!/sourceMappingURL=/.test(code)) {
        code += '\n//# sourceMappingURL=' + mapName + '\n';
      }
      fs.writeFileSync(targetPath, code);
      fs.writeFileSync(targetPath + '.map', map);
    } else {
      fs.writeFileSync(targetPath, code);
    }
  } catch {
    try { fs.writeFileSync(targetPath, obfuscationResult.getObfuscatedCode()); } catch {}
  }
}

function obfuscicationOptionsWithInput(relativeFilePath) {
  return { ...obfuscationOptions, inputFileName: relativeFilePath, sourceMapFileName: path.basename(relativeFilePath) + '.map' };
}

// 复制并混淆JS文件
function processJavaScriptFile(relativeFilePath) {
  const sourcePath = path.join(rootDir, relativeFilePath);
  const targetPath = path.join(distDir, relativeFilePath);
  if (!fs.existsSync(sourcePath)) { console.log(`⚠️  文件不存在 ${relativeFilePath}`); return; }
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  try {
    const sourceCode = fs.readFileSync(sourcePath, 'utf8');
    const minified = UglifyJS.minify(sourceCode, {
      compress: { dead_code: true, drop_console: false, drop_debugger: true, keep_fargs: false, unused: true },
      mangle: { reserved: ['chrome', 'browser', 'window', 'document', 'DeepLearn'] },
    });
    const code = minified.error ? sourceCode : minified.code;
    const obfuscated = JavaScriptObfuscator.obfuscate(code, obfuscicationOptionsWithInput(relativeFilePath));
    writeObfuscatedWithMap(targetPath, obfuscated);
    console.log(`✅ 已处理: ${relativeFilePath}`);
  } catch (error) {
    console.log(`❌ 处理失败 ${relativeFilePath}:`, error.message);
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function copyFile(relativeFilePath, to = null) {
  const sourcePath = path.join(rootDir, relativeFilePath);
  const targetPath = path.join(distDir, to || relativeFilePath.replace(/^extension\//, ''));
  if (!fs.existsSync(sourcePath)) { console.log(`⚠️  文件不存在 ${relativeFilePath}`); return; }
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`📋 已复制: ${relativeFilePath} -> ${path.relative(distDir, targetPath)}`);
}

// 打包 Service Worker 背景脚本
function buildBackgroundScript() {
  const outFile = path.join(distDir, 'background.js');
  console.log('\n🚧 esbuild 打包 background.js ...');
  try {
    esbuild.buildSync({
      entryPoints: [path.join(rootDir, 'extension/background.js')],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      target: ['es2020'],
      outfile: outFile,
      sourcemap: true,
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      logLevel: 'silent',
    });
    console.log('✅ background.js 打包完成');
  } catch (err) {
    console.error('❌ background.js 打包失败:', err && err.message ? err.message : err);
    const sourcePath = path.join(rootDir, 'extension/background.js');
    const targetDir = path.dirname(outFile);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(sourcePath, outFile);
  }
}

// 开始构建
buildBackgroundScript();

console.log('\n🔧 处理其他 JavaScript 文件...');
jsFiles.forEach(processJavaScriptFile);

// 特殊处理 popup.js - 输出到根目录
console.log('\n🔧 处理 popup.js...');
{
  const sourcePath = path.join(rootDir, 'extension/popup.js');
  const targetPath = path.join(distDir, 'popup.js');
  if (fs.existsSync(sourcePath)) {
    try {
      const sourceCode = fs.readFileSync(sourcePath, 'utf8');
      const minified = UglifyJS.minify(sourceCode, {
        compress: { dead_code: true, drop_console: false, drop_debugger: true, keep_fargs: false, unused: true },
        mangle: { reserved: ['chrome', 'browser', 'window', 'document', 'DeepLearn'] },
      });
      const code = minified.error ? sourceCode : minified.code;
      const obfuscated = JavaScriptObfuscator.obfuscate(code, obfuscicationOptionsWithInput('popup.js'));
      writeObfuscatedWithMap(targetPath, obfuscated);
      console.log(`✅ 已处理: popup.js → 根目录`);
    } catch (error) {
      console.log(`❌ 处理失败 popup.js:`, error.message);
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

console.log('\n📂 复制其他文件...');
// 复制 manifest.json 和 popup.html 到根目录
if (fs.existsSync(path.join(rootDir, 'extension/manifest.json'))) {
  fs.copyFileSync(path.join(rootDir, 'extension/manifest.json'), path.join(distDir, 'manifest.json'));
  console.log(`📋 已复制: manifest.json`);
}
if (fs.existsSync(path.join(rootDir, 'extension/popup.html'))) {
  fs.copyFileSync(path.join(rootDir, 'extension/popup.html'), path.join(distDir, 'popup.html'));
  console.log(`📋 已复制: popup.html`);
}

// options.html 保持在 options 目录
const optionsTargetDir = path.join(distDir, 'options');
if (!fs.existsSync(optionsTargetDir)) fs.mkdirSync(optionsTargetDir, { recursive: true });
if (fs.existsSync(path.join(rootDir, 'options/options.html'))) {
  fs.copyFileSync(path.join(rootDir, 'options/options.html'), path.join(optionsTargetDir, 'options.html'));
  console.log(`📋 已复制: options/options.html`);
}

// 复制 icons 目录
const iconsSourceDir = path.join(rootDir, 'assets/icons');
const iconsTargetDir = path.join(distDir, 'icons');
if (fs.existsSync(iconsSourceDir)) {
  if (!fs.existsSync(iconsTargetDir)) fs.mkdirSync(iconsTargetDir, { recursive: true });
  ['icon16.png', 'icon48.png', 'icon128.png'].forEach(iconFile => {
    const iconSource = path.join(iconsSourceDir, iconFile);
    const iconTarget = path.join(iconsTargetDir, iconFile);
    if (fs.existsSync(iconSource)) {
      fs.copyFileSync(iconSource, iconTarget);
      console.log(`📦 已复制: icons/${iconFile}`);
    }
  });
}

console.log('\n🎉 构建完成！混淆版本已生成到 dist/ 目录');

// 统计文件大小
console.log('📊 构建统计:');
let totalOriginalSize = 0;
let totalObfuscatedSize = 0;

jsFiles.forEach((file) => {
  const originalPath = path.join(rootDir, file);
  const obfuscatedPath = path.join(distDir, file);
  if (fs.existsSync(originalPath) && fs.existsSync(obfuscatedPath)) {
    const originalSize = fs.statSync(originalPath).size;
    const obfuscatedSize = fs.statSync(obfuscatedPath).size;
    totalOriginalSize += originalSize;
    totalObfuscatedSize += obfuscatedSize;
    const ratio = ((obfuscatedSize / originalSize) * 100).toFixed(1);
    console.log(`   ${file}: ${originalSize} → ${obfuscatedSize} bytes (${ratio}%)`);
  }
});

console.log(`\n📈 总体: ${totalOriginalSize} → ${totalObfuscatedSize} bytes (${((totalObfuscatedSize / totalOriginalSize) * 100).toFixed(1)}%)`);

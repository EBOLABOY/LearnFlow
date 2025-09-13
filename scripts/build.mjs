// Unified build script: background bundle + manifest templating + static copy
// Usage: BUILD_ENV=development node scripts/build.mjs
import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';
// 移除混淆：不再导入 javascript-obfuscator
import UglifyJS from 'uglify-js';

const root = process.cwd();
const dist = path.join(root, 'dist');
const BUILD_ENV = process.env.BUILD_ENV || 'development';
const isProd = BUILD_ENV === 'production';

if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// 1) bundle background (keep compatibility with current extension layout)
const backgroundEntry = path.join(root, 'extension', 'background.js');
if (fs.existsSync(backgroundEntry)) {
  await esbuild.build({
    entryPoints: [backgroundEntry],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: ['es2020'],
    outfile: path.join(dist, 'background.js'),
    sourcemap: !isProd,
    minify: isProd,
    define: {
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
      'process.env.BUILD_ENV': JSON.stringify(BUILD_ENV),
      'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN || ''),
    },
    logLevel: 'info',
  });
}

// helper: deep merge objects (arrays replaced)
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
      deepMerge(target[key], sv);
    } else {
      target[key] = sv;
    }
  }
  return target;
}

// 2) build manifest from base + env patch
function buildManifest() {
  console.log('Building manifest.json...');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const base = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.base.json'), 'utf8'));
  const envPath = isProd ? path.join(root, 'extension', 'manifest.prod.json') : path.join(root, 'extension', 'manifest.dev.json');
  const patch = fs.existsSync(envPath) ? JSON.parse(fs.readFileSync(envPath, 'utf8')) : {};
  const finalManifest = deepMerge({}, base);
  deepMerge(finalManifest, patch);
  finalManifest.version = pkg.version;
  fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(finalManifest, null, 2));
  console.log(`manifest.json built for ${BUILD_ENV} with version ${pkg.version}`);
}

buildManifest();

// 3) copy popup
for (const f of ['popup.html', 'popup.js']) {
  const p = path.join(root, 'extension', f);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(dist, f));
}

// 4) copy icons
const iconsDir = path.join(root, 'assets', 'icons');
if (fs.existsSync(iconsDir)) {
  const out = path.join(dist, 'icons');
  fs.mkdirSync(out, { recursive: true });
  // 复制所有需要的图标文件，包括禁用状态的图标
  const iconsToCopy = [
    'icon16.png', 'icon48.png', 'icon128.png',
    'icon16_disabled.png', 'icon48_disabled.png', 'icon128_disabled.png'
  ];
  for (const f of iconsToCopy) {
    const p = path.join(iconsDir, f);
    if (fs.existsSync(p)) {
      fs.copyFileSync(p, path.join(out, f));
      console.log(`✅ 复制图标: ${f}`);
    } else {
      console.log(`⚠️  图标文件不存在: ${f}`);
    }
  }

  // 4.1) 生成（或覆盖）灰度禁用图标，确保真正是灰色
  try {
    let JimpModule = null;
    try {
      // 动态导入，避免在未安装依赖时崩溃
      JimpModule = await import('jimp');
    } catch {}
    const Jimp = JimpModule && (JimpModule.default || JimpModule.Jimp || JimpModule);
    if (Jimp) {
      const pairs = [
        { base: 'icon16.png', out: 'icon16_disabled.png' },
        { base: 'icon48.png', out: 'icon48_disabled.png' },
        { base: 'icon128.png', out: 'icon128_disabled.png' },
      ];
      for (const { base, out: of } of pairs) {
        const basePath = path.join(out, base);
        const outPath = path.join(out, of);
        if (!fs.existsSync(basePath)) continue;
        try {
          const img = await Jimp.read(basePath);
          img.grayscale(); // 转为灰度
          await img.write(outPath);
          console.log(`🎨  生成灰度禁用图标: ${of}`);
        } catch (e) {
          console.log(`⚠️  生成灰度图标失败 ${of}:`, e?.message || e);
        }
      }
    } else {
      console.log('ℹ️ 未安装 jimp，跳过灰度图标生成。如需生成，请运行: npm i -D jimp');
    }
  } catch (e) {
    console.log('⚠️  灰度图标生成步骤异常:', e?.message || e);
  }
}

console.log(`Build completed (BUILD_ENV=${BUILD_ENV}). Output: dist/`);

// --- Production JavaScript processing (minify + obfuscate) or dev copy ---

const jsFiles = [
  // popup.js handled separately above
  'src/platforms.js',
  'src/util.js',
  'src/constants.js',
  'src/registry.js',
  'injected/agents/exam-agent.js',
  'injected/agents/video-agent.js',
  'src/sites/0755tt/questionBank.js',
  'src/sites/0755tt/selector-resolver.js',
  'src/sites/0755tt/adaptive-selectors.js',
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
  'injected/common/message-bridge.js'
].filter((p) => fs.existsSync(path.join(root, p)));

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

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeObfuscatedWithMap(targetPath, obfuscationResult) {
  try {
    let code = obfuscationResult.getObfuscatedCode();
    const map = obfuscationResult.getSourceMap();
    const mapName = path.basename(targetPath) + '.map';
    if (obfuscationOptions.sourceMap && map) {
      if (!/sourceMappingURL=/.test(code)) code += `\n//# sourceMappingURL=${mapName}\n`;
      fs.writeFileSync(targetPath, code);
      fs.writeFileSync(targetPath + '.map', map);
    } else {
      fs.writeFileSync(targetPath, code);
    }
  } catch {
    try { fs.writeFileSync(targetPath, obfuscationResult.getObfuscatedCode()); } catch {}
  }
}

function processJavaScriptFile(relativeFilePath) {
  const sourcePath = path.join(root, relativeFilePath);
  const targetPath = path.join(dist, relativeFilePath);
  if (!fs.existsSync(sourcePath)) { console.log(`⚠️  文件不存在: ${relativeFilePath}`); return; }
  ensureDir(targetPath);
  try {
    const sourceCode = fs.readFileSync(sourcePath, 'utf8');
    if (isProd) {
      const minified = UglifyJS.minify(sourceCode, {
        compress: { dead_code: true, drop_console: false, drop_debugger: true, keep_fargs: false, unused: true },
        mangle: { reserved: ['chrome', 'browser', 'window', 'document', 'DeepLearn'] },
      });
      const code = minified.error ? sourceCode : minified.code;
      // 仅进行压缩输出（Edge/Chrome 商店禁止代码混淆）
      fs.writeFileSync(targetPath, code);
      console.log(`✅ 已压缩 ${relativeFilePath}`);
    } else {
      // Dev: copy as-is
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`📋 已复制 ${relativeFilePath}`);
    }
  } catch (error) {
    console.log(`❌ 处理失败 ${relativeFilePath}:`, error?.message || error);
    try { fs.copyFileSync(sourcePath, targetPath); } catch {}
  }
}

// process listed site/agent/content scripts
jsFiles.forEach(processJavaScriptFile);

// also ensure options.html present
const optionsHtmlSrc = path.join(root, 'options', 'options.html');
if (fs.existsSync(optionsHtmlSrc)) {
  const outDir = path.join(dist, 'options');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(optionsHtmlSrc, path.join(outDir, 'options.html'));
}

// Normalize all JS outputs to UTF-8 to satisfy Chrome content script loader
try {
  function normalizeToUtf8(fp) {
    try {
      const buf = fs.readFileSync(fp);
      const str = buf.toString('utf8');
      fs.writeFileSync(fp, str, 'utf8');
    } catch {}
  }
  jsFiles.forEach((rel) => {
    const out = path.join(dist, rel);
    if (fs.existsSync(out)) normalizeToUtf8(out);
  });
} catch {}

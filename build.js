const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const UglifyJS = require('uglify-js');
const esbuild = require('esbuild');

console.log('[深学助手构建] 开始构建混淆版本...');

// 创建输出目录
const distDir = path.join(__dirname, 'dist');
const srcDir = __dirname;

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
    disableConsoleOutput: false, // 保留控制台输出便于调试
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
    unicodeEscapeSequence: false
};

// 需要混淆的JavaScript文件列表
const jsFiles = [
    'popup.js',
    'src/platforms.js', // 添加缺失的平台定义文件
    'src/util.js',
    'src/bank.js',
    'src/registry.js',
    'injected/0755tt-exam-agent.js',
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
    'injected/video-agent.js',
    'options/options.js'
];

// 为混淆结果写入代码与 source map
function writeObfuscatedWithMap(targetPath, obfuscationResult) {
    try {
        let code = obfuscationResult.getObfuscatedCode();
        const map = obfuscationResult.getSourceMap();
        if (obfuscationOptions.sourceMap && map) {
            const mapName = path.basename(targetPath) + '.map';
            if (!/sourceMappingURL=/.test(code)) {
                code += "\n//# sourceMappingURL=" + mapName + "\n";
            }
            fs.writeFileSync(targetPath, code);
            fs.writeFileSync(targetPath + '.map', map);
        } else {
            fs.writeFileSync(targetPath, code);
        }
    } catch (e) {
        // 回退仅写代码
        try { fs.writeFileSync(targetPath, obfuscationResult.getObfuscatedCode()); } catch {}
    }
}

// 合成带 inputFileName / sourceMapFileName 的混淆配置
function obfuscicationOptionsWithInput(relativeFilePath) {
    return {
        ...obfuscationOptions,
        inputFileName: relativeFilePath,
        sourceMapFileName: path.basename(relativeFilePath) + '.map',
    };
}

// 复制并混淆JS文件
function processJavaScriptFile(relativeFilePath) {
    const sourcePath = path.join(srcDir, relativeFilePath);
    const targetPath = path.join(distDir, relativeFilePath);
    
    if (!fs.existsSync(sourcePath)) {
        console.log(`⚠️  文件不存在: ${relativeFilePath}`);
        return;
    }
    
    // 确保目标目录存在
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    
    try {
        const sourceCode = fs.readFileSync(sourcePath, 'utf8');
        
        // 先用UglifyJS压缩，再用obfuscator混淆
        const minified = UglifyJS.minify(sourceCode, {
            compress: {
                dead_code: true,
                drop_console: false, // 保留console
                drop_debugger: true,
                keep_fargs: false,
                unused: true
            },
            mangle: {
                reserved: ['chrome', 'browser', 'window', 'document', 'DeepLearn']
            }
        });
        
        if (minified.error) {
            console.log(`⚠️  压缩失败 ${relativeFilePath}:`, minified.error);
            const obfuscated = JavaScriptObfuscator.obfuscate(sourceCode, obfuscicationOptionsWithInput(relativeFilePath));
            writeObfuscatedWithMap(targetPath, obfuscated);
        } else {
            const obfuscated = JavaScriptObfuscator.obfuscate(minified.code, obfuscicationOptionsWithInput(relativeFilePath));
            writeObfuscatedWithMap(targetPath, obfuscated);
        }
        
        console.log(`✅ 已处理: ${relativeFilePath}`);
    } catch (error) {
        console.log(`❌ 处理失败 ${relativeFilePath}:`, error.message);
        // 出错时直接复制原文件
        fs.copyFileSync(sourcePath, targetPath);
    }
}

// 复制非JS文件
function copyFile(relativeFilePath) {
    const sourcePath = path.join(srcDir, relativeFilePath);
    const targetPath = path.join(distDir, relativeFilePath);
    
    if (!fs.existsSync(sourcePath)) {
        console.log(`⚠️  文件不存在: ${relativeFilePath}`);
        return;
    }
    
    // 确保目标目录存在
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`📋 已复制: ${relativeFilePath}`);
}

// 先打包 background.js
buildBackgroundScript();

// 处理其他 JavaScript 文件
console.log('\\n🔧 处理其他 JavaScript 文件...');
jsFiles.forEach(processJavaScriptFile);

// 复制其他必要文件
console.log('\\n📂 复制其他文件...');
const otherFiles = [
    'manifest.json',
    'popup.html',
    'options/options.html',
    'icon16.png',
    'icon48.png',
    'icon128.png',
    // 禁用态图标（可替换为真正的灰度版本）
    'icon16_disabled.png',
    'icon48_disabled.png',
    'icon128_disabled.png'
];

// 使用 esbuild 打包 background.js（MV3 service worker 需 ESM）
function buildBackgroundScript() {
    const outFile = path.join(distDir, 'background.js');
    console.log('\n🚧 esbuild 打包 background.js ...');
    try {
        esbuild.buildSync({
            entryPoints: [path.join(srcDir, 'background.js')],
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
        // 失败时，退化为直接复制原文件（警告：无打包依赖将无法工作）
        const sourcePath = path.join(srcDir, 'background.js');
        const targetPath = outFile;
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
    }
}

otherFiles.forEach(copyFile);

console.log('\\n🎉 构建完成！混淆版本已生成到 dist/ 目录');
console.log('📊 构建统计:');

// 统计文件大小
let totalOriginalSize = 0;
let totalObfuscatedSize = 0;

jsFiles.forEach(file => {
    const originalPath = path.join(srcDir, file);
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

console.log(`\\n📈 总体: ${totalOriginalSize} → ${totalObfuscatedSize} bytes (${((totalObfuscatedSize / totalOriginalSize) * 100).toFixed(1)}%)`);

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log('[深学助手打包] 开始创建分发包...');

// 确保dist目录存在
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    console.error('❌ dist目录不存在！请先运行 npm run build');
    process.exit(1);
}

// 创建release目录
const releaseDir = path.join(__dirname, 'release');
if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
}

// 读取版本信息
const manifestPath = path.join(distDir, 'manifest.json');
let version = '1.0.0';
try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    version = manifest.version;
} catch (error) {
    console.warn('⚠️  无法读取版本号，使用默认版本 1.0.0');
}

// 生成时间戳
const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
const zipFileName = `deeplearn-assistant-v${version}-${timestamp}.zip`;
const zipFilePath = path.join(releaseDir, zipFileName);

// 创建ZIP文件
const output = fs.createWriteStream(zipFilePath);
const archive = archiver('zip', {
    zlib: { level: 9 } // 最高压缩级别
});

// 处理错误
output.on('close', function () {
    const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log('\\n🎉 打包完成！');
    console.log(`📦 文件名: ${zipFileName}`);
    console.log(`📊 文件大小: ${sizeInMB} MB (${archive.pointer()} bytes)`);
    console.log(`📁 保存路径: ${zipFilePath}`);
    console.log('\\n✅ 可以将此ZIP文件分发给其他用户');
    console.log('📘 安装说明:');
    console.log('   1. 解压ZIP文件到任意目录');
    console.log('   2. 打开Chrome浏览器，访问 chrome://extensions/');
    console.log('   3. 开启"开发者模式"');
    console.log('   4. 点击"加载已解压的扩展程序"，选择解压后的文件夹');
});

archive.on('warning', function (err) {
    if (err.code === 'ENOENT') {
        console.warn('⚠️  警告:', err.message);
    } else {
        throw err;
    }
});

archive.on('error', function (err) {
    console.error('❌ 打包失败:', err);
    throw err;
});

// 连接输出流和archiver
archive.pipe(output);

// 添加整个dist目录到ZIP
console.log('📂 添加文件到ZIP包...');
archive.directory(distDir, false);

// 生成README文件
const readmeContent = `# 深学助手 v${version}

## 安装方法

1. 将这个文件夹复制到您的电脑任意位置
2. 打开Chrome浏览器
3. 在地址栏输入：chrome://extensions/
4. 打开右上角的"开发者模式"开关
5. 点击"加载已解压的扩展程序"按钮
6. 选择这个文件夹
7. 安装完成！

## 支持的网站

- www.0755tt.com (0755TT学习平台)
- www.smartedu.cn (国家智慧教育平台)
- basic.smartedu.cn
- smartedu.gdtextbook.com
- teacher.ykt.eduyun.cn

## 使用方法

1. 访问支持的学习网站
2. 扩展会自动识别页面并开始工作
3. 可以点击浏览器工具栏中的扩展图标查看状态
4. 在扩展选项页面中可以进行详细配置

## 注意事项

- 请确保网络连接正常
- 首次使用时可能需要等待页面完全加载
- 如遇问题请检查浏览器控制台是否有错误信息

## 版本信息

版本：${version}
构建时间：${new Date().toLocaleString('zh-CN')}

---
深学助手 - 让学习更轻松
`;

// 临时创建README文件
const tempReadmePath = path.join(distDir, 'README.txt');
fs.writeFileSync(tempReadmePath, readmeContent);

// 完成打包
archive.finalize().then(() => {
    // 清理临时文件
    try {
        fs.unlinkSync(tempReadmePath);
    } catch (e) {
        // 忽略删除失败
    }
    
    // 创建Edge浏览器专用的解压版本
    console.log('\n🔄 正在创建Edge浏览器专用版本...');
    createEdgeVersion();
});

// 创建Edge浏览器版本（解压的文件夹形式）
function createEdgeVersion() {
    const edgeDir = path.join(releaseDir, `deeplearn-assistant-v${version}-${timestamp}-edge`);
    
    try {
        // 复制整个dist目录到edge版本
        copyDirectory(distDir, edgeDir);
        
        // 创建Edge专用的安装说明
        const edgeReadmeContent = `# 深学助手 v${version} - Edge浏览器版本

## Edge浏览器安装方法

1. 打开Microsoft Edge浏览器
2. 在地址栏输入：edge://extensions/
3. 打开右上角的"开发人员模式"开关
4. 点击"加载解压缩的扩展"按钮
5. 选择这个文件夹（deeplearn-assistant-v${version}-${timestamp}-edge）
6. 安装完成！

## 支持的网站

- www.0755tt.com (0755TT学习平台)
- www.smartedu.cn (国家智慧教育平台)
- basic.smartedu.cn
- smartedu.gdtextbook.com
- teacher.ykt.eduyun.cn

## Chrome浏览器用户

如果您使用的是Chrome浏览器，请解压 deeplearn-assistant-v${version}-${timestamp}.zip 文件后安装。

## 注意事项

⚠️ 请不要删除或移动这个文件夹，否则扩展将停止工作
⚠️ 如需卸载，请先在浏览器扩展页面移除，然后再删除文件夹

## 版本信息

版本：${version}
构建时间：${new Date().toLocaleString('zh-CN')}
适用浏览器：Microsoft Edge

---
深学助手 - 让学习更轻松
`;
        
        fs.writeFileSync(path.join(edgeDir, 'README.txt'), edgeReadmeContent);
        
        console.log(`✅ Edge版本创建完成！`);
        console.log(`📁 Edge版本路径: ${edgeDir}`);
        console.log(`\n📘 Edge安装说明:`);
        console.log(`   1. 打开Edge浏览器，访问 edge://extensions/`);
        console.log(`   2. 开启"开发人员模式"`);
        console.log(`   3. 点击"加载解压缩的扩展"`);
        console.log(`   4. 选择文件夹: ${path.basename(edgeDir)}`);
        
    } catch (error) {
        console.error('❌ 创建Edge版本失败:', error);
    }
}

// 递归复制目录
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    
    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        
        const stat = fs.statSync(srcPath);
        
        if (stat.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
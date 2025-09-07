const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log('[深学助手打包] 开始创建分发包...');

// 以仓库根为基准
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('❌ dist目录不存在！请先运行 npm run build');
  process.exit(1);
}

// 创建release目录
const releaseDir = path.join(rootDir, 'release');
if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });

// 读取版本信息
const manifestPath = path.join(distDir, 'manifest.json');
let version = '1.0.0';
try {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const clean = raw.replace(/^\uFEFF/, '');
  const manifest = JSON.parse(clean);
  if (manifest && typeof manifest.version === 'string') version = manifest.version;
} catch (error) {
  console.warn('⚠️  无法读取版本号，使用默认版本 1.0.0');
}

// 生成时间戳
const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
const zipFileName = `deeplearn-assistant-v${version}-${timestamp}.zip`;
const zipFilePath = path.join(releaseDir, zipFileName);

// 创建ZIP文件
const output = fs.createWriteStream(zipFilePath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function () {
  const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log('\n🎉 打包完成!');
  console.log(`📦 文件名: ${zipFileName}`);
  console.log(`📊 文件大小: ${sizeInMB} MB (${archive.pointer()} bytes)`);
  console.log(`📁 保存路径: ${zipFilePath}`);
  console.log('\n✅ 可以将此ZIP文件分发给其他用户');
  console.log('📘 安装说明:');
  console.log('   1. 解压ZIP文件到任意目录');
  console.log('   2. 打开Chrome浏览器，访问 chrome://extensions/');
  console.log('   3. 开启"开发者模式"');
  console.log('   4. 点击"加载已解压的扩展程序"，选择解压后的文件夹');
});

archive.on('warning', function (err) {
  if (err.code === 'ENOENT') console.warn('⚠️  警告:', err.message);
  else throw err;
});

archive.on('error', function (err) {
  console.error('❌ 打包失败:', err);
  throw err;
});

archive.pipe(output);

console.log('📂 添加文件到ZIP包...');
archive.glob('**/*', { cwd: distDir, ignore: ['**/*.map'] });

// 生成README文件
const readmeContent = `# 深学助手 v${version}\n\n## 安装方法\n\n1. 将这个文件夹复制到您的电脑任意位置\n2. 打开Chrome浏览器\n3. 在地址栏输入：chrome://extensions/\n4. 打开右上角的"开发者模式"开关\n5. 点击"加载已解压的扩展程序"按钮\n6. 选择这个文件夹\n7. 安装完成\n\n## 支持的网站\n\n- www.0755tt.com (0755TT学习平台)\n- www.smartedu.cn (国家智慧教育平台)\n- basic.smartedu.cn\n- smartedu.gdtextbook.com\n- teacher.ykt.eduyun.cn\n\n## 使用方法\n\n1. 访问支持的学习网站\n2. 扩展会自动识别页面并开始工作\n3. 可以点击浏览器工具栏中的扩展图标查看状态\n4. 在扩展选项页面中可以进行详细配置\n\n## 注意事项\n\n- 请确保网络连接正常\n- 首次使用时可能需要等待页面完全加载\n- 如遇问题请检查浏览器控制台是否有错误信息\n\n## 版本信息\n\n版本：${version}\n构建时间：${new Date().toLocaleString('zh-CN')}\n\n---\n深学助手 - 让学习更轻松\n`;
const tempReadmePath = path.join(distDir, 'README.txt');
fs.writeFileSync(tempReadmePath, readmeContent);

archive.finalize().then(() => {
  try { fs.unlinkSync(tempReadmePath); } catch {}
});


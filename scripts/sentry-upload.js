const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(msg, ...args) { console.log(`[sentry-upload] ${msg}`, ...args); }
function warn(msg, ...args) { console.warn(`[sentry-upload] ${msg}`, ...args); }
function err(msg, ...args) { console.error(`[sentry-upload] ${msg}`, ...args); }

try {
  const distDir = path.join(__dirname, '..', 'dist');
  const manifestPath = path.join(distDir, 'manifest.json');

  // 检查构建输出
  if (!fs.existsSync(distDir) || !fs.existsSync(manifestPath)) {
    warn('dist 或 manifest.json 不存在，跳过 sourcemaps 上传');
    process.exit(0);
  }

  // 检查是否有.map文件
  const mapFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.map'));
  if (mapFiles.length === 0) {
    warn('dist 目录中没有找到 .map 文件，跳过 sourcemaps 上传');
    process.exit(0);
  }

  log(`发现 ${mapFiles.length} 个 source map 文件:`, mapFiles.join(', '));

  const { version } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const release = `deeplearn-assistant@${version}`;

  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  const token = process.env.SENTRY_AUTH_TOKEN;
  const extId = process.env.EXTENSION_ID; // Chrome 扩展ID

  if (!org || !project || !token) {
    warn('缺少必要的 Sentry 环境变量 (SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN)，跳过上传。');
    warn('请在 GitHub Secrets 中配置这些变量以启用 source maps 上传。');
    process.exit(0);
  }

  // 确定URL前缀
  const urlPrefix = extId ? `chrome-extension://${extId}/` : '~/';
  log(`开始上传 sourcemaps:`);
  log(`  - Release: ${release}`);
  log(`  - URL Prefix: ${urlPrefix}`);
  log(`  - Organization: ${org}`);
  log(`  - Project: ${project}`);

  const SENTRY_CMD = (cmd, description) => {
    log(`执行: ${description}`);
    try {
      execSync(cmd, { stdio: 'inherit', env: process.env });
      log(`✅ ${description} 完成`);
    } catch (error) {
      err(`❌ ${description} 失败:`, error.message);
      throw error;
    }
  };

  // 检查Sentry CLI是否可用
  try {
    execSync('npx sentry-cli --version', { stdio: 'pipe' });
  } catch (error) {
    err('Sentry CLI 不可用，请确保已安装 @sentry/cli');
    throw error;
  }

  // 创建或复用 release
  SENTRY_CMD(
    `npx sentry-cli releases new -p ${project} ${release}`,
    `创建 release ${release}`
  );

  // 上传 sourcemaps
  SENTRY_CMD(
    `npx sentry-cli releases files ${release} upload-sourcemaps dist --url-prefix ${urlPrefix} --validate --rewrite --strip-prefix dist`,
    '上传 source maps'
  );

  // 设置 release 提交信息
  try {
    const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    SENTRY_CMD(
      `npx sentry-cli releases set-commits ${release} --commit "${commitSha}"`,
      '设置 commit 信息'
    );
  } catch (error) {
    warn('无法获取 Git commit 信息，跳过 commit 关联');
  }

  // finalize release
  SENTRY_CMD(
    `npx sentry-cli releases finalize ${release}`,
    `完成 release ${release}`
  );

  log('🎉 sourcemaps 上传完成！');
  log(`可以在 Sentry 控制台查看: https://sentry.io/${org}/${project}/releases/${release}/`);

} catch (error) {
  err('sourcemaps 上传失败：', error?.message || error);

  // 在CI环境中，sourcemap上传失败不应该阻断发布流程
  if (process.env.CI) {
    warn('在 CI 环境中忽略 sourcemap 上传失败，继续发布流程');
    process.exit(0);
  } else {
    process.exit(1);
  }
}


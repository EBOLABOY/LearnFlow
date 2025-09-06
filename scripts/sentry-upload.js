const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(msg, ...args) { console.log(`[sentry-upload] ${msg}`, ...args); }
function warn(msg, ...args) { console.warn(`[sentry-upload] ${msg}`, ...args); }
function err(msg, ...args) { console.error(`[sentry-upload] ${msg}`, ...args); }

try {
  const distDir = path.join(__dirname, '..', 'dist');
  const manifestPath = path.join(distDir, 'manifest.json');
  if (!fs.existsSync(distDir) || !fs.existsSync(manifestPath)) {
    warn('dist 或 manifest.json 不存在，跳过 sourcemaps 上传');
    process.exit(0);
  }

  const { version } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const release = `deeplearn-assistant@${version}`;

  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  const token = process.env.SENTRY_AUTH_TOKEN;
  const extId = process.env.EXTENSION_ID; // 可选：Chrome 扩展ID

  if (!org || !project || !token) {
    warn('缺少 SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN 环境变量，跳过上传。');
    process.exit(0);
  }

  const urlPrefix = extId ? `chrome-extension://${extId}/` : '~/';
  log(`开始上传 sourcemaps: release=${release}, urlPrefix=${urlPrefix}`);

  const SENTRY_CMD = (cmd) => execSync(cmd, { stdio: 'inherit', env: process.env });

  // 创建或复用 release
  SENTRY_CMD(`npx sentry-cli releases new -p ${project} ${release}`);
  // 上传 dist 下所有 js 与 map（去掉 dist 前缀，并重写路径）
  SENTRY_CMD(`npx sentry-cli releases files ${release} upload-sourcemaps dist --url-prefix ${urlPrefix} --validate --rewrite --strip-prefix dist`);
  // finalize release
  SENTRY_CMD(`npx sentry-cli releases finalize ${release}`);

  log('sourcemaps 上传完成');
} catch (e) {
  err('sourcemaps 上传失败：', e && e.message ? e.message : e);
  // 非致命错误，不阻断流程
  process.exit(0);
}


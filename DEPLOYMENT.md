# 深学助手认证系统部署指南

## 🚀 快速部署指南

### 第一步：数据库准备

1. **访问 SQLPub**: 
   ```
   网址: https://sqlpub.com
   注册账号并创建MySQL数据库实例
   ```

2. **获取数据库连接信息**:
   ```
   主机: mysql2.sqlpub.com
   端口: 3307  
   用户名: [您的用户名]
   密码: [您的密码]
   数据库: learnflow (或您创建的数据库名)
   ```

3. **初始化数据库**:
   ```bash
   # 使用您喜欢的MySQL客户端连接数据库
   # 执行 database/init.sql 文件中的SQL语句
   ```

### 第二步：Vercel部署

1. **准备Vercel项目**:
   ```bash
   # 安装Vercel CLI
   npm install -g vercel
   
   # 登录Vercel账号
   vercel login
   ```

2. **项目部署**:
   ```bash
   # 在项目根目录执行
   vercel
   
   # 首次部署会提示创建新项目，按提示操作
   # 项目设置选择: Other
   # 构建命令: 留空
   # 输出目录: 留空
   ```

3. **配置环境变量**:
   ```bash
   # 在Vercel Dashboard中进入您的项目
   # 点击 Settings -> Environment Variables
   # 添加以下环境变量：
   ```

   | 变量名 | 值示例 | 说明 |
   |--------|--------|------|
   | `DB_HOST` | `mysql2.sqlpub.com` | 数据库主机地址 |
   | `DB_PORT` | `3307` | 数据库端口 |
   | `DB_USER` | `your_username` | 数据库用户名 |
   | `DB_PASSWORD` | `your_password` | 数据库密码 |
   | `DB_DATABASE` | `learnflow` | 数据库名称 |
   | `JWT_SECRET` | `your_32_char_secret_key_here` | JWT密钥(32位+) |
   | `INVITE_CODE` | `your_invite_code` | 注册邀请码 |

4. **重新部署**:
   ```bash
   # 配置环境变量后重新部署
   vercel --prod
   ```

### 第三步：更新前端配置

1. **获取Vercel URL**:
   ```
   部署成功后，Vercel会提供类似如下的URL：
   https://your-project-name.vercel.app
   ```

2. **更新API配置**:
   ```javascript
   // 在以下文件中更新API_BASE_URL：
   // extension/popup.js (第3行)
   // content/loader.js (第4行)
   
   const API_BASE_URL = 'https://your-actual-vercel-url.vercel.app/api';
   ```

3. **重新构建扩展**:
   ```bash
   npm run build
   ```

### 第四步：测试认证系统

1. **测试API端点**:
   ```bash
   # 测试注册接口
   curl -X POST https://your-vercel-url.vercel.app/api/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"123456","inviteCode":"your_invite_code"}'
   
   # 测试登录接口
   curl -X POST https://your-vercel-url.vercel.app/api/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"123456"}'
   ```

2. **扩展测试**:
   ```
   1. 在Chrome中加载构建后的扩展 (dist目录)
   2. 点击扩展图标打开弹窗
   3. 尝试注册新用户
   4. 使用注册的账号登录
   5. 验证在支持的学习平台上功能是否正常
   ```

## 🔧 故障排除

### 常见错误及解决方案

1. **数据库连接失败**:
   ```
   错误: connect ECONNREFUSED
   解决: 检查DB_HOST、DB_PORT、DB_USER、DB_PASSWORD是否正确
   ```

2. **JWT Token错误**:
   ```
   错误: JsonWebTokenError
   解决: 确保JWT_SECRET环境变量已设置且长度足够(建议32位+)
   ```

3. **CORS错误**:
   ```
   错误: Access-Control-Allow-Origin
   解决: API已配置允许所有源，检查请求URL是否正确
   ```

4. **邀请码错误**:
   ```
   错误: 邀请码无效
   解决: 确保INVITE_CODE环境变量与注册时使用的邀请码一致
   ```

### 调试技巧

1. **查看Vercel日志**:
   ```bash
   vercel logs https://your-vercel-url.vercel.app
   ```

2. **Chrome扩展调试**:
   ```
   1. 右键扩展图标 -> 检查弹出内容窗口
   2. F12开发者工具 -> Network标签查看API请求
   3. Chrome扩展管理页面 -> 详细信息 -> 检查视图
   ```

## 📊 生产环境优化建议

1. **安全性增强**:
   ```javascript
   // 建议在生产环境中限制CORS源
   res.setHeader('Access-Control-Allow-Origin', 'chrome-extension://your-extension-id');
   
   // 使用更强的JWT密钥
   JWT_SECRET: 64位随机字符串
   
   // 定期更换邀请码
   INVITE_CODE: 定期更新复杂密码
   ```

2. **监控和日志**:
   ```javascript
   // 集成Sentry或其他监控服务
   // 已在前端集成Sentry错误监控
   ```

3. **性能优化**:
   ```javascript
   // 数据库连接池优化
   // API响应缓存
   // Token有效期管理
   ```

## 🎯 部署检查清单

- [ ] SQLPub数据库已创建并初始化
- [ ] Vercel项目已部署成功
- [ ] 环境变量已正确配置
- [ ] 前端API_BASE_URL已更新
- [ ] Chrome扩展已重新构建
- [ ] 注册功能测试通过
- [ ] 登录功能测试通过
- [ ] Token验证功能正常
- [ ] 学习平台自动化功能需要登录才能使用

## 📞 支持联系

如遇到部署问题，请检查：
1. Vercel部署日志
2. Chrome扩展控制台错误信息
3. 网络请求响应状态码
4. 数据库连接状态

完成以上步骤后，您的深学助手认证系统就部署完成了！🎉
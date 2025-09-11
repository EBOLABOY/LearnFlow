# 深学助手管理系统部署指南 v2.0

## 🎯 系统概述

深学助手v2.0是一个完整的企业级多应用系统，包含：
- 🌐 **扩展API服务**: 为浏览器扩展提供认证和数据API
- 🎛️ **管理后台**: Next.js构建的现代化管理界面  
- 🗄️ **数据库系统**: MySQL数据库支持角色管理和动态邀请码

## 📋 部署架构

```
┌─────────────────────────────────────────────────────┐
│                   Vercel 生态系统                    │
├─────────────────────┬───────────────────────────────┤
│  管理后台项目        │      主API项目                │
│  admin-panel/       │      api/*, extension/       │
│  独立部署           │      原有项目根目录            │
└─────────────────────┴───────────────────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │  MySQL 数据库        │
              │  SQLPub托管         │
              └─────────────────────┘
```

## 🚀 部署步骤

### 第一步：数据库初始化

1. **执行数据库升级脚本**
   ```bash
   # 连接到MySQL数据库
   mysql -h mysql2.sqlpub.com -P 3307 -u learnflow -p learnflow
   
   # 执行升级脚本（包含新的表结构）
   source database/init.sql
   ```

2. **验证数据库结构**
   ```sql
   -- 检查新表是否创建成功
   SHOW TABLES;
   DESCRIBE users;          -- 现在包含role字段
   DESCRIBE invitation_codes;  -- 新的动态邀请码表
   DESCRIBE admin_logs;     -- 管理员操作日志表
   
   -- 检查默认管理员账户
   SELECT * FROM users WHERE role = 'admin';
   ```

### 第二步：部署主API项目（现有项目升级）

1. **项目配置**
   - 项目根目录：包含 `api/`, `extension/`, `src/` 等
   - 这是原有的扩展API服务，现已升级支持：
     - 角色管理系统
     - 动态邀请码
     - 管理员专属API (`/api/admin/*`)

2. **环境变量配置**
   在Vercel项目设置中配置（⚠️ 必须配置所有变量，无默认值）：
   ```
   # 安全认证（必须配置）
   JWT_SECRET=your-secure-jwt-secret-key-minimum-32-characters-required
   
   # 数据库连接（必须配置所有项）
   DB_HOST=mysql2.sqlpub.com
   DB_PORT=3307
   DB_USER=learnflow
   DB_PASSWORD=lrz96V6nE48YkzDB
   DB_DATABASE=learnflow
   
   # 环境配置
   NODE_ENV=production
   
   # CORS配置（生产环境必须限制具体域名）
   CORS_ORIGIN=https://your-admin-panel.vercel.app
   ```
   
   ⚠️ **重要安全提醒**：
   - JWT_SECRET必须为32位以上的强随机字符串
   - 所有环境变量都是必需的，应用启动时会验证
   - 生产环境不提供任何默认值以确保安全性

3. **部署命令**
   ```bash
   # 在项目根目录
   vercel --prod
   ```

4. **部署后验证**
   ```bash
   # 测试原有扩展API
   curl https://your-api-domain.vercel.app/api/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"123456","inviteCode":"WELCOME2024"}'
   
   # 测试新的管理员API（需要认证token）
   curl https://your-api-domain.vercel.app/api/admin/stats \
     -H "Authorization: Bearer your-jwt-token"
   ```

### 第三步：部署管理后台项目（全新独立项目）

1. **创建新的Vercel项目**
   ```bash
   cd admin-panel
   
   # 初始化独立的Vercel项目
   vercel
   
   # 选择创建新项目
   # 项目名称: deeplearn-admin 或类似名称
   # 框架: Next.js
   ```

2. **环境变量配置**
   ```
   # API连接配置
   NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.vercel.app/api
   
   # 环境标识
   NODE_ENV=production
   ```

3. **管理后台特有配置**
   ```bash
   # 确保以下文件配置正确
   admin-panel/next.config.js     # Next.js配置
   admin-panel/package.json       # 依赖管理
   admin-panel/tailwind.config.js # UI样式配置
   ```

4. **部署命令**
   ```bash
   cd admin-panel
   vercel --prod
   ```

### 第四步：安全配置和初始化

1. **更新CORS设置**
   在主API项目环境变量中：
   ```
   CORS_ORIGIN=https://your-admin-panel-domain.vercel.app
   ```

2. **修改默认管理员密码**
   ```sql
   -- 登录数据库，生成新密码的bcrypt哈希
   -- 使用在线bcrypt工具或Node.js生成
   UPDATE users 
   SET password_hash = '$2a$12$your-new-secure-bcrypt-hash' 
   WHERE email = 'admin@learnflow.app';
   ```

3. **生成安全的JWT密钥**
   ```bash
   # 生成32位以上随机字符串
   openssl rand -base64 32
   
   # 或使用Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

## ✅ 验证部署

### 功能测试清单

#### API服务测试
- [ ] **用户认证功能**
  ```bash
  # 测试注册（使用动态邀请码）
  curl -X POST https://api-domain.vercel.app/api/register \
    -H "Content-Type: application/json" \
    -d '{"email":"user@test.com","password":"123456","inviteCode":"WELCOME2024"}'
  
  # 测试登录
  curl -X POST https://api-domain.vercel.app/api/login \
    -H "Content-Type: application/json" \
    -d '{"email":"user@test.com","password":"123456"}'
  ```

- [ ] **管理员API功能**
  ```bash
  # 管理员登录
  curl -X POST https://api-domain.vercel.app/api/admin/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@learnflow.app","password":"your-admin-password"}'
  ```

#### 管理后台测试
- [ ] **访问管理后台**
  ```
  1. 打开 https://admin-domain.vercel.app
  2. 自动重定向到 /admin/login
  3. 使用管理员账户登录
  4. 成功进入仪表板
  ```

- [ ] **核心功能验证**
  - [ ] 仪表板数据正确显示
  - [ ] 用户管理页面可以查看/编辑用户
  - [ ] 邀请码管理可以创建/撤销邀请码
  - [ ] 操作日志正确记录

#### 集成测试
- [ ] **端到端流程**
  1. 管理后台创建邀请码
  2. 浏览器扩展使用邀请码注册
  3. 新用户成功登录扩展
  4. 管理后台可以看到新用户和使用记录

### 性能监控

1. **Vercel仪表板监控**
   ```
   - 函数执行时间
   - 内存使用情况
   - 请求成功率
   - 错误日志
   ```

2. **数据库监控**
   ```sql
   -- 检查系统统计
   SELECT 
     (SELECT COUNT(*) FROM users) as total_users,
     (SELECT COUNT(*) FROM users WHERE role = 'admin') as admin_count,
     (SELECT COUNT(*) FROM invitation_codes WHERE used_by IS NULL) as active_codes;
   
   -- 检查最近活动
   SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 10;
   ```

## 🔧 故障排除

### 常见问题解决

1. **管理后台无法连接API**
   ```javascript
   // 检查配置
   console.log(process.env.NEXT_PUBLIC_API_BASE_URL);
   
   // 在浏览器Network面板检查：
   // - 请求URL是否正确
   // - CORS错误
   // - 响应状态码
   ```

2. **数据库连接失败**
   ```bash
   # 验证环境变量
   vercel env ls
   
   # 测试数据库连接
   mysql -h mysql2.sqlpub.com -P 3307 -u learnflow -p
   ```

3. **JWT认证问题**
   ```javascript
   // 确保前后端JWT_SECRET一致
   // 检查token格式和过期时间
   // 验证Authorization header格式
   ```

### 日志查看方法

1. **Vercel函数日志**
   ```bash
   # 实时查看日志
   vercel logs --follow
   
   # 查看特定函数日志
   vercel logs --function=api/admin/login
   ```

2. **浏览器调试**
   ```javascript
   // 在管理后台控制台启用调试
   localStorage.setItem('debug', 'true');
   
   // 查看API调用详情
   // Network面板 -> XHR/Fetch
   ```

## 🔒 安全最佳实践

### 生产环境安全配置

1. **环境变量安全**
   ```bash
   # 必须更改的配置
   JWT_SECRET=超过32位的强随机字符串
   
   # 限制CORS源
   CORS_ORIGIN=https://specific-admin-domain.vercel.app
   
   # 定期轮换密钥
   # 建议每季度更换JWT_SECRET
   ```

2. **数据库安全**
   ```sql
   -- 定期备份重要数据
   mysqldump -h mysql2.sqlpub.com -P 3307 -u learnflow -p learnflow > backup.sql
   
   -- 监控异常登录
   SELECT * FROM admin_logs WHERE action = 'login_failed' AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY);
   ```

3. **访问控制**
   ```
   - 管理后台仅允许特定IP访问（如需要）
   - 实施强密码策略
   - 启用双因素认证（未来扩展）
   ```

## 📈 维护和扩展

### 定期维护任务

1. **数据清理**
   ```sql
   -- 清理过期邀请码（可选）
   DELETE FROM invitation_codes 
   WHERE used_by IS NULL AND expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
   
   -- 清理旧的会话记录
   DELETE FROM user_sessions 
   WHERE expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
   ```

2. **性能优化**
   ```sql
   -- 添加数据库索引（如果查询慢）
   CREATE INDEX idx_users_email_role ON users(email, role);
   CREATE INDEX idx_invitations_status ON invitation_codes(used_by, expires_at);
   ```

### 功能扩展示例

1. **添加新的管理功能**
   ```
   api/admin/
   ├── new-feature.js    # 新API端点
   ├── middleware.js     # 复用认证中间件
   
   admin-panel/pages/admin/
   ├── new-feature.js    # 新管理页面
   ```

2. **集成第三方服务**
   ```javascript
   // 邮件通知（未来扩展）
   // 短信验证（未来扩展）
   // 文件上传（未来扩展）
   ```

## 📞 技术支持

### 部署问题诊断

1. **部署失败排查**
   ```bash
   # 检查构建日志
   vercel logs --build
   
   # 检查环境变量
   vercel env ls
   
   # 重新部署
   vercel --prod --force
   ```

2. **运行时错误排查**
   ```javascript
   // API错误：查看Vercel函数日志
   // 前端错误：查看浏览器控制台
   // 数据库错误：检查连接和SQL语句
   ```

---

🎉 **部署完成后，您将拥有一个完整的企业级用户和邀请码管理系统！**

### 🔗 部署后的系统访问方式

- **管理后台**: `https://your-admin-domain.vercel.app`
- **API服务**: `https://your-api-domain.vercel.app/api`
- **默认管理员**: `admin@learnflow.app` (请立即修改密码)
- **初始邀请码**: `WELCOME2024` (30天有效期)
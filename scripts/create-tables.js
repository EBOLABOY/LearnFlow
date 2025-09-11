const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'mysql2.sqlpub.com',
  port: 3307,
  user: 'root1242772513',
  password: '8bsXjODkM2vKBH0P',
  database: 'learnflow',
  charset: 'utf8mb4',
  ssl: {
    rejectUnauthorized: false
  }
};

async function createMissingTables() {
  let connection;
  
  try {
    console.log('🔄 正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 创建user_sessions表
    console.log('📝 创建user_sessions表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`user_sessions\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`token_hash\` VARCHAR(64) NOT NULL COMMENT 'JWT token的哈希值',
        \`session_type\` ENUM('extension', 'admin') NOT NULL DEFAULT 'extension' COMMENT '会话类型：扩展API或管理后台',
        \`ip_address\` VARCHAR(45) COMMENT '登录IP地址',
        \`user_agent\` TEXT COMMENT '用户代理信息',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`expires_at\` TIMESTAMP NOT NULL,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_expires_at\` (\`expires_at\`),
        INDEX \`idx_session_type\` (\`session_type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会话表（支持多应用）'
    `);
    console.log('✅ user_sessions表创建成功');
    
    // 创建admin_logs表
    console.log('📝 创建admin_logs表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`admin_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`admin_id\` INT NOT NULL COMMENT '执行操作的管理员ID',
        \`action\` VARCHAR(50) NOT NULL COMMENT '操作类型',
        \`target_type\` ENUM('user', 'invitation_code', 'system') NOT NULL COMMENT '操作目标类型',
        \`target_id\` INT NULL COMMENT '操作目标ID',
        \`details\` JSON NULL COMMENT '操作详情（JSON格式）',
        \`ip_address\` VARCHAR(45) COMMENT '操作来源IP',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`admin_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT,
        INDEX \`idx_admin_id\` (\`admin_id\`),
        INDEX \`idx_action\` (\`action\`),
        INDEX \`idx_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员操作审计日志'
    `);
    console.log('✅ admin_logs表创建成功');
    
    // 插入默认管理员账户（如果不存在）
    console.log('👤 检查默认管理员账户...');
    const [existingAdmin] = await connection.execute(
      "SELECT COUNT(*) as count FROM users WHERE email = 'admin@learnflow.app'"
    );
    
    if (existingAdmin[0].count === 0) {
      console.log('📝 创建默认管理员账户...');
      await connection.execute(`
        INSERT INTO \`users\` (\`email\`, \`password_hash\`, \`role\`) VALUES 
        ('admin@learnflow.app', '$2a$12$v5OWVL5.KpLBpNJx2VwCSOWJZJhvAo.P2D3Dj7w/AKhYsN5Y9.F6.', 'admin')
      `);
      console.log('✅ 默认管理员账户创建成功 (email: admin@learnflow.app, password: admin123)');
    } else {
      console.log('ℹ️  默认管理员账户已存在');
    }
    
    // 创建初始邀请码
    console.log('🎫 检查初始邀请码...');
    const [existingCode] = await connection.execute(
      "SELECT COUNT(*) as count FROM invitation_codes WHERE code = 'WELCOME2024'"
    );
    
    if (existingCode[0].count === 0) {
      console.log('📝 创建初始邀请码...');
      await connection.execute(`
        INSERT INTO \`invitation_codes\` (\`code\`, \`created_by\`, \`expires_at\`) 
        SELECT 'WELCOME2024', u.id, DATE_ADD(NOW(), INTERVAL 30 DAY)
        FROM \`users\` u WHERE u.role = 'admin' LIMIT 1
      `);
      console.log('✅ 初始邀请码创建成功 (WELCOME2024)');
    } else {
      console.log('ℹ️  初始邀请码已存在');
    }
    
    // 验证所有表
    console.log('🔍 验证所有表结构...');
    const tables = ['users', 'invitation_codes', 'user_sessions', 'admin_logs'];
    
    for (const tableName of tables) {
      const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
      console.log(`✅ ${tableName}表 (${columns.length}个字段):`);
      columns.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type}`);
      });
      
      const [count] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
      console.log(`📊 ${tableName}表记录数: ${count[0].count}`);
      console.log('');
    }
    
    console.log('🎉 数据库架构完全就绪！');
    
  } catch (error) {
    console.error('❌ 创建表时出现错误:', error);
    console.error('错误详情:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔐 数据库连接已关闭');
    }
  }
}

// 执行创建
createMissingTables();
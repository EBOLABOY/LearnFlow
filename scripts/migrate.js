const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置（使用环境变量）
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  charset: 'utf8mb4',
  ssl: { rejectUnauthorized: false }
};

async function migrate() {
  let connection;

  try {
    console.log('🔄 正在连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 1. 备份现有数据
    console.log('📦 开始备份现有数据...');
    await backupData(connection);

    // 2. 检查现有表结构
    console.log('🔍 检查现有表结构...');
    await checkCurrentTables(connection);

    // 3. 执行迁移
    console.log('🚀 开始执行表结构迁移...');
    await executeMigration(connection);

    // 4. 验证迁移结果
    console.log('🔍 验证迁移结果...');
    await verifyMigration(connection);

    console.log('🎉 数据库迁移完成！');
  } catch (error) {
    console.error('❌ 迁移过程中出现错误', error);
    console.error('错误详情:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔐 数据库连接已关闭');
    }
  }
}

async function backupData(connection) {
  try {
    // 检查是否存在 users 表
    const [tables] = await connection.execute("SHOW TABLES LIKE 'users'");

    if (tables.length > 0) {
      console.log('📋 发现现有 users 表，正在备份...');
      const [users] = await connection.execute('SELECT * FROM users');

      // 将备份保存到文件
      const backupData = {
        timestamp: new Date().toISOString(),
        users
      };

      fs.writeFileSync(path.join(__dirname, '../backup_users.json'), JSON.stringify(backupData, null, 2));

      console.log(`✅ 已备份 ${users.length} 个用户记录`);
    } else {
      console.log('ℹ️  未发现现有 users 表，跳过备份');
    }

    // 检查 invitation_codes 表
    const [invTables] = await connection.execute("SHOW TABLES LIKE 'invitation_codes'");

    if (invTables.length > 0) {
      console.log('📋  发现现有 invitation_codes 表，正在备份...');
      const [codes] = await connection.execute('SELECT * FROM invitation_codes');

      const backupData = {
        timestamp: new Date().toISOString(),
        invitation_codes: codes
      };

      fs.writeFileSync(path.join(__dirname, '../backup_invitation_codes.json'), JSON.stringify(backupData, null, 2));

      console.log(`✅ 已备份 ${codes.length} 个邀请码记录`);
    }
  } catch (error) {
    console.warn('⚠️  备份过程中出现警告', error.message);
  }
}

async function checkCurrentTables(connection) {
  try {
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📊 当前数据库中的表:');
    tables.forEach((table) => {
      console.log(`   - ${Object.values(table)[0]}`);
    });

    // 检查 users 表结构
    try {
      const [userColumns] = await connection.execute('DESCRIBE users');
      console.log('📋 当前 users 表结构');
      userColumns.forEach((col) => {
        console.log(
          `   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? 'DEFAULT ' + col.Default : ''}`
        );
      });
    } catch (err) {
      console.log('ℹ️  users 表不存在');
    }
  } catch (error) {
    console.warn('⚠️  检查表结构时出现警告', error.message);
  }
}

async function executeMigration(connection) {
  // 读取迁移SQL文件
  const sqlPath = path.join(__dirname, '../database/init.sql');
  if (!fs.existsSync(sqlPath)) {
    throw new Error('找不到数据库初始化文件 ' + sqlPath);
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  // 分割SQL语句，过滤掉查询语句
  const statements = sqlContent
    .split(';')
    .map((stmt) => stmt.trim())
    .filter(
      (stmt) =>
        stmt.length > 0 &&
        !stmt.startsWith('--') &&
        !stmt.startsWith('/*') &&
        !stmt.toUpperCase().startsWith('DESCRIBE') &&
        !stmt.toUpperCase().startsWith('SELECT') &&
        !stmt.toUpperCase().startsWith('SHOW')
    );

  console.log(`📝 准备执行 ${statements.length} 个SQL语句`);

  // 逐个执行SQL语句
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    if (statement.toUpperCase().includes('DROP TABLE')) {
      console.log('⚠️  警告: 跳过 DROP TABLE 语句以保护数据');
      continue;
    }

    try {
      console.log(`⚙️  执行第 ${i + 1}/${statements.length} 个语句...`);
      console.log(`📝 SQL: ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
      await connection.execute(statement);
      console.log('✅ 语句执行成功');
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log(`ℹ️  表已存在，跳过创建: ${error.message}`);
      } else if (error.code === 'ER_DUP_ENTRY') {
        console.log(`ℹ️  记录已存在，跳过插入: ${error.message}`);
      } else {
        console.error('❌ 执行SQL语句失败:', statement.substring(0, 100) + '...');
        console.error('错误信息:', error.message);
        throw error;
      }
    }
  }
}

async function verifyMigration(connection) {
  console.log('🔍 验证表结构...');

  const tables = ['users', 'invitation_codes', 'user_sessions', 'admin_logs'];

  for (const tableName of tables) {
    try {
      const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
      console.log(`📋 ${tableName} 表结构`);
      columns.forEach((col) => {
        console.log(`   - ${col.Field}: ${col.Type}`);
      });

      // 检查数据量
      const [count] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
      console.log(`📊 ${tableName}表记录数: ${count[0].count}`);
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log(`⚠️  表 ${tableName} 不存在`);
      } else {
        console.error(`❌ 检查表 ${tableName} 时出错`, error.message);
      }
    }
  }

  console.log('✅ 迁移验证完成');
}

// 执行迁移
migrate();


const fs = require('fs');
const http = require('http');

// 读取 CSV
const csv = fs.readFileSync('./mx_sepomex_data.csv', 'utf8');
const lines = csv.split('\n').filter(line => line.trim() !== '');
const headers = lines[0].split(',');

// Admin 账号密码
const PB_URL = process.env.POCKETBASE_URL || 'http://172.17.0.1:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@super.com';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || 'admin@super.com';

async function importData() {
  console.log(`正在连接 PocketBase: ${PB_URL}`);
  
  // 1. 获取 Admin Token
  const authRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  
  if (!authRes.ok) {
    console.error('获取 Admin Token 失败', await authRes.text());
    return;
  }
  
  const authData = await authRes.json();
  const token = authData.token;
  
  console.log('✅ 认证成功！开始导入邮编数据...');
  console.log(`📌 共有 ${lines.length - 1} 条数据待导入`);
  
  let successCount = 0;
  let failCount = 0;

  // 2. 逐条插入数据 (考虑到限流，每批并发处理，但不要太多)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // 简单的解析 CSV（因为值被 " 包裹）
    const regex = /"([^"]*)"/g;
    const matches = [...line.matchAll(regex)].map(m => m[1]);
    
    if (matches.length < 4) continue;
    
    const cp = matches[0];
    const colonia = matches[1];
    const municipio = matches[2];
    const estado = matches[3];
    
    const body = { cp, colonia, municipio, estado };
    
    try {
      const res = await fetch(`${PB_URL}/api/collections/mx_sepomex/records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        successCount++;
      } else {
        failCount++;
        console.error(`❌ 插入失败 (${cp}): ${res.statusText}`);
      }
      
      // 每 100 条打印一次进度
      if (i % 100 === 0) {
        console.log(`进度: ${i} / ${lines.length - 1} (成功: ${successCount}, 失败: ${failCount})`);
      }
      
    } catch (err) {
      failCount++;
      console.error(`网络错误 (${cp}):`, err.message);
    }
    
    // 短暂休眠避免压垮 PocketBase
    await new Promise(r => setTimeout(r, 10));
  }
  
  console.log(`\n🎉 导入完成！总成功: ${successCount}, 总失败: ${failCount}`);
}

importData().catch(console.error);

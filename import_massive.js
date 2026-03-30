const fs = require('fs');
const readline = require('readline');

const PB_URL = process.env.POCKETBASE_URL || 'http://172.17.0.1:8090';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@super.com';
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || 'admin@super.com';

const PARALLEL_REQUESTS = 30; // 控制兵发量，太高可能导致VPS网络挂起

async function run() {
  console.log(`正在连接 PocketBase (${PB_URL})...`);
  
  // 1. 获取 Admin Token
  const authRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  
  if (!authRes.ok) {
    console.error('获取 Admin Token 失败!', await authRes.text());
    return;
  }
  
  const token = (await authRes.json()).token;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': token
  };

  // 2. 清空所有的旧数据
  console.log('🔄 开始从数据库「mx_sepomex」表清空所有旧数据...');
  while (true) {
    const res = await fetch(`${PB_URL}/api/collections/mx_sepomex/records?perPage=500&sort=-created`, { headers });
    if (!res.ok) {
      console.error('获取旧数据失败', await res.text());
      break;
    }
    
    const data = await res.json();
    if (!data.items || data.items.length === 0) break;
    
    console.log(`🧹 发现 ${data.items.length} 条老数据，正在批量删除...`);
    
    const deletePromises = data.items.map(o => 
      fetch(`${PB_URL}/api/collections/mx_sepomex/records/${o.id}`, { method: 'DELETE', headers })
    );
    await Promise.all(deletePromises);
  }
  console.log('✅ 数据库清理完毕! `mx_sepomex` 现在是一个空表。');

  // 3. 流式读取并插入新数据
  console.log(`📂 开始读取 15万+条 的 wp_sepomex.sql 数据文件...`);
  console.log(`(启用 UTF-8 保护机制，确保西班牙语重音符号 á, é, í, ó, ú, ñ 不乱码)`);
  
  // 检查文件是否存在
  if (!fs.existsSync('./wp_sepomex.sql')) {
    console.error("❌ 找不到文件 './wp_sepomex.sql'，请确保已经把它传到容器根目录！");
    return;
  }
  
  const fileStream = fs.createReadStream('./wp_sepomex.sql', { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let queue = [];
  let successCount = 0;
  let failCount = 0;
  let totalProcessed = 0;
  
  async function flushQueue(items) {
      if (items.length === 0) return;
      const promises = items.map(async (body) => {
         try {
           const r = await fetch(`${PB_URL}/api/collections/mx_sepomex/records`, {
             method: 'POST',
             headers,
             body: JSON.stringify(body)
           });
           if (r.ok) {
              successCount++;
           } else {
              failCount++; 
           }
         } catch(e) { 
            failCount++; 
         }
      });
      await Promise.all(promises);
  }

  for await (const line of rl) {
    // 解析类似: (1, '01000', 'San Ángel', 'Álvaro Obregón', 'Ciudad de México'),
    if (line.trim().startsWith('(')) {
       // 正则提取所有被单引号包裹的内容
       const matches = [...line.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]);
       
       if (matches.length >= 4) {
          const cp = matches[0];
          // 将 \ 转义符替换掉（如 \\' -> '）
          const colonia = matches[1].replace(/\\'/g, "'");
          const municipio = matches[2].replace(/\\'/g, "'"); // wp_sepomex 原始文件里叫 ciudad，在我们的 pb 表里叫 municipio
          const estado = matches[3].replace(/\\'/g, "'");
          
          queue.push({ cp, colonia, municipio, estado });
          totalProcessed++;
       }
       
       if (queue.length >= PARALLEL_REQUESTS) {
          await flushQueue(queue);
          queue = [];
          
          if (totalProcessed % 2000 === 0) {
             console.log(`🚀 正在疯狂插入... 已处理: ${totalProcessed} 条数据`);
          }
       }
    }
  }
  
  // 最后一波
  await flushQueue(queue);
  
  console.log(`\n🎉 wp_sepomex 15万+完整数据导入完成！`);
  console.log(`统计: 总计 ${totalProcessed} 条 -> 成功: ${successCount}, 失败: ${failCount}`);
}

run().catch(console.error);

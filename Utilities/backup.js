const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
// ====================== 配置区（你只改这里）======================
// 要备份的 文件 / 目录 列表
const backupList = [
  // 目录
  '../utilities',
  '../Cases',
  
  // 单个文件
  '../README.md',
  '../package.json',
  '../package-lock.json'
];
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const dateStr = `${year}${month}${day}`; // 格式：20251219

// ========== 2. 保存到 Windows AppData 目录 ==========
const appData = process.env.APPDATA; // 自动获取 Windows AppData 路径
const backupDir = path.join(appData, 'ClineBackup'); // 创建子文件夹
const outputZip = path.join(backupDir, `backup_parent_${dateStr}.zip`);

// 如果备份目录不存在，自动创建
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}



// 输出的 ZIP 文件名
//const outputZip = `backup_${dateStr}.zip`;
// =================================================================

// 开始打包
const zip = new AdmZip();

try {
  for (const item of backupList) {
    const fullPath = path.resolve(item);

    // 如果是目录 → 整个目录加入
    if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
      zip.addLocalFolder(fullPath, path.basename(fullPath));
    }
    // 如果是文件 → 单独加入
    else {
      zip.addLocalFile(fullPath);
    }
  }

  // 输出 ZIP
  zip.writeZip(outputZip);
  console.log('✅ 备份成功：', outputZip);

} catch (err) {
  console.error('❌ 备份失败：', err);
}
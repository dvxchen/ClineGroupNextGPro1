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
   '../main.js',
  '../README.md',
  '../package.json',
  '../package-lock.json'
];
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const dateStr = `${year}${month}${day}`; // format：20251219

// ========== 2. Save to Windows AppData  ==========
const appData = process.env.APPDATA; // Get Windows AppData
const backupDir = path.join(appData, 'ClineBackup'); // Create sub folder
const outputZip = path.join(backupDir, `backup_parent_${dateStr}.zip`);

//if not exist create one
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}



// start
const zip = new AdmZip();

try {
  for (const item of backupList) {
    const fullPath = path.resolve(item);

    // if is dir, add
    if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
      zip.addLocalFolder(fullPath, path.basename(fullPath));
    }
    // if is file add
    else {
      zip.addLocalFile(fullPath);
    }
  }

  // export
  zip.writeZip(outputZip);
  console.log('✅ Success：', outputZip);

} catch (err) {
  console.error('❌ Failed：', err);
}
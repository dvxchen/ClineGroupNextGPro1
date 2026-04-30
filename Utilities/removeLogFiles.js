const path = require('path');
const fs = require('fs').promises;
const fs2 = require('fs-extra'); // 你用的 fs-extra

(async () => {
    const casesRootPath = path.join(__dirname, '..', 'Cases');
    const casesSubFolders = await fs.readdir(casesRootPath);
    for (const caseFolder of casesSubFolders) {
        const caseFolderFullPath = path.join(casesRootPath, caseFolder);
        console.log(`Clean：${caseFolder}`);
        const a = path.join(caseFolderFullPath, 'log.json');
        await fs2.remove(a);
    }
    const projectRootPath = path.join(__dirname, '..');
    console.log(`Clean：${projectRootPath}`);
    const b = path.join(projectRootPath, 'log.json');
    await fs2.remove(b);
})(); 
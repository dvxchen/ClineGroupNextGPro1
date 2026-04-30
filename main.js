const { exec } = require('child_process');

const fs = require('fs').promises;
const path = require('path');

const fs0 = require('fs');
const fs1 = require('fs');
const fs2 = require('fs-extra');
const fs3 = require('fs');
const os = require('os');

const { spawn } = require('child_process');
const glob = require('glob'); // need install: npm install glob

//wait each js finish
function runFile(path) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [path], {
      stdio: 'inherit',
      //  shell: true
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`js ${path} run failed`));
    });
  });
}

let allLogs = [];
let caseName = [];
let user1 = [];
let SuccessNumber = 0;
let FailedNumber = 0;
let showLog = [];
let allLogs_all = [];

const data = require(path.join(__dirname, 'Utilities', 'Settings.json'));
showLog = data.SHOW_LOG;


(async () => {
  try {

    const dirPath0 = path.join(__dirname, 'Cases');
    const files0 = await fs.readdir(dirPath0);
    try {
      for (const file0 of files0) {
        const dirPath = path.join(__dirname, 'Cases', file0);

        const data1 = require(path.join(dirPath, 'Settings.json'));

        if (data1.Enabled === "true") {
        } else {
          continue
        }

        const files = await fs.readdir(dirPath);
        const jsFiles = files.filter(file => file.endsWith('.js'));


        for (const file of jsFiles) {

          if (file.indexOf(".json") !== -1) {
            continue
          }

          caseName = file;

          try {  // read .js in current folder

            const filePath = path.join(dirPath, file);
            const content = await fs.readFile(filePath, 'utf8');
            //console.log(`js content read ok: ${file}`);
          } catch (err) {
            console.error('read js file error:', err);
          }

          const dirPath1 = path.join(__dirname, 'Cases', file0, '\\');
          //delete  log.json file in parent folder and current folder
          const filePPath = path.join(__dirname, 'Cases', 'log.json');
          const filePPathAll = path.join(__dirname, 'Cases', 'merged-logs.json');
          const fileCPath = path.join(__dirname, 'Cases', file0, 'log.json');
          const fileRootPath = path.join(__dirname, 'log.json');
          const fileUPath = path.join(__dirname, 'Utilities', 'log.json');

          try { // delete log files

            await fs2.remove(filePPathAll);
            await fs2.remove(filePPath);
            await fs2.remove(fileCPath);
            await fs2.remove(fileRootPath);
            await fs2.remove(fileUPath);

          } catch (err) {
            console.error('remove log file error:', err);
          }

          try {
            await runFile(dirPath1 + '\\' + file);
          } catch (err) {
            console.error('run  js error:', err);
          }


          let dataJson = [];
          let fileLocation = [];

          try { // find log.json file 
            dataJson = fs3.readFileSync(fileCPath, 'utf-8');
            fileLocation = fileCPath
          } catch (err) {
            if (err.code === 'ENOENT') {
              try {
                dataJson = fs3.readFileSync(filePPath, 'utf-8');
                fileLocation = filePPath
              } catch (err) {
                if (err.code === 'ENOENT') {
                  try {
                    dataJson = fs3.readFileSync(fileRootPath, 'utf-8');
                    fileLocation = fileRootPath
                  } catch (err) {
                    if (err.code === 'ENOENT') {
                    }

                  }
                }

              }
            }

          }



          let rawdatax = [];
          try {
            // 🔥 核心修复：按行读取，每行单独解析成 JSON
            //        const lines = dataJson.trim().split('\n').filter(line => line.trim() !== '');
            const lines1 = dataJson.split('\n').map(l => l.trim()).filter(Boolean);

            const isJsonLines = dataJson.split('\n').some(line => {
              const trimmed = line.trim();
              return trimmed.startsWith('{') && trimmed.endsWith('}');
            }) && dataJson.split('\n').length > 1;


            if (isJsonLines) {
              console.log("is JSON Lines format");
              rawdatax = dataJson
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .map(JSON.parse);

            } else {
              console.log("is JSON format");
              rawdatax = lines1;
              const fullJsonStr = rawdatax.join('');
              const parsedArray = JSON.parse(fullJsonStr);
              rawdatax = parsedArray;
            }

          } catch (readErr) {
            console.error(`concatenate error 1: `, readErr);
          }

          try {
            dataJson = JSON.stringify(rawdatax, null, 2);

            let final = [];
            let sameFile = 0;

            if (dataJson.indexOf("faild") !== -1 ||
              dataJson.indexOf("not_found") !== -1 ||
              dataJson.indexOf("failed") !== -1 ||
              dataJson.indexOf("error") !== -1) {
              sameFile = 1;
              final = '❌ (Failed) --------------------------------------'
              FailedNumber = FailedNumber + 1;
            }
            else {
              if (sameFile === 0) {
                final = '✅ (Success) ---------------------------------------'
                SuccessNumber = SuccessNumber + 1;
              }
            }
            user1 = [];
            const newItem = {
              id: 'T',
              title: final + caseName,
              time: new Date().toISOString()
            };

            user1.unshift(newItem);

            //  allLogs = Array.isArray(allLogs) ? allLogs.concat(user1) : user1;
            allLogs = rawdatax;
            allLogs = allLogs.concat(user1)

            const mainNode = allLogs.find(item => item.id === 'T');
            const otherNodes = allLogs.filter(item => item.id !== 'T');

            mainNode.children = otherNodes;
            allLogs = mainNode;

            allLogs_all.push(allLogs);

          } catch (readErr) {
            console.error(`concatenate error 1: `, readErr);
          }

        }
      }

      if (FailedNumber > 0) {
        icon = '❌ -:( '
      } else {
        icon = '✅  -:) '
      }
      //⚠️
      const TotalNumber = SuccessNumber + FailedNumber
      const newNumber = {
        id: 'X',
        title: icon + 'Total: (' + TotalNumber + ") " + 'Success:(' + SuccessNumber + ') Failed: (' + FailedNumber + ')',
        time: new Date().toISOString()
      };
      user1 = [];
      user1.unshift(newNumber);
      allLogs_all = allLogs_all.concat(user1);

      user1 = [];

      let target = [];
      try { //write log.json to merged-logs.json

        const systemTempDir = os.tmpdir();
        const myAppDir = path.join(systemTempDir, 'MyApp', 'Logs');
        const filePath = path.join(myAppDir, 'merged-logs.json');
        targetDir = myAppDir;
        await fs.mkdir(myAppDir, { recursive: true });

        fs1.writeFileSync(filePath, JSON.stringify(allLogs_all, null, 2));
      } catch (err) {
        console.error('cancatenate error 2:', err);
      }

      logData = allLogs_all;

      const data = require(path.join(__dirname, 'Utilities', 'Settings.json'));
      showLog = data.SHOW_LOG;

      if (showLog === 'simple') {

        logData.forEach(item => {
          if (item.id === 'T') {
            delete item.children;
          }
        });
      }

      if (showLog === 'failed') {
        logData.forEach(item => {
          if (item.id === 'T' && item.title.indexOf("Success") !== -1) {
            delete item.children;
          }
        });
      }

      title = logData?.find(item => item.id === 'X').title;
      console.log('Result:' + title)

      const logDtataStr = JSON.stringify(logData, null, 2);
      formatJson = JSON.stringify(logData, null, 2);

      let foldableJsonHtml = '';

      function escapeHtml(str) {
        if (str === undefined || str === null) return '';
        return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }

      logData.forEach(item => {
        const hasChildren = item.children &&
          (Array.isArray(item.children) ? item.children.length > 0 : typeof item.children === 'object');

        const title = JSON.stringify(item.title, null, 2);
        const children = hasChildren ? JSON.stringify(item.children, null, 2) : '';

        if (!hasChildren) {

          foldableJsonHtml += `
<div style="margin:8px 0; padding:6px; border:1px solid #eee; border-radius:4px;">
  ${escapeHtml(title)}
</div>
`;
        } else {
          // children： show arr
          foldableJsonHtml += `
<div>
  <details style="margin:8px 0; border:1px solid #eee; padding:6px; border-radius:4px;">
    <summary style="cursor:pointer; margin:0;">${escapeHtml(title)}</summary>
    <pre style="background:#f8f8f8; padding:10px; border-radius:4px; overflow:auto;">${escapeHtml(children)}</pre>
  </details>
</div>
`;
        }
      });



      console.log('');

      try { //write html to merged-logs.html

        const systemTempDir1 = os.tmpdir();
        const myAppDir1 = path.join(systemTempDir1, 'MyApp', 'Logs');
        const filePath1 = path.join(myAppDir1, 'merged-logs_1.html');
        console.log('Output Folder: ' + filePath1);

        //targetDir = myAppDir;
        await fs.mkdir(myAppDir1, { recursive: true });

        // fs1.writeFileSync(filePath, JSON.stringify(allLogs_all, null, 2));
        fs1.writeFileSync(filePath1, foldableJsonHtml, 'utf8');

        // send email
        if (data.EMAIL_ENABLE === "true") {
          await runFile(path.join(__dirname, 'Utilities', 'email.js'));
        }

        const dirPath2 = path.join(__dirname);
        const files2 = await fs.readdir(dirPath2);
        const pngFiles = files2.filter(file => file.endsWith('.png'));
        for (const file0 of pngFiles) {
          const fileLocation1 = path.join(__dirname, file0);
          const filePath1 = path.join(targetDir, file0);
          if (fs0.existsSync(fileLocation1)) {
            await fs2.rename(fileLocation1, filePath1);
          }
        }

      } catch (err) {
        console.error('cancatenate error:', err);
      }

    } catch (err) {
      console.error('unknown error:', err);
    }
  } catch (err) {
    console.error('unknown error:', err);
  }

})();



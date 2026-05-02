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

async function removeLogFiles(caseFolderName) {

  const filePPath = path.join(__dirname, 'Cases', 'log.json');
  const filePPathAll = path.join(__dirname, 'Cases', 'merged-logs.json');
  const fileCPath = path.join(__dirname, 'Cases', caseFolderName, 'log.json');
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
}

//wait each js finish
/*
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
*/
// 正确版本：支持 path + 参数数组
function runFile(path, args = []) {
  return new Promise((resolve, reject) => {
    // ✅ 正确写法：把 path 和 args 合并成一个数组
    const child = spawn('node', [path, ...args], {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`js ${path} run failed`));
    });
  });
}

function findLogJsonLocation(caseFolderName) {
  const filePPath = path.join(__dirname, 'Cases', 'log.json');
  const filePPathAll = path.join(__dirname, 'Cases', 'merged-logs.json');
  const fileCPath = path.join(__dirname, 'Cases', caseFolderName, 'log.json');
  const fileRootPath = path.join(__dirname, 'log.json');
  const fileUPath = path.join(__dirname, 'Utilities', 'log.json');

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
  return fileLocation;
}
function adjustJsonContent(dataJson) {

  try {
    // 🔥 核心修复：按行读取，每行单独解析成 JSON
    //        const lines = dataJson.trim().split('\n').filter(line => line.trim() !== '');
    const lines1 = dataJson.split('\n').map(l => l.trim()).filter(Boolean);

    const isJsonLines = dataJson.split('\n').some(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('{') && trimmed.endsWith('}');
    }) && dataJson.split('\n').length > 1;


    if (isJsonLines) {
      //console.log("is JSON Lines format");
      rawdatax = dataJson
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(JSON.parse);

    } else {
      //console.log("is JSON format");
      rawdatax = lines1;
      const fullJsonStr = rawdatax.join('');
      const parsedArray = JSON.parse(fullJsonStr);
      rawdatax = parsedArray;
    }

  } catch (readErr) {
    console.error(`concatenate error 1: `, readErr);
  }
  return rawdatax;

}
function addSummary(rawdatax, caseName) {

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
    const newItemObj = [];
    const newItem = {
      id: 'T',
      title: final + caseName,
      time: new Date().toISOString()
    };

    newItemObj.unshift(newItem);

    allLogs = rawdatax;
    allLogs = allLogs.concat(newItemObj)

    const mainNode = allLogs.find(item => item.id === 'T');
    const otherNodes = allLogs.filter(item => item.id !== 'T');

    mainNode.children = otherNodes;
    allLogs = mainNode;

  } catch (readErr) {
    console.error(`concatenate error 1: `, readErr);
  }
  return allLogs
}

async function writeToMergedJson() {
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
}

function generateHtmlbySHOW_LOG(logData) {

  if (settingsData.SHOW_LOG === 'simple') {

    logData.forEach(item => {
      if (item.id === 'T') {
        delete item.children;
      }
    });
  }

  if (settingsData.SHOW_LOG === 'failed') {
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

  return foldableJsonHtml;
}
async function writeToMergedHTML() {
  try { //write html to merged-logs.html

    const systemTempDir1 = os.tmpdir();
    const myAppDir1 = path.join(systemTempDir1, 'MyApp', 'Logs');
    const filePath1 = path.join(myAppDir1, 'merged-logs_1.html');
    console.log('Output Folder: ' + filePath1);

    //targetDir = myAppDir;
    await fs.mkdir(myAppDir1, { recursive: true });

    fs1.writeFileSync(filePath1, foldableJsonHtml, 'utf8');

    // send email
    if (settingsData.EMAIL_ENABLE === "true") {
      await runFile(path.join(__dirname, 'Utilities', 'email.js'));
    }
    const dirPath2 = path.join(__dirname);
    const files2 = await fs.readdir(dirPath2);
    const pngFiles = files2.filter(file => file.endsWith('.png'));
    for (const pngfile of pngFiles) {
      const fileLocation1 = path.join(__dirname, pngFile);
      const filePath1 = path.join(targetDir, pngFile);
      if (fs0.existsSync(fileLocation1)) {
        await fs2.rename(fileLocation1, filePath1);
      }
    }

  } catch (err) {
    console.error('cancatenate error:', err);
  }
}
function makeFinalResult(SuccessNumber, FailedNumber) {

  if (FailedNumber > 0) {
    icon = '❌ -:( '
  } else {
    icon = '✅  -:) '
  }
  //⚠️
  const TotalNumber = SuccessNumber + FailedNumber
  const titleFinal = {
    id: 'X',
    title: ' ' + runMode + ' ' + icon + 'Total: (' + TotalNumber + ") " + 'Success:(' + SuccessNumber + ') Failed: (' + FailedNumber + ')',
    time: new Date().toISOString()
  };
  const titleFinalObj = [];
  titleFinalObj.unshift(titleFinal);
  return titleFinalObj;
}

let SuccessNumber = 0;
let FailedNumber = 0;
//let allLogs = [];
let allLogs_all = [];
let settingsData = [];
let RunMode = [];

(async () => {
  try {
    const args = process.argv.slice(1);
    const email = args[1];
    console.log("email:", email);

    settingsData = require(path.join(__dirname, 'Utilities', 'Settings.json'));

    const casesRootPath = path.join(__dirname, 'Cases');
    const casesSubFolders = await fs.readdir(casesRootPath);
    for (const caseFolder of casesSubFolders) {
      const caseFolderFullPath = path.join(__dirname, 'Cases', caseFolder);
      const settingsDataLocal = require(path.join(caseFolderFullPath, 'Settings.json'));
      if (settingsDataLocal.Enabled === "true" || settingsDataLocal.Enabled === true) {
      } else {
        continue
      }

      function isEmpty(str) {
        return !str || str.trim() === '';
      }

      if (isEmpty(email)) {
        runMode = "Auto"
      } else {
        if (email.indexOf(settingsDataLocal.EMAIL_TO) !== -1) { runMode = "Debug" }
        else {
          continue
        }
      }

      const files = await fs.readdir(caseFolderFullPath);
      const jsFiles = files.filter(file => file.endsWith('.js'));
      for (const jsFile of jsFiles) {
        if (jsFile.indexOf(".json") !== -1) {
          continue
        }
        removeLogFiles(caseFolder)
        try {
          const exePathFull = path.join(caseFolderFullPath, jsFile);
          await runFile(exePathFull);
        } catch (err) {
          console.error('run  js error:', err);
        }
        const fileLocation = findLogJsonLocation(caseFolder)
        const dataJson = fs3.readFileSync(fileLocation, 'utf-8');
        removeLogFiles(caseFolder)
        const rawdatax = adjustJsonContent(dataJson);
        allLogs_all.push(addSummary(rawdatax, jsFile));
      }
    }
    const finalResult = makeFinalResult(SuccessNumber, FailedNumber)
    allLogs_all = allLogs_all.concat(finalResult);
    writeToMergedJson()
    foldableJsonHtml = generateHtmlbySHOW_LOG(allLogs_all)
    writeToMergedHTML(foldableJsonHtml)

    if (settingsData.EMAIL_ENABLE === "true" || settingsDataLocal.EMAIL_ENABLE === true) {
      await runFile(path.join(__dirname, 'Utilities', 'email.js'), '[' + email + ']');
      process.exit();
    }

  } catch (err) {
    console.error('unknown error:', err);
  }
})();



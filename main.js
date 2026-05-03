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
function makeFinalResult(SuccessNumber, FailedNumber, email, RunMode) {

  if (FailedNumber > 0) {
    icon = '❌ -:( '
  } else {
    icon = '✅  -:) '
  }
  //⚠️
  const TotalNumber = SuccessNumber + FailedNumber
  const titleFinal = {
    id: 'X',
    email: email,
    title: ' ' + RunMode + ' ' + icon + 'Total: (' + TotalNumber + ") " + 'Success:(' + SuccessNumber + ') Failed: (' + FailedNumber + ')， ' + email,
    time: new Date().toISOString()
  };
  const titleFinalObj = [];
  titleFinalObj.unshift(titleFinal);
  return titleFinalObj;
}


async function scanAllEmailAddress(runMode) {
  let emailAddressArr = [];
  const casesRootPath = path.join(__dirname, 'Cases');
  const casesSubFolders = await fs.readdir(casesRootPath);
  for (const caseFolder of casesSubFolders) {
    const caseFolderFullPath = path.join(casesRootPath, caseFolder);
    const settingsPath = path.join(caseFolderFullPath, 'Settings.json');
    try {
      const files = await fs.readdir(caseFolderFullPath);
      const jsFiles = files.filter(file => file.endsWith('.js'));
      for (const jsFile of jsFiles) {
        if (jsFile.indexOf(".json") !== -1) {
          continue
        }
        const settingsContent = await fs.readFile(settingsPath, 'utf8');
        const settingsDataLocal = JSON.parse(settingsContent);

        if (settingsDataLocal.Enabled !== "true" && settingsDataLocal.Enabled !== true) {
          continue;
        }
        const email = settingsDataLocal.EMAIL_TO;
        if (email && email.trim()) {
          emailAddressArr.push(email.trim());
        }
      }
    } catch (err) {
    }
  }

  let newArr = [...new Set(emailAddressArr)];

  return newArr;
}
function isEmpty(str) {
  return !str || str.trim() === '';
}

async function readJSFiles(emailTo) {
  let jsFiles1 = [];
  const casesRootPath = path.join(__dirname, 'Cases');
  const casesSubFolders = await fs.readdir(casesRootPath);

  for (const caseFolder of casesSubFolders) {
    const caseFolderFullPath = path.join(casesRootPath, caseFolder);
    const settingsPath = path.join(caseFolderFullPath, 'Settings.json');

    try {
      const settingsContent = await fs.readFile(settingsPath, 'utf8');
      const settingsDataLocal = JSON.parse(settingsContent);

      if (settingsDataLocal.Enabled !== "true" && settingsDataLocal.Enabled !== true) {
        continue;
      }

      const files = await fs.readdir(caseFolderFullPath);
      const jsFiles = files.filter(file => file.endsWith('.js'));

      for (const jsFile of jsFiles) {
        const fullPath = path.join(caseFolderFullPath, jsFile);

        // 匹配邮箱
        if (emailTo === '-Auto-') {
          jsFiles1.push(fullPath);
        } else {
          if (settingsDataLocal.EMAIL_TO === emailTo) {
            jsFiles1.push(fullPath);
          }
        }
      }

    } catch (err) {
    }
  }

  return jsFiles1;
}

let SuccessNumber = 0;
let FailedNumber = 0;
let SuccessNumberAll = 0;
let FailedNumberAll = 0;
let allLogs = [];
let allLogs_all = [];
let allLogs_all_all = [];
let settingsData = [];
let settingsData2 = [];
let settingsData3 = [];
let caseFolderPub = [];
let RunMode = [];
let once = 0;
let settingsDataLocal = [];
let aaa = [];
let finalResult = [];

(async () => {
  try {
    const args = process.argv.slice(1);
    const email = args[1];
    console.log("email:", email);

    let emailArray = [];
    let allNeeded = [];

    if (!email?.trim()) {
      RunMode = 'Auto'
      emailArray = await scanAllEmailAddress();
      //emailArray.sort();
      emailArray.push('-Auto-');
      allNeeded = true;
    } else {
      RunMode = 'Debug'
      emailArray.push(email.trim());
      emailArray = [...new Set(emailArray)];
      allNeeded = false;
    }

    for (let oneEmail of emailArray) {

      if (oneEmail == '-Auto-') {
        const settingsDataPub = require(path.join(path.join(__dirname, 'Utilities', 'Settings.json')));
        finalResult = makeFinalResult(SuccessNumberAll, FailedNumberAll, settingsDataPub.EMAIL_TO, RunMode);
        title = finalResult?.find(item => item.id === 'X').title;
        console.log('Result:' + title)
        allLogs_all_all = allLogs_all_all.concat(finalResult);
        writeToMergedJson()
        settingsData = settingsDataPub
        foldableJsonHtml = generateHtmlbySHOW_LOG(allLogs_all_all)
        writeToMergedHTML(foldableJsonHtml)
        if (settingsDataPub.EMAIL_ENABLE === "true" || settingsDataPub.EMAIL_ENABLE === true) {
          const tempFile = path.join(os.tmpdir(), 'email.txt');
          fs0.writeFileSync(tempFile, oneEmail, 'utf8');
          await runFile(path.join(__dirname, 'Utilities', 'email.js'));
        }
      }
      else {
        const JSFiles = await readJSFiles(oneEmail)
        let index = 0;
        if (allNeeded === false) {
          SuccessNumber = 0;
          FailedNumber = 0;
          allLogs = [];
          allLogs_all = [];
        }
        for (const JSFile of JSFiles) {
          index = index + 1;
          const caseFolder = path.dirname(JSFile);
          const caseFolderBase = path.basename(caseFolder);
          removeLogFiles(caseFolderBase)
          try {
            await runFile(JSFile);
          } catch (err) {
            console.error('run  js error:', err);
          }
          const strResult = String(finalResult || '');
          const fileLocation = findLogJsonLocation(caseFolderBase);
          const dataJson = fs3.readFileSync(fileLocation, 'utf-8');
          removeLogFiles(path.basename(caseFolder))
          const rawdatax = adjustJsonContent(dataJson);
          settingsData2 = require(path.join(path.join(caseFolder, 'Settings.json')));
          allLogs_all.push(addSummary(rawdatax, path.basename(JSFile)));
          if (index === 1) {
            settingsData3 = require(path.join(path.join(caseFolder, 'Settings.json')));
            caseFolderPub = caseFolder;
          }
          if (JSFiles.length === index) {
            finalResult = makeFinalResult(SuccessNumber, FailedNumber, settingsData2.EMAIL_TO, RunMode);
            allLogs_all = allLogs_all.concat(finalResult);
            allLogs_all_all = allLogs_all_all.concat(allLogs_all);
            SuccessNumberAll = SuccessNumberAll + SuccessNumber;
            FailedNumberAll = FailedNumberAll + FailedNumber;
          }
        }
        let emailFinal = [];
        finalResult = [];
        writeToMergedJson()
        settingsData = require(path.join(path.join(caseFolderPub, 'Settings.json')));
        foldableJsonHtml = generateHtmlbySHOW_LOG(allLogs_all)
        writeToMergedHTML(foldableJsonHtml)
        if (settingsData3.EMAIL_ENABLE === "true" || settingsData3.EMAIL_ENABLE === true) {
          const tempFile = path.join(os.tmpdir(), 'email.txt');
          fs0.writeFileSync(tempFile, oneEmail, 'utf8');
          await runFile(path.join(__dirname, 'Utilities', 'email.js'));
        }
        allLogs_all = [];
        SuccessNumber = 0;
        FailedNumber = 0;
      }
    }
  } catch (err) {
    console.error('unknown error:', err);
  }
})();



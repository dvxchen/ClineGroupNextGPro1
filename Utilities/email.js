const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const os = require('os');
const fs4 = require('fs').promises;
const systemTempDir = os.tmpdir();
const myAppDir = path.join(systemTempDir, 'MyApp', 'Logs');
const filePath1 = path.join(myAppDir, 'merged-logs.json');

const logFilePath = filePath1;

let logData;
let row;
let title;

let once = 0;

const transporter = nodemailer.createTransport({
    host: "smtp.qq.com",
    port: 587,
    secure: false,
    auth: {
        user: "dvxchen@qq.com",
        pass: "bmvjzubzfzuxdjdb"
    }
});

let formatJson = [];
let users = [];
const filePath = logFilePath;
const rawData = fs.readFileSync(filePath, 'utf8');

users = JSON.parse(rawData);
formatJson = JSON.stringify(users, null, 2);


const systemTempDir1 = os.tmpdir();
const myAppDir1 = path.join(systemTempDir1, 'MyApp', 'Logs');
const filePath2 = path.join(myAppDir1, 'merged-logs_1.html');
const foldableJsonHtml = fs.readFileSync(filePath2, 'utf8');

title = users.filter(item => item.id === 'X').pop().title;

const path2 = require('path');


let finalEmail = [];
let email2 = [];

const tempFile = path.join(os.tmpdir(), 'email.txt');
if (fs.existsSync(tempFile)) {
    email2 = fs.readFileSync(tempFile, 'utf8').trim();
    fs.unlinkSync(tempFile);

} else {
    process.exit();
}

if (email2.indexOf('.com') !== -1) { finalEmail = email2 }
else {
    const settingsData2 = require(path.join(path2.join(__dirname, 'Settings.json')));
    finalEmail = settingsData2.EMAIL_TO;; //settingsData.EMAIL_TO;
}
console.log("email:", finalEmail);

const mailOptions = {
    from: '"Test Report for Cline Group Next G Pro" <dvxchen@qq.com>',
    to: finalEmail,
    subject: title,
    text: "Review Content",
    html: foldableJsonHtml,
    attachments: [
        {
            filename: 'merged-logs.json',
            path: logFilePath
        }
    ]
};

async function sendEmail() {
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Send Success:', info.messageId);

    } catch (error) {
        console.error('❌ Send failed:', error.message);
    }
}

sendEmail();
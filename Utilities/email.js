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


title = users?.find(item => item.id === 'X').title;

const args = process.argv.slice(2);
const email1 = args.join('').replace(/[\[\]]/g, '');
let finalEmail = [];

//const settingsData1 = require(path.join(__dirname, 'Utilities', 'Settings.json'));

if (email1.indexOf('.com') !== -1) { finalEmail = email1 }
else {
    finalEmail = 'davy.chen@sap.com'; //settingsData.EMAIL_TO;
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
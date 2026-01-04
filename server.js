const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
require('dotenv').config();  // 加载.env文件

// 添加环境变量检查
console.log('Environment variables check:');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST ? '✓ Set' : '✗ Missing');
console.log('EMAIL_PORT:', process.env.EMAIL_PORT ? '✓ Set' : '✗ Missing');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✓ Set' : '✗ Missing');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✓ Set' : '✗ Missing');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM ? '✓ Set' : '✗ Missing');
console.log('RECEIVER_EMAIL:', process.env.RECEIVER_EMAIL ? '✓ Set' : '✗ Missing');

const app = express();
const path = require('path');

// 禁用 punycode 警告
process.removeAllListeners('warning');

// 更详细的 CORS 配置
const allowedOrigins = [
    'http://localhost:3000',      // 本地开发需要端口号
    'https://crownnewmaterial.com',
    'https://www.crownnewmaterial.com',
    'https://crownnewmaterials.com',
    'https://www.crownnewmaterials.com'
];

app.use(cors({
    origin: function(origin, callback) {
        // 允许没有 origin 的请求（比如同源请求）
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

// 定义 limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { 
        success: false, 
        message: 'Too many requests. Please try again in 1 hour. / 请求次数过多，请1小时后再试。' 
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 应用 limiter 到邮件路由
app.use('/send-email', limiter);

// 创建 SMTP 邮件传输器
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: true, // 使用 SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// 验证 SMTP 连接
transporter.verify(function(error, success) {
    if (error) {
        console.error('SMTP connection error:', error);
    } else {
        console.log('SMTP server is ready to send emails');
    }
});

// 邮件发送路由
app.post('/send-email', async (req, res) => {
    try {
        const { name, email, phone, message, honeypot } = req.body;

        // 检查honeypot字段
        if (honeypot) {
            return res.json({ success: false });
        }

        // 检查必填字段
        if (!name || !email || !message) {
            return res.json({ 
                success: false, 
                message: 'Required fields are missing / 缺少必填字段' 
            });
        }

        // 验证字段格式
        const nameRegex = /^[\p{L}\s]{2,50}$/u;  // 支持所有语言的字符
        const phoneRegex = /^[\d\s\-+()]{5,20}$/;  // 更宽松的电话号码格式
        const emailRegex = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;  // 更新的邮箱验证

        if (!nameRegex.test(name)) {
            return res.json({ 
                success: false, 
                message: 'Invalid name format / 姓名格式不正确' 
            });
        }

        if (!emailRegex.test(email)) {
            return res.json({ 
                success: false, 
                message: 'Invalid email format / 邮箱格式不正确' 
            });
        }

        if (phone && !phoneRegex.test(phone)) {
            return res.json({ 
                success: false, 
                message: 'Invalid phone format / 电话格式不正确' 
            });
        }

        // 构建邮件内容
        const mailOptions = {
            from: `"域名咨询" <${process.env.EMAIL_FROM}>`,
            to: process.env.RECEIVER_EMAIL,
            subject: '新域名购买咨询',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">新域名购买咨询</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 100px;">姓名:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">${name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">邮箱:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">电话:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">${phone || '未提供'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">留言:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">${message}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">发送时间:</td>
                            <td style="padding: 10px;">${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td>
                        </tr>
                    </table>
                </div>
            `
        };

        // 发送邮件
        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        res.json({ success: true });

    } catch (error) {
        console.error('Email send error:', {
            message: error.message,
            name: error.name,
            code: error.code
        });

        res.json({ 
            success: false, 
            message: 'Failed to send email / 发送邮件失败，请稍后重试',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 静态文件服务务必在动态路由之后
app.use(express.static('public'));

// 根路由处理
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 处理放在最后
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Route not found / 路由未找到' 
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error / 服务器内部错误' 
    });
});

// 修改端口配置，让它在本地开发和生产环境都能正常工作
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    // 在生产环境中不显示端口信息
    if (process.env.NODE_ENV === 'production') {
        console.log('Server running in production mode');
    } else {
        console.log(`Server running on port ${PORT}`);
    }
});

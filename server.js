// server.js - 双语实验服务器
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8000;

// 启用 CORS
app.use(cors());

// 静态文件服务
app.use(express.static(__dirname));

// API 端点：获取 CSV 数据
app.get('/api/images', (req, res) => {
    try {
        const data = fs.readFileSync('images_list.csv', 'utf8');
        res.type('text/plain').send(data);
    } catch (error) {
        console.error('读取图片CSV失败:', error);
        res.status(500).json({ error: '无法加载图片数据' });
    }
});

app.get('/api/audio', (req, res) => {
    try {
        const data = fs.readFileSync('audio_list.csv', 'utf8');
        res.type('text/plain').send(data);
    } catch (error) {
        console.error('读取音频CSV失败:', error);
        res.status(500).json({ error: '无法加载音频数据' });
    }
});

// 检查文件是否存在
app.get('/api/check-files', (req, res) => {
    const files = [
        'jspsych.js',
        'jspsych.css',
        'main.js',
        'index.html',
        'images_list.csv',
        'audio_list.csv',
        'plugins/jspsych-html-keyboard-response.js',
        'plugins/jspsych-image-keyboard-response.js',
        'plugins/jspsych-audio-keyboard-response.js'
    ];
    
    const results = {};
    files.forEach(file => {
        results[file] = fs.existsSync(file);
    });
    
    res.json({
        success: true,
        files: results,
        directory: __dirname
    });
});

// 列出可用图片和音频文件
app.get('/api/list-files', (req, res) => {
    try {
        const images = fs.readdirSync('images').filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
        const audio = fs.readdirSync('audio').filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
        
        res.json({
            success: true,
            images: images,
            audio: audio,
            imagesCount: images.length,
            audioCount: audio.length
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// 主页面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log('========================================');
    console.log('🎯 双语语言实验服务器已启动！');
    console.log('📁 实验目录:', __dirname);
    console.log('🌐 访问地址: http://localhost:' + PORT);
    console.log('========================================');
    console.log('📊 服务器状态:');
    console.log('- 端口:', PORT);
    console.log('- 静态文件服务: 已启用');
    console.log('- CORS: 已启用');
    console.log('========================================');
    console.log('💡 提示:');
    console.log('1. 确保所有文件存在:');
    console.log('   - index.html');
    console.log('   - main.js');
    console.log('   - jspsych.js, jspsych.css');
    console.log('   - plugins/ 文件夹中的插件');
    console.log('   - images/ 和 audio/ 文件夹');
    console.log('2. 检查文件访问: http://localhost:' + PORT + '/api/check-files');
    console.log('========================================');
});
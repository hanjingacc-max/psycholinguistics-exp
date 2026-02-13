// main.js - 语码切换实验 (最终修复版)

let mediaRecorder;
let audioChunks = [];
let testBlobUrl = null;

async function initRecorder() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        return true;
    } catch (err) {
        alert("麦克风启动失败：请确保使用 http://localhost:8000 访问，并允许权限。");
        return false;
    }
}

const CONFIG = {
    MAX_RT_EXP1: 7000,   // 任务一延长至 7 秒
    MAX_RT_EXP2: 5000,   // 任务二 5 秒
    FIX_DUR: 600,
    BLANK_DUR: 1000,
    EXP1_PRACTICE: 8,    
    EXP1_FORMAL: 20,     
    EXP2_PRACTICE: 12,   
    EXP2_FORMAL: 120     
};

let imageStimuli = [];
let audioStimuli = [];
let experimentTimeline = [];

window.startMainExperiment = async function() {
    const micReady = await initRecorder();
    if (!micReady) return;
    const dataLoaded = await loadData();
    if (dataLoaded) {
        buildTimeline();
        jsPsych.init({
            timeline: experimentTimeline,
            display_element: 'experiment-container',
            preload_images: imageStimuli.map(i => i.filePath),
            preload_audio: audioStimuli.map(a => a.filePath),
            on_error: (e) => {
                console.warn("加载异常:", e);
                // 自动跳过解码失败的音频，防止卡死
                if(e.includes("decode")) { 
                    jsPsych.finishTrial(); 
                }
            }
        });
    }
};

async function loadData() {
    try {
        const v = Date.now();
const [imgR, audR] = await Promise.all([
    fetch('images_list.csv?v=' + v), 
    fetch('audio_list.csv?v=' + v)
]);
        const imgT = await imgR.text();
        const audT = await audR.text();
        
        imageStimuli = imgT.trim().split('\n').slice(1).filter(l => l.length > 5).map(l => {
            const p = l.split(',');
            const fName = p[0].trim();
            return { filename: fName, language: p[1].trim(), name: p[2]?.trim(), filePath: 'images/' + fName };
        });

        audioStimuli = audT.trim().split('\n').slice(1).filter(l => l.length > 5).map(l => {
            const p = l.split(',');
            const fName = p[0].trim();
            // 路径编码保护，移除文件名中可能的异常空格
            return { filename: fName, language: p[1].trim(), category: parseInt(p[2]), name: p[3]?.trim(), filePath: 'audio/' + fName.replace(/\s/g, ''), correctKey: p[2].trim() === '1' ? 'f' : 'j' };
        });
        return true;
    } catch (e) {
        alert("材料加载失败，请检查CSV。");
        return false;
    }
}

function generateBalancedSequence(pool, total, isAudioTask = false) {
    let baseConditions = [];
    const numCombos = isAudioTask ? 8 : 4; 
    const perCond = Math.ceil(total / numCombos);
    ['de', 'zh'].forEach(lang => {
        ['switch', 'repeat'].forEach(type => {
            if (isAudioTask) {
                [0, 1].forEach(cat => { for(let i=0; i<perCond; i++) baseConditions.push({lang, type, cat}); });
            } else {
                for(let i=0; i<perCond; i++) baseConditions.push({lang, type});
            }
        });
    });
    let finalConds = jsPsych.randomization.shuffle(baseConditions).slice(0, total);
    let sequence = [];
    let lastLang = Math.random() > 0.5 ? 'de' : 'zh';
    let localPool = jsPsych.randomization.shuffle([...pool]);
    finalConds.forEach(cond => {
        let targetLang = (cond.type === 'switch') ? (lastLang === 'de' ? 'zh' : 'de') : lastLang;
        let stimIndex = isAudioTask 
            ? localPool.findIndex(s => s.language === targetLang && s.category === cond.cat)
            : localPool.findIndex(s => s.language === targetLang);
        if (stimIndex === -1) stimIndex = 0; 
        let stim = localPool.splice(stimIndex, 1)[0] || pool[0];
        sequence.push({ ...stim, assignedLang: targetLang, condType: cond.type });
        lastLang = targetLang;
    });
    return sequence;
}

function buildTimeline() {
    // 欢迎页
    experimentTimeline.push({
        type: 'html-keyboard-response',
        stimulus: `
            <div class="instructions">
                <h1 style="color:#2c3e50;">欢迎参加德汉语码切换实验</h1>
                <div class="indent-text">
                    本实验由上海理工大学德语专业本科生开展，旨在探索德语二语学习者的语码切换加工机制。实验分为两部分，全程约20分钟。本实验内容受版权保护，未经许可不得私自录制或传播。您的数据仅用于学术研究并将严格保密。

                </div>
                <div class="indent-text" style="color:#c0392b; font-weight:bold;">
                    【重要提示】为保证实验数据的科学性与有效性，实验一旦开始请勿中途停止、刷新页面或切换窗口。请确保您目前处于安静、独立、光线适中的环境，并调试设备音量以获得最佳听音效果。
                </div>
                <p style="margin-top:20px;">按 <span class="key">空格键</span> 进入设备测试</p>
            </div>`,
        choices: [' ']
    });

    // 设备测试
    experimentTimeline.push({
        type: 'html-keyboard-response',
        stimulus: `
            <div class="instructions">
                <h2>🎤 设备测试 (Microphone Test)</h2>
                <p style="margin-bottom:20px;">请点击按钮并大声说出“测试录音”</p>
                <button id="record-btn" class="btn-test" style="background:#e74c3c;">🔴 开始录制</button>
                <button id="play-btn" class="btn-test" style="background:#95a5a6;" disabled>▶️ 试听回放</button>
                <div id="test-status" style="margin-top:20px; color:#34495e; font-weight:bold;">等待操作...</div>
                <p style="margin-top:40px; color:#666; font-size:14px;">确认能够清晰听到回放后，按 <span class="key">空格键</span> 开始实验</p>
            </div>`,
        choices: [' '],
        on_load: function() {
            const rBtn = document.getElementById('record-btn');
            const pBtn = document.getElementById('play-btn');
            const status = document.getElementById('test-status');
            rBtn.onclick = () => {
                if (mediaRecorder.state === "inactive") {
                    audioChunks = []; mediaRecorder.start();
                    rBtn.innerText = "⏹️ 停止录音"; rBtn.style.background = "#2c3e50";
                    status.innerText = "正在录音中..."; pBtn.disabled = true;
                } else {
                    mediaRecorder.stop();
                    rBtn.innerText = "🔄 重新录制"; rBtn.style.background = "#e74c3c";
                    mediaRecorder.onstop = () => {
                        const blob = new Blob(audioChunks, { type: 'audio/webm' });
                        testBlobUrl = URL.createObjectURL(blob);
                        pBtn.disabled = false; pBtn.style.background = "#3498db";
                        status.innerText = "✅ 录音完成，请点击回放确认";
                    };
                }
            };
            pBtn.onclick = () => { if(testBlobUrl) new Audio(testBlobUrl).play(); };
        }
    });

    // 任务一指导语
    experimentTimeline.push({
        type: 'html-keyboard-response',
        stimulus: `
            <div class="instructions">
                <h2>任务一：图片命名 (Picture Naming)</h2>
                <div class="indent-text">
                    根据图片边框颜色开口命名图片内容，<b>在开口命名的同时，请同步按下键盘 J 键。</b>
                </div>
                <div class="indent-text" style="color:#2980b9;">
                    <b>规则说明：</b>每张图片的最长呈现时间为 <b>7 秒</b>。若您在7秒内未做出任何反应，系统将自动跳转至下一试次。在使用德语命名时，<b>无需考虑冠词（der/die/das）</b>，请直接说出名词本身。
                </div>
                <div class="box-container">
                    <div class="info-box box-red"><h3 class="color-red">红色：中文命名</h3><p>+ 按键盘 <span class="key">J</span></p></div>
                    <div class="info-box box-blue"><h3 class="color-blue">蓝色：德语命名</h3><p>+ 按键盘 <span class="key">J</span></p></div>
                </div>
                <div class="example-area">
                    <p style="margin-bottom:10px; font-weight:bold;">【示例】</p>
                    <div style="display:flex; justify-content:center; gap:50px;">
                        <div><img src="images/Apfel.jpg" class="example-img" style="border-color:#e74c3c;"><p>红框：说 "苹果" 并按J</p></div>
                        <div><img src="images/Apfel.jpg" class="example-img" style="border-color:#3498db;"><p>蓝框：说 "Apfel" 并按J</p></div>

                    </div>
                </div>
                <p style="margin-top:20px;">按 <span class="key">空格键</span> 开始练习阶段</p>
            </div>`,
        choices: [' '],
        on_finish: () => { audioChunks = []; if(mediaRecorder.state === "inactive") mediaRecorder.start(); }
    });

    const runExp1 = (seq, phase) => {
        seq.forEach(s => {
            experimentTimeline.push({ type:'html-keyboard-response', stimulus:'<div class="fixation">+</div>', choices:jsPsych.NO_KEYS, trial_duration:CONFIG.FIX_DUR });
            experimentTimeline.push({
                type: 'image-keyboard-response',
                stimulus: s.filePath,
                choices: ['j'],
                trial_duration: CONFIG.MAX_RT_EXP1, // 7秒
                prompt: `
                    <div class="prompt-box">
                        <div class="prompt-content">请用 <span class="${s.assignedLang==='zh'?'color-red':'color-blue'}">${s.assignedLang==='zh'?'中文':'德语'}</span> 命名，并按 <span class="key">J</span></div>
                    </div>
                    <div class="image-border ${s.assignedLang==='zh'?'border-red':'border-blue'}"></div>`,
                data: { task:'exp1', phase: phase, lang: s.assignedLang, type: s.condType }
            });
            experimentTimeline.push({ type:'html-keyboard-response', stimulus:'', choices:jsPsych.NO_KEYS, trial_duration:CONFIG.BLANK_DUR });
        });
    };

    runExp1(generateBalancedSequence(imageStimuli, CONFIG.EXP1_PRACTICE), 'practice');
     experimentTimeline.push({ 
        type: 'html-keyboard-response', 
        stimulus: `
            <div class="instructions">
                <h2>练习结束</h2>
                <div style="text-align: left; color: #c0392b; font-weight: bold; margin: 30px 0; line-height: 1.8; font-size: 20px;">
                    注意：<br>
                    （1）请在保证命名的【准确性】的前提下，尽可能快地做出反应。<br>
                    （2）您的按键动作必须与开口发声【严格同步】。严禁在尚未看清图片或尚未开口前预先按键，非同步的无效反应将导致该试次数据作废。
                </div>
                <p>准备好后，按 <span class="key">空格键</span> 开始正式实验一</p>
            </div>`, 
        choices: [' ']
    });
    // ----------------

    runExp1(generateBalancedSequence(imageStimuli, CONFIG.EXP1_FORMAL), 'formal');

    // 过渡
    experimentTimeline.push({
        type: 'html-keyboard-response',
        stimulus: `<div class="instructions"><h2>✅ 任务一完成</h2><p>录音已导出。按 <span class="key">空格键</span> 进入任务二</p></div>`,
        choices: [' '],
        on_start: () => {
            if (mediaRecorder.state === "recording") {
                mediaRecorder.stop();
                mediaRecorder.onstop = () => {
                    const blob = new Blob(audioChunks, { type: 'audio/webm' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `语音记录_任务一_${window.participantInfo.id}.webm`;
                    a.click();
                };
            }
        }
    });

    // 任务二指导语
    experimentTimeline.push({
        type: 'html-keyboard-response',
        stimulus: `
            <div class="instructions">
                <h2>任务二：词汇范畴判断 (Lexical Decision)</h2>
                <div class="indent-text">
                    接下来您将听到一系列中/德语单词，请判断该词对应的物体<b>是否有生命</b>。每个单词播报后，您有 5 秒 时间做出判断。
                <div class="box-container">
                    <div class="info-box" style="border: 2px solid #e74c3c;"><h3>有生命 (人/动/植)</h3><p>按键盘 <span class="key">F</span> 键</p></div>
                    <div class="info-box" style="border: 2px solid #3498db;"><h3>无生命 (物品/建筑)</h3><p>按键盘 <span class="key">J</span> 键</p></div>
                </div>
                </div>
                <div class="indent-text">
                    例如：“狗”“Hund”为有生命（F），“桌子”“Tisch”无生命（J）
                </div>
                <div class="indent-text">
                    <b>请注意：若在 5 秒内未作出反应，试次将自动结束，并进入下一单词。</b>
                </div>
                <p style="margin-top:30px;">按 <span class="key">空格键</span> 开始练习阶段</p>
            </div>`,
        choices: [' ']
    });

    const runExp2 = (seq, phase) => {
        seq.forEach(s => {
            experimentTimeline.push({ type:'html-keyboard-response', stimulus:'<div class="fixation">+</div>', choices:jsPsych.NO_KEYS, trial_duration:CONFIG.FIX_DUR });
            experimentTimeline.push({
                type: 'audio-keyboard-response',
                stimulus: s.filePath,
                choices: ['f', 'j'],
                trial_duration: CONFIG.MAX_RT_EXP2, // 5秒
                prompt: `<div style="text-align:center; color:white; font-size:24px;">有生命 (F) / 无生命 (J)</div>`,
                data: { task:'exp2', phase: phase, correct: s.correctKey, lang: s.assignedLang, type: s.condType },
                on_finish: function(d) { d.acc = (d.response === d.correct) ? 1 : 0; }
            });
            experimentTimeline.push({ type:'html-keyboard-response', stimulus:'', choices:jsPsych.NO_KEYS, trial_duration:CONFIG.BLANK_DUR });
        });
    };

    runExp2(generateBalancedSequence(audioStimuli, CONFIG.EXP2_PRACTICE, true), 'practice');
    experimentTimeline.push({ 
    type: 'html-keyboard-response', 
    stimulus: `
        <div class="instructions">
            <h2>练习阶段结束</h2>
            <div style="text-align: left; margin: 30px 0; line-height: 1.8; font-size: 18px; color: #34495e;">
                本部分正式实验共包含 <b style="color:#e67e22;">120</b> 个试次，耗时较长。为了保证实验结果的准确性，请在接下来的过程中保持专注。<br><br>
                <span style="color: #2980b9;"><b>提示：</b>如果您感到眼睛酸痛或注意力下降，请在此页面稍作休息（建议 15-30 秒），待状态恢复后，再按下 <b>空格键</b> 进入正式实验。</span>
            </div>
        </div>`, 
    choices: [' ']
});
    runExp2(generateBalancedSequence(audioStimuli, CONFIG.EXP2_FORMAL, true), 'formal');

    // 结束页
    experimentTimeline.push({
        type: 'html-keyboard-response',
        stimulus: '',
        choices: jsPsych.NO_KEYS,
        on_start: function() {
            const data = jsPsych.data.get().filter({phase: 'formal'});
            const meanRt = Math.round(data.select('rt').mean()) || 0;
            const accuracy = Math.round(jsPsych.data.get().filter({task: 'exp2', phase: 'formal'}).select('acc').mean() * 100) || 0;
            document.getElementById('experiment-container').innerHTML = `
                <div class="instructions">
                    <h1>🎉 实验圆满完成</h1>
                    <div class="indent-text">衷心感谢您的参与！您的数据对学术研究具有重要价值。</div>
                    <div style="background:#f8f9fa; padding:25px; border-radius:15px; margin:25px 0; text-align:left; border: 1px solid #ddd;">
                        <p style="font-size:18px; margin-bottom:10px;"><b>实验概要统计：</b></p>
                        <p>· 平均反应时 (Mean RT): <b>${meanRt} ms</b></p>
                        <p>· 判断正确率 (Accuracy): <b>${accuracy} %</b></p>
                        <p>· 被试学号: ${window.participantInfo.id}</p>
                    </div>
                    <button class="btn-start" style="width:250px;" onclick="downloadData()">📥 点击下载结果 (CSV)</button>
                </div>`;
        }
    });
}

window.downloadData = () => {
    const csv = jsPsych.data.get().csv();
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Result_${window.participantInfo.id}.csv`;
    a.click();
};
// ---------- 核心变量 ----------
let timeLeft = 40 * 60;          // 默认40分钟（秒）
let timerId = null;
let isRunning = false;

// 模式与时长
let currentMode = 'focus';       // 'focus' 或 'break'
let selectedFocus = 40;          // 默认专注40分钟
let selectedBreak = 5;           // 默认休息5分钟

// 通知设置
let vibrateEnabled = true;       // 震动
let ringEnabled = true;          // 铃声
let ringAudio = null;            // 存储用户上传的Audio对象或Blob URL
let ringFileName = '';           // 用于显示文件名

// DOM 元素
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const todayStatEl = document.getElementById('todayStat');
const monthStatEl = document.getElementById('monthStat');
const yearStatEl = document.getElementById('yearStat');
const messageEl = document.getElementById('message');

// 模式 & 时长相关DOM
const modeFocusBtn = document.getElementById('modeFocusBtn');
const modeBreakBtn = document.getElementById('modeBreakBtn');
const focusDurationSection = document.getElementById('focusDurationSection');
const breakDurationSection = document.getElementById('breakDurationSection');
const focusDurationBtns = document.querySelectorAll('.focus-duration');
const breakDurationBtns = document.querySelectorAll('.break-duration');

// 通知相关DOM
const vibrateCheck = document.getElementById('vibrateCheck');
const ringCheck = document.getElementById('ringCheck');
const ringFileInput = document.getElementById('ringFile');
const ringFileNameSpan = document.getElementById('ringFileName');
const playTestBtn = document.getElementById('playTestBtn');
const clearRingBtn = document.getElementById('clearRingBtn');
const notifMessage = document.getElementById('notifMessage');

// ---------- 存储与统计（沿用之前）----------
const STORAGE_KEY = 'pomodoro_stats';
const NOTIF_KEY = 'pomodoro_notif';   // 存储通知设置和铃声数据

function getTodayStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getStats() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
}

function saveStats(stats) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function addTodayMinutes(minutes) {
    const today = getTodayStr();
    const stats = getStats();
    stats[today] = (stats[today] || 0) + minutes;
    saveStats(stats);
    updateStatsUI();
}

function formatMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
}

function updateStatsUI() {
    const stats = getStats();
    const todayStr = getTodayStr();
    const currentYear = todayStr.slice(0, 4);
    const currentMonth = todayStr.slice(0, 7);

    let todayTotal = 0, monthTotal = 0, yearTotal = 0;
    for (const [dateStr, minutes] of Object.entries(stats)) {
        if (dateStr === todayStr) todayTotal += minutes;
        if (dateStr.startsWith(currentMonth)) monthTotal += minutes;
        if (dateStr.startsWith(currentYear)) yearTotal += minutes;
    }
    todayStatEl.textContent = formatMinutes(todayTotal);
    monthStatEl.textContent = formatMinutes(monthTotal);
    yearStatEl.textContent = formatMinutes(yearTotal);
}

// ---------- 通知设置存储 ----------
function saveNotifSettings() {
    const settings = {
        vibrate: vibrateEnabled,
        ring: ringEnabled,
        ringData: ringAudio ? ringAudio.src : null,      // 存储Blob URL或Base64
        ringFileName: ringFileName
    };
    // 如果ringAudio是Blob URL，我们需要存储实际的音频数据，因为URL刷新后失效。
    // 这里采用：如果用户上传了文件，我们将文件内容转为Base64字符串存储。
    // 但当前ringAudio可能是一个Blob URL，我们需要在保存时提取Blob。
    // 为了简化，我们在上传时就将文件转为Base64存储到localStorage，并生成Audio对象。
    // 所以ringAudio应该是一个Audio对象，其src是Base64或Blob URL。
    // 保存时，我们存储Base64字符串和文件名。
    // 由于我们已经在文件上传处理中把Base64存入了localStorage，所以这里不需要再存。
    // 我们只需要存储设置选项和文件名即可，音频数据由单独键存储。
    localStorage.setItem(NOTIF_KEY, JSON.stringify({
        vibrate: vibrateEnabled,
        ring: ringEnabled,
        ringFileName: ringFileName
    }));
}

function loadNotifSettings() {
    const saved = localStorage.getItem(NOTIF_KEY);
    if (saved) {
        const { vibrate, ring, ringFileName: name } = JSON.parse(saved);
        vibrateEnabled = vibrate ?? true;
        ringEnabled = ring ?? true;
        ringFileName = name || '';
        vibrateCheck.checked = vibrateEnabled;
        ringCheck.checked = ringEnabled;
        ringFileNameSpan.textContent = ringFileName;
    }
    // 加载铃声Base64
    const ringBase64 = localStorage.getItem('pomodoro_ring_base64');
    if (ringBase64) {
        try {
            // 将Base64转为Blob URL
            const byteCharacters = atob(ringBase64.split(',')[1] || ringBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'audio/mpeg' }); // 类型可能不准，但一般可用
            const url = URL.createObjectURL(blob);
            ringAudio = new Audio(url);
            ringAudio.addEventListener('ended', () => URL.revokeObjectURL(url)); // 可选
        } catch (e) {
            console.warn('加载铃声失败', e);
            localStorage.removeItem('pomodoro_ring_base64');
        }
    }
}

// 处理铃声上传
function handleRingFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 检查文件大小（限制10MB）
    if (file.size > 10 * 1024 * 1024) {
        notifMessage.textContent = '文件过大，请选择小于10MB的音频';
        return;
    }

    ringFileName = file.name;
    ringFileNameSpan.textContent = ringFileName;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result; // Data URL 格式: data:audio/mpeg;base64,...
        // 存储Base64
        localStorage.setItem('pomodoro_ring_base64', base64Data);
        // 创建Audio对象
        ringAudio = new Audio(base64Data);
        notifMessage.textContent = '铃声已加载';
        saveNotifSettings(); // 保存文件名等
    };
    reader.readAsDataURL(file);
}

// 试听铃声
function testRing() {
    if (ringAudio) {
        ringAudio.currentTime = 0;
        ringAudio.play().catch(e => {
            notifMessage.textContent = '无法播放，请检查文件格式';
        });
    } else {
        notifMessage.textContent = '没有可用的铃声';
    }
}

// 清除铃声
function clearRing() {
    ringAudio = null;
    ringFileName = '';
    ringFileNameSpan.textContent = '';
    localStorage.removeItem('pomodoro_ring_base64');
    localStorage.removeItem(NOTIF_KEY); // 清除设置？只清除音频相关
    // 重新保存当前设置（不含音频）
    saveNotifSettings();
    notifMessage.textContent = '铃声已清除';
}

// 计时结束时的通知
function notifyComplete() {
    // 震动
    if (vibrateEnabled && navigator.vibrate) {
        navigator.vibrate(500); // 震动500ms
    }

    // 铃声
    if (ringEnabled && ringAudio) {
        ringAudio.currentTime = 0;
        ringAudio.play().catch(e => console.warn('播放失败', e));
    } else if (ringEnabled && !ringAudio) {
        // 如果没有上传铃声，可以播放一个简单的Web Audio提示音？或者忽略
        // 为了体验，可以简单用console提醒
        console.log('铃声未设置');
    }
}

// ---------- 计时器核心逻辑（修改结束处理）----------
function updateTimerDisplay() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    minutesEl.textContent = String(mins).padStart(2, '0');
    secondsEl.textContent = String(secs).padStart(2, '0');
}

function setTimeByMode() {
    if (currentMode === 'focus') {
        timeLeft = selectedFocus * 60;
    } else {
        timeLeft = selectedBreak * 60;
    }
    updateTimerDisplay();
}

function switchMode(mode) {
    if (mode === currentMode) return;

    modeFocusBtn.classList.toggle('active', mode === 'focus');
    modeBreakBtn.classList.toggle('active', mode === 'break');
    focusDurationSection.style.display = mode === 'focus' ? 'block' : 'none';
    breakDurationSection.style.display = mode === 'break' ? 'block' : 'none';
    currentMode = mode;

    if (isRunning) {
        clearInterval(timerId);
        timerId = null;
        isRunning = false;
    }
    setTimeByMode();
    messageEl.textContent = `🍽️ 切换到 ${mode === 'focus' ? '专注' : '休息'} 模式`;
}

function handleTimerComplete() {
    clearInterval(timerId);
    timerId = null;
    isRunning = false;

    // 触发通知（震动/铃声）
    notifyComplete();

    if (currentMode === 'focus') {
        addTodayMinutes(selectedFocus);
        messageEl.textContent = '🎉 专注完成！开始休息～';
        switchMode('break');
        startTimer(); // 自动开始休息
    } else {
        messageEl.textContent = '☕ 休息结束，继续专注吧！';
        switchMode('focus');
        startTimer();
    }
}

function startTimer() {
    if (isRunning) return;
    if (timeLeft <= 0) setTimeByMode();
    timerId = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            handleTimerComplete();
        }
    }, 1000);
    isRunning = true;
    messageEl.textContent = currentMode === 'focus' ? '🍅 专注中...' : '☕ 休息中...';
}

function pauseTimer() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
        isRunning = false;
        messageEl.textContent = '⏸ 已暂停';
    }
}

function resetTimer() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
        isRunning = false;
    }
    setTimeByMode();
    messageEl.textContent = '↺ 已重置';
}

// ---------- 时长选择 ----------
function initDurationButtons() {
    focusDurationBtns.forEach(btn => {
        const mins = parseInt(btn.dataset.focus, 10);
        if (mins === selectedFocus) btn.classList.add('active');
        btn.addEventListener('click', function() {
            focusDurationBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedFocus = parseInt(this.dataset.focus, 10);
            if (currentMode === 'focus' && !isRunning) setTimeByMode();
            messageEl.textContent = `专注时长设为 ${selectedFocus} 分钟`;
        });
    });

    breakDurationBtns.forEach(btn => {
        const mins = parseInt(btn.dataset.break, 10);
        if (mins === selectedBreak) btn.classList.add('active');
        btn.addEventListener('click', function() {
            breakDurationBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedBreak = parseInt(this.dataset.break, 10);
            if (currentMode === 'break' && !isRunning) setTimeByMode();
            messageEl.textContent = `休息时长设为 ${selectedBreak} 分钟`;
        });
    });
}

// ---------- 初始化 ----------
function init() {
    // 加载通知设置和铃声
    loadNotifSettings();

    // 时长按钮
    initDurationButtons();

    // 模式切换
    modeFocusBtn.addEventListener('click', () => switchMode('focus'));
    modeBreakBtn.addEventListener('click', () => switchMode('break'));

    // 控制按钮
    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    resetBtn.addEventListener('click', resetTimer);

    // 通知复选框
    vibrateCheck.addEventListener('change', function() {
        vibrateEnabled = this.checked;
        saveNotifSettings();
    });
    ringCheck.addEventListener('change', function() {
        ringEnabled = this.checked;
        saveNotifSettings();
    });

    // 文件上传
    ringFileInput.addEventListener('change', handleRingFileUpload);
    playTestBtn.addEventListener('click', testRing);
    clearRingBtn.addEventListener('click', clearRing);

    // 初始模式
    switchMode('focus');

    // 统计
    updateStatsUI();
}

window.addEventListener('DOMContentLoaded', init);
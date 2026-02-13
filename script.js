// ---------- 核心变量 ----------
let timeLeft = 40 * 60;          // 默认40分钟（秒）
let timerId = null;
let isRunning = false;

// ---------- 新增：模式与时长设置 ----------
let currentMode = 'focus';       // 'focus' 或 'break'
let selectedFocus = 40;         // 默认专注40分钟
let selectedBreak = 5;         // 默认休息5分钟

// DOM 元素（原有）
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const todayStatEl = document.getElementById('todayStat');
const monthStatEl = document.getElementById('monthStat');
const yearStatEl = document.getElementById('yearStat');
const messageEl = document.getElementById('message');

// ===== 新增：模式 & 时长相关DOM =====
const modeFocusBtn = document.getElementById('modeFocusBtn');
const modeBreakBtn = document.getElementById('modeBreakBtn');
const focusDurationSection = document.getElementById('focusDurationSection');
const breakDurationSection = document.getElementById('breakDurationSection');
const focusDurationBtns = document.querySelectorAll('.focus-duration');
const breakDurationBtns = document.querySelectorAll('.break-duration');

// ---------- 存储与统计（完全沿用原逻辑）----------
const STORAGE_KEY = 'pomodoro_stats';

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

// ---------- 计时器核心逻辑（大幅修改）----------
function updateTimerDisplay() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    minutesEl.textContent = String(mins).padStart(2, '0');
    secondsEl.textContent = String(secs).padStart(2, '0');
}

// 根据当前模式设置 timeLeft（不自动开始）
function setTimeByMode() {
    if (currentMode === 'focus') {
        timeLeft = selectedFocus * 60;
    } else {
        timeLeft = selectedBreak * 60;
    }
    updateTimerDisplay();
}

// 切换模式（手动点击专注/休息按钮）
function switchMode(mode) {
    if (mode === currentMode) return; // 已在当前模式

    // 更新按钮激活状态
    modeFocusBtn.classList.toggle('active', mode === 'focus');
    modeBreakBtn.classList.toggle('active', mode === 'break');

    // 显示/隐藏对应的时长设置区域
    focusDurationSection.style.display = mode === 'focus' ? 'block' : 'none';
    breakDurationSection.style.display = mode === 'break' ? 'block' : 'none';

    // 更新当前模式
    currentMode = mode;

    // 停止正在运行的计时器
    if (isRunning) {
        clearInterval(timerId);
        timerId = null;
        isRunning = false;
    }

    // 重置时间为新模式对应的时长
    setTimeByMode();
    messageEl.textContent = `🍽️ 切换到 ${mode === 'focus' ? '专注' : '休息'} 模式`;
}

// 计时结束处理（自动切换模式并开始下一个）
function handleTimerComplete() {
    clearInterval(timerId);
    timerId = null;
    isRunning = false;

    if (currentMode === 'focus') {
        // ✅ 只有专注完成才累加时长
        addTodayMinutes(selectedFocus);
        messageEl.textContent = '🎉 专注完成！开始休息～';
        // 自动切换到休息模式
        switchMode('break');
        // 自动开始休息倒计时
        startTimer();
    } else {
        // 休息结束，自动切回专注
        messageEl.textContent = '☕ 休息结束，继续专注吧！';
        switchMode('focus');
        startTimer();
    }
}

function startTimer() {
    if (isRunning) return;
    // 如果时间已经归零（一般不会），重置为当前模式时长
    if (timeLeft <= 0) {
        setTimeByMode();
    }
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
    setTimeByMode();  // 重置为当前模式的默认时长
    messageEl.textContent = '↺ 已重置';
}

// ---------- 新增：时长选择交互 ----------
// 初始化时长按钮状态（高亮当前选中）
function initDurationButtons() {
    // 专注时长按钮
    focusDurationBtns.forEach(btn => {
        const mins = parseInt(btn.dataset.focus, 10);
        if (mins === selectedFocus) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
        btn.addEventListener('click', function(e) {
            // 移除其他专注按钮的高亮
            focusDurationBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedFocus = parseInt(this.dataset.focus, 10);
            // 如果当前是专注模式且计时器未运行，立即更新显示时长
            if (currentMode === 'focus' && !isRunning) {
                setTimeByMode();
            }
            messageEl.textContent = `专注时长设为 ${selectedFocus} 分钟`;
        });
    });

    // 休息时长按钮
    breakDurationBtns.forEach(btn => {
        const mins = parseInt(btn.dataset.break, 10);
        if (mins === selectedBreak) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
        btn.addEventListener('click', function(e) {
            breakDurationBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedBreak = parseInt(this.dataset.break, 10);
            if (currentMode === 'break' && !isRunning) {
                setTimeByMode();
            }
            messageEl.textContent = `休息时长设为 ${selectedBreak} 分钟`;
        });
    });
}

// ---------- 初始化 & 事件绑定 ----------
function init() {
    // 时长按钮初始化
    initDurationButtons();

    // 模式切换按钮
    modeFocusBtn.addEventListener('click', () => switchMode('focus'));
    modeBreakBtn.addEventListener('click', () => switchMode('break'));

    // 控制按钮（沿用原逻辑）
    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    resetBtn.addEventListener('click', resetTimer);

    // 设置初始模式（专注）
    switchMode('focus');  // 会触发UI更新、时间设置

    // 更新累计统计
    updateStatsUI();
}

window.addEventListener('DOMContentLoaded', init);
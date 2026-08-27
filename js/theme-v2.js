/**
 * V2 主题引擎 theme-v2.js（P1 R1 · v77 · 夜间调度精确化）
 * ------------------------------------------------------------
 * 职责（只做 UI 层，不碰业务逻辑）：
 *   1. 三态主题：浅色 light（默认）/ 暗色 dark（审美）/ 夜间 night（生理）
 *   2. 时段调度：22:00–06:00 自动进入夜间模式（默认 auto，可关闭/自定义）
 *   3. 心情主题：宝宝/妈妈今日心情中"更需安抚的一方"（sick > angry > sad
 *      > sleepy > calm > happy/excited）驱动 data-mood-theme，只动 accent
 *      与类别槽位；状态语义色为系统级稳定色，不随心情变化
 *   4. meta theme-color 同步：夜间/暗色时接管为背景色；浅色时让位 V1
 *      Utils.applyTheme（它负责 --primary 三变量 + 顶栏背景）
 * R1 变更（规格书 §2.3）：
 *   - 调度：setInterval 分钟轮询 → setTimeout 边界精确调度（scheduleNext/
 *     nextBoundary/nextTimeAt），边界误差 ≤1s；visibilitychange 兜底保留
 *   - 手动三选：manualTheme = 'auto' | 'light' | 'dark'（V2 设置页三选，
 *     替代 V1 6 色板在 v2 通道的展示）
 *   - 临时覆盖：nightOverrideUntil（ms 时间戳）持久化；夜间窗口内手动切
 *     浅色 → 自动写 10 分钟临时覆盖，到期由调度自动回 night；apply() 顺带
 *     清理已过期覆盖
 *   - 新 API：isNightTime() / scheduleBoundary() / applyTempOverride() /
 *     setManualTheme()（见下方 API 清单）
 * 兼容性：
 *   - 独立自执行，零依赖（不依赖 config.js / utils.js，可在最前加载）
 *   - 与 V1 applyTheme / applyTextSize 完全并存，互不覆盖
 *   - 设置存 localStorage 'babycare_uiSettings'，与 Utils.storage 同前缀
 * 命名说明：由 theme.js 改名而来（规格书 §1 文件命名对齐）；对外命名空间
 *   由 window.V2.theme 升级为 window.ThemeV2（全站无 V2.theme 业务引用，
 *   改名安全）。
 * ------------------------------------------------------------
 * 对外 API：window.ThemeV2
 *   refresh()                立即按当前设置重算主题（并重新排程）
 *   setNightMode('auto'|'on'|'off')   夜间模式开关（设置页接入）
 *   setNightWindow(start,end)         自定义夜间时段（0-23）
 *   setMoodTheme(true|false)          心情主题开关
 *   setManualTheme('auto'|'light'|'dark')  手动三选（夜间窗口内选 light
 *                                          自动带 10 分钟临时覆盖）
 *   applyTempOverride(themeKey, minutes)   显式临时覆盖（默认 10 分钟）
 *   isNightTime()                当前是否处于夜间时段窗口（与开关无关）
 *   scheduleBoundary()           下一个需重新计算主题的时刻（ms，null=无）
 *   getMode() / getMoodTheme()   当前生效值
 *   settings()                   当前设置快照
 */
(function () {
  'use strict';

  var LS_PREFIX = 'babycare_';
  var LS_SETTINGS = 'uiSettings';

  // 临时覆盖默认时长（分钟）——夜间手动切浅色后自动恢复
  var OVERRIDE_DEFAULT_MIN = 10;

  // 夜间模式默认设置
  var DEFAULTS = {
    nightMode: 'auto',   // auto | on | off
    nightStart: 22,      // 22:00
    nightEnd: 6,         // 06:00
    moodTheme: true,     // 心情主题开关
    manualTheme: 'auto'  // 手动三选：auto | light | dark（R1 新增）
  };

  // 心情 → 安抚权重（越大越需安抚）。用于"取更需安抚的一方"
  // v95 #8：并入首页心情头像 key（sleeping/playful/thinking/surprised），两套 key 统一可查
  var MOOD_WEIGHT = {
    sick: 4, angry: 3, sad: 2.5, sleepy: 2,
    calm: 1, happy: 0.5, excited: 0.5,
    sleeping: 2, thinking: 1.5, playful: 1, surprised: 1.5
  };

  // 心情 → 主题场景映射
  var MOOD_THEME_MAP = {
    happy: 'happy', excited: 'happy', playful: 'happy',
    calm: 'calm', thinking: 'calm', surprised: 'calm',
    sleepy: 'sleepy', sleeping: 'sleepy',
    sad: 'sick', sick: 'sick',   // 难过并入"生病不适"柔绿安抚
    angry: 'angry'
  };

  // 夜间与深色同值（规格书决策①：视觉一致、语义不同，差异全在 JS 调度）
  var NIGHT_THEME_COLOR = '#1C1A17';
  var DARK_THEME_COLOR = '#1C1A17';
  // 浅色 theme-color = 暖米白（tokens :root --color-bg-base）。v2 下 meta 由本
  // 引擎全权接管（v1 下 applyTheme 负责，本文件不加载，互不冲突）
  var LIGHT_THEME_COLOR = '#FAF8F5';

  /** ===== 本地存储（与 Utils.storage 同前缀 babycare_） ===== */
  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(LS_PREFIX + key));
    } catch (e) { return null; }
  }
  function write(key, val) {
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(val)); }
    catch (e) { /* 隐私模式等场景静默降级 */ }
  }

  function getSettings() {
    var s = read(LS_SETTINGS) || {};
    // 只取已知字段，防脏数据
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = (s[k] !== undefined) ? s[k] : DEFAULTS[k];
    });
    // 运行时字段：临时覆盖截止（R1 新增，可能不存在；过滤非正脏值）
    if (s.nightOverrideUntil && s.nightOverrideUntil > 0) {
      out.nightOverrideUntil = s.nightOverrideUntil;
    }
    return out;
  }

  /** ===== 今日日期 YYYY-MM-DD（与 Utils.todayStr 一致） ===== */
  function todayStr() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  /** ===== 时段判断：支持跨午夜区间（如 22:00-06:00） ===== */
  function inNightWindow(start, end) {
    var h = new Date().getHours();
    if (start === end) return false; // 0 长度窗口视为关闭
    if (start < end) return h >= start && h < end;
    return h >= start || h < end;    // 跨午夜
  }

  /** ===== 下一个整点时刻（ms）：hour:00:00，已过则取次日 ===== */
  function nextTimeAt(hour, from) {
    var d = new Date(from);
    d.setHours(hour, 0, 0, 0);
    if (d.getTime() <= from) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  /** ===== 下一个窗口边界（ms）：窗口开始/结束中较近者 ===== */
  function nextBoundary(start, end) {
    var t = Date.now();
    return Math.min(nextTimeAt(start, t), nextTimeAt(end, t));
  }

  /** ===== 下一个需要重新计算主题的事件时刻（ms；无则 null） ===== */
  function nextEventTs(settings) {
    var events = [];
    // 1. 临时覆盖到期
    if (settings.nightOverrideUntil && settings.nightOverrideUntil > Date.now()) {
      events.push(settings.nightOverrideUntil);
    }
    // 2. 窗口边界（nightMode=off 永远 light、manualTheme=dark 永远 dark，无需关注）
    if (settings.nightMode !== 'off' && settings.manualTheme !== 'dark') {
      events.push(nextBoundary(settings.nightStart, settings.nightEnd));
    }
    return events.length ? Math.min.apply(null, events) : null;
  }

  /** ===== 计算主题模式（R1：手动三选优先 + 临时覆盖时限） ===== */
  function computeMode(settings) {
    var overrideActive = !!(settings.nightOverrideUntil &&
      settings.nightOverrideUntil > Date.now());

    // 手动深色：最优先、永久（不受时段/开关影响）
    if (settings.manualTheme === 'dark') return 'dark';

    // 手动浅色：夜间窗口内受 10 分钟临时覆盖约束，窗口外永久
    if (settings.manualTheme === 'light') {
      if (settings.nightMode !== 'off' &&
        inNightWindow(settings.nightStart, settings.nightEnd)) {
        return overrideActive ? 'light' : 'night';
      }
      return 'light';
    }

    // 自动（默认）：跟随夜间开关与时段
    if (settings.nightMode === 'on') return 'night';
    if (settings.nightMode === 'off') return 'light';
    return inNightWindow(settings.nightStart, settings.nightEnd) ? 'night' : 'light';
  }

  /** ===== 心情主题：取更需安抚的一方 ===== */
  function computeMoodTheme() {
    var babyMoods = read('moodData') || {};
    var momMoods = read('momMoodData') || {};
    // v95 #8：setTodayMood/setMomMood 存的是 {key,label,emoji} 对象（旧数据可能是字符串 key）
    var pickKey = function (v) { return (v && typeof v === 'object') ? v.key : v; };
    var baby = pickKey(babyMoods[todayStr()]) || null;
    var mom = pickKey(momMoods[todayStr()]) || null;
    var wb = baby && MOOD_WEIGHT[baby] ? MOOD_WEIGHT[baby] : 0;
    var wm = mom && MOOD_WEIGHT[mom] ? MOOD_WEIGHT[mom] : 0;
    var dominant = wm > wb ? mom : baby; // 权重更高者主导（相等时宝宝优先）
    return dominant && MOOD_THEME_MAP[dominant] ? MOOD_THEME_MAP[dominant] : null;
  }

  /** ===== 应用主题 ===== */
  function apply() {
    var root = document.documentElement;
    if (!root) return;

    var settings = getSettings();
    var now = Date.now();

    // 清理已过期临时覆盖，避免脏数据累积
    if (settings.nightOverrideUntil && settings.nightOverrideUntil <= now) {
      delete settings.nightOverrideUntil;
      write(LS_SETTINGS, settings);
    }

    // 1. 三态主题
    var mode = computeMode(settings);
    root.setAttribute('data-theme', mode);

    // 2. 心情主题
    if (settings.moodTheme) {
      var mood = computeMoodTheme();
      if (mood) root.setAttribute('data-mood-theme', mood);
      else root.removeAttribute('data-mood-theme');
    } else {
      root.removeAttribute('data-mood-theme');
    }

    // 3. meta theme-color：三态全接管（浅色=暖米白，与页面融合）
    //    v2 下 applyTheme 已让位（见 utils.js），此值全权负责状态栏配色
    var meta = document.getElementById('meta-theme-color');
    if (meta) {
      meta.setAttribute('content',
        mode === 'night' ? NIGHT_THEME_COLOR :
        mode === 'dark'  ? DARK_THEME_COLOR  : LIGHT_THEME_COLOR);
    }
  }

  /** ===== R1：setTimeout 边界精确调度（替换原 setInterval 分钟轮询） ===== */
  var _timer = null;

  function scheduleNext() {
    if (_timer !== null) { clearTimeout(_timer); _timer = null; }
    var next = nextEventTs(getSettings());
    if (!next) return; // 无需调度（如夜间模式关闭且无覆盖）
    // +50ms 余量 + 下限 1s，防止边界抖动与极端 0 延迟
    var delay = Math.max(1000, next - Date.now() + 50);
    _timer = setTimeout(function () {
      _timer = null;
      apply();
      scheduleNext(); // 事件触发后重新计算下一边界
    }, delay);
  }

  /** ===== 启动 ===== */
  function init() {
    // R2：长辈模式属性恢复（seniorMode 持久化 → html[data-senior="on"]，
    //     仅设置属性，字号由用户选择/开关联动，不强制覆盖）
    if (document.documentElement && window.Utils && Utils.isSeniorMode()) {
      document.documentElement.setAttribute('data-senior', 'on');
    }
    // 立即应用（防止首帧闪白/闪亮）
    if (document.documentElement) apply();
    // R1：边界精确调度（跨午夜切换由下一边界事件驱动）
    scheduleNext();
    // 页面恢复可见时刷新（bfcache / 切后台回来；后台 setTimeout 可能被节流）
    if (document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { apply(); scheduleNext(); }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /** ===== 对外 API ===== */
  window.ThemeV2 = {
    refresh: function () { apply(); scheduleNext(); },
    setNightMode: function (mode) {
      var s = getSettings();
      s.nightMode = (mode === 'on' || mode === 'off') ? mode : 'auto';
      if (s.nightMode === 'off') delete s.nightOverrideUntil; // 关闭夜间则清临时覆盖
      write(LS_SETTINGS, s);
      apply(); scheduleNext();
    },
    setNightWindow: function (start, end) {
      var s = getSettings();
      s.nightStart = Math.max(0, Math.min(23, Number(start) || 22));
      s.nightEnd = Math.max(0, Math.min(23, Number(end) || 6));
      write(LS_SETTINGS, s);
      apply(); scheduleNext();
    },
    setMoodTheme: function (on) {
      var s = getSettings();
      s.moodTheme = !!on;
      write(LS_SETTINGS, s);
      apply(); scheduleNext();
    },
    /** R1：手动三选。夜间窗口内选 light → 自动写 10 分钟临时覆盖，到期回 night */
    setManualTheme: function (themeKey) {
      var s = getSettings();
      if (themeKey === 'dark') {
        s.manualTheme = 'dark';
        delete s.nightOverrideUntil;
      } else if (themeKey === 'light') {
        s.manualTheme = 'light';
        if (s.nightMode !== 'off' &&
          inNightWindow(s.nightStart, s.nightEnd)) {
          s.nightOverrideUntil = Date.now() + OVERRIDE_DEFAULT_MIN * 60 * 1000;
        } else {
          delete s.nightOverrideUntil;
        }
      } else {
        s.manualTheme = 'auto';
        delete s.nightOverrideUntil;
      }
      write(LS_SETTINGS, s);
      apply(); scheduleNext();
    },
    /** R1：显式临时覆盖（默认 10 分钟；dark 也受时限，到期回 auto 计算值） */
    applyTempOverride: function (themeKey, minutes) {
      var s = getSettings();
      var m = Math.max(1, Math.min(720, Number(minutes) || OVERRIDE_DEFAULT_MIN));
      s.manualTheme = (themeKey === 'dark') ? 'dark' : 'light';
      s.nightOverrideUntil = Date.now() + m * 60 * 1000;
      write(LS_SETTINGS, s);
      apply(); scheduleNext();
    },
    /** R1：当前是否处于夜间时段窗口（纯窗口判断，与 nightMode 开关无关） */
    isNightTime: function () {
      var s = getSettings();
      return inNightWindow(s.nightStart, s.nightEnd);
    },
    /** R1：下一个需重新计算主题的时刻（ms 时间戳；无则 null） */
    scheduleBoundary: function () {
      return nextEventTs(getSettings());
    },
    getMode: function () {
      return document.documentElement ? document.documentElement.getAttribute('data-theme') : 'light';
    },
    getMoodTheme: function () {
      return document.documentElement ? document.documentElement.getAttribute('data-mood-theme') : null;
    },
    settings: getSettings
  };
})();

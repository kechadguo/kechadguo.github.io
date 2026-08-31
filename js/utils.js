/**
 * 工具函数模块
 */

/** querySelectorAll 简写 */
window.$$ = (sel, parent) => (parent || document).querySelectorAll(sel);

window.Utils = {
  /** 格式化日期 */
  formatDate(date, fmt = 'YYYY-MM-DD') {
    if (!date) return '';
    const d = new Date(date);
    const map = {
      YYYY: d.getFullYear(),
      MM: String(d.getMonth() + 1).padStart(2, '0'),
      DD: String(d.getDate()).padStart(2, '0'),
      HH: String(d.getHours()).padStart(2, '0'),
      mm: String(d.getMinutes()).padStart(2, '0'),
      ss: String(d.getSeconds()).padStart(2, '0')
    };
    return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, m => map[m]);
  },

  /** HTML 转义（防 XSS：用户输入拼接进 innerHTML 前必须调用） */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /** 属性内 JS 字符串转义（防 XSS：用户输入拼接进 onclick 等内联 JS 字符串参数前必须调用）
   * 先做 HTML 层转义（防 & " < > 突破双引号属性），再做 JS 层转义（防 \ ' 突破单引号字符串） */
  jsAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");
  },

  /** 获取今天的日期字符串 */
  todayStr() {
    return this.formatDate(new Date());
  },

  /**
   * 从 UTC ISO 字符串取本地日期（YYYY-MM-DD）
   * 云函数返回的 time/startTime 等 Date 字段经 JSON 序列化为 UTC ISO（如 2026-08-16T16:00:00.000Z）。
   * 直接 .slice(0,10) 会取到 UTC 日期，在 +08:00 时区凌晨时段（00:00-07:59）会错位到前一天，
   * 导致记录归入错误的日期，与本地日期范围 key 不匹配 → 历史数据"丢失"。
   * 本函数用本地时区 getFullYear/getMonth/getDate 正确还原本地日期。
   */
  localDateFromISO(isoStr) {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    return this.formatDate(d, 'YYYY-MM-DD');
  },

  /** 时间友好显示 */
  timeAgo(date) {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}天前`;
    return this.formatDate(date, 'MM-DD HH:mm');
  },

  /** 时间格式化 (HH:mm) */
  formatTime(date) {
    return this.formatDate(date, 'HH:mm');
  },

  /** 中文日期格式 (2026年8月6日) */
  formatDateCN(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  },

  /** 显示 Toast（v2 支持 type 语义三件套：success/error/info） */
  showToast(msg, duration = 2000, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    // v95 批次F：v2 通道 emoji 前缀 → Lucide 图标（v1 保持 emoji 风格，零回归）
    let rendered = false;
    if (window.__UI_V3__ && window.Lucide && typeof msg === 'string') {
      const m = msg.match(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}][\u{FE0F}\u{200D}\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]*(?:\s|$)/u);
      const name = m ? Lucide.emojiName(m[0].trim()) : null;
      if (name) {
        toast.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:6px">' +
          Lucide.icon(name, 18) + '<span>' + Utils.escapeHtml(msg.slice(m[0].length).trim() || msg) + '</span></span>';
        rendered = true;
      }
    }
    if (!rendered) toast.textContent = msg;
    // 清除上一次的类型类
    toast.classList.remove('toast-success', 'toast-error', 'toast-info');
    if (window.__UI_V3__ && type) {
      toast.classList.add('toast-' + type);
      // 按类型自动调整停留时长（仅当调用方未显式指定非默认值时）
      if (type === 'error' && duration === 2000) duration = 3000;
      if (type === 'success' && duration === 2000) duration = 1500;
    }
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), duration);
  },

  /** 显示/隐藏加载 */
  showLoading(msg = '加载中...') {
    const el = document.getElementById('loading');
    el.querySelector('p').textContent = msg;
    el.classList.remove('hidden');
  },
  hideLoading() {
    const el = document.getElementById('loading');
    el.classList.add('hidden');
    el.classList.remove('v2-processing');
  },

  /** R7 K6：有明确进度的处理（生成报表/AI 分析）→ 雾蓝三件套（v2 通道） */
  showProcessing(msg = '处理中...') {
    if (!window.__UI_V3__) return this.showLoading(msg);
    const el = document.getElementById('loading');
    el.classList.add('v2-processing');
    el.querySelector('p').textContent = msg;
    el.classList.remove('hidden');
  },

  /** R7 K1：统一空状态生成器（v2 通道插画化；v1 保持基础结构） */
  emptyState({ icon = '', title = '', desc = '', action = '', error = false } = {}) {
    const titleHTML = title ? `<p class="es-title">${title}</p>` : '';
    const descHTML = desc ? `<p class="es-desc">${desc}</p>` : '';
    const actionHTML = action ? `<div class="empty-actions">${action}</div>` : '';
    if (window.__UI_V3__) {
      const cls = error ? 'empty-state v2-empty empty-state--error' : 'empty-state v2-empty';
      return `<div class="${cls}"><div class="empty-icon">${icon}</div>${titleHTML}${descHTML}${actionHTML}</div>`;
    }
    return `<div class="empty-state"><div class="empty-icon">${icon}</div>${titleHTML}${descHTML}${actionHTML}</div>`;
  },

  /** R7 K4：骨架屏 HTML 生成器（v2 通道；>300ms 必出，bg-sunken 呼吸块） */
  skeletonHTML(kind = 'list') {
    if (!window.__UI_V3__) return '';
    const card = (lines) => `<div class="sk-card">${lines.map(w => `<div class="sk-line${w < 100 ? ' w' + w : ''}" style="width:${w}%"></div>`).join('')}</div>`;
    if (kind === 'dashboard') {
      return `<div class="v2-skeleton" aria-hidden="true">
        <div class="sk-hero"><div class="sk-circle"></div><div><div class="sk-line" style="width:72%"></div><div class="sk-line w50" style="width:50%"></div></div></div>
        ${card([100, 82])}${card([96, 70, 58])}${card([90, 52])}
      </div>`;
    }
    if (kind === 'report') {
      return `<div class="v2-skeleton" aria-hidden="true">
        <div class="sk-hero"><div class="sk-circle"></div><div><div class="sk-line" style="width:64%"></div></div></div>
        ${card([100, 100])}${card([100, 100, 88])}
      </div>`;
    }
    if (kind === 'food' || kind === 'exercise') {
      return `<div class="v2-skeleton" aria-hidden="true">
        <div class="sk-card" style="height:88px;border-radius:16px"></div>
        <div style="display:flex;gap:6px"><div class="sk-line" style="height:32px;width:60px;border-radius:8px"></div><div class="sk-line" style="height:32px;width:60px;border-radius:8px"></div><div class="sk-line" style="height:32px;width:60px;border-radius:8px"></div></div>
        ${card([100, 76])}${card([94, 66, 50])}${card([88, 58])}
      </div>`;
    }
    if (kind === 'early-edu') {
      return `<div class="v2-skeleton" aria-hidden="true">
        <div class="sk-card" style="height:96px;border-radius:16px"></div>
        <div class="sk-card" style="height:56px;border-radius:16px"></div>
        <div style="display:flex;gap:6px"><div class="sk-line" style="height:32px;width:56px;border-radius:8px"></div><div class="sk-line" style="height:32px;width:56px;border-radius:8px"></div></div>
        ${card([100, 82])}${card([96, 70])}${card([90, 60])}
      </div>`;
    }
    if (kind === 'parenting-lib') {
      return `<div class="v2-skeleton" aria-hidden="true">
        <div class="sk-card" style="height:80px;border-radius:16px"></div>
        <div class="sk-card" style="height:48px;border-radius:12px"></div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px"><div class="sk-line" style="height:60px;border-radius:12px"></div><div class="sk-line" style="height:60px;border-radius:12px"></div><div class="sk-line" style="height:60px;border-radius:12px"></div><div class="sk-line" style="height:60px;border-radius:12px"></div></div>
        ${card([100, 76])}${card([94, 66])}
      </div>`;
    }
    return `<div class="v2-skeleton" aria-hidden="true">${card([100, 76])}${card([94, 66])}${card([86, 54])}</div>`;
  },

  /** 计算宝宝周龄（从出生日期到指定日期） */
  calcWeeksAge(birthDateStr, targetDate = new Date()) {
    const birth = this._parseLocalDate(birthDateStr);
    const msDiff = targetDate - birth;
    return Math.floor(msDiff / (7 * 24 * 60 * 60 * 1000));
  },

  /** 获取月龄对应参考范围 */
  getAgeRef(weeksAge, refArray) {
    for (const ref of refArray) {
      if (weeksAge >= ref.weeksMin && weeksAge <= ref.weeksMax) {
        return ref;
      }
    }
    return refArray[refArray.length - 1] || null;
  },

  /** 获取喂养间隔提示 */
  getFeedingIntervalHint(birthDateStr) {
    const weeks = this.calcWeeksAge(birthDateStr);
    const ref = this.getAgeRef(weeks, APP_CONFIG.healthReference.feedingInterval);
    if (!ref) return '';
    return `${ref.intervalMin}-${ref.intervalMax} ${ref.unit}（${ref.note}）`;
  },

  /** 获取每日参考奶量提示 */
  getDailyMilkHint(birthDateStr) {
    const weeks = this.calcWeeksAge(birthDateStr);
    const ref = this.getAgeRef(weeks, APP_CONFIG.healthReference.dailyMilkRef);
    if (!ref) return '';
    return `${ref.mlMin}-${ref.mlMax} ml/次`;
  },

  /** 获取排便频率提示 */
  getStoolFreqHint(birthDateStr) {
    const weeks = this.calcWeeksAge(birthDateStr);
    const ref = this.getAgeRef(weeks, APP_CONFIG.healthReference.stoolRef);
    if (!ref) return '';
    return `每日 ${ref.min}-${ref.max} 次（${ref.note}）`;
  },

  /** 将日期字符串解析为本地时间（支持 YYYY-MM-DD 和 YYYY-MM-DDTHH:mm 两种格式） */
  _parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    if (dateStr.includes('T')) return new Date(dateStr);
    return new Date(dateStr + 'T00:00:00');
  },

  /** 格式化出生日期时间（有时间则显示，无则只显示日期） */
  formatBirthDateTime(dateStr) {
    if (!dateStr) return '';
    if (dateStr.includes('T')) {
      return this.formatDate(dateStr, 'YYYY-MM-DD HH:mm');
    }
    return this.formatDate(dateStr, 'YYYY-MM-DD');
  },

  /** 计算月龄 */
  calcMonthAge(birthDateStr, targetDate = new Date()) {
    const birth = this._parseLocalDate(birthDateStr);
    let months = (targetDate.getFullYear() - birth.getFullYear()) * 12 + (targetDate.getMonth() - birth.getMonth());
    if (targetDate.getDate() < birth.getDate()) months--;
    return Math.max(0, months);
  },

  /** 计算天数（中国传统计数：出生当天为第1天） */
  calcDaysAge(birthDateStr) {
    const birth = this._parseLocalDate(birthDateStr);
    birth.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((now - birth) / (24 * 60 * 60 * 1000)) + 1;
  },

  /** 月龄文本 — 精确到天 */
  monthAgeText(birthDateStr) {
    const months = this.calcMonthAge(birthDateStr);
    const birth = this._parseLocalDate(birthDateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    // 计算剩余天数
    let tempDate = new Date(birth);
    tempDate.setMonth(tempDate.getMonth() + months);
    tempDate.setHours(0, 0, 0, 0);
    const remainDays = Math.round((now - tempDate) / (24 * 60 * 60 * 1000));
    if (months < 1) {
      return `${remainDays}天`;
    }
    if (months < 12) {
      return `${months}个月${remainDays}天`;
    }
    const years = Math.floor(months / 12);
    const remainMonths = months % 12;
    return `${years}岁${remainMonths > 0 ? remainMonths + '个月' : ''}${remainDays > 0 ? remainDays + '天' : ''}`;
  },

  /** 获取月龄+天数结构 */
  calcMonthAgeToDays(birthDateStr) {
    const months = this.calcMonthAge(birthDateStr);
    const birth = this._parseLocalDate(birthDateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let tempDate = new Date(birth);
    tempDate.setMonth(tempDate.getMonth() + months);
    tempDate.setHours(0, 0, 0, 0);
    const remainDays = Math.round((now - tempDate) / (24 * 60 * 60 * 1000));
    return { months, days: remainDays, total: this.calcDaysAge(birthDateStr) };
  },

  /** 格式化时长（分钟→X小时Y分） */
  formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '0分钟';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m}分钟`;
    if (m === 0) return `${h}小时`;
    return `${h}小时${m}分`;
  },

  /** 格式化经过时间（秒级计时器用） */
  formatElapsed(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  /** 体温状态判断 */
  getTempStatus(temp) {
    const s = APP_CONFIG.tempStatus;
    if (temp < s.low.max) return { ...s.low, value: temp };
    if (temp < s.normal.max) return { ...s.normal, value: temp };
    if (temp < s.feverLow.max) return { ...s.feverLow, value: temp };
    return { ...s.feverHigh, value: temp };
  },

  /** 获取宝宝信息（缓存） */
  getBabyInfo() {
    return this.storage.get('baby') || {};
  },

  /** 更新宝宝信息（本地缓存） */
  setBabyInfo(info) {
    this.storage.set('baby', { ...this.getBabyInfo(), ...info });
  },

  /** 获取月龄对应的里程碑 */
  getBabyMilestones(birthDateStr) {
    const monthAge = this.calcMonthAge(birthDateStr);
    return getMilestoneByAge(monthAge);
  },

  /** 获取月龄对应的护理标准 */
  getBabyNursing(birthDateStr) {
    const monthAge = this.calcMonthAge(birthDateStr);
    return getNursingByAge(monthAge);
  },

  /** 获取月龄对应的疫苗（扁平化为单数组） */
  getBabyVaccines(birthDateStr) {
    const monthAge = this.calcMonthAge(birthDateStr);
    const result = getVaccineByAge(monthAge);
    const all = [];
    for (const item of (result.passed || [])) {
      for (const v of (item.vaccines || [])) all.push(v);
    }
    if (result.current && result.current.vaccines) {
      for (const v of result.current.vaccines) all.push(v);
    }
    for (const item of (result.upcoming || [])) {
      for (const v of (item.vaccines || [])) all.push(v);
    }
    return all;
  },

  /** 获取月龄对应的营养建议 */
  getBabyNutrition(birthDateStr) {
    const monthAge = this.calcMonthAge(birthDateStr);
    return getNutritionByAge(monthAge);
  },

  /** ===== 主题颜色 ===== */
  applyTheme(themeKey) {
    // V2 通道下主题色由 tokens.css 变量桥接管（--primary → --color-accent 珊瑚橘），
    // meta/顶栏由 theme-v2.js 负责；这里只保存用户选择，v1 回滚时恢复原行为
    if (window.__UI_V3__) {
      this.storage.set('theme', themeKey);
      return;
    }
    const theme = APP_CONFIG.themeColors.find(t => t.key === themeKey) || APP_CONFIG.themeColors[0];
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-dark', theme.primaryDark);
    root.style.setProperty('--primary-light', theme.primaryLight);
    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) metaTheme.setAttribute('content', theme.primary);
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.style.background = theme.primary;
    this.storage.set('theme', themeKey);
  },

  getTheme() {
    return this.storage.get('theme') || 'blue';
  },

  /** ===== 文字大小 ===== */
  applyTextSize(sizeKey) {
    const size = APP_CONFIG.textSizes.find(s => s.key === sizeKey) || APP_CONFIG.textSizes[1];
    document.documentElement.style.fontSize = size.baseFont;
    this.storage.set('textSize', sizeKey);
  },

  getTextSize() {
    return this.storage.get('textSize') || 'medium';
  },

  /** ===== 长辈模式（R2）：开关持久化 + data-senior 属性 + 联动 elder 字号 =====
   * on=true  时：写入 seniorMode=true、html[data-senior="on"]、记住当前字号到
   *              seniorPrevTextSize、字号切 elder（推荐档）。
   * on=false 时（v96 需求 #4）：写入 false、移除属性、字号回退到开启前的档位
   *              （seniorPrevTextSize 不存在时回到 medium，不再停留在 elder）。
   */
  applySeniorMode(on) {
    this.storage.set('seniorMode', !!on);
    const root = document.documentElement;
    if (root) {
      if (on) root.setAttribute('data-senior', 'on');
      else root.removeAttribute('data-senior');
    }
    if (on) {
      const cur = this.getTextSize();
      if (cur !== 'elder') this.storage.set('seniorPrevTextSize', cur);
      this.applyTextSize('elder');
    } else {
      const prev = this.storage.get('seniorPrevTextSize');
      this.applyTextSize(prev || 'medium');
      this.storage.remove('seniorPrevTextSize');
    }
    return !!on;
  },

  isSeniorMode() {
    return !!this.storage.get('seniorMode');
  },

  /** ===== 动态头像（v76：GIF 格式，全平台兼容，无需 poster/降级） ===== */
  avatarVideoHTML(size) {
    const s = typeof size === 'number' ? size : 56;
    const ver = APP_CONFIG?.version ? APP_CONFIG.version : '76';
    return '<img src="img/emoji/emoji-happy-animated.gif?v=' + ver + '" alt="宝宝" style="width:' + s + 'px;height:' + s + 'px;border-radius:50%;object-fit:cover">';
  },

  /** ===== 睡眠计时器（本地存储） ===== */
  getActiveSleepSession() {
    return this.storage.get('activeSleep');
  },
  setActiveSleepSession(startTime) {
    this.storage.set('activeSleep', { startTime, startTimestamp: Date.now() });
  },
  clearActiveSleepSession() {
    this.storage.remove('activeSleep');
  },

  /** ===== 上次输入记忆（v73：喂养/排便表单默认回填） ===== */
  getLastFeedInput(type) {
    return this.storage.get('lastFeed_' + type) || null;
  },
  setLastFeedInput(type, data) {
    this.storage.set('lastFeed_' + type, { ...(this.getLastFeedInput(type) || {}), ...data, at: Date.now() });
  },
  getLastStoolInput() {
    return this.storage.get('lastStool') || null;
  },
  setLastStoolInput(data) {
    this.storage.set('lastStool', { ...(this.getLastStoolInput() || {}), ...data, at: Date.now() });
  },

  /** ===== 起止时间对（v73：睡眠/溜溜手工记录） =====
   * 两个 HH:mm 字符串 → 当日 ISO 字符串；结束早于开始视为跨天自动 +24h。
   * 返回 { start, end, durationMin }
   */
  pairTimesToISO(startStr, endStr, dateStr) {
    const s = this._hhmmToDate(startStr, dateStr);
    let e = this._hhmmToDate(endStr, dateStr);
    if (e <= s) e = new Date(e.getTime() + 86400000);
    return { start: s.toISOString(), end: e.toISOString(), durationMin: Math.round((e - s) / 60000) };
  },
  _hhmmToDate(str, dateStr) {
    if (!str) return new Date();
    const [h, m] = str.split(':').map(Number);
    const d = (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) ? new Date(dateStr + 'T00:00:00') : new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  },

  /** ===== 喂养目标 ===== */
  getFeedingTarget() {
    return this.storage.get('feedingTarget') || APP_CONFIG.feedingTargetDefault;
  },
  setFeedingTarget(target) {
    this.storage.set('feedingTarget', parseInt(target) || APP_CONFIG.feedingTargetDefault);
  },

  /** ===== 自定义图标 ===== */
  getCustomIcon() {
    return this.storage.get('customIcon') || null;
  },
  setCustomIcon(dataUrl) {
    this.storage.set('customIcon', dataUrl);
    const link = document.getElementById('app-icon-link');
    if (link) link.setAttribute('href', dataUrl);
  },

  /** ===== 今日心情 ===== */
  getTodayMood() {
    const data = this.storage.get('moodData') || {};
    const today = this.todayStr();
    return data[today] || null;
  },
  setTodayMood(mood) {
    const data = this.storage.get('moodData') || {};
    data[this.todayStr()] = mood;
    this.storage.set('moodData', data);
    // 同步到云端（fire-and-forget，失败静默）
    this._syncMoodToCloud('mood', mood);
  },

  /** ===== 妈妈心情 ===== */
  getMomMood() {
    const data = this.storage.get('momMoodData') || {};
    const today = this.todayStr();
    return data[today] || null;
  },
  setMomMood(mood) {
    const data = this.storage.get('momMoodData') || {};
    data[this.todayStr()] = mood;
    this.storage.set('momMoodData', data);
    this._syncMoodToCloud('mom_mood', mood);
  },

  /** 心情同步云端（防抖：500ms 合并连续点击） */
  _syncMoodToCloud(recordType, mood) {
    clearTimeout(this._moodSyncTimer);
    this._moodSyncTimer = setTimeout(() => {
      if (window.API && API.saveMood && Auth && Auth.getBabyId && Auth.getBabyId()) {
        API.saveMood(recordType, mood).catch(e => console.warn('[Mood] 云端同步失败(已存本地):', e.message));
      }
    }, 500);
  },

  /** 从云端拉取心情并合并到本地缓存（云端为准，供跨设备共享） */
  async syncMoodsFromCloud() {
    try {
      if (!(window.API && API.listMoods && Auth && Auth.getBabyId && Auth.getBabyId())) return;
      // 拉取最近 2 个月的心情
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = Utils.todayStr();
      const data = await API.listMoods(Utils.formatDate(start), end);
      const records = data?.records || [];
      if (records.length === 0) return;
      const babyMap = this.storage.get('moodData') || {};
      const momMap = this.storage.get('momMoodData') || {};
      let changed = false;
      for (const r of records) {
        const val = r.value || null;
        if (!val || !r.date) continue;
        if (r.recordType === 'mood') { babyMap[r.date] = val; changed = true; }
        else if (r.recordType === 'mom_mood') { momMap[r.date] = val; changed = true; }
      }
      if (changed) {
        this.storage.set('moodData', babyMap);
        this.storage.set('momMoodData', momMap);
      }
    } catch (e) {
      console.warn('[Mood] 云端拉取失败:', e.message);
    }
  },

  /** ===== 底部Tab图标自定义 ===== */
  getTabIcons() {
    return this.storage.get('tabIcons') || {};
  },
  setTabIcons(icons) {
    this.storage.set('tabIcons', icons);
    this._applyTabIcons();
  },
  _applyTabIcons() {
    const icons = this.getTabIcons();
    // P2a（v94）：v2 通道默认图标 Lucide 化（与设置页「主菜单图标」默认展示一致，
    // 并补齐 parenting-lib 第 4 tab 覆盖）；v1 通道保持 emoji（与 V74 一致，0 改动）
    const isV2 = !!window.__UI_V3__;
    const defaults = isV2
      ? { analytics: 'bar-chart-2', 'quick-record': 'plus', dashboard: 'home', functions: 'clipboard-list', assistant: 'bot' }
      : { dashboard: '', 'quick-record': '', functions: '' };
    Object.keys(defaults).forEach(key => {
      const el = document.querySelector(`.tab-btn[data-page="${key}"] .tab-icon`);
      if (!el) return;
      const customKey = icons[key];
      if (customKey) {
        const emoji = APP_CONFIG.emojiPack.find(e => e.key === customKey);
        if (emoji) {
          el.innerHTML = `<img src="${emoji.img}" style="width:24px;height:24px" alt="${emoji.label}" loading="lazy" decoding="async">`;
          return;
        }
      }
      el.innerHTML = isV2 ? Lucide.icon(defaults[key], 22) : defaults[key];
    });
  },

  /** ===== 首页待办显示管理 ===== */
  getHiddenDashboardItems() {
    return this.storage.get('hiddenDashboardItems') || [];
  },
  toggleHiddenDashboardItem(key) {
    const items = this.getHiddenDashboardItems();
    const idx = items.indexOf(key);
    if (idx > -1) { items.splice(idx, 1); }
    else { items.push(key); }
    this.storage.set('hiddenDashboardItems', items);
  },
  isDashboardItemHidden(key) {
    return this.getHiddenDashboardItems().includes(key);
  },

  /** ===== 月度推荐自动检查 ===== */
  getLastCheckedMonthAge() {
    return this.storage.get('lastCheckedMonthAge') ?? -1;
  },
  setLastCheckedMonthAge(month) {
    this.storage.set('lastCheckedMonthAge', month);
  },

  /**
   * 检查月龄增长，自动发现并启用新推荐项
   * 返回 { hasNew, newNursing, newNutrition, currentLabel, monthAge } 或 null
   */
  checkMonthlyRecommendations(birthDateStr) {
    if (!birthDateStr) return null;
    const monthAge = this.calcMonthAge(birthDateStr);
    const lastAge = this.getLastCheckedMonthAge();

    // 首次记录，不触发推荐
    if (lastAge < 0) {
      this.setLastCheckedMonthAge(monthAge);
      return null;
    }

    if (monthAge <= lastAge) return null;

    // 找出新增推荐项
    const result = findNewRecommendations(lastAge, monthAge);
    if (result.newNursing.length === 0 && result.newNutrition.length === 0) {
      this.setLastCheckedMonthAge(monthAge);
      return null;
    }

    // 自动重新启用被禁用的新标准项 + 清除首页隐藏
    const disabledNursing = this.getDisabledStandardNursingKeys();
    const disabledNutrition = this.getDisabledStandardNutritionKeys();
    const hiddenItems = this.getHiddenDashboardItems();

    let changed = false;

    // 护理：重新启用 + 清除首页隐藏
    result.newNursing.forEach(item => {
      const idx = disabledNursing.indexOf(item.name);
      if (idx > -1) { disabledNursing.splice(idx, 1); changed = true; }
      const dashKey = 'nursing_' + item.name;
      const hIdx = hiddenItems.indexOf(dashKey);
      if (hIdx > -1) { hiddenItems.splice(hIdx, 1); changed = true; }
    });

    // 营养：重新启用 + 清除首页隐藏
    result.newNutrition.forEach(n => {
      const idx = disabledNutrition.indexOf(n.name);
      if (idx > -1) { disabledNutrition.splice(idx, 1); changed = true; }
      const dashKey = 'nutrition_' + n.name;
      const hIdx = hiddenItems.indexOf(dashKey);
      if (hIdx > -1) { hiddenItems.splice(hIdx, 1); changed = true; }
    });

    if (changed) {
      this.storage.set('disabledNursingKeys', disabledNursing);
      this.storage.set('disabledNutritionKeys', disabledNutrition);
      this.storage.set('hiddenDashboardItems', hiddenItems);
    }

    this.setLastCheckedMonthAge(monthAge);

    return {
      hasNew: true,
      newNursing: result.newNursing,
      newNutrition: result.newNutrition,
      currentLabel: result.currentLabel,
      monthAge
    };
  },

  /** ===== 管理员：自定义营养/护理项 ===== */
  getCustomNutritionItems() { return this.storage.get('customNutrition') || []; },
  addCustomNutritionItem(item) {
    const items = this.getCustomNutritionItems(); items.push(item); this.storage.set('customNutrition', items);
  },
  removeCustomNutritionItem(name) {
    const items = this.getCustomNutritionItems().filter(i => i.name !== name); this.storage.set('customNutrition', items);
  },
  getDisabledStandardNutritionKeys() { return this.storage.get('disabledNutritionKeys') || []; },
  toggleDisabledNutritionKey(key) {
    const keys = this.getDisabledStandardNutritionKeys();
    const idx = keys.indexOf(key);
    if (idx > -1) keys.splice(idx, 1); else keys.push(key);
    this.storage.set('disabledNutritionKeys', keys);
  },
  getCustomNursingItems() { return this.storage.get('customNursing') || []; },
  addCustomNursingItem(item) {
    const items = this.getCustomNursingItems(); items.push(item); this.storage.set('customNursing', items);
  },
  removeCustomNursingItem(name) {
    const items = this.getCustomNursingItems().filter(i => i.name !== name); this.storage.set('customNursing', items);
  },
  getDisabledStandardNursingKeys() { return this.storage.get('disabledNursingKeys') || []; },
  toggleDisabledNursingKey(key) {
    const keys = this.getDisabledStandardNursingKeys();
    const idx = keys.indexOf(key);
    if (idx > -1) keys.splice(idx, 1); else keys.push(key);
    this.storage.set('disabledNursingKeys', keys);
  },

  /** ===== 家庭级仪表盘设置（云端同步） ===== */
  /** 从云端设置同步到本地（覆盖本地值） */
  applyCloudDashboardSettings(settings) {
    if (!settings) return;
    if (settings.hiddenDashboardItems) this.storage.set('hiddenDashboardItems', settings.hiddenDashboardItems);
    if (settings.disabledNutritionKeys) this.storage.set('disabledNutritionKeys', settings.disabledNutritionKeys);
    if (settings.disabledNursingKeys) this.storage.set('disabledNursingKeys', settings.disabledNursingKeys);
    if (settings.customNutrition) this.storage.set('customNutrition', settings.customNutrition);
    if (settings.customNursing) this.storage.set('customNursing', settings.customNursing);
    console.log('[Utils] 仪表盘设置已从云端同步');
  },

  /** ===== 家庭级界面灰度落地（P5；v96 调整：全量 V2，云端不再降级） =====
   * 读取云端 family.uiVersion，与本地不一致则写入并整页 reload。
   *  - 'rollback' → 写 forceRollback='1'（C 通道应急，优先级最高，运维专用）
   *  - 'v2'       → 解除应急；若本地仍非 v2 则切换并 reload
   *  - 'v1'/空     → 忽略（v96：所有用户强制 V2，云端配置不再把用户降回 V1）
   */
  applyCloudUIversion(family) {
    if (!family || !family.uiVersion) return; // 家庭未配置灰度 → 不动
    const v = family.uiVersion;
    if (v !== 'v2' && v !== 'rollback') return; // v96：仅接受升级与应急，不降级
    try {
      if (v === 'rollback') {
        localStorage.setItem('forceRollback', '1');
        if (window.__UI_V3__) location.reload();
        return;
      }
      localStorage.setItem('forceRollback', '0'); // 解除应急，恢复按 uiVersion 判定
      const local = localStorage.getItem('uiVersion') || 'v2';
      if (local !== 'v2') {
        localStorage.setItem('uiVersion', 'v2');
        location.reload();
      }
    } catch (e) { /* 隐私模式降级：静默忽略 */ }
  },

  /** 获取当前仪表盘设置的快照（用于保存到云端） */
  getDashboardSettingsSnapshot() {
    return {
      hiddenDashboardItems: this.getHiddenDashboardItems(),
      disabledNutritionKeys: this.getDisabledStandardNutritionKeys(),
      disabledNursingKeys: this.getDisabledStandardNursingKeys(),
      customNutrition: this.getCustomNutritionItems(),
      customNursing: this.getCustomNursingItems(),
      updatedAt: new Date().toISOString()
    };
  },

  /** ===== 日历工具 ===== */
  getCalendarDays(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days = [];
    // 上月填充
    for (let i = startWeekday - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, otherMonth: true, month: month - 1, year: year });
    }
    // 本月
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, otherMonth: false, month: month, year: year });
    }
    // 下月填充到42格
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, otherMonth: true, month: month + 1, year: year });
    }
    return days;
  },

  /** 本地存储封装 */
  storage: {
    get(key) {
      try { return JSON.parse(localStorage.getItem('babycare_' + key)); } catch { return null; }
    },
    set(key, val) {
      localStorage.setItem('babycare_' + key, JSON.stringify(val));
    },
    remove(key) {
      localStorage.removeItem('babycare_' + key);
    }
  },

  /** ===== P4 离线队列（R8）===== */

  /** 离线判断（navigator.onLine 不可用时视为在线） */
  isOffline() {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  },

  /** 待同步队列条数（队列由 API.call 在离线写操作时写入） */
  getPendingCount() {
    const q = this.storage.get('pendingQueue');
    return Array.isArray(q) ? q.length : 0;
  },

  /** 入队（仅 API.call 内部调用；入队后同步条进入待同步态） */
  _enqueuePending(req) {
    const q = this.storage.get('pendingQueue') || [];
    const payload = req.data?.payload || {};
    q.push({
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      clientEventId: payload.clientEventId || ('client-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
      familyId: payload.familyId || Auth.getFamilyId?.() || null,
      babyId: payload.babyId || Auth.getBabyId?.() || null,
      baseVersion: payload.baseVersion ?? this.storage.get('dv') ?? null,
      operation: req.data?.action || null,
      name: req.name,
      data: req.data,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      syncStatus: 'PENDING',
      lastError: null,
      ts: Date.now()
    });
    this.storage.set('pendingQueue', q);
    // 同步条：入队即进入「待同步」态（覆盖超时但 onLine 仍为 true 的情况）
    if (window.CoopV2) { CoopV2.setState('pending'); CoopV2.refreshPending(); }
    return q.length;
  },

  /** 回线自动同步：逐条重放写操作，保留失败项及其后的未处理项 */
  async flushPending() {
    const queue = this.storage.get('pendingQueue') || [];
    if (!queue.length) return { synced: 0, failed: 0, authRequired: 0, conflicts: 0 };
    const remain = [];
    let synced = 0, failed = 0, authRequired = 0, conflicts = 0;
    for (let index = 0; index < queue.length; index++) {
      const item = queue[index];
      try {
        const replayData = {
          ...item.data,
          payload: { ...(item.data?.payload || {}), clientEventId: item.clientEventId, baseVersion: item.baseVersion }
        };
        await window.API.call(item.name, replayData, { skipQueue: true });
        synced++;
      } catch (error) {
        failed++;
        const isAuth = !!(error && (error.isAuthError || error.httpStatus === 401 || error.httpStatus === 403));
        const isConflict = !!(error && (error.isConflict || error.httpStatus === 409 || error.code === 409 || error.code === 'CONFLICT'));
        const status = isAuth ? 'AUTH_REQUIRED' : (isConflict ? 'CONFLICT' : (error?.isNetworkError ? 'PENDING' : 'FAILED'));
        if (isAuth) authRequired++;
        if (isConflict) conflicts++;
        remain.push({
          ...item,
          retryCount: Number(item.retryCount || 0) + 1,
          syncStatus: status,
          lastError: String(error?.code || error?.httpStatus || error?.name || error?.message || '同步失败').replace(/[\r\n]/g, ' ').slice(0, 160)
        });
        remain.push(...queue.slice(index + 1));
        break;
      }
    }
    this.storage.set('pendingQueue', remain);
    if (window.CoopV2) CoopV2.refreshPending();
    return { synced, failed, authRequired, conflicts };
  },

  /** 编辑/删除等敏感操作前置守卫：离线或有待同步记录时提示并返回 false */
  offlineGuard(tip) {
    if (this.isOffline() || this.getPendingCount() > 0) {
      this.showToast(tip || ' 当前离线，请联网同步后再操作');
      return false;
    }
    return true;
  }
};

/**
 * Lucide 图标库（内联 SVG，stroke=currentColor 自动跟随主题色）
 * 用法：Lucide.icon('utensils', 18) → '<svg ...>...</svg>'
 *       Lucide.icon('utensils')     → 默认 18px
 */
window.Lucide = (function() {
  const P = {
    utensils:        '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 3 0 0 0-5 3v7c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    hourglass:       '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    apple:           '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
    'clipboard-list':'<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    calendar:        '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    check:           '<path d="M20 6 9 17l-5-5"/>',
    'check-circle':  '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    clock:           '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    dumbbell:        '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
    target:          '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    timer:           '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
    repeat:          '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    lightbulb:       '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    'alert-triangle':'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
    'party-popper':  '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-1.88.56a2 2 0 0 0-1.44 1.95v.5a2 2 0 0 1-1.57 1.95l-.57.14"/><path d="m17 9-1.5 1.5"/><path d="M8 14l-6-6"/><path d="M9 5l1-1"/>',
    puzzle:          '<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/>',
    brain:           '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/>',
    'message-circle':'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    hand:            '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    users:           '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    bath:            '<path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><line x1="10" x2="8" y1="5" y2="7"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="7" x2="7" y1="19" y2="21"/><line x1="17" x2="17" y1="19" y2="21"/><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
    calculator:      '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    palette:         '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    sparkles:        '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    wrench:          '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    loader:          '<line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/>',
    search:          '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    mic:             '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    flame:           '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    folder:          '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    'help-circle':   '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    baby:            '<path d="M9 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/><path d="M7.5 7.5c0 .5-.5 1-1 1s-1-.5-1-1 .5-1 1-1 1 .5 1 1z"/><path d="M18.5 7.5c0 .5-.5 1-1 1s-1-.5-1-1 .5-1 1-1 1 .5 1 1z"/><path d="M9 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/><path d="M17.5 17.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0z"/><path d="M2.5 17.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0z"/><path d="M9 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/><path d="M12 22V12"/><path d="M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'book-open':     '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    library:         '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
    ruler:           '<path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4Z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/><path d="m4.5 13.5 2 2"/>',
    weight:          '<circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.46A2 2 0 0 0 17.5 8Z"/>',
    moon:            '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    activity:        '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    syringe:         '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>',
    pill:            '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    'heart-pulse':   '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
    eye:             '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    'edit-3':        '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    smile:           '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
    school:          '<path d="M14 22v-4a2 2 0 0 0-4 0v4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M18 5v17"/><path d="m4 5 8-3 8 3"/><path d="M2 12l4 2"/>',
    'trending-up':   '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    pin:             '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    bottle:          '<path d="M10 2h4"/><path d="M12 8v8"/><path d="M8 8h8l-.5 12a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2Z"/><path d="M8 8h8a4 4 0 0 0-4-4 4 4 0 0 0-4 4"/>',
    star:            '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    plus:            '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'bar-chart':     '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
    'bar-chart-2':   '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
    thermometer:     '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
    droplet:         '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    scissors:        '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
    camera:          '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    shirt:           '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
    footprints:      '<path d="M4 16v-2.38c0-.2.02-.4.07-.59l1.1-4.55A2 2 0 0 1 7.12 7h.5a2 2 0 0 1 1.95 1.48l1.1 4.55c.05.2.07.39.07.59V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M14 16v-2.38c0-.2.02-.4.07-.59l1.1-4.55A2 2 0 0 1 17.12 7h.5a2 2 0 0 1 1.95 1.48l1.1 4.55c.05.2.07.39.07.59V16a2 2 0 0 1-2 2h-1.74a2 2 0 0 1-2-2Z"/><path d="M4 20h2.5"/><path d="M14 20h2.5"/>',
    map:             '<path d="m9 6-6 3v8l6 3 6-3 6 3V8l-6-3-6 3Z"/><path d="M9 6v8"/><path d="M15 9v8"/>',
    settings:        '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    /* ===== v95 批次F：emoji→Lucide 映射所需补充图标 ===== */
    user:            '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    wifi:            '<path d="M5 13a10 10 0 0 1 14 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/><line x1="12" x2="12.01" y1="20" y2="20"/>',
    pencil:          '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    upload:          '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    download:        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    milk:            '<path d="M8 2h8"/><path d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2"/><path d="M7 15a6.472 6.472 0 0 1 5 0 6.47 6.47 0 0 0 5 0"/>',
    'bell-off':      '<path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><path d="m2 2 20 20"/>',
    bot:             '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    link:            '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    smartphone:      '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    save:            '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    unlock:          '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    home:            '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    zap:             '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'volume-2':      '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    inbox:           '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    sprout:          '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    stethoscope:     '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
    'refresh-cw':    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    x:               '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    trash:           '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    'trash-2':       '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    'file-text':     '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    'chevron-left':  '<path d="m15 18-6-6 6-6"/>',
    'check-square':  '<polyline points="9 11 12 14 22 6"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    square:          '<rect width="18" height="18" x="3" y="3" rx="2"/>',
    'circle-dot':    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
    info:            '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'cloud-off':     '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
  };

  // R23：补齐页面使用但基础图标表未单独登记的语义别名，避免落到圆点兜底图标。
  Object.assign(P, {
    'alert-octagon': P['alert-triangle'], 'alert-circle': P.info, archive: P['clipboard-list'], award: P.star,
    'badge-check': P['check-circle'], 'bar-chart-3': P['bar-chart-2'], beaker: P['activity'],
    'clipboard-check': P['check-square'],
    bell: P['clock'], 'camera-off': P.camera, circle: P['circle-dot'], 'clock-3': P.clock,
    'cloud-sun': P.map, cross: P['plus'], 'edit-2': P['edit-3'],
    'graduation-cap': P.school, heart: P['heart-pulse'], 'heart-handshake': P.users,
    history: P.clock, 'life-buoy': P['help-circle'], list: P['clipboard-list'],
    'log-in': P.user, 'maximize-2': P['plus'], navigation: P.map, package: P['clipboard-list'], 'package-x': P['clipboard-list'],
    'play-circle': P['circle-dot'], share: P.link, 'share-2': P.link, shield: P['check-circle'],
    'shield-alert': P['alert-triangle'], 'shield-check': P['check-circle'], trophy: P.star,
    'triangle-alert': P['alert-triangle'], 'loader-circle': P.loader, 'wifi-off': P['cloud-off'],
    'git-merge': P.link, umbrella: P.map, 'user-plus': P.user
  });

  /* v95 批次F：emoji → Lucide 图标名映射（展示层转换用；含 ZWJ 序列）
     仅覆盖 UI 装饰性 emoji；数据语义类（大便颜色 、形状 、
     量级 、心情  等）不映射——它们承载颜色/语义信息，Lucide 无法表达 */
  const EMOJI_MAP = {
    '': 'settings', '': 'settings',
    '': 'user', '': 'user',
    '': 'wifi', '': 'wifi',
    '': 'check-circle', '': 'check-circle',
    '': 'moon',
    '': 'pill',
    '': 'heart-pulse',
    '': 'file-text',
    '': 'pencil', '': 'pencil',
    '': 'target',
    '': 'star', '': 'star',
    '': 'party-popper', '': 'party-popper',
    '': 'upload', '': 'download',
    '': 'milk',
    '': 'droplet',
    '': 'camera',
    '': 'search',
    '': 'bell-off',
    '': 'bot',
    '': 'thermometer', '': 'thermometer',
    '': 'ruler',
    '': 'clipboard-list',
    '': 'calendar',
    '': 'pin',
    '': 'link',
    '': 'smartphone',
    '': 'bar-chart',
    '': 'save',
    '': 'unlock', '': 'unlock',
    '': 'home',
    '': 'baby',
    '': 'footprints',
    '': 'refresh-cw',
    '': 'alert-triangle', '': 'alert-triangle',
    '': 'inbox',
    '': 'zap',
    '': 'sparkles',
    '': 'mic',
    '': 'volume-2',
    '‍‍': 'users',
    '': 'sprout',
    '': 'brain',
    '': 'trending-up',
    '': 'syringe',
    '': 'stethoscope',
    '': 'droplet',
    '': 'droplet',
    /* 功能模块图标（config.modules） */
    '': 'map', '': 'map',
    '': 'apple',
    '': 'dumbbell',
    '': 'puzzle',
  };
  // emoji 字符探测（含 ZWJ / 变体选择符），按长度降序保证 ZWJ 序列优先匹配
  const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}](?:\u{FE0F}|\u{200D}[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}])*/gu;

  return {
    icon(name, size) {
      // 未登记的新图标不能让设置项/功能入口直接变成“无图标”。
      // 使用稳定的通用图标兜底，同时保留原有图标名调用契约。
      const p = P[name] || P['circle-dot'];
      if (!p) return '';
      const s = size || 18;
      return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
    },
    /** 返回一个带 class 包裹的图标 span */
    iconSpan(name, size, cls) {
      return '<span class="' + (cls || '') + '" style="display:inline-flex;align-items:center">' + this.icon(name, size) + '</span>';
    },
    /* ===== v95 批次F：emoji 展示层转换 API ===== */
    /** 单个 emoji 字符 → Lucide SVG（无映射返回 ''）。含 ZWJ 序列（‍‍ 等） */
    fromEmoji(ch, size) {
      const name = EMOJI_MAP[ch] || EMOJI_MAP[String(ch).trim()];
      return name ? this.icon(name, size) : '';
    },
    /** emoji → 图标名（供需要图标名而非 SVG 的场景） */
    emojiName(ch) {
      return EMOJI_MAP[ch] || EMOJI_MAP[String(ch).trim()] || null;
    },
    /**
     * DOM 文本节点内 emoji → Lucide SVG 就地替换（v95 批次F）。
     * 仅遍历文本节点，不碰属性/输入框值/代码块；未映射 emoji 原样保留。
     * 用法：Lucide.replaceEmojiInDOM(document.getElementById('app-modal-body'))
     */
    replaceEmojiInDOM(root, size) {
      if (!root) return;
      const self = this;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (!n.nodeValue || !EMOJI_RE.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
          const p = n.parentNode;
          if (!p || /^(SCRIPT|STYLE|TEXTAREA|INPUT|CODE|PRE)$/i.test(p.nodeName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const targets = [];
      while (walker.nextNode()) targets.push(walker.currentNode);
      const s = size || 16;
      targets.forEach((tn) => {
        const text = tn.nodeValue;
        // 收集所有可映射片段
        const spans = [];
        EMOJI_RE.lastIndex = 0;
        let m;
        while ((m = EMOJI_RE.exec(text)) !== null) {
          const svg = self.fromEmoji(m[0], s);
          if (svg) spans.push({ start: m.index, end: m.index + m[0].length, svg });
        }
        if (!spans.length) return;
        // 重组：文本段 + 图标 span 交替
        const frag = document.createDocumentFragment();
        let pos = 0;
        spans.forEach((sp) => {
          if (sp.start > pos) frag.appendChild(document.createTextNode(text.slice(pos, sp.start)));
          const wrap = document.createElement('span');
          wrap.style.cssText = 'display:inline-flex;align-items:center;vertical-align:-3px;margin-right:2px';
          wrap.innerHTML = sp.svg;
          frag.appendChild(wrap);
          pos = sp.end;
        });
        if (pos < text.length) {
          // 吃掉图标后紧随的空格，避免双空格
          frag.appendChild(document.createTextNode(text.slice(pos).replace(/^\s+/, '')));
        }
        tn.parentNode.replaceChild(frag, tn);
      });
    }
  };
})();

// 快捷引用
const $ = (sel, parent = document) => parent.querySelector(sel);
const $$ = (sel, parent = document) => parent.querySelectorAll(sel);

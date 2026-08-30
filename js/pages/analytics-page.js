/**
 * 数据分析 Tab（第1个底部 tab，顺序：分析/记录/首页/功能/AI助手）
 * 子 tab：日报 / 周报 / 月报 / 日历 / 趋势
 *
 * v125 升级（基于 v124 基线）：
 * - 5 子Tab 架构：日报/周报/月报/日历/趋势（移除洞察中心/指标总览，能力并入日报/周报/月报）
 * - 数据 API：list*（{startDate,endDate}参数），一次加载最近 180 天，各子Tab 从缓存过滤
 * - 周报日期导航：近7天/自然周 切换 + 往前翻页（最多 -12 周）
 * - 月报月份导航：往前 6 个月翻页
 * - 趋势：Canvas 图表（AnalyticsCharts），喂养双轴/睡眠堆叠+夜醒/排便/体温+37.5预警/心情
 * - 下载/分享：迁移 v100 report-page 能力（SVG foreignObject 整页捕获 + navigator.share 降级下载）
 * - 聚合下载区：主按钮[下载报表][分享] + 横排图表 chips
 * - UI：融入 V2 .card 体系，Lucide 图标，浅色/深色双模式，无 emoji 残留
 */
window.AnalyticsPage = {
  _currentSubTab: 'daily',
  _weekRange: '7d',        // 周报模式：近7天 | 自然周
  _weekOffset: 0,          // 自然周翻页偏移，0=本周，最小 -12
  _monthOffset: 0,         // 月报月份偏移，0=本月，最小 -6
  _trendRange: '7d',       // 趋势页：近7天 | 自然周 | 自然月
  _dayOffset: 0,           // 日报日期偏移，0=今天，-1=昨天，最小 -90
  _currentCalMonth: null,
  _loading: false,
  _weekData: null,         // { startISO, endISO, dailyStats, records }
  _weekStats: null,

  // ===== 渲染入口 =====
  async render(container) {
    const today = new Date();
    this._currentCalMonth = { year: today.getFullYear(), month: today.getMonth() + 1 };
    container.removeAttribute('data-v3-request-state');
    container.innerHTML = this._buildSkeleton();
    await this._loadAndRender(container);
  },

  async refresh() {
    const content = document.getElementById('content');
    if (content) await this._loadAndRender(content);
  },

  // ============================================================
  // 数据加载（一次加载最近 180 天，各子Tab 从缓存过滤）
  // ============================================================
  async _loadAndRender(container) {
    this._loading = true;
    try {
      await this._loadAllDomainsData();
      if (!this._hasAnalyzableRecords(this._weekData.records) && this._loadState !== 'partial') {
        container.innerHTML = this._emptyStateHTML();
        if (window.V3UI?.setStatus) window.V3UI.setStatus('empty', '暂无可分析记录');
        return;
      }
      container.innerHTML = this._buildShell();
      this._bindEvents();
      await this._switchTab(this._currentSubTab, true);
      if (this._loadState === 'partial') {
        container.setAttribute('data-v3-request-state', 'partial');
        container.insertAdjacentHTML('afterbegin', this._partialStateHTML());
        window.V3UI?.setStatus('partial', '部分分析数据加载失败');
      }
    } catch (e) {
      console.error('[AnalyticsPage] render error:', e);
      const state = window.V3UI?.errorState ? V3UI.errorState(e) : 'error';
      container.innerHTML = window.V3UI?.stateHTML ? V3UI.stateHTML(state, '数据加载失败', e.message, '<button class="btn btn-primary" type="button" onclick="Pages.render(\'analytics\')">重新加载</button>') : `<div class="card"><div class="card-title">加载失败</div><p style="color:var(--color-error)">${Utils.escapeHtml(e.message)}</p></div>`;
      if (window.V3UI?.setStatus) V3UI.setStatus(state, '数据加载失败');
    } finally {
      this._loading = false;
    }
  },

  _hasAnalyzableRecords(records = {}) {
    return Object.entries(records).some(([key, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (key === 'vaccine' && value && typeof value === 'object') return Object.values(value).some(item => Array.isArray(item) && item.length > 0);
      return false;
    });
  },

  _emptyStateHTML() {
    const action = '<button class="btn btn-primary" type="button" onclick="showPage(\'quick-record\')">去记录</button>';
    return window.V3UI?.stateHTML ? window.V3UI.stateHTML('empty', '暂无可分析记录', '先记录一次喂养、睡眠、排便或健康数据，再回来查看分析。', action) : `<div class="empty-state"><h2>暂无可分析记录</h2><p>先记录一次数据，再回来查看分析。</p>${action}</div>`;
  },

  _partialStateHTML() {
    const failed = this._failedDomains?.length ? `失败区域：${this._failedDomains.map(item => Utils.escapeHtml(item)).join('、')}` : '部分数据区域暂不可用';
    const retry = '<button class="btn btn-primary" type="button" onclick="AnalyticsPage.refresh()">重试失败区域</button>';
    return window.V3UI?.stateHTML ? `<section class="analytics-partial-notice" data-v3-state="partial">${window.V3UI.stateHTML('partial', '部分分析数据加载失败', `${failed}；已加载的数据仍保留。`, retry)}</section>` : `<section class="analytics-partial-notice" data-v3-state="partial"><strong>部分分析数据加载失败</strong><p>${failed}；已加载的数据仍保留。</p>${retry}</section>`;
  },

  /**
   * 统一加载所有域的数据（最近 180 天，覆盖月报往前 6 个月 + 周报往前 12 周）
   * 核心：将 familyId+位置参数 改为 list*(params={startDate,endDate})
   */
  async _loadAllDomainsData() {
    const today = new Date();
    const endISO = Utils.formatDate(today);
    const start = new Date(today);
    start.setDate(start.getDate() - 180);
    const startISO = Utils.formatDate(start);
    const snapshot = await API.getUnifiedSnapshot({ startDate: startISO, endDate: endISO });
    if (!snapshot || !['loaded', 'partial'].includes(snapshot.status)) throw new Error('统一数据快照不可用');
    const records = snapshot.records || { feeding: [], sleep: [], stool: [], health: [], mood: [], clean: [], walk: [], vaccine: null, growth: [], milestone: [] };
    this._failedDomains = Array.isArray(snapshot.failedDomains) ? snapshot.failedDomains : [];
    this._loadState = snapshot.status === 'partial' || this._failedDomains.length ? 'partial' : 'loaded';
    const dailyStats = this._aggregateDailyStats(records);
    this._weekData = { startISO, endISO, dailyStats, records, snapshot };
    this._weekStats = this._computeWeekStats(dailyStats, startISO, endISO, records);
  },

  /** 聚合每日统计（8域全量） */
  _aggregateDailyStats(records) {
    const map = {};
    const push = (date, key, val) => {
      if (!map[date]) map[date] = {
        feeding: 0, feedingML: 0, feedingCount: 0, breastCount: 0, bottleBreastCount: 0,
        sleepMin: 0, sleepRecords: 0, stoolCount: 0, urineCount: 0,
        tempCount: 0, tempHigh: false, tempValues: [],
        weight: null, height: null, headCirc: null,
        moodBaby: null, moodMom: null,
        bath: 0, clean: 0, walkMin: 0, walkCount: 0,
        vaccineDone: 0, vaccineTotal: 0,
      };
      map[date][key] = (map[date][key] || 0) + (val || 0);
    };
    const setVal = (date, key, val) => {
      if (!map[date]) return;
      map[date][key] = val;
    };

    // 喂养
    for (const r of records.feeding) {
      const d = Utils.localDateFromISO(r.time);
      if (!d) continue;
      push(d, 'feedingCount', 1);
      if (r.ml || r.amount) push(d, 'feedingML', r.ml || r.amount);
      const type = String(r.type || r.feedType || r.kind || '').toLowerCase();
      if (type === 'breast' || type === '母乳' || type === 'direct_breast') push(d, 'breastCount', 1);
      if (type === 'bottle_breast' || type === 'bottle-breast') push(d, 'bottleBreastCount', 1);
    }
    // 睡眠
    for (const r of records.sleep) {
      const d = Utils.localDateFromISO(r.startTime || r.start);
      if (!d) continue;
      const start = new Date(r.startTime || r.start), end = r.endTime ? new Date(r.endTime) : (r.end ? new Date(r.end) : new Date());
      const min = Math.max(0, Math.round((end - start) / 60000));
      push(d, 'sleepMin', min);
      push(d, 'sleepRecords', 1);
    }
    // 排便
    for (const r of records.stool) {
      const d = Utils.localDateFromISO(r.time);
      if (!d) continue;
      if (!r.type || r.type === 'stool') push(d, 'stoolCount', 1);
      if (r.type === 'urine') push(d, 'urineCount', 1);
    }
    // 健康（体温/头围）
    for (const r of records.health) {
      const d = Utils.localDateFromISO(r.time);
      if (!d) continue;
      if (r.type === 'temperature' || r.type === 'temp') {
        push(d, 'tempCount', 1);
        const val = parseFloat(r.value || r.tempValue || 0);
        if (val >= 37.5) push(d, 'tempHigh', 1);
        const arr = map[d].tempValues || [];
        arr.push(val);
        map[d].tempValues = arr;
      }
      if ((r.type === 'head_circumference' || r.key === 'headCircumference') && r.value) {
        setVal(d, 'headCirc', parseFloat(r.value));
      }
    }
    // 心情
    for (const m of records.mood) {
      const d = m.date || Utils.localDateFromISO(m.time);
      if (!d) continue;
      if (m.recordType === 'mood' && m.mood) setVal(d, 'moodBaby', m.mood);
      if (m.recordType === 'mom_mood' && m.mood) setVal(d, 'moodMom', m.mood);
    }
    // 清洁护理
    for (const r of records.clean) {
      const d = Utils.localDateFromISO(r.time);
      if (!d) continue;
      push(d, 'clean', 1);
      if (r.type === 'bath') push(d, 'bath', 1);
      if (r.type === 'massage') push(d, 'massage', 1);
      if (r.type === 'nursing') push(d, 'nursing', 1);
    }
    // 足迹/外出
    for (const r of records.walk) {
      const d = Utils.localDateFromISO(r.startTime || r.start);
      if (!d) continue;
      const start = new Date(r.startTime || r.start), end = r.endTime ? new Date(r.endTime) : (r.end ? new Date(r.end) : new Date());
      const min = Math.max(0, Math.round((end - start) / 60000));
      push(d, 'walkMin', min);
      push(d, 'walkCount', 1);
    }
    // 体格发育（取最近一次）
    const latest = {};
    for (const r of records.growth) {
      const d = r.date || Utils.localDateFromISO(r.time);
      if (!d) continue;
      if (!latest[d] || (r.createdAt && r.createdAt > latest[d].createdAt)) latest[d] = r;
    }
    for (const [d, r] of Object.entries(latest)) {
      if (r.weight || r.weight === 0) setVal(d, 'weight', r.weight);
      if (r.height || r.height === 0) setVal(d, 'height', r.height);
      if (r.headCircumference || r.headCircumference === 0) setVal(d, 'headCirc', r.headCircumference);
    }
    return map;
  },

  /** 计算周期统计（AI 解读用聚合字段） */
  _computeWeekStats(dailyStats, startISO, endISO, records) {
    const ref = APP_CONFIG.healthReference || {};
    const baby = Utils.getBabyInfo();
    const monthAge = baby ? Utils.calcMonthAge(baby.birthDate) : 0;
    const weeks = Math.max(0, Math.floor((monthAge * 30) / 7));
    const insights = [];

    let totalMilk = 0, totalFeeds = 0, milkDropDays = 0;
    let prevDayMilk = 0, totalSleepMin = 0, sleepDays = 0;
    let totalStool = 0, stoolDays = 0, totalClean = 0;
    const milkByDay = [], stoolDates = [];

    const start = new Date(startISO);
    const end = new Date(endISO);
    const days = Math.round((end - start) / 86400000) + 1;

    for (let i = 0; i < Math.min(days, 90); i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = Utils.formatDate(d);
      const dayStats = dailyStats[dateStr] || {};

      totalMilk += dayStats.feedingML || 0;
      totalFeeds += dayStats.feedingCount || 0;
      totalClean += dayStats.clean || 0;
      const dayMilk = dayStats.feedingML || 0;
      milkByDay.push(dayMilk);
      if (dayMilk > 0 && prevDayMilk > 0 && dayMilk < prevDayMilk * 0.8) milkDropDays++;
      if (dayMilk > 0) prevDayMilk = dayMilk;
      if (dayMilk === 0 && prevDayMilk > 0) prevDayMilk = 0;
      if (dayStats.sleepMin > 0) { totalSleepMin += dayStats.sleepMin; sleepDays++; }
      if (dayStats.stoolCount > 0) { totalStool += dayStats.stoolCount; stoolDays++; stoolDates.push(dateStr); }
    }

    const avgMilkPerFeed = totalFeeds > 0 ? Math.round(totalMilk / totalFeeds) : 0;
    const avgSleepHours = sleepDays > 0 ? Math.round(totalSleepMin / sleepDays / 60 * 10) / 10 : 0;

    // R1 奶量骤降
    if (milkDropDays >= 3) {
      insights.push({ id: 'R1', icon: 'droplet', label: '奶量骤降', tag: 'warn',
        desc: `日均奶量周内出现${milkDropDays}次明显下降（含亲喂估算），建议观察是否厌奶期`,
        advice: '观察宝宝进食状态，可记录更衣情况判断摄入量', time: Utils.formatDate(new Date()) });
    }
    // R6 便秘倾向
    if (stoolDates.length > 0) {
      const lastDate = stoolDates[stoolDates.length - 1];
      const today2 = Utils.formatDate(new Date());
      const daysSince = Math.floor((new Date(today2) - new Date(lastDate)) / 86400000);
      const sr = this._findRef(ref.stoolRef, weeks);
      const threshold = sr ? (sr.maxDays || 3) : 3;
      if (daysSince >= threshold && stoolDates.length >= 2) {
        insights.push({ id: 'R6', icon: 'alert-circle', label: '便秘倾向', tag: 'warn',
          desc: `距上次排便${daysSince}天（${Math.floor(weeks * 7 / 30)}月龄阈值${threshold}天），需关注`,
          advice: '增加高纤维辅食与水分摄入，观察腹部状态', time: lastDate });
      }
    }
    // R7 睡眠不足
    const sr2 = this._findRef(ref.sleepHoursRef, weeks);
    if (avgSleepHours > 0 && sr2) {
      const hoursMin = sr2.hoursMin || 12;
      if (avgSleepHours < hoursMin) {
        insights.push({ id: 'R7', icon: 'moon', label: '睡眠不足', tag: 'warn',
          desc: `日均睡眠${avgSleepHours}h，低于${Math.floor(weeks * 7 / 30)}月龄参考下限${hoursMin}h`,
          advice: '适当提前就寝时间，增加日间小睡', time: Utils.formatDate(new Date()) });
      }
    }
    // R12 正向彩蛋
    if (milkDropDays === 0 && totalFeeds >= 7 && totalStool >= 3 && sleepDays >= 5) {
      insights.push({ id: 'R12', icon: 'star', label: '作息规律', tag: 'celebration',
        desc: '喂养、排便、睡眠整体稳定，作息规律养成中！', advice: '', time: Utils.formatDate(new Date()) });
    }

    return {
      totalMilk, totalFeeds, avgMilkPerFeed, avgSleepHours,
      totalStool, totalStoolDays: stoolDays, totalClean,
      milkByDay, insights,
    };
  },

  _findRef(list, weeks) {
    if (!Array.isArray(list) || list.length === 0) return null;
    return list.find(r => weeks >= (r.weeksMin || 0) && weeks < (r.weeksMax || 999)) || list[list.length - 1];
  },

  _describeTrend(values) {
    if (!Array.isArray(values) || values.length < 2) return '数据不足';
    const first = values.slice(0, Math.min(3, values.length)).reduce((sum, value) => sum + (Number(value) || 0), 0) / Math.min(3, values.length);
    const last = values.slice(-Math.min(3, values.length)).reduce((sum, value) => sum + (Number(value) || 0), 0) / Math.min(3, values.length);
    if (first === 0 && last === 0) return '无记录';
    if (last > first * 1.1) return '上升趋势';
    if (last < first * 0.9) return '下降趋势';
    return '整体稳定';
  },

  _getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  // ============================================================
  // 页面结构
  // ============================================================
  _buildSkeleton() {
    if (window.__UI_V3__) return Utils.skeletonHTML('report');
    return `
      <div class="card" style="margin-bottom:12px">
        <div class="skeleton-line" style="width:60%;height:22px;margin:4px 0 8px"></div>
        <div class="skeleton-line" style="width:40%;height:14px;margin-bottom:20px"></div>
        <div class="skeleton-block" style="height:80px;margin-bottom:12px"></div>
        <div class="skeleton-block" style="height:80px"></div>
      </div>
    `;
  },

  _buildShell() {
    const subTabs = [
      { id: 'daily',    icon: 'file-text',     label: '日报' },
      { id: 'weekly',   icon: 'calendar',      label: '周报' },
      { id: 'monthly',  icon: 'bar-chart-2',   label: '月报' },
      { id: 'calendar', icon: 'calendar',      label: '日历' },
      { id: 'trend',    icon: 'trending-up',   label: '趋势' },
    ];

    const tabHTML = subTabs.map(t => `
      <button class="analytics-subtab-btn ${t.id === this._currentSubTab ? 'active' : ''}" data-tab="${t.id}" onclick="AnalyticsPage._switchTab('${t.id}')">
        <span class="as-icon">${Lucide.icon(t.icon, 14)}</span>
        <span class="as-label">${t.label}</span>
      </button>
    `).join('');

    return `
      <div class="analytics-page">
        <!-- 子 tab 导航 -->
        <div class="analytics-subtab" id="analytics-subtab">
          ${tabHTML}
        </div>

        <!-- 子 tab 内容区 -->
        <div class="analytics-content" id="analytics-content">
          <div class="analytics-loading"><div class="spinner"></div><span>加载中...</span></div>
        </div>
      </div>
    `;
  },

  // ============================================================
  // 子 tab 切换
  // ============================================================
  async _switchTab(tabId, skipLoad) {
    this._currentSubTab = tabId;
    document.querySelectorAll('.analytics-subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    const contentEl = document.getElementById('analytics-content');
    if (!contentEl) return;
    contentEl.innerHTML = `<div class="analytics-loading"><div class="spinner"></div><span>加载中...</span></div>`;

    if (!skipLoad) {
      await this._loadAllDomainsData();
    }

    switch (tabId) {
      case 'daily':    contentEl.innerHTML = this._dailyView(); break;
      case 'weekly':   contentEl.innerHTML = this._weeklyView(); break;
      case 'monthly':  contentEl.innerHTML = this._monthlyView(); break;
      case 'calendar': contentEl.innerHTML = this._buildCalendarView(); break;
      case 'trend':    contentEl.innerHTML = this._trendView(); break;
    }

    // 详细报告通过单按钮在模态中展示；分析页仅保留趋势页的内联 Canvas。
    if (tabId === 'trend') {
      requestAnimationFrame(() => setTimeout(() => this._drawCharts(), 30));
    }
  },

  // ============================================================
  // 日报：数据对比视图（今日 vs 昨日）+ KPI 网格 + 图表 + AI
  // ============================================================

  /** 日报日期导航 */
  _dailyNav() {
    const offset = this._dayOffset;
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const iso = Utils.formatDate(d);
    const wd = ['日','一','二','三','四','五','六'][d.getDay()];
    const isToday = offset === 0;
    const isYesterday = offset === -1;
    const label = isToday ? '今日' : (isYesterday ? '昨日' : iso);
    return `
      <div class="wk-nav">
        <button class="wk-nav-btn" ${offset <= -90 ? 'disabled' : ''} onclick="AnalyticsPage.navDay(-1)">${Lucide.icon('chevron-left', 15)}</button>
        <div class="wk-nav-label">${d.getMonth() + 1}月${d.getDate()}日 周${wd}${isToday ? ' · 今日' : ''}</div>
        <button class="wk-nav-btn" ${isToday ? 'disabled' : ''} onclick="AnalyticsPage.navDay(1)">${Lucide.icon('chevron-right', 15)}</button>
        ${!isToday ? `<button class="wk-today" onclick="AnalyticsPage.navDay(0)">今日</button>` : ''}
      </div>`;
  },

  navDay(dir) {
    if (dir === 0) { this._dayOffset = 0; }
    else if (dir === -1 && this._dayOffset > -90) { this._dayOffset--; }
    else if (dir === 1 && this._dayOffset < 0) { this._dayOffset++; }
    this._renderCurrent();
  },

  /** 计算日报数据（今日 vs 昨日环比） */
  _computeDailyData() {
    const ds = this._weekData?.dailyStats || {};
    const records = this._weekData?.records || {};
    const offset = this._dayOffset;
    const today = new Date();
    const todayDate = new Date(today);
    todayDate.setDate(todayDate.getDate() + offset);
    const todayISO = Utils.formatDate(todayDate);
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayISO = Utils.formatDate(yesterdayDate);

    const cur = ds[todayISO] || {};
    const prev = ds[yesterdayISO] || {};

    // KPI 数据
    const curMilk = cur.feedingML || 0;
    const prevMilk = prev.feedingML || 0;
    const milkDelta = prevMilk > 0 ? Math.round((curMilk - prevMilk) / prevMilk * 100) : null;

    const curFeeds = cur.feedingCount || 0;
    const prevFeeds = prev.feedingCount || 0;
    const feedDelta = prevFeeds > 0 ? curFeeds - prevFeeds : null;

    const curSleepH = cur.sleepMin > 0 ? Math.round(cur.sleepMin / 60 * 10) / 10 : 0;
    const prevSleepH = prev.sleepMin > 0 ? Math.round(prev.sleepMin / 60 * 10) / 10 : 0;
    const sleepDelta = prevSleepH > 0 ? Math.round((curSleepH - prevSleepH) * 10) / 10 : null;

    const curStool = cur.stoolCount || 0;
    const prevStool = prev.stoolCount || 0;
    const stoolDelta = prevStool > 0 ? curStool - prevStool : null;

    // 喂养分布（母乳 vs 配方奶）
    const dayFeeds = (records.feeding || []).filter(r => Utils.localDateFromISO(r.time) === todayISO);
    let breastCount = 0, formulaCount = 0, breastML = 0, formulaML = 0;
    for (const r of dayFeeds) {
      const t = r.type || r.feedType || '';
      const ml = r.ml || r.amount || 0;
      if (t === 'breast') { breastCount++; breastML += ml; }
      else if (t === 'formula') { formulaCount++; formulaML += ml; }
      else { formulaCount++; formulaML += ml; } // 默认归入配方奶
    }

    // 睡眠时段（0-24h 时间轴）
    const daySleep = (records.sleep || []).filter(r => {
      const d = Utils.localDateFromISO(r.startTime || r.start);
      return d === todayISO;
    });
    const sleepSegs = daySleep.map(r => {
      const start = new Date(r.startTime || r.start);
      const end = r.endTime ? new Date(r.endTime) : (r.end ? new Date(r.end) : new Date());
      let sHour = start.getHours() + start.getMinutes() / 60;
      let eHour = end.getHours() + end.getMinutes() / 60;
      // 跨天睡眠：结束时间在次日，折算到 0-24h 范围
      if (end.toDateString() !== start.toDateString()) {
        eHour = end.getHours() + end.getMinutes() / 60 + 24;
      }
      if (sHour > 24) sHour -= 24;
      if (eHour > 24) eHour -= 24;
      if (eHour < sHour) eHour += 24; // 跨午夜
      return { start: sHour, end: Math.min(eHour, 24) };
    });

    // KPI 网格（2×2）
    const kpi = [
      { v: curMilk, u: 'ml', k: '总奶量',
        d: milkDelta !== null ? `${milkDelta > 0 ? '+' : ''}${milkDelta}%` : '',
        up: (milkDelta || 0) >= 0, deltaLabel: 'vs 昨日' },
      { v: curFeeds, u: '次', k: '喂养次数',
        d: feedDelta !== null ? `${feedDelta > 0 ? '+' : ''}${feedDelta}次` : '',
        up: (feedDelta || 0) >= 0, deltaLabel: 'vs 昨日' },
      { v: curSleepH, u: 'h', k: '睡眠时长',
        d: sleepDelta !== null ? `${sleepDelta > 0 ? '+' : ''}${sleepDelta}h` : '',
        up: (sleepDelta || 0) >= 0, deltaLabel: 'vs 昨日' },
      { v: curStool, u: '次', k: '排便次数',
        d: stoolDelta !== null ? `${stoolDelta > 0 ? '+' : ''}${stoolDelta}次` : '',
        up: (stoolDelta || 0) >= 0, deltaLabel: 'vs 昨日' },
    ];

    return { todayISO, kpi, breastCount, formulaCount, breastML, formulaML, sleepSegs,
             prevMilk, prevFeeds, prevSleepH, prevStool };
  },

  _dailyView() {
    const data = this._computeDailyData();
    return `
      ${this._dailyNav()}
      <div class="card kpi-grid">
        ${data.kpi.map(k => `<div class="kpi-card">
          <div class="kpi-v">${k.v}<small>${k.u}</small></div>
          <div class="kpi-k">${k.k}</div>
          ${k.d ? `<div class="kpi-delta ${k.up ? 'up' : 'down'}">${k.up ? '▲' : '▼'} ${k.d} <span style="font-weight:400;color:var(--color-text-muted)">${k.deltaLabel || ''}</span></div>` : `<div class="kpi-delta" style="color:var(--color-text-muted)">无昨日数据</div>`}
        </div>`).join('')}
      </div>
      ${this._aiCard('daily')}
      ${this._viewReportButton('daily')}`;
  },

  _viewReportButton(range) {
    const label = range === 'daily' ? '日' : range === 'weekly' ? '周' : '月';
    return `<div class="card report-entry-card"><button class="view-report-btn" onclick="AnalyticsPage.openReport('${range}')">${Lucide.icon('file-text', 18)}<span>查看完整${label}报</span></button></div>`;
  },

  async openReport(type) {
    try {
      Utils.showProcessing('正在准备报告...');
      const reportData = await this._prepareReportData(type);
      const aiBody = document.getElementById('ai-insight-body');
      const aiText = aiBody ? aiBody.querySelector('.aii-text')?.textContent || '' : '';
      reportData.aiAssessment = aiText;
      Utils.hideLoading();
      if (window.ReportPage && ReportPage.openReportModal) {
        ReportPage.openReportModal(reportData);
      } else {
        Utils.showToast('报告模块未加载');
      }
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('报告生成失败: ' + e.message);
    }
  },

  async _prepareReportData(type) {
    const baby = Utils.getBabyInfo();
    const now = new Date();
    const records = this._weekData?.records || {};
    const ds = this._weekData?.dailyStats || {};
    let startDate, endDate, days;

    if (type === 'daily') {
      const d = new Date();
      d.setDate(d.getDate() + this._dayOffset);
      const iso = Utils.formatDate(d);
      startDate = iso; endDate = iso; days = 1;
    } else if (type === 'weekly') {
      if (this._weekRange === 'week') {
        startDate = this._weekStartDate();
        endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6);
      } else {
        endDate = new Date();
        startDate = new Date(); startDate.setDate(startDate.getDate() - 6);
      }
      days = 7;
    } else {
      const base = new Date();
      base.setDate(1); base.setMonth(base.getMonth() + this._monthOffset);
      startDate = base;
      endDate = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      days = endDate.getDate();
    }

    const startISO = typeof startDate === 'string' ? startDate : Utils.formatDate(startDate);
    const endISO = typeof endDate === 'string' ? endDate : Utils.formatDate(endDate);
    const dayMap = {};
    const cursor = new Date(startISO + 'T00:00:00');
    const end = new Date(endISO + 'T00:00:00');
    while (cursor <= end) {
      const iso = Utils.formatDate(cursor);
      const s = ds[iso] || {};
      dayMap[iso] = {
        milk: s.feedingML || 0, feed: s.feedingCount || 0,
        breast: s.breastCount || 0, bottleBreast: s.bottleBreastCount || 0,
        stool: s.stoolCount || 0, urine: s.urineCount || 0,
        sleep: s.sleepMin || 0, sleepCount: s.sleepRecords || 0,
        bath: s.bathCount || 0, massage: s.massageCount || 0,
        clean: s.clean || 0, nursing: s.nursingCount || 0, todo: 0
      };
      cursor.setDate(cursor.getDate() + 1);
    }

    let totalMilk = 0, totalFeed = 0, totalBreast = 0, totalBottleBreast = 0;
    let totalStool = 0, totalUrine = 0, totalSleep = 0;
    let totalClean = 0, totalBath = 0, totalMassage = 0, totalNursing = 0;
    Object.values(dayMap).forEach(d => {
      totalMilk += d.milk; totalFeed += d.feed; totalBreast += d.breast;
      totalBottleBreast += d.bottleBreast; totalStool += d.stool; totalUrine += d.urine;
      totalSleep += d.sleep; totalClean += d.clean; totalBath += d.bath;
      totalMassage += d.massage; totalNursing += d.nursing;
    });

    const inRange = (value, fallback) => {
      const date = Utils.localDateFromISO(value || '');
      return date && date >= startISO && date <= endISO;
    };
    const feedRecords = (records.feeding || []).filter(r => inRange(r.time));
    const sleepRecords = (records.sleep || []).filter(r => inRange(r.startTime || r.start));
    const stoolRecords = (records.stool || []).filter(r => inRange(r.time));
    const cleanRecords = (records.clean || []).filter(r => inRange(r.time));

    return {
      baby, type, startDate: startISO, endDate: endISO, days, now,
      feedRecords, stoolRecords, sleepRecords, cleanRecords,
      milestoneRecords: [], todoRecords: [], dayMap,
      totalMilk, totalFeed, totalBreast, totalBottleBreast, totalStool, totalUrine,
      totalSleep, totalRecords: feedRecords.length + stoolRecords.length + sleepRecords.length,
      totalClean, totalBath, totalMassage, totalExercise: 0, totalVisual: 0,
      totalNursing, totalTodos: 0, totalTodosAll: 0, healthData: null,
      moodRecords: [], vaccineRecords: {}, customVaccines: []
    };
  },

  // ============================================================
  // 周报：近7天/自然周 切换 + 翻页 + KPI + 双轴图 + 睡眠堆叠 + AI
  // ============================================================
  _weekRangeNav() {
    const r = this._weekRange;
    const chip = (key, label) =>
      `<button class="tr-range-btn ${r === key ? 'active' : ''}" onclick="AnalyticsPage.setWeekRange('${key}')">${label}</button>`;
    let nav = '';
    if (r === 'week') {
      const base = this._weekStartDate();
      const end = new Date(base);
      end.setDate(end.getDate() + 6);
      const fmt = d => `${d.getMonth() + 1}月${String(d.getDate()).padStart(2, '0')}日`;
      const isThisWeek = this._weekOffset === 0;
      nav = `
        <div class="wk-nav">
          <button class="wk-nav-btn" ${this._weekOffset <= -12 ? 'disabled' : ''} onclick="AnalyticsPage.navWeek(-1)">${Lucide.icon('chevron-left', 15)}</button>
          <div class="wk-nav-label">${fmt(base)} - ${fmt(end)}${isThisWeek ? ' · 本周' : ''}</div>
          <button class="wk-nav-btn" ${isThisWeek ? 'disabled' : ''} onclick="AnalyticsPage.navWeek(1)">${Lucide.icon('chevron-right', 15)}</button>
          ${!isThisWeek ? `<button class="wk-today" onclick="AnalyticsPage.navWeek(0)">本周</button>` : ''}
        </div>`;
    }
    return `
      <div class="card tr-range">${chip('7d', '近7天')}${chip('week', '自然周')}</div>
      ${nav}`;
  },

  _weekStartDate() {
    const today = new Date();
    const ws = this._getWeekStart(today);
    ws.setDate(ws.getDate() + this._weekOffset * 7);
    return ws;
  },

  setWeekRange(key) { this._weekRange = key; this._weekOffset = 0; this._renderCurrent(); },

  navWeek(dir) {
    if (dir === 0) { this._weekOffset = 0; }
    else if (dir === -1 && this._weekOffset > -12) { this._weekOffset--; }
    else if (dir === 1 && this._weekOffset < 0) { this._weekOffset++; }
    this._renderCurrent();
  },

  _weekTitle() {
    const base = this._weekStartDate();
    const weekNum = this._getWeekOffset(this._getWeekStart(new Date())) + this._weekOffset;
    const baby = Utils.getBabyInfo();
    return `${Utils.escapeHtml(baby?.name || '宝宝')}的第 ${weekNum} 周`;
  },

  _weekSub() {
    const base = this._weekStartDate();
    const end = new Date(base);
    end.setDate(end.getDate() + 6);
    const fmt = d => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    const baby = Utils.getBabyInfo();
    const monthAge = baby ? Utils.calcMonthAge(baby.birthDate) : 0;
    return `${fmt(base)} – ${fmt(end)} · ${monthAge}个月`;
  },

  _getWeekOffset(weekStart) {
    const today = new Date();
    const current = this._getWeekStart(today);
    return Math.round((current - weekStart) / (7 * 86400000));
  },

  _weeklyView() {
    const { kpi } = this._computeWeekData();
    return `
      ${this._weekRangeNav()}
      <div class="card kpi-grid">
        ${kpi.map(k => `<div class="kpi-card">
          <div class="kpi-v">${k.v}<small>${k.u}</small></div>
          <div class="kpi-k">${k.k}</div>
          ${k.d ? `<div class="kpi-delta ${k.up ? 'up' : 'down'}">${k.up ? '▲' : '▼'} ${k.d} 环比</div>` : ''}
        </div>`).join('')}
      </div>
      ${this._aiCard('week')}
      ${this._viewReportButton('weekly')}`;
  },

  /** 计算周报数据（近7天 或 自然周） */
  _computeWeekData() {
    const today = new Date();
    const todayISO = Utils.formatDate(today);
    const ds = this._weekData?.dailyStats || {};
    const records = this._weekData?.records || {};

    let startDate, endDate;
    if (this._weekRange === 'week') {
      startDate = this._weekStartDate();
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    } else {
      // 近7天
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 6);
    }
    const startISO = Utils.formatDate(startDate);
    const endISO = Utils.formatDate(endDate);

    // 生成日期序列（不超过今天）
    const labels = [], milk = [], breast = [], night = [], day = [];
    let totalMilk = 0, totalFeeds = 0, totalStool = 0, totalSleepMin = 0, sleepDays = 0, totalClean = 0, totalWalkMin = 0;
    const wd = ['日','一','二','三','四','五','六'];
    const cur = new Date(startDate);
    while (cur <= endDate && cur <= today) {
      const iso = Utils.formatDate(cur);
      const s = ds[iso] || {};
      labels.push(wd[cur.getDay()]);
      milk.push(s.feedingML || 0);
      breast.push(s.feedingCount || 0);
      // 睡眠拆分：夜间(20:00-次日8:00) 与 日间 简化按 60/40 估算（无精确时段数据时）
      const sleepH = (s.sleepMin || 0) / 60;
      night.push(Math.round(sleepH * 0.7 * 10) / 10);
      day.push(Math.round(sleepH * 0.3 * 10) / 10);
      totalMilk += s.feedingML || 0;
      totalFeeds += s.feedingCount || 0;
      totalStool += s.stoolCount || 0;
      totalSleepMin += s.sleepMin || 0;
      if (s.sleepMin > 0) sleepDays++;
      totalClean += s.clean || 0;
      totalWalkMin += s.walkMin || 0;
      cur.setDate(cur.getDate() + 1);
    }

    const days = labels.length;
    const avgMilk = days > 0 ? Math.round(totalMilk / days) : 0;
    const avgSleepH = sleepDays > 0 ? Math.round(totalSleepMin / sleepDays / 60 * 10) / 10 : 0;

    // 环比：与上一周期对比
    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - days);
    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    let prevMilk = 0;
    const pc = new Date(prevStart);
    while (pc <= prevEnd) {
      const iso = Utils.formatDate(pc);
      prevMilk += ds[iso]?.feedingML || 0;
      pc.setDate(pc.getDate() + 1);
    }
    const milkDelta = prevMilk > 0 ? Math.round((totalMilk - prevMilk) / prevMilk * 100) : null;

    const kpi = [
      { v: totalMilk, u: 'ml', k: '总奶量', d: milkDelta !== null ? `${milkDelta > 0 ? '+' : ''}${milkDelta}%` : '', up: (milkDelta || 0) >= 0 },
      { v: avgMilk, u: 'ml', k: '日均奶量', d: '', up: true },
      { v: avgSleepH, u: 'h', k: '日均睡眠', d: '', up: true },
      { v: totalStool, u: '次', k: '排便次数', d: '', up: true },
    ];

    const rpRows = [
      ['总奶量', `${totalMilk} ml（日均 ${avgMilk}ml）`],
      ['喂养次数', `${totalFeeds} 次`],
      ['睡眠总长', `${Math.round(totalSleepMin / 60 * 10) / 10} h`],
      ['排便', `${totalStool} 次`],
      ['清洁护理', `${totalClean} 次`],
      ['户外时长', `${Math.round(totalWalkMin / 60 * 10) / 10} h`],
    ];

    const isThisWeek = this._weekRange === 'week' && this._weekOffset === 0;
    const rpTitle = this._weekRange === 'week' ? this._weekTitle() : `${Utils.escapeHtml((Utils.getBabyInfo()?.name) || '宝宝')}的近7天`;
    const rpSub = this._weekRange === 'week' ? this._weekSub() : `${startISO} – ${endISO}`;

    return { startISO, endISO, labels, milk, breast, night, day, kpi, rpRows, rpTitle, rpSub };
  },

  // ============================================================
  // 月报：月份导航 + KPI + 热力日历 + 喂养趋势 + AI
  // ============================================================
  _monthNav() {
    const m = this._monthOffset;
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + m);
    const isThisMonth = m === 0;
    return `
      <div class="wk-nav">
        <button class="wk-nav-btn" ${m <= -6 ? 'disabled' : ''} onclick="AnalyticsPage.navMonth(-1)">${Lucide.icon('chevron-left', 15)}</button>
        <div class="wk-nav-label">${base.getFullYear()}年${base.getMonth() + 1}月${isThisMonth ? ' · 本月' : ''}</div>
        <button class="wk-nav-btn" ${isThisMonth ? 'disabled' : ''} onclick="AnalyticsPage.navMonth(1)">${Lucide.icon('chevron-right', 15)}</button>
        ${!isThisMonth ? `<button class="wk-today" onclick="AnalyticsPage.navMonth(0)">本月</button>` : ''}
      </div>`;
  },

  navMonth(dir) {
    if (dir === 0) { this._monthOffset = 0; }
    else if (dir === -1 && this._monthOffset > -6) { this._monthOffset--; }
    else if (dir === 1 && this._monthOffset < 0) { this._monthOffset++; }
    this._renderCurrent();
  },

  _monthTitle() {
    const m = this._monthOffset;
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + m);
    const baby = Utils.getBabyInfo();
    return `${Utils.escapeHtml(baby?.name || '宝宝')}的 ${base.getFullYear()}年${base.getMonth() + 1}月刊`;
  },

  _monthSub() {
    const m = this._monthOffset;
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + m);
    const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const fmt = d => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    return `${fmt(base)} – ${fmt(last)}${m === 0 ? ' · 本月' : ' · 历史月'}`;
  },

  _monthlyView() {
    const { kpi } = this._computeMonthData();
    return `
      ${this._monthNav()}
      <div class="card kpi-grid">
        ${kpi.map(k => `<div class="kpi-card">
          <div class="kpi-v">${k.v}<small>${k.u}</small></div>
          <div class="kpi-k">${k.k}</div>
          ${k.d ? `<div class="kpi-delta ${k.up ? 'up' : 'down'}">${k.up ? '▲' : '▼'} ${k.d} 环比</div>` : ''}
        </div>`).join('')}
      </div>
      ${this._aiCard('month')}
      ${this._viewReportButton('monthly')}`;
  },

  /** 计算月报数据 */
  _computeMonthData() {
    const m = this._monthOffset;
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + m);
    const year = base.getFullYear(), month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayISO = Utils.formatDate(today);
    const ds = this._weekData?.dailyStats || {};

    const labels = [], milk = [], heatData = [];
    let totalMilk = 0, totalFeeds = 0, totalStool = 0, totalSleepMin = 0, sleepDays = 0, totalClean = 0, totalWalkMin = 0, recordDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const iso = Utils.formatDate(date);
      const isFuture = date > today;
      const s = ds[iso] || {};
      labels.push(d + '日');
      const milkVal = isFuture ? 0 : (s.feedingML || 0);
      milk.push(milkVal);
      // 热力：当天记录条数
      const recCount = isFuture ? 0 : ((s.feedingCount || 0) + (s.stoolCount || 0) + (s.clean || 0) + (s.walkCount || 0));
      heatData.push({ label: d + '', value: recCount });
      if (recCount > 0) recordDays++;
      totalMilk += milkVal;
      totalFeeds += s.feedingCount || 0;
      totalStool += s.stoolCount || 0;
      totalSleepMin += s.sleepMin || 0;
      if (s.sleepMin > 0) sleepDays++;
      totalClean += s.clean || 0;
      totalWalkMin += s.walkMin || 0;
    }

    const avgMilk = recordDays > 0 ? Math.round(totalMilk / recordDays) : 0;
    const avgSleepH = sleepDays > 0 ? Math.round(totalSleepMin / sleepDays / 60 * 10) / 10 : 0;

    // 环比：与上一月对比
    const prevBase = new Date(year, month - 1, 1);
    const prevDays = new Date(year, month, 0).getDate();
    let prevMilk = 0;
    for (let d = 1; d <= prevDays; d++) {
      const iso = Utils.formatDate(new Date(prevBase.getFullYear(), prevBase.getMonth(), d));
      prevMilk += ds[iso]?.feedingML || 0;
    }
    const milkDelta = prevMilk > 0 ? Math.round((totalMilk - prevMilk) / prevMilk * 100) : null;

    const kpi = [
      { v: totalMilk, u: 'ml', k: '总奶量', d: milkDelta !== null ? `${milkDelta > 0 ? '+' : ''}${milkDelta}%` : '', up: (milkDelta || 0) >= 0 },
      { v: avgMilk, u: 'ml', k: '日均奶量', d: '', up: true },
      { v: avgSleepH, u: 'h', k: '日均睡眠', d: '', up: true },
      { v: totalStool, u: '次', k: '排便次数', d: '', up: true },
    ];

    const rpRows = [
      ['总奶量', `${totalMilk} ml（日均 ${avgMilk}ml）`],
      ['喂养次数', `${totalFeeds} 次`],
      ['睡眠总长', `${Math.round(totalSleepMin / 60 * 10) / 10} h`],
      ['排便', `${totalStool} 次`],
      ['清洁护理', `${totalClean} 次`],
      ['户外时长', `${Math.round(totalWalkMin / 60 * 10) / 10} h`],
    ];

    return { labels, milk, heatData, kpi, rpRows, rpTitle: this._monthTitle(), rpSub: this._monthSub() };
  },

  // ============================================================
  // 趋势：多维度历史趋势图（Canvas）
  // ============================================================
  _trendView() {
    const r = this._trendRange;
    const rangeLabel = r === '7d' ? '近7天' : (r === 'week' ? '自然周' : '自然月');
    const rangeBtn = (key, label) =>
      `<button class="tr-range-btn ${r === key ? 'active' : ''}" onclick="AnalyticsPage.setTrendRange('${key}')">${label}</button>`;
    return `
      <div class="card tr-range">
        ${rangeBtn('7d', '近7天')}${rangeBtn('week', '自然周')}${rangeBtn('month', '自然月')}
      </div>
      <div class="card">
        <div class="card-title"><span class="ct-icon">${Lucide.icon('droplet', 16)}</span> 喂养趋势</div>
        <canvas id="trFeed" class="chart" style="height:210px"></canvas>
        <div class="chart-legend">
          <span class="legend-bar" style="color:#6EA8D9">奶量(ml·左轴)</span>
          <span class="legend-dot" style="color:#E8927C">亲喂次数(右轴)</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="ct-icon">${Lucide.icon('moon', 16)}</span> 睡眠趋势</div>
        <canvas id="trSleep" class="chart" style="height:200px"></canvas>
        <div class="chart-legend">
          <span class="legend-bar" style="color:#5C7CBA">夜间</span>
          <span class="legend-bar" style="color:#9ABED4">日间</span>
          <span class="legend-dot" style="color:#EDB85C">夜醒次数</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="ct-icon">${Lucide.icon('activity', 16)}</span> 排便趋势</div>
        <canvas id="trStool" class="chart" style="height:180px"></canvas>
        <div class="chart-legend"><span class="legend-bar" style="color:#93A8D8">排便次数</span></div>
      </div>
      <div class="card">
        <div class="card-title"><span class="ct-icon">${Lucide.icon('thermometer', 16)}</span> 体温趋势</div>
        <canvas id="trTemp" class="chart" style="height:190px"></canvas>
        <div class="chart-legend">
          <span class="legend-dot" style="color:#CE6355">体温(℃)</span>
          <span class="legend-dot" style="color:#EDB85C">37.5℃ 预警线</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span class="ct-icon">${Lucide.icon('smile', 16)}</span> 心情趋势</div>
        <canvas id="trMood" class="chart" style="height:180px"></canvas>
        <div class="chart-legend">
          <span class="legend-bar" style="color:#7FBF9B">宝宝开心</span>
          <span class="legend-bar" style="color:#EDB85C">平静</span>
          <span class="legend-bar" style="color:#CE6355">哭闹</span>
        </div>
      </div>
      <div class="card" style="text-align:center;font-size:12px;color:var(--color-text-muted)">
        趋势图基于 9 域缓存数据实时聚合 · ${rangeLabel}
      </div>`;
  },

  setTrendRange(key) { this._trendRange = key; this._renderCurrent(); },

  /** 计算趋势页数据（近7天/自然周/自然月） */
  _computeTrendData() {
    const r = this._trendRange;
    const today = new Date();
    const todayISO = Utils.formatDate(today);
    const ds = this._weekData?.dailyStats || {};

    let startDate, n;
    if (r === '7d') { startDate = new Date(today); startDate.setDate(startDate.getDate() - 6); n = 7; }
    else if (r === 'week') { startDate = this._getWeekStart(today); n = 7; }
    else { startDate = new Date(today.getFullYear(), today.getMonth(), 1); n = 30; }

    const labels = [], milk = [], breast = [], night = [], day = [], wake = [], stool = [], temp = [], happy = [], calm = [], cry = [];
    const wd = ['日','一','二','三','四','五','六'];
    const cur = new Date(startDate);
    let idx = 0;
    while (cur <= today && idx < n) {
      const iso = Utils.formatDate(cur);
      const s = ds[iso] || {};
      labels.push(r === 'month' ? (cur.getDate() + '日') : wd[cur.getDay()]);
      milk.push(s.feedingML || 0);
      breast.push(s.feedingCount || 0);
      const sleepH = (s.sleepMin || 0) / 60;
      night.push(Math.round(sleepH * 0.7 * 10) / 10);
      day.push(Math.round(sleepH * 0.3 * 10) / 10);
      wake.push(s.tempHigh ? 1 : 0); // 夜醒简化：有体温记录视为可能夜醒
      stool.push(s.stoolCount || 0);
      const temps = s.tempValues || [];
      temp.push(temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length * 10) / 10 : 0);
      // 心情：开心/平静/哭闹
      const mood = s.moodBaby;
      const moodLabel = mood && mood.label ? String(mood.label) : '';
      happy.push(/开心|happy|joy/.test(moodLabel) ? 1 : 0);
      calm.push(/平静|calm|normal/.test(moodLabel) ? 1 : 0);
      cry.push(/哭闹|cry|sad/.test(moodLabel) ? 1 : 0);
      cur.setDate(cur.getDate() + 1);
      idx++;
    }
    return { labels, milk, breast, night, day, wake, stool, temp, happy, calm, cry };
  },

  // 报表入口统一使用 _viewReportButton，避免分析页内联图表与完整报告重复展示。

  // ============================================================
  // AI 解读
  // ============================================================
  _aiCard(range) {
    const label = range === 'daily' ? '日' : (range === 'week' ? '周' : '月');
    return `
      <div class="card ai-insight-card ai-disabled-card">
        <div class="aii-head">
          <div class="aii-title">${Lucide.icon('sparkles', 16, 'var(--color-accent)')} ${label}趋势解读</div>
          <span class="ai-disabled-label">AI功能暂未启用</span>
        </div>
        <div class="aii-body" id="ai-insight-body">
          <div class="aii-placeholder">当前仅提供确定性统计、趋势图和报表，不生成自然语言解读</div>
        </div>
      </div>`;
  },

  async _triggerAIReview(range) {
    const bodyEl = document.getElementById('ai-insight-body');
    if (!bodyEl) return;
    bodyEl.innerHTML = `<div class="aii-loading"><div class="spinner-sm"></div><span>AI 分析中...</span></div>`;
    try {
      const baby = Utils.getBabyInfo();
      const monthAge = baby ? Utils.calcMonthAge(baby.birthDate) : 0;
      const stats = this._weekStats || {};
      if (range === 'daily') {
        const dailyDims = [
          { label: '今日奶量', status: 'ok', text: `${this._computeDailyData().kpi?.[0]?.v || 0}ml`, hint: '今日记录', advice: '' },
          { label: '今日喂养', status: 'ok', text: `${this._computeDailyData().kpi?.[1]?.v || 0}次`, hint: '今日记录', advice: '' },
          { label: '今日睡眠', status: 'ok', text: `${this._computeDailyData().kpi?.[2]?.v || 0}h`, hint: '今日记录', advice: '' },
          { label: '今日排便', status: 'ok', text: `${this._computeDailyData().kpi?.[3]?.v || 0}次`, hint: '今日记录', advice: '' }
        ];
        const result = API.aiAssess ? await API.aiAssess(monthAge, dailyDims) : null;
        const text = result?.assessment || result?.text || '今日记录已汇总，建议结合宝宝精神状态持续观察。';
        bodyEl.innerHTML = `<div class="aii-text">${Utils.escapeHtml(text)}</div>`;
        return;
      }
      const rangeType = range === 'month' ? 'month' : 'week';
      const rangeLabel = rangeType === 'week' ? '本周' : '本月';
      const weekData = this._weekData || {};
      const records = weekData.records || {};
      const ref = APP_CONFIG.healthReference || {};
      const startISO = rangeType === 'week' ? this._computeWeekData().startISO : (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + this._monthOffset); return Utils.formatDate(d); })();
      const endISO = rangeType === 'week' ? this._computeWeekData().endISO : (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + this._monthOffset + 1); d.setDate(0); return Utils.formatDate(d); })();
      const ageWeeks = Math.max(0, Math.floor((monthAge * 30) / 7));
      const findRef = (list) => this._findRef(list, ageWeeks);
      const status = (value, r, keyMin, keyMax) => { if (value == null || !r) return 'none'; const min = r[keyMin] ?? r.min ?? 0; const max = r[keyMax] ?? r.max ?? 999; return value >= min && value <= max ? 'ok' : (value < min * .8 || value > max * 1.2 ? 'danger' : 'warn'); };
      const daily = weekData.dailyStats || {};
      const dailyEntries = Object.entries(daily).filter(([date]) => date >= startISO && date <= endISO).sort((a, b) => a[0].localeCompare(b[0]));
      const periodStats = this._computeWeekStats(daily, startISO, endISO, records);
      const milkByDay = dailyEntries.map(([, s]) => s.feedingML || 0);
      const avgMilk = dailyEntries.length ? Math.round(milkByDay.reduce((a, b) => a + b, 0) / dailyEntries.length) : 0;
      const avgSleep = dailyEntries.filter(([, s]) => s.sleepMin > 0).length ? Math.round(dailyEntries.reduce((a, [, s]) => a + (s.sleepMin || 0), 0) / dailyEntries.filter(([, s]) => s.sleepMin > 0).length / 60 * 10) / 10 : 0;
      const latestGrowth = (records.growth || []).slice().sort((a, b) => String(b.date || b.time || '').localeCompare(String(a.date || a.time || '')))[0] || {};
      const moodCounts = { baby: {}, mom: {} };
      (records.mood || []).filter(m => (!m.date || (m.date >= startISO && m.date <= endISO))).forEach(m => { const key = m.recordType === 'mom_mood' ? 'mom' : 'baby'; const label = typeof m.mood === 'object' ? (m.mood.label || m.mood.name) : m.mood; if (label) moodCounts[key][label] = (moodCounts[key][label] || 0) + 1; });
      const topMood = obj => Object.keys(obj).sort((a, b) => obj[b] - obj[a])[0] || '未记录';
      const tempRecords = (records.health || []).filter(r => r.date >= startISO && r.date <= endISO && ['temperature', 'temp'].includes(r.type || r.recordType));
      const tempHigh = tempRecords.filter(r => parseFloat(r.value || r.tempValue) >= 37.5).length;
      const cleanCount = dailyEntries.reduce((n, [, s]) => n + (s.clean || 0), 0);
      const walkMinutes = dailyEntries.reduce((n, [, s]) => n + (s.walkMin || 0), 0);
      const vaccine = records.vaccine || {};
      const vaccineRecords = vaccine.records || vaccine.vaccines || {};
      const insights = periodStats.insights || [];
      const insightsSummary = insights.length ? { total: insights.length, warn: insights.filter(i => i.tag === 'warn').map(i => i.label).join('、'), danger: insights.filter(i => i.tag === 'danger').map(i => i.label).join('、'), celebration: insights.filter(i => i.tag === 'celebration').map(i => i.label).join('、') } : null;
      const milkRef = findRef(ref.dailyMilkRef), sleepRef = findRef(ref.sleepHoursRef), stoolRef = findRef(ref.stoolRef);
      const dims = [
        { domain: '喂养', metrics: [{ name: '周期总奶量', value: `${periodStats.totalMilk || stats.totalMilk || 0}ml`, status: 'ok' }, { name: '日均奶量', value: `${avgMilk}ml/天`, status: status(avgMilk, milkRef, 'mlMin', 'mlMax') }, { name: '喂养次数', value: `${periodStats.totalFeeds || stats.totalFeeds || 0}次`, status: 'ok' }, { name: '奶量趋势', value: this._describeTrend(milkByDay), status: periodStats.insights?.some(i => i.id === 'R1') ? 'warn' : 'ok' }] },
        { domain: '睡眠', metrics: [{ name: '日均睡眠', value: `${avgSleep}h`, status: status(avgSleep, sleepRef, 'hoursMin', 'hoursMax') }] },
        { domain: '排便', metrics: [{ name: '排便天数', value: `${periodStats.totalStoolDays || stats.totalStoolDays || 0}天`, status: 'ok' }, { name: '排便次数', value: `${periodStats.totalStool || stats.totalStool || 0}次`, status: status(periodStats.totalStoolDays || stats.totalStoolDays || 0, stoolRef, 'min', 'max') }] },
        { domain: '健康', metrics: [{ name: '体温异常记录', value: `${tempHigh}次`, status: tempHigh ? 'warn' : 'ok' }] },
        { domain: '清洁护理', metrics: [{ name: '护理记录', value: `${cleanCount}次`, status: cleanCount ? 'ok' : 'none' }] },
        { domain: '外出活动', metrics: [{ name: '外出时长', value: `${Math.round(walkMinutes / 60 * 10) / 10}h`, status: walkMinutes ? 'ok' : 'none' }] },
        { domain: '心情', metrics: [{ name: '宝宝主要情绪', value: topMood(moodCounts.baby), status: Object.keys(moodCounts.baby).length ? 'ok' : 'none' }, { name: '妈妈主要情绪', value: topMood(moodCounts.mom), status: Object.keys(moodCounts.mom).length ? 'ok' : 'none' }] },
        { domain: '体格与疫苗', metrics: [{ name: '最近体重', value: latestGrowth.weight != null ? `${latestGrowth.weight}kg` : '未记录', status: latestGrowth.weight != null ? 'ok' : 'none' }, { name: '疫苗记录', value: Object.keys(vaccineRecords).length ? '已维护' : '未记录', status: Object.keys(vaccineRecords).length ? 'ok' : 'none' }] },
        { domain: '里程碑', metrics: [{ name: '周期内里程碑', value: `${(records.milestone || []).filter(m => { const date = m.date || Utils.localDateFromISO(m.time); return date >= startISO && date <= endISO; }).length}项`, status: (records.milestone || []).length ? 'ok' : 'none' }] }
      ];
      const payload = { rangeType, startDate: startISO, endDate: endISO, monthAge, dims, insights: insightsSummary, referenceRanges: { milk: milkRef ? `${milkRef.mlMin}-${milkRef.mlMax}ml/天` : '–', sleep: sleepRef ? `${sleepRef.hoursMin}-${sleepRef.hoursMax}h/天` : '–', stool: stoolRef ? `${stoolRef.min}-${stoolRef.max}天/周期` : '–' }, historicalCompare: null };
      const result = API.aiAssessReport ? await API.aiAssessReport(payload) : null;
      const text = result?.assessment || result?.text || `${rangeLabel}数据已汇总，建议结合趋势与宝宝精神状态持续观察。`;
      bodyEl.innerHTML = `<div class="aii-text">${Utils.escapeHtml(text)}</div>`;
    } catch (e) {
      bodyEl.innerHTML = `<div class="aii-text aii-error">AI 解读暂时不可用：${Utils.escapeHtml(e.message)}</div>`;
    }
  },

  // ============================================================
  // 图表绘制（Canvas）
  // ============================================================
  _drawCharts() {
    if (this._currentSubTab === 'daily') {
      this._drawDailyCharts();
    } else if (this._currentSubTab === 'weekly') {
      const d = this._computeWeekData();
      const feedCanvas = document.getElementById('feedChart');
      if (feedCanvas) {
        AnalyticsCharts.drawBarChart(feedCanvas, { labels: d.labels, data: d.milk, yUnit: 'ml', color: '#6EA8D9' });
        this._drawRightAxisLine(feedCanvas, d.breast, '次', '#E8927C');
      }
      const sleepCanvas = document.getElementById('sleepChart');
      if (sleepCanvas) {
        AnalyticsCharts.drawStackedBarChart(sleepCanvas, {
          labels: d.labels,
          datasets: [
            { label: '夜间', data: d.night, color: '#5C7CBA' },
            { label: '日间', data: d.day,  color: '#9ABED4' }
          ],
          yUnit: 'h'
        });
      }
    } else if (this._currentSubTab === 'monthly') {
      const d = this._computeMonthData();
      const heatCanvas = document.getElementById('heatChart');
      if (heatCanvas) {
        AnalyticsCharts.drawHeatCalendar(heatCanvas, {
          data: d.heatData, maxValue: Math.max(...d.heatData.map(h => h.value), 1)
        });
      }
      const monthFeedCanvas = document.getElementById('monthFeedChart');
      if (monthFeedCanvas) {
        AnalyticsCharts.drawBarChart(monthFeedCanvas, { labels: d.labels, data: d.milk, yUnit: 'ml', color: '#6EA8D9' });
      }
    } else if (this._currentSubTab === 'trend') {
      this._drawTrendCharts();
    }
  },

  /** 在柱状图上叠加右轴折线（亲喂次数/夜醒） */
  _drawRightAxisLine(canvas, data, unit, color) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const padding = { top: 26, right: 44, bottom: 34, left: 52 };
    const chartW = rect.width - padding.left - padding.right;
    const chartH = rect.height - padding.top - padding.bottom;
    const maxB = Math.max(...data, 1);
    const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW / 2;
    ctx.fillStyle = color; ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const v = Math.round(maxB - (maxB / 4) * i);
      ctx.fillText(v + unit, rect.width - padding.right + 6, padding.top + (chartH / 4) * i);
    }
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = padding.left + (data.length > 1 ? xStep * i : chartW / 2);
      const y = padding.top + chartH - chartH * (v / maxB);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    data.forEach((v, i) => {
      const x = padding.left + (data.length > 1 ? xStep * i : chartW / 2);
      const y = padding.top + chartH - chartH * (v / maxB);
      ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
    });
  },

  _drawTrendCharts() {
    const d = this._computeTrendData();
    const feedC = document.getElementById('trFeed');
    if (feedC) {
      AnalyticsCharts.drawBarChart(feedC, { labels: d.labels, data: d.milk, yUnit: 'ml', color: '#6EA8D9' });
      this._drawRightAxisLine(feedC, d.breast, '次', '#E8927C');
    }
    const sleepC = document.getElementById('trSleep');
    if (sleepC) {
      AnalyticsCharts.drawStackedBarChart(sleepC, {
        labels: d.labels,
        datasets: [
          { label: '夜间', data: d.night, color: '#5C7CBA' },
          { label: '日间', data: d.day,  color: '#9ABED4' }
        ],
        yUnit: 'h'
      });
      this._drawRightAxisLine(sleepC, d.wake, '次', '#EDB85C');
    }
    const stoolC = document.getElementById('trStool');
    if (stoolC) AnalyticsCharts.drawBarChart(stoolC, { labels: d.labels, data: d.stool, yUnit: '次', color: '#93A8D8' });
    const tempC = document.getElementById('trTemp');
    if (tempC) {
      AnalyticsCharts.drawLineChart(tempC, {
        labels: d.labels, yUnit: '℃',
        datasets: [
          { data: d.temp, color: '#CE6355' },
          { data: Array.from({ length: d.labels.length }, () => 37.5), color: '#EDB85C', dash: true }
        ]
      });
    }
    const moodC = document.getElementById('trMood');
    if (moodC) {
      AnalyticsCharts.drawStackedBarChart(moodC, {
        labels: d.labels,
        datasets: [
          { label: '开心', data: d.happy, color: '#7FBF9B' },
          { label: '平静', data: d.calm,  color: '#EDB85C' },
          { label: '哭闹', data: d.cry,   color: '#CE6355' }
        ],
        yUnit: '天'
      });
    }
  },

  /** 日报图表：喂养分布（横向条形图）+ 睡眠时间轴（0-24h） */
  _drawDailyCharts() {
    const data = this._computeDailyData();
    const rootStyle = getComputedStyle(document.documentElement);
    const token = (name, fallback) => rootStyle.getPropertyValue(name).trim() || fallback;
    const chartBg = token('--color-bg-raised', '#FFFFFF');
    const chartText = token('--color-text-primary', '#2D2A26');
    const chartTextSecondary = token('--color-text-secondary', '#6B655D');
    const chartTextMuted = token('--color-text-muted', '#9A948C');
    const chartBorder = token('--color-border-subtle', 'rgba(45,42,38,.08)');
    const chartTrack = token('--color-bg-sunken', '#F2EFEA');
    const breastColor = token('--color-accent', '#E8927C');
    const formulaColor = token('--color-processing', '#6EA8D9');
    const sleepColor = token('--color-processing-deep', '#5C7CBA');

    // 喂养分布：母乳 vs 配方奶 横向条形图
    const feedCanvas = document.getElementById('dailyFeedChart');
    if (feedCanvas) {
      const ctx = feedCanvas.getContext('2d');
      const { W, H } = AnalyticsCharts._setupCanvas(feedCanvas, ctx);
      ctx.fillStyle = chartBg; ctx.fillRect(0, 0, W, H);

      const padL = 70, padR = 60, padT = 20, padB = 16;
      const chartW = W - padL - padR, chartH = H - padT - padB;
      const barH = chartH / 2 * 0.55;
      const gap = chartH / 2;
      const maxVal = Math.max(data.breastCount, data.formulaCount, 1);

      const items = [
        { label: '母乳', count: data.breastCount, ml: data.breastML, color: breastColor },
        { label: '配方奶', count: data.formulaCount, ml: data.formulaML, color: formulaColor },
      ];

      items.forEach((item, i) => {
        const y = padT + gap * i + (gap - barH) / 2;
        const bw = chartW * Math.min(item.count / maxVal, 1);

        // 标签
        ctx.fillStyle = chartTextSecondary; ctx.font = '12px -apple-system, sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(item.label, padL - 8, y + barH / 2);

        // 条形
        const g = ctx.createLinearGradient(padL, y, padL + bw, y);
        g.addColorStop(0, item.color); g.addColorStop(1, item.color + '99');
        ctx.fillStyle = g;
        AnalyticsCharts._roundRect(ctx, padL, y, Math.max(bw, 2), barH, 5); ctx.fill();

        // 数值
        ctx.fillStyle = chartText; ctx.font = 'bold 13px -apple-system, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(`${item.count}次${item.ml > 0 ? ` / ${item.ml}ml` : ''}`, padL + bw + 6, y + barH / 2);
      });
    }

    // 睡眠时间轴：0-24h 水平条
    const sleepCanvas = document.getElementById('dailySleepChart');
    if (sleepCanvas) {
      const ctx = sleepCanvas.getContext('2d');
      const { W, H } = AnalyticsCharts._setupCanvas(sleepCanvas, ctx);
      ctx.fillStyle = chartBg; ctx.fillRect(0, 0, W, H);

      const padL = 30, padR = 30, padT = 16, padB = 24;
      const chartW = W - padL - padR, chartH = H - padT - padB;
      const trackH = chartH * 0.5;
      const trackY = padT + (chartH - trackH) / 2;

      // 背景轨道
      ctx.fillStyle = chartTrack; ctx.fillRect(padL, trackY, chartW, trackH);
      ctx.strokeStyle = chartBorder; ctx.lineWidth = 1;
      ctx.strokeRect(padL, trackY, chartW, trackH);

      // 睡眠段
      const segs = data.sleepSegs || [];
      segs.forEach(seg => {
        const x1 = padL + chartW * (seg.start / 24);
        const x2 = padL + chartW * (seg.end / 24);
        const w = Math.max(x2 - x1, 3);
        const g = ctx.createLinearGradient(x1, trackY, x1, trackY + trackH);
        g.addColorStop(0, sleepColor); g.addColorStop(1, sleepColor);
        ctx.fillStyle = g;
        AnalyticsCharts._roundRect(ctx, x1, trackY + 2, w, trackH - 4, 4); ctx.fill();
      });

      // 刻度
      const hours = [0, 6, 12, 18, 24];
      ctx.fillStyle = chartTextMuted; ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      hours.forEach(h => {
        const x = padL + chartW * (h / 24);
        ctx.fillText(h + 'h', x, padT + chartH + 4);
        if (h > 0 && h < 24) {
          ctx.strokeStyle = chartBorder; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + chartH); ctx.stroke();
        }
      });
    }
  },

  // ============================================================
  // 下载 / 分享（迁移 v100 report-page 能力）
  // ============================================================
  _todayStr() { return Utils.todayStr(); },

  /** 单图表 PNG 下载 */
  download(canvasId, name) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) { Utils.showToast('图表未渲染，请稍候'); return; }
    const ok = AnalyticsCharts.downloadCanvas(canvas, `一一_${name}_${this._todayStr()}.png`);
    Utils.showToast(ok ? `已下载「${name}」PNG（2x 高清）` : '下载失败，请重试');
  },

  /** 下载报表：SVG foreignObject 捕获整页长图导出 PNG（v100 report-page 能力） */
  async downloadReport(range) {
    const label = range === 'daily' ? '日报' : (range === 'week' ? '周报' : '月报');
    const container = document.getElementById('analytics-content');
    if (!container) { Utils.showToast('报表内容未找到'); return; }
    Utils.showProcessing('正在生成图片...');
    try {
      const pal = this._rptPalette();
      // 收集所有 CSS
      let allCSS = '';
      document.querySelectorAll('style').forEach(s => { allCSS += s.textContent + '\n'; });
      try {
        Array.from(document.styleSheets).forEach(sheet => {
          if (sheet.href && !sheet.href.startsWith(location.origin)) return;
          let rules = null;
          try { rules = sheet.cssRules; } catch (e) { return; }
          if (rules) Array.from(rules).forEach(r => { allCSS += r.cssText + '\n'; });
        });
      } catch (e) { /* 忽略样式收集异常 */ }

      const canvas = await this._containerToCanvas(container, allCSS, pal);
      if (!canvas) { Utils.hideLoading(); Utils.showToast('渲染失败，请重试'); return; }
      Utils.hideLoading();
      this._canvasToDownload(canvas, `一一_${label}_${this._todayStr()}.png`);
    } catch (e) {
      Utils.hideLoading();
      console.error('下载报表失败:', e);
      Utils.showToast('下载失败: ' + e.message);
    }
  },

  /** 分享报表：navigator.share 优先，降级下载（v100 report-page 能力） */
  async shareReport(range) {
    const label = range === 'daily' ? '日报' : (range === 'week' ? '周报' : '月报');
    const container = document.getElementById('analytics-content');
    if (!container) { Utils.showToast('报表内容未找到'); return; }
    Utils.showProcessing('正在生成分享图...');
    try {
      const pal = this._rptPalette();
      let allCSS = '';
      document.querySelectorAll('style').forEach(s => { allCSS += s.textContent + '\n'; });
      try {
        Array.from(document.styleSheets).forEach(sheet => {
          if (sheet.href && !sheet.href.startsWith(location.origin)) return;
          let rules = null;
          try { rules = sheet.cssRules; } catch (e) { return; }
          if (rules) Array.from(rules).forEach(r => { allCSS += r.cssText + '\n'; });
        });
      } catch (e) { /* 忽略 */ }
      const canvas = await this._containerToCanvas(container, allCSS, pal);
      if (!canvas) { Utils.hideLoading(); Utils.showToast('渲染失败，请重试'); return; }
      Utils.hideLoading();
      await this._shareCanvas(canvas, `一一_${label}_${this._todayStr()}.png`);
    } catch (e) {
      Utils.hideLoading();
      console.warn('分享失败，降级下载:', e);
      this._canvasToDownload(this._fallbackCanvas(container), `一一_${label}_${this._todayStr()}.png`);
    }
  },

  /** 报表绘图调色板（V2 token 化，dark/night 自适应） */
  _rptPalette() {
    const v = (name, fb) => {
      if (!window.__UI_V3__) return fb;
      const val = getComputedStyle(document.documentElement).getPropertyValue(name);
      return (val || '').trim() || fb;
    };
    return {
      accent: v('--color-accent', '#c4785a'),
      ink: v('--color-text-primary', '#4a3728'),
      inkSoft: v('--color-text-secondary', '#8b6f5e'),
      inkMuted: v('--color-text-muted', '#a08070'),
      white: '#ffffff',
      cardBg: v('--color-bg-raised', 'rgba(255,255,255,0.78)'),
      warmBg: '#fff8f0',
    };
  },

  /** 将内容容器渲染为 canvas（SVG foreignObject，带超时兜底 + taint 检测） */
  _containerToCanvas(container, cssText, pal, timeoutMs = 8000) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (canvas) => { if (!done) { done = true; clearTimeout(timer); resolve(canvas); } };
      const timer = setTimeout(() => {
        console.warn('SVG 渲染超时，使用文本回退');
        finish(this._fallbackCanvas(container));
      }, timeoutMs);

      try {
        const rect = container.getBoundingClientRect();
        const w = rect.width || 375;
        const h = rect.height || 600;
        const clone = container.cloneNode(true);
        clone.querySelectorAll('img').forEach(img => {
          const alt = img.alt || '';
          const span = document.createElement('span');
          span.textContent = alt || '';
          span.style.fontSize = '48px';
          img.parentNode.replaceChild(span, img);
        });
        const safeCss = (cssText || '')
          .replace(/url\([^)]*\)/gi, '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;');
        const htmlContent = new XMLSerializer().serializeToString(clone);
        const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;overflow:hidden;font-family:'PingFang SC','Microsoft YaHei',sans-serif">
              <style>${safeCss}</style>
              ${htmlContent}
            </div>
          </foreignObject>
        </svg>`;
        const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(w * 2);
            canvas.height = Math.round(h * 2);
            const ctx = canvas.getContext('2d');
            ctx.scale(2, 2);
            ctx.fillStyle = pal.white;
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            try { canvas.toDataURL('image/png'); } catch (e) {
              console.warn('canvas 被跨域污染，使用文本回退:', e.message);
              finish(this._fallbackCanvas(container));
              return;
            }
            finish(canvas);
          } catch (e) {
            console.warn('canvas 绘制失败，使用文本回退:', e);
            finish(this._fallbackCanvas(container));
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          console.warn('SVG 渲染失败，使用文本回退');
          finish(this._fallbackCanvas(container));
        };
        img.src = url;
      } catch (e) {
        console.warn('页面渲染异常:', e);
        finish(this._fallbackCanvas(container));
      }
    });
  },

  /** 文本回退：将容器文字渲染为简单 canvas */
  _fallbackCanvas(container) {
    try {
      const pal = this._rptPalette();
      const rect = container.getBoundingClientRect();
      const w = rect.width || 375;
      const h = rect.height || 600;
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = pal.warmBg;
      ctx.fillRect(0, 0, w, h);
      const text = container.innerText;
      const lines = text.split('\n').filter(l => l.trim());
      ctx.textAlign = 'center';
      ctx.fillStyle = pal.ink;
      const title = lines.find(l => /日报|周报|月报/.test(l)) || lines[0] || '';
      if (title) {
        ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(title, w / 2, 100);
      }
      ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif';
      const dataLines = lines.filter(l => !/日报|周报|月报|OneOne/.test(l));
      dataLines.forEach((line, i) => {
        if (i < 8) {
          ctx.fillStyle = pal.ink;
          ctx.fillText(line, w / 2, 160 + i * 28);
        }
      });
      ctx.font = '12px "PingFang SC", sans-serif';
      ctx.fillStyle = pal.inkMuted;
      ctx.fillText('OneOne 成长日记', w / 2, h - 30);
      return canvas;
    } catch (e) {
      return null;
    }
  },

  /** 分享 canvas：navigator.share 文件分享优先，不可用/取消则降级下载 */
  async _shareCanvas(canvas, filename) {
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) { this._canvasToDownload(canvas, filename); return; }
      const nav = navigator;
      if (nav.share && nav.canShare) {
        const file = new File([blob], filename, { type: 'image/png' });
        if (nav.canShare({ files: [file] })) {
          try {
            await nav.share({ files: [file], title: 'OneOne 成长日记', text: '宝宝的成长报告' });
            Utils.showToast('报表已分享');
            return;
          } catch (e) {
            if (e && e.name === 'AbortError') return;
          }
        }
      }
      this._canvasToDownload(canvas, filename);
    } catch (e) {
      console.warn('分享失败，降级下载:', e);
      this._canvasToDownload(canvas, filename);
    }
  },

  /** 将 canvas 导出为 PNG 下载；toBlob 缺失/失败时降级 toDataURL；微信环境兜底 */
  _canvasToDownload(canvas, filename) {
    try {
      if (canvas.toBlob) {
        canvas.toBlob(blob => {
          if (!blob) { this._downloadViaDataURL(canvas, filename); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          let revoked = false;
          const doRevoke = () => { if (!revoked) { revoked = true; URL.revokeObjectURL(url); } };
          setTimeout(doRevoke, 30000);
          try { window.addEventListener('beforeunload', doRevoke, { once: true }); } catch (e) {}
          this._wechatDownloadFallback(url, filename);
          Utils.showToast('报表图片已下载');
        }, 'image/png');
      } else {
        this._downloadViaDataURL(canvas, filename);
      }
    } catch (e) {
      console.warn('toBlob 失败，改用 dataURL:', e);
      this._downloadViaDataURL(canvas, filename);
    }
  },

  /** 微信环境兜底下载——blob URL 在新窗口打开供长按保存 */
  _wechatDownloadFallback(url, filename) {
    const isWechat = /MicroMessenger/i.test(navigator.userAgent);
    if (!isWechat) return;
    setTimeout(() => {
      try {
        const w = window.open(url, '_blank');
        if (w) {
          setTimeout(() => {
            try { w.document.title = filename; } catch (e) {}
          }, 300);
        }
      } catch (e) { console.warn('微信兜底下载弹窗失败:', e); }
    }, 800);
  },

  /** dataURL 兜底下载（toBlob 不支持的旧内核） */
  _downloadViaDataURL(canvas, filename) {
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      this._wechatDownloadFallback(url, filename);
      Utils.showToast('报表图片已下载');
    } catch (e) {
      console.error('图片导出失败:', e);
      Utils.showToast('图片生成失败: ' + e.message);
    }
  },

  // ============================================================
  // 日历（含每日汇总/喂养明细/待办/里程碑下钻）
  // ============================================================
  _buildCalendarView() {
    const cm = this._currentCalMonth || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    const dailyStats = this._weekData?.dailyStats || {};
    const today = new Date();
    const todayISO = Utils.formatDate(today);

    const firstDay = new Date(cm.year, cm.month - 1, 1);
    const lastDay = new Date(cm.year, cm.month, 0);
    const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push({});
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(cm.year, cm.month - 1, d);
      const dateStr = Utils.formatDate(date);
      const isToday = dateStr === todayISO;
      const isFuture = date > today;
      const dots = [];
      if (!isFuture && dailyStats[dateStr]) {
        const ds = dailyStats[dateStr];
        if (ds.feedingCount > 0) dots.push('var(--color-accent)');
        if (ds.sleepMin > 0) dots.push('var(--color-success)');
        if (ds.stoolCount > 0) dots.push('var(--color-highlight)');
        if (ds.bath > 0) dots.push('var(--color-primary)');
      }
      cells.push({ day: d, dateStr, isToday, isFuture, dots });
    }

    const weekdayLabels = ['一','二','三','四','五','六','日'].map(d => `<div class="cal-wd">${d}</div>`).join('');
    const dayCells = cells.map(cell => {
      if (!cell.day) return '<div class="cal-day-empty"></div>';
      const cls = [cell.isToday ? 'today' : '', cell.isFuture ? 'future' : ''].filter(Boolean).join(' ');
      const dots = (cell.dots || []).map(c => `<i style="background:${c}"></i>`).join('');
      return `<div class="cal-day ${cls}" onclick="AnalyticsPage._onCalDayClick('${cell.dateStr}')">
        <span class="cal-num">${cell.day}</span>
        ${dots ? `<div class="dots">${dots}</div>` : ''}
      </div>`;
    }).join('');

    return `
      <div class="analytics-view" id="view-calendar">
        <div class="card cal-nav">
          <button class="cal-nav-btn" onclick="AnalyticsPage._navigateCalMonth(-1)">${Lucide.icon('chevron-left', 18)}</button>
          <div class="cal-month-label">${cm.year}年${cm.month}月</div>
          <button class="cal-nav-btn" onclick="AnalyticsPage._navigateCalMonth(1)">${Lucide.icon('chevron-right', 18)}</button>
        </div>
        <div class="card cal-grid-wrap">
          <div class="cal-grid">${weekdayLabels}${dayCells}</div>
          <div class="cal-legend">
            <div class="cl-item"><i style="background:var(--color-accent)"></i>喂养</div>
            <div class="cl-item"><i style="background:var(--color-success)"></i>睡眠</div>
            <div class="cl-item"><i style="background:var(--color-highlight)"></i>排便</div>
            <div class="cl-item"><i style="background:var(--color-primary)"></i>洗澡</div>
          </div>
        </div>

        <div class="cal-sheet" id="cal-day-sheet">
          <div class="cs-grab"></div>
          <div class="cs-header">
            <div class="cs-title" id="cs-title">选择日期</div>
            <button class="cs-close" onclick="AnalyticsPage._closeCalSheet()">${Lucide.icon('x', 16)}</button>
          </div>
          <div class="cs-body" id="cs-body"></div>
        </div>
        <div class="cal-mask" id="cal-mask" onclick="AnalyticsPage._closeCalSheet()"></div>
      </div>
    `;
  },

  async _onCalDayClick(dateStr) {
    const sheet = document.getElementById('cal-day-sheet');
    const mask = document.getElementById('cal-mask');
    const titleEl = document.getElementById('cs-title');
    const bodyEl = document.getElementById('cs-body');
    if (!sheet || !mask) return;

    titleEl.textContent = dateStr;
    bodyEl.innerHTML = `<div class="cs-loading"><div class="spinner-sm"></div><span>加载中...</span></div>`;
    sheet.classList.add('on');
    mask.classList.add('on');

    try {
      const snapshot = this._weekData?.snapshot?.records ? this._weekData.snapshot : await API.getUnifiedSnapshot({ startDate: dateStr, endDate: dateStr });
      const records = snapshot.records || {};
      const feeding = { records: records.feeding || [] };
      const stool = { records: records.stool || [] };
      const sleep = { records: records.sleep || [] };
      const clean = { records: records.clean || [] };
      const todo = { records: records.todo || [] };
      const milestone = { records: records.milestone || [] };
      const mood = { records: records.mood || [] };

      const feedRecs = (feeding?.records || []).filter(r => Utils.localDateFromISO(r.time) === dateStr);
      const stoolRecs = (stool?.records || []).filter(r => Utils.localDateFromISO(r.time) === dateStr);
      const sleepRecs = (sleep?.records || []).filter(r => Utils.localDateFromISO(r.startTime || r.start) === dateStr);
      const cleanRecs = (clean?.records || []).filter(r => Utils.localDateFromISO(r.time) === dateStr);
      const todoRecs = ((todo?.records || [])).filter(r => r.date === dateStr);
      const moodRecs = (mood?.records || []).filter(r => (r.date || Utils.localDateFromISO(r.time)) === dateStr);
      const mileRecs = ((milestone?.records || [])).filter(r => (r.date || '').slice(0, 10) === dateStr);

      const totalMilk = feedRecs.reduce((s, r) => s + (r.ml || r.amount || 0), 0);
      const totalSleep = sleepRecs.reduce((s, r) => {
        const start = new Date(r.startTime || r.start);
        const end = new Date(r.endTime || r.end || r.start);
        return s + Math.max(0, Math.round((end - start) / 60000));
      }, 0);

      let html = `
        <div class="cs-summary">
          <div class="cs-sum-item"><div class="cs-sum-v">${feedRecs.length}</div><div class="cs-sum-k">喂养</div></div>
          <div class="cs-sum-item"><div class="cs-sum-v">${totalMilk || '–'}<small>ml</small></div><div class="cs-sum-k">总奶量</div></div>
          <div class="cs-sum-item"><div class="cs-sum-v">${totalSleep > 0 ? Math.round(totalSleep / 60 * 10) / 10 + 'h' : '–'}</div><div class="cs-sum-k">睡眠</div></div>
          <div class="cs-sum-item"><div class="cs-sum-v">${stoolRecs.length}</div><div class="cs-sum-k">排便</div></div>
        </div>
      `;

      if (feedRecs.length > 0) {
        html += `<div class="cs-section-title">${Lucide.icon('droplet', 13)} 喂养明细 <span class="cs-count">${feedRecs.length}条</span></div>`;
        html += feedRecs.map(r => `
          <div class="cs-record-row">
            <span class="csr-time">${Utils.formatDate(r.time, 'HH:mm')}</span>
            <span class="csr-type">${r.type === 'breast' ? '亲喂' : r.type === 'bottle_breast' ? '母乳瓶喂' : '配方奶'}</span>
            <span class="csr-amount">${r.ml || r.amount || 0}ml</span>
          </div>
        `).join('');
      } else {
        html += `<div class="cs-section-title">${Lucide.icon('droplet', 13)} 喂养明细</div><div class="cs-empty">暂无记录</div>`;
      }

      if (sleepRecs.length > 0) {
        html += `<div class="cs-section-title">${Lucide.icon('moon', 13)} 睡眠记录 <span class="cs-count">${sleepRecs.length}条</span></div>`;
        html += sleepRecs.map(r => {
          const start = new Date(r.startTime || r.start);
          const end = new Date(r.endTime || r.end || r.start);
          const min = Math.max(0, Math.round((end - start) / 60000));
          return `<div class="cs-record-row">
            <span class="csr-time">${Utils.formatDate(r.startTime || r.start, 'HH:mm')}</span>
            <span class="csr-type">睡眠</span>
            <span class="csr-amount">${Math.floor(min / 60)}h ${min % 60}min</span>
          </div>`;
        }).join('');
      }

      if (stoolRecs.length > 0) {
        html += `<div class="cs-section-title">${Lucide.icon('circle-dot', 13)} 排便记录 <span class="cs-count">${stoolRecs.length}条</span></div>`;
        html += stoolRecs.map(r => `
          <div class="cs-record-row">
            <span class="csr-time">${Utils.formatDate(r.time, 'HH:mm')}</span>
            <span class="csr-type">${r.type === 'urine' ? '小便' : '大便'}${r.consistency ? ' · ' + r.consistency : ''}</span>
            <span class="csr-amount">${r.color || ''}</span>
          </div>
        `).join('');
      }

      html += `<div class="cs-section-title">${Lucide.icon('check-square', 13)} 待办事项 <span class="cs-count">${todoRecs.length}条</span></div>`;
      if (todoRecs.length > 0) {
        html += todoRecs.map(t => `
          <div class="cs-todo-item ${t.completed ? 'done' : ''}" id="todo-${t._id || t.id || ''}">
            <button class="cs-todo-check" onclick="AnalyticsPage._toggleTodo('${t._id || t.id || ''}')">
              ${Lucide.icon(t.completed ? 'check-square' : 'square', 15)}
            </button>
            <span class="cs-todo-text">${Utils.escapeHtml(t.title || '')}</span>
            <button class="cs-todo-del" onclick="AnalyticsPage._deleteTodo('${t._id || t.id || ''}')">${Lucide.icon('trash-2', 13)}</button>
          </div>
        `).join('');
      } else {
        html += `<div class="cs-empty">暂无待办</div>`;
      }
      html += `
        <div class="cs-add-todo">
          <input class="cs-todo-input" id="cs-todo-input" placeholder="添加待办事项..." />
          <button class="cs-todo-add-btn" onclick="AnalyticsPage._addTodo('${dateStr}')">${Lucide.icon('plus', 14)}</button>
        </div>
      `;

      html += `<div class="cs-section-title">${Lucide.icon('star', 13)} 里程碑 <span class="cs-count">${mileRecs.length}条</span></div>`;
      if (mileRecs.length > 0) {
        html += mileRecs.map(m => `
          <div class="cs-milestone-item">
            ${Lucide.icon('star', 14)}
            <span>${Utils.escapeHtml(m.title || m.name || '')}</span>
          </div>
        `).join('');
      } else {
        html += `<div class="cs-empty">暂无里程碑</div>`;
      }
      html += `
        <div class="cs-add-milestone">
          <input class="cs-mile-input" id="cs-mile-input" placeholder="记录里程碑..." />
          <button class="cs-mile-add-btn" onclick="AnalyticsPage._addMilestone('${dateStr}')">${Lucide.icon('plus', 14)}</button>
        </div>
      `;

      const moodRec = moodRecs[0];
      if (moodRec) {
        html += `<div class="cs-section-title">${Lucide.icon('smile', 13)} 心情</div>`;
        if (moodRec.recordType === 'mood' && moodRec.mood) {
          html += `<div class="cs-mood">${Lucide.icon('star', 13)} ${Utils.escapeHtml(moodRec.mood.label || '')}</div>`;
        }
      }

      bodyEl.innerHTML = html;
    } catch (e) {
      bodyEl.innerHTML = `<div class="cs-empty" style="padding:16px 0">加载失败：${Utils.escapeHtml(e.message)}</div>`;
    }
  },

  async _addTodo(dateStr) {
    const input = document.getElementById('cs-todo-input');
    if (!input) return;
    const title = input.value.trim();
    if (!title) { Utils.showToast('请输入待办内容'); return; }
    try {
      await API.createTodo(title, dateStr);
      Utils.showToast('已添加');
      input.value = '';
      this._onCalDayClick(dateStr);
    } catch (e) {
      Utils.showToast('添加失败：' + e.message);
    }
  },

  async _toggleTodo(todoId) {
    if (!todoId) return;
    try {
      await API.completeTodo(todoId);
      this._onCalDayClick(document.getElementById('cs-title')?.textContent || '');
    } catch (e) {
      Utils.showToast('操作失败');
    }
  },

  async _deleteTodo(todoId) {
    if (!todoId) return;
    if (!confirm('确定删除该待办？')) return;
    try {
      await API.deleteTodo(todoId);
      Utils.showToast('已删除');
      this._onCalDayClick(document.getElementById('cs-title')?.textContent || '');
    } catch (e) {
      Utils.showToast('删除失败');
    }
  },

  async _addMilestone(dateStr) {
    const input = document.getElementById('cs-mile-input');
    if (!input) return;
    const title = input.value.trim();
    if (!title) { Utils.showToast('请输入里程碑内容'); return; }
    try {
      await API.createMilestone({ title, date: dateStr });
      Utils.showToast('已记录里程碑');
      input.value = '';
      this._onCalDayClick(dateStr);
    } catch (e) {
      Utils.showToast('添加失败：' + e.message);
    }
  },

  _closeCalSheet() {
    document.getElementById('cal-day-sheet')?.classList.remove('on');
    document.getElementById('cal-mask')?.classList.remove('on');
  },

  _navigateCalMonth(dir) {
    let { year, month } = this._currentCalMonth || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    month += dir;
    if (month > 12) { month = 1; year++; }
    if (month < 1) { month = 12; year--; }
    this._currentCalMonth = { year, month };
    const contentEl = document.getElementById('analytics-content');
    if (contentEl) contentEl.innerHTML = this._buildCalendarView();
  },

  // ============================================================
  // 通用
  // ============================================================
  _renderCurrent() {
    const contentEl = document.getElementById('analytics-content');
    if (!contentEl) return;
    switch (this._currentSubTab) {
      case 'daily':    contentEl.innerHTML = this._dailyView(); break;
      case 'weekly':   contentEl.innerHTML = this._weeklyView(); break;
      case 'monthly':  contentEl.innerHTML = this._monthlyView(); break;
      case 'trend':    contentEl.innerHTML = this._trendView(); break;
      case 'calendar': contentEl.innerHTML = this._buildCalendarView(); break;
    }
    if (this._currentSubTab === 'trend') {
      requestAnimationFrame(() => setTimeout(() => this._drawCharts(), 30));
    }
  },

  _bindEvents() {
    // 暂无全局事件
  },
};

/* ============================================================
   AnalyticsCharts —— Canvas 图表工具（v125 新增，避免与 charts-v2.js 冲突）
   ============================================================ */
const AnalyticsCharts = {
  _setupCanvas(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { W: rect.width, H: rect.height };
  },
  _drawGrid(ctx, W, H, labels, yMax, yUnit) {
    const padding = { top: 26, right: 44, bottom: 34, left: 52 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(45,42,38,.07)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(padding.left + chartW, y); ctx.stroke();
      const val = Math.round(yMax - (yMax / 4) * i);
      ctx.fillStyle = '#9A948C'; ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(val + (yUnit || ''), padding.left - 8, y);
    }
    ctx.setLineDash([]);
    const xStep = labels.length > 1 ? chartW / (labels.length - 1) : chartW / 2;
    labels.forEach((lb, i) => {
      if (labels.length > 10 && i % Math.ceil(labels.length / 8) !== 0) return;
      const x = padding.left + (labels.length > 1 ? xStep * i : chartW / 2);
      ctx.fillStyle = '#9A948C'; ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(lb, x, H - padding.bottom + 8);
    });
    return { padding, chartW, chartH, xStep };
  },
  _autoYMax(values) {
    const max = Math.max(...values, 1);
    if (max <= 10) return Math.ceil(max * 1.2);
    return Math.ceil(max * 1.2 / 50) * 50 || 100;
  },

  /* 柱状图 */
  drawBarChart(canvas, cfg) {
    const ctx = canvas.getContext('2d');
    const { labels, data, yUnit } = cfg;
    const yMax = cfg.yMax || this._autoYMax(data);
    const { W, H } = this._setupCanvas(canvas, ctx);
    const { padding, chartW, chartH } = this._drawGrid(ctx, W, H, labels, yMax, yUnit);
    const barGap = chartW / data.length;
    const barWidth = Math.max(6, Math.min(barGap * 0.62, 44));
    const color = cfg.color || '#E8927C';
    data.forEach((val, i) => {
      const x = padding.left + barGap * i + barGap / 2 - barWidth / 2;
      const bh = chartH * Math.min(val / yMax, 1);
      const y = padding.top + chartH - bh;
      const g = ctx.createLinearGradient(0, y, 0, y + bh);
      g.addColorStop(0, color); g.addColorStop(1, color + '88');
      ctx.fillStyle = g;
      this._roundRect(ctx, x, y, barWidth, bh, 4); ctx.fill();
    });
  },

  /* 折线图（带气泡数据点） */
  drawLineChart(canvas, cfg) {
    const ctx = canvas.getContext('2d');
    const { labels, datasets, yUnit } = cfg;
    const yMax = cfg.yMax || this._autoYMax(datasets.flatMap(d => d.data));
    const { W, H } = this._setupCanvas(canvas, ctx);
    const { padding, chartH, xStep } = this._drawGrid(ctx, W, H, labels, yMax, yUnit);
    datasets.forEach(ds => {
      const color = ds.color || '#E8927C';
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (ds.dash) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ds.data.forEach((v, i) => {
        const x = padding.left + (ds.data.length > 1 ? xStep * i : 0);
        const y = padding.top + chartH - chartH * Math.min(v / yMax, 1);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke(); ctx.setLineDash([]);
      if (!ds.dash) ds.data.forEach((v, i) => {
        const x = padding.left + (ds.data.length > 1 ? xStep * i : 0);
        const y = padding.top + chartH - chartH * Math.min(v / yMax, 1);
        ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
      });
    });
  },

  /* 堆叠柱状图 */
  drawStackedBarChart(canvas, cfg) {
    const ctx = canvas.getContext('2d');
    const { labels, datasets, yUnit } = cfg;
    const totals = labels.map((_, i) => datasets.reduce((s, d) => s + (d.data[i] || 0), 0));
    const yMax = cfg.yMax || this._autoYMax(totals);
    const { W, H } = this._setupCanvas(canvas, ctx);
    const { padding, chartW, chartH } = this._drawGrid(ctx, W, H, labels, yMax, yUnit);
    const barGap = chartW / labels.length;
    const barWidth = Math.max(6, Math.min(barGap * 0.6, 40));
    labels.forEach((_, i) => {
      let off = 0;
      datasets.forEach(ds => {
        const v = ds.data[i] || 0;
        const bh = chartH * Math.min(v / yMax, 1);
        const x = padding.left + barGap * i + barGap / 2 - barWidth / 2;
        const y = padding.top + chartH - off - bh;
        ctx.fillStyle = ds.color;
        this._roundRect(ctx, x, y, barWidth, bh, 3); ctx.fill();
        off += bh;
      });
      const total = totals[i];
      if (total > 0) {
        ctx.fillStyle = '#6B655D'; ctx.font = 'bold 10px -apple-system, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(total, padding.left + barGap * i + barGap / 2, padding.top + chartH - off - 4);
      }
    });
  },

  /* 热力日历 */
  drawHeatCalendar(canvas, cfg) {
    const ctx = canvas.getContext('2d');
    const { data, maxValue } = cfg;
    const { W, H } = this._setupCanvas(canvas, ctx);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    const cols = 7, rows = Math.ceil(data.length / cols) + 1;
    const cellW = W / cols, cellH = (H - 18) / rows, gap = 3;
    const base = '#E8927C';
    ['一','二','三','四','五','六','日'].forEach((w, i) => {
      ctx.fillStyle = '#9A948C'; ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(w, i * cellW + cellW / 2, 10);
    });
    data.forEach((item, i) => {
      const row = Math.floor(i / cols) + 1, col = i % cols;
      const x = col * cellW + gap, y = 18 + (row - 1) * cellH + gap;
      const w = cellW - gap * 2, h = cellH - gap * 2;
      const intensity = maxValue > 0 ? Math.min(item.value / maxValue, 1) : 0;
      ctx.globalAlpha = item.value === 0 ? 0.08 : 0.18 + intensity * 0.82;
      ctx.fillStyle = base;
      this._roundRect(ctx, x, y, w, h, 5); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = intensity > 0.45 ? '#FFF' : '#6B655D';
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(item.label, x + w / 2, y + h / 2 - (item.value ? 5 : 0));
      if (item.value > 0) {
        ctx.font = '8.5px -apple-system, sans-serif';
        ctx.fillText(item.value + '条', x + w / 2, y + h / 2 + 8);
      }
    });
  },

  /* 下载 */
  downloadCanvas(canvas, filename) {
    try {
      const a = document.createElement('a');
      a.download = filename || 'chart.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
      return true;
    } catch (e) { return false; }
  },

  _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
};

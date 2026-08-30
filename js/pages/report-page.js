/**
 * 数据报表模块 — 杂志风格日/周/月报 + 日历 + 成长曲线
 */
window.ReportPage = {
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  selectedDate: null,
  _currentReportType: 'daily',
  _reportData: null,

  async render(container) {
    let html = `
      <!-- 报表类型选择 -->
      <div class="card">
        <div class="card-title">数据报表</div>
        <div class="report-type-grid">
          <div class="report-type-btn" onclick="ReportPage.openReport('daily')">
            <div class="rt-icon">${Lucide.icon('clipboard-list', 20)}</div>
            <div class="rt-label">日报</div>
            <div class="rt-desc">每日 0-24 点</div>
          </div>
          <div class="report-type-btn" onclick="ReportPage.openReport('weekly')">
            <div class="rt-icon">${Lucide.icon('calendar', 20)}</div>
            <div class="rt-label">周报</div>
            <div class="rt-desc">本周成长小记</div>
          </div>
          <div class="report-type-btn" onclick="ReportPage.openReport('monthly')">
            <div class="rt-icon">${Lucide.icon('bar-chart', 20)}</div>
            <div class="rt-label">月报</div>
            <div class="rt-desc">每月成长里程碑</div>
          </div>
        </div>
      </div>

      <!-- 日历 -->
      <div class="card">
        <div class="card-title">日历记录</div>
        <div class="calendar-header">
          <button class="icon-btn-sm" onclick="ReportPage.prevMonth()">&lsaquo;</button>
          <span id="rpt-cal-title" style="font-weight:600">${this.calendarYear}年${this.calendarMonth + 1}月</span>
          <button class="icon-btn-sm" onclick="ReportPage.nextMonth()">&rsaquo;</button>
        </div>
        <div class="calendar-grid" id="rpt-calendar-grid">
          ${this._renderCalendarHTML()}
        </div>
        <div id="rpt-calendar-day-detail"></div>
      </div>
    `;

    container.innerHTML = html;
    // 不再加载成长曲线（已移至独立页面）
  },

  // ===== 打开杂志风格报表 =====
  async openReport(type) {
    this._currentReportType = type;
    Utils.showProcessing('正在生成报表...');

    try {
      const data = await this._fetchReportData(type);
      this._reportData = data;
      Utils.hideLoading();

      const overlay = document.createElement('div');
      overlay.id = 'report-overlay';
      overlay.className = 'report-overlay';
      overlay.innerHTML = `
        <button class="report-close-btn" onclick="ReportPage._closeReport()">&#10005;</button>
        <div class="report-container" id="report-container">
          ${this._renderReport(type, data)}
        </div>
        <div class="rpt-share-section">
          <button class="rpt-share-btn" onclick="ReportPage._downloadReport()">
            <span>${Lucide.icon('download', 20)}</span>
            <span>下载报表图片</span>
          </button>
          ${window.__UI_V3__ ? `
          <button class="rpt-share-btn rpt-share-btn--cover" onclick="ReportPage._exportCover()">
            <span>${Lucide.icon('camera', 20)}</span>
            <span>分享封面</span>
          </button>` : ''}
        </div>
      `;
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      this._bindV2Charts(overlay);
      this._bindChartZoom(overlay);

      // v71：点击背景关闭 overlay；pushState 支持系统返回键关闭
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this._closeReport();
      });
      try { history.pushState({ reportOverlay: true }, '', window.location.href); } catch (e) {}

      // 触发滚动动画
      this._observeFadeIn();
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('生成失败: ' + e.message);
    }
  },

  _closeReport() {
    const overlay = document.getElementById('report-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    // v71：如果有 overlay 的 history state，回退以恢复历史栈
    try {
      if (history.state && history.state.reportOverlay) {
        history.back();
      }
    } catch (e) {}
  },

  _switchReport(type) {
    this._currentReportType = type;
    const container = document.getElementById('report-container');
    if (container && this._reportData) {
      // 如果切换到的类型数据未加载，重新获取
      this._fetchReportData(type).then(data => {
        this._reportData = data;
        container.innerHTML = this._renderReport(type, data);
        // R5：v2 图表交互绑定在 openReport 的 overlay 上做事件委托，
        // 切换渲染不重复绑定（否则 container + overlay 双层监听会导致
        // 时间线展开/收起被处理两次，表现为点击无效）
        this._observeFadeIn();
        // 更新tab状态
        document.querySelectorAll('.report-tab').forEach(el => {
          el.classList.toggle('active', el.dataset.type === type);
        });
      }).catch(e => Utils.showToast('切换失败: ' + e.message));
    }
  },

  // ===== 获取报表数据 =====
  async _fetchReportData(type) {
    const baby = Utils.getBabyInfo();
    const now = new Date();
    let startDate, endDate;

    if (type === 'daily') {
      const today = Utils.todayStr();
      startDate = today; endDate = today;
    } else if (type === 'weekly') {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 6);
      startDate = Utils.formatDate(weekStart);
      endDate = Utils.formatDate(now);
    } else {
      startDate = Utils.formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
      endDate = Utils.formatDate(now);
    }

    const snapshot = await API.getUnifiedSnapshot({ startDate, endDate });
    if (!snapshot || snapshot.status !== 'loaded') throw new Error('统一数据快照不可用');
    const feeding = { records: snapshot.records?.feeding || [] };
    const stool = { records: snapshot.records?.stool || [] };
    const sleep = { records: snapshot.records?.sleep || [] };
    const health = null;
    const milestones = { records: snapshot.records?.milestone || [] };
    const cleanData = { records: snapshot.records?.clean || [] };
    const todoList = { records: snapshot.records?.todo || [] };
    const moodData = { records: snapshot.records?.mood || [] };
    const vaccineData = null;

    const feedRecords = feeding?.records || [];
    const stoolRecords = stool?.records || [];
    const sleepRecords = sleep?.records || [];
    const cleanRecords = cleanData?.records || [];
    const todoRecords = todoList?.records || [];
    const milestoneRecords = (milestones?.records || []).filter(m => {
      const mDate = m.date || '';
      return mDate >= startDate && mDate <= endDate;
    });

    // 按天汇总
    const dayMap = {};
    const days = type === 'daily' ? 1 : (type === 'weekly' ? 7 : Math.max(1, Math.ceil((now - new Date(now.getFullYear(), now.getMonth(), 1)) / 86400000) + 1));
    if (type === 'weekly' || type === 'monthly') {
      const start = new Date(startDate);
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        if (d > now) break;
        dayMap[Utils.formatDate(d)] = { milk: 0, feed: 0, breast: 0, stool: 0, urine: 0, sleep: 0, sleepCount: 0, bath: 0, massage: 0, clean: 0, nursing: 0, todo: 0 };
      }
    }

    feedRecords.forEach(r => {
      const d = Utils.formatDate(r.time);
      if (!dayMap[d]) dayMap[d] = { milk: 0, feed: 0, breast: 0, bottleBreast: 0, stool: 0, urine: 0, sleep: 0, sleepCount: 0, bath: 0, massage: 0, clean: 0, nursing: 0, todo: 0 };
      dayMap[d].milk += r.amount || 0;
      dayMap[d].feed++;
      if (r.type === 'breast') dayMap[d].breast++;
      if (r.type === 'bottle_breast') dayMap[d].bottleBreast++;
    });
    stoolRecords.forEach(r => {
      const d = Utils.formatDate(r.time);
      if (!dayMap[d]) dayMap[d] = { milk: 0, feed: 0, breast: 0, stool: 0, urine: 0, sleep: 0, sleepCount: 0, bath: 0, massage: 0, clean: 0, nursing: 0, todo: 0 };
      if (r.type === 'urine') dayMap[d].urine++;
      else if (!r.type || r.type === 'stool') dayMap[d].stool++;
    });
    sleepRecords.forEach(r => {
      const d = Utils.formatDate(r.startTime);
      if (!dayMap[d]) dayMap[d] = { milk: 0, feed: 0, breast: 0, stool: 0, urine: 0, sleep: 0, sleepCount: 0, bath: 0, massage: 0, clean: 0, nursing: 0, todo: 0 };
      dayMap[d].sleep += r.duration || 0;
      dayMap[d].sleepCount++;
    });
    cleanRecords.forEach(r => {
      const d = Utils.formatDate(r.time);
      if (!dayMap[d]) dayMap[d] = { milk: 0, feed: 0, breast: 0, stool: 0, urine: 0, sleep: 0, sleepCount: 0, bath: 0, massage: 0, clean: 0, nursing: 0, todo: 0 };
      dayMap[d].clean++;
      if (r.type === 'bath') dayMap[d].bath++;
      if (r.type === 'massage') dayMap[d].massage++;
    });
    todoRecords.forEach(r => {
      const d = r.date || '';
      if (!d) return;
      if (!dayMap[d]) dayMap[d] = { milk: 0, feed: 0, breast: 0, stool: 0, urine: 0, sleep: 0, sleepCount: 0, bath: 0, massage: 0, clean: 0, nursing: 0, todo: 0 };
      if (r.completed) dayMap[d].todo++;
    });
    // 护理项统计：从 health 数据中的 nursingRecords 按天统计
    const healthNursingRecords = health?.nursingRecords || [];
    healthNursingRecords.forEach(r => {
      const d = r.date || Utils.formatDate(r.time || new Date());
      if (!dayMap[d]) dayMap[d] = { milk: 0, feed: 0, breast: 0, stool: 0, urine: 0, sleep: 0, sleepCount: 0, bath: 0, massage: 0, clean: 0, nursing: 0, todo: 0 };
      dayMap[d].nursing++;
    });

    const totalMilk = feedRecords.reduce((s, r) => s + (r.amount || 0), 0);
    const totalBreast = feedRecords.filter(r => r.type === 'breast').length;
    const totalBottleBreast = feedRecords.filter(r => r.type === 'bottle_breast').length;
    const totalStool = stoolRecords.filter(r => !r.type || r.type === 'stool').length;
    const totalUrine = stoolRecords.filter(r => r.type === 'urine').length;
    const totalSleep = sleepRecords.reduce((s, r) => s + (r.duration || 0), 0);
    const totalRecords = feedRecords.length + stoolRecords.length + sleepRecords.length;
    const totalClean = cleanRecords.length;
    const totalBath = cleanRecords.filter(r => r.type === 'bath').length;
    const totalMassage = cleanRecords.filter(r => r.type === 'massage').length;
    const totalExercise = cleanRecords.filter(r => r.type === 'exercise').length;
    const totalVisual = cleanRecords.filter(r => r.type === 'visual_training').length;
    const totalNursing = healthNursingRecords.length;
    const totalTodos = todoRecords.filter(r => r.completed).length;
    const totalTodosAll = todoRecords.length;

    // 心情记录（云端，跨设备共享）
    const moodRecords = moodData?.records || [];
    // 疫苗数据（云端）
    const vaccineRecords = vaccineData?.records || {};
    const customVaccines = vaccineData?.customVaccines || [];

    return {
      baby, type, startDate, endDate, days,
      feedRecords, stoolRecords, sleepRecords, milestoneRecords, cleanRecords, todoRecords,
      dayMap, totalMilk, totalBreast, totalBottleBreast, totalStool, totalUrine, totalSleep, totalRecords,
      totalFeed: feedRecords.length,
      totalClean, totalBath, totalMassage, totalExercise, totalVisual,
      totalNursing, totalTodos, totalTodosAll,
      healthData: health,
      moodRecords, vaccineRecords, customVaccines,
      now
    };
  },

  // ===== 心情与疫苗接种页 =====
  _moodVaccinePageHTML(d, pageNum, totalPages) {
    const periodLabel = d.type === 'daily' ? '今日' : d.type === 'weekly' ? '本周' : '本月';

    // ---- 心情记录（按日期排序）----
    const moods = (d.moodRecords || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const moodByDay = {};
    for (const m of moods) {
      if (!m.date || !m.value) continue;
      if (!moodByDay[m.date]) moodByDay[m.date] = { baby: null, mom: null };
      if (m.recordType === 'mood') moodByDay[m.date].baby = m.value;
      else if (m.recordType === 'mom_mood') moodByDay[m.date].mom = m.value;
    }
    const moodDays = Object.keys(moodByDay).sort();
    const moodHTML = moodDays.slice(0, 12).map(date => {
      const item = moodByDay[date];
      const parts = [];
      if (item.baby) parts.push(`${Lucide.icon('star', 14)} ${Utils.escapeHtml(item.baby.label || '')}`);
      if (item.mom) parts.push(`${Lucide.icon('heart-pulse', 14)} ${Utils.escapeHtml(item.mom.label || '')}`);
      if (parts.length === 0) return '';
      return `<div class="rpt-todo-item">
        <div class="rpt-todo-check">${Lucide.icon('star', 16)}</div>
        <div class="rpt-todo-text"><strong>${date.slice(5)}</strong> ${parts.join('　')}</div>
      </div>`;
    }).join('');

    // ---- 疫苗接种（区间内已接种）----
    const vaccineList = [];
    const allVaccines = Utils.getBabyVaccines(d.baby.birthDate) || [];
    const recs = d.vaccineRecords || {};
    for (const v of allVaccines) {
      const key = (v.fullCode || (v.name + '_' + v.dose)).replace(/\s/g, '_');
      const rec = recs[key];
      if (rec && rec.done && rec.doneDate && rec.doneDate >= d.startDate && rec.doneDate <= d.endDate) {
        vaccineList.push({ name: v.name, dose: v.dose, doneDate: rec.doneDate, category: v.category || '' });
      }
    }
    for (const cv of (d.customVaccines || [])) {
      if (cv.done && cv.doneDate && cv.doneDate >= d.startDate && cv.doneDate <= d.endDate) {
        vaccineList.push({ name: cv.name, dose: cv.dose, doneDate: cv.doneDate, category: cv.category || '', isCustom: true });
      }
    }
    vaccineList.sort((a, b) => (a.doneDate || '').localeCompare(b.doneDate || ''));
    const vaccineHTML = vaccineList.slice(0, 12).map(v => `
      <div class="rpt-todo-item">
        <div class="rpt-todo-check">${Lucide.icon('syringe', 16)}</div>
        <div class="rpt-todo-text"><strong>${Utils.escapeHtml(v.name)}</strong> ${Utils.escapeHtml(v.dose)}<span style="color:var(--text-tertiary)">（${v.doneDate}${v.category ? ' · ' + Utils.escapeHtml(v.category) : ''}）</span></div>
      </div>
    `).join('');

    return `
      <div class="rpt-page rpt-page-bg-purple">
        <div class="rpt-page-number">${pageNum} / ${totalPages}</div>
        <div class="rpt-page-icon">${Lucide.icon('star', 24)}${Lucide.icon('syringe', 24)}</div>
        <div class="rpt-page-label">MOOD & VACCINE</div>
        <div class="rpt-page-title">${periodLabel}心情与疫苗接种</div>

        <div class="rpt-section-title">${Lucide.icon('star', 18)} 心情记录</div>
        ${moodHTML || `<div class="rpt-emotion-text" style="margin-top:16px">${periodLabel}还没有记录心情，<br>记得记录宝宝的每日心情哦 ${Lucide.icon('sparkles', 14)}</div>`}

        <div class="rpt-section-title" style="margin-top:24px">${Lucide.icon('syringe', 18)} 疫苗接种</div>
        ${vaccineHTML || `<div class="rpt-emotion-text" style="margin-top:16px">${periodLabel}没有疫苗接种记录</div>`}
        ${vaccineList.length > 0 ? `<div class="rpt-emotion-text" style="margin-top:20px">${periodLabel}完成了 <strong>${vaccineList.length} 次</strong> 接种，<br>宝宝真勇敢！${Lucide.icon('star', 14)}</div>` : ''}
      </div>
    `;
  },

  // ===== 待办页面通用生成 =====
  _todoPageHTML(d, pageNum, totalPages) {
    const completedTodos = d.todoRecords.filter(r => r.completed);
    const pendingTodos = d.todoRecords.filter(r => !r.completed);
    const totalAll = d.todoRecords.length;

    const periodLabel = d.type === 'daily' ? '今日' : d.type === 'weekly' ? '本周' : '本月';

    const doneList = completedTodos.slice(0, 8).map(t => `
      <div class="rpt-todo-item done">
        <div class="rpt-todo-check">${Lucide.icon('check-circle', 16)}</div>
        <div class="rpt-todo-text">${Utils.escapeHtml(t.title)}</div>
      </div>
    `).join('');

    const pendingList = pendingTodos.slice(0, 8).map(t => `
      <div class="rpt-todo-item pending">
        <div class="rpt-todo-check">${Lucide.icon('circle', 16)}</div>
        <div class="rpt-todo-text">${Utils.escapeHtml(t.title)}</div>
      </div>
    `).join('');

    return `
      <div class="rpt-page rpt-page-bg-green">
        <div class="rpt-page-number">${pageNum} / ${totalPages}</div>
        <div class="rpt-page-icon">${Lucide.icon('check-circle', 24)}</div>
        <div class="rpt-page-label">TODOS</div>
        <div class="rpt-page-title">${periodLabel}待办事项</div>
        ${totalAll === 0 ? `<div class="rpt-emotion-text" style="margin-top:40px">${periodLabel}没有待办事项，<br>可以添加一些计划哦 ${Lucide.icon('lightbulb', 14)}</div>` : ''}
        ${completedTodos.length > 0 ? `
        <div class="rpt-section-title">已完成</div>
        <div class="rpt-todo-list">${doneList}</div>` : ''}
        ${pendingTodos.length > 0 ? `
        <div class="rpt-section-title">待完成</div>
        <div class="rpt-todo-list">${pendingList}</div>` : ''}
        ${completedTodos.length === totalAll && totalAll > 0 ? `<div class="rpt-emotion-text" style="margin-top:20px">全部完成！<br>${periodLabel}效率满分 ${Lucide.icon('star', 14)}</div>` : ''}
        ${pendingTodos.length > 0 ? `<div class="rpt-emotion-text" style="margin-top:20px">还有 <strong>${pendingTodos.length}项</strong> 待完成，<br>加油哦！${Lucide.icon('star', 14)}</div>` : ''}
      </div>
    `;
  },

  // ===== 封面摘要（v95 #4：3 → 6 个关键摘要数字 + 免责行，供「分享封面」导出） =====
  _coverStatsHTML(d) {
    const milk = d.totalMilk || 0;
    const feedCount = d.totalFeed || d.feedCount || 0;
    const breast = d.breastCount || d.totalBreast || 0;
    const sleepH = ((d.totalSleep || 0) / 60).toFixed(1);
    const stool = (d.totalStool || 0) + (d.totalUrine || 0);
    const clean = d.totalClean || 0;
    return `
      <div class="rpt-cover-stats">
        <div class="rpt-cover-stat"><div class="rcs-num">${milk}<span class="rcs-unit">ml</span></div><div class="rcs-label">总奶量</div></div>
        <div class="rpt-cover-stat"><div class="rcs-num">${feedCount}<span class="rcs-unit">次</span></div><div class="rcs-label">喂养次数</div></div>
        <div class="rpt-cover-stat"><div class="rcs-num">${breast}<span class="rcs-unit">次</span></div><div class="rcs-label">亲喂</div></div>
        <div class="rpt-cover-stat"><div class="rcs-num">${sleepH}<span class="rcs-unit">h</span></div><div class="rcs-label">总睡眠</div></div>
        <div class="rpt-cover-stat"><div class="rcs-num">${stool}<span class="rcs-unit">次</span></div><div class="rcs-label">排便</div></div>
        <div class="rpt-cover-stat"><div class="rcs-num">${clean}<span class="rcs-unit">次</span></div><div class="rcs-label">清洁护理</div></div>
      </div>
      <div class="rpt-cover-disclaimer">仅供参考，如有异常请咨询医生</div>
    `;
  },

  // ===== 渲染报表 HTML =====
  _renderReport(type, d) {
    const baby = d.baby;
    const avatar = 'img/emoji/emoji-happy.png';
    const monthAgeData = Utils.calcMonthAgeToDays(baby.birthDate);

    let coverTitle, coverLabel, coverSubtitle, coverDate;
    if (type === 'daily') {
      coverTitle = '宝宝<br>日报';
      coverLabel = 'BABY DAILY REPORT';
      coverSubtitle = '每一天都值得被记录';
      coverDate = Utils.formatDateCN(d.now);
    } else if (type === 'weekly') {
      coverTitle = '宝宝<br>周报';
      coverLabel = 'BABY WEEKLY REPORT';
      coverSubtitle = '每周成长小记';
      coverDate = d.startDate + ' - ' + d.endDate;
    } else {
      coverTitle = '宝宝<br>月报';
      coverLabel = 'BABY MONTHLY REPORT';
      coverSubtitle = '记录每一个成长的瞬间';
      coverDate = d.now.getFullYear() + '年' + (d.now.getMonth() + 1) + '月';
    }

    return `
      <div class="report-tabs">
        <button class="report-tab ${type === 'monthly' ? 'active' : ''}" data-type="monthly" onclick="ReportPage._switchReport('monthly')">月报</button>
        <button class="report-tab ${type === 'weekly' ? 'active' : ''}" data-type="weekly" onclick="ReportPage._switchReport('weekly')">周报</button>
        <button class="report-tab ${type === 'daily' ? 'active' : ''}" data-type="daily" onclick="ReportPage._switchReport('daily')">日报</button>
      </div>

      <!-- 封面 -->
      <div class="rpt-cover">
        <div class="rpt-cover-content">
          <div class="rpt-cover-label">${coverLabel}</div>
          <div class="rpt-cover-title">${coverTitle}</div>
          <div class="rpt-cover-subtitle">${coverSubtitle}</div>
          <div class="rpt-baby-avatar"><img src="${avatar}" alt="宝宝" loading="lazy" decoding="async"></div>
          <div class="rpt-cover-date">${coverDate}</div>
          ${window.__UI_V3__ ? this._coverStatsHTML(d) : ''}
          <div class="rpt-scroll-hint">
            <span>向下滑动查看</span>
            <span>&#8595;</span>
          </div>
        </div>
        <div class="rpt-deco-circle rpt-deco-1"></div>
        <div class="rpt-deco-circle rpt-deco-2"></div>
      </div>

      ${type === 'daily' ? this._dailyPages(d, monthAgeData) : ''}
      ${type === 'weekly' ? this._weeklyPages(d) : ''}
      ${type === 'monthly' ? this._monthlyPages(d) : ''}

      <!-- 结尾 -->
      <div class="rpt-ending">
        <div class="rpt-ending-content">
          <div class="rpt-ending-emoji">${type === 'daily' ? Lucide.icon('heart-pulse', 32) : type === 'weekly' ? Lucide.icon('sparkles', 32) : Lucide.icon('heart-pulse', 32)}</div>
          <div class="rpt-ending-title">${type === 'daily' ? '今天也很棒' : type === 'weekly' ? '这一周，很棒！' : '陪伴是最长情的告白'}</div>
          <div class="rpt-ending-text">
            ${coverDate}<br>
            记录数据 ${d.totalRecords + d.totalClean} 次<br>
            ${type === 'monthly' ? '每一次点击都是爱的印记' : '宝宝又长大了一点点'}
          </div>
          <div class="rpt-ending-brand">OneOne 成长日记</div>
        </div>
        <div class="rpt-deco-circle rpt-deco-1"></div>
        <div class="rpt-deco-circle rpt-deco-2"></div>
      </div>
    `;
  },

  // ===== 日报页面 =====
  _dailyPages(d, monthAgeData) {
    const totalMilk = d.totalMilk;
    const feedCount = d.feedRecords.length;
    const breastCount = d.totalBreast;
    const stoolCount = d.totalStool;
    const urineCount = d.totalUrine;
    const sleepMin = d.totalSleep;
    const sleepHours = (sleepMin / 60).toFixed(1);
    const sleepCount = d.sleepRecords.length;
    const temp = d.healthData?.latestTemp;
    const bathCount = d.totalBath;
    const cleanCount = d.totalClean;
    const nursingCount = d.totalNursing;

    return `
      <!-- 今日概览 -->
      <div class="rpt-page rpt-page-bg-warm">
        <div class="rpt-page-number">01 / 06</div>
        <div class="rpt-page-icon">${Lucide.icon('calendar', 24)}</div>
        <div class="rpt-page-label">TODAY</div>
        <div class="rpt-page-title">今日概览</div>
        <div class="rpt-big-number-section">
          <div class="rpt-big-number">${monthAgeData.total}<span class="rpt-big-number-unit">天</span></div>
          <div class="rpt-big-number-label">宝宝来到这个世界</div>
        </div>
        <div class="rpt-stats-grid">
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${monthAgeData.months}<span class="rpt-stat-card-unit">个月</span></div>
            <div class="rpt-stat-card-label">月龄</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${monthAgeData.days}<span class="rpt-stat-card-unit">天</span></div>
            <div class="rpt-stat-card-label">本月天数</div>
          </div>
        </div>
        <div class="rpt-emotion-text">
          今天是宝宝 <strong>第${monthAgeData.total}天</strong>，<br>
          ${monthAgeData.months > 0 ? `刚好 <strong>${monthAgeData.months}个月</strong> 了！` : '每一天都是新的冒险！'}<br>
          时间过得真快呀 ${Lucide.icon('star', 14)}
        </div>
      </div>

      <!-- 今日喂养 -->
      <div class="rpt-page rpt-page-bg-warm">
        <div class="rpt-page-number">02 / 06</div>
        <div class="rpt-page-icon">${Lucide.icon('bottle', 24)}</div>
        <div class="rpt-page-label">FEEDING</div>
        <div class="rpt-page-title">今日喂养</div>
        <div class="rpt-big-number-section">
          <div class="rpt-big-number">${totalMilk}<span class="rpt-big-number-unit">ml</span></div>
          <div class="rpt-big-number-label">今日总奶量</div>
        </div>
        <div class="rpt-stats-grid">
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${feedCount}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">喂养次数</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${breastCount}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">亲喂次数</div>
          </div>
          ${d.totalBottleBreast > 0 ? `<div class="rpt-stat-card"><div class="rpt-stat-card-value">${d.totalBottleBreast}<span class="rpt-stat-card-unit">次</span></div><div class="rpt-stat-card-label">瓶喂次数</div></div>` : ''}
        </div>
        <div class="rpt-emotion-text">
          今天喂了 <strong>${feedCount}次</strong>，<br>
          其中 <strong>${breastCount}次</strong> 亲喂${d.totalBottleBreast > 0 ? `、<strong>${d.totalBottleBreast}次</strong> 瓶喂` : ''}。<br>
          每一次喂养都是 <strong>爱的连接</strong> ${Lucide.icon('heart-pulse', 14)}
        </div>
      </div>

      <!-- 排便与睡眠 -->
      <div class="rpt-page rpt-page-bg-pink">
        <div class="rpt-page-number">03 / 06</div>
        <div class="rpt-page-icon">${Lucide.icon('pin', 24)}${Lucide.icon('moon', 24)}</div>
        <div class="rpt-page-label">DIAPER & SLEEP</div>
        <div class="rpt-page-title">今日排便与睡眠</div>
        <div class="rpt-stats-grid">
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${stoolCount}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">大便</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${urineCount}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">小便</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${sleepHours}<span class="rpt-stat-card-unit">小时</span></div>
            <div class="rpt-stat-card-label">睡眠时长</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${sleepCount}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">睡眠次数</div>
          </div>
        </div>
        ${temp ? `<div class="rpt-stats-grid"><div class="rpt-stat-card"><div class="rpt-stat-card-value">${temp}<span class="rpt-stat-card-unit">°C</span></div><div class="rpt-stat-card-label">最新体温</div></div></div>` : ''}
        <div class="rpt-emotion-text">
          今天睡了 <strong>${sleepHours}小时</strong>，<br>
          是个 <strong>小睡神</strong> 呢。<br>
          换尿布 <strong>${stoolCount + urineCount}次</strong>，又是忙碌的一天 ${Lucide.icon('star', 14)}
        </div>
      </div>

      <!-- 清洁与护理 -->
      <div class="rpt-page rpt-page-bg-blue">
        <div class="rpt-page-number">04 / 06</div>
        <div class="rpt-page-icon">${Lucide.icon('bath', 24)}${Lucide.icon('hand', 24)}</div>
        <div class="rpt-page-label">CLEAN & CARE</div>
        <div class="rpt-page-title">今日清洁与护理</div>
        <div class="rpt-stats-grid">
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${bathCount}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">${Lucide.icon('bath', 14)} 洗澡</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${cleanCount}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">清洁总计</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${nursingCount}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">护理打卡</div>
          </div>
        </div>
        <div class="rpt-emotion-text">
          今天完成了 <strong>${cleanCount}次</strong> 清洁护理，<br>
          ${bathCount > 0 ? '洗了 <strong>' + bathCount + '次</strong> 澡，' : ''}护理打卡 <strong>${nursingCount}次</strong>。<br>
          每一天都在用心照顾 ${Lucide.icon('heart-pulse', 14)}
        </div>
      </div>

      ${this._moodVaccinePageHTML(d, '05', '06')}

      ${this._todoPageHTML(d, '06', '06')}
    `;
  },

  // ===== 周报页面 =====
  _weeklyPages(d) {
    const measuredMilk = d.feedRecords.filter(r => r.type !== 'breast').reduce((s, r) => s + (r.amount || 0), 0);
    const estimatedBreastMilk = d.feedRecords.filter(r => r.type === 'breast').reduce((s, r) => s + (r.amount || 0), 0);
    const totalMilk = measuredMilk + estimatedBreastMilk;
    const avgMilk = Math.round(totalMilk / 7);
    const feedCount = d.feedRecords.length;
    const totalStool = d.totalStool;
    const totalUrine = d.totalUrine;
    const totalSleepMin = d.totalSleep;
    const totalSleepHours = (totalSleepMin / 60).toFixed(0);
    const avgSleepHours = (totalSleepMin / 7 / 60).toFixed(1);
    const avgSleepCount = (d.sleepRecords.length / 7).toFixed(1);

    // 柱状图（v2 通道：SVG 面积图；v1 保持原柱状图）
    const dayEntries = Object.entries(d.dayMap).sort((a, b) => a[0].localeCompare(b[0]));
    const chartBlock = (window.__UI_V3__ && window.ChartsV2)
      ? ChartsV2.areaChartHTML(dayEntries.map(([date, v]) => ({ label: date.slice(5), value: v.milk })), { unit: 'ml', ariaLabel: '每日奶量趋势' })
      : (() => {
          const maxMilk = Math.max(...dayEntries.map(([, v]) => v.milk), 1);
          return `<div class="rpt-bar-chart">${dayEntries.map(([date, v]) => {
            const h = Math.max(4, (v.milk / maxMilk) * 100);
            return `<div class="rpt-bar-item">
              <div class="rpt-bar-value">${v.milk}</div>
              <div class="rpt-bar" style="height:${h}%;background:linear-gradient(180deg,#ffd6a5,#ffcad4);"></div>
              <div class="rpt-bar-label">${date.slice(5)}</div>
            </div>`;
          }).join('')}</div>`;
        })();

    return `
      <!-- 喂养数据：支持点击放大 -->
      <div class="rpt-page rpt-page-bg-warm chart-zoomable">
        <div class="rpt-page-number">01 / 06</div>
        <div class="rpt-page-icon">${Lucide.icon('bottle', 24)}</div>
        <div class="rpt-page-label">FEEDING</div>
        <div class="rpt-page-title">本周喂养记录</div>
        <div class="rpt-big-number-section">
          <div class="rpt-big-number">${totalMilk}<span class="rpt-big-number-unit">ml</span></div>
          <div class="rpt-big-number-label">本周总奶量</div>
          <div class="rpt-big-number-compare">日均 ${avgMilk}ml</div>
        </div>
        <div class="rpt-stats-grid">
          <div class="rpt-stat-card"><div class="rpt-stat-card-value">${measuredMilk}<span class="rpt-stat-card-unit">ml</span></div><div class="rpt-stat-card-label">实测奶量</div></div>
          <div class="rpt-stat-card"><div class="rpt-stat-card-value">${estimatedBreastMilk}<span class="rpt-stat-card-unit">ml</span></div><div class="rpt-stat-card-label">亲喂估算</div></div>
        </div>
        <div class="rpt-chart-container">
          <div class="rpt-chart-title">每日奶量趋势</div>
          ${chartBlock}
        </div>
        <div class="rpt-emotion-text">
          本周奶量 <strong>${totalMilk}ml</strong>，<br>
          实测 <strong>${measuredMilk}ml</strong>，亲喂估算 <strong>${estimatedBreastMilk}ml</strong>。<br>
          日均 <strong>${avgMilk}ml</strong>。<br>
          宝宝胃口越来越好了 ${Lucide.icon('bottle', 14)}
        </div>
      </div>

      <!-- 排便数据 -->
      <div class="rpt-page rpt-page-bg-pink">
        <div class="rpt-page-number">02 / 06</div>
        <div class="rpt-page-icon">${Lucide.icon('pin', 24)}</div>
        <div class="rpt-page-label">DIAPER</div>
        <div class="rpt-page-title">本周排便记录</div>
        <div class="rpt-big-number-section">
          <div class="rpt-big-number">${totalStool + totalUrine}<span class="rpt-big-number-unit">次</span></div>
          <div class="rpt-big-number-label">本周换尿布总数</div>
        </div>
        <div class="rpt-stats-grid">
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${totalStool}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">大便</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${totalUrine}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">小便</div>
          </div>
        </div>
        <div class="rpt-emotion-text">
          平均每天换 <strong>${Math.round((totalStool + totalUrine) / 7)}次</strong>，<br>
          尿布消耗速度堪比 <strong>打印机</strong> ${Lucide.icon('file-text', 14)}<br>
          但每一张都是健康的证明！
        </div>
      </div>

      <!-- 睡眠数据 -->
      <div class="rpt-page rpt-page-bg-purple">
        <div class="rpt-page-number">03 / 06</div>
        <div class="rpt-page-icon">${Lucide.icon('moon', 24)}</div>
        <div class="rpt-page-label">SLEEP</div>
        <div class="rpt-page-title">本周睡眠记录</div>
        <div class="rpt-big-number-section">
          <div class="rpt-big-number">${totalSleepHours}<span class="rpt-big-number-unit">小时</span></div>
          <div class="rpt-big-number-label">本周总睡眠</div>
          <div class="rpt-big-number-compare">日均 ${avgSleepHours} 小时</div>
        </div>
        <div class="rpt-stats-grid">
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${avgSleepHours}<span class="rpt-stat-card-unit">小时</span></div>
            <div class="rpt-stat-card-label">日均睡眠</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${avgSleepCount}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">日均睡眠次数</div>
          </div>
        </div>
        <div class="rpt-emotion-text">
          本周睡眠 <strong>${totalSleepHours}小时</strong>，<br>
          在梦里一定有很多 <strong>美好的冒险</strong> 吧。<br>
          每一次安睡都是成长的礼物 ${Lucide.icon('moon', 14)}
        </div>
      </div>

      <!-- 清洁护理与待办 -->
      <div class="rpt-page rpt-page-bg-blue">
        <div class="rpt-page-number">04 / 06</div>
        <div class="rpt-page-icon">${Lucide.icon('bath', 24)}${Lucide.icon('check-circle', 24)}</div>
        <div class="rpt-page-label">CLEAN & CARE</div>
        <div class="rpt-page-title">本周清洁与护理</div>
        <div class="rpt-stats-grid">
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${d.totalBath}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">${Lucide.icon('bath', 14)} 洗澡</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${d.totalMassage}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">${Lucide.icon('hand', 14)} 抚触</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${d.totalClean}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">清洁护理总计</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${d.totalNursing}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">护理打卡</div>
          </div>
        </div>
        <div class="rpt-emotion-text">
          本周清洁 <strong>${d.totalClean}次</strong>，护理打卡 <strong>${d.totalNursing}次</strong>。<br>
          每一次抚触、每一个亲吻，都是成长的礼物 ${Lucide.icon('heart-pulse', 14)}
        </div>
      </div>

      ${this._moodVaccinePageHTML(d, '05', '06')}

      ${this._todoPageHTML(d, '06', '06')}
    `;
  },

  // ===== 月报页面 =====
  _monthlyPages(d) {
    const measuredMilk = d.feedRecords.filter(r => r.type !== 'breast').reduce((s, r) => s + (r.amount || 0), 0);
    const estimatedBreastMilk = d.feedRecords.filter(r => r.type === 'breast').reduce((s, r) => s + (r.amount || 0), 0);
    const totalMilk = measuredMilk + estimatedBreastMilk;
    const days = d.days;
    const avgMilk = Math.round(totalMilk / days);
    const feedCount = d.feedRecords.length;
    const totalStool = d.totalStool;
    const totalUrine = d.totalUrine;
    const totalSleepMin = d.totalSleep;
    const totalSleepHours = (totalSleepMin / 60).toFixed(0);
    const avgSleepHours = (totalSleepMin / days / 60).toFixed(1);
    const avgSleepCount = (d.sleepRecords.length / days).toFixed(1);

    const monthEntries = Object.entries(d.dayMap || {}).sort((a, b) => a[0].localeCompare(b[0]));
    const monthChartBlock = (window.__UI_V3__ && window.ChartsV2 && monthEntries.length > 1)
      ? ChartsV2.areaChartHTML(monthEntries.map(([date, v]) => ({ label: date.slice(5), value: v.milk })), { unit: 'ml', ariaLabel: '每日奶量趋势' })
      : (() => {
          const maxMilk = Math.max(...monthEntries.map(([, v]) => v.milk), 1);
          return `<div class="rpt-bar-chart">${monthEntries.map(([date, v]) => `<div class="rpt-bar-item"><div class="rpt-bar-value">${v.milk}</div><div class="rpt-bar" style="height:${Math.max(4, (v.milk / maxMilk) * 100)}%"></div><div class="rpt-bar-label">${date.slice(5)}</div></div>`).join('')}</div>`;
        })();

    // 里程碑时间线（v2 通道：默认折叠为摘要行，点击展开；v1 保持全量展示）
    const timelineItems = (d.milestoneRecords || []).slice(0, 10).map(m => {
      const date = m.date ? Utils.formatDateCN(new Date(m.date)) : '';
      const label = m.milestoneLabel || m.milestoneKey || '';
      const note = m.note || '';
      return { date, text: label + (note ? ' — ' + note : '') };
    });
    const timelineBlock = (window.__UI_V3__ && window.ChartsV2 && timelineItems.length > 0)
      ? ChartsV2.timelineCollapseHTML(timelineItems, { title: '成长里程碑', maxPreview: 3 })
      : `<div class="rpt-timeline">${timelineItems.map(i => `<div class="rpt-timeline-item"><div class="rpt-timeline-date">${i.date}</div><div class="rpt-timeline-text">${i.text}</div></div>`).join('')}</div>`;

    const cleanSection = `
      <!-- 清洁护理 -->
      <div class="rpt-page rpt-page-bg-blue">
        <div class="rpt-page-number">04 / 07</div>
        <div class="rpt-page-icon">${Lucide.icon('bath', 24)}${Lucide.icon('hand', 24)}</div>
        <div class="rpt-page-label">CLEAN & CARE</div>
        <div class="rpt-page-title">本月清洁与护理</div>
        <div class="rpt-stats-grid">
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${d.totalBath}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">${Lucide.icon('bath', 14)} 洗澡</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${d.totalClean}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">清洁总计</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${d.totalNursing}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">护理打卡</div>
          </div>
        </div>
        <div class="rpt-emotion-text">
          本月清洁 <strong>${d.totalClean}次</strong>，护理打卡 <strong>${d.totalNursing}次</strong>。<br>
          每一次抚触、每一个亲吻，都是成长的礼物 ${Lucide.icon('heart-pulse', 14)}
        </div>
      </div>
    `;

    const moodVaccineSection = this._moodVaccinePageHTML(d, '05', '07');
    const todoSection = this._todoPageHTML(d, '06', '07');

    const milestoneSection = timelineItems.length > 0 ? `
      <!-- 成长里程碑 -->
      <div class="rpt-page rpt-page-bg-green">
        <div class="rpt-page-number">07 / 07</div>
        <div class="rpt-page-icon">${Lucide.icon('sparkles', 24)}</div>
        <div class="rpt-page-label">MILESTONES</div>
        <div class="rpt-page-title">本月成长里程碑</div>
        ${timelineBlock}
        <div class="rpt-emotion-text" style="margin-top:40px;">
          每一个 <strong>第一次</strong> 都值得被记录，<br>
          因为这些瞬间永远不会再来。
        </div>
      </div>
    ` : '';

    return `
      <!-- 喂养数据：支持点击放大 -->
      <div class="rpt-page rpt-page-bg-warm chart-zoomable">
        <div class="rpt-page-number">01 / 07</div>
        <div class="rpt-page-icon">${Lucide.icon('bottle', 24)}</div>
        <div class="rpt-page-label">FEEDING</div>
        <div class="rpt-page-title">本月喂养记录</div>
        <div class="rpt-big-number-section">
          <div class="rpt-big-number">${totalMilk.toLocaleString()}<span class="rpt-big-number-unit">ml</span></div>
          <div class="rpt-big-number-label">本月总奶量</div>
        </div>
        <div class="rpt-stats-grid">
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${avgMilk}<span class="rpt-stat-card-unit">ml</span></div>
            <div class="rpt-stat-card-label">日均奶量</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${feedCount}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">喂养次数</div>
          </div>
        </div>
        <div class="rpt-chart-container">
          <div class="rpt-chart-title">每日奶量趋势（点击放大）</div>
          ${monthChartBlock}
        </div>
        <div class="rpt-emotion-text">
          本月宝宝一共喝了 <strong>${totalMilk.toLocaleString()}ml</strong> 的奶，<br>
          每一次喂养都是爱的传递 ${Lucide.icon('heart-pulse', 14)}
        </div>
      </div>

      <!-- 排便数据 -->
      <div class="rpt-page rpt-page-bg-pink">
        <div class="rpt-page-number">02 / 07</div>
        <div class="rpt-page-icon">${Lucide.icon('pin', 24)}</div>
        <div class="rpt-page-label">DIAPER</div>
        <div class="rpt-page-title">本月排便记录</div>
        <div class="rpt-big-number-section">
          <div class="rpt-big-number">${totalStool + totalUrine}<span class="rpt-big-number-unit">次</span></div>
          <div class="rpt-big-number-label">本月换尿布总数</div>
        </div>
        <div class="rpt-stats-grid">
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${totalStool}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">大便</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${totalUrine}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">小便</div>
          </div>
        </div>
        <div class="rpt-emotion-text">
          平均每天换 <strong>${Math.round((totalStool + totalUrine) / days)}次</strong>，<br>
          妈妈/爸爸的手速越来越快了！<br>
          这就是 <strong>超能力</strong> 吧 ${Lucide.icon('star', 14)}
        </div>
      </div>

      <!-- 睡眠数据 -->
      <div class="rpt-page rpt-page-bg-purple">
        <div class="rpt-page-number">03 / 07</div>
        <div class="rpt-page-icon">${Lucide.icon('moon', 24)}</div>
        <div class="rpt-page-label">SLEEP</div>
        <div class="rpt-page-title">本月睡眠记录</div>
        <div class="rpt-big-number-section">
          <div class="rpt-big-number">${totalSleepHours}<span class="rpt-big-number-unit">小时</span></div>
          <div class="rpt-big-number-label">本月总睡眠</div>
          <div class="rpt-big-number-compare">占全月时间的 ${(totalSleepHours / (days * 24) * 100).toFixed(1)}%</div>
        </div>
        <div class="rpt-stats-grid">
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${avgSleepHours}<span class="rpt-stat-card-unit">小时</span></div>
            <div class="rpt-stat-card-label">日均睡眠</div>
          </div>
          <div class="rpt-stat-card">
            <div class="rpt-stat-card-value">${avgSleepCount}<span class="rpt-stat-card-unit">次</span></div>
            <div class="rpt-stat-card-label">日均睡眠次数</div>
          </div>
        </div>
        <div class="rpt-emotion-text">
          宝宝本月睡了 <strong>${totalSleepHours}小时</strong>，<br>
          在梦里一定有很多 <strong>美好的冒险</strong> 吧。<br>
          每一次安睡都是成长的礼物 ${Lucide.icon('moon', 14)}
        </div>
      </div>

      ${cleanSection}
      ${moodVaccineSection}
      ${todoSection}
      ${milestoneSection}
    `;
  },

  // ===== v2 图表交互绑定（面积图 tooltip + 时间线折叠） =====
  _bindV2Charts(root) {
    if (!window.__UI_V3__ || !window.ChartsV2 || !root) return;
    try {
      ChartsV2.bindAreaChart(root);
      ChartsV2.bindTimeline(root);
    } catch (e) { console.warn('v2 图表绑定失败:', e); }
  },

  // ===== 滚动动画 =====
  _observeFadeIn() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.style.opacity = '1';
      });
    }, { threshold: 0.1 });
    // 简化：页面已默认可见，不需要额外动画
  },

  // ===== 分享封面（v2 新增③：手绘 4:5 竖版 1080×1350 杂志封面 PNG） =====
  // 手绘 canvas 管线：SVG foreignObject 在移动 WebView 存在 blob 加载挂起、
  // 在 Chrome（含 headless/部分移动端）存在 canvas 污染（taint）问题，
  // 封面改为纯 canvas 2D 绘制：尺寸精确、无外部资源依赖、无超时风险；
  // 数据读取自已渲染的封面 DOM，保证与页面所见一致
  async _exportCover() {
    const cover = document.getElementById('report-container')?.querySelector('.rpt-cover');
    if (!cover) { Utils.showToast('封面未找到'); return; }

    Utils.showProcessing('正在生成封面...');
    try {
      const canvas = await this._exportCoverCanvas(cover);
      if (!canvas) throw new Error('渲染失败');
      Utils.hideLoading();
      await this._shareCanvas(canvas, `baby-cover-${this._currentReportType}-${Utils.todayStr()}.png`);
    } catch (e) {
      Utils.hideLoading();
      console.error('分享封面失败:', e);
      Utils.showToast('封面生成失败: ' + e.message);
    }
  },

  /** 报表绘图调色板（#80 token 化）：V2 从 tokens.css 解析语义色（dark/night 主题自适应），
   *  V1 回退原硬编码（零回归）。插画系（暖橙渐变/装饰圆）为报表专属设计语言，不随主题。 */
  _rptPalette() {
    const v = (name, fb) => {
      if (!window.__UI_V3__) return fb;
      const val = getComputedStyle(document.documentElement).getPropertyValue(name);
      return (val || '').trim() || fb;
    };
    return {
      // 品牌/文字语义色（跟随 tokens）
      accent: v('--color-accent', '#c4785a'),
      ink: v('--color-text-primary', '#4a3728'),
      inkSoft: v('--color-text-secondary', '#8b6f5e'),
      inkMuted: v('--color-text-muted', '#a08070'),
      white: '#ffffff',
      cardBg: v('--color-bg-raised', 'rgba(255,255,255,0.78)'),
      strokeFaint: v('--color-border-subtle', 'rgba(74,55,40,0.08)'),
      inkFaint: v('--color-text-secondary', 'rgba(74,55,40,0.45)'),
      inkDim: v('--color-text-muted', 'rgba(74,55,40,0.55)'),
      // 插画系（报表专属，不随主题）
      warmBg: '#fff8f0', warmSoft: '#ffecd2', warmAccent: '#ffd6a5', warmPink: '#ffcad4',
      glow: 'rgba(255,180,140,0.35)'
    };
  },

  /** 封面手绘管线：1080×1350（4:5）纯 canvas 2D 绘制，数据读自封面 DOM */
  _exportCoverCanvas(cover) {
    return new Promise((resolve) => {
      const W = 1080, H = 1350;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      let finished = false;
      const done = (result) => { if (!finished) { finished = true; resolve(result); } };

      try {
        const pal = this._rptPalette();
        // —— 背景：暖色 135° 渐变（与 styles.css .rpt-cover 视觉一致） ——
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, pal.warmBg); g.addColorStop(0.3, pal.warmSoft);
        g.addColorStop(0.6, pal.warmAccent); g.addColorStop(1, pal.warmPink);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // 装饰圆（右上 / 左下）
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.beginPath(); ctx.arc(W - 165, 150, 310, 0, Math.PI * 2); ctx.fillStyle = pal.warmAccent; ctx.fill();
        ctx.beginPath(); ctx.arc(165, H - 130, 230, 0, Math.PI * 2); ctx.fillStyle = pal.warmPink; ctx.fill();
        ctx.restore();

        // —— 数据读取（DOM 文本，保证与页面一致） ——
        const t = (sel) => { const el = cover.querySelector(sel); return el ? (el.textContent || '').trim() : ''; };
        const titleEl = cover.querySelector('.rpt-cover-title');
        const titleLines = (titleEl ? titleEl.innerText : '').split('\n').filter(Boolean);
        const label = t('.rpt-cover-label');
        const subtitle = t('.rpt-cover-subtitle');
        const date = t('.rpt-cover-date');
        const nums = [...cover.querySelectorAll('.rcs-num')].map(el => (el.textContent || '').trim());
        const statLabels = [...cover.querySelectorAll('.rcs-label')].map(el => (el.textContent || '').trim());
        const disclaimer = t('.rpt-cover-disclaimer');

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const drawAll = (avatarImg) => {
          try {
            // 顶部标识
            ctx.font = '500 34px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.fillStyle = pal.accent;
            if (label) ctx.fillText(label, W / 2, 240);

            // 大标题（衬线 900，支持 <br> 两行）
            ctx.font = '900 112px "Noto Serif SC","Songti SC","STSong",serif';
            ctx.fillStyle = pal.ink;
            titleLines.forEach((ln, i) => ctx.fillText(ln, W / 2, 400 + i * 132));

            // 副标题
            ctx.font = '400 46px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.fillStyle = pal.inkSoft;
            if (subtitle) ctx.fillText(subtitle, W / 2, 660);

            // 宝宝头像（渐变圆 + 图片内切；失败回退 emoji）
            ctx.save();
            ctx.beginPath(); ctx.arc(W / 2, 790, 145, 0, Math.PI * 2);
            ctx.shadowColor = pal.glow; ctx.shadowBlur = 50;
            const ag = ctx.createLinearGradient(W / 2 - 145, 605, W / 2 + 145, 895);
            ag.addColorStop(0, pal.warmAccent); ag.addColorStop(1, pal.warmPink);
            ctx.fillStyle = ag; ctx.fill();
            ctx.shadowBlur = 0;
            if (avatarImg) {
              // 透明底图片：预渲染到临时 canvas（白圆底 → drawImage → source-in 保留图片非透明像素），
              // 再 drawImage 到主 canvas，避免透明棋盘格
              const tmp = document.createElement('canvas');
              tmp.width = 290; tmp.height = 290;
              const tctx = tmp.getContext('2d');
              // 1) 画白圆底
              tctx.beginPath(); tctx.arc(145, 145, 145, 0, Math.PI * 2);
              tctx.fillStyle = pal.white; tctx.fill();
              // 2) 用 source-in：只保留图片非透明像素，叠加在白圆上
              tctx.globalCompositeOperation = 'source-in';
              tctx.drawImage(avatarImg, 0, 0, 290, 290);
              tctx.globalCompositeOperation = 'source-over';
              ctx.drawImage(tmp, W / 2 - 145, 645, 290, 290);
            } else {
              ctx.font = '80px sans-serif';
              ctx.fillText('', W / 2, 790);
            }
            ctx.restore();

            // 日期区间
            ctx.font = '400 40px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.fillStyle = pal.inkMuted;
            if (date) ctx.fillText(date, W / 2, 975);

            // 摘要卡片（v95 #4：3 → 6 项，两行 × 3 布局；≤3 项时单行）
            if (nums.length) {
              const perRow = nums.length > 3 ? Math.ceil(nums.length / 2) : nums.length;
              const rows = Math.ceil(nums.length / perRow);
              const cardW = 300, cardH = 105, gap = 26, rowGap = 20;
              const y0 = 1020;
              nums.forEach((n, i) => {
                const r = Math.floor(i / perRow);
                const c = i % perRow;
                // 不足整行的行居中
                const inRow = (r === rows - 1) ? (nums.length - perRow * r) : perRow;
                const rowW = inRow * cardW + (inRow - 1) * gap;
                const x0 = (W - rowW) / 2 + c * (cardW + gap);
                const y = y0 + r * (cardH + rowGap);
                const numMatch = n.match(/^([\d.]+)\s*(.*)$/);
                const numVal = numMatch ? numMatch[1] : n;
                const unit = numMatch ? numMatch[2] : '';
                const cx = x0 + cardW / 2;
                const cy = y + cardH / 2;
                // 卡片底
                ctx.beginPath();
                this._roundRectPath(ctx, x0, y, cardW, cardH, 26);
                ctx.fillStyle = pal.cardBg;
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = pal.strokeFaint;
                ctx.stroke();
                // 数字 + 单位
                ctx.font = '700 50px "PingFang SC","Microsoft YaHei",sans-serif';
                const numW = ctx.measureText(numVal).width;
                ctx.fillStyle = pal.accent;
                ctx.fillText(numVal, cx - 6, cy - 10);
                if (unit) {
                  ctx.font = '600 22px "PingFang SC","Microsoft YaHei",sans-serif';
                  ctx.fillStyle = pal.inkFaint;
                  ctx.fillText(unit, cx + numW / 2 + 22, cy - 10);
                }
                // 标签
                ctx.font = '400 26px "PingFang SC","Microsoft YaHei",sans-serif';
                ctx.fillStyle = pal.inkDim;
                if (statLabels[i]) ctx.fillText(statLabels[i], cx, cy + 32);
              });
            }

            // 免责声明
            if (disclaimer) {
              ctx.font = '24px "PingFang SC","Microsoft YaHei",sans-serif';
              ctx.fillStyle = pal.inkDim;
              ctx.fillText(disclaimer, W / 2, 1315);
            }
            done(canvas);
          } catch (e) {
            console.warn('封面手绘失败:', e);
            done(canvas);
          }
        };

        // 头像图异步加载（同源；失败/超时回退 emoji 文字）
        const avatarImg = cover.querySelector('.rpt-baby-avatar img');
        const src = avatarImg ? avatarImg.src : '';
        if (src) {
          const im = new Image();
          let settled = false;
          im.onload = () => { if (!settled) { settled = true; drawAll(im); } };
          im.onerror = () => { if (!settled) { settled = true; drawAll(null); } };
          im.src = src;
          setTimeout(() => { if (!settled) { settled = true; drawAll(null); } }, 2500);
        } else {
          drawAll(null);
        }
      } catch (e) {
        console.warn('封面手绘初始化失败:', e);
        done(null);
      }
    });
  },

  /** 圆角矩形路径（兼容无 ctx.roundRect 的旧 WebView） */
  _roundRectPath(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
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
            Utils.showToast('封面已分享');
            return;
          } catch (e) {
            if (e && e.name === 'AbortError') return; // 用户取消，不打扰
            // 其他失败 → 降级下载
          }
        }
      }
      this._canvasToDownload(canvas, filename);
    } catch (e) {
      console.warn('分享失败，降级下载:', e);
      this._canvasToDownload(canvas, filename);
    }
  },

  // ===== 下载报表（SVG foreignObject 捕获 + canvas 导出，v67 加固） =====
  async _downloadReport() {
    const container = document.getElementById('report-container');
    if (!container) { Utils.showToast('报表内容未找到'); return; }

    Utils.showProcessing('正在生成图片...');

    try {
      const pal = this._rptPalette();
      // 收集所有 CSS
      let allCSS = '';
      document.querySelectorAll('style').forEach(s => { allCSS += s.textContent + '\n'; });

      // 获取报表中所有"页面"卡片
      const pages = container.querySelectorAll('.rpt-page, .rpt-cover, .rpt-ending');
      if (pages.length === 0) { Utils.hideLoading(); Utils.showToast('没有可导出的内容'); return; }

      const gap = 20;
      const MAX_H = 4000; // 微信/iOS WebView canvas 高度上限约 4096px，留余量
      // 估算原始总高度 → 决定合并倍率；仍超限则分页导出多张
      const rawH = Array.from(pages).reduce((s, p) => s + (Math.ceil(p.getBoundingClientRect().height) || 600), 0) + (pages.length - 1) * gap;
      let scale = 2;
      if (rawH * 2 > MAX_H && rawH <= MAX_H) scale = 1;
      const multi = rawH * scale > MAX_H;

      // 逐页渲染为 canvas（每页内部有超时兜底，保证 loading 一定关闭）
      const canvases = [];
      for (const page of pages) {
        const canvas = await this._pageToCanvas(page, allCSS, scale);
        if (canvas) canvases.push(canvas);
      }

      if (canvases.length === 0) { Utils.hideLoading(); Utils.showToast('渲染失败，请重试'); return; }
      Utils.hideLoading();

      // 超长报表：分页导出，避免单张 canvas 超尺寸出图失败
      if (multi) { this._downloadMultiImages(canvases); return; }

      // 合并所有页面为一张纵向长图
      const totalHeight = canvases.reduce((h, c) => h + c.height, 0) + (canvases.length - 1) * gap;
      const maxWidth = Math.max(...canvases.map(c => c.width));

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = maxWidth;
      finalCanvas.height = totalHeight;
      const finalCtx = finalCanvas.getContext('2d');
      finalCtx.fillStyle = pal.white;
      finalCtx.fillRect(0, 0, maxWidth, totalHeight);

      let y = 0;
      canvases.forEach((c, i) => {
        finalCtx.drawImage(c, (maxWidth - c.width) / 2, y);
        y += c.height + gap;
      });

      this._canvasToDownload(finalCanvas, `baby-report-${this._currentReportType}-${Utils.todayStr()}.png`);
    } catch (e) {
      Utils.hideLoading();
      console.error('下载报表失败:', e);
      Utils.showToast('下载失败: ' + e.message);
    }
  },

  /** 将 canvas 导出为 PNG 下载；toBlob 缺失/失败时降级 toDataURL；v71 微信环境兜底 */
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
          // v71：延长 revoke 到 30s，防止微信/iOS 中 blob URL 被导航打开时已过失效期
          let revoked = false;
          const doRevoke = () => { if (!revoked) { revoked = true; URL.revokeObjectURL(url); } };
          setTimeout(doRevoke, 30000);
          try { window.addEventListener('beforeunload', doRevoke, { once: true }); } catch (e) {}
          // v71：微信环境兜底——如果 a.download 被忽略，尝试新开窗口让用户手动保存
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

  /** v71：微信环境兜底下载——blob URL 在新窗口打开供长按保存 */
  _wechatDownloadFallback(url, filename) {
    const isWechat = /MicroMessenger/i.test(navigator.userAgent);
    if (!isWechat) return;
    // 微信中 a.download 常被忽略，延迟弹出新窗口供用户长按保存
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

  /** dataURL 兜底下载（toBlob 不支持的旧内核）；v71 微信环境兜底 */
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

  /** 超长报表分页导出多张 PNG */
  _downloadMultiImages(canvases) {
    Utils.showToast('报表较长，已按页导出 ' + canvases.length + ' 张图片');
    canvases.forEach((c, i) => {
      setTimeout(() => {
        this._canvasToDownload(c, `baby-report-${this._currentReportType}-${Utils.todayStr()}-p${i + 1}.png`);
      }, i * 400);
    });
  },

  /** 将单个报表页面渲染为 canvas（v67：加超时兜底，WebView 挂起不再卡死 loading） */
  _pageToCanvas(page, cssText, scale = 2, timeoutMs = 8000) {
    const pal = this._rptPalette();
    return new Promise((resolve) => {
      let done = false;
      const finish = (canvas) => { if (!done) { done = true; clearTimeout(timer); resolve(canvas); } };
      // 微信 X5/WKWebView 对 SVG blob 加载可能永久挂起（onload/onerror 均不触发），
      // 8s 超时强制走文本回退，确保下载流程不卡死、loading 一定关闭
      const timer = setTimeout(() => {
        console.warn('SVG 渲染超时，使用文本回退');
        finish(this._pageToCanvasFallback(page));
      }, timeoutMs);

      try {
        const rect = page.getBoundingClientRect();
        // 保留小数值：封面 810×1012.5 × 4/3 需精确得到 1080×1350，Math.ceil 会破坏比例
        const w = rect.width || 375;
        const h = rect.height || 600;

        // 克隆页面元素，替换 emoji 图片为文字回退
        const clone = page.cloneNode(true);
        clone.querySelectorAll('img').forEach(img => {
          const alt = img.alt || '';
          const span = document.createElement('span');
          span.textContent = alt || '';
          span.style.fontSize = '48px';
          img.parentNode.replaceChild(span, img);
        });

        // 收集 CSS：内联 <style> + 同源 <link> 样式表（cssRules），否则外部样式表全部丢失
        let allCssText = '';
        document.querySelectorAll('style').forEach(s => { allCssText += s.textContent + '\n'; });
        try {
          Array.from(document.styleSheets).forEach(sheet => {
            if (sheet.href && !sheet.href.startsWith(location.origin)) return; // 跨域样式表跳过
            let rules = null;
            try { rules = sheet.cssRules; } catch (e) { return; }
            if (rules) Array.from(rules).forEach(r => { allCssText += r.cssText + '\n'; });
          });
        } catch (e) { /* 忽略样式收集异常 */ }

        // 过滤 CSS 中的外部资源引用 url(...)，避免 SVG 加载挂起或 canvas 被污染
        // XML 实体转义：CSS 原生嵌套语法（& 父选择器）在 XML 中必须转义，
        // 否则 SVG blob 解析报 xmlParseEntityRef 错误；转义后 XML 还原为 &，CSS 语义不变
        const safeCss = (allCssText || cssText || '')
          .replace(/url\([^)]*\)/gi, '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;');
        // XMLSerializer：HTML void 元素（<br> 等）自动输出自闭合 <br/>，& < 自动转义，
        // 保证 SVG blob 以 XML 解析时语法合法（outerHTML 直接内嵌会因 <br> 未闭合解析失败）
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
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);
            // 白色背景确保透明部分可见
            ctx.fillStyle = pal.white;
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            // taint 检测：foreignObject SVG 在部分浏览器（Chrome headless/移动 WebView）会污染 canvas，
            // 此时 toBlob/toDataURL 均不可用，必须走文本回退，否则下载/分享静默失败
            try { canvas.toDataURL('image/png'); } catch (e) {
              console.warn('canvas 被跨域污染，使用文本回退:', e.message);
              finish(this._pageToCanvasFallback(page));
              return;
            }
            finish(canvas);
          } catch (e) {
            // canvas 被污染（安全限制）→ 走文本回退
            console.warn('canvas 绘制失败，使用文本回退:', e);
            finish(this._pageToCanvasFallback(page));
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          console.warn('SVG 渲染失败，使用文本回退');
          finish(this._pageToCanvasFallback(page));
        };

        img.src = url;
      } catch (e) {
        console.warn('页面渲染异常:', e);
        finish(this._pageToCanvasFallback(page));
      }
    });
  },

  /** 文本回退：将页面文字渲染为简单 canvas */
  _pageToCanvasFallback(page) {
    try {
      const pal = this._rptPalette();
      const rect = page.getBoundingClientRect();
      const w = rect.width || 375;
      const h = rect.height || 600;
      const scale = 2;

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      // 背景
      const bgClass = Array.from(page.classList).find(c => c.startsWith('rpt-page-bg-'));
      const bgColor = bgClass ? this._bgColor(bgClass) : pal.warmBg;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      const text = page.innerText;
      const lines = text.split('\n').filter(l => l.trim());
      ctx.textAlign = 'center';
      ctx.fillStyle = pal.ink;

      const title = lines.find(l => /日报|周报|月报/.test(l)) || lines[0] || '';
      if (title) {
        ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(title, w / 2, 100);
      }

      ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif';
      const dataLines = lines.filter(l => !/^\d+\s*\/\s*\d+$/.test(l) && !/日报|周报|月报|OneOne/.test(l));
      dataLines.forEach((line, i) => {
        if (i < 6) {
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

  /** 报表页面背景色：报表专属设计语言（五色主题），不随 UI 主题切换；warm 与 pal.warmBg 同值 */
  _bgColor(cls) {
    const map = {
      'rpt-page-bg-warm': '#fff8f0',
      'rpt-page-bg-pink': '#fff0f0',
      'rpt-page-bg-blue': '#f0f8ff',
      'rpt-page-bg-green': '#f0fff4',
      'rpt-page-bg-purple': '#f8f0ff'
    };
    return map[cls] || '#fff8f0';
  },

  // ===== 从外部调用的模态报告（analytics-page 专用） =====
  async openReportModal(reportData) {
    this._currentReportType = reportData.type;
    this._reportData = reportData;
    const previous = document.getElementById('report-overlay');
    if (previous) previous.remove();

    const overlay = document.createElement('div');
    overlay.id = 'report-overlay';
    overlay.className = 'report-overlay report-overlay--analytics';
    overlay.innerHTML = `
      <button class="report-close-btn" onclick="ReportPage._closeReport()" aria-label="关闭报告">×</button>
      <div class="report-container" id="report-container">${this._renderReportSimplified(reportData)}</div>
      <div class="rpt-share-section">
        <button class="rpt-share-btn" onclick="ReportPage._downloadReport()">
          <span>${Lucide.icon('download', 20)}</span><span>下载报表图片</span>
        </button>
        <button class="rpt-share-btn" onclick="ReportPage._shareReportData()">
          <span>${Lucide.icon('share-2', 20)}</span><span>分享数据</span>
        </button>
      </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    this._bindV2Charts(overlay);
    this._bindChartZoom(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) this._closeReport(); });
    try { history.pushState({ reportOverlay: true }, '', window.location.href); } catch (e) {}
    this._observeFadeIn();
  },

  _renderReportSimplified(d) {
    const typeLabel = d.type === 'daily' ? '日报' : d.type === 'weekly' ? '周报' : '月报';
    const title = `${Utils.escapeHtml(d.baby?.name || '宝宝')}的${typeLabel}`;
    const pages = d.type === 'daily'
      ? this._dailyPages(d, Utils.calcMonthAgeToDays(d.baby?.birthDate))
      : d.type === 'weekly' ? this._weeklyPages(d) : this._monthlyPages(d);
    return `
      <div class="rpt-page rpt-page-bg-warm rpt-ai-page">
        <div class="rpt-page-number">01</div>
        <div class="rpt-page-icon">${Lucide.icon('sparkles', 24)}</div>
        <div class="rpt-page-label">AI ASSESSMENT</div>
        <div class="rpt-page-title">${title}趋势分析</div>
        <div class="rpt-ai-assessment">${d.aiAssessment ? Utils.escapeHtml(d.aiAssessment) : '暂无 AI 评估。你可以先在分析页生成解读，再重新打开报告。'}</div>
      </div>
      ${pages}
      <div class="rpt-ending">
        <div class="rpt-ending-content">
          <div class="rpt-ending-emoji">${Lucide.icon('heart-pulse', 32)}</div>
          <div class="rpt-ending-title">记录每一天的成长</div>
          <div class="rpt-ending-text">${d.startDate === d.endDate ? d.startDate : `${d.startDate} - ${d.endDate}`}<br>记录数据 ${d.totalRecords + d.totalClean} 次<br>宝宝又长大了一点点</div>
          <div class="rpt-ending-brand">OneOne 成长日记</div>
        </div>
        <div class="rpt-deco-circle rpt-deco-1"></div><div class="rpt-deco-circle rpt-deco-2"></div>
      </div>`;
  },

  _bindChartZoom(root) {
    if (!root || root.__reportZoomBound) return;
    root.__reportZoomBound = true;

    // 事件委托：不要只依赖整页 .chart-zoomable，实际点击 SVG/柱状图/图表容器都能命中。
    root.addEventListener('click', e => {
      const chart = e.target.closest ? e.target.closest('.rpt-chart-container, .v2-area-chart, .rpt-bar-chart') : null;
      if (!chart || !root.contains(chart) || e.target.closest('button, a')) return;
      e.preventDefault();
      e.stopPropagation();
      this._openChartFullscreen(chart);
    }, true);

    root.querySelectorAll('.chart-zoomable').forEach(page => {
      page.style.cursor = 'pointer';
      page.addEventListener('click', e => {
        // 图表本身由 root 委托处理，避免先打开整页再打开图表。
        if (e.target.closest && e.target.closest('.rpt-chart-container, .v2-area-chart, .rpt-bar-chart')) return;
        if (e.target.closest && e.target.closest('button, a')) return;
        e.preventDefault();
        e.stopPropagation();
        this._openChartFullscreen(page);
      });
    });

    // 添加明确的可点击按钮，解决移动端点击 SVG/图表内部命中不稳定的问题。
    root.querySelectorAll('.rpt-chart-container').forEach(container => {
      if (container.querySelector('.chart-zoom-trigger')) return;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'chart-zoom-trigger';
      trigger.setAttribute('aria-label', '放大图表');
      trigger.innerHTML = `${Lucide.icon('maximize-2', 14)}<span>放大</span>`;
      trigger.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        this._openChartFullscreen(container);
      });
      container.appendChild(trigger);
    });
  },

  _openChartFullscreen(chartElement) {
    const overlay = document.createElement('div');
    overlay.className = 'chart-fullscreen-overlay';
    const clone = chartElement.cloneNode(true);
    clone.classList.add('chart-fullscreen-content');
    clone.querySelectorAll('.chart-zoom-trigger, .chart-zoom-hint').forEach(el => el.remove());
    overlay.innerHTML = `<button class="chart-close-btn" onclick="ReportPage._closeChartFullscreen(this)">${Lucide.icon('x', 20)}<span>关闭</span></button><div class="chart-fullscreen-container"></div>`;
    overlay.querySelector('.chart-fullscreen-container').appendChild(clone);
    document.body.appendChild(overlay);
    document.body.classList.add('landscape-lock');
    if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {});
    overlay.addEventListener('click', e => { if (e.target === overlay) this._closeChartFullscreen(overlay); });
  },

  _closeChartFullscreen(element) {
    const overlay = element?.closest ? element.closest('.chart-fullscreen-overlay') : element;
    if (overlay) overlay.remove();
    document.body.classList.remove('landscape-lock');
    if (screen.orientation?.unlock) screen.orientation.unlock();
  },

  _shareReportData() {
    const d = this._reportData;
    if (!d) return;
    const typeLabel = d.type === 'daily' ? '日报' : d.type === 'weekly' ? '周报' : '月报';
    const dateRange = d.startDate === d.endDate ? d.startDate : `${d.startDate} - ${d.endDate}`;
    let text = `${d.baby?.name || '宝宝'}的${typeLabel}\n${dateRange}\n\n`;
    text += `总奶量: ${d.totalMilk} ml\n喂养次数: ${d.totalFeed} 次\n睡眠时长: ${(d.totalSleep / 60).toFixed(1)} 小时\n排便次数: ${d.totalStool} 次\n清洁护理: ${d.totalClean} 次\n`;
    if (d.aiAssessment) text += `\nAI评估:\n${d.aiAssessment}\n`;
    text += '\n-- OneOne 成长日记';
    if (navigator.share) navigator.share({ title: `${d.baby?.name || '宝宝'}的${typeLabel}`, text }).catch(e => { if (e?.name !== 'AbortError') this._copyToClipboard(text); });
    else this._copyToClipboard(text);
  },

  _copyToClipboard(text) {
    const done = () => Utils.showToast('已复制到剪贴板');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => Utils.showToast('复制失败'));
    else {
      const textarea = document.createElement('textarea');
      textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
      document.body.appendChild(textarea); textarea.select();
      try { document.execCommand('copy'); done(); } catch (e) { Utils.showToast('复制失败'); }
      textarea.remove();
    }
  },

  // ===== 日历 =====
  _renderCalendarHTML() {
    const days = Utils.getCalendarDays(this.calendarYear, this.calendarMonth);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const todayStr = Utils.todayStr();

    let html = weekdays.map(w => `<div class="calendar-weekday">${w}</div>`).join('');
    days.forEach(d => {
      const dateStr = d.year + '-' + String(d.month + 1).padStart(2, '0') + '-' + String(d.day).padStart(2, '0');
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === this.selectedDate;
      let classes = 'calendar-day';
      if (d.otherMonth) classes += ' other-month';
      if (isToday) classes += ' today';
      if (isSelected) classes += ' selected';
      html += `<div class="${classes}" onclick="ReportPage.selectDay('${dateStr}')">${d.day}</div>`;
    });
    return html;
  },

  prevMonth() {
    this.calendarMonth--;
    if (this.calendarMonth < 0) { this.calendarMonth = 11; this.calendarYear--; }
    this._refreshCalendar();
  },

  nextMonth() {
    this.calendarMonth++;
    if (this.calendarMonth > 11) { this.calendarMonth = 0; this.calendarYear++; }
    this._refreshCalendar();
  },

  _refreshCalendar() {
    const title = document.getElementById('rpt-cal-title');
    if (title) title.textContent = `${this.calendarYear}年${this.calendarMonth + 1}月`;
    const grid = document.getElementById('rpt-calendar-grid');
    if (grid) grid.innerHTML = this._renderCalendarHTML();
  },

  async selectDay(dateStr) {
    this.selectedDate = dateStr;
    this._refreshCalendar();
    const detail = document.getElementById('rpt-calendar-day-detail');
    if (!detail) return;

    Utils.showLoading();
    try {
      const snapshot = await API.getUnifiedSnapshot({ startDate: dateStr, endDate: dateStr });
      const feedRecords = (snapshot.records?.feeding || []).filter(record => Utils.localDateFromISO(record.time || record.occurredAt) === dateStr);
      const stoolRecords = (snapshot.records?.stool || []).filter(record => Utils.localDateFromISO(record.time || record.occurredAt) === dateStr);
      const sleepRecords = (snapshot.records?.sleep || []).filter(record => Utils.localDateFromISO(record.startTime || record.occurredAt) === dateStr);
      const dateTodos = (snapshot.records?.todo || []).filter(record => record.date === dateStr);

      const totalMilk = feedRecords.reduce((s, r) => s + (r.amount || 0), 0);
      const urineCount = stoolRecords.filter(r => r.type === 'urine').length;
      const stoolCount = stoolRecords.filter(r => !r.type || r.type === 'stool').length;
      const diaperCount = stoolRecords.filter(r => r.type === 'diaper').length;
      const sleepMin = sleepRecords.reduce((s, r) => s + (r.duration || 0), 0);

      // 读取当天心情
      const moodData = Utils.storage.get('moodData') || {};
      const momMoodData = Utils.storage.get('momMoodData') || {};
      const babyMood = moodData[dateStr];
      const momMood = momMoodData[dateStr];
      const moodHTML = (babyMood || momMood) ? `
        <div class="cdd-section">
          <div class="cdd-section-title">${Lucide.icon('star', 18)} 今日心情</div>
          <div class="cdd-row" style="gap:12px">
            ${babyMood ? `<span>${Lucide.icon('star', 14)} ${Utils.escapeHtml(babyMood.label || '')}</span>` : ''}
            ${momMood ? `<span>${Lucide.icon('heart-pulse', 14)} ${Utils.escapeHtml(momMood.label || '')}</span>` : ''}
          </div>
        </div>
      ` : '';

      detail.innerHTML = `
        <div class="calendar-day-detail">
          <div class="cdd-title">${dateStr} 每日汇总</div>
          <div class="cdd-stats">
            <div class="cdd-stat"><span class="cdd-stat-val">${totalMilk}</span><span class="cdd-stat-label">奶量(ml)</span></div>
            <div class="cdd-stat"><span class="cdd-stat-val">${feedRecords.length}</span><span class="cdd-stat-label">喂养(次)</span></div>
            <div class="cdd-stat"><span class="cdd-stat-val">${urineCount}</span><span class="cdd-stat-label">小便</span></div>
            <div class="cdd-stat"><span class="cdd-stat-val">${stoolCount}</span><span class="cdd-stat-label">大便</span></div>
            <div class="cdd-stat"><span class="cdd-stat-val">${diaperCount}</span><span class="cdd-stat-label">尿不湿</span></div>
            <div class="cdd-stat"><span class="cdd-stat-val">${Utils.formatDuration(sleepMin)}</span><span class="cdd-stat-label">睡眠</span></div>
          </div>
          ${moodHTML}
          ${feedRecords.length > 0 ? `
          <div class="cdd-section">
            <div class="cdd-section-title">喂养明细</div>
            ${feedRecords.map(r => `
              <div class="cdd-row">
                <span>${Utils.formatTime(r.time)}</span>
                <span>${this._feedLabel(r.type)} ${r.amount ? r.amount + (r.unit || 'ml') : ''}</span>
              </div>
            `).join('')}
          </div>` : ''}
          <div class="cdd-section">
            <div class="cdd-section-title">${Lucide.icon('clipboard-list', 18)} 待办事项</div>
            ${dateTodos.length > 0 ? dateTodos.map(t => `
              <div class="cdd-row" style="gap:4px;align-items:center">
                <span style="cursor:pointer;font-size:16px" onclick="App._toggleDateTodo('${t._id}','${dateStr}',${t.completed})">${t.completed ? Lucide.icon('check-circle', 16) : Lucide.icon('circle', 16)}</span>
                <span style="flex:1;${t.completed ? 'text-decoration:line-through;color:var(--text-secondary)' : ''}">${Utils.escapeHtml(t.title)}</span>
                <button class="btn btn-outline btn-sm" style="font-size:10px;padding:2px 6px" onclick="App._editDateTodo('${Utils.jsAttr(t._id)}','${dateStr}','${Utils.jsAttr(t.title)}')">${Lucide.icon('file-text', 14)}</button>
                <button class="btn btn-outline btn-sm" style="font-size:10px;padding:2px 6px" onclick="App._deleteDateTodo('${t._id}','${dateStr}')">&times;</button>
              </div>
            `).join('') : '<div class="text-muted" style="font-size:12px;padding:4px 0">暂无待办</div>'}
            <button class="btn btn-primary btn-block mt-8" style="font-size:13px" onclick="App._closeCalendarDetail();App._addDateTodo('${dateStr}')">+ 添加待办</button>
          </div>
          <div class="cdd-section">
            <div class="cdd-section-title">${Lucide.icon('target', 18)} 里程碑</div>
            <div class="form-group">
              <input type="text" id="rpt-ms-input" class="form-input" placeholder="如：第一次翻身" style="margin-bottom:8px">
            </div>
            <button class="btn btn-primary btn-block" style="font-size:13px" onclick="App.addCalendarMilestone('${dateStr}')">记录里程碑</button>
          </div>
        </div>
      `;
    } catch (e) {
      detail.innerHTML = `<div class="text-muted text-center" style="padding:16px">加载失败: ${Utils.escapeHtml(e.message)}</div>`;
    }
    Utils.hideLoading();
  },

  _feedLabel(type) {
    const t = APP_CONFIG.feedingTypes.find(f => f.value === type);
    return t ? t.label : type;
  },

  // ===== 成长曲线 =====
  async _loadGrowthCurve() {
    const section = document.getElementById('growth-curve-section');
    if (!section) return;

    const baby = Utils.getBabyInfo();
    const gender = baby.gender || 'male';
    const monthAge = Utils.calcMonthAge(baby.birthDate);

    const list = await API.listGrowth(1).catch(() => null);
    const records = (list?.records || []).slice(0, 20).reverse();

    if (records.length === 0) {
      section.innerHTML = '<p class="text-muted text-center" style="padding:12px 0">暂无成长数据，请先记录测量数据</p>';
      return;
    }

    const weights = records.map(r => ({ date: r.date, value: r.weight })).filter(r => r.value);
    const heights = records.map(r => ({ date: r.date, value: r.height })).filter(r => r.value);

    let curveHTML = '';

    if (weights.length > 0) {
      const ev = evaluateGrowth(monthAge, gender, weights[weights.length - 1].value, 'weight');
      const cWeight = window.__UI_V3__ ? 'var(--color-category-1)' : '#4A90D9';
      curveHTML += this._curveSVG('体重 (kg)', weights, cWeight, ev);
    }
    if (heights.length > 0) {
      const ev = evaluateGrowth(monthAge, gender, heights[heights.length - 1].value, 'height');
      const cHeight = window.__UI_V3__ ? 'var(--color-category-2)' : '#52C41A';
      curveHTML += this._curveSVG('身长 (cm)', heights, cHeight, ev);
    }

    section.innerHTML = curveHTML;
  },

  _curveSVG(title, data, color, evalResult) {
    if (data.length < 2) {
      return `<div class="growth-curve-item"><div class="gc-title">${title}</div><p class="text-muted" style="font-size:12px;padding:8px 0">需至少2条记录才能绘制曲线</p></div>`;
    }

    const w = 300, h = 140, pad = 30;
    const values = data.map(d => d.value);
    const minV = Math.min(...values) * 0.95;
    const maxV = Math.max(...values) * 1.05;
    const range = maxV - minV || 1;

    const points = data.map((d, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - ((d.value - minV) / range) * (h - pad * 2);
      return `${x},${y}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const dots = data.map((d, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - ((d.value - minV) / range) * (h - pad * 2);
      return `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`;
    }).join('');

    const lastVal = data[data.length - 1].value;
    const statusLabel = evalResult.status === 'normal' ? '正常范围' : evalResult.status === 'above' ? '高于P50' : '低于P50';
    // v2：评估标注走状态语义色三件套（normal→success / above→highlight / below→error）
    const statusCls = window.__UI_V3__
      ? (evalResult.status === 'normal' ? 'gc-status--normal' : evalResult.status === 'above' ? 'gc-status--above' : 'gc-status--below')
      : '';

    return `
      <div class="growth-curve-item">
        <div class="gc-title">${title} <span class="gc-p50 ${statusCls}">P50: ${evalResult.median} &middot; ${statusLabel}</span></div>
        <svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:300px">
          <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="${window.__UI_V3__ ? 'var(--color-border-subtle)' : '#ddd'}" stroke-width="1"/>
          <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="${window.__UI_V3__ ? 'var(--color-border-subtle)' : '#ddd'}" stroke-width="1"/>
          <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2"/>
          ${dots}
          <text x="${w - pad}" y="${h - pad + 14}" text-anchor="end" fill="${window.__UI_V3__ ? 'var(--color-text-muted)' : '#999'}" font-size="9">最近</text>
          <text x="${pad}" y="${pad - 6}" fill="${window.__UI_V3__ ? 'var(--color-text-muted)' : '#999'}" font-size="9">${maxV.toFixed(1)}</text>
          <text x="${pad}" y="${h - pad + 14}" fill="${window.__UI_V3__ ? 'var(--color-text-muted)' : '#999'}" font-size="9">${minV.toFixed(1)}</text>
        </svg>
        <div class="gc-interpretation">
          ${this._interpretGrowth(title, lastVal, evalResult)}
        </div>
      </div>
    `;
  },

  _interpretGrowth(title, value, ev) {
    const median = ev.median;
    const status = ev.status;
    let interp = '';
    if (status === 'normal') {
      interp = `当前${title}为 ${value}，接近 P50 中位数 (${median})，发育正常。`;
    } else if (status === 'above') {
      interp = `当前${title}为 ${value}，高于 P50 中位数 (${median})，发育良好，注意监测体重增长速度。`;
    } else {
      interp = `当前${title}为 ${value}，低于 P50 中位数 (${median})，建议关注喂养情况，必要时咨询儿科医生。`;
    }
    const cls = window.__UI_V3__
      ? (status === 'normal' ? 'gc-status--normal' : status === 'above' ? 'gc-status--above' : 'gc-status--below')
      : '';
    return `<div class="gc-interp ${cls}">${interp}</div>`;
  }
};

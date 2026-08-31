/**
 * 成长日记模块 — 喂养/排便/清洁/健康 4个子标签；睡眠统一在睡眠管理
 */
window.ParentingPage = {
  currentSub: 'feeding',
  _feedKnowExpanded: false,
  _feedKnowOpenItem: -1,
  _cleanKnowExpanded: false,
  _cleanKnowOpenItem: -1,
  _sleepKnowExpanded: false,
  _sleepKnowOpenItem: -1,

  async render(container, subTab) {
    const renderSeq = container.dataset.renderSeq;
    if (subTab) this.currentSub = subTab;
    const tabs = [
      { key: 'feeding', label: '喂养记录' },
      { key: 'urination', label: '排便记录' },
      { key: 'clean', label: '清洁护理' },
      { key: 'health', label: '日常健康' }
    ];

    container.innerHTML = `
      <nav class="v3-subtabs" id="parenting-sub-tabs" role="tablist" aria-label="成长日记分类">
        ${tabs.map(t => `<button type="button" class="v3-subtab ${t.key === this.currentSub ? 'is-active' : ''}" role="tab" aria-selected="${t.key === this.currentSub}" onclick="ParentingPage.switchSub('${t.key}')">${t.label}</button>`).join('')}
      </nav>
      <div id="parenting-content" class="v3-subtab-panel" role="tabpanel"></div>
    `;

    await this._renderSub(renderSeq);
  },

  async switchSub(key) {
    this.currentSub = key;
    $$('#parenting-sub-tabs .v3-subtab').forEach(b => {
      const active = b.textContent.trim() === this._tabLabel(key);
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
    });
    await this._renderSub();
  },

  _tabLabel(key) {
    return { feeding: '喂养记录', urination: '排便记录', clean: '清洁护理', health: '日常健康' }[key];
  },

  // ===== 记录删除（云端删除，多端自动拉齐） =====
  async _deleteRecord(kind, recordId) {
    if (!recordId) return;
    // R8：离线或有待同步记录时禁止删除（提示先同步）
    if (!Utils.offlineGuard('当前离线，请联网同步后再删除')) return;
    if (!confirm('确定删除这条记录吗？删除后无法恢复。')) return;
    // fix v95：方法从 API 对象摘出后 this 丢失（this.call → undefined），必须绑定回 API
    const api = { feeding: API.deleteFeeding.bind(API), stool: API.deleteStool.bind(API), clean: API.deleteClean.bind(API), sleep: API.deleteSleep.bind(API) }[kind];
    if (!api) return;
    try {
      await api(recordId);
      Utils.showToast('已删除');
      await this._renderSub(); // 重新拉取云端最新数据
    } catch (e) {
      Utils.showToast('删除失败: ' + (e.message || '请稍后重试'));
    }
  },

  /** 删除按钮 —— 仅本人创建的记录显示，避免越权提示 */
  _delBtn(kind, record, ownerField, extraBtn) {
    const ownerId = record[ownerField];
    if (ownerId && ownerId !== Auth.getMemberId()) return '';
    return `<div class="record-actions">
      ${extraBtn || ''}
      <button class="icon-btn-sm" title="删除此记录" onclick="event.stopPropagation();ParentingPage._deleteRecord('${kind}','${record._id}')">${Lucide.icon('scissors', 16)}</button>
    </div>`;
  },

  async _fetch7Days(kind) {
    const end = Utils.todayStr();
    const start = Utils.formatDate(new Date(Date.now() - 6 * 86400000), 'YYYY-MM-DD');
    const snapshot = await API.getUnifiedSnapshot({ startDate: start, endDate: end });
    if (!snapshot || !['loaded', 'partial'].includes(snapshot.status)) throw new Error('统一数据快照不可用');
    const records = snapshot.records?.[kind] || [];
    const dayMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      const key = Utils.formatDate(d, 'YYYY-MM-DD');
      dayMap[key] = { date: key, label: Utils.formatDate(d, 'MM-DD'), count: 0, ml: 0, breast: 0, urine: 0, stool: 0, diaper: 0, clean: 0, bath: 0, shampoo: 0, washFace: 0, nail: 0, sleepMin: 0 };
    }
    for (const record of records) {
      const key = Utils.localDateFromISO(record.time || record.occurredAt || record.startTime || record.date);
      const day = dayMap[key];
      if (!day) continue;
      day.count++;
      if (kind === 'feeding') {
        day.ml += Number(record.consumedMl || record.outputMl || record.amount || 0);
        if (record.feedingSubtype === 'breast_direct' || record.type === 'breast') day.breast++;
      }
      if (kind === 'stool') {
        const type = record.type || 'stool';
        if (type === 'urine') day.urine++; else if (type === 'diaper') day.diaper++; else day.stool++;
      }
      if (kind === 'clean') {
        day.clean++;
        if (record.type === 'bath') day.bath++;
        if (record.type === 'shampoo') day.shampoo++;
        if (record.type === 'wash_face') day.washFace++;
        if (record.type === 'nail_trim') day.nail++;
      }
      if (kind === 'sleep') day.sleepMin += Number(record.duration || 0);
    }
    const days = Object.values(dayMap);
    const sum = key => days.reduce((total, day) => total + day[key], 0);
    return { days, totals: { count: sum('count'), ml: sum('ml'), breast: sum('breast'), urine: sum('urine'), stool: sum('stool'), diaper: sum('diaper'), clean: sum('clean'), bath: sum('bath'), shampoo: sum('shampoo'), washFace: sum('washFace'), nail: sum('nail'), sleepMin: sum('sleepMin') } };
  },

  /** 近7天统计卡片（汇总数字 + 每日迷你柱状图） */
  _render7DayCard(cfg) {
    const max = Math.max(...cfg.days.map(d => d[cfg.valueKey] || 0), 1);
    const bars = cfg.days.map(d => {
      const v = d[cfg.valueKey] || 0;
      const h = Math.max(3, Math.round(v / max * 100));
      return `
        <div class="w7d-col" title="${d.date}: ${v}${cfg.valueUnit}">
          <div class="w7d-val">${v}</div>
          <div class="w7d-bar-wrap"><div class="w7d-bar" style="height:${h}%"></div></div>
          <div class="w7d-label">${d.label}</div>
        </div>`;
    }).join('');
    return `
      <div class="card">
        <div class="card-title">${Lucide.icon('trending-up', 18)} ${cfg.title}</div>
        <div class="w7d-summary">
          ${cfg.summaryItems.map(s => `<div class="w7d-sum-item"><div class="w7d-sum-num">${s.num}</div><div class="w7d-sum-label">${s.label}</div></div>`).join('')}
        </div>
        <div class="w7d-chart">${bars}</div>
        ${cfg.footerHTML || ''}
      </div>`;
  },

  // ===== 今日明细 / 近7天 视图切换 =====
  _viewMode: { feeding: 'today', urination: 'today', clean: 'today' },

  /** 切换今日明细 / 近7天（纯 DOM 显隐，不重新拉取） */
  toggleView(kind, mode) {
    this._viewMode[kind] = mode;
    const seg = document.getElementById('seg-' + kind);
    if (seg) seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    ['today', 'week'].forEach(m => {
      const p = document.getElementById('panel-' + m + '-' + kind);
      if (p) p.classList.toggle('active', m === mode);
    });
    if (kind === 'feeding' && this._feedingChart) {
      if (mode === 'week') requestAnimationFrame(() => this._feedingChart?.render());
      else this._feedingChart.hideTooltip();
    }
  },

  /** 分段切换器 HTML（今日明细 | 近7天） */
  _segSwitch(kind, todayLabel, weekLabel) {
    const mode = this._viewMode[kind] || 'today';
    return `
      <div class="seg-switch" id="seg-${kind}">
        <button class="seg-btn ${mode === 'today' ? 'active' : ''}" data-mode="today" onclick="ParentingPage.toggleView('${kind}','today')">${todayLabel || '今日明细'}</button>
        <button class="seg-btn ${mode === 'week' ? 'active' : ''}" data-mode="week" onclick="ParentingPage.toggleView('${kind}','week')">${weekLabel || '近7天'}</button>
      </div>`;
  },

  async _renderSub(renderSeq = document.getElementById('content')?.dataset.renderSeq) {
    const content = document.getElementById('content');
    if (content?.dataset.renderPage !== 'parenting' || content?.dataset.renderSeq !== String(renderSeq)) return;
    const el = document.getElementById('parenting-content');
    if (!el) return;
    Utils.showLoading();
    try {
      // 全部子页面自适应一屏
      el.className = 'parenting-one-screen';
      switch (this.currentSub) {
        case 'feeding': await this._renderFeeding(el); break;
        case 'urination': await this._renderUrination(el); break;
        case 'clean': await this._renderClean(el); break;
        case 'health': await this._renderHealth(el); break;
        case 'sleep': await this._renderSleep(el); break;
      }
    } catch (e) {
      const state = window.V3UI?.errorState ? V3UI.errorState(e) : 'error';
      const title = state === 'auth-required' ? '请先登录' : state === 'function-not-found' ? '服务暂未部署' : state === 'timeout' ? '请求超时，请重试' : state === 'offline' ? '当前离线' : '成长日记暂不可用';
      const desc = state === 'auth-required' ? '登录后才能查看成长记录。' : state === 'timeout' ? '请求超时，请稍后重试。' : e.message || '请稍后重试。';
      el.innerHTML = window.V3UI?.stateHTML ? V3UI.stateHTML(state, title, desc, '<button class="btn btn-primary" type="button" onclick="ParentingPage._renderSub()">重新加载</button>') : `<div class="empty-state"><h2>${Utils.escapeHtml(title)}</h2><p>${Utils.escapeHtml(desc)}</p></div>`;
      el.setAttribute('data-v3-request-state', state);
      window.V3UI?.setStatus?.(state, title);
    } finally {
      Utils.hideLoading();
      if (!el.querySelector('[data-v3-state]')) window.V3UI?.setStatus?.('loaded', '');
    }
  },

  // ===== 喂养 =====
  async _renderFeeding(el) {
    try {
    const baby = Utils.getBabyInfo();
    const endDate = Utils.todayStr();
    const startDate = Utils.formatDate(new Date(Date.now() - 6 * 86400000), 'YYYY-MM-DD');
    const snapshot = await API.getUnifiedSnapshot({ startDate, endDate });
    if (!snapshot || !['loaded', 'partial'].includes(snapshot.status)) throw new Error('统一数据快照不可用');
    const feedRecords = snapshot.records?.feeding || [];
    const todayRecords = feedRecords.filter(record => Utils.localDateFromISO(record.time || record.occurredAt) === endDate);
    const summary = { records: todayRecords, totalML: todayRecords.reduce((sum, record) => sum + Number(record.consumedMl || record.outputMl || record.amount || 0), 0), totalCount: todayRecords.length };
    const week = await this._fetch7Days('feeding');
    const feedingRange = { records: feedRecords };

    const todayMilk = Number(summary?.totalML || 0);
    const feedCount = Number(summary?.totalCount || 0);
    const milkRef = Utils.getDailyMilkHint(baby.birthDate);
    const target = Utils.getFeedingTarget();
    const targetPct = Math.min(100, Math.round(todayMilk / target * 100));
    if (this._feedingChart) {
      this._feedingChart.destroy();
      this._feedingChart = null;
    }
    const feedingDistribution = `
      <div class="feeding-distribution-embedded">
        <div class="feeding-distribution-heading">
          <span>${Lucide.icon('clock-3', 18)} 近7天喂养时间</span>
          <small>点击气泡查看时间、类型和奶量</small>
        </div>
        <div id="feeding-time-chart" class="feeding-time-chart-mount"></div>
      </div>`;

    // 上次喂养信息
    const records = summary?.records || [];
    const lastFeed = records[0];
    let lastFeedHTML = '';
    if (lastFeed) {
      lastFeedHTML = `
        <div class="card">
          <div class="card-title">${Lucide.icon('timer', 18)} 上次喂养</div>
          <div class="card-row"><span class="card-label">时间</span><span class="card-value">${Utils.timeAgo(lastFeed.time)}</span></div>
          <div class="card-row"><span class="card-label">类型</span><span class="card-value">${this._feedLabel(lastFeed.type)}</span></div>
          <div class="card-row"><span class="card-label">量</span><span class="card-value">${lastFeed.amount ? lastFeed.amount + (lastFeed.unit || 'ml') : '按需'}</span></div>
          ${lastFeed.note ? `<div class="card-row"><span class="card-label">备注</span><span class="card-value">${Utils.escapeHtml(lastFeed.note)}</span></div>` : ''}
        </div>
      `;
    }

    el.innerHTML = `
      <!-- 当日汇总（增大展示） -->
      <div class="dash-stat-row dash-stat-row-lg">
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('bottle', 20)}</div><div class="ds-value" style="color:var(--primary)">${todayMilk}</div><div class="ds-label">今日奶量(ml)</div></div>
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('bar-chart', 20)}</div><div class="ds-value">${feedCount}</div><div class="ds-label">喂养次数</div></div>
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('heart-pulse', 20)}</div><div class="ds-value">${(records.filter(r => r.type === 'breast')).length}</div><div class="ds-label">亲喂次数</div></div>
      </div>

      <!-- 本月喂养知识（折叠卡，汇总栏下方，v83 顺序） -->
      ${this._renderFeedingKnowledge(baby, Utils.calcMonthAge(baby.birthDate))}

      <!-- 今日奶量设置 -->
      <div class="card">
        <div class="card-title">${Lucide.icon('bottle', 18)} 今日奶量</div>
        <div class="target-progress">
          <div class="tp-bar">
            <div class="tp-fill" style="width:${targetPct}%"></div>
          </div>
          <div class="tp-text">
            <span style="font-size:22px;font-weight:700;color:var(--primary)">${todayMilk}</span>
            <span style="color:var(--text-secondary)"> / ${target} ml</span>
            <span style="margin-left:auto;color:${targetPct >= 100 ? 'var(--success)' : 'var(--text-secondary)'}">${targetPct}%</span>
          </div>
        </div>
        <button class="btn btn-outline" style="font-size:12px;padding:4px 12px;margin-top:8px" onclick="App.openTargetForm()">设置目标</button>
      </div>

      <!-- 参考建议 -->
      <div class="card">
        <div class="card-row"><span class="card-label">参考奶量</span><span class="card-value">${milkRef}</span></div>
        <div class="card-row"><span class="card-label">间隔建议</span><span class="card-value">${Utils.getFeedingIntervalHint(baby.birthDate)}</span></div>
      </div>

      <!-- 快速记录 -->
      <div class="qr-section" style="margin-bottom:12px">
        <div class="qr-grid qr-grid-3">
          <div class="qr-btn qr-btn-default" onclick="App.quickBreast()">
            <div class="qr-btn-icon">${Lucide.icon('heart-pulse', 24)}</div><div class="qr-btn-label">亲喂</div>
          </div>
          <div class="qr-btn qr-btn-default" onclick="App.openBottleBreastForm()">
            <div class="qr-btn-icon">${Lucide.icon('bottle', 24)}</div><div class="qr-btn-label">母乳瓶喂</div>
          </div>
          <div class="qr-btn qr-btn-default" onclick="App.openFormulaForm()">
            <div class="qr-btn-icon">${Lucide.icon('bottle', 24)}</div><div class="qr-btn-label">配方奶</div>
          </div>
        </div>
      </div>

      <!-- 上次喂养 -->
      ${lastFeedHTML}

      <!-- 今日明细 / 近7天 切换 -->
      ${this._segSwitch('feeding', '今日明细', '近7天')}
      <div class="seg-panel ${this._viewMode.feeding === 'today' ? 'active' : ''}" id="panel-today-feeding">
      ${records.length > 0 ? `
      <div class="card">
        <div class="card-title">${Lucide.icon('clipboard-list', 18)} 今日明细</div>
        ${records.map(r => {
          let detail = '';
          if (r.type === 'breast') {
            detail = `${r.isEstimated ? '~' : ''}${r.amount || '按需'}${r.amount ? (r.unit || 'ml') : ''}${r.isManualAdjusted ? '*' : ''}`;
          } else if (r.amount) {
            detail = r.amount + r.unit;
          }
          return `
          <div class="record-item" ${r.type === 'breast' && r._id ? `onclick="BreastFeeding.openForm(${JSON.stringify(r).replace(/"/g, '&quot;')})" style="cursor:pointer"` : ''}>
            <div class="record-main">
              <div class="record-title">${this._feedLabel(r.type)} ${detail} ${r.type === 'breast' && r.isEstimated ? '<span class="text-muted" title="亲喂奶量为估算值">ⓘ</span>' : ''}</div>
              <div class="record-meta">${Utils.formatTime(r.time)}${r.type === 'breast' && r.side ? ' · ' + (BreastFeeding?.sideLabels?.[r.side] || r.side) : ''}${r.type === 'breast' && r.duration ? ' · ' + (BreastFeeding?.durationLabels?.[r.duration] || r.duration) : ''}${r.isBackfill ? ' · 补记' : ''} ${r.note ? '· ' + Utils.escapeHtml(r.note) : ''}</div>
            </div>
            ${this._delBtn('feeding', r, 'recorderMemberId')}
          </div>
        `;}).join('')}
      </div>` : (window.__UI_V3__ ? `<div class="v2-empty-mini"><div class="em-icon">${Lucide.icon('bottle', 24)}</div><p>今天还没有喂养记录<br>点击上方「快速记录」开始吧</p></div>` : `<div class="empty-mini"><div class="em-icon">${Lucide.icon('bottle', 24)}</div><p>今天还没有喂养记录</p></div>`)}
      </div>
      <div class="seg-panel ${this._viewMode.feeding === 'week' ? 'active' : ''}" id="panel-week-feeding">
      ${week ? this._render7DayCard({
        title: '近7天喂养',
        valueKey: 'ml',
        valueUnit: 'ml',
        days: week.days,
        summaryItems: [
          { num: week.totals.ml, label: '总奶量(ml)' },
          { num: week.totals.count, label: '喂养次数' },
          { num: week.totals.breast, label: '亲喂次数' }
        ],
        footerHTML: feedingDistribution
      }) : `<div class="empty-mini"><div class="em-icon">${Lucide.icon('trending-up', 24)}</div><p>近7天数据加载失败</p></div>`}
      </div>
    `;
    const chartMount = el.querySelector('#feeding-time-chart');
    if (chartMount && window.FeedingTimeChart) {
      this._feedingChart = new FeedingTimeChart(chartMount, {
        loadWeek: async () => ({ records: feedingRange.records || [] }),
        weekStart: startDate,
        feedings: feedingRange.records || [],
        showWeekNavigation: false,
        onEdit: record => { if (window.BreastFeeding && record.type === 'breast') BreastFeeding.openForm(record); }
      });
    }
    } catch (e) {
      el.innerHTML = Utils.emptyState({
        icon: Lucide.icon('bottle', 32), title: '加载喂养数据失败',
        desc: Utils.escapeHtml(e.message),
        action: '<button class="btn btn-primary" onclick="ParentingPage.switchSub(\'feeding\')">重试</button>',
        error: true
      });
    }
  },

  _feedLabel(type) {
    const t = APP_CONFIG.feedingTypes.find(f => f.value === type);
    return t ? `${Lucide.icon(t.icon || 'circle-dot', 16)} ${t.label}` : type;
  },

  // ===== 排便 =====
  async _renderUrination(el) {
    const baby = Utils.getBabyInfo();
    const snapshot = await API.getUnifiedSnapshot({ startDate: Utils.formatDate(new Date(Date.now() - 6 * 86400000), 'YYYY-MM-DD'), endDate: Utils.todayStr() });
    if (!snapshot || !['loaded', 'partial'].includes(snapshot.status)) throw new Error('统一数据快照不可用');
    const records = (snapshot.records?.stool || []).filter(record => Utils.localDateFromISO(record.time || record.occurredAt) === Utils.todayStr());
    const summary = { records };

    const week = await this._fetch7Days('stool');
    const urineCount = records.filter(r => r.type === 'urine').length;
    const diaperCount = records.filter(r => r.type === 'diaper').length;
    const stoolCount = records.filter(r => !['urine', 'diaper'].includes(r.type)).length;

    el.innerHTML = `
      <div class="dash-stat-row dash-stat-row-lg">
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('droplet', 20)}</div><div class="ds-value" style="color:#1890FF">${urineCount}</div><div class="ds-label">小便次数</div></div>
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('droplet', 20)}</div><div class="ds-value" style="color:var(--warning)">${stoolCount}</div><div class="ds-label">大便次数</div></div>
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('pin', 20)}</div><div class="ds-value" style="color:var(--success)">${diaperCount}</div><div class="ds-label">换尿不湿</div></div>
      </div>

      <div class="card">
        <div class="card-row"><span class="card-label">排便参考</span><span class="card-value">${Utils.getStoolFreqHint(baby.birthDate)}</span></div>
      </div>

      <div class="card">
        <div class="card-title">${Lucide.icon('plus', 18)} 快速记录</div>
        <div class="urination-type-grid">
          <div class="urination-type-btn" onclick="App.quickAddUrination('urine')">
            <span class="ut-icon">${Lucide.icon('droplet', 20)}</span><span class="ut-label">小便</span>
          </div>
          <div class="urination-type-btn" onclick="App.quickAddUrination('diaper')">
            <span class="ut-icon">${Lucide.icon('pin', 20)}</span><span class="ut-label">换尿不湿</span>
          </div>
          <div class="urination-type-btn" onclick="App.openStoolForm()">
            <span class="ut-icon">${Lucide.icon('droplet', 20)}</span><span class="ut-label">记录大便</span>
          </div>
        </div>
      </div>

      <!-- 今日明细 / 近7天 切换 -->
      ${this._segSwitch('urination', '今日记录', '近7天')}
      <div class="seg-panel ${this._viewMode.urination === 'today' ? 'active' : ''}" id="panel-today-urination">
      ${records.length > 0 ? `
      <div class="card">
        <div class="card-title">${Lucide.icon('clipboard-list', 18)} 今日排便记录</div>
        ${records.map(r => `
          <div class="record-item">
            <div class="record-main">
              <div class="record-title">${this._urinationLabel(r)}</div>
              <div class="record-meta">${Utils.formatTime(r.time)}${r.type === 'breast' && r.side ? ' · ' + (BreastFeeding?.sideLabels?.[r.side] || r.side) : ''}${r.type === 'breast' && r.duration ? ' · ' + (BreastFeeding?.durationLabels?.[r.duration] || r.duration) : ''}${r.isBackfill ? ' · 补记' : ''} ${r.note ? '· ' + Utils.escapeHtml(r.note) : ''}</div>
            </div>
            ${this._delBtn('stool', r, 'recorderMemberId')}
          </div>
        `).join('')}
      </div>` : (window.__UI_V3__ ? `<div class="v2-empty-mini"><div class="em-icon">${Lucide.icon('pin', 24)}</div><p>今天还没有排便记录<br>点击上方「快速记录」开始吧</p></div>` : `<div class="empty-mini"><div class="em-icon">${Lucide.icon('pin', 24)}</div><p>今天还没有排便记录</p></div>`)}
      </div>
      <div class="seg-panel ${this._viewMode.urination === 'week' ? 'active' : ''}" id="panel-week-urination">
      ${week ? this._render7DayCard({
        title: '近7天排便',
        valueKey: 'count',
        valueUnit: '次',
        days: week.days,
        summaryItems: [
          { num: week.totals.stool, label: '大便' },
          { num: week.totals.urine, label: '小便' },
          { num: week.totals.diaper, label: '尿不湿' }
        ]
      }) : `<div class="empty-mini"><div class="em-icon">${Lucide.icon('trending-up', 24)}</div><p>近7天数据加载失败</p></div>`}
      </div>
    `;
  },

  _urinationLabel(r) {
    if (r.type === 'urine') return Lucide.icon('droplet', 16) + ' 小便';
    if (r.type === 'diaper') return Lucide.icon('pin', 16) + ' 换尿不湿';
    const color = APP_CONFIG.stoolColors.find(c => c.value === r.color);
    const consistency = APP_CONFIG.stoolConsistencies.find(c => c.value === r.consistency);
    const amount = APP_CONFIG.stoolAmounts.find(c => c.value === r.amount);
    let label = Lucide.icon('droplet', 16) + ' 大便';
    if (color) label += ` ${Lucide.icon(color.icon || 'circle-dot', 14)}${color.label}`;
    if (consistency) label += ` ${Lucide.icon(consistency.icon || 'circle-dot', 14)}${consistency.label}`;
    if (amount) label += ` ${Lucide.icon(amount.icon || 'circle-dot', 14)}${amount.label}`;
    if (r.aiRecognized) label += ' ' + Lucide.icon('sparkles', 16);
    return label;
  },

  // ===== 清洁与每日护理 =====
  async _renderClean(el) {
    const snapshot = await API.getUnifiedSnapshot({ startDate: Utils.formatDate(new Date(Date.now() - 6 * 86400000), 'YYYY-MM-DD'), endDate: Utils.todayStr() });
    if (!snapshot || !['loaded', 'partial'].includes(snapshot.status)) throw new Error('统一数据快照不可用');
    const records = (snapshot.records?.clean || []).filter(record => Utils.localDateFromISO(record.time || record.occurredAt) === Utils.todayStr()).sort((a, b) => new Date(b.time || b.occurredAt) - new Date(a.time || a.occurredAt));
    const summary = { records, bath: records.filter(r => r.type === 'bath').length, shampoo: records.filter(r => r.type === 'shampoo').length, washFace: records.filter(r => r.type === 'wash_face').length, nailTrim: records.filter(r => r.type === 'nail_trim').length };

    const week = await this._fetch7Days('clean');
    const cleanRecords = records.filter(r => ['bath', 'shampoo', 'wash_face', 'nail_trim'].includes(r.type));
    // 每日护理活动（归于护理标准，仅作展示引用）
    const careRecords = records.filter(r => ['massage', 'visual_training', 'hearing_training', 'exercise', 'skin_care'].includes(r.type));

    const careTypeLabels = {
      massage: `${Lucide.icon('hand', 16)} 抚触按摩`, visual_training: `${Lucide.icon('eye', 16)} 视觉训练`, hearing_training: `${Lucide.icon('lightbulb', 16)} 听觉训练`,
      exercise: `${Lucide.icon('dumbbell', 16)} 被动操`, skin_care: `${Lucide.icon('droplet', 16)} 皮肤护理`
    };

    el.innerHTML = `
      <!-- 清洁（纯卫生） -->
      <div class="dash-stat-row dash-stat-row-lg">
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('bath', 20)}</div><div class="ds-value" style="color:var(--primary)">${summary?.bath || 0}</div><div class="ds-label">洗澡</div></div>
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('hand', 20)}</div><div class="ds-value" style="color:#722ED1">${summary?.shampoo || 0}</div><div class="ds-label">洗头</div></div>
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('sparkles', 20)}</div><div class="ds-value" style="color:#13C2C2">${summary?.washFace || 0}</div><div class="ds-label">洗脸</div></div>
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('scissors', 20)}</div><div class="ds-value" style="color:#EB2F96">${summary?.nailTrim || 0}</div><div class="ds-label">剪指甲</div></div>
      </div>

      <!-- 本月护理知识（折叠卡，汇总栏下方，v83 顺序） -->
      ${this._renderCleanKnowledge(Utils.getBabyInfo(), Utils.calcMonthAge(Utils.getBabyInfo().birthDate))}

      <div class="card">
        <div class="card-title">${Lucide.icon('droplet', 18)} 清洁</div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">洗澡、洗头、洗脸、剪指甲等纯卫生清洁活动</p>
        <div class="qr-grid qr-grid-4">
          <div class="qr-btn qr-btn-default" onclick="App.quickClean('bath')">
            <div class="qr-btn-icon">${Lucide.icon('bath', 24)}</div><div class="qr-btn-label">洗澡</div>
          </div>
          <div class="qr-btn qr-btn-default" onclick="App.quickClean('shampoo')">
            <div class="qr-btn-icon">${Lucide.icon('hand', 24)}</div><div class="qr-btn-label">洗头</div>
          </div>
          <div class="qr-btn qr-btn-default" onclick="App.quickClean('wash_face')">
            <div class="qr-btn-icon">${Lucide.icon('sparkles', 24)}</div><div class="qr-btn-label">洗脸</div>
          </div>
          <div class="qr-btn qr-btn-default" onclick="App.quickClean('nail_trim')">
            <div class="qr-btn-icon">${Lucide.icon('scissors', 24)}</div><div class="qr-btn-label">剪指甲</div>
          </div>
        </div>
      </div>

      <!-- 每日护理提示 -->
      <div class="card" style="background:linear-gradient(135deg,#f0f5ff,#f5f0ff);border:1px solid #e8e0f0">
        <div class="card-title">${Lucide.icon('heart-pulse', 18)} 每日护理</div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">抚触按摩、被动操、视觉训练等活动已移至首页-待办中管理</p>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:0">点击 <a href="javascript:showPage('dashboard')" style="color:var(--primary);text-decoration:underline">首页</a> 的"今日待办&打卡"进行护理打卡</p>
      </div>

      <!-- 今日明细 / 近7天 切换 -->
      ${this._segSwitch('clean', '今日记录', '近7天')}
      <div class="seg-panel ${this._viewMode.clean === 'today' ? 'active' : ''}" id="panel-today-clean">
      ${cleanRecords.length > 0 ? `
      <div class="card">
        <div class="card-title">${Lucide.icon('clipboard-list', 18)} 今日清洁记录</div>
        ${cleanRecords.map(r => {
          const label = { bath: `${Lucide.icon('bath', 16)} 洗澡`, shampoo: `${Lucide.icon('hand', 16)} 洗头`, wash_face: `${Lucide.icon('sparkles', 16)} 洗脸`, nail_trim: `${Lucide.icon('scissors', 16)} 剪指甲` }[r.type] || r.type;
          return `<div class="record-item">
            <div class="record-main">
              <div class="record-title">${label}</div>
              <div class="record-meta">${Utils.formatTime(r.time)}${r.type === 'breast' && r.side ? ' · ' + (BreastFeeding?.sideLabels?.[r.side] || r.side) : ''}${r.type === 'breast' && r.duration ? ' · ' + (BreastFeeding?.durationLabels?.[r.duration] || r.duration) : ''}${r.isBackfill ? ' · 补记' : ''} ${r.note ? '· ' + Utils.escapeHtml(r.note) : ''}</div>
            </div>
            ${this._delBtn('clean', r, 'recorderMemberId')}
          </div>`;
        }).join('')}
      </div>` : (window.__UI_V3__ ? `<div class="v2-empty-mini"><div class="em-icon">${Lucide.icon('bath', 24)}</div><p>今天还没有清洁记录<br>点击上方「快速记录」开始吧</p></div>` : `<div class="empty-mini"><div class="em-icon">${Lucide.icon('bath', 24)}</div><p>今天还没有清洁记录</p></div>`)}
      </div>
      <div class="seg-panel ${this._viewMode.clean === 'week' ? 'active' : ''}" id="panel-week-clean">
      ${week ? this._render7DayCard({
        title: '近7天清洁',
        valueKey: 'clean',
        valueUnit: '次',
        days: week.days,
        summaryItems: [
          { num: week.totals.bath, label: '洗澡' },
          { num: week.totals.shampoo, label: '洗头' },
          { num: week.totals.washFace, label: '洗脸' },
          { num: week.totals.nail, label: '剪指甲' }
        ]
      }) : `<div class="empty-mini"><div class="em-icon">${Lucide.icon('trending-up', 24)}</div><p>近7天数据加载失败</p></div>`}
      </div>
    `;
  },

  _growthTag(label, value, evalResult) {
    return `<div class="growth-value-tag ${evalResult.status}" style="text-align:center">
      <span class="gv-label">${label}</span>
      <span style="font-size:16px;font-weight:700">${value}</span>
      <span class="gv-p50">P50: ${evalResult.median}</span>
    </div>`;
  },

  // ===== 健康 =====
  async _renderHealth(el) {
    try {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby.birthDate) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">${Lucide.icon('heart-pulse', 32)}</div><p>请先创建宝宝档案</p></div>`;
      return;
    }
    const monthAge = Utils.calcMonthAge(baby.birthDate);
    const gender = baby.gender || 'male';
    const [summary, latestGrowth] = await Promise.all([
      API.healthTodaySummary().catch(() => null),
      API.latestGrowth().catch(() => null)
    ]);
    const nursing = Utils.getBabyNursing(baby.birthDate) || { ageLabel: '全部', items: [] };
    const nutritionGroups = getNutritionGroupsByAge(monthAge) || [];
    const nursingGroups = getNursingGroupsByAge(monthAge) || [];
    const customNutrition = Utils.getCustomNutritionItems();
    const customNursing = Utils.getCustomNursingItems();
    const disabledNutritionKeys = Utils.getDisabledStandardNutritionKeys();
    const disabledNursingKeys = Utils.getDisabledStandardNursingKeys();
    const isAdmin = Auth.isAdmin();

    // 月度推荐：查看上一个月龄段对比
    const lastAge = Utils.getLastCheckedMonthAge();
    let monthlyRecHTML = '';
    if (lastAge >= 0 && lastAge < monthAge) {
      const rec = findNewRecommendations(lastAge, monthAge);
      if (rec.newNursing.length > 0 || rec.newNutrition.length > 0) {
        const recParts = [];
        rec.newNursing.forEach(i => recParts.push(`${Lucide.icon('heart-pulse', 16)} ${Utils.escapeHtml(i.name)}`));
        rec.newNutrition.forEach(n => recParts.push(`${Lucide.icon('pill', 16)} ${Utils.escapeHtml(n.name)}`));
        monthlyRecHTML = `
          <div class="card" style="background:linear-gradient(135deg,#e8f5e9,#f1f8e9);border:1px solid #c8e6c9">
            <div class="card-title">${Lucide.icon('sparkles', 18)} 月度推荐更新 (${rec.currentLabel})</div>
            <p style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">宝宝满${monthAge}月，以下新增推荐项已自动启用：</p>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${recParts.map(p => `<span style="background:rgba(76,175,80,0.15);padding:4px 10px;border-radius:12px;font-size:12px;color:#2e7d32">${p}</span>`).join('')}
            </div>
          </div>
        `;
      }
    }

    const latestTemp = summary?.latestTemp;
    const tempStatus = latestTemp ? Utils.getTempStatus(latestTemp) : null;
    const nursingRecords = summary?.nursingRecords || [];
    const nursingDoneKeys = new Set(nursingRecords.map(r => r?.name).filter(Boolean));
    const nutritionRecords = summary?.nutritionRecords || [];
    const nutritionDoneKeys = new Set(nutritionRecords.map(r => r?.name).filter(Boolean));

    // 安全地渲染生长数据标签
    const safeGrowthTag = (label, value, type) => {
      try {
        const ev = evaluateGrowth(monthAge, gender, value, type);
        return this._growthTag(label, value + (type === 'weight' ? 'kg' : type === 'height' ? 'cm' : 'cm'), ev);
      } catch (e) { return ''; }
    };

    el.innerHTML = `
      <div class="card">
        <div class="card-title">${Lucide.icon('thermometer', 18)} 体温</div>
        ${latestTemp ? `
          <div class="temp-display ${tempStatus.value >= 38 ? 'fever' : 'normal'}">
            <div class="temp-value" style="color:${tempStatus.color}">${latestTemp}°C</div>
            <div class="temp-label" style="color:${tempStatus.color}">${tempStatus.label}</div>
          </div>
          <div class="text-muted" style="font-size:12px;text-align:center">${APP_CONFIG.healthReference.tempRef.note}</div>
        ` : '<p class="text-muted text-center">今日未测量体温</p>'}
        <button class="btn btn-primary btn-block mt-16" onclick="App.openTempForm()">${Lucide.icon('plus', 16)} 记录体温</button>
      </div>

      <!-- 最新测量数据 -->
      <div class="card">
        <div class="card-title">${Lucide.icon('ruler', 18)} 最新测量</div>
        ${latestGrowth ? `
          <div class="growth-values" style="justify-content:space-around;padding:8px 0">
            ${latestGrowth.weight ? safeGrowthTag('体重', latestGrowth.weight, 'weight') : ''}
            ${latestGrowth.height ? safeGrowthTag('身长', latestGrowth.height, 'height') : ''}
            ${latestGrowth.headCircumference ? safeGrowthTag('头围', latestGrowth.headCircumference, 'headCircumference') : ''}
          </div>
          <div class="text-muted" style="font-size:12px;text-align:center">测量日期: ${Utils.formatDate(latestGrowth.date)}</div>
        ` : (window.__UI_V3__ ? `<div class="v2-empty-mini" style="padding:20px 16px"><div class="em-icon">${Lucide.icon('ruler', 24)}</div><p>暂无测量数据</p></div>` : '<p class="text-muted text-center">暂无测量数据</p>')}
        <button class="btn btn-primary btn-block mt-16" onclick="App.openGrowthForm()">${Lucide.icon('plus', 16)} 记录测量数据</button>
      </div>

      ${monthlyRecHTML}

      <div class="card">
        <div class="card-title">${Lucide.icon('pill', 18)} 营养补充 ${isAdmin ? `<button class="btn btn-outline btn-sm" style="float:right" onclick="App._openNutritionManager()">${Lucide.icon('settings', 14)} 管理</button>` : ''}</div>
        <p class="text-muted" style="font-size:12px;margin-bottom:8px">推荐按月龄分阶段补充 · 点击标记今日已完成</p>
        ${nutritionGroups.map(grp => {
          const activeItems = (grp.items || []).filter(n => n && n.name && !disabledNutritionKeys.includes(n.name));
          if (activeItems.length === 0) return '';
          return `
            <div class="nutrition-age-group">
              <div class="nutrition-age-header">${Lucide.icon('pin', 16)} ${grp.ageLabel}</div>
              ${activeItems.map(n => {
                const done = nutritionDoneKeys.has(n.name);
                return `
                  <div class="nutrition-item">
                    <div>
                      <div class="ni-name">${Utils.escapeHtml(n.name)}</div>
                      <div class="ni-dose">${Utils.escapeHtml(n.dose) || ''} · ${Utils.escapeHtml(n.desc) || ''}</div>
                      ${n.note ? `<div class="text-muted" style="font-size:11px;margin-top:2px">${Utils.escapeHtml(n.note)}</div>` : ''}
                    </div>
                    <button class="ni-status ${done ? 'done' : 'todo'}" onclick="App.toggleNutrition('${Utils.jsAttr(n.name)}', '${Utils.jsAttr(n.dose)}')">${done ? `${Lucide.icon('check-circle', 14)} 已补` : '未补'}</button>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }).join('')}
        ${customNutrition.length > 0 ? `
          <div class="nutrition-age-group">
            <div class="nutrition-age-header">${Lucide.icon('pin', 16)} 自定义</div>
            ${customNutrition.map(n => {
              if (!n || !n.name) return '';
              const done = nutritionDoneKeys.has(n.name);
              return `
                <div class="nutrition-item">
                  <div>
                    <div class="ni-name">${Utils.escapeHtml(n.name)} <span style="font-size:10px;color:var(--primary)">[自定义]</span></div>
                    <div class="ni-dose">${Utils.escapeHtml(n.dose) || ''} · ${Utils.escapeHtml(n.desc) || ''}</div>
                  </div>
                  <button class="ni-status ${done ? 'done' : 'todo'}" onclick="App.toggleNutrition('${n.name.replace(/'/g, "\\'")}', '${(n.dose || '').replace(/'/g, "\\'")}')">${done ? `${Lucide.icon('check-circle', 14)} 已补` : '未补'}</button>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>

      <div class="card">
        <div class="card-title">${Lucide.icon('heart-pulse', 18)} 每日护理 ${isAdmin ? `<button class="btn btn-outline btn-sm" style="float:right" onclick="App._openNursingManager()">${Lucide.icon('settings', 14)} 管理</button>` : ''}</div>
        <p class="text-muted" style="font-size:11px;margin-bottom:6px">按月龄推荐护理内容 · 点击展开详情</p>
        ${nursingGroups.map(grp => {
          const activeItems = (grp.items || []).filter(item => item && item.name && !disabledNursingKeys.includes(item.name));
          if (activeItems.length === 0) return '';
          return `
            <div class="nursing-age-group">
              <div class="nursing-age-header">${Lucide.icon('pin', 16)} ${grp.ageLabel}</div>
              ${activeItems.map((item, idx) => {
                const done = nursingDoneKeys.has(item.name);
                const cardId = 'nursing-card-grp-' + grp.ageLabel.replace(/[^a-zA-Z0-9]/g, '_') + '-' + idx;
                return `
                  <div class="nursing-card-compact" id="${cardId}">
                    <div class="nursing-compact-row" onclick="document.getElementById('${cardId}').classList.toggle('expanded')">
                      <span class="ncc-title">${this._nursingIcon(item.type)} ${Utils.escapeHtml(item.name)}</span>
                      <span class="ncc-standard">${Utils.escapeHtml(item.standard) || '-'}</span>
                      <button class="nursing-compact-btn ${done ? 'done' : 'todo'}" onclick="event.stopPropagation();App.toggleNursing('${Utils.jsAttr(item.name)}')">${done ? Lucide.icon('check-circle', 14) : '打卡'}</button>
                      <span class="ncc-toggle">▾</span>
                    </div>
                    <div class="nursing-compact-detail">
                      <div class="ncd-row"><span>目的:</span> ${item.purpose || '-'}</div>
                      <div class="ncd-row"><span>方法:</span> ${item.method || '-'}</div>
                      <div class="ncd-row" style="color:var(--danger)"><span>${Lucide.icon('alert-triangle', 14)}:</span> ${item.warning || '无'}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }).join('')}
        ${customNursing.length > 0 ? `
          <div class="nursing-age-group">
            <div class="nursing-age-header">${Lucide.icon('pin', 16)} 自定义</div>
            ${customNursing.map((item, idx) => {
              if (!item || !item.name) return '';
              const done = nursingDoneKeys.has(item.name);
              const cardId = 'nursing-card-custom-' + idx;
              return `
                <div class="nursing-card-compact" id="${cardId}">
                  <div class="nursing-compact-row" onclick="document.getElementById('${cardId}').classList.toggle('expanded')">
                    <span class="ncc-title">${Lucide.icon('star', 16)} ${Utils.escapeHtml(item.name)}</span>
                    <span class="ncc-standard">${Utils.escapeHtml(item.standard) || '-'}</span>
                    <button class="nursing-compact-btn ${done ? 'done' : 'todo'}" onclick="event.stopPropagation();App.toggleNursing('${item.name.replace(/'/g, "\\'")}')">${done ? Lucide.icon('check-circle', 14) : '打卡'}</button>
                    <span class="ncc-toggle">▾</span>
                  </div>
                  <div class="nursing-compact-detail">
                    <div class="ncd-row"><span>目的:</span> ${item.purpose || '-'}</div>
                    <div class="ncd-row"><span>方法:</span> ${item.method || '-'}</div>
                    <div class="ncd-row" style="color:var(--danger)"><span>${Lucide.icon('alert-triangle', 14)}:</span> ${item.warning || '无'}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
    } catch (e) {
      el.innerHTML = Utils.emptyState({
        icon: Lucide.icon('heart-pulse', 32), title: '加载健康数据失败',
        desc: Utils.escapeHtml(e.message),
        action: '<button class="btn btn-primary" onclick="ParentingPage.switchSub(\'health\')">重试</button>',
        error: true
      });
    }
  },

  _nursingIcon(type) {
    return { touch: Lucide.icon('hand', 16), skin: Lucide.icon('droplet', 16), exercise: Lucide.icon('dumbbell', 16), visual: Lucide.icon('eye', 16), auditory: Lucide.icon('lightbulb', 16), fine_motor: Lucide.icon('scissors', 16), language: Lucide.icon('clipboard-list', 16), cognitive: Lucide.icon('target', 16) }[type] || Lucide.icon('star', 16);
  },

  // ===== 睡眠 =====
  async _renderSleep(el) {
    const activeSleep = Utils.getActiveSleepSession();
    const snapshot = await API.getUnifiedSnapshot({ startDate: Utils.formatDate(new Date(Date.now() - 6 * 86400000), 'YYYY-MM-DD'), endDate: Utils.todayStr() });
    if (!snapshot || !['loaded', 'partial'].includes(snapshot.status)) throw new Error('统一数据快照不可用');
    const records = (snapshot.records?.sleep || []).filter(record => Utils.localDateFromISO(record.startTime || record.occurredAt || record.time) === Utils.todayStr());
    const summary = { records, totalMinutes: records.reduce((sum, record) => sum + Number(record.duration || 0), 0), sessions: records.length, longest: records.reduce((max, record) => Math.max(max, Number(record.duration || 0)), 0) };
    const week = await this._fetch7Days('sleep');
    this._sleepRecordMap = Object.fromEntries(records.map(r => [r._id, r]));
    const baby = Utils.getBabyInfo();
    const monthAge = (baby && baby.birthDate) ? Utils.calcMonthAge(baby.birthDate) : null;
    const totalDays = Utils.calcMonthAgeToDays(baby.birthDate).total;
    const weeks = Math.max(0, Math.floor(totalDays / 7));
    const ref = APP_CONFIG.healthReference;
    const sleepRef = ref.sleepHoursRef.find(r => weeks >= r.weeksMin && weeks < r.weeksMax) || ref.sleepHoursRef[ref.sleepHoursRef.length - 1];
    const sleepH = (summary?.totalMinutes || 0) / 60;
    const sleepOk = sleepH > 0 && sleepH >= sleepRef.hoursMin;
    const sleepStatusCls = summary?.totalMinutes > 0 ? (sleepOk ? 'ok' : 'warn') : 'none';
    const sleepStatusText = summary?.totalMinutes > 0
      ? (sleepOk ? '已达到参考时长' : '低于参考时长，注意观察（通用参考，个体差异大）')
      : '今日暂无睡眠记录';

    el.innerHTML = `
      <!-- 今日汇总（置于顶部） -->
      <div class="dash-stat-row dash-stat-row-lg">
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('moon', 20)}</div><div class="ds-value" style="color:#722ED1">${Utils.formatDuration(summary?.totalMinutes || 0)}</div><div class="ds-label">总睡眠</div></div>
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('bar-chart', 20)}</div><div class="ds-value">${summary?.sessions || 0}</div><div class="ds-label">睡眠次数</div></div>
        <div class="dash-stat-lg"><div class="ds-icon">${Lucide.icon('timer', 20)}</div><div class="ds-value" style="color:var(--primary)">${Utils.formatDuration(summary?.longest || 0)}</div><div class="ds-label">最长一次</div></div>
      </div>

      <!-- 参考状态说明（动作状态融合，v83 合并） -->
      <div class="sleep-ref-summary ${sleepStatusCls}" style="margin:0 0 10px">${Lucide.icon('moon', 14)} ${Utils.escapeHtml(sleepStatusText)} · 该月龄参考 ${sleepRef.hoursMin}-${sleepRef.hoursMax}h/天（${Utils.escapeHtml(sleepRef.note)}）</div>

      <!-- 本月睡眠知识（折叠卡，参考状态行下方，v83 顺序） -->
      ${this._renderSleepKnowledge(baby, monthAge)}

      <!-- 睡眠计时 -->
      <div class="card" id="sleep-timer-section">
        ${activeSleep ? `
          <div class="sleep-timer-card">
            <div class="sleep-timer-header">
              <span class="sleep-timer-icon">${Lucide.icon('moon', 20)}</span>
              <span class="sleep-timer-label">睡眠中</span>
            </div>
            <div class="sleep-timer-display" id="sleep-timer-display">${Utils.formatElapsed(Date.now() - activeSleep.startTimestamp)}</div>
            <div class="sleep-timer-start">开始时间: ${Utils.formatTime(activeSleep.startTime)}</div>
            <button class="btn btn-danger btn-block mt-8" onclick="App.toggleSleep()">结束并保存</button>
          </div>
        ` : `
          <div class="card-title">${Lucide.icon('moon', 18)} 睡眠记录</div>
          <button class="btn btn-primary btn-block" onclick="App.toggleSleep()" style="font-size:18px;padding:16px">开始睡眠</button>
          <button class="btn btn-outline btn-block mt-8" onclick="App.openSleepForm()">手工记录（起止时间）</button>
        `}
      </div>

      <!-- 今日明细 / 近7天 切换 -->
      ${this._segSwitch('sleep', '今日明细', '近7天')}
      <div class="seg-panel ${this._viewMode.sleep === 'today' ? 'active' : ''}" id="panel-today-sleep">
      ${records.length > 0 ? `
      <div class="card">
        <div class="card-title">${Lucide.icon('clipboard-list', 18)} 今日睡眠明细</div>
        ${records.map(r => `
          <div class="record-item">
            <div class="record-main">
              <div class="record-title">${Utils.formatTime(r.startTime)} - ${Utils.formatTime(r.endTime)}</div>
              <div class="record-meta">${Utils.formatDuration(r.duration)} ${r.note ? '· ' + Utils.escapeHtml(r.note) : ''}</div>
            </div>
            ${this._delBtn('sleep', r, 'memberId', `<button class="icon-btn-sm" title="修改此记录" onclick="event.stopPropagation();ParentingPage._editSleep('${r._id}')">${Lucide.icon('clipboard-list', 16)}</button>`)}
          </div>
        `).join('')}
      </div>` : `<div class="empty-mini"><div class="em-icon">${Lucide.icon('moon', 24)}</div><p>今天还没有睡眠记录</p></div>`}
      </div>
      <div class="seg-panel ${this._viewMode.sleep === 'week' ? 'active' : ''}" id="panel-week-sleep">
      ${week ? this._render7DayCard({
        title: '近7天睡眠',
        valueKey: 'sleepMin',
        valueUnit: '分',
        days: week.days,
        summaryItems: [
          { num: Utils.formatDuration(week.totals.sleepMin), label: '总睡眠' },
          { num: week.totals.count, label: '睡眠次数' },
          { num: Utils.formatDuration(Math.round(week.totals.sleepMin / 7)), label: '日均' }
        ]
      }) : `<div class="empty-mini"><div class="em-icon">${Lucide.icon('trending-up', 24)}</div><p>近7天数据加载失败</p></div>`}
      </div>
    `;

    if (activeSleep) {
      QuickRecordPage._startSleepTimer();
    }
  },

  /** 编辑睡眠记录（弹出起止时间表单，仅本人记录可改） */
  _editSleep(id) {
    // R8：离线或有待同步记录时禁止编辑（提示先同步）
    if (!Utils.offlineGuard('当前离线，请联网同步后再修改')) return;
    const rec = this._sleepRecordMap?.[id];
    if (rec) App.openSleepForm(rec);
  },

  // ===== 喂养知识卡 =====
  _renderFeedingKnowledge(baby, monthAge) {
    if (!baby || !baby.birthDate || monthAge == null) return '';
    if (!window.getKnowledgeItemsByAge) return '';
    const items = window.getKnowledgeItemsByAge('feeding', monthAge);
    if (!items.length) return '';
    const expanded = this._feedKnowExpanded;

    const itemHTML = items.map((it, i) => {
      const open = this._feedKnowOpenItem === i;
      return `
        <div class="ki-item ${open ? 'open' : ''}" id="feed-know-item-${i}">
          <div class="ki-item-head" onclick="ParentingPage._toggleFeedKnowItem(${i})">
            <span class="ki-brief">${Utils.escapeHtml(it.title)}</span>
            <span class="ki-arrow">${open ? '▴' : '▾'}</span>
          </div>
          ${open ? `<div class="ki-item-body"><div class="ki-content">${Utils.escapeHtml(it.content)}</div></div>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="know-card">
        <div class="know-head" onclick="ParentingPage._toggleFeedKnow()">
          <span class="know-title">${Lucide.icon('bottle', 16)} 本月喂养知识 · ${monthAge}月龄 · ${items.length}条</span>
          <span class="know-arrow">${expanded ? '▴' : '▾'}</span>
        </div>
        ${expanded ? `<div class="know-body">${itemHTML}</div>` : ''}
      </div>`;
  },
  _toggleFeedKnow() { this._feedKnowExpanded = !this._feedKnowExpanded; this._renderSub(); },
  _toggleFeedKnowItem(idx) { this._feedKnowOpenItem = (this._feedKnowOpenItem === idx) ? -1 : idx; this._renderSub(); },

  // ===== 清洁知识卡 =====
  _renderCleanKnowledge(baby, monthAge) {
    if (!baby || !baby.birthDate || monthAge == null) return '';
    if (!window.getKnowledgeItemsByAge) return '';
    const items = window.getKnowledgeItemsByAge('nursing', monthAge);
    if (!items.length) return '';
    const expanded = this._cleanKnowExpanded;

    const itemHTML = items.map((it, i) => {
      const open = this._cleanKnowOpenItem === i;
      return `
        <div class="ki-item ${open ? 'open' : ''}" id="clean-know-item-${i}">
          <div class="ki-item-head" onclick="ParentingPage._toggleCleanKnowItem(${i})">
            <span class="ki-brief">${Utils.escapeHtml(it.title)}</span>
            <span class="ki-arrow">${open ? '▴' : '▾'}</span>
          </div>
          ${open ? `<div class="ki-item-body"><div class="ki-content">${Utils.escapeHtml(it.content)}</div></div>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="know-card">
        <div class="know-head" onclick="ParentingPage._toggleCleanKnow()">
          <span class="know-title">${Lucide.icon('bath', 16)} 本月护理知识 · ${monthAge}月龄 · ${items.length}条</span>
          <span class="know-arrow">${expanded ? '▴' : '▾'}</span>
        </div>
        ${expanded ? `<div class="know-body">${itemHTML}</div>` : ''}
      </div>`;
  },
  _toggleCleanKnow() { this._cleanKnowExpanded = !this._cleanKnowExpanded; this._renderSub(); },
  _toggleCleanKnowItem(idx) { this._cleanKnowOpenItem = (this._cleanKnowOpenItem === idx) ? -1 : idx; this._renderSub(); },

  // ===== 睡眠知识卡 =====
  _renderSleepKnowledge(baby, monthAge) {
    if (!baby || !baby.birthDate || monthAge == null) return '';
    if (!window.getKnowledgeItemsByAge) return '';
    const items = window.getKnowledgeItemsByAge('sleep', monthAge);
    if (!items.length) return '';
    const expanded = this._sleepKnowExpanded;

    const itemHTML = items.map((it, i) => {
      const open = this._sleepKnowOpenItem === i;
      return `
        <div class="ki-item ${open ? 'open' : ''}" id="sleep-know-item-${i}">
          <div class="ki-item-head" onclick="ParentingPage._toggleSleepKnowItem(${i})">
            <span class="ki-brief">${Utils.escapeHtml(it.title)}</span>
            <span class="ki-arrow">${open ? '▴' : '▾'}</span>
          </div>
          ${open ? `<div class="ki-item-body"><div class="ki-content">${Utils.escapeHtml(it.content)}</div></div>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="know-card">
        <div class="know-head" onclick="ParentingPage._toggleSleepKnow()">
          <span class="know-title">${Lucide.icon('moon', 16)} 本月睡眠知识 · ${monthAge}月龄 · ${items.length}条</span>
          <span class="know-arrow">${expanded ? '▴' : '▾'}</span>
        </div>
        ${expanded ? `<div class="know-body">${itemHTML}</div>` : ''}
      </div>`;
  },
  _toggleSleepKnow() { this._sleepKnowExpanded = !this._sleepKnowExpanded; this._renderSub(); },
  _toggleSleepKnowItem(idx) { this._sleepKnowOpenItem = (this._sleepKnowOpenItem === idx) ? -1 : idx; this._renderSub(); }
};

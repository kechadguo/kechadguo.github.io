window.SleepTrainingPage = {
  _records: [],
  _pattern: null,
  _week: null,
  _sleepKnowExpanded: false,
  _sleepKnowOpenItem: -1,
  _viewMode: 'today',

  async render(container) {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby._id) { container.innerHTML = Utils.emptyState({ icon: Lucide.icon('moon', 32), title: '请先创建宝宝档案' }); return; }
    const monthAge = Utils.calcMonthAge(baby.birthDate);
    const startDate = Utils.formatDate(new Date(Date.now() - 6 * 86400000), 'YYYY-MM-DD');
    const endDate = Utils.todayStr();
    const result = await API.listSleep({ startDate, endDate, page: 1, pageSize: 200 }).catch(() => ({ records: [] }));
    this._records = result?.records || [];
    this._week = this._aggregateWeek(this._records);
    this._pattern = this._analyzeSleepPattern(this._records);
    const summary = this._todaySummary();
    const inWindow = monthAge >= 4 && monthAge <= 12;
    container.innerHTML = `<div class="card sleep-training-hero"><div class="card-title">${Lucide.icon('moon', 20)} 睡眠管理</div><div>宝宝 ${monthAge} 月龄 · ${inWindow ? '适合进行作息训练' : '当前为通用睡眠记录模式'}</div><div class="sleep-pattern-result ${this._pattern.status === '昼夜节律已建立' ? 'ok' : 'warn'}"><b>${this._pattern.nightPercent}%</b> 夜间睡眠 · ${this._pattern.status}</div>${this._pattern.advice ? `<div class="sleep-training-hero-advice">${this._pattern.advice}</div>` : ''}</div>${this._renderSleepSummary(summary, monthAge, baby)}${this._renderSleepKnowledge(baby, monthAge)}${this._renderSleepRecorder()}${this._renderSleepViews()}<div class="disclaimer">${APP_CONFIG.disclaimer}</div>`;
    if (this._activeSleep()) window.QuickRecordPage?._startSleepTimer?.();
  },

  _todaySummary() {
    const today = Utils.todayStr();
    const records = this._records.filter(r => Utils.formatDate(r.startTime, 'YYYY-MM-DD') === today);
    return { records, totalMinutes: records.reduce((s, r) => s + Number(r.duration || 0), 0), sessions: records.length, longest: records.reduce((m, r) => Math.max(m, Number(r.duration || 0)), 0) };
  },

  _aggregateWeek(records) {
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); const key = Utils.formatDate(d, 'YYYY-MM-DD'); days.push({ date: key, label: Utils.formatDate(d, 'MM-DD'), count: 0, sleepMin: 0 }); }
    records.forEach(r => { const day = days.find(d => d.date === Utils.formatDate(r.startTime, 'YYYY-MM-DD')); if (day) { day.count++; day.sleepMin += Number(r.duration || 0); } });
    return { days, totals: { count: days.reduce((s, d) => s + d.count, 0), sleepMin: days.reduce((s, d) => s + d.sleepMin, 0) } };
  },

  _renderSleepSummary(summary, monthAge, baby) {
    const weeks = Math.max(0, Math.floor(Utils.calcMonthAgeToDays(baby.birthDate).total / 7));
    const ref = APP_CONFIG.healthReference?.sleepHoursRef || [];
    const sleepRef = ref.find(r => weeks >= r.weeksMin && weeks < r.weeksMax) || ref[ref.length - 1] || { hoursMin: 0, hoursMax: 0, note: '暂无参考' };
    const sleepH = summary.totalMinutes / 60;
    const sleepStatus = summary.totalMinutes ? (sleepH >= sleepRef.hoursMin ? '已达到参考时长' : '低于参考时长，注意观察') : '今日暂无睡眠记录';
    return `<div class="sleep-summary-stats"><div><b>${Utils.formatDuration(summary.totalMinutes)}</b><span>今日总睡眠</span></div><div><b>${summary.sessions}</b><span>睡眠次数</span></div><div><b>${Utils.formatDuration(summary.longest)}</b><span>最长一次</span></div></div><div class="sleep-ref-summary ${summary.totalMinutes ? (sleepH >= sleepRef.hoursMin ? 'ok' : 'warn') : 'none'}">${Lucide.icon('moon', 14)} ${sleepStatus} · ${monthAge}月龄参考 ${sleepRef.hoursMin}-${sleepRef.hoursMax}h/天（${Utils.escapeHtml(sleepRef.note || '通用参考')}）</div>`;
  },

  _renderSleepKnowledge(baby, monthAge) {
    if (!window.getKnowledgeItemsByAge) return '';
    const items = window.getKnowledgeItemsByAge('sleep', monthAge) || [];
    if (!items.length) return '';
    const body = this._sleepKnowExpanded ? items.map((it, i) => `<div class="ki-item ${this._sleepKnowOpenItem === i ? 'open' : ''}"><div class="ki-item-head" onclick="SleepTrainingPage._toggleKnowledgeItem(${i})"><span class="ki-brief">${Utils.escapeHtml(it.title)}</span><span>${this._sleepKnowOpenItem === i ? '▴' : '▾'}</span></div>${this._sleepKnowOpenItem === i ? `<div class="ki-item-body"><div class="ki-content">${Utils.escapeHtml(it.content)}</div></div>` : ''}</div>`).join('') : '';
    return `<div class="know-card"><div class="know-head" onclick="SleepTrainingPage._toggleKnowledge()"><span class="know-title">${Lucide.icon('book-open', 16)} 本月睡眠知识 · ${monthAge}月龄 · ${items.length}条</span><span>${this._sleepKnowExpanded ? '▴' : '▾'}</span></div>${body ? `<div class="know-body">${body}</div>` : ''}</div>`;
  },

  _renderSleepRecorder() {
    const active = this._activeSleep();
    return `<div class="card" id="sleep-training-recorder">${active ? `<div class="sleep-timer-card"><div class="sleep-timer-header"><span>${Lucide.icon('moon', 20)}</span><span>睡眠中</span></div><div class="sleep-timer-display" id="sleep-timer-display">${Utils.formatElapsed(Date.now() - active.startTimestamp)}</div><div class="sleep-timer-start">开始时间: ${Utils.formatTime(active.startTime)}</div><button class="btn btn-danger btn-block mt-8" onclick="App.toggleSleep()">结束并保存</button></div>` : `<div class="card-title">${Lucide.icon('moon', 18)} 睡眠记录</div><button class="btn btn-primary btn-block" onclick="App.toggleSleep()" style="font-size:18px;padding:16px">开始睡眠</button><button class="btn btn-outline btn-block mt-8" onclick="App.openSleepForm()">手工记录（起止时间）</button>`}</div>`;
  },

  _renderSleepViews() {
    const today = this._todaySummary().records;
    const todayHtml = today.length ? `<div class="card"><div class="card-title">${Lucide.icon('clipboard-list', 18)} 今日睡眠明细</div>${today.map(r => `<div class="record-item"><div class="record-main"><div class="record-title">${Utils.formatTime(r.startTime)} - ${Utils.formatTime(r.endTime)}</div><div class="record-meta">${Utils.formatDuration(r.duration)} · ${this._methodLabel(r.fallAsleepMethod)} · 夜醒 ${Number(r.wakeUpCount || 0)} 次 · 哭闹 ${Number(r.cryDuration || 0)} 分钟 · ${this._qualityLabel(r.sleepQuality)}${r.note ? ' · ' + Utils.escapeHtml(r.note) : ''}</div></div>${this._recordActions(r)}</div>`).join('')}</div>` : '<div class="empty-mini"><div class="em-icon">' + Lucide.icon('moon', 24) + '</div><p>今天还没有睡眠记录</p></div>';
    const week = this._week;
    const max = Math.max(...week.days.map(d => d.sleepMin), 1);
    const bars = week.days.map(d => `<div class="w7d-col" title="${d.date}: ${d.sleepMin}分钟"><div class="w7d-bar" style="height:${Math.max(3, Math.round(d.sleepMin / max * 100))}%"></div><span>${d.label}</span></div>`).join('');
    const weekHtml = `<div class="card"><div class="card-title">${Lucide.icon('bar-chart', 18)} 近7天睡眠</div><div class="sleep-week-stats"><span>总睡眠 ${Utils.formatDuration(week.totals.sleepMin)}</span><span>次数 ${week.totals.count}</span><span>日均 ${Utils.formatDuration(Math.round(week.totals.sleepMin / 7))}</span></div><div class="sleep-week-chart">${bars}</div></div>`;
    return `<div class="seg-switch"><button class="seg-btn ${this._viewMode === 'today' ? 'active' : ''}" onclick="SleepTrainingPage._toggleView('today')">今日明细</button><button class="seg-btn ${this._viewMode === 'week' ? 'active' : ''}" onclick="SleepTrainingPage._toggleView('week')">近7天</button></div><div class="sleep-view-panel" style="display:${this._viewMode === 'today' ? 'block' : 'none'}">${todayHtml}</div><div class="sleep-view-panel" style="display:${this._viewMode === 'week' ? 'block' : 'none'}">${weekHtml}</div>`;
  },

  _recordActions(r) { return r.memberId && r.memberId !== Auth.getMemberId() ? '' : `<button class="icon-btn-sm" title="修改" onclick="event.stopPropagation();App.openSleepForm(SleepTrainingPage._records.find(x => x._id === '${Utils.jsAttr(r._id)}'))">${Lucide.icon('clipboard-list', 16)}</button>`; },
  _activeSleep() { return Utils.getActiveSleepSession(); },
  _toggleView(mode) { this._viewMode = mode; this.render(document.getElementById('page-content')); },
  _toggleKnowledge() { this._sleepKnowExpanded = !this._sleepKnowExpanded; this.render(document.getElementById('page-content')); },
  _toggleKnowledgeItem(index) { this._sleepKnowOpenItem = this._sleepKnowOpenItem === index ? -1 : index; this.render(document.getElementById('page-content')); },
  _analyzeSleepPattern(records) { let nightSleep = 0, daySleep = 0; for (const r of records || []) { const hour = new Date(r.startTime).getHours(); const duration = Number(r.duration || 0); if (hour >= 19 || hour < 7) nightSleep += duration; else daySleep += duration; } const total = nightSleep + daySleep; const ratio = total ? nightSleep / total : 0; return { nightPercent: Math.round(ratio * 100), status: ratio > 0.6 ? '昼夜节律已建立' : '仍需调整作息', advice: ratio < 0.6 ? '建议增加白天活动量，逐步减少过长的白天小睡。' : '' }; },
  _methodLabel(v) { return ({ breast: '奶睡', rock: '摇晃', pat: '拍睡', self: '自主入睡' }[v] || '未记录哄睡方式'); },
  _qualityLabel(v) { return ({ deep: '深睡', light: '浅睡', restless: '睡眠不安' }[v] || '质量未记录'); }
};
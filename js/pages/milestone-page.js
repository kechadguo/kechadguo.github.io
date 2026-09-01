/* 里程碑前端：五个业务 Tab、稳定 milestoneId、局部状态与联动。 */
window.MilestonePage = {
  _container: null,
  _monthAge: 0,
  _activeTab: 'progress',
  _focusedMilestoneId: '',
  _candidateRecords: [],
  _records: [],
  _achievements: {},
  _filters: { domain: '全部', status: '全部', source: '全部', date: '' },
  _tabs: [
    ['progress', 'trending-up', '成长进度'],
    ['graph', 'list-tree', '月龄图谱'],
    ['candidates', 'clock-3', '待确认'],
    ['achievements', 'clipboard-check', '全部成就'],
    ['catalog', 'book-marked', '成就图鉴']
  ],
  _sourceLabels: { automatic: '自动完成', candidate: '候选确认', manual: '手工记录', photo: '照片打卡' },

  _stateFromError(error) {
    if (error?.isPermissionError || error?.httpStatus === 403 || error?.code === 4003) return 'permission-denied';
    if (error?.isAuthError || error?.code === 4008 || error?.code === 4009) return 'auth-required';
    if (error?.isConflict || error?.code === 'CONFLICT' || error?.httpStatus === 409) return 'conflict';
    if (error?.isNetworkError || window.navigator?.onLine === false || Utils.isOffline?.()) return 'offline';
    if (error?.isTimeoutError) return 'error';
    return 'error';
  },

  _stateCopy(state, title, desc) {
    const copy = {
      loading: ['加载中', desc || '正在加载里程碑数据。'],
      loaded: [title || '已加载', desc || ''],
      empty: [title || '暂无数据', desc || '完成记录后会显示在这里。'],
      partial: [title || '部分内容不可用', desc || '成功区域仍可继续使用。'],
      error: [title || '加载失败', desc || '请稍后重试。'],
      offline: [title || '当前离线', desc || '联网后可同步最新数据。'],
      'auth-required': [title || '请先登录', desc || '登录后才能查看宝宝的里程碑。'],
      'permission-denied': [title || '暂无访问权限', desc || '请切换到有权限的家庭。'],
      conflict: [title || '数据发生冲突', desc || '请刷新后重新加载。'],
      submitting: [title || '正在提交', desc || '请稍候。'],
      success: [title || '操作成功', desc || '数据已更新。']
    };
    return copy[state] || copy.error;
  },

  _panelState(tab, state, title, desc, retry = true) {
    const copy = this._stateCopy(state, title, desc);
    const action = retry && ['error', 'offline', 'auth-required', 'permission-denied', 'conflict'].includes(state)
      ? `<button class="btn btn-primary btn-sm" type="button" onclick="MilestonePage.retryTab('${tab}')">重新加载</button>` : '';
    return `<div class="ms-panel-state" data-ms-state="${state}" data-ms-state-tab="${tab}">${V3UI.stateHTML(state, copy[0], copy[1], action)}</div>`;
  },

  _sourceLabel(source) { return this._sourceLabels[source] || source || '自动完成'; },

  _milestoneTitle(milestoneId) {
    return (window.MILESTONE_STANDARD || []).flatMap(group => group.items || []).find(item => item.milestoneId === milestoneId)?.skill || '';
  },

  _displayTitle(record, id) {
    return this._milestoneTitle(id) || record?.milestoneLabel || (record?.milestoneKey && !String(record.milestoneKey).includes('.') ? record.milestoneKey : '') || '待确认的能力';
  },

  _badgeTitle(badgeId) {
    return (window.BADGE_SYSTEM?.badges || []).find(badge => badge.id === badgeId)?.name || '相关徽章';
  },

  _model() {
    const records = this._records || [];
    const allItems = (window.MILESTONE_STANDARD || []).flatMap(group => (group.items || []).map(item => ({ ...item, month: group.month, ageLabel: group.ageLabel })));
    const standardIds = new Set(allItems.map(item => item.milestoneId));
    const achievedMap = {};
    records.forEach(record => {
      const id = record.milestoneId || getMilestoneId(record.milestoneKey);
      if (id && standardIds.has(id) && !record.deletedAt) achievedMap[id] = record;
    });
    const candidateMap = {};
    (this._candidateRecords || []).forEach(candidate => {
      if (candidate.milestoneId && !['REJECTED', 'EXPIRED'].includes(candidate.status)) candidateMap[candidate.milestoneId] = candidate;
    });
    return { records, achievedMap, candidateMap, candidates: this._candidateRecords || [], allItems };
  },

  _itemStatus(item, model) {
    if (model.achievedMap[item.milestoneId]) return '已完成';
    if (model.candidateMap[item.milestoneId]) return '待确认';
    return '未完成';
  },

  _itemHTML(item, model, options = {}) {
    const record = model.achievedMap[item.milestoneId];
    const candidate = model.candidateMap[item.milestoneId];
    const status = record ? 'completed' : candidate ? 'pending' : 'uncompleted';
    const focused = this._focusedMilestoneId === item.milestoneId ? ' is-focused' : '';
    const action = record
      ? `<span class="ms-item-complete">${Utils.escapeHtml(Utils.formatDate(record.date))} · ${Utils.escapeHtml(this._sourceLabel(record.sourceType))}</span>`
      : candidate
        ? '<span class="ms-item-pending">待确认</span>'
        : `<button class="btn btn-secondary btn-sm" type="button" onclick="MilestonePage.openManualRecord('${Utils.jsAttr(item.milestoneId)}')">家长记录</button>`;
    const statusLabel = record ? '已完成' : candidate ? '待确认' : '未完成';
    return `<article class="ms-item ms-item-${status}${focused}" id="ms-item-${Utils.jsAttr(item.milestoneId)}" data-milestone-id="${Utils.jsAttr(item.milestoneId)}" data-ms-status="${status}"><div class="ms-item-main"><div class="ms-item-title"><span class="ms-domain-chip">${Utils.escapeHtml(item.domain)}</span><strong>${Utils.escapeHtml(item.skill)}</strong><span class="ms-status-label">${statusLabel}</span>${options.current ? '<span class="ms-current-mark">当前月龄</span>' : ''}</div><div class="ms-item-age">建议月龄：${Utils.escapeHtml(item.ageLabel || `${item.month}月龄`)}</div><p>${Utils.escapeHtml(item.desc || '')}</p>${record?.note ? `<div class="ms-item-note">备注：${Utils.escapeHtml(record.note)}</div>` : ''}${record ? `<button class="ms-inline-link" type="button" onclick="MilestonePage.editNote('${Utils.jsAttr(record._id)}')">补备注</button>` : ''}${item.warning ? `<div class="ms-item-warning">${Lucide.icon('alert-triangle', 13)} ${Utils.escapeHtml(item.warning)}</div>` : ''}</div><div class="ms-item-side">${action}<button class="btn-icon" type="button" aria-label="定位${Utils.escapeHtml(item.skill)}" title="定位到图谱" onclick="MilestonePage.focusMilestone('${Utils.jsAttr(item.milestoneId)}')">${Lucide.icon('crosshair', 16)}</button></div></article>`;
  },

  _progressHTML(model) {
    const baby = Utils.getBabyInfo();
    const groups = window.MILESTONE_STANDARD || [];
    const current = groups.filter(group => group.month <= Math.max(1, Math.floor(this._monthAge))).at(-1) || groups[0];
    const items = current?.items || [];
    const completed = model.allItems.filter(item => model.achievedMap[item.milestoneId]).length;
    const rate = model.allItems.length ? Math.round(completed / model.allItems.length * 100) : 0;
    const next = groups.find(group => group.month > (current?.month || 0));
    const highlights = items.slice(0, 5);
    return `<div class="ms-progress-layout"><section class="ms-summary-card"><div class="ms-summary-kicker">成长进度</div><h2>${Utils.escapeHtml(baby?.name || '宝宝')} · ${this._monthAge}个月</h2><p class="ms-summary-stage">当前阶段：${Utils.escapeHtml(current?.ageLabel || '暂无阶段')}</p><div class="ms-progress-metric"><strong>${completed}/${model.allItems.length}</strong><span>全部里程碑已完成</span><b>${rate}%</b></div><div class="ms-progress-track" aria-label="完成率 ${rate}%"><span style="width:${rate}%"></span></div><div class="ms-summary-actions"><button class="btn btn-secondary btn-sm" type="button" onclick="MilestonePage.switchTab('achievements')">查看全部成就</button><button class="btn btn-secondary btn-sm" type="button" onclick="MilestonePage.switchTab('candidates')">待确认 ${model.candidates.length}</button></div></section><section class="ms-focus-section"><div class="ms-section-head"><div><h3>当前重点能力</h3><p>点击能力可在月龄图谱中定位。</p></div><button class="btn btn-secondary btn-sm" type="button" onclick="MilestonePage.switchTab('graph')">查看完整图谱</button></div><div class="ms-focus-list">${highlights.length ? highlights.map(item => `<button class="ms-focus-item" type="button" onclick="MilestonePage.focusMilestone('${Utils.jsAttr(item.milestoneId)}')"><span>${Utils.escapeHtml(item.domain)}</span><strong>${Utils.escapeHtml(item.skill)}</strong><small>${model.achievedMap[item.milestoneId] ? '已完成' : '未完成'}</small>${Lucide.icon('chevron-right', 15)}</button>`).join('') : '<p class="ms-empty-inline">暂无当前阶段能力。</p>'}</div></section><section class="ms-next-section"><div class="ms-section-head"><div><h3>下一阶段预告</h3><p>${next ? `${Utils.escapeHtml(next.ageLabel)} · ${next.items.length}项能力` : '已到标准图谱末段'}</p></div>${next?.items?.[0] ? `<button class="btn btn-secondary btn-sm" type="button" onclick="MilestonePage.focusMilestone('${Utils.jsAttr(next.items[0].milestoneId)}')">查看</button>` : ''}</div>${next ? `<p>${Utils.escapeHtml(next.items.slice(0, 3).map(item => item.skill).join('、'))}${next.items.length > 3 ? '等' : ''}</p>` : ''}</section></div>`;
  },

  _graphHTML(model) {
    const domains = ['全部', ...new Set(model.allItems.map(item => item.domain))];
    const filtered = model.allItems.filter(item => this._filters.domain === '全部' || item.domain === this._filters.domain).filter(item => this._filters.status === '全部' || this._itemStatus(item, model) === this._filters.status);
    const bands = [['1-12月龄', 1, 12], ['13-24月龄', 13, 24], ['25-36月龄', 25, 36]];
    return `<div class="ms-graph-wrap"><div class="ms-section-head"><div><h2>月龄图谱</h2><p>完整展示 1～36 月龄全部 ${model.allItems.length} 项标准里程碑。</p></div><span class="ms-count-badge">${filtered.length}/${model.allItems.length}</span></div><div class="ms-filter-bar"><label>领域<select aria-label="按领域筛选" onchange="MilestonePage.setFilter('domain',this.value)">${domains.map(value => `<option ${value === this._filters.domain ? 'selected' : ''}>${Utils.escapeHtml(value)}</option>`).join('')}</select></label><label>状态<select aria-label="按状态筛选" onchange="MilestonePage.setFilter('status',this.value)">${['全部', '已完成', '未完成', '待确认'].map(value => `<option ${value === this._filters.status ? 'selected' : ''}>${value}</option>`).join('')}</select></label><button class="btn btn-secondary btn-sm" type="button" onclick="MilestonePage.resetFilters()">重置筛选</button></div>${bands.map(([label, min, max], index) => { const groups = (window.MILESTONE_STANDARD || []).filter(group => group.month >= min && group.month <= max); const visible = groups.reduce((sum, group) => sum + group.items.filter(item => filtered.some(row => row.milestoneId === item.milestoneId)).length, 0); const current = this._monthAge >= min && this._monthAge <= max; return `<section class="ms-age-band ${current ? 'is-current' : ''}"><button class="ms-age-band-head" type="button" aria-expanded="${index === 0}" onclick="MilestonePage.toggleBand('ms-band-${index}')"><span><strong>${label}</strong><small>${current ? '当前月龄所在段' : ''}</small></span><b>${visible}项</b>${Lucide.icon('chevron-down', 16)}</button><div id="ms-band-${index}" class="ms-age-band-body" ${index === 0 ? '' : 'hidden'}>${groups.map(group => { const items = group.items.filter(item => filtered.some(row => row.milestoneId === item.milestoneId)); return items.length ? `<div class="ms-month-group"><div class="ms-month-head"><strong>${Utils.escapeHtml(group.ageLabel || `${group.month}月龄`)}</strong><span>${items.length}项</span></div>${items.map(item => this._itemHTML({ ...item, month: group.month }, model, { current: group.month === Math.floor(this._monthAge) })).join('')}</div>` : ''; }).join('') || '<p class="ms-empty-inline">当前筛选没有匹配项。</p>'}</div></section>`; }).join('')}</div>`;
  },

  _candidateHTML(model) {
    const candidates = model.candidates;
    if (!candidates.length) return this._panelState('candidates', 'empty', '暂无待确认候选', '新的权威事实产生后，候选会自动出现在这里。', false);
    return `<div class="ms-list-card"><div class="ms-section-head"><div><h2>待确认</h2><p>确认后会同步到全部成就、月龄图谱和成就图鉴。</p></div><span class="ms-count-badge">${candidates.length}</span></div>${candidates.map(candidate => { const evidence = candidate.evidence || {}; const id = candidate.milestoneId || ''; const title = this._displayTitle(candidate, id); const happenedAt = candidate.occurredAt || candidate.eventTime || candidate.createdAt || candidate.updatedAt || ''; const sourceId = candidate.sourceEventId || candidate.triggerEventId || evidence.sourceEventId || ''; return `<article class="ms-candidate-card" data-milestone-id="${Utils.jsAttr(id)}"><div class="ms-candidate-main"><button class="ms-link-button" type="button" onclick="MilestonePage.focusMilestone('${Utils.jsAttr(id)}')">${Utils.escapeHtml(title)}</button><dl class="ms-detail-list"><div><dt>来源</dt><dd>${Utils.escapeHtml(candidate.sourceLabel || '成长记录')}</dd></div><div><dt>触发原因</dt><dd>${Utils.escapeHtml(candidate.reason || candidate.triggerReason || '根据宝宝的成长记录识别')}</dd></div><div><dt>证据摘要</dt><dd>${Utils.escapeHtml(evidence.summary || evidence.description || '暂无相关记录')}</dd></div><div><dt>发生时间</dt><dd>${Utils.escapeHtml(happenedAt ? Utils.formatDate(happenedAt) : '未知')}</dd></div><div><dt>当前状态</dt><dd>${candidate.status === 'CONFIRMED' ? '已确认' : candidate.status === 'REJECTED' ? '已拒绝' : '待确认'}</dd></div></dl><button class="btn btn-secondary btn-sm" type="button" onclick="MilestonePage.viewSource('${Utils.jsAttr(sourceId)}')">查看相关记录</button></div><div class="ms-candidate-actions"><button class="btn btn-success btn-sm" type="button" onclick="MilestonePage.reviewCandidate('${Utils.jsAttr(candidate.candidateId)}',true)">确认</button><button class="btn btn-secondary btn-sm" type="button" onclick="MilestonePage.reviewCandidate('${Utils.jsAttr(candidate.candidateId)}',false)">拒绝</button></div></article>`; }).join('')}</div>`;
  },

  _achievementRecords(model) {
    const source = this._achievements?.allAchievements || model.records;
    const standardIds = new Set(model.allItems.map(item => item.milestoneId));
    const unique = new Map();
    (Array.isArray(source) ? source : []).forEach(record => {
      const id = record.milestoneId || getMilestoneId(record.milestoneKey);
      if (!standardIds.has(id)) return;
      if (!unique.has(id)) unique.set(id, { ...record, milestoneId: id });
    });
    return [...unique.values()].filter(record => !this._filters.date || String(record.date || '').slice(0, 10) === this._filters.date).filter(record => this._filters.domain === '全部' || record.domain === this._filters.domain).filter(record => this._filters.source === '全部' || (record.sourceType || 'automatic') === this._filters.source).sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
  },

  _achievementsHTML(model) {
    const records = this._achievementRecords(model);
    const domains = ['全部', ...new Set(model.records.map(record => record.domain).filter(Boolean))];
    const sources = ['全部', 'automatic', 'candidate', 'manual', 'photo'];
    return `<div class="ms-achievements-wrap"><div class="ms-section-head"><div><h2>全部成就</h2><p>统一查看自动完成、候选确认、手工记录和照片打卡。</p></div><span class="ms-count-badge">${records.filter(record => !record.deletedAt).length}</span></div><div class="ms-filter-bar ms-achievement-filters"><label>日期<input type="date" aria-label="按日期筛选" value="${Utils.jsAttr(this._filters.date)}" onchange="MilestonePage.setFilter('date',this.value)"></label><label>领域<select aria-label="按成就领域筛选" onchange="MilestonePage.setFilter('domain',this.value)">${domains.map(value => `<option ${value === this._filters.domain ? 'selected' : ''}>${Utils.escapeHtml(value)}</option>`).join('')}</select></label><label>来源<select aria-label="按成就来源筛选" onchange="MilestonePage.setFilter('source',this.value)">${sources.map(value => `<option value="${Utils.jsAttr(value)}" ${value === this._filters.source ? 'selected' : ''}>${Utils.escapeHtml(value === '全部' ? value : this._sourceLabel(value))}</option>`).join('')}</select></label></div>${records.length ? `<div class="ms-achievement-list">${records.map(record => { const id = record.milestoneId || getMilestoneId(record.milestoneKey); return `<article class="ms-achievement-item ${record.deletedAt ? 'is-deleted' : ''}"><div><button class="ms-link-button" type="button" onclick="MilestonePage.focusMilestone('${Utils.jsAttr(id || '')}')">${Utils.escapeHtml(record.milestoneLabel || this._milestoneTitle(id) || record.milestoneKey || '里程碑成就')}</button><div class="ms-achievement-meta"><span>${Utils.escapeHtml(record.domain || '未分类')}</span><span>${Utils.escapeHtml(this._sourceLabel(record.sourceType))}</span><span>${Utils.escapeHtml(Utils.formatDate(record.date))}</span>${record.deletedAt ? '<span>已删除</span>' : ''}</div>${record.note ? `<p>备注：${Utils.escapeHtml(record.note)}</p>` : ''}</div><div class="ms-achievement-actions">${id ? `<button class="btn btn-secondary btn-sm" type="button" onclick="MilestonePage.focusMilestone('${Utils.jsAttr(id)}')">回到图谱</button>` : ''}${record.deletedAt ? `<button class="btn btn-secondary btn-sm" type="button" onclick="MilestonePage.restoreRecord('${Utils.jsAttr(record._id)}')">恢复</button>` : `<button class="btn-icon" type="button" aria-label="删除成就" title="删除" onclick="MilestonePage.deleteRecord('${Utils.jsAttr(record._id)}')">${Lucide.icon('trash-2', 16)}</button>`}</div></article>`; }).join('')}</div>` : this._panelState('achievements', 'empty', '暂无已完成成就', '完成一项里程碑后会出现在这里。', false)}</div>`;
  },

  _catalogHTML() {
    const badges = Array.isArray(this._achievements?.badges) ? this._achievements.badges : [];
    const combinations = Array.isArray(this._achievements?.combinations) ? this._achievements.combinations : [];
    if (!badges.length && !combinations.length) return this._panelState('catalog', 'partial', '成就图鉴暂不可用', '图鉴内容暂时无法显示，其他页面仍可使用。');
    const badgeRows = badges.map(badge => { const title = this._milestoneTitle(badge.milestoneId); const condition = badge.condition || badge.desc || (title ? `完成“${title}”后解锁` : '完成对应能力后解锁'); const progress = badge.unlocked ? '已完成' : `进度 ${String(badge.progress ?? 0)}`; return `<article class="ms-badge-item ${badge.unlocked ? 'is-unlocked' : 'is-locked'}"><button class="ms-link-button" type="button" onclick="MilestonePage.focusMilestone('${Utils.jsAttr(badge.milestoneId || '')}')">${Lucide.icon(badge.unlocked ? 'badge-check' : 'award', 18)} ${Utils.escapeHtml(badge.name || '成就徽章')}</button><p>解锁条件：${Utils.escapeHtml(condition)}</p>${title ? `<p>关联能力：${Utils.escapeHtml(title)}</p>` : ''}<div class="ms-achievement-meta"><span>${badge.unlocked ? '已解锁' : '未解锁'}</span><span>${Utils.escapeHtml(progress)}</span>${badge.unlocked && (badge.unlockedAt || badge.date || badge.record?.date) ? `<span>解锁日期：${Utils.escapeHtml(Utils.formatDate(badge.unlockedAt || badge.date || badge.record.date))}</span>` : ''}</div></article>`; }).join('');
    const comboRows = combinations.map(combo => { const required = combo.requiredBadges || []; const missing = combo.missingBadges || required.filter(id => !badges.find(badge => badge.id === id && badge.unlocked)); const unlockedCount = combo.unlockedBadgeCount ?? required.length - missing.length; const status = combo.unlocked ? '已解锁' : unlockedCount > 0 ? '进行中' : '未开始'; return `<article class="ms-combination-item ${combo.unlocked ? 'is-unlocked' : 'is-locked'}"><h3>${Utils.escapeHtml(combo.name || '组合成就')}</h3><div class="ms-combination-progress">进度：${unlockedCount}/${required.length}</div><p>${Utils.escapeHtml(combo.condition || combo.desc || '集齐指定徽章后解锁')}</p><div class="ms-achievement-meta"><span>${status}</span><span>${missing.length ? '还需：' + missing.map(id => `<button class="ms-inline-link" type="button" onclick="MilestonePage.focusBadge('${Utils.jsAttr(id)}')">${Utils.escapeHtml(this._badgeTitle(id))}</button>`).join('、') : '已满足全部条件'}</span></div></article>`; }).join('');
    return `<div class="ms-catalog-wrap"><div class="ms-section-head"><div><h2>成就图鉴</h2><p>徽章和组合成就</p></div></div><section class="ms-catalog-section"><div class="ms-section-head"><h3>成就徽章</h3><span class="ms-count-badge">${badges.filter(badge => badge.unlocked).length}/${badges.length}</span></div><div class="ms-badge-grid">${badgeRows}</div></section><section class="ms-catalog-section"><div class="ms-section-head"><h3>组合成就</h3><span class="ms-count-badge">${combinations.filter(combo => combo.unlocked).length}/${combinations.length}</span></div><div class="ms-combination-list">${comboRows || '<p class="ms-empty-inline">暂无组合成就数据。</p>'}</div></section></div>`;
  },

  async _loadCandidates() {
    const result = await API.listMilestoneCandidates();
    return result?.records || [];
  },

  async render(container) {
    this._container = container;
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = this._shellHTML();
    this._applyTabVisibility(this._activeTab);
    V3UI.setStatus('loading', '里程碑加载中');
    const baby = Utils.getBabyInfo();
    if (!baby || !baby._id) {
      this._setPanel('progress', this._panelState('progress', 'empty', '请先创建宝宝档案', '创建档案后才能查看里程碑。', false));
      container.removeAttribute('aria-busy');
      V3UI.setStatus('empty', '请先创建宝宝档案');
      return;
    }
    this._monthAge = Utils.calcMonthAge(baby.birthDate);
    const [recordsResult, candidatesResult] = await Promise.allSettled([API.listMilestone(), this._loadCandidates()]);
    this._records = recordsResult.status === 'fulfilled' ? (recordsResult.value?.records || []) : [];
    this._achievements = recordsResult.status === 'fulfilled' ? (recordsResult.value?.achievements || {}) : {};
    this._candidateRecords = candidatesResult.status === 'fulfilled' ? candidatesResult.value : [];
    const model = this._model();
    const recordError = recordsResult.status === 'rejected' ? this._stateFromError(recordsResult.reason) : '';
    const candidateError = candidatesResult.status === 'rejected' ? this._stateFromError(candidatesResult.reason) : '';
    this._setPanel('progress', recordError ? this._panelState('progress', recordError, '成长进度加载失败', '其他成功区域仍可使用。') : `<div data-ms-tab-loaded="progress">${this._progressHTML(model)}</div>`);
    this._setPanel('graph', recordError ? this._panelState('graph', recordError, '月龄图谱加载失败', '请重新加载图谱数据。') : `<div data-ms-tab-loaded="graph">${this._graphHTML(model)}</div>`);
    this._setPanel('candidates', candidateError ? this._panelState('candidates', candidateError, '待确认加载失败', '其他成功区域仍可使用。') : `<div data-ms-tab-loaded="candidates">${this._candidateHTML(model)}</div>`);
    this._setPanel('achievements', recordError ? this._panelState('achievements', recordError, '全部成就加载失败', '请重新加载成就数据。') : `<div data-ms-tab-loaded="achievements">${this._achievementsHTML(model)}</div>`);
    this._setPanel('catalog', recordError ? this._panelState('catalog', recordError, '成就图鉴加载失败', '请重新加载成就数据。') : `<div data-ms-tab-loaded="catalog">${this._catalogHTML()}</div>`);
    this._updateTabCounts(model);
    container.removeAttribute('aria-busy');
    V3UI.setStatus(recordError || candidateError ? 'partial' : 'loaded', recordError || candidateError ? '部分内容加载失败' : '');
    if (this._focusedMilestoneId) this._scrollToFocus();
  },

  _shellHTML() {
    return `<div class="ms-page" data-ms-page="five-business-tabs"><nav class="v3-subtabs ms-tabs" role="tablist" aria-label="里程碑分类">${this._tabs.map(([key, icon, label]) => `<button type="button" class="v3-subtab" data-ms-tab="${key}" role="tab" aria-selected="false" aria-controls="ms-panel-${key}" onclick="MilestonePage.switchTab('${key}')">${Lucide.icon(icon, 15)}<span>${label}</span><b class="v3-subtab-count" data-ms-count="${key}">0</b></button>`).join('')}</nav><div class="ms-tab-panels">${this._tabs.map(([key]) => `<section id="ms-panel-${key}" class="ms-business-panel" data-ms-panel="${key}" role="tabpanel"><div class="ms-panel-loading" data-ms-loading="${key}">${this._panelState(key, 'loading', '加载中', '正在加载本区域。', false)}</div></section>`).join('')}</div></div>`;
  },

  _setPanel(tab, html) {
    const panel = this._container?.querySelector(`[data-ms-panel="${tab}"]`);
    if (!panel) return;
    panel.innerHTML = html;
    panel.dataset.msState = panel.querySelector('[data-ms-state]')?.dataset.msState || 'loaded';
  },

  _updateTabCounts(model) {
    const completed = model.allItems.filter(item => model.achievedMap[item.milestoneId]).length;
    const unlocked = (this._achievements.badges || []).filter(badge => badge.unlocked).length;
    const counts = { progress: `${completed}/${model.allItems.length}`, graph: model.allItems.length, candidates: model.candidates.length, achievements: completed, catalog: `${unlocked}/${(this._achievements.badges || []).length}` };
    Object.entries(counts).forEach(([key, count]) => { const el = this._container?.querySelector(`[data-ms-count="${key}"]`); if (el) el.textContent = String(count); });
  },

  _applyTabVisibility(active) {
    this._activeTab = active;
    const root = this._container;
    if (!root) return;
    root.querySelectorAll('[data-ms-panel]').forEach(panel => { panel.hidden = panel.dataset.msPanel !== active; });
    root.querySelectorAll('[data-ms-tab]').forEach(button => { const selected = button.dataset.msTab === active; button.classList.toggle('is-active', selected); button.setAttribute('aria-selected', String(selected)); });
  },

  switchTab(tab) {
    if (!this._tabs.some(item => item[0] === tab)) return;
    this._applyTabVisibility(tab);
    V3UI.setStatus('loaded', '');
    if (tab === 'graph' && this._focusedMilestoneId) this._scrollToFocus();
  },

  retryTab() { return this.reload(); },

  setFilter(key, value) {
    this._filters[key] = value || (key === 'date' ? '' : '全部');
    if (this._container) this.render(this._container);
  },

  resetFilters() {
    this._filters = { domain: '全部', status: '全部', source: '全部', date: '' };
    if (this._container) this.render(this._container);
  },

  toggleBand(id) {
    const body = document.getElementById(id);
    if (!body) return;
    const expanded = body.hidden;
    body.hidden = !expanded;
    body.previousElementSibling?.setAttribute('aria-expanded', String(expanded));
  },

  focusMilestone(milestoneId) {
    if (!milestoneId) return;
    this._focusedMilestoneId = milestoneId;
    this._filters.domain = '全部';
    this._filters.status = '全部';
    this._activeTab = 'graph';
    if (this._container) this.render(this._container);
  },

  _scrollToFocus() {
    setTimeout(() => document.getElementById(`ms-item-${this._focusedMilestoneId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
  },

  viewSource(sourceEventId) {
    V3UI.setStatus('loaded', sourceEventId ? `来源记录：${sourceEventId}` : '来源记录不可用');
  },

  focusBadge(badgeId) {
    const badge = (this._achievements?.badges || []).find(item => item.id === badgeId);
    if (badge?.milestoneId) this.focusMilestone(badge.milestoneId);
    else { this._activeTab = 'catalog'; V3UI.setStatus('loaded', `徽章：${badgeId}`); this._applyTabVisibility('catalog'); }
  },

  async reviewCandidate(candidateId, approved) {
    V3UI.setStatus('submitting', approved ? '正在确认候选' : '正在拒绝候选');
    try {
      const result = await API.confirmMilestoneCandidate(candidateId, approved);
      if (result?.dataVersion) Utils.storage.set('dv', result.dataVersion);
      V3UI.setStatus('success', approved ? '候选已确认' : '候选已拒绝');
      await this.reload();
    } catch (error) {
      V3UI.setStatus(this._stateFromError(error), approved ? '确认失败' : '拒绝失败');
    }
  },

  openManualRecord(milestoneId) {
    const item = (window.MILESTONE_STANDARD || []).flatMap(group => group.items || []).find(row => row.milestoneId === milestoneId);
    if (!item) return;
    App._showModal(`记录“${Utils.escapeHtml(item.skill)}”`, `<div class="form-group"><label>日期</label><input type="date" id="ms-manual-date" class="form-input" value="${Utils.todayStr()}"></div><div class="form-group"><label>备注</label><input type="text" id="ms-manual-note" class="form-input" placeholder="可选"></div><button class="btn btn-primary btn-block" type="button" onclick="MilestonePage.submitManualRecord('${Utils.jsAttr(milestoneId)}')">保存</button>`);
  },

  async submitManualRecord(milestoneId) {
    const item = (window.MILESTONE_STANDARD || []).flatMap(group => group.items || []).find(row => row.milestoneId === milestoneId);
    const date = document.getElementById('ms-manual-date')?.value || Utils.todayStr();
    const note = document.getElementById('ms-manual-note')?.value || '';
    if (!item) return;
    Utils.showLoading('保存中...');
    try {
      const result = await API.createMilestone({ milestoneId, milestoneKey: item.skill, milestoneLabel: item.skill, domain: item.domain, date, note });
      Utils.hideLoading();
      App._closeModal();
      if (result?.dataVersion) Utils.storage.set('dv', result.dataVersion);
      Utils.showToast('已记录');
      await this.reload();
    } catch (error) {
      Utils.hideLoading();
      V3UI.setStatus(this._stateFromError(error), '保存失败');
      Utils.showToast('保存失败，请稍后重试');
    }
  },

  async deleteRecord(recordId) {
    if (!recordId || !window.confirm('确认删除此成就记录？')) return;
    V3UI.setStatus('submitting', '正在删除成就');
    try { await API.deleteMilestone(recordId); V3UI.setStatus('success', '成就已删除'); await this.reload(); } catch (error) { V3UI.setStatus(this._stateFromError(error), '删除失败'); }
  },

  async restoreRecord(recordId) {
    V3UI.setStatus('submitting', '正在恢复成就');
    try { await API.restoreMilestone(recordId); V3UI.setStatus('success', '成就已恢复'); await this.reload(); } catch (error) { V3UI.setStatus(this._stateFromError(error), '恢复失败'); }
  },

  editNote(recordId) {
    App._showModal('补备注', `<div class="form-group"><label>备注</label><input type="text" id="ms-note-edit" class="form-input" placeholder="可选"></div><button class="btn btn-primary btn-block" type="button" onclick="MilestonePage.saveNote('${Utils.jsAttr(recordId)}')">保存</button>`);
  },

  async saveNote(recordId) {
    const note = document.getElementById('ms-note-edit')?.value?.trim() || '';
    Utils.showLoading('保存中...');
    try { const result = await API.updateMilestone(recordId, { note }); Utils.hideLoading(); App._closeModal(); if (result?.dataVersion) Utils.storage.set('dv', result.dataVersion); Utils.showToast('备注已保存'); await this.reload(); } catch (error) { Utils.hideLoading(); V3UI.setStatus(this._stateFromError(error), '备注保存失败'); }
  },

  async reload() { if (this._container) await this.render(this._container); }
};

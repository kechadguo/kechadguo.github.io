/**
 * 里程碑模块 — 独立功能页（v83 集成：三阶段动态视图 + FocusGuide + 发育参考）
 * 结构：本月关注引导 → 当月里程碑 → 上月未勾选 → 下一阶段预告
 *       → 发育参考（大运动/乳牙，默认折叠）→ 第一次记录 → 已记录列表
 * 交互：点击勾选 → App.recordMilestone 一键落库，弹窗可选补备注
 */
window.MilestonePage = {
  _container: null,
  _monthAge: null,
  _activeTab: 'monthly',
  _candidateRecords: [],
  async _loadCandidates() {
    if (!API.listMilestoneCandidates) return [];
    const result = await API.listMilestoneCandidates();
    return result?.records || [];
  },
  _stateFromError(error) {
    if (error?.isPermissionError || error?.httpStatus === 403 || error?.code === 4003) return 'permission-denied';
    if (error?.isAuthError || error?.code === 4008 || error?.code === 4009) return 'auth-required';
    if (error?.isConflict || error?.code === 'CONFLICT' || error?.httpStatus === 409) return 'conflict';
    if (error?.isNetworkError || Utils.isOffline?.()) return 'offline';
    return 'error';
  },
  _stateHTML(state, message = '') {
    const copy = {
      'auth-required': ['请先登录', '登录后才能查看宝宝的里程碑。'],
      'permission-denied': ['暂无访问权限', '请切换到有权限的家庭或联系管理员。'],
      conflict: ['数据发生冲突', '请刷新后重新确认候选，避免覆盖其他成员的更新。'],
      offline: ['当前离线', '联网后可同步候选和已确认里程碑；本地页面仍可查看已缓存内容。'],
      error: ['加载失败', message || '请稍后重试。']
    }[state] || ['加载中', message || '页面加载中。'];
    if (window.V3UI?.setStatus) V3UI.setStatus(state, copy[0]);
    return V3UI?.stateHTML ? V3UI.stateHTML(state, copy[0], copy[1], `<button class="btn btn-primary" type="button" onclick="MilestonePage.reload()">重新加载</button>`) : `<div class="empty-state"><h2>${Utils.escapeHtml(copy[0])}</h2><p>${Utils.escapeHtml(copy[1])}</p></div>`;
  },
  async _candidateHTML(candidates = null) {
    candidates = candidates || await this._loadCandidates();
    this._candidateRecords = candidates;
    if (!candidates.length) {
      return `<section class="v3-state-wrap" data-ms-empty="true">${V3UI.stateHTML('empty', '暂无待确认候选', '新的权威事实产生后，候选会自动出现在这里。')}</section>`;
    }
    return `<div class="card"><div class="card-title">候选确认 <span class="text-muted">${candidates.length}项</span></div>${candidates.map(candidate => `<article class="record-item"><div class="record-main"><div class="record-title">${Utils.escapeHtml(candidate.triggerModule || candidate.ruleId || '里程碑候选')}</div><div class="record-meta">证据：${Utils.escapeHtml(candidate.evidence?.sourceEventId || candidate.triggerEventId || '未知')} · ${Utils.escapeHtml(candidate.status || 'WAITING_CONFIRMATION')}</div></div><button class="btn btn-success btn-sm" onclick="MilestonePage._reviewCandidate('${Utils.jsAttr(candidate.candidateId)}',true)">确认</button><button class="btn btn-secondary btn-sm" onclick="MilestonePage._reviewCandidate('${Utils.jsAttr(candidate.candidateId)}',false)">拒绝</button></article>`).join('')}</div>`;
  },
  async _reviewCandidate(candidateId, approved) {
    const container = this._container;
    if (container) {
      container.setAttribute('aria-busy', 'true');
      const action = container.querySelector(`[onclick*="_reviewCandidate('${Utils.jsAttr(candidateId)}'"]`);
      if (action) { action.disabled = true; action.setAttribute('aria-busy', 'true'); }
      const status = document.getElementById('page-status');
      if (window.V3UI?.setStatus) V3UI.setStatus('submitting', '正在提交候选处理');
    }
    try {
      await API.confirmMilestoneCandidate(candidateId, approved);
      if (container) container.innerHTML = V3UI.stateHTML('success', approved ? '候选已确认' : '候选已拒绝', '里程碑、徽章和组合成就将重新计算。');
      if (window.V3UI?.setStatus) V3UI.setStatus('success', approved ? '候选已确认' : '候选已拒绝');
      setTimeout(() => this.reload(), 500);
    } catch (error) {
      const state = this._stateFromError(error);
      if (container) { container.setAttribute('aria-busy', 'false'); container.innerHTML = this._stateHTML(state, error.message); }
      if (window.V3UI?.setStatus) V3UI.setStatus(state, '候选处理失败');
    }
  },

  async render(container) {
    this._container = container;
    const baby = Utils.getBabyInfo();
    if (!baby || !baby._id) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">${Lucide.icon('star', 32)}</div><p>请先创建宝宝档案</p></div>`;
      return;
    }

    const monthAge = Utils.calcMonthAge(baby.birthDate);
    this._monthAge = monthAge;
    const ms = getMilestoneByAge(monthAge);

    let achievedData;
    try {
      achievedData = await API.listMilestone();
    } catch (error) {
      const state = this._stateFromError(error);
      container.innerHTML = this._stateHTML(state, error.message);
      container.dataset.v3State = state;
      return;
    }
    const achievedRecords = achievedData?.records || [];
    this._records = achievedRecords;
    this._achievements = achievedData?.achievements || { badges: [], combinations: [] };
    this._unlockedBadges = this._achievements.badges || achievedRecords.filter(r => r.badgeId || r.photoUrl);
    const achievedMap = {};
    achievedRecords.forEach(r => { achievedMap[r.milestoneKey] = r; });

    const customMilestones = [
      { key: '第一次微笑', domain: '社交' }, { key: '笑出声', domain: '社交' },
      { key: '翻身', domain: '大运动' }, { key: '吃辅食', domain: '认知' },
      { key: '叫妈妈', domain: '语言' }, { key: '叫爸爸', domain: '语言' },
      { key: '坐起来', domain: '大运动' }, { key: '爬行', domain: '大运动' },
      { key: '站起来', domain: '大运动' }, { key: '走路', domain: '大运动' },
      { key: '长牙', domain: '认知' }, { key: '游泳', domain: '社交' },
      { key: '去公园', domain: '社交' }, { key: '看海', domain: '社交' }
    ];

    // v95 #3：删除「本月关注」引导条（与里程碑页信息重复）
    let html = '';

    // ===== 1. 待确认候选 =====
    let candidateZone;
    try {
      candidateZone = await this._candidateHTML();
    } catch (error) {
      const state = this._stateFromError(error);
      candidateZone = `<section class="v3-state-wrap v3-state-partial" data-v3-state="partial" data-ms-partial-error="candidates">${this._stateHTML(state, error.message)}</section>`;
      if (window.V3UI?.setStatus) V3UI.setStatus('partial', '部分内容加载失败');
    }

    // ===== 2. 当月（这一阶段）=====
    const groups = (window.MILESTONE_STANDARD || []).filter(g => g.month <= Math.max(1, Math.floor(monthAge || 1)));
    const curGroup = ms.current[0];
    html += `<div class="card ms-age-groups"><div class="card-title">${Lucide.icon('calendar', 18)} 月龄里程碑</div>${[['1-12月龄', groups.filter(g => g.month >= 1 && g.month <= 12)],['12-24月龄', groups.filter(g => g.month > 12 && g.month <= 24)],['24-36月龄', groups.filter(g => g.month > 24 && g.month <= 36)]].map(([label, ageGroups], index) => `<div class="ms-age-group"><button class="ms-age-group-head" onclick="MilestonePage._toggleCollapse('ms-age-${index}')"><strong>${label}</strong><span>${ageGroups.reduce((n, g) => n + g.items.length, 0)}项　</span></button><div id="ms-age-${index}" class="ms-age-group-body" style="display:${index === 0 ? 'block' : 'none'}">${ageGroups.map(g => `<div class="ms-month-row"><strong>${g.ageLabel || g.month + '月龄'}</strong><span>${g.items.length}项</span></div>${g.items.filter(m => !achievedMap[m.skill]).map(m => this._renderItem(m, achievedMap, { clickable: true })).join('') || '<div class="text-muted" style="font-size:12px;padding:8px 0">当前阶段已完成</div>'}`).join('')}</div></div>`).join('')}</div>
      <div class="card">
        <div class="card-title">${Lucide.icon('star', 18)} ${curGroup.month} 月龄 · 本月里程碑</div>
        <p class="text-muted" style="font-size:12px;margin-bottom:8px">点击勾选宝宝已掌握的技能，一键记录（可在记录后补写备注）</p>
        ${curGroup.items.map(m => this._renderItem(m, achievedMap, { clickable: true })).join('')}
        ${this._devRefHTML(monthAge)}
      </div>`;

    // ===== 2. 上月未勾选（已过阶段未掌握）=====
    const missed = [];
    ms.previous.forEach(g => g.items.forEach(m => { if (!achievedMap[m.skill]) missed.push({ ...m, passMonth: g.month }); }));
    if (missed.length > 0) {
      html += `
      <div class="card" style="border-color:var(--color-highlight-border, #FFD591)">
        <div class="card-title" style="cursor:pointer" onclick="MilestonePage._toggleCollapse('ms-missed')">${Lucide.icon('alert-triangle', 18)} 已过阶段未掌握 <span class="ms-badge-warn">${missed.length}</span><span style="float:right;color:var(--color-text-tertiary)">▾</span></div>
        <div id="ms-missed" style="display:none">
          <p class="text-muted" style="font-size:12px;margin-bottom:8px">这些里程碑已过应掌握月龄，仍未勾选。晚一点掌握也正常，可继续记录；若明显滞后（如 18 个月仍不会独走）建议就医评估。</p>
          ${missed.map(m => this._renderItem(m, achievedMap, { clickable: true, note: '已过 ' + m.passMonth + ' 月龄' })).join('')}
        </div>
      </div>`;
    } else if (ms.previous.length > 0) {
      html += `
      <div class="card" style="background:var(--color-success-soft, #F6FFED);border-color:var(--color-success-border, #B7EB8F)">
        <div class="card-title">${Lucide.icon('check-circle', 18)} 已过阶段里程碑全部掌握</div>
      </div>`;
    }

    // ===== 3. 下一阶段预告 =====
    if (ms.next.length > 0) {
      const nextGroup = ms.next[0];
      const moreCount = ms.next.slice(1).reduce((n, g) => n + g.items.length, 0);
      html += `
      <div class="card">
        <div class="card-title">${Lucide.icon('eye', 18)} ${nextGroup.month} 月龄 · 下一阶段预告</div>
        <p class="text-muted" style="font-size:12px;margin-bottom:8px">提前了解接下来的能力发展，不必刻意训练</p>
        ${nextGroup.items.map(m => this._renderItem(m, achievedMap, { clickable: false })).join('')}
        ${moreCount > 0 ? `<div class="text-muted" style="font-size:12px;text-align:center;margin-top:8px">还有 ${ms.next.length - 1} 个后续阶段（${moreCount} 项），随月龄自动进入「本月里程碑」</div>` : ''}
      </div>`;
    }

    // ===== 4.（v95 #3：原「发育参考（细节）」独立折叠卡已删除，融合进本月里程碑卡）=====

    // ===== 5. 第一次记录（自定义）=====
    html += `
      <div class="card">
        <div class="card-title">第一次记录</div>
        <p class="text-muted" style="font-size:12px;margin-bottom:8px">点击即可记录宝宝的每一个"第一次"</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${customMilestones.map(m => {
            const rec = achievedMap[m.key];
            const click = rec ? '' : `App.recordMilestone('${Utils.jsAttr(m.key)}', '${Utils.jsAttr(m.domain)}', '${Utils.jsAttr(m.key)}')`;
            return `
              <button class="btn ${rec ? 'btn-success' : 'btn-secondary'}" style="font-size:13px;padding:8px 12px" onclick="${click}">
                ${rec ? Lucide.icon('check', 14) + ' ' : ''}${Utils.escapeHtml(m.key)}
              </button>
            `;
          }).join('')}
        </div>
        <button class="btn btn-primary btn-block mt-16" onclick="App.openMilestoneForm()">${Lucide.icon('plus', 16)} 自定义里程碑</button>
      </div>`;

    // ===== 6. 已记录的里程碑 =====
    html += `
      ${(achievedData?.records || []).length > 0 ? `
      <div class="card">
        <div class="card-title">${Lucide.icon('clipboard-list', 18)} 已记录 (${achievedData.records.length})</div>
        ${achievedData.records.map(r => `
          <div class="record-item">
            <div class="record-main">
              <div class="record-title">${Utils.escapeHtml(r.milestoneLabel || r.milestoneKey)}</div>
              <div class="record-meta">${Utils.formatDate(r.date)}${r.note ? ' · ' + Utils.escapeHtml(r.note) : ''}</div>
            </div>
            <button class="btn btn-secondary" style="font-size:12px;padding:4px 10px;white-space:nowrap" onclick="MilestonePage._editNote('${r._id}')">${Lucide.icon('edit-3', 14)} 备注</button>
            ${r.deletedAt ? `<button class="btn btn-secondary" onclick="MilestonePage._restoreRecord('${Utils.jsAttr(r._id)}')">恢复</button>` : `<button class="todo-del" onclick="App._deleteMilestone('${Utils.jsAttr(r._id)}')">&times;</button>`}
          </div>
        `).join('')}
      </div>` : ''}
    `;

    const ageProgressZone = `<section class="v3-subtab-panel ms-zone ms-age-progress" data-ms-panel="monthly" data-ms-zone="age-progress" role="tabpanel"><div class="ms-zone-title">${Lucide.icon('calendar', 18)} 月龄进度 · ${monthAge}个月</div><p class="text-muted">当前阶段：${Utils.escapeHtml(curGroup.ageLabel || `${curGroup.month}月龄`)}；已确认记录会同步更新徽章和组合成就。</p>${html}</section>`;
    const badgeZone = this._badgesHTML().replace('class="ms-zone ms-badges"', 'class="v3-subtab-panel ms-zone ms-badges" data-ms-panel="badges"');
    const combinationZone = this._combinationsHTML().replace('class="ms-zone ms-combinations"', 'class="v3-subtab-panel ms-zone ms-combinations" data-ms-panel="combinations"');
    const confirmedZone = `<section class="v3-subtab-panel ms-zone ms-confirmed" data-ms-panel="confirmed" data-ms-zone="confirmed" role="tabpanel"><div class="ms-zone-title">${Lucide.icon('clipboard-check', 18)} 已确认里程碑</div>${achievedRecords.length ? achievedRecords.map(r => `<article class="record-item"><div class="record-main"><strong>${Utils.escapeHtml(r.milestoneLabel || r.milestoneKey)}</strong><div class="record-meta">${Utils.escapeHtml(r.domain || '')} · ${Utils.formatDate(r.date)}${r.note ? ` · ${Utils.escapeHtml(r.note)}` : ''}</div></div></article>`).join('') : '<p class="text-muted">暂无已确认里程碑。</p>'}</section>`;
    const candidatePanel = `<section class="v3-subtab-panel ms-zone ms-candidates" data-ms-panel="candidates" data-ms-zone="candidates" role="tabpanel">${candidateZone}</section>`;
    const tabs = [['monthly', 'calendar', '月龄进度', groups.length], ['candidates', 'clock-3', '待确认', this._candidateRecords.length], ['confirmed', 'clipboard-check', '已确认', achievedRecords.length], ['badges', 'award', '成就徽章', this._unlockedBadges.length], ['combinations', 'layers', '组合成就', (this._achievements?.combinations || []).filter(item => item.unlocked).length]];
    const activeTab = tabs.some(item => item[0] === this._activeTab) ? this._activeTab : 'monthly';
    container.innerHTML = `<div class="ms-page" data-ms-page="five-tabs"><nav class="v3-subtabs ms-tabs" role="tablist" aria-label="里程碑分类">${tabs.map(([key, icon, label, count]) => `<button type="button" class="v3-subtab ${activeTab === key ? 'is-active' : ''}" role="tab" aria-selected="${activeTab === key}" onclick="MilestonePage.switchTab('${key}')">${Lucide.icon(icon, 15)}<span>${label}</span><b class="v3-subtab-count">${count}</b></button>`).join('')}</nav><div class="ms-tab-panels">${ageProgressZone}${candidatePanel}${confirmedZone}${badgeZone}${combinationZone}</div></div>`;
    container.querySelectorAll('[data-ms-panel]').forEach(panel => { panel.hidden = panel.dataset.msPanel !== activeTab; });
    this._bindPhotoUpload(container);
  },

  switchTab(tab) {
    this._activeTab = tab;
    const root = this._container;
    if (!root) return;
    root.querySelectorAll('.ms-tabs .v3-subtab').forEach(button => {
      const active = button.getAttribute('onclick')?.includes(`'${tab}'`);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    root.querySelectorAll('[data-ms-panel]').forEach(panel => { panel.hidden = panel.dataset.msPanel !== tab; });
    window.V3UI?.setStatus?.('loaded', '');
  },

  _badgesHTML() {
    const definitions = window.BADGE_SYSTEM?.badges || [];
    const unlocked = new Map((this._achievements?.badges || []).filter(item => item.unlocked !== false).map(item => [item.id, item]));
    const badges = definitions.filter(badge => !badge.monthWindow || this._monthAge >= badge.monthWindow[0]);
    return `<section class="ms-zone ms-badges" data-ms-zone="badges"><div class="card"><div class="card-title">成就徽章 <span class="text-muted">已获得${unlocked.size}个</span></div><p class="text-muted" style="font-size:12px">根据已确认的真实里程碑动态计算。</p><div class="badge-grid">${badges.map(b => { const record = unlocked.get(b.id); return `<button class="badge-card ${record ? 'unlocked' : 'locked'}" data-badge-id="${Utils.jsAttr(b.id)}" data-badge-name="${Utils.jsAttr(b.name)}" aria-pressed="${record ? 'true' : 'false'}"><span class="badge-card-icon">${Utils.escapeHtml(b.icon || '')}</span><strong>${Utils.escapeHtml(b.name)}</strong><small>${record ? `已点亮 · ${Utils.escapeHtml(record.record?.date || '')}` : '未解锁'}</small></button>`; }).join('')}</div></div></section>`;
  },
  _combinationsHTML() {
    const combinations = this._achievements?.combinations || [];
    return `<section class="ms-zone ms-combinations" data-ms-zone="combinations"><div class="card"><div class="card-title">组合成就</div>${combinations.length ? combinations.map(item => `<div class="record-item"><div class="record-main"><strong>${Utils.escapeHtml(item.name)}</strong><div class="record-meta">${item.unlocked ? '已解锁' : '未解锁'} · ${item.requiredBadges.length} 枚徽章</div></div></div>`).join('') : '<p class="text-muted">暂无组合成就。</p>'}</div></section>`;
  },

  _bindPhotoUpload(root) {
    if (!root || root.__photoBound) return;
    root.__photoBound = true;
    root.addEventListener('click', e => { const card = e.target.closest?.('[data-badge-id]'); if (!card) return; if (card.dataset.badgeId === 'first_tooth' && card.classList.contains('unlocked')) { showPage('medical'); setTimeout(() => MedicalPage.switchHealthTab('teeth'), 0); return; } this._openBadgeCheckin(card.dataset.badgeId, card.dataset.badgeName); });
  },

  _openBadgeCheckin(badgeId, badgeName) {
    App._showModal(`${Lucide.icon('camera', 18)} ${Utils.escapeHtml(badgeName)} · 照片打卡`, `<div class="form-group"><label>发生日期</label><input id="badge-date" class="form-input" type="date" value="${Utils.todayStr()}"></div><div class="form-group"><label>照片</label><input id="badge-photo" class="form-input" type="file" accept="image/*"></div><button class="btn btn-primary btn-block" onclick="MilestonePage._submitBadge('${Utils.jsAttr(badgeId)}','${Utils.jsAttr(badgeName)}')">上传并点亮</button>`);
  },

  async _submitBadge(badgeId, badgeName) {
    const file = document.getElementById('badge-photo')?.files?.[0];
    const date = document.getElementById('badge-date')?.value || Utils.todayStr();
    if (!file) return Utils.showToast('请先选择照片');
    try { Utils.showProcessing('正在压缩照片...'); const blob = await this._compressImage(file, .8, 800, 800); const base64 = await this._blobToBase64(blob); const uploaded = await API.uploadMilestonePhoto(base64); await API.createMilestone({ milestoneKey: badgeId, badgeId, milestoneLabel: badgeName, domain: 'badge', date, photoUrl: uploaded.photoUrl, note: '照片打卡解锁' }); Utils.hideLoading(); Utils.showToast('徽章已点亮'); await this.reload(); } catch (e) { Utils.hideLoading(); Utils.showToast('点亮失败：' + e.message); }
  },

  _compressImage(file, quality, maxWidth, maxHeight) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = e => { const img = new Image(); img.onload = () => { let w = img.width, h = img.height; const scale = Math.min(1, maxWidth / w, maxHeight / h); w = Math.round(w * scale); h = Math.round(h * scale); const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(img, 0, 0, w, h); canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('照片压缩失败')), 'image/jpeg', quality); }; img.onerror = () => reject(new Error('照片读取失败')); img.src = e.target.result; }; reader.onerror = reject; reader.readAsDataURL(file); }); },
  _blobToBase64(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); }); },


  /** 刷新当前页 */
  async reload() {
    if (this._container) await this.render(this._container);
  },

  /**
   * v95 #3：本月发育参考（融合进本月里程碑卡）
   * 从 GROSS_MOTOR_TIMELINE / TEETH_SCHEDULE 中筛出与当前月龄相关的条目，
   * 大运动取「正在范围内」的技能，乳牙取「正在萌出窗口」或「下一颗」。
   */
  _devRefHTML(monthAge) {
    if (monthAge == null) return '';
    const parseRange = (s) => {
      const m = String(s || '').match(/(\d+)\s*-\s*(\d+)/);
      return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
    };

    // 大运动：range 覆盖当前月龄
    const motors = (window.GROSS_MOTOR_TIMELINE || []).filter(t => {
      const r = parseRange(t.range);
      return r && monthAge >= r[0] && monthAge <= r[1];
    }).slice(0, 3);

    // 乳牙：萌出窗口内的；若都没有，取下一颗（起始月龄最近的）
    const teethAll = window.TEETH_SCHEDULE || [];
    let teeth = teethAll.filter(t => {
      const r = parseRange(t.months);
      return r && monthAge >= r[0] && monthAge <= r[1];
    });
    if (!teeth.length) {
      const next = teethAll.map(t => ({ t, r: parseRange(t.months) }))
        .filter(x => x.r && x.r[0] > monthAge)
        .sort((a, b) => a.r[0] - b.r[0])[0];
      teeth = next ? [next.t] : [];
    } else {
      teeth = teeth.slice(0, 2);
    }

    if (!motors.length && !teeth.length) return '';

    const row = (left, mid, right) => `
      <div class="milestone-timeline-row">
        <span class="tl-name">${Utils.escapeHtml(left)}</span>
        <span class="tl-months">${Utils.escapeHtml(right)}</span>
      </div>
      <div class="tl-note" style="padding:0 12px 6px">${Utils.escapeHtml(mid)}</div>`;

    return `
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--color-border-subtle, #EEE)">
        <div class="card-title" style="font-size:13px;margin-top:0">${Lucide.icon('dumbbell', 15)} 本月发育参考</div>
        ${motors.length ? `
          <div class="milestone-timeline">${motors.map(t => row(t.skill + '（' + t.majority + '多数掌握）', t.note, t.range)).join('')}</div>` : ''}
        ${teeth.length ? `
          <div class="card-title" style="font-size:13px;margin-top:10px">${Lucide.icon('smile', 15)} 乳牙窗口</div>
          <div class="milestone-timeline">${teeth.map(t => row('第' + t.order + '颗 · ' + t.name, t.desc, t.months)).join('')}</div>
          <div class="tl-tip">${Lucide.icon('lightbulb', 14)} 第一颗乳牙 13 个月内萌出均属正常，顺序个体差异大；2-3 岁 20 颗长齐。</div>` : ''}
      </div>`;
  },

  /** 单个里程碑项渲染 */
  _renderItem(m, achievedMap, opts) {
    const rec = achievedMap[m.skill];
    const clickable = opts && opts.clickable;
    const msClick = (clickable && !rec) ? `App.recordMilestone('${Utils.jsAttr(m.skill)}', '${Utils.jsAttr(m.domain)}', '${Utils.jsAttr(m.skill)}')` : '';
    return `
      <div class="milestone-item">
        <div class="milestone-check ${rec ? 'checked' : ''} ${clickable ? 'ms-clickable' : ''}" onclick="${msClick}">${rec ? Lucide.icon('check', 14) : ''}</div>
        <div class="milestone-info">
          <span class="milestone-domain ${m.domain}">${m.domain}</span>
          <span class="milestone-skill">${Utils.escapeHtml(m.skill)}</span>
          ${opts && opts.note ? `<span class="ms-pass-note">${Utils.escapeHtml(opts.note)}</span>` : ''}
          <div class="milestone-desc">${Utils.escapeHtml(m.desc)}</div>
          ${rec
            ? `<div class="milestone-date">${Lucide.icon('check', 14)} ${Utils.formatDate(rec.date)} 已记录 <a style="color:var(--color-accent);cursor:pointer" onclick="MilestonePage._editNote('${rec._id}')">${Lucide.icon('edit-3', 12)} 补备注</a></div>`
            : (m.warning ? `<div class="milestone-warning">${Lucide.icon('alert-triangle', 14)} ${Utils.escapeHtml(m.warning)}</div>` : '')}
          ${m.training ? `<div class="milestone-training">${Lucide.icon('lightbulb', 14)} ${Utils.escapeHtml(m.training)}</div>` : ''}
        </div>
      </div>
    `;
  },

  /** 折叠/展开卡片 */
  _toggleCollapse(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  },

  /** 补备注 */
  _editNote(recordId) {
    App._showModal(`${Lucide.icon('edit-3', 18)} 补备注（可选）`, `
      <div class="form-group"><label>备注</label><input type="text" id="ms-note-edit" class="form-input" placeholder="记录这一刻的感受，或留空取消"></div>
      <button class="btn btn-primary btn-block" onclick="MilestonePage._saveNote('${recordId}')">保存</button>
    `);
  },

  async _saveNote(recordId) {
    const note = document.getElementById('ms-note-edit')?.value?.trim() || '';
    Utils.showLoading('保存中...');
    try {
      const data = await API.updateMilestone(recordId, { note });
      Utils.hideLoading();
      App._closeModal();
      if (data && data.dataVersion) Utils.storage.set('dv', data.dataVersion);
      Utils.showToast(note ? '备注已保存' : '已更新');
      await this.reload();
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('保存失败: ' + e.message);
    }
  }
};

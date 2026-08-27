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
  _records: [],
  _unlockedBadges: [],

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

    const [achievedData] = await Promise.all([
      API.listMilestone().catch(() => ({ records: [] }))
    ]);
    const achievedRecords = achievedData?.records || [];
    this._records = achievedRecords;
    this._unlockedBadges = achievedRecords.filter(r => r.badgeId || r.photoUrl);
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
            <button class="todo-del" onclick="App._deleteMilestone('${r._id}')">&times;</button>
          </div>
        `).join('')}
      </div>` : ''}
    `;

    container.innerHTML = `<div class="ms-tabs"><button class="ms-tab active" onclick="MilestonePage.switchTab('monthly')">月里程碑</button><button class="ms-tab" onclick="MilestonePage.switchTab('badges')">成就徽章</button></div><div id="ms-tab-content">${html}</div>`;
    this._bindPhotoUpload(container);
  },

  switchTab(tab) {
    this._activeTab = tab;
    if (tab === 'monthly') return this.reload();
    const content = document.getElementById('ms-tab-content');
    if (content) content.innerHTML = this._badgesHTML();
    document.querySelectorAll('.ms-tab').forEach((el, index) => el.classList.toggle('active', (tab === 'monthly' && index === 0) || (tab === 'badges' && index === 1)));
    this._bindPhotoUpload(content || document);
  },

  _badgesHTML() {
    const badges = (window.BADGE_SYSTEM?.badges || []).filter(b => !b.monthWindow || this._monthAge >= b.monthWindow[0]);
    return `<div class="card"><div class="card-title">成就徽章 <span class="text-muted">已获得${this._unlockedBadges.length}个</span></div><p class="text-muted" style="font-size:12px">照片 + 日期打卡后点亮，过期仍可补打卡。</p><div class="badge-grid">${badges.slice(0, 18).map(b => { const rec = this._unlockedBadges.find(r => r.badgeId === b.id || r.milestoneKey === b.id); return `<button class="badge-card ${rec ? 'unlocked' : ''}" data-badge-id="${Utils.jsAttr(b.id)}" data-badge-name="${Utils.jsAttr(b.name)}"><span class="badge-card-icon">${Utils.escapeHtml(b.icon || '')}</span><strong>${Utils.escapeHtml(b.name)}</strong><small>${rec ? `已点亮 · ${Utils.escapeHtml(rec.date || '')}` : `${b.trigger === 'auto' ? '自动判定' : '照片打卡'}`}</small></button>`; }).join('')}</div></div>`;
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

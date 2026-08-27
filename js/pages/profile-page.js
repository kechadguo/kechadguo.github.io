/**
 * 我的 / 设置页 — 家庭信息 + 数据管理 + 主题 + 字号 + emoji自定义
 */
window.ProfilePage = {
  insurances: [],
  insurancePageOpen: false,
  currentInsuranceId: '',

  async render(container) {
    try {
    const baby = Utils.getBabyInfo();
    if (!this.insurancesLoaded) await this.loadInsurances();
    const auth = Auth.getLocalAuth() || {};
    const aiOff = Utils.storage.get('aiOff');
    const currentTheme = Utils.getTheme();
    const currentTextSize = Utils.getTextSize();
    // R1：v2 通道隐藏 V1 6 色板，改「浅色/深色/自动」三选（ThemeV2.manualTheme）
    const isV2 = !!window.__UI_V3__;
    const v2Manual = (window.ThemeV2 && typeof ThemeV2.settings === 'function')
      ? (ThemeV2.settings().manualTheme || 'auto') : 'auto';
    // R2：长辈模式（seniorMode 持久化 → data-senior 属性 + elder 字号联动）
    const seniorOn = Utils.isSeniorMode ? Utils.isSeniorMode() : !!Utils.storage.get('seniorMode');
    // 长辈模式行内字号变量（collapse-header 标题/描述为 inline style，需 JS 联动渲染）
    // v96 需求 #5：px → rem，使「文字大小」设置在浅色/深色/夜间三种主题下都生效
    const tTitle = seniorOn ? 'font-size:1.5rem;' : 'font-size:1rem;';
    const tDesc = seniorOn ? 'font-size:1rem;' : 'font-size:0.75rem;';
    const tSub = seniorOn ? 'font-size:1.125rem;' : 'font-size:0.875rem;';
    const tHint = seniorOn ? 'font-size:1rem;' : 'font-size:0.75rem;';

    // v67：家庭信息改为异步加载（见 _loadFamilyInfoAsync），网络请求不再阻塞设置页首屏，
    // 避免弱网/网关挂起时页面一直白屏打不开

    // v96 需求 #6：主菜单图标自定义已下线（tabs/emojiPack 配置随之移除）

    let html = `
      <!-- 宝宝信息：头像、月龄、出生数据、徽章进度统一收纳 -->
      <div class="card baby-profile-card">
        ${baby && baby._id ? `
          <div class="bpc-header">
            <img class="bpc-avatar" src="${baby.avatar || 'img/emoji/emoji-happy-animated-128.gif'}" onerror="this.onerror=null;this.src='img/emoji/emoji-happy-animated-128.gif'" alt="宝宝头像">
            <div class="bpc-info"><div class="bpc-name">${Utils.escapeHtml(baby.name) || '宝宝'}</div><div class="bpc-meta"><span>${baby.gender === 'male' ? '男宝' : '女宝'}</span><strong>${Utils.monthAgeText(baby.birthDate)}</strong></div></div>
            ${Auth.isAdmin() ? `<button class="btn-icon" aria-label="修改宝宝信息" onclick="ProfilePage._openBabyEdit()">${Lucide.icon('edit-2', 18)}</button>` : ''}
          </div>
          <div class="bpc-stats"><div class="bpc-stat-item"><div class="bpc-stat-label">出生日期</div><div class="bpc-stat-value">${Utils.formatBirthDateTime(baby.birthDate)}</div></div><div class="bpc-stat-row"><div class="bpc-stat-item"><div class="bpc-stat-label">出生体重</div><div class="bpc-stat-value">${baby.birthWeight ? baby.birthWeight + (baby.birthWeightUnit || 'kg') : '未记录'}</div></div><div class="bpc-stat-item"><div class="bpc-stat-label">出生身高</div><div class="bpc-stat-value">${baby.birthHeight ? baby.birthHeight + (baby.birthHeightUnit || 'cm') : '未记录'}</div></div></div><div id="profile-checkup-latest" class="profile-checkup-latest"><span class="text-muted">最新儿保数据加载中…</span></div></div>
          <div class="bpc-badges"><div class="bpc-badges-header"><span class="bpc-badges-title">${Lucide.icon('award', 14)} 成就徽章</span><span class="bpc-badges-count" id="profile-badge-count">加载中…</span></div><div class="bpc-badges-progress"><div class="bpc-badges-bar"><div class="bpc-badges-fill" id="profile-badge-fill" style="width:0%"></div></div><span class="bpc-badges-percent" id="profile-badge-percent">—</span></div><button class="btn btn-outline btn-sm btn-block" onclick="showPage('milestone')" style="margin-top:12px">${Lucide.icon('trophy', 14)} 查看月里程碑与徽章</button></div>
          <div class="setting-item" style="cursor:pointer;margin-top:10px" onclick="showPage('screening')"><div><div class="setting-label">${Lucide.icon('clipboard-check', 16)} 新生儿筛查</div><div class="setting-desc">听力、遗传代谢、先心病等筛查记录</div></div><span class="text-muted">→</span></div>
        ` : '<p class="text-muted">未创建宝宝档案</p>'}
      </div>

      <div class="insurance-entry-card" role="button" tabindex="0" onclick="ProfilePage.openInsuranceManagement()" onkeydown="if(event.key==='Enter'||event.key===' ') { event.preventDefault(); ProfilePage.openInsuranceManagement(); }">
        ${this._insuranceEntryCard(this.insurances)}
      </div>

      <div class="card feeding-settings-card"><div class="collapse-header" id="collapse-breast-feeding-header" onclick="ProfilePage._toggleCollapse('collapse-breast-feeding')"><div><div style="font-weight:600">${Lucide.icon('heart-pulse', 17)} 喂养设置</div><div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px">亲喂记录与奶量估算</div></div><span class="collapse-arrow">▶</span></div><div class="collapse-body" id="collapse-breast-feeding-body"><div class="breast-settings-inner"><label>估算方式<select class="form-input" onchange="ProfilePage._setBreastEstimateMethod(this.value)"><option value="standard" ${BreastFeeding?.settings?.().estimateMethod !== 'pump' ? 'selected' : ''}>基于月龄标准</option><option value="pump" ${BreastFeeding?.settings?.().estimateMethod === 'pump' ? 'selected' : ''}>基于吸奶参考值</option></select></label><label><input type="checkbox" checked onchange="ProfilePage._setBreastSetting('showDuration', this.checked)"> 默认显示喂养时长</label><label><input type="checkbox" checked onchange="ProfilePage._setBreastSetting('showSide', this.checked)"> 默认显示喂养部位</label><button class="btn btn-outline btn-block" onclick="BreastFeeding.openPumpManager()">管理吸奶测试数据</button><p class="text-muted">亲喂奶量为参考估算值，实际可能存在约20-30%差异。</p></div></div></div>

      <!-- 家庭管理（折叠） — v96 需求 #1：默认折叠（含 v2） -->
      <div class="card">
        <div class="collapse-header" id="collapse-family-header" onclick="ProfilePage._toggleCollapse('collapse-family')">
          <div>
            <div style="${tTitle}font-weight:600">${Lucide.icon('map', 18)} 家庭管理</div>
          </div>
          <span class="collapse-arrow">▶</span>
        </div>
        <div class="collapse-body" id="collapse-family-body">
          <div style="padding:12px 0">
            <!-- 家庭信息 -->
            <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text)">家庭信息</div>
            <div class="card-row"><span class="card-label">家庭名称</span><span class="card-value" id="family-name-value">${Utils.escapeHtml(auth.familyName || '-')}</span></div>
            <div class="card-row"><span class="card-label">昵称</span><span class="card-value">${Utils.escapeHtml(auth.nickname) || '-'}</span></div>
            <div class="card-row" style="cursor:pointer" onclick="App.showInviteCode()">
              <span class="card-label">邀请码</span><span class="card-value text-muted">查看 →</span>
            </div>
            <div class="card-row" style="cursor:pointer" onclick="App.showBindingCode()">
              <span class="card-label">账号绑定码</span><span class="card-value text-muted">查看 →</span>
            </div>

            <!-- 家庭成员（v67 异步加载，网络返回后填充） -->
            <div id="family-members-block">
              <p class="text-muted" style="font-size:12px;padding:8px 0">家庭成员加载中…</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 数据管理（折叠） — v96 需求 #1：默认折叠 -->
      <div class="card">
        <div class="collapse-header" id="collapse-data-header" onclick="ProfilePage._toggleCollapse('collapse-data')">
          <div>
            <div style="${tTitle}font-weight:600">${Lucide.icon('download', 18)} 数据管理</div>
          </div>
          <span class="collapse-arrow">▶</span>
        </div>
        <div class="collapse-body" id="collapse-data-body">
          <div style="padding:12px 0">
            <div class="setting-item" style="cursor:pointer" onclick="App.cloudSync()">
              <div><div class="setting-label">云端同步</div><div class="setting-desc">手动同步最新数据</div></div>
              <span class="text-muted">→</span>
            </div>
            <div class="setting-item" style="cursor:pointer" onclick="App.exportData()">
              <div><div class="setting-label">导出数据</div><div class="setting-desc">导出每日汇总CSV</div></div>
              <span class="text-muted">→</span>
            </div>
            <div class="setting-item" style="cursor:pointer" onclick="App.importData()">
              <div><div class="setting-label">导入数据</div><div class="setting-desc">从CSV导入（含模板下载）</div></div>
              <span class="text-muted">→</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 自定义主题（折叠下拉） — v96 需求 #1：默认折叠 -->
      <div class="card">
        <div class="collapse-header" id="collapse-theme-header" onclick="ProfilePage._toggleCollapse('collapse-theme')">
          <div>
            <div style="${tTitle}font-weight:600">${Lucide.icon('settings', 18)} 自定义主题</div>
            <div style="${tDesc}color:var(--text-secondary);margin-top:2px">主题颜色 · 文字大小</div>
          </div>
          <span class="collapse-arrow">▶</span>
        </div>
        <div class="collapse-body" id="collapse-theme-body">
          <div style="padding:12px 0">
            <!-- v96 需求 #2/#3：界面版本开关已下线——全量强制 V2，该行不再展示 -->

            ${isV2 ? `
            <!-- R2：长辈模式开关（v2 专属；写入 seniorMode + html[data-senior] + elder 字号） -->
            <div class="setting-item" style="margin-bottom:12px">
              <div>
                <div class="setting-label">${Lucide.icon('star', 16)} 长辈模式</div>
                <div class="setting-desc">更大文字与按钮 · 语音记录放大固定</div>
              </div>
              <label class="switch">
                <input type="checkbox" ${seniorOn ? 'checked' : ''} onchange="ProfilePage._setSeniorMode(this.checked)">
                <span class="slider"></span>
              </label>
            </div>
            ` : ''}

            <div style="${tSub}font-weight:600;margin-bottom:8px;color:var(--text)">${isV2 ? '外观模式' : '主题颜色'}</div>
            ${isV2 ? `
              <div class="theme-v2-grid">
                <div class="theme-v2-opt ${v2Manual === 'light' ? 'active' : ''}" onclick="ProfilePage._setV2Theme('light', this)">浅色</div>
                <div class="theme-v2-opt ${v2Manual === 'dark' ? 'active' : ''}" onclick="ProfilePage._setV2Theme('dark', this)">${Lucide.icon('moon', 14)} 深色</div>
                <div class="theme-v2-opt ${v2Manual === 'auto' ? 'active' : ''}" onclick="ProfilePage._setV2Theme('auto', this)">${Lucide.icon('clock', 14)} 自动</div>
              </div>
              <p style="${tHint}color:var(--text-secondary);margin-top:6px;line-height:1.6">自动：22:00–06:00 进入夜间模式；夜间手动切浅色，10 分钟后自动恢复</p>
            ` : `
              <div class="theme-color-grid">
                ${APP_CONFIG.themeColors.map(t => `
                  <div class="theme-color-swatch ${t.key === currentTheme ? 'active' : ''}"
                    style="background:${t.primary}" onclick="App.applyTheme('${t.key}')">
                    ${t.key === currentTheme ? Lucide.icon('check', 16) : ''}
                  </div>
                `).join('')}
              </div>
            `}

            <div style="${tSub}font-weight:600;margin:16px 0 8px;color:var(--text)">文字大小</div>
            <div class="text-size-grid">
              ${APP_CONFIG.textSizes.map(s => `
                <div class="text-size-btn ${s.key === currentTextSize ? 'active' : ''}"
                  data-key="${s.key}"
                  style="font-size:${s.baseFont}" onclick="ProfilePage._setTextSize('${s.key}', this)">
                  ${s.label}<span style="font-size:11px;display:block;margin-top:2px">Aa</span>
                </div>
              `).join('')}
            </div>
            <!-- v96 需求 #6：主菜单图标（宝宝拟我头像自定义）功能已下线 -->
          </div>
        </div>
      </div>

      <!-- 其他设置（折叠，v70 仅管理员可见；含操作日志子菜单） — v96 需求 #1：默认折叠 -->
      ${Auth.isAdmin() ? `
      <div class="card">
        <div class="collapse-header" id="collapse-settings-header" onclick="ProfilePage._toggleCollapse('collapse-settings')">
          <div>
            <div style="${tTitle}font-weight:600">${Lucide.icon('settings', 18)} 其他设置</div>
            <div style="${tDesc}color:var(--text-secondary);margin-top:2px">仅管理员可见 · AI 识别 · 推送 · 操作日志</div>
          </div>
          <span class="collapse-arrow">▶</span>
        </div>
        <div class="collapse-body" id="collapse-settings-body">
          <div style="padding:12px 0">
            ${window.__UI_V3__ ? `
            <div class="ai-switch-card ai-off" role="status">
              <div class="ai-card-main">
                <div class="ai-card-title">${Lucide.icon('camera-off', 16)} 拍照识别</div>
                <div class="ai-card-desc">AI功能暂未启用 · 可手动选色/性状</div>
              </div>
              <span class="ai-disabled-label">AI功能暂未启用</span>
            </div>` : `
            <div class="setting-item">
              <div>
                <div class="setting-label">拍照 AI 识别</div>
                <div class="setting-desc">排便拍照自动识别性状</div>
              </div>
              <label class="switch">
                <input type="checkbox" ${!aiOff ? 'checked' : ''} onchange="App.toggleAI(this.checked)">
                <span class="slider"></span>
              </label>
            </div>`}
            <div class="setting-item">
              <div>
                <div class="setting-label">PushPlus 推送</div>
                <div class="setting-desc">日报/周报/月报推送管理</div>
              </div>
              <button class="btn btn-outline" style="font-size:12px;padding:6px 12px" onclick="App.showPushManagement()">管理</button>
            </div>

            <!-- 操作日志（v70 移入其他设置子菜单，仅管理员可见） -->
            <div class="setting-item" id="collapse-audit-header" style="cursor:pointer" onclick="ProfilePage._toggleAudit()">
              <div>
                <div class="setting-label">${Lucide.icon('clipboard-list', 16)} 操作日志</div>
                <div class="setting-desc">谁 · 何时 · 做了什么 · 记录后自动推送微信</div>
              </div>
              <span class="collapse-arrow">▶</span>
            </div>
            <div class="collapse-body" id="collapse-audit-body">
              <div style="padding:8px 0 4px">
                <div class="setting-item" style="cursor:pointer" onclick="ProfilePage._showPushRange()">
                  <div><div class="setting-label">${Lucide.icon('share', 16)} 推送范围</div><div class="setting-desc">每次记录自动推微信 · 选择接收成员</div></div>
                  <span class="text-muted">→</span>
                </div>
                <div class="setting-item" style="cursor:pointer" onclick="ProfilePage._pushAuditLog()">
                  <div><div class="setting-label">${Lucide.icon('share', 16)} 推送最近 20 条</div><div class="setting-desc">补看历史：手动推送日志表格到微信</div></div>
                  <span class="text-muted">→</span>
                </div>
                <div id="audit-list" style="min-height:40px">
                  <p class="text-muted" style="font-size:12px;padding:8px 0">展开后加载最近日志…</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- 切换/退出家庭 -->
      <button class="btn btn-outline btn-block" style="margin-top:12px;color:var(--danger);border-color:var(--danger)" onclick="App.switchFamily()">${Lucide.icon('repeat', 18)} 切换/退出家庭</button>

      <div class="disclaimer">${APP_CONFIG.disclaimer}</div>
    `;

    container.innerHTML = html;
    // v67：家庭信息异步填充（失败/超时不阻塞设置页）
    this._loadFamilyInfoAsync();
    this._loadBadgeCountAsync();
    this._loadLatestCheckupAsync();
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">${Lucide.icon('settings', 32)}</div><p>加载设置失败</p><p class="text-muted" style="font-size:12px">${Utils.escapeHtml(e.message)}</p><button class="btn btn-primary mt-16" onclick="showPage('profile')">重试</button></div>`;
    }
  },

  async _loadBadgeCountAsync() {
    const el = document.getElementById('profile-badge-count');
    if (!el || !API.listMilestone) return;
    const data = await API.listMilestone().catch(() => ({ records: [] }));
    const unlocked = (data.records || []).filter(r => r.badgeId || r.photoUrl).length;
    const total = (window.BADGE_SYSTEM?.badges?.length || 0) + Object.keys(window.BADGE_SYSTEM?.collections || {}).length;
    const progress = total ? Math.round(unlocked / total * 100) : 0;
    el.textContent = `${unlocked}/${total || '—'} 个`;
    const fill = document.getElementById('profile-badge-fill');
    const percent = document.getElementById('profile-badge-percent');
    if (fill) fill.style.width = `${Math.min(100, progress)}%`;
    if (percent) percent.textContent = `${progress}%`;
  },

  async _loadLatestCheckupAsync() {
    const el = document.getElementById('profile-checkup-latest'); if (!el || !API.listCheckups) return;
    const result = await API.listCheckups().catch(() => ({ records: [] })); const r = (result.records || [])[0];
    el.innerHTML = r ? `<div class="bpc-stat-label">最新儿保数据 · ${r.checkDate}</div><div class="bpc-stat-value">体重 ${r.weight}g · 身高 ${r.height}cm${r.headCircumference ? ` · 头围 ${r.headCircumference}cm` : ''}</div>` : '<div class="bpc-stat-label">最新儿保数据</div><div class="bpc-stat-value">暂无儿保记录</div>';
  },

  /** v67：异步加载家庭信息并填充（家庭名称 + 成员列表），不阻塞设置页首屏 */
  async _loadFamilyInfoAsync() {
    let familyInfo = null;
    try { familyInfo = await API.getFamilyInfo().catch(() => null); } catch {}
    const nameEl = document.getElementById('family-name-value');
    if (nameEl && familyInfo) {
      const name = (familyInfo.family && familyInfo.family.name) || familyInfo.familyName;
      if (name) nameEl.textContent = name;
    }
    const block = document.getElementById('family-members-block');
    if (!block) return;
    if (!familyInfo) {
      block.innerHTML = '<p class="text-muted" style="font-size:12px;padding:8px 0">家庭信息加载失败，可稍后手动同步</p>';
      return;
    }
    const members = familyInfo.members || [];
    const auth = Auth.getLocalAuth() || {};
    // v69：渲染前去重（后端已按 _id 去重，此处双保险，防历史脏数据直接展示）
    const seen = new Set();
    const dedupMembers = members.filter(m => {
      if (!m || !m.memberId || seen.has(m.memberId)) return false;
      seen.add(m.memberId);
      return true;
    });
    if (!dedupMembers.length) {
      block.innerHTML = '<p class="text-muted" style="font-size:12px;padding:8px 0">暂无家庭成员</p>';
      return;
    }
    block.innerHTML = `
      <div style="font-size:13px;font-weight:600;margin:16px 0 8px;color:var(--text)">家庭成员</div>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">${Auth.isAdmin() ? '管理员可修改角色、移出成员' : '仅查看成员信息'}</p>
      ${dedupMembers.map(m => {
        const isMe = m.memberId === auth.memberId;
        const roleLabel = m.role === 'admin' ? `${Lucide.icon('star', 14)} 管理员` : '普通成员';
        return `
        <div class="member-role-row">
          <span class="mr-name">${Utils.escapeHtml(m.nickname) || '未命名'} ${isMe ? '<span style="font-size:10px;color:var(--primary)">(我)</span>' : ''}</span>
          ${Auth.isAdmin() && !isMe
            ? `<span style="display:flex;align-items:center;gap:8px">
                <select class="mr-role-select" onchange="ProfilePage._updateMemberRole('${m.memberId}', this.value)">
                  <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>管理员</option>
                  <option value="member" ${m.role === 'member' ? 'selected' : ''}>普通成员</option>
                </select>
                <button class="btn btn-outline" style="font-size:12px;padding:4px 10px;color:var(--danger);border-color:var(--danger)" onclick="ProfilePage._removeMember('${m.memberId}')">移出</button>
              </span>`
            : `<span class="text-muted" style="font-size:13px">${roleLabel}</span>`
          }
        </div>
        `;
      }).join('')}`;
    // v97 需求：界面版本灰度控制块已下线（全量 v2，云端 rollback 应急通道仍保留在 utils.js applyCloudUIversion）
  },

  // ===== 保险管理 =====
  async loadInsurances() {
    if (!window.API || !API.listInsurances || !Auth.getBabyId || !Auth.getBabyId()) {
      this.insurances = [];
      return this.insurances;
    }
    try {
      const result = await API.listInsurances();
      this.insurances = Array.isArray(result) ? result : (result?.records || []);
      this.insurancesLoaded = true;
    } catch (e) {
      console.warn('[Insurance] 加载失败:', e.message);
      this.insurances = [];
      this.insurancesLoaded = true;
    }
    return this.insurances;
  },

  _insuranceEntryCard(insurances) {
    const list = Array.isArray(insurances) ? insurances : [];
    const activeCount = list.filter(ins => this._isActive(ins)).length;
    const totalCoverage = this._calcTotalCoverage(list);
    const expiringSoon = list.filter(ins => {
      const days = this._calcDaysUntilExpire(ins.endDate);
      return days > 0 && days <= 60;
    });
    return `<div class="insurance-entry-header"><div class="entry-title"><span class="entry-icon">${Lucide.icon('shield-check', 20)}</span><span>保险管理</span></div><div class="entry-arrow">›</div></div>${list.length === 0 ? `<div class="entry-empty"><span class="empty-hint">还未添加保险信息</span></div>` : `<div class="entry-summary"><div class="summary-item"><span class="summary-label">在保数量</span><span class="summary-value">${activeCount}份</span></div><div class="summary-item"><span class="summary-label">总保额</span><span class="summary-value highlight">${totalCoverage}</span></div>${expiringSoon.length ? `<div class="summary-alert"> ${expiringSoon.length}份保险即将到期</div>` : ''}</div>`}`;
  },

  _isActive(ins) {
    if (!ins || !ins.endDate) return true;
    const end = new Date(`${String(ins.endDate).slice(0, 10)}T23:59:59`);
    return end.getTime() >= Date.now();
  },

  _calcTotalCoverage(insurances) {
    const total = (insurances || []).reduce((sum, ins) => {
      const value = ins.coverageAmount != null ? Number(ins.coverageAmount) : parseFloat(String(ins.coverage || '').replace(/[^0-9.]/g, ''));
      return sum + (isFinite(value) ? value : 0);
    }, 0);
    return total > 0 ? `${Number(total.toFixed(2))}万` : '-';
  },

  _calcAnnualPremium(insurances) {
    const total = (insurances || []).reduce((sum, ins) => {
      const value = Number(ins.premium);
      if (!isFinite(value)) return sum;
      return sum + (ins.paymentFreq === '月' ? value * 12 : ins.paymentFreq === '季' ? value * 4 : value);
    }, 0);
    return total > 0 ? `${Math.round(total)}元` : '-';
  },

  _calcDaysUntilExpire(endDate) {
    if (!endDate) return -1;
    const end = new Date(`${String(endDate).slice(0, 10)}T23:59:59`);
    return Math.ceil((end.getTime() - Date.now()) / 86400000);
  },

  _getInsuranceStatus(ins) {
    if (!ins.endDate) return { text: '有效', className: 'active', icon: '' };
    const days = this._calcDaysUntilExpire(ins.endDate);
    if (days < 0) return { text: '已过期', className: 'expired', icon: '' };
    if (days <= 60) return { text: `${days}天后到期`, className: 'expiring', icon: '' };
    return { text: '有效', className: 'active', icon: '' };
  },

  _getCategoryIcon(category) {
    return ({ '社保医保': '', '重疾险': '', '医疗险': '', '意外险': '', '教育金': '', '其他': '' }[category] || '');
  },

  openInsuranceManagement() { this.showInsurancePage(); },

  showInsurancePage() {
    if (document.getElementById('insurancePage')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="insurance-page" id="insurancePage"><div class="insurance-page-header"><button class="insurance-back-btn" aria-label="返回设置" onclick="ProfilePage.closeInsurancePage()">‹</button><h2>保险管理</h2><button class="insurance-add-btn" aria-label="添加保险" onclick="ProfilePage.addInsurance()">+</button></div><div class="insurance-page-content" id="insuranceContent">${this._renderInsuranceContent()}</div></div>`);
  },

  _renderInsuranceContent() {
    const list = this.insurances || [];
    return list.length ? `${this._insuranceSummaryCard(list)}${this._insuranceList(list)}` : this._insuranceEmptyState();
  },

  _insuranceEmptyState() {
    return `<div class="insurance-empty"><div class="insurance-empty-icon">${Lucide.icon('shield', 52)}</div><div class="insurance-empty-title">还没有保险记录</div><div class="insurance-empty-desc">建议为宝宝配置：<br>少儿医保、重疾险、医疗险、意外险</div><button class="btn btn-primary" onclick="ProfilePage.addInsurance()">添加第一份保险</button></div>`;
  },

  _insuranceSummaryCard(insurances) {
    return `<div class="insurance-summary-card"><div class="summary-title">保障总览</div><div class="summary-grid"><div><div class="grid-value">${insurances.filter(i => this._isActive(i)).length}</div><div class="grid-label">在保数量</div></div><div><div class="grid-value">${this._calcTotalCoverage(insurances)}</div><div class="grid-label">总保额</div></div><div><div class="grid-value">${this._calcAnnualPremium(insurances)}</div><div class="grid-label">年缴保费</div></div></div></div>`;
  },

  _insuranceList(insurances) {
    const categories = ['社保医保', '重疾险', '医疗险', '意外险', '教育金', '其他'];
    return `<div class="insurance-list">${categories.map(category => { const items = insurances.filter(i => (i.category || '其他') === category); if (!items.length) return ''; return `<section class="insurance-group"><div class="group-header"><span class="group-icon">${this._getCategoryIcon(category)}</span><span class="group-name">${category}</span><span class="group-count">${items.length}</span></div>${items.map(i => this._renderInsuranceItem(i)).join('')}</section>`; }).join('')}</div>`;
  },

  _renderInsuranceItem(ins) {
    const status = this._getInsuranceStatus(ins);
    const days = this._calcDaysUntilExpire(ins.endDate);
    return `<article class="insurance-item"><div class="item-header"><div class="item-name">${Utils.escapeHtml(ins.name || '')}</div><div class="item-status ${status.className}">${status.icon} ${status.text}</div></div><div class="item-info"><div class="info-line"><span class="info-label">保险公司</span><span class="info-value">${Utils.escapeHtml(ins.company || '')}</span></div>${ins.policyNumber ? `<div class="info-line"><span class="info-label">保单号</span><span class="info-value">${Utils.escapeHtml(ins.policyNumber)}</span></div>` : ''}<div class="info-line"><span class="info-label">保障期限</span><span class="info-value">${Utils.escapeHtml(ins.startDate || '')} 至 ${ins.endDate ? Utils.escapeHtml(ins.endDate) : '终身'}</span></div>${ins.coverage ? `<div class="info-line highlight"><span class="info-label">保额</span><span class="info-value strong">${Utils.escapeHtml(ins.coverage)}</span></div>` : ''}${ins.premium != null ? `<div class="info-line"><span class="info-label">保费</span><span class="info-value">${Utils.escapeHtml(ins.premium)}元 / ${Utils.escapeHtml(ins.paymentFreq || '年')}</span></div>` : ''}${ins.note ? `<div class="info-line full"><span class="info-label">备注</span><span class="info-value">${Utils.escapeHtml(ins.note)}</span></div>` : ''}</div>${days > 0 && days <= 60 ? `<div class="item-alert"> ${days}天后到期，请及时续保</div>` : ''}<div class="item-actions"><button class="action-btn" onclick="event.stopPropagation();ProfilePage.editInsurance('${Utils.jsAttr(ins._id)}')">编辑</button><button class="action-btn danger" onclick="event.stopPropagation();ProfilePage.deleteInsurance('${Utils.jsAttr(ins._id)}')">删除</button></div></article>`;
  },

  _insuranceCategories() { return [{ value: '社保医保', icon: '', desc: '城乡居民医保' }, { value: '重疾险', icon: '', desc: '重大疾病保险' }, { value: '医疗险', icon: '', desc: '百万医疗' }, { value: '意外险', icon: '', desc: '意外伤害' }, { value: '教育金', icon: '', desc: '教育年金' }, { value: '其他', icon: '', desc: '其他保险' }]; },
  _getCommonInsurances(category) { return ({ '社保医保': ['城乡居民医保', '少儿医保', '新生儿医保'], '重疾险': ['妈咪保贝', '大黄蜂', '青云卫', '小淘气', '慧馨安'], '医疗险': ['平安e生保', '好医保', '尊享e生', '小医仙', '门诊险'], '意外险': ['小神童', '小顽童', '大保镖', '萌宝保'], '教育金': ['年金险', '增额终身寿', '教育储蓄'], '其他': [] }[category] || []); },

  addInsurance(presetCategory = '', record = null) {
    this.currentInsuranceId = record?._id || '';
    this.currentCategory = record?.category || presetCategory || '';
    const today = new Date().toISOString().slice(0, 10);
    const categories = this._insuranceCategories();
    const common = this._getCommonInsurances(this.currentCategory);
    const value = (key, fallback = '') => Utils.escapeHtml(record?.[key] == null ? fallback : record[key]);
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay insurance-modal-overlay" id="insuranceModal" onclick="if(event.target===this)this.remove()"><div class="modal-content insurance-modal" onclick="event.stopPropagation()"><div class="modal-header"><h3>${record ? '编辑保险' : '添加保险'}</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button></div><div class="modal-body"><div class="form-section"><label class="form-label required">保险类型</label><div class="category-grid" id="insuranceCategoryGrid">${categories.map(c => `<button type="button" class="category-card ${this.currentCategory === c.value ? 'selected' : ''}" data-category="${c.value}" onclick="ProfilePage.selectInsuranceCategory('${c.value}')"><span class="category-card-icon">${c.icon}</span><span class="category-card-name">${c.value}</span><span class="category-card-desc">${c.desc}</span></button>`).join('')}</div></div><div class="form-section"><label class="form-label required">保险名称</label><div class="quick-buttons" id="insuranceNameQuick">${common.map(n => `<button type="button" class="quick-btn" onclick="ProfilePage.selectInsuranceName('${n}')">${n}</button>`).join('')}</div><input id="insuranceName" class="form-input" value="${value('name')}" placeholder="或手动输入保险名称"></div><div class="form-section"><label class="form-label required">保险公司</label><div id="insuranceCompanyQuick" class="quick-buttons"></div><input id="insuranceCompany" class="form-input" value="${value('company')}" placeholder="输入保险公司名称"></div><div class="form-section"><label class="form-label">保单号</label><input id="insurancePolicyNumber" class="form-input" value="${value('policyNumber')}" placeholder="可选"></div><div class="form-divider">保障信息</div><div class="form-row"><label class="form-col form-label required">生效日期<input type="date" id="insuranceStartDate" class="form-input" value="${value('startDate', today)}"></label><label class="form-col form-label">到期日期<input type="date" id="insuranceEndDate" class="form-input" value="${value('endDate')}"><span class="lifetime-label"><input type="checkbox" id="insuranceLifetime" ${record && !record.endDate ? 'checked' : ''} onchange="ProfilePage.toggleInsuranceLifetime(this)"> 终身</span></label></div><div class="form-section" id="insuranceCoverageSection"><label class="form-label">保额（万元）</label><div class="coverage-options">${[10, 30, 50, 100, 300].map(n => `<button type="button" class="coverage-option" onclick="ProfilePage.selectInsuranceCoverage('${n}')">${n}万</button>`).join('')}</div><input type="number" id="insuranceCoverage" class="form-input" value="${value('coverageAmount', String(record?.coverage || '').replace(/[^0-9.]/g, ''))}" placeholder="或输入金额"></div><div class="form-row"><label class="form-col form-label">保费<input type="number" id="insurancePremium" class="form-input" value="${value('premium')}" placeholder="金额（元）"></label><label class="form-col form-label">缴费周期<select id="insurancePaymentFreq" class="form-input">${['年','月','季','一次性'].map(x => `<option ${x === (record?.paymentFreq || '年') ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div><div class="form-section"><label class="form-label">备注</label><textarea id="insuranceNote" class="form-textarea" rows="3" placeholder="保障范围、特殊条款等">${value('note')}</textarea></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button><button class="btn btn-primary" onclick="ProfilePage.saveInsurance()">保存</button></div></div></div>`);
    this._loadInsuranceCompanyHistory();
    if (this.currentCategory) this.selectInsuranceCategory(this.currentCategory);
  },

  selectInsuranceCategory(category) {
    this.currentCategory = category;
    document.querySelectorAll('#insuranceCategoryGrid .category-card').forEach(el => el.classList.toggle('selected', el.dataset.category === category));
    const quick = document.getElementById('insuranceNameQuick');
    if (quick) quick.innerHTML = this._getCommonInsurances(category).map(n => `<button type="button" class="quick-btn" onclick="ProfilePage.selectInsuranceName('${n}')">${n}</button>`).join('');
    const coverage = document.getElementById('insuranceCoverageSection');
    if (coverage) coverage.style.display = category === '社保医保' ? 'none' : '';
  },
  selectInsuranceName(name) { const el = document.getElementById('insuranceName'); if (el) el.value = name; },
  selectInsuranceCompany(company) { const el = document.getElementById('insuranceCompany'); if (el) el.value = company; },
  selectInsuranceCoverage(amount) { const el = document.getElementById('insuranceCoverage'); if (el) el.value = amount; },
  toggleInsuranceLifetime(checkbox) { const el = document.getElementById('insuranceEndDate'); if (el) { el.disabled = checkbox.checked; if (checkbox.checked) el.value = ''; } },
  _loadInsuranceCompanyHistory() { try { const history = JSON.parse(localStorage.getItem('insuranceCompanyHistory') || '[]'); const el = document.getElementById('insuranceCompanyQuick'); if (el) el.innerHTML = history.map(c => `<button type="button" class="quick-btn" onclick="ProfilePage.selectInsuranceCompany('${Utils.jsAttr(c)}')">${Utils.escapeHtml(c)}</button>`).join(''); } catch (e) {} },
  _saveInsuranceCompanyHistory(company) { try { let history = JSON.parse(localStorage.getItem('insuranceCompanyHistory') || '[]').filter(x => x !== company); history.unshift(company); localStorage.setItem('insuranceCompanyHistory', JSON.stringify(history.slice(0, 5))); } catch (e) {} },

  async saveInsurance() {
    const get = id => document.getElementById(id);
    const category = this.currentCategory;
    const name = get('insuranceName')?.value.trim(); const company = get('insuranceCompany')?.value.trim();
    const startDate = get('insuranceStartDate')?.value; const lifetime = !!get('insuranceLifetime')?.checked; const endDate = lifetime ? null : (get('insuranceEndDate')?.value || null);
    if (!category || !name || !company || !startDate) return Utils.showToast('请填写保险类型、名称、公司和生效日期');
    if (endDate && endDate < startDate) return Utils.showToast('到期日期不能早于生效日期');
    const record = { category, name, company, policyNumber: get('insurancePolicyNumber')?.value.trim() || '', startDate, endDate, coverageAmount: get('insuranceCoverage')?.value || null, premium: get('insurancePremium')?.value || null, paymentFreq: get('insurancePaymentFreq')?.value || '年', note: get('insuranceNote')?.value.trim() || '' };
    try { if (this.currentInsuranceId) await API.updateInsurance(this.currentInsuranceId, record); else await API.addInsurance(record); this._saveInsuranceCompanyHistory(company); document.getElementById('insuranceModal')?.remove(); Utils.showToast('保险信息已保存'); await this.loadInsurances(); this.refreshInsurancePage(); } catch (e) { Utils.showToast('保存失败：' + (e.message || '请稍后重试')); }
  },
  editInsurance(id) { const record = (this.insurances || []).find(i => i._id === id); if (record) this.addInsurance('', record); },
  async deleteInsurance(id) { if (!confirm('确定删除这条保险记录吗？')) return; try { await API.deleteInsurance(id); Utils.showToast('删除成功'); await this.loadInsurances(); this.refreshInsurancePage(); } catch (e) { Utils.showToast('删除失败：' + (e.message || '请稍后重试')); } },
  refreshInsurancePage() { const el = document.getElementById('insuranceContent'); if (el) el.innerHTML = this._renderInsuranceContent(); },
  closeInsurancePage() { document.getElementById('insurancePage')?.remove(); this.insurancePageOpen = false; showPage('profile'); },

  _setBreastEstimateMethod(method) { if (window.BreastFeeding) BreastFeeding.saveSettings({ estimateMethod: method }); },
  _setBreastSetting(key, value) { if (window.BreastFeeding) BreastFeeding.saveSettings({ [key]: value }); },

  _toggleCollapse(id) {
    const header = document.getElementById(id + '-header');
    const body = document.getElementById(id + '-body');
    if (!header || !body) return;
    const isOpen = body.classList.toggle('open');
    header.classList.toggle('open', isOpen);
    header.querySelector('.collapse-arrow').textContent = isOpen ? '▼' : '▶';
  },

  /** R1：v2 外观三选（浅色/深色/自动）。调用 ThemeV2.setManualTheme 后即时高亮 */
  _setV2Theme(key, el) {
    if (window.ThemeV2 && typeof ThemeV2.setManualTheme === 'function') {
      ThemeV2.setManualTheme(key);
    }
    const grid = el.closest('.theme-v2-grid');
    if (grid) {
      grid.querySelectorAll('.theme-v2-opt').forEach(o => o.classList.toggle('active', o === el));
    }
    if (Utils && typeof Utils.showToast === 'function') {
      Utils.showToast(key === 'light'
        ? '已切换浅色' + (ThemeV2.isNightTime() ? '（夜间模式 10 分钟后自动恢复）' : '')
        : key === 'dark' ? '已切换深色' : '已恢复自动（22:00-06:00 自动夜间）');
    }
  },

  /** R2：长辈模式开关。Utils.applySeniorMode 持久化 + 属性 + elder 字号，随后重渲染设置页 */
  _setSeniorMode(on) {
    Utils.applySeniorMode(on);
    Utils.showToast(on ? '长辈模式已开启' : '长辈模式已关闭');
    showPage('profile');
  },

  /** R2：字号选择即时高亮（elder 档在长辈模式下推荐，普通模式也可手动选） */
  _setTextSize(key, el) {
    App.applyTextSize(key);
    $$('.text-size-btn').forEach(b => b.classList.toggle('active', b === el));
  },

  // ===== 操作日志（v67） =====
  _ACTION_LABELS: {
    'feeding.create': '新增喂养', 'feeding.update': '修改喂养', 'feeding.delete': '删除喂养',
    'stool.create': '新增排便', 'stool.update': '修改排便', 'stool.delete': '删除排便',
    'sleep.create': '新增睡眠', 'sleep.delete': '删除睡眠',
    'growth.create': '新增成长', 'growth.delete': '删除成长',
    'health.create': '新增健康记录', 'health.delete': '删除健康记录', 'health.saveMood': '记录心情',
    'milestone.create': '新增里程碑', 'milestone.delete': '删除里程碑',
    'todo.create': '新增待办', 'todo.update': '修改待办', 'todo.complete': '完成待办',
    'todo.uncomplete': '重开待办', 'todo.delete': '删除待办',
    'clean.create': '新增清洁', 'clean.delete': '删除清洁',
    'footprint.create': '新增足迹', 'footprint.update': '修改足迹', 'footprint.delete': '删除足迹',
    'vaccine.save': '更新疫苗',
    'baby.create': '创建宝宝档案', 'baby.update': '修改宝宝信息',
    'family.join': '加入家庭', 'family.refreshCode': '刷新邀请码', 'family.updateMemberRole': '调整成员角色', 'family.removeMember': '移出成员',
    'family.saveDashboardSettings': '更新首页设置',
    'auth.generateBindingCode': '生成账号绑定码', 'auth.bindAccount': '绑定账号'
  },

  _toggleAudit() {
    this._toggleCollapse('collapse-audit');
    const body = document.getElementById('collapse-audit-body');
    if (body && body.classList.contains('open') && !this._auditLoaded) {
      this._auditLoaded = true;
      this._loadAuditLogs(false);
    }
  },

  async _loadAuditLogs(append) {
    const listEl = document.getElementById('audit-list');
    if (!listEl) return;
    if (this._auditLoading) return;
    this._auditLoading = true;
    if (!append) listEl.innerHTML = '<p class="text-muted" style="font-size:12px;padding:8px 0">加载中…</p>';
    const page = (this._auditPage || 0) + 1;
    try {
      const res = await API.listAuditLogs(page, 20);
      this._auditPage = page;
      const records = (res && res.records) || [];
      this._auditHasMore = (page * 20) < (res && res.total || 0);
      const itemsHtml = records.map(r => this._auditItemHtml(r)).join('');
      if (append) {
        listEl.insertAdjacentHTML('beforeend', itemsHtml);
        const moreBtn = document.getElementById('audit-more-btn');
        if (moreBtn) {
          if (this._auditHasMore) moreBtn.style.display = '';
          else moreBtn.remove();
        }
      } else {
        listEl.innerHTML = records.length
          ? itemsHtml + (this._auditHasMore
              ? '<button class="btn btn-outline btn-block" id="audit-more-btn" style="margin-top:8px;font-size:12px" onclick="ProfilePage._loadAuditLogs(true)">加载更多</button>'
              : '<p class="text-muted" style="font-size:12px;padding:8px 0">— 共 ' + res.total + ' 条 —</p>')
          : '<p class="text-muted" style="font-size:12px;padding:8px 0">暂无操作日志</p>';
      }
    } catch (e) {
      listEl.innerHTML = '<p class="text-muted" style="font-size:12px;padding:8px 0">日志加载失败：' + Utils.escapeHtml(e.message) + '</p>';
    } finally {
      this._auditLoading = false;
    }
  },

  _auditItemHtml(r) {
    const d = new Date(r.createdAt);
    const now = new Date();
    const time = !isNaN(d.getTime())
      ? Utils.formatDate(d, (d.getFullYear() === now.getFullYear() ? 'MM-DD' : 'YYYY-MM-DD') + ' HH:mm')
      : '';
    const label = this._ACTION_LABELS[r.action] || (r.action || '操作');
    const detail = r.detail ? `<div class="audit-detail">${Utils.escapeHtml(r.detail)}</div>` : '';
    return `
      <div class="audit-item">
        <div class="audit-row">
          <span class="audit-time">${time}</span>
          <span class="audit-user">${Utils.escapeHtml(r.nickname || '家庭成员')}</span>
        </div>
        <div class="audit-label">${Utils.escapeHtml(label)}${detail}</div>
      </div>`;
  },

  async _pushAuditLog() {
    Utils.showLoading('推送中...');
    try {
      const res = await API.pushAuditLogs();
      Utils.hideLoading();
      if (res && res.pushed) Utils.showToast('已推送到微信');
      else Utils.showToast((res && res.msg) || (res && res.pushError ? '推送失败: ' + res.pushError : '暂无日志可推送'));
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('推送失败: ' + e.message);
    }
  },

  // ===== 推送范围（v67 自动推送配置） =====
  async _showPushRange() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'push-range-modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:380px;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <div style="font-size:16px;font-weight:600">${Lucide.icon('share', 18)} 推送范围</div>
          <button class="modal-close" onclick="document.getElementById('push-range-modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">每次记录成功后，自动推送给「已绑定 PushPlus 且开关开启」的成员微信。全开=推全家；关闭某些成员=只推部分。</p>
          <div id="push-range-list" style="min-height:40px">
            <p class="text-muted" style="font-size:12px;padding:8px 0">加载中…</p>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    this._loadPushSettings();
  },

  async _loadPushSettings() {
    const listEl = document.getElementById('push-range-list');
    if (!listEl) return;
    try {
      const res = await API.listPushSettings();
      const members = (res && res.members) || [];
      if (!members.length) {
        listEl.innerHTML = '<p class="text-muted" style="font-size:12px;padding:8px 0">暂无家庭成员</p>';
        return;
      }
      listEl.innerHTML = members.map(m => {
        const bound = m.pushBound;
        const checked = m.auditPush && bound;
        return `
          <div class="setting-item" style="padding:8px 0">
            <div>
              <div class="setting-label">${Utils.escapeHtml(m.nickname)}${m.role === 'admin' ? ' <span style="font-size:11px;color:var(--primary)">管理员</span>' : ''}</div>
              <div class="setting-desc">${bound ? '已绑定 PushPlus' : '<span style="color:var(--danger)">未绑定 PushPlus（先到 PushPlus 推送-管理绑定）</span>'}</div>
            </div>
            <label class="switch" style="${bound ? '' : 'opacity:.35;pointer-events:none'}">
              <input type="checkbox" ${checked ? 'checked' : ''} onchange="ProfilePage._toggleMemberAuditPush('${m.memberId}', this.checked, this)">
              <span class="slider"></span>
            </label>
          </div>`;
      }).join('');
    } catch (e) {
      listEl.innerHTML = '<p class="text-muted" style="font-size:12px;padding:8px 0">加载失败：' + Utils.escapeHtml(e.message) + '</p>';
    }
  },

  async _toggleMemberAuditPush(memberId, checked, el) {
    el.disabled = true;
    try {
      const res = await API.updatePushSettings(memberId, !!checked);
      if (res && res.auditPush !== undefined) Utils.showToast(checked ? '已开启该成员接收' : '已关闭该成员接收');
      else Utils.showToast((res && res.msg) || '更新失败');
    } catch (e) {
      el.checked = !checked;
      Utils.showToast('更新失败: ' + e.message);
    } finally {
      el.disabled = false;
    }
  },

  async _updateMemberRole(targetMemberId, newRole) {
    Utils.showLoading('更新中...');
    try {
      const res = await API.updateMemberRole(targetMemberId, newRole);
      Utils.hideLoading();
      Utils.showToast('角色已更新');
      if (res.data && res.data.dataVersion) {
        localStorage.setItem('dv', res.data.dataVersion);
      }
      this._loadFamilyInfoAsync();
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('更新失败: ' + e.message);
    }
  },

  /** v69：管理员移出家庭成员（清理重复昵称等脏数据；服务端限制：不能移出自己/最后一个管理员） */
  async _removeMember(targetMemberId) {
    if (!window.confirm('确定要移出该成员吗？\n移出后 TA 将无法再访问本家庭数据。')) return;
    Utils.showLoading('移出中...');
    try {
      const res = await API.removeMember(targetMemberId);
      Utils.hideLoading();
      Utils.showToast(res.msg || '已移出该成员');
      if (res.data && res.data.dataVersion) {
        localStorage.setItem('dv', res.data.dataVersion);
      }
      this._loadFamilyInfoAsync();
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('移出失败: ' + e.message);
    }
  },

  /** 打开宝宝信息编辑弹窗 */
  _openBabyEdit() {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby._id) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'baby-edit-modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:380px;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>修改宝宝信息</h3>
          <button class="modal-close" onclick="document.getElementById('baby-edit-modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label>宝宝头像</label><input type="file" id="profile-avatar-input" class="form-input" accept="image/*" onchange="ProfilePage._uploadProfileAvatar(this)"></div>
          <div class="form-group">
            <label>宝宝姓名</label>
            <input type="text" class="form-input" id="be-name" value="${Utils.escapeHtml(baby.name) || ''}" placeholder="输入宝宝姓名">
          </div>
          <div class="form-group">
            <label>性别</label>
            <select class="form-input" id="be-gender">
              <option value="male" ${baby.gender === 'male' ? 'selected' : ''}>男</option>
              <option value="female" ${baby.gender === 'female' ? 'selected' : ''}>女</option>
            </select>
          </div>
          <div class="form-group">
            <label>出生日期时间</label>
            <input type="datetime-local" class="form-input" id="be-birthdate" value="${baby.birthDate ? (baby.birthDate.includes('T') ? baby.birthDate : baby.birthDate + 'T00:00') : ''}" step="60">
          </div>
          <div class="form-group">
            <label>出生体重</label>
            <div style="display:flex;gap:8px">
              <input type="number" class="form-input" id="be-birthweight" value="${baby.birthWeight || ''}" placeholder="如：3250" step="1" style="flex:1">
              <select class="form-input" id="be-birthweight-unit" style="width:70px;flex-shrink:0">
                <option value="g" ${(baby.birthWeightUnit || 'g') === 'g' ? 'selected' : ''}>g</option>
                <option value="kg" ${baby.birthWeightUnit === 'kg' ? 'selected' : ''}>kg</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>出生身高</label>
            <input type="number" class="form-input" id="be-birthheight" value="${baby.birthHeight || ''}" placeholder="如：50" step="0.1">
            <span class="form-suffix">cm</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="document.getElementById('baby-edit-modal').remove()">取消</button>
          <button class="btn btn-primary" onclick="ProfilePage._saveBabyInfo()">${Lucide.icon('download', 16)} 保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
  },

  async _uploadProfileAvatar(input) {
    const file = input.files?.[0]; if (!file) return;
    try {
      Utils.showLoading('正在上传头像...');
      const blob = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = e => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); const s = Math.min(1, 400 / img.width, 400 / img.height); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(resolve, 'image/jpeg', .82); }; img.onerror = reject; img.src = e.target.result; }; r.onerror = reject; r.readAsDataURL(file); });
      const base64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });
      const result = await API.uploadBabyAvatar(base64); this._pendingAvatar = result.avatar; Utils.hideLoading(); Utils.showToast('头像上传成功');
    } catch (e) { Utils.hideLoading(); Utils.showToast('头像上传失败：' + e.message); }
  },

  /** 保存宝宝信息 */
  async _saveBabyInfo() {
    const baby = Utils.getBabyInfo();
    const data = {
      name: document.getElementById('be-name').value.trim(),
      gender: document.getElementById('be-gender').value,
      birthDate: document.getElementById('be-birthdate').value,
      birthWeight: parseFloat(document.getElementById('be-birthweight').value) || undefined,
      birthWeightUnit: document.getElementById('be-birthweight-unit').value,
      birthHeight: parseFloat(document.getElementById('be-birthheight').value) || undefined,
      birthHeightUnit: 'cm',
      ...(this._pendingAvatar ? { avatar: this._pendingAvatar } : {})
    };

    if (!data.name) { Utils.showToast('请输入宝宝姓名'); return; }
    if (!data.birthDate) { Utils.showToast('请选择出生日期'); return; }

    Utils.showLoading('保存中...');
    try {
      // 调用云端更新
      await API.updateBaby(data);
      // 更新本地缓存
      Utils.setBabyInfo(data);
      Utils.hideLoading();
      document.getElementById('baby-edit-modal').remove();
      Utils.showToast('宝宝信息已更新');
      showPage('profile');
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('保存失败: ' + e.message);
    }
  }
};

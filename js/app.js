/**
 * 主应用逻辑 — 含睡眠计时、待办、主题、字号、导入导出等
 */
window.App = {
  stoolPhotoFile: null,
  _aiRecognized: false,
  _modalTrigger: null,
  _modalKeydown: null,

  async init() {
    // 应用保存的主题和字号
    Utils.applyTheme(Utils.getTheme());
    Utils.applyTextSize(Utils.getTextSize());

    // 应用自定义Tab图标
    Utils._applyTabIcons();

    // P2b（v94）：v2 通道顶栏设置按钮 Lucide 化（v1 保持  emoji，与 V74 一致）
    if (window.__UI_V3__) {
      const gearBtn = document.getElementById('btn-settings');
      if (gearBtn) gearBtn.innerHTML = Lucide.icon('settings', 20);
      // v95 批次F：v2 通道页面内容 emoji → Lucide（装饰类；数据语义 emoji 无映射原样保留）
      this._installEmojiLucide();
    }
    this._installModalA11y();

    this._scheduleMidnightSync();
    this._schedulePushChecker();
    this._startSyncPolling();

    // 检查是否在切换家庭中
    if (Utils.storage.get('switchingFamily')) {
      showPage('onboarding');
      return;
    }

    const auth = Auth.getLocalAuth();

    // 本地缓存有效 → 直接显示首页，后台静默刷新
    if (Auth.isLocallyValid()) {
      showPage('dashboard');
      this._startGlobalTimer();  // 恢复计时器显示
      // 静默刷新（不阻塞 UI，失败了也不清理登录）
      Auth.silentRefresh().then(ok => {
        if (ok) {
          this._refreshCurrent();
          Utils.syncMoodsFromCloud();
          // 角色变化时提示用户
          if (Auth.hasRoleChanged()) {
            Utils.showToast(' 权限已更新', 2000);
          }
        }
      });
      return;
    }

    // 有 memberId + family → 尝试从服务器刷新
    if (auth && auth.memberId && Auth.isInFamily()) {
      try {
        await Auth.getProfile();
        if (Auth.isInFamily()) {
          showPage('dashboard');
          this._startGlobalTimer();  // 恢复计时器显示
        } else {
          Auth.clearAuth();
          showPage('onboarding');
        }
      } catch (e) {
        // getProfile 失败 — 区分认证错误和网络错误
        if (e.isAuthError) {
          // Token 已失效 → 需要重新登录
          Auth.clearAuth();
          showPage('onboarding');
        } else if (e.isNetworkError) {
          // 网络不通 → 信任本地缓存，显示首页
          console.warn('[App] 网络不通，使用本地缓存');
          showPage('dashboard');
          this._startGlobalTimer();  // 恢复计时器显示
          // 网络恢复后静默刷新
          this._scheduleReconnectRefresh();
        } else {
          // 其他错误（如 member 不存在）→ 清除登录
          Auth.clearAuth();
          showPage('onboarding');
        }
      }
      return;
    }

    // 其他情况：引导页
    if (Auth.hasSavedFamily()) {
      showPage('onboarding');
    } else {
      showPage('onboarding');
    }

    // 监听页面可见性变化 — 从后台恢复时静默刷新
    this._setupVisibilityListener();
  },

  /** 启动多端同步轮询：页面可见且已登录时，比对 family.dataVersion 检测云端变化 */
  _startSyncPolling() {
    if (this._syncPollingStarted) return;
    this._syncPollingStarted = true;
    // 延迟 8s 首查，避免与启动时的静默刷新冲突
    setTimeout(() => this._pollSync(), 8000);
    this._syncTimer = setInterval(() => this._pollSync(), 30000);
  },

  async _pollSync() {
    // 后台或未登录时不轮询（省流量）
    if (document.visibilityState !== 'visible') return;
    if (!Auth.isLocallyValid() || !Auth.isInFamily()) return;
    try {
      const profile = await Auth.getProfile();
      const dv = profile && profile.family ? profile.family.dataVersion : undefined;
      if (dv === undefined || dv === null) return; // 云端尚无版本号（老数据，等首次写操作）
      const localDv = Utils.storage.get('dv');
      if (localDv === undefined || localDv === null) {
        Utils.storage.set('dv', dv); // 首次：只记录基准，不刷新
        return;
      }
      if (Number(dv) !== Number(localDv)) {
        Utils.storage.set('dv', dv);
        if (Auth.hasRoleChanged()) Utils.showToast(' 权限已更新', 2000);
        Utils.showToast(' 其他成员有更新，已自动同步', 2000);
        this._refreshCurrent();
        Utils.syncMoodsFromCloud();
      }
      // R4 v2：轮询成功 → 同步条「已同步」
      if (window.CoopV2) CoopV2.setState('synced');
    } catch (e) {
      // 认证失效已由 Auth.getProfile 内部清理，这里兜底跳转引导页
      if (e && e.isAuthError) {
        Auth.clearAuth();
        showPage('onboarding');
      } else {
        // R4 v2：轮询异常 → 同步条「同步失败·点击重试」
        if (window.CoopV2) CoopV2.setState('error');
      }
    }
  },

  /** 设置页面可见性监听 */
  _setupVisibilityListener() {
    if (this._visibilitySetup) return;
    this._visibilitySetup = true;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // 恢复全局计时器（睡眠+足迹）
        this._startGlobalTimer();
        // 页面切回前台立即检查定时推送（若恰好在推送窗口内，无需等整分钟）
        this._checkPushSchedule();

        if (Auth.isLocallyValid()) {
          console.log('[App] 页面恢复可见，静默刷新数据');
          Auth.silentRefresh().then(ok => {
            if (ok) {
              this._refreshCurrent();
              Utils.syncMoodsFromCloud();
              if (Auth.hasRoleChanged()) {
                Utils.showToast(' 权限已更新', 2000);
              }
            } else if (Auth.isTokenExpired()) {
              Utils.showToast('登录已过期，请重新登录');
              setTimeout(() => { Auth.clearAuth(); showPage('onboarding'); }, 2000);
            }
          });
        }
      }
    });

    // 从 bfcache 恢复时刷新页面
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        // 恢复全局计时器
        this._startGlobalTimer();
        if (Auth.isLocallyValid()) {
          console.log('[App] 从缓存恢复，刷新数据');
          Auth.silentRefresh().then(ok => {
            if (ok) {
              this._refreshCurrent();
              Utils.syncMoodsFromCloud();
              if (Auth.hasRoleChanged()) {
                Utils.showToast(' 权限已更新', 2000);
              }
            }
          });
        }
      }
    });
  },

  /** 网络恢复后定时重试刷新（最多3次，间隔30秒） */
  _scheduleReconnectRefresh() {
    let retries = 0;
    const maxRetries = 3;
    const tryRefresh = () => {
      if (retries >= maxRetries) return;
      retries++;
      setTimeout(() => {
        if (Auth.isLocallyValid()) {
          Auth.silentRefresh().then(ok => {
            if (ok) {
              this._refreshCurrent();
              Utils.syncMoodsFromCloud();
              if (Auth.hasRoleChanged()) {
                Utils.showToast(' 权限已更新', 2000);
              }
            }
            else tryRefresh(); // 继续重试
          });
        }
      }, 30000);
    };
    tryRefresh();
  },

  // ===== 全局计时器（锁屏/后台后自动恢复睡眠+足迹计时） =====
  _globalTimer: null,

  /** 启动全局计时器：每秒更新睡眠和足迹的计时显示 */
  _startGlobalTimer() {
    this._stopGlobalTimer();
    this._globalTimer = setInterval(() => {
      let hasActive = false;

      // 睡眠计时器显示
      const sleepSession = Utils.getActiveSleepSession();
      const sleepDisplay = document.getElementById('sleep-timer-display');
      if (sleepSession && sleepDisplay) {
        sleepDisplay.textContent = Utils.formatElapsed(Date.now() - sleepSession.startTimestamp);
        hasActive = true;
      }

      // 足迹计时器显示
      const walkDisplay = document.getElementById('walk-elapsed');
      if (walkDisplay) {
        // 使用 FootprintPage 的活跃会话（云端数据）
        const active = window.FootprintPage && FootprintPage._activeSession;
        if (active && active.startTimestamp) {
          walkDisplay.textContent = Utils.formatElapsed(Date.now() - active.startTimestamp);
          hasActive = true;
        }
      }

      // 两个计时器都不活跃时自动停止
      if (!hasActive) this._stopGlobalTimer();
    }, 1000);
  },

  /** 停止全局计时器 */
  _stopGlobalTimer() {
    if (this._globalTimer) {
      clearInterval(this._globalTimer);
      this._globalTimer = null;
    }
  },

  // ===== 快捷操作 =====
  quickFeed() { this.openFeedForm(); },
  quickStool() { this.openStoolForm(); },
  quickTemp() { this.openTempForm(); },

  // 亲喂入口：打开完整表单，默认所有可选字段为“不记录”
  quickBreast() { return BreastFeeding.openForm(); },

  // ===== 睡眠计时器 =====
  async toggleSleep() {
    const active = Utils.getActiveSleepSession();
    if (active) {
      // 结束睡眠
      const startTime = new Date(active.startTime);
      const endTime = new Date();
      const duration = Math.round((endTime - startTime) / 60000);

      if (duration < 1) {
        Utils.showToast('睡眠时间太短，已取消');
        Utils.clearActiveSleepSession();
        QuickRecordPage._stopSleepTimer();
        this._refreshCurrent();
        return;
      }

      Utils.showLoading('保存中...');
      try {
        await API.createSleep({ startTime: active.startTime, endTime: endTime.toISOString(), note: '' });
        Utils.clearActiveSleepSession();
        QuickRecordPage._stopSleepTimer();
        Utils.hideLoading();
        Utils.showToast(` 睡眠 ${Utils.formatDuration(duration)} 已保存`);
        this._refreshCurrent();
      } catch (e) { Utils.hideLoading(); Utils.showToast('保存失败: ' + e.message); }
    } else {
      // 开始睡眠
      const now = new Date();
      Utils.setActiveSleepSession(now.toISOString());
      Utils.showToast(' 睡眠计时开始');
      this._refreshCurrent();
      QuickRecordPage._startSleepTimer();
      this._startGlobalTimer();  // 全局计时器备份，锁屏后自动恢复
    }
  },

  // ===== 待办管理面板 =====
  _openTodoManager() {
    const baby = Utils.getBabyInfo();
    const nutrition = Utils.getBabyNutrition(baby.birthDate);
    const nursing = Utils.getBabyNursing(baby.birthDate);
    const hiddenItems = Utils.getHiddenDashboardItems();

    // 构建所有自动待办列表
    const allItems = [];
    nutrition.forEach(n => {
      const key = 'nutrition_' + n.name;
      allItems.push({ key, type: 'nutrition', title: n.name, desc: n.dose || n.desc, hidden: hiddenItems.includes(key) });
    });
    nursing.items.forEach(item => {
      const key = 'nursing_' + item.name;
      allItems.push({ key, type: 'nursing', title: item.name, desc: item.standard || '', hidden: hiddenItems.includes(key) });
    });

    const itemsHTML = allItems.map(item => `
      <div class="todo-manager-item">
        <div style="flex:1">
          <div style="font-size:14px">${item.type === 'nutrition' ? '' : ''} ${Utils.escapeHtml(item.title)}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${Utils.escapeHtml(item.desc)}</div>
        </div>
        <label class="switch" style="margin-left:8px">
          <input type="checkbox" ${!item.hidden ? 'checked' : ''} onchange="App._toggleAutoTodo('${item.key}')">
          <span class="slider"></span>
        </label>
      </div>
    `).join('');

    this._showModal(' 待办管理', `
      <p class="text-muted" style="font-size:12px;margin-bottom:12px">
        控制营养补充和每日护理是否显示在首页待办中。<br>
        可手动增加自定义待办，完成后首页汇总会联动更新。
      </p>
      <div style="max-height:50vh;overflow-y:auto;margin-bottom:12px">
        ${allItems.length > 0 ? itemsHTML : '<p class="text-muted text-center">暂无推荐项</p>'}
      </div>
      <button class="btn btn-primary btn-block" onclick="App._closeModal();App._saveDashboardSettings();App._refreshCurrent()">完成</button>
    `);
  },

  _toggleAutoTodo(key) {
    Utils.toggleHiddenDashboardItem(key);
    // 不立即刷新，等关闭管理面板时统一刷新
  },
  openTodoForm() {
    this._showModal('添加待办', `
      <div class="form-group">
        <label>待办内容</label>
        <input type="text" id="todo-input" class="form-input" placeholder="如：买奶粉、预约体检" autofocus>
      </div>
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="todo-date" class="form-input" value="${Utils.todayStr()}">
        <p class="text-muted" style="font-size:11px;margin-top:4px">选择今天则立即显示，其他日期等到当天显示</p>
      </div>
      <button class="btn btn-primary btn-block" onclick="App._submitTodo()">添加</button>
    `);
    setTimeout(() => document.getElementById('todo-input')?.focus(), 100);
  },

  async _submitTodo() {
    const title = document.getElementById('todo-input')?.value?.trim();
    const date = document.getElementById('todo-date')?.value || Utils.todayStr();
    if (!title) { Utils.showToast('请输入待办内容'); return; }
    Utils.showLoading('保存中...');
    try {
      await API.createTodo(title, date);
      Utils.hideLoading();
      this._closeModal();
      Utils.showToast('已添加');
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('保存失败: ' + e.message); }
  },

  async toggleTodo(recordId, currentCompleted) {
    try {
      if (currentCompleted) {
        await API.uncompleteTodo(recordId);
      } else {
        await API.completeTodo(recordId);
        // R6：v2 通道打卡成功触觉反馈（10ms 单脉冲）
        if (window.__UI_V3__ && navigator.vibrate) navigator.vibrate(10);
        Utils.showToast(' 已完成', 2000, 'success');
      }
      this._refreshCurrent();
    } catch (e) { Utils.showToast('操作失败: ' + e.message, 2000, 'error'); }
  },

  async deleteTodo(recordId) {
    if (!confirm('确认删除此待办？')) return;
    try {
      await API.deleteTodo(recordId);
      Utils.showToast('已删除');
      this._refreshCurrent();
    } catch (e) { Utils.showToast('删除失败: ' + e.message); }
  },

  // ===== 管理员：营养/护理管理 =====
  _showAdminOnly() { Utils.showToast('仅主管理员可操作'); },

  /** 保存仪表盘设置到云端（管理员操作后自动调用） */
  async _saveDashboardSettings() {
    if (!Auth.isAdmin()) return;
    try {
      const snapshot = Utils.getDashboardSettingsSnapshot();
      await API.saveDashboardSettings(snapshot);
      console.log('[App] 仪表盘设置已同步到云端');
    } catch (e) {
      console.warn('[App] 仪表盘设置同步失败:', e.message);
    }
  },

  _openNutritionManager() {
    if (!Auth.isAdmin()) { this._showAdminOnly(); return; }
    const baby = Utils.getBabyInfo();
    const standard = Utils.getBabyNutrition(baby.birthDate);
    const custom = Utils.getCustomNutritionItems();
    const disabled = Utils.getDisabledStandardNutritionKeys();
    const hiddenItems = Utils.getHiddenDashboardItems();
    let items = '';
    standard.forEach(n => {
      const isOn = !disabled.includes(n.name);
      items += `<div class="admin-item">
        <div style="flex:1"><b>${Utils.escapeHtml(n.name)}</b><div class="text-muted" style="font-size:11px">${Utils.escapeHtml(n.dose)} · ${Utils.escapeHtml(n.desc)}</div></div>
        <label class="switch"><input type="checkbox" ${isOn ? 'checked' : ''} onchange="App._toggleNutritionItem('${Utils.jsAttr(n.name)}', true)"><span class="slider"></span></label>
      </div>`;
    });
    custom.forEach(n => {
      const dashKey = 'nutrition_custom_' + n.name;
      const showOnDash = !hiddenItems.includes(dashKey);
      items += `<div class="admin-item">
        <div style="flex:1"><b>${Utils.escapeHtml(n.name)}</b> <span style="font-size:10px;color:var(--primary)">[自定义]</span><div class="text-muted" style="font-size:11px">${Utils.escapeHtml(n.dose) || ''} · ${Utils.escapeHtml(n.desc) || ''}</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <label class="switch"><input type="checkbox" ${showOnDash ? 'checked' : ''} onchange="App._toggleNutritionItem('${Utils.jsAttr(n.name)}', false)"><span class="slider"></span></label>
          <button class="btn btn-outline btn-sm" onclick="Utils.removeCustomNutritionItem('${Utils.jsAttr(n.name)}');App._saveDashboardSettings();App._closeModal();App._refreshCurrent();App._openNutritionManager()"></button>
        </div>
      </div>`;
    });
    this._showModal(' 管理营养补充（管理员）', `
      <p class="text-muted" style="font-size:12px;margin-bottom:8px">关闭的项目不在首页显示，设置自动同步给全家</p>
      ${items || '<p class="text-muted">暂无项目</p>'}
      <button class="btn btn-primary btn-block mt-16" onclick="App._closeModal();App._addNutritionItem()">+ 新增营养项</button>
      <button class="btn btn-outline btn-block mt-8" onclick="App._closeModal();App._saveDashboardSettings();App._refreshCurrent()">完成</button>
    `);
  },

  _toggleNutritionItem(name, isStandard) {
    if (isStandard) {
      Utils.toggleDisabledNutritionKey(name);
      const dashKey = 'nutrition_' + name;
      Utils.toggleHiddenDashboardItem(dashKey);
    } else {
      const dashKey = 'nutrition_custom_' + name;
      Utils.toggleHiddenDashboardItem(dashKey);
    }
  },

  _toggleStdNutrition(name) { Utils.toggleDisabledNutritionKey(name); },

  _addNutritionItem() {
    if (!Auth.isAdmin()) { this._showAdminOnly(); return; }
    this._showModal('新增营养补充', `
      <div class="form-group"><label>名称</label><input type="text" id="nn-name" class="form-input" placeholder="如：钙剂"></div>
      <div class="form-group"><label>剂量</label><input type="text" id="nn-dose" class="form-input" placeholder="如：500mg/日"></div>
      <div class="form-group"><label>描述</label><input type="text" id="nn-desc" class="form-input" placeholder="如：每日1次"></div>
      <button class="btn btn-primary btn-block" onclick="App._doAddNutrition()">添加</button>
    `);
  },

  _doAddNutrition() {
    const name = document.getElementById('nn-name')?.value?.trim();
    if (!name) { Utils.showToast('请输入名称'); return; }
    Utils.addCustomNutritionItem({ name, dose: document.getElementById('nn-dose')?.value?.trim(), desc: document.getElementById('nn-desc')?.value?.trim() });
    this._saveDashboardSettings();
    Utils.showToast('已添加');
    this._closeModal();
    this._openNutritionManager();
  },

  _openNursingManager() {
    if (!Auth.isAdmin()) { this._showAdminOnly(); return; }
    const baby = Utils.getBabyInfo();
    const standard = Utils.getBabyNursing(baby.birthDate);
    const custom = Utils.getCustomNursingItems();
    const disabled = Utils.getDisabledStandardNursingKeys();
    const hiddenItems = Utils.getHiddenDashboardItems();
    let items = '';
    standard.items.forEach(item => {
      const isOn = !disabled.includes(item.name);
      items += `<div class="admin-item">
        <div style="flex:1"><b>${Utils.escapeHtml(item.name)}</b><div class="text-muted" style="font-size:11px">${Utils.escapeHtml(item.standard)}</div></div>
        <label class="switch"><input type="checkbox" ${isOn ? 'checked' : ''} onchange="App._toggleNursingItem('${Utils.jsAttr(item.name)}', true)"><span class="slider"></span></label>
      </div>`;
    });
    custom.forEach(item => {
      const dashKey = 'nursing_custom_' + item.name;
      const showOnDash = !hiddenItems.includes(dashKey);
      items += `<div class="admin-item">
        <div style="flex:1"><b>${Utils.escapeHtml(item.name)}</b> <span style="font-size:10px;color:var(--primary)">[自定义]</span><div class="text-muted" style="font-size:11px">${Utils.escapeHtml(item.standard) || ''}</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <label class="switch"><input type="checkbox" ${showOnDash ? 'checked' : ''} onchange="App._toggleNursingItem('${Utils.jsAttr(item.name)}', false)"><span class="slider"></span></label>
          <button class="btn btn-outline btn-sm" onclick="Utils.removeCustomNursingItem('${Utils.jsAttr(item.name)}');App._saveDashboardSettings();App._closeModal();App._refreshCurrent();App._openNursingManager()"></button>
        </div>
      </div>`;
    });
    this._showModal(' 管理每日护理（管理员）', `
      <p class="text-muted" style="font-size:12px;margin-bottom:8px">关闭的项目不在首页显示，设置自动同步给全家</p>
      ${items || '<p class="text-muted">暂无项目</p>'}
      <button class="btn btn-primary btn-block mt-16" onclick="App._closeModal();App._addNursingItem()">+ 新增护理项</button>
      <button class="btn btn-outline btn-block mt-8" onclick="App._closeModal();App._saveDashboardSettings();App._refreshCurrent()">完成</button>
    `);
  },

  _toggleNursingItem(name, isStandard) {
    if (isStandard) {
      Utils.toggleDisabledNursingKey(name);
      const dashKey = 'nursing_' + name;
      Utils.toggleHiddenDashboardItem(dashKey);
    } else {
      const dashKey = 'nursing_custom_' + name;
      Utils.toggleHiddenDashboardItem(dashKey);
    }
  },

  _toggleStdNursing(name) { Utils.toggleDisabledNursingKey(name); },

  _addNursingItem() {
    if (!Auth.isAdmin()) { this._showAdminOnly(); return; }
    this._showModal('新增每日护理', `
      <div class="form-group"><label>名称</label><input type="text" id="nn-name" class="form-input" placeholder="如：口腔护理"></div>
      <div class="form-group"><label>标准</label><input type="text" id="nn-standard" class="form-input" placeholder="如：每日1次，每次5分钟"></div>
      <div class="form-group"><label>方法</label><input type="text" id="nn-method" class="form-input" placeholder="护理方法"></div>
      <button class="btn btn-primary btn-block" onclick="App._doAddNursing()">添加</button>
    `);
  },

  _doAddNursing() {
    const name = document.getElementById('nn-name')?.value?.trim();
    if (!name) { Utils.showToast('请输入名称'); return; }
    Utils.addCustomNursingItem({ name, standard: document.getElementById('nn-standard')?.value?.trim(), method: document.getElementById('nn-method')?.value?.trim() });
    this._saveDashboardSettings();
    Utils.showToast('已添加');
    this._closeModal();
    this._openNursingManager();
  },

  // ===== 日历日期添加待办 =====
  _addDateTodo(dateStr) {
    this._showModal(' ' + dateStr + ' 添加待办', `
      <div class="form-group"><label>待办内容</label><input type="text" id="dtodo-input" class="form-input" placeholder="输入待办事项" autofocus></div>
      <p class="text-muted" style="font-size:12px;margin-bottom:12px">添加后可继续添加下一条，或在日历中编辑/删除</p>
      <button class="btn btn-primary btn-block" onclick="App._doAddDateTodo('${dateStr}')">添加</button>
    `);
  },

  async _doAddDateTodo(dateStr) {
    const title = document.getElementById('dtodo-input')?.value?.trim();
    if (!title) { Utils.showToast('请输入内容'); return; }
    try {
      await API.createTodo(title, dateStr);
      Utils.showToast('已添加');
      this._closeModal();
      ReportPage.selectDay(dateStr); // 刷新日历详情
    } catch (e) { Utils.showToast('添加失败: ' + e.message); }
  },

  async _deleteDateTodo(todoId, dateStr) {
    if (!confirm('确认删除此待办？')) return;
    try {
      await API.deleteTodo(todoId);
      Utils.showToast('已删除');
      ReportPage.selectDay(dateStr); // 刷新日历详情
    } catch (e) { Utils.showToast('删除失败: ' + e.message); }
  },

  async _toggleDateTodo(todoId, dateStr, currentCompleted) {
    try {
      if (currentCompleted) {
        await API.uncompleteTodo(todoId);
      } else {
        await API.completeTodo(todoId);
        Utils.showToast(' 已完成');
      }
      ReportPage.selectDay(dateStr); // 刷新日历详情
    } catch (e) { Utils.showToast('操作失败: ' + e.message); }
  },

  _editDateTodo(todoId, dateStr, currentTitle) {
    this._showModal(' 编辑待办', `
      <div class="form-group"><label>待办内容</label><input type="text" id="etodo-input" class="form-input" value="${Utils.escapeHtml(currentTitle)}" autofocus></div>
      <button class="btn btn-primary btn-block" onclick="App._doEditDateTodo('${todoId}','${dateStr}')">保存</button>
    `);
    setTimeout(() => { const el = document.getElementById('etodo-input'); if (el) { el.focus(); el.select(); } }, 100);
  },

  async _doEditDateTodo(todoId, dateStr) {
    const title = document.getElementById('etodo-input')?.value?.trim();
    if (!title) { Utils.showToast('请输入内容'); return; }
    try {
      await API.updateTodo(todoId, title, dateStr);
      Utils.showToast('已更新');
      this._closeModal();
      ReportPage.selectDay(dateStr); // 刷新日历详情
    } catch (e) { Utils.showToast('更新失败: ' + e.message); }
  },

  _closeCalendarDetail() {
    const detail = document.getElementById('rpt-calendar-day-detail');
    if (detail) detail.innerHTML = '';
  },

  // ===== 喂养目标 =====
  openTargetForm() {
    const current = Utils.getFeedingTarget();
    this._showModal(' 设置每日奶量目标', `
      <div class="form-group">
        <label>目标奶量 (ml)</label>
        <input type="number" id="target-input" class="form-input" value="${current}" step="50" inputmode="numeric">
      </div>
      <p class="text-muted" style="font-size:12px;margin-bottom:12px">参考：0-1月 60-90ml/次，2-3月 120-150ml/次，4-6月 150-180ml/次</p>
      <button class="btn btn-primary btn-block" onclick="App._submitTarget()">保存</button>
    `);
  },

  _submitTarget() {
    const val = parseInt(document.getElementById('target-input').value);
    if (!val || val < 100 || val > 2000) { Utils.showToast('请输入合理的目标值（100-2000ml）'); return; }
    Utils.setFeedingTarget(val);
    this._closeModal();
    Utils.showToast(' 目标已设置');
    this._refreshCurrent();
  },

  // ===== 里程碑快捷入口 =====
  openMilestoneForm() {
    const baby = Utils.getBabyInfo();
    const milestones = Utils.getBabyMilestones(baby.birthDate);
    const customList = [
      '第一次微笑', '笑出声', '翻身', '吃辅食', '叫妈妈', '叫爸爸',
      '坐起来', '爬行', '站起来', '走路', '长牙', '游泳', '去公园', '看海'
    ];

    let html = `
      <div class="form-group">
        <label>选择或输入里程碑</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
          ${customList.map(m => `<button class="btn btn-secondary" style="font-size:12px;padding:6px 10px" onclick="document.getElementById('ms-input').value='${m}'">${m}</button>`).join('')}
        </div>
        <input type="text" id="ms-input" class="form-input" placeholder="输入里程碑名称">
      </div>
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="ms-date" class="form-input" value="${Utils.todayStr()}">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="ms-note" class="form-input" placeholder="可选">
      </div>
      <button class="btn btn-primary btn-block" onclick="App._submitMilestoneForm()">保存</button>
    `;
    this._showModal(' 记录里程碑', html);
  },

  async _submitMilestoneForm() {
    const skill = document.getElementById('ms-input')?.value?.trim();
    const date = document.getElementById('ms-date')?.value;
    const note = document.getElementById('ms-note')?.value || '';
    if (!skill) { Utils.showToast('请输入里程碑名称'); return; }

    Utils.showLoading('保存中...');
    try {
      await API.createMilestone({ milestoneKey: skill, milestoneLabel: skill, domain: '自定义', date, note });
      Utils.hideLoading();
      this._closeModal();
      Utils.showToast(' 已记录');
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('保存失败: ' + e.message); }
  },

  // ===== 日历添加里程碑 =====
  async addCalendarMilestone(dateStr) {
    const skill = document.getElementById('cal-ms-input')?.value?.trim();
    if (!skill) { Utils.showToast('请输入里程碑名称'); return; }
    Utils.showLoading('保存中...');
    try {
      await API.createMilestone({ milestoneKey: skill, milestoneLabel: skill, domain: '自定义', date: dateStr, note: '' });
      Utils.hideLoading();
      Utils.showToast(' 已记录');
      document.getElementById('cal-ms-input').value = '';
    } catch (e) { Utils.hideLoading(); Utils.showToast('保存失败: ' + e.message); }
  },

  // ===== 主题颜色 =====
  applyTheme(themeKey) {
    Utils.applyTheme(themeKey);
    Utils.showToast(' 主题已切换');
  },

  // ===== 文字大小 =====
  applyTextSize(sizeKey) {
    Utils.applyTextSize(sizeKey);
    Utils.showToast(' 文字大小已调整');
  },

  // ===== 云端同步 =====
  async cloudSync() {
    Utils.showLoading('同步中...');
    try {
      await Auth.getProfile();
      Utils.hideLoading();
      // 同步家庭仪表盘设置
      try {
        const familyInfo = await API.getFamilyInfo();
        if (familyInfo?.family?.dashboardSettings) {
          Utils.applyCloudDashboardSettings(familyInfo.family.dashboardSettings);
        }
      } catch(e) { console.warn('sync dashboard settings:', e.message); }
      // 同步云端心情到本地
      await Utils.syncMoodsFromCloud().catch(() => {});
      Utils.showToast(' 已同步最新数据');
      showPage('dashboard');
    } catch (e) { Utils.hideLoading(); Utils.showToast('同步失败: ' + e.message); }
  },

  /** 启动午夜自动同步 */
  _scheduleMidnightSync() {
    // 清除旧的定时器
    if (this._midnightTimer) clearTimeout(this._midnightTimer);

    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight - now;

    this._midnightTimer = setTimeout(async () => {
      console.log('[AutoSync] 午夜自动同步触发');
      try {
        await Auth.getProfile();
        // 如果在首页，刷新数据
        if (Pages.currentTab === 'dashboard') {
          showPage('dashboard');
        }
      } catch (e) {
        console.warn('[AutoSync] 同步失败:', e.message);
      }
      // 调度下一次
      this._scheduleMidnightSync();
    }, msUntilMidnight);
  },

  // ===== 定时推送（日报/周报/月报）=====
  /** 启动定时推送检查：每 60s 检查一次是否到点（页面打开时生效，后台挂起时无法触发，属 H5 固有限制） */
  _schedulePushChecker() {
    if (this._pushCheckerStarted) return;
    this._pushCheckerStarted = true;
    // 首查延迟 15s，避开启动时的静默刷新
    setTimeout(() => this._checkPushSchedule(), 15000);
    this._pushTimer = setInterval(() => this._checkPushSchedule(), 60000);
  },

  /** 检查推送配置是否到点；到点后 10 分钟窗口内可触发，配合去重标记防止重复推送 */
  async _checkPushSchedule() {
    // 后台或未登录时跳过（省流量、避免打扰）
    if (document.visibilityState !== 'visible') return;
    if (!Auth.isLocallyValid() || !Auth.isInFamily()) return;
    const cfg = Utils.storage.get('pushConfig');
    const token = (cfg && cfg.pushToken) || Utils.storage.get('pushToken');
    if (!token) return;

    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    // 到点后 10 分钟内都可触发（容忍定时器抖动/主线程繁忙错过精确分钟）
    const inWindow = t => {
      if (!t) return false;
      const [h, m] = String(t).split(':').map(Number);
      const target = h * 60 + m;
      const cur = now.getHours() * 60 + now.getMinutes();
      return cur >= target && cur < target + 10;
    };

    // ① 日报：每天 dailyTime 触发一次
    if (cfg.dailyTime && inWindow(cfg.dailyTime)) {
      const today = this._dateKey(now);
      if (Utils.storage.get('lastPushDaily') !== today) {
        await this._firePush('日报', token, 'lastPushDaily', today);
        return;
      }
    }

    // ② 周报：每周 weeklyDay 的 weeklyTime 触发一次（ISO 周号去重）
    if (cfg.weeklyDay && cfg.weeklyTime && inWindow(cfg.weeklyTime)) {
      const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      if (weekNames[now.getDay()] === cfg.weeklyDay) {
        const wk = this._weekKey(now);
        if (Utils.storage.get('lastPushWeekly') !== wk) {
          await this._firePush('周报', token, 'lastPushWeekly', wk);
          return;
        }
      }
    }

    // ③ 月报：每月最后一天 monthlyTime 触发一次（月份去重）
    if (cfg.monthlyTime && inWindow(cfg.monthlyTime)) {
      const isLastDay = now.getDate() === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      if (isLastDay) {
        const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (Utils.storage.get('lastPushMonthly') !== mk) {
          await this._firePush('月报', token, 'lastPushMonthly', mk);
          return;
        }
      }
    }
  },

  /** 触发一次定时推送；成功后才写入去重标记，失败留待下次检查重试 */
  async _firePush(label, token, dedupKey, dedupValue) {
    console.log(`[AutoPush] ${label}定时推送触发`);
    try {
      const result = await API.pushReport(token, true);
      if (result && result.pushed) {
        Utils.storage.set(dedupKey, dedupValue);
        console.log(`[AutoPush] ${label}推送成功`);
      } else {
        console.warn(`[AutoPush] ${label}推送失败:`, result && result.pushError);
      }
    } catch (e) {
      console.warn(`[AutoPush] ${label}推送异常:`, e.message);
    }
  },

  /** 本地日期 key（YYYY-MM-DD） */
  _dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /** ISO 周 key（YYYY-Www）用于周报去重 */
  _weekKey(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    const wk = 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${date.getFullYear()}-W${String(wk).padStart(2, '0')}`;
  },

  // ===== 导入数据 =====
  importData() {
    this._showModal(' 导入数据', `
      <div class="form-group">
        <label>导入说明</label>
        <p class="text-muted" style="font-size:12px;line-height:1.6;margin-bottom:12px">
          1. 下载模板填写每日汇总数据<br>
          2. 上传填好的CSV文件<br>
          3. 系统将自动导入喂养/排便/睡眠等记录
        </p>
      </div>
      <button class="btn btn-outline btn-block mb-8" onclick="App._downloadTemplate()"> 下载导入模板</button>
      <button class="btn btn-primary btn-block" onclick="App._uploadImportFile()">选择文件导入</button>
    `);
  },

  _downloadTemplate() {
    const csv = '日期,奶量(ml),喂养次数,母乳次数,睡眠时长(分钟),体温,大便次数,小便次数,换尿不湿次数,营养补充\n' +
                '2026-08-01,800,8,3,600,36.8,3,6,5,维生素D3\n' +
                '2026-08-02,750,7,2,580,36.7,2,5,4,维生素D3;铁剂\n';
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'baby-tracker-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
    Utils.showToast('模板已下载');
  },

  _uploadImportFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const text = ev.target.result.replace(/^\uFEFF/, '');
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { Utils.showToast('文件内容为空'); return; }

        Utils.showLoading('导入中...');
        let imported = 0;
        try {
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            if (cols.length < 10 || !cols[0]) continue;
            const [date, milk, feedCount, breastCount, sleepMin, temp, stoolCnt, urineCnt, diaperCnt, nutrition] = cols;

            // 导入喂养记录
            if (milk && parseInt(milk) > 0) {
              await API.createFeeding({ feedingSubtype: 'bottle', milkSource: 'formula', time: date + 'T10:00:00', offeredMl: parseInt(milk), consumedMl: parseInt(milk), note: '导入数据', inputMethod: 'BACKFILL' }).catch(() => {});
            }
            // 导入体温
            if (temp && parseFloat(temp) > 0) {
              await API.createHealth({ recordType: 'temperature', date, value: parseFloat(temp), note: '导入数据' }).catch(() => {});
            }
            imported++;
          }
          Utils.hideLoading();
          this._closeModal();
          Utils.showToast(` 已导入 ${imported} 天数据`);
        } catch (e) { Utils.hideLoading(); Utils.showToast('导入失败: ' + e.message); }
      };
      reader.readAsText(file);
    };
    input.click();
  },

  // ===== 喂养表单 =====
  openFeedForm() {
    const timeStr = Utils.formatDate(new Date(), 'HH:mm');
    this._feedType = '';
    this._showModal(' 记录喂养', `
      <div class="form-group">
        <label>喂养方式</label>
        <div class="option-group" id="feed-type-group">
          ${APP_CONFIG.feedingTypes.map(t => `
            <div class="option-btn" data-type="${t.value}" onclick="App._selectFeedType('${t.value}')">
              <span class="opt-icon">${Lucide.icon(t.icon || 'circle-dot', 22)}</span><span class="opt-label">${t.label}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label>时间</label>
        <input type="time" id="feed-time" class="form-input" value="${timeStr}">
      </div>
      <div class="form-group" id="feed-amount-group" style="display:none">
        <label>量</label>
        <input type="number" id="feed-amount" class="form-input" placeholder="如：90" inputmode="numeric">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="feed-note" class="form-input" placeholder="可选">
      </div>
      <button class="btn btn-primary btn-block" onclick="App._submitFeed()">保存</button>
    `);
  },

  _feedType: '',
  _breastTimer: { left: 0, right: 0, active: null, interval: null, startTime: null },

  _selectFeedType(type) {
    this._feedType = type;
    $$('#feed-type-group .option-btn').forEach(b => b.classList.toggle('selected', b.dataset.type === type));
    const amountGroup = document.getElementById('feed-amount-group');
    if (amountGroup) {
      if (type === 'breast') {
        amountGroup.style.display = 'none';
      } else {
        amountGroup.querySelector('label').textContent = '量 (ml)';
        amountGroup.querySelector('input').placeholder = '如：90';
        amountGroup.style.display = '';
      }
    }
  },

  _formatBreastTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },

  _updateBreastDisplay() {
    const total = this._breastTimer.left + this._breastTimer.right;
    const totalEl = document.getElementById('breast-total-time');
    const leftEl = document.getElementById('breast-left-time');
    const rightEl = document.getElementById('breast-right-time');
    if (totalEl) totalEl.textContent = this._formatBreastTime(total);
    if (leftEl) leftEl.textContent = this._formatBreastTime(this._breastTimer.left);
    if (rightEl) rightEl.textContent = this._formatBreastTime(this._breastTimer.right);
  },

  _toggleBreastSide(side) {
    const other = side === 'left' ? 'right' : 'left';
    const btn = document.getElementById(`btn-breast-${side}`);
    const otherBtn = document.getElementById(`btn-breast-${other}`);

    if (this._breastTimer.active === side) {
      // 停止当前计时
      clearInterval(this._breastTimer.interval);
      this._breastTimer.active = null;
      if (btn) { btn.textContent = '▶'; btn.classList.remove('btn-danger'); btn.classList.add('btn-primary'); }
    } else {
      // 停止另一侧
      if (this._breastTimer.active) {
        clearInterval(this._breastTimer.interval);
        const activeBtn = document.getElementById(`btn-breast-${this._breastTimer.active}`);
        if (activeBtn) { activeBtn.textContent = '▶'; activeBtn.classList.remove('btn-danger'); activeBtn.classList.add('btn-primary'); }
      }
      // 开始当前侧
      this._breastTimer.active = side;
      this._breastTimer.startTime = Date.now();
      this._breastTimer.interval = setInterval(() => {
        this._breastTimer[side]++;
        this._updateBreastDisplay();
      }, 1000);
      if (btn) { btn.textContent = ''; btn.classList.remove('btn-primary'); btn.classList.add('btn-danger'); }
      if (otherBtn) { otherBtn.textContent = '▶'; otherBtn.classList.remove('btn-danger'); otherBtn.classList.add('btn-primary'); }
    }
  },

  _toggleManualTimer() {
    const el = document.getElementById('manual-timer-inputs');
    const btn = document.getElementById('btn-manual-toggle');
    if (el) {
      const showing = el.style.display !== 'none';
      el.style.display = showing ? 'none' : 'block';
      if (btn) btn.textContent = showing ? ' 手动计时' : ' 取消手动';
      if (!showing) {
        document.getElementById('manual-left').value = Math.floor(this._breastTimer.left / 60);
        document.getElementById('manual-right').value = Math.floor(this._breastTimer.right / 60);
      }
    }
  },

  _applyManualTimer() {
    const leftMin = parseInt(document.getElementById('manual-left')?.value || '0');
    const rightMin = parseInt(document.getElementById('manual-right')?.value || '0');
    this._breastTimer.left = leftMin * 60;
    this._breastTimer.right = rightMin * 60;
    this._updateBreastDisplay();
    // 隐藏手动输入区域
    const el = document.getElementById('manual-timer-inputs');
    const btn = document.getElementById('btn-manual-toggle');
    if (el) el.style.display = 'none';
    if (btn) btn.textContent = ' 手动计时';
  },

  async _submitFeed() {
    if (!this._feedType) { Utils.showToast('请选择喂养方式'); return; }
    const timeInput = document.getElementById('feed-time').value;
    const amount = document.getElementById('feed-amount')?.value;
    const note = document.getElementById('feed-note')?.value || '';
    const time = this._timeToISO(timeInput);

    const data = { type: this._feedType, time, note, inputMethod: 'table' };
    if (this._feedType !== 'breast') {
      data.amount = amount ? parseInt(amount) : undefined;
      data.unit = 'ml';
    }

    Utils.showLoading('保存中...');
    try {
      await API.createFeeding(data);
      Utils.hideLoading();
      this._closeModal();
      this._feedType = '';
      Utils.showToast(' 已保存');
      this._refreshCurrent();
    } catch (e) { Utils.showToast(e.isAuthError ? '登录已失效，请重新登录' : e.isTimeoutError ? '请求超时，请重试' : e.isFunctionNotFound ? '服务暂未部署' : e.isNetworkError ? '网络连接失败，请重试' : '保存失败: ' + e.message); }
    finally { Utils.hideLoading(); }
  },

  // ===== 排便表单（含拍照AI） =====
  openStoolForm() {
    const timeStr = Utils.formatDate(new Date(), 'HH:mm');
    this.stoolPhotoFile = null;
    this._aiRecognized = false;
    // v73：默认回填上一次记录（颜色/性状/量级）
    const last = Utils.getLastStoolInput() || {};
    this._stoolColor = last.color || '';
    this._stoolConsistency = last.consistency || '';
    this._stoolAmount = last.amount || '';

    this._showModal(' 记录大便', `
      <div class="form-group">
        <label>拍照识别（可选）</label>
        ${window.__UI_V3__ ? `
        <div class="v2-photo-steps" id="stool-photo-steps" aria-label="拍照识别步骤">
          <span class="step active" data-step="1"><span class="step-num">1</span>拍照</span>
          <span class="step-arrow">→</span>
          <span class="step" data-step="2"><span class="step-num">2</span>点击识别</span>
          <span class="step-arrow">→</span>
          <span class="step" data-step="3"><span class="step-num">3</span>确认结果</span>
        </div>
        <div id="stool-photo-aioff" class="v2-photo-aioff" style="display:none"></div>` : ''}
        <div class="photo-area" id="stool-photo-area" onclick="document.getElementById('stool-photo-input').click()">
          <div class="photo-placeholder"> 点击拍照或选择图片</div>
          <input type="file" id="stool-photo-input" accept="image/*" capture="environment" style="display:none" onchange="App._handlePhoto(event)">
        </div>
        <div id="stool-photo-content"></div>
        <div id="stool-photo-actions" style="display:none;margin-top:8px">
          <div class="ai-disabled-label" id="btn-recognize" role="status">AI功能暂未启用</div>
        </div>
      </div>
      <div class="form-group">
        <label>时间</label>
        <input type="time" id="stool-time" class="form-input" value="${timeStr}">
      </div>
      <div class="form-group">
        <label>颜色</label>
        <div class="option-group" id="stool-color-opts">
          ${APP_CONFIG.stoolColors.map(c => `
            <div class="option-btn" data-color="${c.value}" onclick="App._selectStoolColor('${c.value}')">
              <span class="opt-icon">${Lucide.icon(c.icon || 'circle-dot', 22)}</span><span class="opt-label">${c.label}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label>性状</label>
        <div class="option-group" id="stool-consistency-opts">
          ${APP_CONFIG.stoolConsistencies.map(c => `
            <div class="option-btn" data-consistency="${c.value}" onclick="App._selectStoolConsistency('${c.value}')">
              <span class="opt-icon">${Lucide.icon(c.icon || 'circle-dot', 22)}</span><span class="opt-label">${c.label}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label>量级</label>
        <div class="option-group" id="stool-amount-opts">
          ${APP_CONFIG.stoolAmounts.map(a => `
            <div class="option-btn" data-amount="${a.value}" onclick="App._selectStoolAmount('${a.value}')">
              <span class="opt-icon">${Lucide.icon(a.icon || 'circle-dot', 22)}</span><span class="opt-label">${a.label}</span>
            </div>`).join('')}
        </div>
      </div>
      <div class="form-group"><label>备注</label><input type="text" id="stool-note" class="form-input" placeholder="可选"></div>
      <button class="btn btn-primary btn-block" onclick="App._submitStool()">保存</button>
    `);
    // 回填上一次记录的高亮
    if (this._stoolColor) this._selectStoolColor(this._stoolColor);
    if (this._stoolConsistency) this._selectStoolConsistency(this._stoolConsistency);
    if (this._stoolAmount) this._selectStoolAmount(this._stoolAmount);

    // 新增②：AI 关闭或离线时三步引导灰化（识别步骤不可用）
    if (window.__UI_V3__ && (Utils.storage.get('aiOff') || Utils.isOffline())) {
      const steps = document.getElementById('stool-photo-steps');
      if (steps) {
        steps.querySelectorAll('.step').forEach(s => { if (parseInt(s.dataset.step) >= 2) s.classList.add('disabled'); });
        steps.querySelectorAll('.step-arrow').forEach(a => a.classList.add('ai-off'));
      }
    }
  },

  /** 新增②：拍照三步引导步骤推进 */
  _setStoolPhotoStep(activeNo) {
    document.querySelectorAll('#stool-photo-steps .step').forEach(s => {
      const no = parseInt(s.dataset.step);
      s.classList.toggle('done', no < activeNo);
      s.classList.toggle('active', no === activeNo);
    });
  },

  _stoolColor: '',
  _stoolConsistency: '',
  _stoolAmount: '',
  _selectStoolColor(color) {
    this._stoolColor = color;
    $$('#stool-color-opts .option-btn').forEach(b => b.classList.toggle('selected', b.dataset.color === color));
  },
  _selectStoolConsistency(consistency) {
    this._stoolConsistency = consistency;
    $$('#stool-consistency-opts .option-btn').forEach(b => b.classList.toggle('selected', b.dataset.consistency === consistency));
  },
  _selectStoolAmount(amount) {
    this._stoolAmount = amount;
    $$('#stool-amount-opts .option-btn').forEach(b => b.classList.toggle('selected', b.dataset.amount === amount));
  },

  _handlePhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    this.stoolPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('stool-photo-content').innerHTML = `<img src="${e.target.result}" class="photo-preview" alt="照片">`;
      document.getElementById('stool-photo-area').classList.add('has-photo');
      // 新增②：上传后步骤推进（① 完成 → ② 高亮）
      this._setStoolPhotoStep(2);
      const aiOff = Utils.storage.get('aiOff');
      const offline = Utils.isOffline();
      if (aiOff || offline) {
        document.getElementById('stool-photo-actions').style.display = 'none';
        const tip = document.getElementById('stool-photo-aioff');
        if (tip) {
          tip.style.display = '';
          tip.textContent = offline ? ' 离线时拍照识别不可用，可手动选色/性状' : ' 识别已关闭，可手动选色/性状';
        }
      } else {
        document.getElementById('stool-photo-actions').style.display = '';
      }
    };
    reader.readAsDataURL(file);
  },

  async _recognizePhoto() {
    if (!this.stoolPhotoFile) return;
    // R8：离线时 AI 识别不可用（识别依赖云端大模型）
    if (Utils.isOffline()) { Utils.showToast(' 离线时照片识别不可用，请联网后再试'); return; }
    const aiOff = Utils.storage.get('aiOff');
    if (aiOff) { Utils.showToast('拍照识别已关闭'); return; }
    const btn = document.getElementById('btn-recognize');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> AI识别中...';
    try {
      const base64 = await this._readFileAsBase64(this.stoolPhotoFile);
      const result = await API.recognizeStoolPhoto(base64.split(',')[1]);
      if (!result.recognized) { Utils.showToast(result.message || '无法识别'); return; }
      if (result.color) this._selectStoolColor(result.color);
      if (result.consistency) this._selectStoolConsistency(result.consistency);
      const content = document.getElementById('stool-photo-content');
      const img = content?.querySelector('img');
      if (img) {
        const label = result.description || `${result.colorLabel || ''} ${result.consistencyLabel || ''}`;
        content.innerHTML = `<div style="position:relative"><img src="${img.src}" class="photo-preview"><div class="photo-ai-label"> AI: ${label}</div></div>`;
      }
      Utils.showToast('识别完成: ' + (result.description || ''));
      this._aiRecognized = true;
      // 新增②：识别成功 → ③ 确认结果高亮
      this._setStoolPhotoStep(3);
    } catch (e) { Utils.showToast('识别失败: ' + e.message); }
    finally { btn.disabled = false; btn.textContent = ' 重新识别'; }
  },

  _readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async _submitStool() {
    if (!this._stoolColor || !this._stoolConsistency) { Utils.showToast('请选择颜色和性状'); return; }
    const time = this._timeToISO(document.getElementById('stool-time').value);
    const note = document.getElementById('stool-note')?.value || '';

    Utils.showLoading('保存中...');
    try {
      await API.createStool({
        type: 'stool', time, color: this._stoolColor, consistency: this._stoolConsistency, amount: this._stoolAmount,
        hasPhoto: !!this.stoolPhotoFile, photoUrl: '', aiRecognized: this._aiRecognized, note, inputMethod: 'table'
      });
      Utils.setLastStoolInput({ color: this._stoolColor, consistency: this._stoolConsistency, amount: this._stoolAmount });
      Utils.hideLoading();
      this._closeModal();
      this.stoolPhotoFile = null; this._aiRecognized = false;
      this._stoolColor = ''; this._stoolConsistency = ''; this._stoolAmount = '';
      Utils.showToast(' 已保存');
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('保存失败: ' + e.message); }
  },

  // ===== 小便/尿不湿快捷记录 =====
  async quickAddUrination(type) {
    Utils.showLoading('保存中...');
    try {
      await API.createStool({
        type, time: new Date().toISOString(), color: '', consistency: '',
        hasPhoto: false, photoUrl: '', aiRecognized: false, note: '', inputMethod: 'quick'
      });
      Utils.hideLoading();
      Utils.showToast(' 已记录' + (type === 'urine' ? '小便' : '换尿不湿'));
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('保存失败: ' + e.message); }
  },

  // ===== 体温表单 =====
  openTempForm() {
    this._showModal(' 记录体温', `
      <div class="form-group">
        <label>体温 (°C)</label>
        <input type="number" id="temp-value" class="form-input" placeholder="如：36.8" step="0.1" inputmode="decimal">
      </div>
      <div class="form-group"><label>备注</label><input type="text" id="temp-note" class="form-input" placeholder="可选"></div>
      <div class="text-muted" style="font-size:12px;margin-bottom:12px">${APP_CONFIG.healthReference.tempRef.note}</div>
      <button class="btn btn-primary btn-block" onclick="App._submitTemp()">保存</button>
    `);
    setTimeout(() => document.getElementById('temp-value')?.focus(), 100);
  },

  async _submitTemp() {
    const temp = parseFloat(document.getElementById('temp-value').value);
    if (!temp || temp < 35 || temp > 42) { Utils.showToast('请输入有效体温（35-42°C）'); return; }
    const note = document.getElementById('temp-note')?.value || '';
    const status = Utils.getTempStatus(temp);
    if (status.value >= 38) {
      if (!confirm(`体温 ${temp}°C 已发热（${status.label}），建议物理降温并多喝水。如持续高热请及时就医。确认保存？`)) return;
    }

    Utils.showLoading('保存中...');
    try {
      await API.createHealth({ recordType: 'temperature', date: Utils.todayStr(), value: temp, note });
      Utils.hideLoading();
      this._closeModal();
      Utils.showToast(` 已记录 ${temp}°C (${status.label})`);
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('保存失败: ' + e.message); }
  },

  // ===== 成长记录表单 =====
  openGrowthForm() {
    this._showModal(' 记录测量数据', `
      <div class="form-group"><label>日期</label><input type="date" id="growth-date" class="form-input" value="${Utils.todayStr()}"></div>
      <div class="form-group"><label>体重 (斤)</label><input type="number" id="growth-weight" class="form-input" placeholder="如：13" step="0.1" inputmode="decimal"></div>
      <div class="form-group"><label>身长 (cm)</label><input type="number" id="growth-height" class="form-input" placeholder="如：65" step="0.1" inputmode="decimal"></div>
      <div class="form-group"><label>头围 (cm)</label><input type="number" id="growth-head" class="form-input" placeholder="如：42" step="0.1" inputmode="decimal"></div>
      <div class="form-group"><label>备注</label><input type="text" id="growth-note" class="form-input" placeholder="可选"></div>
      <button class="btn btn-primary btn-block" onclick="App._submitGrowth()">保存</button>
    `);
  },

  async _submitGrowth() {
    const date = document.getElementById('growth-date').value;
    // v98：录入单位改为斤，存储仍换算为 kg（成长曲线/百分位计算基于 kg 标准）
    const weightJin = parseFloat(document.getElementById('growth-weight').value) || null;
    const weight = weightJin != null ? Math.round(weightJin / 2 * 100) / 100 : null;
    const height = parseFloat(document.getElementById('growth-height').value) || null;
    const headCircumference = parseFloat(document.getElementById('growth-head').value) || null;
    const note = document.getElementById('growth-note')?.value || '';
    if (!weight && !height && !headCircumference) { Utils.showToast('至少填写一项测量值'); return; }

    Utils.showLoading('保存中...');
    try {
      await API.createGrowth({ date, weight, height, headCircumference, note });
      Utils.hideLoading();
      this._closeModal();
      Utils.showToast(' 已保存');
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('保存失败: ' + e.message); }
  },

  // ===== 营养打卡 =====
  async toggleNutrition(name, dose) {
    Utils.showLoading();
    try {
      await API.createHealth({ recordType: 'nutrition', date: Utils.todayStr(), name, value: dose });
      Utils.hideLoading();
      Utils.showToast(' 已打卡');
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('打卡失败: ' + e.message); }
  },

  // ===== 护理打卡 =====
  async toggleNursing(name) {
    Utils.showLoading();
    try {
      await API.createHealth({ recordType: 'nursing', date: Utils.todayStr(), name });
      Utils.hideLoading();
      Utils.showToast(' 已完成');
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('打卡失败: ' + e.message); }
  },

  // ===== 记录里程碑 =====
  async recordMilestone(key, domain, label) {
    this._showModal(` 记录 "${label}"`, `
      <div class="form-group"><label>日期</label><input type="date" id="ms-date" class="form-input" value="${Utils.todayStr()}"></div>
      <div class="form-group"><label>备注</label><input type="text" id="ms-note" class="form-input" placeholder="可选，记录这一刻的感受"></div>
      <button class="btn btn-primary btn-block" onclick="App._submitMilestone('${key.replace(/'/g, "\\'")}', '${domain}', '${label.replace(/'/g, "\\'")}')">保存</button>
    `);
  },

  async _submitMilestone(key, domain, label) {
    const date = document.getElementById('ms-date').value;
    const note = document.getElementById('ms-note')?.value || '';
    Utils.showLoading('保存中...');
    try {
      await API.createMilestone({ milestoneKey: key, milestoneLabel: label, domain, date, note });
      Utils.hideLoading();
      this._closeModal();
      Utils.showToast(' 已记录');
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('保存失败: ' + e.message); }
  },

  // ===== 报表 =====
  async viewReport(type) {
    Utils.showLoading('生成报表中...');
    try {
      const data = type === 'daily' ? await API.dailyReport() : await API.weeklyReport();
      Utils.hideLoading();
      this._showModal(type === 'daily' ? ' 今日日报' : ' 本周周报', this._reportHTML(data, type));
    } catch (e) { Utils.hideLoading(); Utils.showToast('生成失败: ' + e.message); }
  },

  _reportHTML(data, type) {
    const baby = Utils.getBabyInfo();
    let html = `<div style="text-align:center;margin-bottom:16px"><h3>${Utils.escapeHtml(baby.name || '宝宝')} ${type === 'daily' ? '今日' : '本周'}概览</h3></div>`;
    if (data.feeding) {
      html += `<div class="card"><div class="card-title"> 喂养</div>`;
      html += `<div class="card-row"><span>总量</span><span>${data.feeding.totalML || 0} ml</span></div>`;
      html += `<div class="card-row"><span>次数</span><span>${data.feeding.count || 0} 次</span></div>`;
      html += `</div>`;
    }
    if (data.stool) {
      html += `<div class="card"><div class="card-title"> 排便</div>`;
      html += `<div class="card-row"><span>大便</span><span>${data.stool.count || 0} 次</span></div>`;
      html += `</div>`;
    }
    return html + `<button class="btn btn-secondary btn-block" onclick="App._closeModal()">关闭</button>`;
  },

  // ===== 导出 =====
  async exportData() {
    if (!confirm('将导出每日汇总数据（CSV格式），确认？')) return;
    Utils.showLoading('正在生成CSV...');
    try {
      // 获取最近30天的数据
      const endDate = Utils.todayStr();
      const startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const snapshot = await API.getUnifiedSnapshot({ startDate, endDate });
      const feeding = { records: snapshot.records?.feeding || [] };
      const stool = { records: snapshot.records?.stool || [] };
      const sleep = { records: snapshot.records?.sleep || [] };

      // 按天汇总
      const dailyMap = {};
      feeding.records.forEach(r => {
        const d = Utils.formatDate(r.time);
        if (!dailyMap[d]) dailyMap[d] = { milk: 0, feedCount: 0, breastCount: 0 };
        dailyMap[d].milk += r.amount || 0;
        dailyMap[d].feedCount++;
        if (r.type === 'breast') dailyMap[d].breastCount++;
      });
      stool.records.forEach(r => {
        const d = Utils.formatDate(r.time);
        if (!dailyMap[d]) dailyMap[d] = {};
        const type = r.type || 'stool';
        if (type === 'urine') dailyMap[d].urine = (dailyMap[d].urine || 0) + 1;
        else if (type === 'diaper') dailyMap[d].diaper = (dailyMap[d].diaper || 0) + 1;
        else dailyMap[d].stool = (dailyMap[d].stool || 0) + 1;
      });
      sleep.records.forEach(r => {
        const d = Utils.formatDate(r.startTime);
        if (!dailyMap[d]) dailyMap[d] = {};
        dailyMap[d].sleep = (dailyMap[d].sleep || 0) + (r.duration || 0);
      });

      let csv = '日期,奶量(ml),喂养次数,母乳次数,睡眠时长(分钟),大便次数,小便次数,换尿不湿次数\n';
      Object.keys(dailyMap).sort().forEach(d => {
        const v = dailyMap[d];
        csv += `${d},${v.milk || 0},${v.feedCount || 0},${v.breastCount || 0},${v.sleep || 0},${v.stool || 0},${v.urine || 0},${v.diaper || 0}\n`;
      });

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `baby-tracker-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      Utils.hideLoading();
      Utils.showToast(` 已导出 ${Object.keys(dailyMap).length} 天数据`);
    } catch (e) { Utils.hideLoading(); Utils.showToast('导出失败: ' + e.message); }
  },

  // ===== 邀请码 =====
  async showInviteCode() {
    Utils.showLoading();
    try {
      const result = await API.getInviteCode();
      Utils.hideLoading();
      this._showModal(' 家庭邀请码', `
        <div style="text-align:center;padding:20px 0">
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:var(--primary)">${result.inviteCode}</div>
          <p class="text-muted mt-16">分享给家人，输入此码即可加入家庭</p>
          <button class="btn btn-primary mt-16" onclick="navigator.clipboard.writeText('${result.inviteCode}').then(()=>Utils.showToast('已复制'))">复制邀请码</button>
        </div>
      `);
    } catch (e) { Utils.hideLoading(); Utils.showToast('获取失败: ' + e.message); }
  },

  // ===== 绑定码 =====
  async showBindingCode() {
    Utils.showLoading();
    try {
      const result = await API.generateBindingCode();
      Utils.hideLoading();
      this._showModal(' 账号绑定码', `
        <div style="text-align:center;padding:20px 0">
          <div style="font-size:36px;font-weight:700;letter-spacing:4px;color:var(--primary)">${result.code}</div>
          <p class="text-muted mt-16">在小程序端输入此码，可将两个账号绑定</p>
          <p class="text-muted" style="font-size:11px">有效期5分钟</p>
        </div>
      `);
    } catch (e) { Utils.hideLoading(); Utils.showToast('获取失败: ' + e.message); }
  },

  // ===== Push 推送管理 =====
  showPushManagement() {
    const pushConfig = Utils.storage.get('pushConfig') || {};
    const token = pushConfig.pushToken || Utils.storage.get('pushToken') || '';
    const dailyTime = pushConfig.dailyTime || '21:00';
    const weeklyDay = pushConfig.weeklyDay || '周日';
    const weeklyTime = pushConfig.weeklyTime || '20:00';
    const monthlyTime = pushConfig.monthlyTime || '20:00';

    const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    this._showModal(' 推送管理', `
      <div class="form-group">
        <label>PushPlus Token（家庭管理员配置）</label>
        <input type="text" id="push-token-input" class="form-input" placeholder="32位Token，在 pushplus.plus 获取" value="${Utils.escapeHtml(token)}">
        <p class="text-muted" style="font-size:11px;margin-top:4px">家庭成员共享此Token，推送将发送到该Token绑定的微信</p>
      </div>

      <div style="margin-top:16px;margin-bottom:8px;font-size:14px;font-weight:600"> 日报推送</div>
      <div class="push-config-row">
        <div>
          <div class="push-config-label">日报</div>
          <div class="push-config-desc">每天推送当日汇总</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:12px;color:var(--text-secondary)">每天</span>
          <input type="time" id="push-daily-time" class="push-config-time-input" value="${dailyTime}">
        </div>
      </div>

      <div style="margin-top:16px;margin-bottom:8px;font-size:14px;font-weight:600"> 周报推送</div>
      <div class="push-config-row">
        <div>
          <div class="push-config-label">周报</div>
          <div class="push-config-desc">每周推送本周汇总</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <select id="push-weekly-day" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px">
            ${weekDays.map(d => `<option value="${d}" ${d === weeklyDay ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
          <input type="time" id="push-weekly-time" class="push-config-time-input" value="${weeklyTime}">
        </div>
      </div>

      <div style="margin-top:16px;margin-bottom:8px;font-size:14px;font-weight:600"> 月报推送</div>
      <div class="push-config-row">
        <div>
          <div class="push-config-label">月报</div>
          <div class="push-config-desc">每月最后一天推送月度汇总</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:12px;color:var(--text-secondary)">月末</span>
          <input type="time" id="push-monthly-time" class="push-config-time-input" value="${monthlyTime}">
        </div>
      </div>

      <div style="margin-top:16px">
        <button class="btn btn-primary btn-block" onclick="App._savePushManagement()"> 保存配置</button>
        <button class="btn btn-outline btn-block mt-8" onclick="App._testPushManagement()"> 立即推送测试</button>
      </div>
    `);
  },

  _savePushManagement() {
    const token = document.getElementById('push-token-input')?.value?.trim();
    const dailyTime = document.getElementById('push-daily-time')?.value || '21:00';
    const weeklyDay = document.getElementById('push-weekly-day')?.value || '周日';
    const weeklyTime = document.getElementById('push-weekly-time')?.value || '20:00';
    const monthlyTime = document.getElementById('push-monthly-time')?.value || '20:00';

    if (!token) { Utils.showToast('请输入PushPlus Token'); return; }

    const config = { pushToken: token, dailyTime, weeklyDay, weeklyTime, monthlyTime };
    Utils.storage.set('pushConfig', config);
    Utils.storage.set('pushToken', token);

    // 保存到云端
    API.savePushToken(token).catch(() => {});
    Utils.showToast(' 推送配置已保存');
    this._closeModal();
  },

  async _testPushManagement() {
    const token = document.getElementById('push-token-input')?.value?.trim();
    if (!token) { Utils.showToast('请先输入PushPlus Token'); return; }

    Utils.showLoading('生成报表并推送中...');
    try {
      const result = await API.pushReport(token);
      Utils.hideLoading();
      Utils.showToast(result.pushed ? ' 已推送到微信' : '推送失败: ' + (result.pushError || ''));
    } catch (e) { Utils.hideLoading(); Utils.showToast('推送失败: ' + e.message); }
  },

  // ===== AI 开关 =====
  toggleAI(checked) {
    Utils.storage.set('aiOff', !checked);
    Utils.showToast(checked ? '已开启拍照识别' : '已关闭拍照识别', 2000, checked ? 'success' : 'info');
    // 新增②：设置页卡片即时反馈（红点/徽标/文案随开关联动，无需刷新）
    if (window.__UI_V3__) {
      const card = document.querySelector('.ai-switch-card');
      if (!card) return;
      card.classList.toggle('ai-off', !checked);
      const main = card.querySelector('.ai-card-main');
      const desc = card.querySelector('.ai-card-desc');
      const title = card.querySelector('.ai-card-title');
      const badge = card.querySelector('.ai-card-badge');
      const dot = card.querySelector('.ai-off-dot');
      if (!checked) {
        if (dot) dot.remove();
        if (badge) badge.remove();
        if (desc) desc.textContent = '已关闭 · 可手动选色/性状';
        if (main) main.insertAdjacentHTML('afterend', '<span class="ai-off-dot" title="AI 识别已关闭"></span>');
      } else {
        if (dot) dot.remove();
        if (desc) desc.textContent = '拍便便照片，点击「识别」自动填色/性状';
        if (title && !badge) title.insertAdjacentHTML('beforeend', ' <span class="ai-card-badge">唯一 AI 功能 · 手动触发</span>');
      }
    }
  },

  // V2 双通道开关（P0 · R11）——v96 设置需求 #3：开关已下线，全量强制 V2。
  // 此方法保留仅为兼容旧缓存页面的 onchange 引用：无论传什么都强制 V2 并刷新。
  // 应急回退通道不变：localStorage.forceRollback==='1' 优先级最高（运维专用）。
  toggleUIv2() {
    try { localStorage.setItem('uiVersion', 'v2'); } catch (e) { /* 隐私模式降级 */ }
    location.reload();
  },

  // 切换/退出家庭（保留所有数据，只跳转到登录页）
  switchFamily() {
    if (confirm('确定要切换家庭吗？当前数据将保留，您可以随时切换回来。')) {
      Utils.storage.set('switchingFamily', true);
      showPage('onboarding');
    }
  },

  // ===== 登录相关 =====
  async _submitLogin() {
    const nickname = document.getElementById('login-nickname')?.value?.trim();
    const familyId = document.getElementById('login-familyId')?.value?.trim();
    const inviteCode = document.getElementById('login-inviteCode')?.value?.trim();
    const lockCode = document.getElementById('login-lockCode')?.value?.trim()?.toUpperCase();

    if (!nickname) { Utils.showToast('请输入昵称'); return; }
    if (!familyId) { Utils.showToast('请输入家庭编号'); return; }
    if (!inviteCode || inviteCode.length < 5) { Utils.showToast('请输入正确的邀请码'); return; }
    if (!lockCode || lockCode.length < 5) { Utils.showToast('请输入账号锁定码'); return; }

    const btn = document.getElementById('btn-login-submit');
    btn.disabled = true; btn.textContent = '登录中...';

    Utils.showLoading('验证中...');
    try {
      await Auth.loginByCode(familyId, inviteCode, lockCode, nickname);
      Utils.storage.remove('switchingFamily');
      // 刷新完整profile确保数据最新
      try { await Auth.getProfile(); } catch(e) { console.warn('refresh after login:', e.message); }
      Utils.hideLoading();
      Utils.showToast(' 登录成功！欢迎「' + nickname + '」');

      // 确保关闭所有modal
      App._closeModal();

      // 检查是否有宝宝档案
      const baby = Utils.storage.get('baby');
      if (!baby || !baby._id) {
        showPage('dashboard');
        setTimeout(() => {
          const name = prompt('请输入宝宝姓名/小名：');
          if (name) {
            const birthDate = prompt('请输入出生日期 (YYYY-MM-DD)：', '2026-06-24');
            if (birthDate) {
              const birthTime = prompt('请输入出生时间 (HH:MM，如 14:30)，可留空：', '');
              const birthDateTime = birthTime ? birthDate + 'T' + birthTime : birthDate;
              const gender = confirm('性别：确定=男，取消=女') ? 'male' : 'female';
              const birthWeight = parseFloat(prompt('出生体重 (克，如 3250)：', '3250')) || null;
              const birthHeight = parseFloat(prompt('出生身高 (cm，如50)：', '50')) || null;
              Utils.showLoading('创建宝宝档案...');
              API.createBaby({ name, birthDate: birthDateTime, gender, birthWeight, birthWeightUnit: 'g', birthHeight, birthHeightUnit: 'cm' }).then(async () => {
                await Auth.getProfile();
                Utils.hideLoading();
                showPage('dashboard');
              }).catch(e => { Utils.hideLoading(); Utils.showToast('创建失败: ' + e.message); });
            }
          }
        }, 500);
      } else {
        showPage('dashboard');
      }
    } catch (e) {
      Utils.hideLoading();
      btn.disabled = false; btn.textContent = ' 登录';
      Utils.showToast('登录失败: ' + e.message);
    }
  },

  _goCreateFamily() {
    const nickname = document.getElementById('login-nickname')?.value?.trim() || '';
    this._showModal(' 创建新家庭', `
      <div class="form-group">
        <label>家庭名称</label>
        <input type="text" id="create-family-name" class="form-input" placeholder="如：我们一家" autofocus>
      </div>
      <div class="form-group">
        <label>您的昵称</label>
        <input type="text" id="create-family-nickname" class="form-input" placeholder="如：妈妈" value="${Utils.escapeHtml(nickname)}">
      </div>
      <p class="text-muted" style="font-size:12px;margin-bottom:12px">创建后将生成家庭编号、邀请码和锁定码，<br>请务必截图保存以便家人登录。</p>
      <button class="btn btn-success btn-block" onclick="App._doCreateFamily()">确认创建</button>
    `);
    setTimeout(() => document.getElementById('create-family-name')?.focus(), 100);
  },

  async _doCreateFamily() {
    const familyName = document.getElementById('create-family-name')?.value?.trim();
    const nickname = document.getElementById('create-family-nickname')?.value?.trim();
    if (!familyName) { Utils.showToast('请输入家庭名称'); return; }
    if (!nickname) { Utils.showToast('请输入昵称'); return; }

    Utils.showLoading('创建家庭中...');
    try {
      const result = await Auth.createFamily(familyName, nickname);
      Utils.storage.remove('switchingFamily');
      Utils.hideLoading();
      this._closeModal();

      // 显示创建结果（关键凭证）
      const familyId = result.familyId;
      const inviteCode = result.inviteCode;
      const lockCode = result.lockCode;
      this._showModal(' 家庭创建成功！', `
        <div style="text-align:center;padding:16px 0">
          <div style="font-size:48px;margin-bottom:12px"></div>
          <p style="font-size:14px;color:var(--text-secondary);margin-bottom:16px"><strong>请截图保存以下信息！</strong><br>家人登录需要这些凭证</p>

          <div class="credential-card">
            <div class="credential-label">家庭编号</div>
            <div class="credential-value" id="cred-family-id" style="font-size:20px;font-weight:700;color:var(--primary);margin-bottom:4px">${familyId}</div>
          </div>
          <div class="credential-card">
            <div class="credential-label">邀请码</div>
            <div class="credential-value" style="font-size:28px;font-weight:700;letter-spacing:6px;color:var(--success)">${inviteCode}</div>
          </div>
          <div class="credential-card">
            <div class="credential-label">账号锁定码</div>
            <div class="credential-value" style="font-size:28px;font-weight:700;letter-spacing:6px;color:var(--warning)">${lockCode}</div>
          </div>

          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-outline" style="flex:1" onclick="navigator.clipboard.writeText('家庭编号: ${familyId}\\n邀请码: ${inviteCode}\\n锁定码: ${lockCode}').then(()=>Utils.showToast('已复制到剪贴板'))"> 复制全部</button>
            <button class="btn btn-primary" style="flex:1" onclick="App._afterCreateFamily()"> 开始使用</button>
          </div>
        </div>
      `);
    } catch (e) { Utils.hideLoading(); Utils.showToast('创建失败: ' + e.message); }
  },

  async _afterCreateFamily() {
    this._closeModal();
    // 创建宝宝档案
    const name = prompt('请输入宝宝姓名/小名：');
    if (name) {
      const birthDate = prompt('请输入出生日期 (YYYY-MM-DD)：', '2026-06-24');
      if (birthDate) {
        const birthTime = prompt('请输入出生时间 (HH:MM，如 14:30)，可留空：', '');
        const birthDateTime = birthTime ? birthDate + 'T' + birthTime : birthDate;
        const gender = confirm('性别：确定=男，取消=女') ? 'male' : 'female';
        const birthWeight = parseFloat(prompt('出生体重 (克，如 3250)：', '3250')) || null;
        const birthHeight = parseFloat(prompt('出生身高 (cm，如50)：', '50')) || null;
        Utils.showLoading('创建宝宝档案...');
        try {
          await API.createBaby({ name, birthDate: birthDateTime, gender, birthWeight, birthWeightUnit: 'g', birthHeight, birthHeightUnit: 'cm' });
          await Auth.getProfile();
          Utils.hideLoading();
        } catch (e) { Utils.hideLoading(); Utils.showToast('宝宝创建失败: ' + e.message); }
      }
    }
    showPage('dashboard');
    this._maybeShowFirstUseGuide();
  },

  // ===== R7 K5：首用引导 3 步（建档案→记录喂养→看报表，scroll-snap 横滑） =====
  _maybeShowFirstUseGuide() {
    if (!window.__UI_V3__) return;
    // 注意：Utils.storage.get/set 自动带 babycare_ 前缀，这里传短 key
    if (Utils.storage.get('firstUseV2')) return;
    if (!Utils.storage.get('familyId')) return;
    Utils.storage.set('firstUseV2', '1');
    this._showFirstUseGuide();
  },
  _showFirstUseGuide() {
    if (document.getElementById('v2-guide')) return;
    const slides = [
      { icon: '', title: '建档案，月龄自动算', desc: '记录宝宝出生日期后，月龄、疫苗计划、成长曲线全部自动生成，不用自己算。' },
      { icon: '', title: '3 秒记一次喂养', desc: '喝奶、便便、睡眠一键记录；想偷懒时用语音，说一句话就记好。' },
      { icon: '', title: '每周自动出报告', desc: '成长曲线、睡眠分析、里程碑一目了然，还能一键分享给家人。' }
    ];
    const overlay = document.createElement('div');
    overlay.id = 'v2-guide';
    overlay.className = 'v2-guide';
    overlay.innerHTML = `
      <div class="v2-guide-track" id="v2-guide-track">
        ${slides.map((s, i) => `
          <div class="v2-guide-slide">
            <div class="v2-guide-icon">${s.icon}</div>
            <h3>${s.title}</h3>
            <p>${s.desc}</p>
            <div class="v2-guide-dots">
              ${slides.map((_, j) => `<span class="dot${j === i ? ' active' : ''}"></span>`).join('')}
            </div>
          </div>`).join('')}
      </div>
      <div class="v2-guide-actions">
        <button class="btn btn-primary" id="v2-guide-next">下一步</button>
        <button class="v2-guide-skip" id="v2-guide-skip" aria-label="跳过引导">跳过引导</button>
      </div>
    `;
    document.body.appendChild(overlay);
    const track = overlay.querySelector('#v2-guide-track');
    const nextBtn = overlay.querySelector('#v2-guide-next');
    const total = slides.length;
    let idx = 0;
    const refresh = () => { nextBtn.textContent = idx === total - 1 ? '开始使用' : '下一步'; };
    nextBtn.addEventListener('click', () => {
      if (idx < total - 1) {
        idx++;
        try { track.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' }); }
        catch (e) { track.scrollLeft = idx * track.clientWidth; }
        refresh();
      } else {
        overlay.remove();
      }
    });
    overlay.querySelector('#v2-guide-skip').addEventListener('click', () => overlay.remove());
  },
  async createFamilyAndBaby() {
    const nickname = document.getElementById('obo-nickname')?.value?.trim();
    if (!nickname) { Utils.showToast('请输入昵称'); return; }
    Utils.showLoading('创建家庭中...');
    try {
      await Auth.createFamily(nickname, nickname);
      Utils.hideLoading();
      const name = prompt('请输入宝宝姓名/小名：');
      if (!name) { showPage('dashboard'); return; }
      const birthDate = prompt('请输入出生日期 (YYYY-MM-DD)：', '2026-06-24');
      if (!birthDate) { showPage('dashboard'); return; }
      const birthTime = prompt('请输入出生时间 (HH:MM，如 14:30)，可留空：', '');
      const birthDateTime = birthTime ? birthDate + 'T' + birthTime : birthDate;
      const gender = confirm('性别：确定=男，取消=女') ? 'male' : 'female';
      const birthWeight = parseFloat(prompt('出生体重 (克，如 3250)：', '3250')) || null;
      const birthHeight = parseFloat(prompt('出生身高 (cm，如50)：', '50')) || null;
      Utils.showLoading('创建宝宝档案...');
      await API.createBaby({ name, birthDate: birthDateTime, gender, birthWeight, birthWeightUnit: 'g', birthHeight, birthHeightUnit: 'cm' });
      await Auth.getProfile();
      Utils.hideLoading();
      Utils.showToast(`欢迎「${nickname}」！`);
      showPage('dashboard');
      this._maybeShowFirstUseGuide();
    } catch (e) { Utils.hideLoading(); Utils.showToast('创建失败: ' + e.message); }
  },

  async submitJoinFamily() {
    const code = document.getElementById('invite-code-input')?.value?.trim();
    const nickname = document.getElementById('obo-nickname')?.value?.trim();
    if (!code || code.length !== 6) { Utils.showToast('请输入6位邀请码'); return; }
    if (!nickname) { Utils.showToast('请输入昵称'); return; }
    Utils.showLoading('验证中...');
    try {
      const valid = await API.validateInviteCode(code);
      await Auth.joinFamily(code, nickname);
      Utils.hideLoading();
      Utils.showToast(`已加入「${valid.familyName}」！`);
      const baby = Utils.storage.get('baby');
      if (!baby) {
        const name = prompt('请输入宝宝姓名/小名：');
        if (name) {
          const birthDate = prompt('请输入出生日期 (YYYY-MM-DD)：', '2026-06-24');
          if (birthDate) {
            const birthTime = prompt('请输入出生时间 (HH:MM，如 14:30)，可留空：', '');
            const birthDateTime = birthTime ? birthDate + 'T' + birthTime : birthDate;
            const gender = confirm('性别：确定=男，取消=女') ? 'male' : 'female';
            const birthWeight = parseFloat(prompt('出生体重 (克，如 3250)：', '3250')) || null;
            const birthHeight = parseFloat(prompt('出生身高 (cm，如50)：', '50')) || null;
            Utils.showLoading('创建宝宝档案...');
            await API.createBaby({ name, birthDate: birthDateTime, gender, birthWeight, birthWeightUnit: 'g', birthHeight, birthHeightUnit: 'cm' });
            await Auth.getProfile();
            Utils.hideLoading();
          }
        }
      }
      showPage('dashboard');
    } catch (e) { Utils.hideLoading(); Utils.showToast(e.message); }
  },

  // ===== 今日心情 =====
  setMood(moodKey) {
    if (!Auth.isAdmin()) { Utils.showToast('仅管理员可修改心情'); return; }
    const mood = APP_CONFIG.moodEmojis.find(m => m.key === moodKey);
    if (!mood) return;
    Utils.setTodayMood(mood);
    // 心情使用本地头像与文字标签，不渲染 Unicode 图标
    const moodDisplay = document.getElementById('current-mood-display');
    if (moodDisplay) moodDisplay.textContent = mood.label;
    // 更新宝宝心情选中状态（只更新宝宝那行）
    const babyRow = document.getElementById('mood-picker-row');
    if (babyRow) {
      babyRow.querySelectorAll('.mood-emoji').forEach(el => el.classList.toggle('active', el.title === mood.label));
    }
    Utils.showToast(mood.label);
  },

  setMomMood(moodKey) {
    if (!Auth.isAdmin()) { Utils.showToast('仅管理员可修改心情'); return; }
    const mood = APP_CONFIG.moodEmojis.find(m => m.key === moodKey);
    if (!mood) return;
    Utils.setMomMood(mood);
    // 更新妈妈心情选中状态
    const momRow = document.getElementById('mom-mood-picker-row');
    if (momRow) {
      momRow.querySelectorAll('.mood-emoji').forEach(el => el.classList.toggle('active', el.title === mood.label));
    }
    Utils.showToast(mood.label);
  },

  openMoodPicker() {
    // 滚动到心情选择器
    const row = document.getElementById('mood-picker-row');
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.style.animation = 'pulse 0.5s ease';
      setTimeout(() => row.style.animation = '', 500);
    }
  },

  // ===== 完成未打卡项（首页合并卡） =====
  async _completeUnchecked(type, name, dose) {
    Utils.showLoading();
    try {
      if (type === 'nutrition') {
        await API.createHealth({ recordType: 'nutrition', date: Utils.todayStr(), name, value: dose });
      } else {
        await API.createHealth({ recordType: 'nursing', date: Utils.todayStr(), name });
      }
      Utils.hideLoading();
      Utils.showToast('已完成');
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('操作失败: ' + e.message); }
  },

  // ===== 追加护理打卡（已达上限后仍可继续） =====
  async _addExtraNursing(name) {
    Utils.showLoading();
    try {
      await API.createHealth({ recordType: 'nursing', date: Utils.todayStr(), name });
      Utils.hideLoading();
      Utils.showToast('已追加打卡');
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('操作失败: ' + e.message); }
  },

  // ===== 清洁快捷记录 =====
  async quickClean(type) {
    const typeConfig = APP_CONFIG.cleanTypes.find(t => t.value === type);
    const label = typeConfig ? typeConfig.label : type;
    Utils.showLoading();
    try {
      await API.createClean({ type, time: new Date().toISOString(), inputMethod: 'quick' });
      Utils.hideLoading();
      Utils.showToast('已记录: ' + label);
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('记录失败: ' + e.message); }
  },

  // ===== 下楼溜溜快捷操作 =====
  async quickWalk() {
    // 使用云端 API
    try {
      const activeRes = await API.getActiveWalk();
      const active = activeRes?.active;

      if (active) {
        // 结束溜溜
        const now = new Date();
        const start = new Date(active.startTime);
        const min = Math.round((now - start) / 60000);
        Utils.showLoading('保存中...');
        await API.updateWalk(active._id, { endTime: now.toISOString(), duration: min });
        Utils.hideLoading();
        Utils.showToast(' 回家啦！遛了' + min + '分钟');
      } else {
        // 开始溜溜
        Utils.showLoading('记录中...');
        await API.createWalk({ startTime: new Date().toISOString(), endTime: null, note: '' });
        Utils.hideLoading();
        Utils.showToast(' 开始遛弯，注意安全~');
        this._startGlobalTimer();
      }
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('操作失败: ' + e.message);
    }
    // 刷新当前页面
    const cur = Pages.currentTab;
    if (cur === 'dashboard' || cur === 'quick-record' || cur === 'footprint') {
      showPage(cur);
    }
  },

  // ===== 奶量控件（v73：±10 加减 + 5ml 滑轨 + 快捷默认值） =====
  _amountCtrlHTML(inputId, value) {
    const presets = APP_CONFIG.feedingAmountPresets || [];
    return `
      <div class="amount-stepper">
        <button type="button" class="btn btn-outline amount-step-btn" onclick="App._stepAmount('${inputId}', -1)">−</button>
        <input type="number" id="${inputId}" class="form-input amount-input" min="1" max="500" inputmode="numeric" placeholder="如：120" value="${value}" oninput="App._syncAmountRange('${inputId}')" autofocus>
        <button type="button" class="btn btn-outline amount-step-btn" onclick="App._stepAmount('${inputId}', 1)">＋</button>
      </div>
      <input type="range" id="${inputId}-range" class="amount-range" min="10" max="300" step="${APP_CONFIG.feedingAmountRangeStep || 5}" value="${Math.max(10, Math.min(300, parseInt(value) || 100))}" oninput="App._rangeAmount('${inputId}', this.value)">
      ${presets.length ? `
      <div class="amount-presets">
        ${presets.map(v => `<button type="button" class="amount-preset-btn" onclick="App._setAmount('${inputId}', ${v})">${v}</button>`).join('')}
      </div>` : ''}
      <div class="text-muted" style="font-size:11px;margin-top:4px">点击 ± 每次 ${APP_CONFIG.feedingAmountStep || 10}ml · 滑动滑轨每次 ${APP_CONFIG.feedingAmountRangeStep || 5}ml · 点击数字快捷填充</div>
    `;
  },
  _stepAmount(inputId, dir) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const cur = parseInt(input.value) || 0;
    const next = Math.max(1, Math.min(500, cur + dir * (APP_CONFIG.feedingAmountStep || 10)));
    input.value = next;
    this._syncAmountRange(inputId);
  },
  _rangeAmount(inputId, val) {
    const input = document.getElementById(inputId);
    if (input) input.value = val;
  },
  _setAmount(inputId, val) {
    const input = document.getElementById(inputId);
    if (input) input.value = val;
    this._syncAmountRange(inputId);
  },
  _syncAmountRange(inputId) {
    const input = document.getElementById(inputId);
    const range = document.getElementById(inputId + '-range');
    if (input && range) range.value = input.value;
  },

  // ===== 配方奶快捷输入（默认回填上次奶量，删除语音模块） =====
  openFormulaForm() {
    const timeStr = Utils.formatDate(new Date(), 'HH:mm');
    const last = Utils.getLastFeedInput('formula');
    const lastAmount = last && last.amount ? parseInt(last.amount) : '';
    this._showModal('配方奶', `
      <div class="form-group">
        <label>奶量 (ml)</label>
        ${this._amountCtrlHTML('formula-amount', lastAmount)}
      </div>
      <div class="form-group">
        <label>时间</label>
        <input type="time" id="formula-time" class="form-input" value="${timeStr}">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="formula-note" class="form-input" placeholder="可选">
      </div>
      <button class="btn btn-primary btn-block" onclick="App._submitFormula()">保存</button>
    `);
  },

  async _submitFormula() {
    const amount = parseInt(document.getElementById('formula-amount')?.value);
    if (!amount || amount < 1 || amount > 500) { Utils.showToast('请输入合理奶量（1-500ml）'); return; }
    const timeInput = document.getElementById('formula-time').value;
    const note = document.getElementById('formula-note')?.value || '';
    const time = this._timeToISO(timeInput);

    Utils.showLoading('保存中...');
    try {
      await API.createFeeding({ feedingSubtype: 'bottle', milkSource: 'formula', time, offeredMl: amount, consumedMl: amount, note, inputMethod: 'quick' });
      Utils.setLastFeedInput('formula', { amount });
      Utils.hideLoading();
      this._closeModal();
      Utils.showToast('已保存');
      this._refreshCurrent();
    } catch (e) { Utils.showToast(e.isAuthError ? '登录已失效，请重新登录' : e.isTimeoutError ? '请求超时，请重试' : e.isFunctionNotFound ? '服务暂未部署' : e.isNetworkError ? '网络连接失败，请重试' : '保存失败: ' + e.message); }
    finally { Utils.hideLoading(); }
  },

  // ===== 母乳瓶喂快捷输入（默认回填上次奶量，删除语音模块） =====
  openBottleBreastForm() {
    const timeStr = Utils.formatDate(new Date(), 'HH:mm');
    const last = Utils.getLastFeedInput('bottle_breast');
    const lastAmount = last && last.amount ? parseInt(last.amount) : '';
    this._showModal('母乳瓶喂', `
      <div class="form-group">
        <label>奶量 (ml)</label>
        ${this._amountCtrlHTML('bottle-amount', lastAmount)}
      </div>
      <div class="form-group">
        <label>时间</label>
        <input type="time" id="bottle-time" class="form-input" value="${timeStr}">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="bottle-note" class="form-input" placeholder="可选">
      </div>
      <button class="btn btn-primary btn-block" onclick="App._submitBottleBreast()">保存</button>
    `);
  },

  async _submitBottleBreast() {
    if (this._feedingSubmitPending) return;
    const amount = parseInt(document.getElementById('bottle-amount')?.value);
    if (!amount || amount < 1 || amount > 500) { Utils.showToast('请输入合理奶量（1-500ml）'); return; }
    const timeInput = document.getElementById('bottle-time').value;
    const note = document.getElementById('bottle-note')?.value || '';
    const time = this._timeToISO(timeInput);
    const clientRequestId = globalThis.crypto?.randomUUID ? crypto.randomUUID() : `feeding-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this._feedingSubmitPending = true;
    Utils.showLoading('保存中...');
    try {
      await API.createFeeding({ feedingSubtype: 'bottle', feedingType: 'bottle', milkSource: 'breast_milk', time, occurredAt: time, offeredMl: amount, consumedMl: amount, amount, note, clientRequestId, clientEventId: clientRequestId, clientOperationId: clientRequestId, inputMethod: 'quick' });
      Utils.setLastFeedInput('bottle_breast', { amount });
      this._closeModal();
      Utils.showToast('已保存');
      this._refreshCurrent();
    } catch (e) {
      Utils.showToast(e.isAuthError ? '登录已失效，请重新登录' : e.isTimeoutError ? '请求超时，请重试' : e.isFunctionNotFound ? '服务暂未部署' : e.isNetworkError ? '网络连接失败，请重试' : '保存失败: ' + e.message);
    } finally {
      this._feedingSubmitPending = false;
      Utils.hideLoading();
    }
  },

  // ===== 睡眠手工记录/编辑（v73） =====
  openSleepForm(record) {
    this._sleepEditId = record ? record._id : null;
    const now = new Date();
    const startStr = record
      ? Utils.formatDate(record.startTime, 'HH:mm')
      : Utils.formatDate(new Date(now.getTime() - 3600000), 'HH:mm');
    const endStr = record ? Utils.formatDate(record.endTime, 'HH:mm') : Utils.formatDate(now, 'HH:mm');
    const note = record && record.note ? record.note : '';
    this._showModal(record ? ' 编辑睡眠记录' : ' 手工记录睡眠', `
      <div class="time-pair">
        <div class="form-group" style="flex:1;margin-bottom:10px">
          <label>开始时间</label>
          <input type="time" id="sleep-start" class="form-input" value="${startStr}" onchange="App._updateSleepPreview()">
        </div>
        <div class="form-group" style="flex:1;margin-bottom:10px">
          <label>结束时间</label>
          <input type="time" id="sleep-end" class="form-input" value="${endStr}" onchange="App._updateSleepPreview()">
        </div>
      </div>
      <div class="form-group">
        <label>哄睡方式</label>
        <select id="sleep-fall-method" class="form-input"><option value="">未记录</option><option value="breast" ${record?.fallAsleepMethod === 'breast' ? 'selected' : ''}>奶睡</option><option value="rock" ${record?.fallAsleepMethod === 'rock' ? 'selected' : ''}>摇晃</option><option value="pat" ${record?.fallAsleepMethod === 'pat' ? 'selected' : ''}>拍睡</option><option value="self" ${record?.fallAsleepMethod === 'self' ? 'selected' : ''}>自主入睡</option></select>
      </div>
      <div class="time-pair"><div class="form-group" style="flex:1"><label>夜醒次数</label><input type="number" id="sleep-wake-count" class="form-input" min="0" max="30" value="${Number(record?.wakeUpCount || 0)}"></div><div class="form-group" style="flex:1"><label>哭闹时长(分钟)</label><input type="number" id="sleep-cry-duration" class="form-input" min="0" max="600" value="${Number(record?.cryDuration || 0)}"></div></div>
      <div class="form-group"><label>睡眠质量</label><select id="sleep-quality" class="form-input"><option value="">未记录</option><option value="deep" ${record?.sleepQuality === 'deep' ? 'selected' : ''}>深睡</option><option value="light" ${record?.sleepQuality === 'light' ? 'selected' : ''}>浅睡</option><option value="restless" ${record?.sleepQuality === 'restless' ? 'selected' : ''}>睡眠不安</option></select></div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="sleep-note" class="form-input" placeholder="可选" value="${Utils.escapeHtml(note)}">
      </div>
      <div class="text-muted" style="font-size:12px;text-align:center;margin-bottom:12px" id="sleep-form-preview"></div>
      <button class="btn btn-primary btn-block" onclick="App._submitSleepForm()">${record ? '保存修改' : '保存'}</button>
    `);
    this._updateSleepPreview();
  },

  _updateSleepPreview() {
    const s = document.getElementById('sleep-start')?.value;
    const e = document.getElementById('sleep-end')?.value;
    const el = document.getElementById('sleep-form-preview');
    if (!el || !s || !e) return;
    let [sh, sm] = s.split(':').map(Number);
    let [eh, em] = e.split(':').map(Number);
    let dur = (eh * 60 + em) - (sh * 60 + sm);
    if (dur < 0) dur += 24 * 60; // 跨天
    el.textContent = ` 共 ${Math.floor(dur / 60)} 小时 ${dur % 60} 分`;
  },

  async _submitSleepForm() {
    const s = document.getElementById('sleep-start')?.value;
    const e = document.getElementById('sleep-end')?.value;
    const note = document.getElementById('sleep-note')?.value || '';
    const fallAsleepMethod = document.getElementById('sleep-fall-method')?.value || '';
    const wakeUpCount = Math.min(30, Math.max(0, Number(document.getElementById('sleep-wake-count')?.value || 0)));
    const cryDuration = Math.min(600, Math.max(0, Number(document.getElementById('sleep-cry-duration')?.value || 0)));
    const sleepQuality = document.getElementById('sleep-quality')?.value || '';
    if (!s || !e) { Utils.showToast('请选择开始和结束时间'); return; }
    const pair = Utils.pairTimesToISO(s, e);

    Utils.showLoading('保存中...');
    try {
      if (this._sleepEditId) {
        await API.updateSleep(this._sleepEditId, { startTime: pair.start, endTime: pair.end, note, fallAsleepMethod, wakeUpCount, cryDuration, sleepQuality });
      } else {
        await API.createSleep({ startTime: pair.start, endTime: pair.end, note, fallAsleepMethod, wakeUpCount, cryDuration, sleepQuality });
      }
      Utils.hideLoading();
      this._closeModal();
      this._sleepEditId = null;
      Utils.showToast(' 已保存');
      this._refreshCurrent();
    } catch (err) { Utils.hideLoading(); Utils.showToast('保存失败: ' + err.message); }
  },

  // ===== 辅食快捷输入 =====
  openSolidsForm() {
    const timeStr = Utils.formatDate(new Date(), 'HH:mm');
    this._showModal('辅食', `
      <div class="form-group">
        <label>量 (g)</label>
        <input type="number" id="solids-amount" class="form-input" placeholder="如：30" inputmode="numeric" autofocus>
      </div>
      <div class="form-group">
        <label>时间</label>
        <input type="time" id="solids-time" class="form-input" value="${timeStr}">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="solids-note" class="form-input" placeholder="如：米粉、果泥">
      </div>
      <button class="btn btn-primary btn-block" onclick="App._submitSolids()">保存</button>
    `);
    setTimeout(() => document.getElementById('solids-amount')?.focus(), 100);
  },

  async _submitSolids() {
    const amount = parseInt(document.getElementById('solids-amount')?.value);
    if (!amount || amount < 1 || amount > 500) { Utils.showToast('请输入合理量（1-500g）'); return; }
    const timeInput = document.getElementById('solids-time').value;
    const note = document.getElementById('solids-note')?.value || '';
    const time = this._timeToISO(timeInput);

    Utils.showLoading('保存中...');
    try {
      await API.createFeeding({ feedingSubtype: 'solids', time, amount, unit: 'g', note, inputMethod: 'quick' });
      Utils.hideLoading();
      this._closeModal();
      Utils.showToast('已保存');
      this._refreshCurrent();
    } catch (e) { Utils.hideLoading(); Utils.showToast('保存失败: ' + e.message); }
  },

  // ===== Tab图标自定义 =====
  setTabIcon(tabKey, emojiKey) {
    const icons = Utils.getTabIcons();
    if (emojiKey === null) {
      delete icons[tabKey];
    } else {
      icons[tabKey] = emojiKey;
    }
    Utils.setTabIcons(icons);
    Utils.showToast('已更新');
    // 保持在设置页刷新
    const tab = Pages.currentTab;
    if (tab === 'profile') showPage('profile');
  },

  // ===== 删除里程碑 =====
  async _deleteMilestone(recordId) {
    if (!confirm('确认删除此里程碑记录？')) return;
    try {
      await API.deleteMilestone(recordId);
      Utils.showToast('已删除');
      showPage('milestone');
    } catch (e) { Utils.showToast('删除失败: ' + e.message); }
  },

  // ===== 工具方法 =====
  _refreshCurrent() {
    const tab = Pages.currentTab;
    if (tab === 'dashboard') showPage('dashboard');
    else if (tab === 'parenting') ParentingPage._renderSub();
    else if (tab === 'quick-record') showPage('quick-record');
    else if (tab === 'analytics') showPage('analytics');
    else if (tab === 'functions') showPage('functions');
    else if (tab === 'milestone') showPage('milestone');
    else if (tab === 'report') showPage('report');
    else if (tab === 'profile') showPage('profile');
    else if (tab === 'medical') showPage('medical');
    else if (tab === 'growth-curve') showPage('growth-curve');
    else if (tab === 'footprint') showPage('footprint');
  },

  _timeToISO(timeStr) {
    if (!timeStr) return new Date().toISOString();
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m), 0, 0);
    return d.toISOString();
  },

  _installModalA11y() {
    if (this._modalA11yInstalled) return;
    this._modalA11yInstalled = true;
    this._modalOverlayStates = new WeakMap();
    const triggerSelector = '[onclick*="_showModal"], [onclick*="open"], [onclick*="createIllness"], [onclick*="openAllergyForm"]';
    const isNativeFocusable = node => /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(node.tagName);
    const prepareTrigger = trigger => {
      if (!trigger || trigger.dataset.r23TriggerA11y === 'true' || isNativeFocusable(trigger)) return;
      trigger.dataset.r23TriggerA11y = 'true';
      if (!trigger.hasAttribute('tabindex')) trigger.setAttribute('tabindex', '0');
      if (!trigger.hasAttribute('role')) trigger.setAttribute('role', 'button');
      trigger.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); trigger.click(); }
      });
    };
    const focusablesIn = dialog => [...dialog.querySelectorAll('button,input,select,textarea,[href],[tabindex]:not([tabindex="-1"])')].filter(node => !node.disabled && node.offsetParent !== null);
    const decorateOverlay = overlay => {
      const dialog = overlay.querySelector('.modal-content');
      if (!dialog || this._modalOverlayStates.has(overlay)) return;
      dialog.dataset.r23A11y = 'true';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      if (!dialog.getAttribute('aria-labelledby')) {
        const heading = dialog.querySelector('h1,h2,h3,.modal-title');
        if (heading) { heading.id ||= `modal-title-${Date.now()}`; dialog.setAttribute('aria-labelledby', heading.id); }
      }
      if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
      const previous = document.activeElement !== document.body ? document.activeElement : this._lastModalTrigger;
      const restore = () => { if (previous && document.contains(previous)) setTimeout(() => previous.focus(), 0); };
      const keydown = event => {
        if (!document.body.contains(overlay)) { document.removeEventListener('keydown', keydown); return; }
        if (event.key === 'Escape') { event.preventDefault(); overlay.remove(); restore(); return; }
        if (event.key !== 'Tab') return;
        const focusable = focusablesIn(dialog);
        if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
      };
      this._modalOverlayStates.set(overlay, { keydown, restore });
      document.addEventListener('keydown', keydown);
      overlay.addEventListener('click', () => setTimeout(() => { if (!document.body.contains(overlay)) restore(); }, 0), true);
      setTimeout(() => (focusablesIn(dialog)[0] || dialog).focus(), 0);
    };
    const prepareExisting = root => {
      root.querySelectorAll?.(triggerSelector).forEach(prepareTrigger);
      root.querySelectorAll?.('.modal-overlay').forEach(decorateOverlay);
      if (root.matches?.(triggerSelector)) prepareTrigger(root);
      if (root.matches?.('.modal-overlay')) decorateOverlay(root);
    };
    document.addEventListener('click', event => {
      const trigger = event.target.closest?.(triggerSelector);
      if (trigger) { prepareTrigger(trigger); this._lastModalTrigger = trigger; }
      const overlay = event.target.closest?.('.modal-overlay');
      if (overlay) decorateOverlay(overlay);
    }, true);
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(prepareExisting)));
    observer.observe(document.body, { childList: true, subtree: true });
    prepareExisting(document);
  },

  _showModal(title, bodyHTML) {
    let modal = document.getElementById('app-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'app-modal';
      modal.className = 'modal';
      modal.innerHTML = `<div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="app-modal-title" tabindex="-1"><div class="modal-title" id="app-modal-title"></div><div class="modal-body" id="app-modal-body"></div></div>`;
      modal.addEventListener('click', (e) => { if (e.target === modal) this._closeModal(); });
      document.body.appendChild(modal);
    }
    this._modalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = modal.querySelector('[role="dialog"]');
    this._modalKeydown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); this._closeModal(); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(node => !node.disabled && node.offsetParent !== null);
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', this._modalKeydown);
    // P2c（v94）→ v95 批次F 升级：v2 通道标题 emoji 前缀替换为 Lucide 图标
    //（v1 保持原 emoji 风格）；modal 正文内装饰性 emoji 一并就地转换
    let titleHTML = null;
    if (window.__UI_V3__) {
      const raw = String(title);
      const m = raw.match(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}][\u{FE0F}\u{200D}\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]*(?:\s|$)/u);
      const iconName = (m && window.Lucide) ? Lucide.emojiName(m[0].trim()) : null;
      const text = iconName ? raw.slice(m[0].length).trim() : raw;
      titleHTML = (iconName ? '<span style="display:inline-flex;align-items:center;vertical-align:-3px;margin-right:6px">' + Lucide.icon(iconName, 19) + '</span>' : '') + Utils.escapeHtml(text);
    }
    const titleEl = document.getElementById('app-modal-title');
    if (titleHTML !== null) titleEl.innerHTML = titleHTML; else titleEl.textContent = title;
    document.getElementById('app-modal-body').innerHTML = bodyHTML;
    // v2：正文文本节点 emoji → Lucide（数据语义类 emoji 无映射则原样保留）
    if (window.__UI_V3__ && window.Lucide) Lucide.replaceEmojiInDOM(document.getElementById('app-modal-body'));
    modal.classList.remove('hidden');
    const firstFocusable = dialog?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    setTimeout(() => (firstFocusable || dialog)?.focus(), 0);
  },

  _closeModal() {
    const modal = document.getElementById('app-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    if (this._modalKeydown) document.removeEventListener('keydown', this._modalKeydown);
    const trigger = this._modalTrigger;
    this._modalTrigger = null;
    this._modalKeydown = null;
    if (trigger && document.contains(trigger)) setTimeout(() => trigger.focus(), 0);
  },

  /** v95 批次F：监听 #content 渲染，把文本节点中的装饰性 emoji 就地替换为 Lucide SVG
      （幂等：已替换节点不再含 emoji 文本，重复处理为 no-op；数据语义 emoji 无映射原样保留） */
  _installEmojiLucide() {
    if (!window.Lucide || this._emojiObserver) return;
    const content = document.getElementById('content');
    if (!content || typeof MutationObserver === 'undefined') return;
    const self = this;
    const OPTS = { childList: true, subtree: true };
    let timer = null;
    const process = () => {
      self._emojiObserver.disconnect();
      try { Lucide.replaceEmojiInDOM(content, 16); } catch (e) { /* 静默：替换失败不阻断渲染 */ }
      self._emojiObserver.observe(content, OPTS);
    };
    this._emojiObserver = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(process, 80);
    });
    this._emojiObserver.observe(content, OPTS);
    process();
  }
};

// ===== 全局函数 =====
function showPage(page, params) {
  // 设置页需要登录态保护（v76）
  if (page === 'profile' && (!Auth || !Auth.isLocallyValid())) {
    if (typeof Utils !== 'undefined' && Utils.showToast) Utils.showToast('请先登录后再查看设置');
    page = 'onboarding';
    params = undefined;
  }
  Pages.render(page, params);
  // 使用 pushState/replaceState 更新 URL（不会触发 popstate，避免双渲染）
  try {
    const isTab = ['dashboard', 'quick-record', 'analytics', 'functions', 'assistant'].includes(page);
    const currentHash = window.location.hash.slice(1);
    if (isTab || currentHash === page) {
      history.replaceState({ page, params }, '', '#' + page);
    } else {
      history.pushState({ page, params }, '', '#' + page);
    }
  } catch (e) {
    // 某些浏览器（如微信内置浏览器）可能不支持 pushState，降级用 hash
    try { window.location.hash = page; } catch {}
  }
}
function goBack() {
  // 如果有历史记录则回退，否则回到首页
  if (window.history.length > 1) {
    window.history.back();
  } else {
    showPage('dashboard');
  }
}
function openSettings() {
  // 未登录时提示并重定向登录页（v76）
  if (!Auth || !Auth.isLocallyValid()) {
    Utils.showToast('请先登录后再查看设置');
    showPage('onboarding');
    return;
  }
  showPage('profile');
}
function stopVoice() { Voice.stop(); }

window.addEventListener('DOMContentLoaded', () => { App.init(); });
// popstate 仅在浏览器前进/后退时触发（pushState/replaceState 不会触发）
window.addEventListener('popstate', (e) => {
  // v71：报表全屏 overlay 打开时，按返回键优先关闭 overlay，不触发页面路由回退
  const reportOverlay = document.getElementById('report-overlay');
  if (reportOverlay) {
    if (typeof ReportPage !== 'undefined' && ReportPage._closeReport) {
      ReportPage._closeReport();
    } else {
      reportOverlay.remove();
      document.body.style.overflow = '';
    }
    return;
  }
  const page = (e.state && e.state.page) || window.location.hash.slice(1) || 'dashboard';
  const params = (e.state && e.state.params) || undefined;
  Pages.render(page, params);
});

// SW 更新自动应用（v68：无输入焦点时自动刷新，有输入时降级为手动 banner）
// 安全加固 v56 → v68 演进：不再一律弹提示，默认自动应用，仅用户正在输入时提示手动
if (('serviceWorker' in navigator) && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[App] Service Worker 已接管新版本');
    if (window.PWA) PWA._applyUpdate();
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SW_UPDATED') {
      console.log('[App] 收到 SW 更新通知');
      if (window.PWA) PWA._applyUpdate();
    }
  });
}

// ===== PWA =====
const PWA = {
  init() {
    if (window.matchMedia('(display-mode: standalone)').matches) this._dismissed = true;
    if (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') this._registerSW();
    this._listenInstall(); this._detectOffline();
  },
  _registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then(reg => {
        this._registration = reg;
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            // 新 SW 已安装但尚未接管：只发 SKIP_WAITING 让其激活，
            // 接管后 controllerchange 事件会触发 _applyUpdate() 刷新
            if (nw.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // 已有旧 SW → 立即通知其让位
                console.log('[App] 新版本已下载，等待激活');
                navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
              } else {
                // 无旧 SW（首次安装/旧 SW 已被清除）→ 主动 skipWaiting 让新 SW 立即接管
                // 避免卡在 waiting 状态导致页面一直跑旧缓存
                console.log('[App] 无旧 SW，直接激活新版本');
                nw.postMessage({ type: 'SKIP_WAITING' });
              }
            }
          });
        });
        // v68：主动定期检查更新（iOS 主屏幕 WebApp 不会自动轮询 SW 更新）
        this._scheduleUpdateCheck(reg);
        // v120：首次加载立即检查是否需要更新（上线新版本后，下次访问主屏幕 App 时自动弹更新提示）
        setTimeout(() => { reg.update().catch(() => {}); }, 5000);
      }).catch((err) => { console.warn('[PWA] SW 注册失败:', err); });
  },
  // v68：纯函数 — 判断是否可以自动刷新。
  // 无焦点（切后台/未聚焦）或焦点不在输入控件时返回 true，避免打断用户输入
  _shouldAutoApply() {
    if (typeof document.hasFocus === 'function' && !document.hasFocus()) return true;
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return false;
    return true;
  },
  // v68：应用新版本 — 无输入焦点时自动 reload，否则弹手动更新 banner
  _applyUpdate() {
    if (this._reloading) return; // 防抖：controllerchange 与 SW_UPDATED 可能双触发
    if (this._shouldAutoApply()) {
      this._reloading = true;
      if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      console.log('[App] 自动应用更新（无输入焦点）');
      window.location.reload();
    } else {
      console.log('[App] 用户正在输入，降级为手动更新提示');
      this._showUpdateBanner();
    }
  },
  // v120：新 SW 安装完成时立即弹更新提示，5 分钟内用户可手动点更新，超时自动 reload
  _showUpdateBanner() {
    if (document.getElementById('pwa-update-banner')) return;
    const b = document.createElement('div'); b.id = 'pwa-update-banner'; b.className = 'pwa-update-banner';
    b.innerHTML = '<span> 新版本已就绪</span><button class="pwa-update-btn" id="btn-pwa-update">立即更新</button>';
    document.body.appendChild(b);
    document.getElementById('btn-pwa-update').addEventListener('click', () => {
      if (this._reloading) return;
      this._reloading = true;
      if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    });
    // v120：5 分钟自动更新兜底（用户没点手动更新则超时自动 reload）
    setTimeout(() => {
      const banner = document.getElementById('pwa-update-banner');
      if (banner && !this._reloading) {
        this._reloading = true;
        if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    }, 5 * 60 * 1000);
  },
  // v68/v120：回到前台 / bFCache 恢复 / 每 5 分钟 主动触发 SW 更新检查
  _scheduleUpdateCheck(reg) {
    const check = () => {
      if (!navigator.onLine) return;
      reg.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    window.addEventListener('pageshow', (e) => { if (e.persisted) check(); });
    // v120：每 5 分钟检查一次（替换原来 60 分钟，减少等待时间）
    setInterval(check, 5 * 60 * 1000);
  },
  _listenInstall() {
    // V3 正常态不自动弹出安装提示，避免遮挡导航和记录表单；安装能力保留给后续明确用户操作。
    if (window.__UI_V3__) return;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); this._installPrompt = e;
      setTimeout(() => this._showInstallBanner(), 3000);
    });
    window.addEventListener('appinstalled', () => { this._installPrompt = null; this._dismissed = true; this._hideInstallBanner(); });
  },
  _showInstallBanner() {
    if (this._dismissed) return;
    if (document.getElementById('pwa-install-banner')) return;
    const b = document.createElement('div');
    b.id = 'pwa-install-banner'; b.className = 'pwa-install-banner';
    b.innerHTML = '<div class="pwa-install-icon"></div><div class="pwa-install-text"><strong>添加到主屏幕</strong><span>像App一样使用</span></div><button class="pwa-install-btn" id="btn-pwa-install">安装</button><button class="pwa-install-close" id="btn-pwa-dismiss"></button>';
    document.body.appendChild(b);
    requestAnimationFrame(() => b.classList.add('show'));
    document.getElementById('btn-pwa-install').addEventListener('click', () => this._doInstall());
    document.getElementById('btn-pwa-dismiss').addEventListener('click', () => this._dismissBanner());
  },
  async _doInstall() {
    if (!this._installPrompt) return;
    try { await this._installPrompt.prompt(); const r = await this._installPrompt.userChoice; if (r.outcome === 'accepted') { this._dismissed = true; this._installPrompt = null; } } catch {}
    this._hideInstallBanner();
  },
  _dismissBanner() { this._dismissed = true; this._hideInstallBanner(); },
  _hideInstallBanner() { const b = document.getElementById('pwa-install-banner'); if (b) { b.classList.remove('show'); setTimeout(() => b.remove(), 300); } },
  _detectOffline() {
    const update = () => {
      if (!navigator.onLine) {
        if (!document.getElementById('offline-bar')) {
          const b = document.createElement('div'); b.id = 'offline-bar'; b.className = 'offline-bar'; b.textContent = ' 当前离线';
          document.body.prepend(b);
        }
      } else { document.getElementById('offline-bar')?.remove(); }
    };
    window.addEventListener('online', update); window.addEventListener('offline', update); update();
  }
};

// v68 修复：必须挂到 window，顶部 controllerchange/SW_UPDATED 监听通过
// window.PWA 调用 _applyUpdate。此前 const PWA 未导出导致更新提示从不触发，
// 是"必须删掉重装才更新"的体验元凶之一
window.PWA = PWA;

document.addEventListener('DOMContentLoaded', () => { PWA.init(); });

// 禁止双击缩放
(function() {
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function(e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
})();

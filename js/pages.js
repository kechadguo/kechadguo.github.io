/**
 * 页面路由 — 委派到各页面模块（4-tab 导航 + 子页面）
 */
window.V3UI = window.V3UI || {
  _requestStats: null,
  _trackedCall: null,
  beginRequestTracking(page = '') {
    if (this._trackedCall || !window.API?.call) { this._requestStats = { total: 0, successes: 0, failed: 0, requiredFailed: 0, lastError: null }; return; }
    const original = window.API.call;
    const requiredActions = {
      analytics: new Set(['getUnifiedSnapshot']),
      parenting: new Set(['getUnifiedSnapshot']),
      messages: new Set(['list']),
      milestone: new Set(['list'])
    }[page] || new Set();
    const stats = { total: 0, successes: 0, failed: 0, requiredFailed: 0, lastError: null };
    const tracked = async function(...args) {
      stats.total += 1;
      const action = args[1]?.action;
      try { const result = await original.apply(this, args); stats.successes += 1; return result; }
      catch (error) { stats.failed += 1; if (requiredActions.has(action)) stats.requiredFailed += 1; stats.lastError = error; throw error; }
    };
    this._trackedCall = { original, tracked };
    this._requestStats = stats;
    window.API.call = tracked;
  },
  endRequestTracking() {
    const stats = this._requestStats || { total: 0, successes: 0, failed: 0, lastError: null };
    if (this._trackedCall && window.API?.call === this._trackedCall.tracked) window.API.call = this._trackedCall.original;
    this._trackedCall = null;
    this._requestStats = null;
    return stats;
  },
  applyRequestState(content, stats) {
    if (!content || !stats) return;
    const explicitState = content.dataset.v3RequestState || content.querySelector('[data-v3-state]')?.dataset.v3State || null;
    if (explicitState) {
      const labels = { 'auth-required': '请先登录', 'function-not-found': '服务暂未部署', timeout: '请求超时，请重试', offline: '当前离线', 'permission-denied': '暂无访问权限', error: '页面加载失败', conflict: '数据发生冲突', partial: '部分内容加载失败' };
      this.setStatus(explicitState, labels[explicitState] || '');
      return;
    }
    if (!stats.failed) {
      if (content.querySelector('.empty-state, .empty-state-sm, .v2-empty-mini, .empty-mini, .cs-empty, .checkup-empty, .med-sum-empty, .insurance-empty, .footprint-map-empty, [data-empty="true"]')) this.setStatus('empty', '暂无数据');
      else this.setStatus('loaded');
      return;
    }
    if (stats.requiredFailed === 0) {
      this.setStatus('loaded');
      return;
    }
    const state = this.errorState(stats.lastError);
    if (stats.successes > 0) {
      if (!content.querySelector('[data-v3-state="partial"]')) content.insertAdjacentHTML('afterbegin', this.stateHTML('partial', '部分内容加载失败', '已成功内容仍保留，可重试失败区域。', '<button class="btn btn-primary" type="button" onclick="Pages.render(Pages.currentTab)">重新加载</button>'));
      this.setStatus('partial', '部分内容加载失败');
      return;
    }
    if (!content.querySelector('[data-v3-state]')) content.innerHTML = this.stateHTML(state, state === 'offline' ? '当前离线' : state === 'permission-denied' ? '暂无访问权限' : state === 'auth-required' ? '请先登录' : state === 'conflict' ? '数据发生冲突' : '页面加载失败', '请稍后重试', '<button class="btn btn-primary" type="button" onclick="Pages.render(Pages.currentTab)">重新加载</button>');
    this.setStatus(state, state === 'offline' ? '当前离线' : '页面加载失败');
  },
  setStatus(state, message = '') {
    const content = document.getElementById('content');
    const status = document.getElementById('page-status');
    if (content) content.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    if (!status) return;
    status.className = `v3-page-status is-${state}`;
    status.textContent = message;
    status.hidden = !message;
  },
  stateHTML(state, title, desc = '', action = '') {
    const icon = ['error', 'function-not-found', 'permission-denied', 'auth-required', 'conflict', 'timeout'].includes(state) ? (state === 'auth-required' ? 'log-in' : (state === 'conflict' ? 'git-merge' : (state === 'permission-denied' ? 'lock' : (state === 'function-not-found' ? 'package-x' : (state === 'timeout' ? 'clock-3' : 'alert-circle'))))) : (state === 'empty' ? 'inbox' : (state === 'offline' ? 'wifi-off' : (state === 'success' ? 'check-circle' : (state === 'partial' ? 'triangle-alert' : 'loader-circle'))));
    const role = ['error', 'function-not-found', 'permission-denied', 'auth-required', 'conflict', 'timeout', 'partial'].includes(state) ? 'alert' : 'status';
    return `<section class="v3-state v3-state-${state}" data-v3-state="${state}" role="${role}"><div class="v3-state-icon" aria-hidden="true">${window.Lucide?.icon ? Lucide.icon(icon, 28) : ''}</div><h2>${Utils.escapeHtml(title)}</h2>${desc ? `<p>${Utils.escapeHtml(desc)}</p>` : ''}${action}</section>`;
  },
  errorState(error) {
    if (error?.isFunctionNotFound || error?.code === 'FUNCTION_NOT_FOUND' || error?.httpStatus === 404) return 'function-not-found';
    if (error?.isPermissionError || error?.httpStatus === 403 || error?.code === 4003) return 'permission-denied';
    if (error?.isAuthError || error?.code === 4008 || error?.code === 4009) return 'auth-required';
    if (error?.isConflict || error?.code === 'CONFLICT' || error?.httpStatus === 409) return 'conflict';
    const code = Number(error?.code || error?.status || error?.response?.code);
    if (error?.isTimeoutError) return 'timeout';
    if (error?.isNetworkError && navigator.onLine === false) return 'offline';
    return code === 4003 || code === 403 ? 'permission-denied' : 'error';
  }
};
window.Pages = {
  currentTab: 'dashboard',
  history: [],

  async render(page, params) {
    if (page === 'sleep-training') page = 'sleep-management';
    const content = document.getElementById('content');
    const backBtn = document.getElementById('btn-back');
    const titleEl = document.getElementById('page-title');
    if (!content || !backBtn || !titleEl) return;
    const renderSeq = (this._renderSeq || 0) + 1;
    this._renderSeq = renderSeq;
    content.dataset.renderSeq = String(renderSeq);
    content.dataset.renderPage = page;
    content.innerHTML = '';
    content.removeAttribute('data-v3-request-state');
    V3UI.setStatus('', '');
    V3UI.setStatus('loading', '页面加载中');
    V3UI.beginRequestTracking(page);
    if (['analytics', 'messages', 'parenting'].includes(page) && !Auth?.getLocalAuth?.()?.token) {
      content.innerHTML = V3UI.stateHTML('auth-required', '请先登录', page === 'parenting' ? '登录后才能查看成长记录。' : page === 'messages' ? '登录后才能查看家庭消息。' : '登录后才能查看数据分析。', `<button class="btn btn-primary" type="button" onclick="showPage('onboarding')">去登录</button>`);
      content.setAttribute('data-v3-request-state', 'auth-required');
      V3UI.endRequestTracking();
      V3UI.setStatus('auth-required', '请先登录');
      return;
    }

    // R10 K4：v2 通道切换页面先出骨架屏（页面 render 内部用真实内容覆盖；
    // 同步页 <300ms 覆盖不闪烁；异步页数据到达前显示呼吸块 → CLS 友好）
    if (window.__UI_V3__ && content) {
      const kind = page === 'report' ? 'report' : (page === 'dashboard' ? 'dashboard' : 'list');
      content.innerHTML = Utils.skeletonHTML(kind);
    }

    // 底部 tab 高亮
    $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));

    // 页面标题和返回按钮
    const pageConfig = {
      dashboard: { title: 'OneOne', showBack: false },
      'quick-record': { title: '快速记录', showBack: false },
      analytics: { title: '数据分析', showBack: false },
      functions: { title: '功能', showBack: false },
      'parenting-lib': { title: '育儿百科', showBack: true },
      assistant: { title: 'AI助手', showBack: false },
      messages: { title: '消息中心', showBack: true },
      parenting: { title: '成长日记', showBack: true },
      milestone: { title: '里程碑', showBack: true },
      report: { title: '数据报表', showBack: true },
      'growth-curve': { title: '成长曲线', showBack: true },
      'sleep-management': { title: '睡眠管理', showBack: true },
      'language-development': { title: '语言发展', showBack: true },
      'social-development': { title: '社交发展', showBack: true },
      safety: { title: '安全与急救', showBack: true },
      food: { title: '辅食', showBack: true },
      medical: { title: '健康管理', showBack: true },
      'footprint': { title: '足迹', showBack: true },
      exercise: { title: '运动发展', showBack: true },
      'exercise-development': { title: '运动发展', showBack: true },
      'early-education': { title: '早期教育', showBack: true },
      profile: { title: '设置', showBack: true },
      screening: { title: '新生儿筛查', showBack: true },
      onboarding: { title: '欢迎使用', showBack: false },
      'feeding-success': { title: '记录成功', showBack: true },
      'stool-success': { title: '记录成功', showBack: true }
    };

    const cfg = pageConfig[page] || { title: '成长日记', showBack: true };
    titleEl.textContent = cfg.title;
    backBtn.style.display = cfg.showBack ? '' : 'none';

    this.currentTab = page;

    // 如果不是底部tab页面，记录历史
    if (!['dashboard', 'quick-record', 'analytics', 'functions', 'assistant'].includes(page)) {
      this.history.push(page);
    }

    // 委派渲染；完整页面脚本由构建入口预加载，保持真实 handler 不变
    try {
    switch (page) {
      case 'dashboard':
        await DashboardPage.render(content);
        break;
      case 'quick-record':
        await QuickRecordPage.render(content);
        break;
      case 'analytics':
        if (window.AnalyticsPage) {
          await AnalyticsPage.render(content);
        } else {
          content.innerHTML = '<div class="loading-state"><p>加载中...</p></div>';
        }
        break;
      case 'functions':
        ModulesPage.render(content);
        break;
      case 'assistant':
        content.innerHTML = `<div class="card"><div class="card-title">${Lucide.icon('bot', 20)} AI助手</div><div class="ai-disabled-label" role="status">AI功能暂未启用</div><p class="text-muted" style="margin-top:10px">当前版本仅提供确定性知识入口，不连接模型或外部服务。</p><button class="btn btn-outline btn-block" style="margin-top:14px" onclick="showPage('parenting-lib')">${Lucide.icon('book-open', 18)} 浏览育儿百科</button></div>`;
        break;
      case 'messages':
        await MessageCenterPage.render(content);
        break;
      case 'parenting':
        await ParentingPage.render(content, params);
        break;
      case 'milestone':
        await MilestonePage.render(content);
        break;
      case 'report':
        await ReportPage.render(content);
        break;
      case 'profile':
        await ProfilePage.render(content);
        break;
      case 'screening':
        await ScreeningPage.render(content);
        break;
      case 'growth-curve':
        await GrowthCurvePage.render(content);
        break;
      case 'sleep-management':
        await SleepTrainingPage.render(content);
        break;
      case 'language-development':
        await LanguageDevelopmentPage.render(content);
        break;
      case 'social-development':
        await SocialDevelopmentPage.render(content);
        break;
      case 'safety':
        await SafetyPage.render(content);
        break;
      case 'food':
        await FoodPage.render(content);
        break;
      case 'medical':
        await MedicalPage.render(content);
        break;
      case 'footprint':
        await FootprintPage.render(content);
        break;
      case 'exercise':
      case 'exercise-development':
        await ExercisePage.render(content);
        break;
      case 'early-education':
        await EarlyEduPage.render(content);
        break;
      case 'parenting-lib':
        await ParentingLibPage.render(content);
        break;
      case 'onboarding':
        this._renderOnboarding(content);
        break;
      case 'feeding-success':
        this._renderSuccess(content, 'bottle', '喂养记录已保存', params);
        break;
      case 'stool-success':
        this._renderSuccess(content, 'check', '排便记录已保存', params);
        break;
      default:
        content.innerHTML = V3UI.stateHTML('empty', '页面不存在', '请返回上一页继续操作');
    }
    } catch (error) {
      if (renderSeq !== this._renderSeq) return;
      const state = V3UI.errorState(error);
      const retry = `<button class="btn btn-primary" type="button" onclick="showPage('${Utils.jsAttr(page)}')">重新加载</button>`;
        const title = state === 'function-not-found' ? '服务暂未部署' : (state === 'permission-denied' ? '暂无访问权限' : (state === 'auth-required' ? '请先登录' : (state === 'conflict' ? '数据发生冲突' : (state === 'timeout' ? '请求超时，请重试' : (state === 'offline' ? '当前离线' : '页面加载失败')))));
      const desc = state === 'function-not-found' ? '当前功能服务尚未部署，请稍后再试' : (state === 'permission-denied' ? '请切换到有权限的家庭或联系管理员' : (state === 'auth-required' ? '登录后才能查看此页面' : (state === 'conflict' ? '请刷新后重试' : (state === 'timeout' ? '请求超时，请重试' : (state === 'offline' ? '联网后可同步数据' : '请稍后重试')))));
      content.innerHTML = V3UI.stateHTML(state, title, desc, retry);
      V3UI.endRequestTracking();
      V3UI.setStatus(state, state === 'auth-required' ? '请先登录' : state === 'function-not-found' ? '服务暂未部署' : state === 'timeout' ? '请求超时，请重试' : title);
      return;
    }

    if (renderSeq !== this._renderSeq || content.dataset.renderSeq !== String(renderSeq) || content.dataset.renderPage !== page) return;
    // 页面模块自行处理业务数据和空态；路由只负责统一壳层状态。
    V3UI.applyRequestState(content, V3UI.endRequestTracking());
    content.scrollTop = 0;
  },

  _renderPlaceholder(content, icon, title, desc) {
    content.innerHTML = `
      <div class="empty-state" style="padding-top:80px">
        <div class="empty-icon" style="font-size:64px">${icon}</div>
        <h2 style="margin:16px 0 8px">${title}</h2>
        <p class="text-muted">${desc}</p>
        <p class="text-muted" style="font-size:12px;margin-top:8px">敬请期待 ${Lucide.icon('sparkles', 14)}</p>
      </div>
    `;
  },

  _renderMedicalPage(content) {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby.birthDate) {
      content.innerHTML = '<div class="empty-state"><div class="empty-icon">' + Lucide.icon('syringe', 32) + '</div><p>请先创建宝宝档案</p></div>';
      return;
    }
    const vaccines = Utils.getBabyVaccines(baby.birthDate) || [];
    const monthAge = Utils.calcMonthAge(baby.birthDate);
    content.innerHTML = `
      <div class="card">
        <div class="card-title">${Lucide.icon('syringe', 18)} 疫苗日程</div>
        <p class="text-muted" style="font-size:12px;margin-bottom:10px">根据宝宝月龄(${monthAge}个月)推荐</p>
        ${vaccines.length > 0 ? vaccines.map(v => `
          <div class="record-item">
            <div class="record-main">
              <div class="record-title">${Utils.escapeHtml(v.name || v.vaccine || '疫苗')}</div>
              <div class="record-meta">${Utils.escapeHtml(v.age || v.monthRange || '')} ${Utils.escapeHtml(v.dose || '')} ${v.note ? '· ' + Utils.escapeHtml(v.note) : ''}</div>
            </div>
          </div>
        `).join('') : '<p class="text-muted">暂无推荐疫苗</p>'}
      </div>
      <div class="card">
        <div class="card-title">${Lucide.icon('pill', 18)} 用药记录</div>
        <p class="text-muted text-center" style="padding:20px 0">用药记录功能即将上线</p>
      </div>
      <div class="disclaimer">${APP_CONFIG.disclaimer}</div>
    `;
  },

  _renderOnboarding(content) {
    // 已改为登录页，此方法保留兼容
    this._renderLoginPage(content);
  },

  _renderLoginPage(content) {
    const savedBaby = Utils.getBabyInfo();
    const todayMood = Utils.getTodayMood();
    const savedFamilyId = Auth.getSavedFamilyId();

    // 宝宝信息摘要
    let babyPreviewHTML = '';
    if (savedBaby && savedBaby._id) {
      const monthAge = Utils.calcMonthAgeToDays(savedBaby.birthDate);
      babyPreviewHTML = `
        <div class="welcome-baby-card">
          ${Utils.avatarVideoHTML(56)}
          <div class="welcome-baby-name">${Utils.escapeHtml(savedBaby.name || '宝宝')}</div>
          <div class="welcome-baby-age">${monthAge.months > 0 ? monthAge.months + '个月' + monthAge.days + '天' : monthAge.days + '天'}</div>
          ${todayMood ? `<div class="welcome-baby-mood">${Lucide.icon('smile', 16)} ${Utils.escapeHtml(todayMood.label || '')}</div>` : ''}
        </div>
      `;
    }

    content.innerHTML = `
      <div class="login-page">
        <div class="login-header">
          <div class="login-logo">
            ${Utils.avatarVideoHTML(72)}
          </div>
          <h1>OneOne成长日记</h1>
          <p class="login-subtitle">全家一起记录宝宝成长每一天</p>
        </div>

        ${babyPreviewHTML}

        <div class="card" style="text-align:left">
          <div class="form-group">
            <label>您的昵称</label>
            <input type="text" id="login-nickname" class="form-input" placeholder="如：妈妈/爸爸/奶奶" value="${savedBaby ? '妈妈' : ''}">
          </div>
          <div class="form-group">
            <label>家庭编号</label>
            <input type="text" id="login-familyId" class="form-input" placeholder="创建家庭后获得" value="${savedFamilyId || ''}">
          </div>
          <div class="form-group">
            <label>邀请码（6位）</label>
            <input type="text" id="login-inviteCode" class="form-input" placeholder="输入6位邀请码" maxlength="6" autocapitalize="characters">
          </div>
          <div class="form-group">
            <label>账号锁定码（8位字母数字）</label>
            <input type="text" id="login-lockCode" class="form-input" placeholder="创建家庭时生成的8位锁定码" maxlength="8" autocapitalize="characters">
          </div>
          <button class="btn btn-primary btn-block" onclick="App._submitLogin()" id="btn-login-submit">登录</button>

          <div class="login-divider">
            <span>或者</span>
          </div>
          <button class="btn btn-success btn-block" onclick="App._goCreateFamily()">创建新家庭</button>
        </div>

        <div class="login-footer">
          <p style="font-size:12px;color:var(--text-secondary)">首次使用？点击「创建新家庭」开始记录宝宝成长</p>
          <p style="font-size:11px;color:var(--text-light);margin-top:8px">可靠云端存储 · 家庭成员共享 · 隐私安全</p>
        </div>
      </div>
    `;
  },

  _renderSuccess(content, icon, msg, data) {
    // P3 修复：icon 为 Lucide 图标名（'bottle'/'check'），原先直接 ${icon} 会把英文单词渲染成文字
    content.innerHTML = `
      <div class="success-page">
        <div class="success-icon" style="font-size:64px;line-height:1">${Lucide.icon(icon, 56)}</div>
        <h2 style="margin-bottom:8px">${msg}</h2>
        <p class="feedback-text">数据已同步到云端，全家可见</p>
        <button class="btn btn-primary" onclick="showPage('dashboard')">返回首页</button>
        <button class="btn btn-secondary mt-8" onclick="showPage('quick-record')">继续记录</button>
      </div>
    `;
  }
};

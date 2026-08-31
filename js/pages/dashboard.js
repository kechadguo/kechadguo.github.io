/**
 * 首页 Dashboard — 纯展示内容 + 今日心情 + 合并待办打卡
 * v106: fix getLatestAssessment result unwrapping
 */
window.DashboardPage = {
  _showDailyKnowledgeTip(baby) {
    const key = 'daily-knowledge-tip-' + Utils.todayStr();
    if (localStorage.getItem(key)) return;
    const month = Utils.calcMonthAge(baby.birthDate);
    const tips = { 1: '本月重点：建立昼夜节律，白天多抱多活动，夜间保持安静暗光环境。', 3: '本月重点：多做俯卧练习，促进颈部和肩部肌肉发育。', 6: '本月重点：开始添加辅食，首选高铁米粉，观察新食物反应。', 12: '本月重点：鼓励安全探索，增加语言输入和亲子互动。' };
    setTimeout(() => { Utils.showToast('育儿知识 · ' + (tips[month] || '继续陪伴宝宝健康成长，按月龄观察和记录变化。'), 6000); localStorage.setItem(key, '1'); }, 1200);
  },
  async render(container) {
    try {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby._id) {
      container.innerHTML = Utils.emptyState({
        icon: Lucide.icon('heart-pulse', 32), title: '请先创建宝宝档案',
        desc: '建档后自动计算月龄与成长曲线',
        action: '<button class="btn btn-primary" onclick="showPage(\'onboarding\')">去设置</button>'
      });
      return;
    }

    // R7 K4：v2 通道先出骨架屏（>300ms 必出，数据到达后被真实内容覆盖）
    if (window.__UI_V3__) container.innerHTML = Utils.skeletonHTML('dashboard');

    const monthAgeData = Utils.calcMonthAgeToDays(baby.birthDate);
    const milestones = Utils.getBabyMilestones(baby.birthDate);
    const gender = baby.gender || 'male';

    // 月度推荐检查：自动发现并启用新月龄推荐项
    const monthlyRec = Utils.checkMonthlyRecommendations(baby.birthDate);
    if (monthlyRec && monthlyRec.hasNew) {
      setTimeout(() => {
        const nursingNames = monthlyRec.newNursing.map(i => i.name).join('、');
        const nutritionNames = monthlyRec.newNutrition.map(n => n.name).join('、');
        const parts = [];
        if (nursingNames) parts.push('护理: ' + nursingNames);
        if (nutritionNames) parts.push('营养: ' + nutritionNames);
        Utils.showToast('宝宝满' + monthlyRec.monthAge + '月，已自动推荐: ' + parts.join(' | '), 5000);
      }, 1000);
    }

    // 宝宝头像使用登录页同款动态 GIF；具体心情在头像卡片中更新
    const avatarImg = 'img/emoji/emoji-happy-animated-128.gif';
    const todayBadge = await this._loadTodayBadge();
    this._showDailyKnowledgeTip(baby);

    // 今日心情（可选，不影响头像）— v72：不再自动写入默认值，仅作展示回退
    let todayMood = Utils.getTodayMood() || APP_CONFIG.moodEmojis[0];

    // 并行加载所有今日数据 + 最新成长 + 待办 + 清洁 + 足迹
    let todayData = { feeding: null, stool: null, sleep: null, health: null, clean: null };
    let latestGrowth = null;
    let todoData = null;
    let latestAssessment = null;
    try {
      const [feeding, stool, sleep, health, growth, todo, clean, assessment] = await Promise.all([
        API.feedingTodaySummary().catch(() => null),
        API.stoolTodaySummary().catch(() => null),
        API.sleepTodaySummary().catch(() => null),
        API.healthTodaySummary().catch(() => null),
        API.listGrowth(1).catch(() => null),
        API.todayTodo().catch(() => null),
        API.cleanTodaySummary().catch(() => null),
        API.getLatestAssessment().catch(() => null)
      ]);
      todayData = { feeding, stool, sleep, health, clean };
      latestGrowth = growth && Array.isArray(growth.records) ? growth.records : [];
      todoData = todo;
      latestAssessment = assessment || null;
      // v107：云端无数据时从 sessionStorage 兜底（同一会话内切页面回来）
      if (!latestAssessment) {
        try {
          const cached = sessionStorage.getItem('latestAiAssessment');
          if (cached) latestAssessment = JSON.parse(cached);
        } catch(e) {}
      }
    } catch (e) { console.warn('加载数据失败', e); }

    // 刷新足迹统计（云端数据）
    if (window.FootprintPage) {
      await FootprintPage.refreshTodayStats().catch(() => {});
    }

    // 今日数据提取
    const todayMilk = todayData.feeding?.totalML || 0;
    const feedCount = todayData.feeding?.totalCount || 0;
    const breastCount = (todayData.feeding?.records || []).filter(r => r.type === 'breast').length;
    const todaySleep = todayData.sleep?.totalMinutes || 0;
    const todayTemp = todayData.health?.latestTemp;
    const stoolRecords = todayData.stool?.records || [];
    const stoolCount = stoolRecords.filter(r => !r.type || r.type === 'stool').length;
    const urineCount = stoolRecords.filter(r => r.type === 'urine').length;
    const nutritionRecords = todayData.health?.nutritionRecords || [];
    const nutritionNames = new Set(nutritionRecords.map(r => r.name));
    const cleanData = todayData.clean || {};
    const bathCount = cleanData.bath || 0;
    const shampooCount = cleanData.shampoo || 0;

    // R4 v2 专属：最近谁在记录（收集今日各类型记录 → 取最近记录人去重）
    const recentPool = [];
    if (todayData.feeding && todayData.feeding.records) recentPool.push(...todayData.feeding.records);
    if (todayData.stool && todayData.stool.records) recentPool.push(...todayData.stool.records);
    if (todayData.clean && todayData.clean.records) recentPool.push(...todayData.clean.records);
    if (todayData.health) {
      ['tempRecords', 'nutritionRecords', 'nursingRecords'].forEach(k => {
        (todayData.health[k] || []).forEach(r => {
          if (r && r.memberId) recentPool.push({ recorderMemberId: r.memberId, time: r.createdAt || r.time });
        });
      });
    }
    if (window.__UI_V3__ && window.CoopV2) {
      await CoopV2.ensureColors().catch(() => {});
    }

    // 自动生成待办：营养补充 + 每日护理
    const standardNutrition = Utils.getBabyNutrition(baby.birthDate);
    const standardNursing = Utils.getBabyNursing(baby.birthDate);
    const disabledNutritionKeys = Utils.getDisabledStandardNutritionKeys();
    const disabledNursingKeys = Utils.getDisabledStandardNursingKeys();
    const customNutrition = Utils.getCustomNutritionItems();
    const customNursing = Utils.getCustomNursingItems();
    const nursingRecords = todayData.health?.nursingRecords || [];
    const nursingCountMap = {};
    nursingRecords.forEach(r => { nursingCountMap[r.name] = (nursingCountMap[r.name] || 0) + 1; });

    // 获取首页显示设置
    const hiddenItems = Utils.getHiddenDashboardItems();

    // 构建自动待办列表
    const autoTodos = [];
    // 营养补充 → 自动待办（标准 + 自定义 - 禁用）
    standardNutrition.filter(n => !disabledNutritionKeys.includes(n.name)).forEach(n => {
      const key = 'nutrition_' + n.name;
      const done = nutritionNames.has(n.name);
      autoTodos.push({ key, type: 'nutrition', title: n.name, desc: n.dose || n.desc, name: n.name, dose: n.dose, doneCount: done ? 1 : 0, maxCount: 1, source: 'nutrition', hidden: hiddenItems.includes(key) });
    });
    customNutrition.forEach(n => {
      const key = 'nutrition_custom_' + n.name;
      const done = nutritionNames.has(n.name);
      autoTodos.push({ key, type: 'nutrition', title: n.name, desc: n.dose || n.desc, name: n.name, dose: n.dose, doneCount: done ? 1 : 0, maxCount: 1, source: 'custom_nutrition', hidden: hiddenItems.includes(key) });
    });
    // 每日护理 → 自动待办（标准 + 自定义 - 禁用）
    standardNursing.items.filter(item => !disabledNursingKeys.includes(item.name)).forEach(item => {
      const key = 'nursing_' + item.name;
      const freq = DashboardPage._parseFrequency(item.standard);
      const done = nursingCountMap[item.name] || 0;
      const maxCount = freq ? freq.max : 1;
      autoTodos.push({ key, type: 'nursing', title: item.name, desc: item.standard || '', name: item.name, doneCount: done, maxCount, source: 'nursing', hidden: hiddenItems.includes(key) });
    });
    customNursing.forEach(item => {
      const key = 'nursing_custom_' + item.name;
      const freq = DashboardPage._parseFrequency(item.standard || '每日1次');
      const done = nursingCountMap[item.name] || 0;
      const maxCount = freq ? freq.max : 1;
      autoTodos.push({ key, type: 'nursing', title: item.name, desc: item.standard || '', name: item.name, doneCount: done, maxCount, source: 'custom_nursing', hidden: hiddenItems.includes(key) });
    });

    // v79 #316：运动/早教每日打卡 → 自动待办（localStorage 按日存储，点击跳转对应页面打卡）
    if (window.getExercisePlan && window.ExerciseCheck) {
      const exCur = getExercisePlan(monthAgeData.months);
      const exTotal = exCur.plan.items.length;
      const exDone = Math.min(ExerciseCheck.count(), exTotal);
      autoTodos.push({ key: 'exercise_daily', type: 'exercise', title: '运动训练打卡', desc: exCur.plan.label + '阶段 · ' + exTotal + '项', name: '运动训练', doneCount: exDone, maxCount: exTotal, source: 'exercise', hidden: hiddenItems.includes('exercise_daily') });
    }
    if (window.EduCheck) {
      const eduDone = Math.min(EduCheck.count(), 3);
      autoTodos.push({ key: 'early_edu_daily', type: 'early_edu', title: '早教课程打卡', desc: '每日推荐 3 门', name: '早教课程', doneCount: eduDone, maxCount: 3, source: 'early_edu', hidden: hiddenItems.includes('early_edu_daily') });
    }

    // 过滤：不隐藏 + 未完成的自动待办
    const visibleAutoTodos = autoTodos.filter(t => !t.hidden && t.doneCount < t.maxCount);
    const completedAutoTodos = autoTodos.filter(t => !t.hidden && t.doneCount >= t.maxCount && t.doneCount > 0);

    // 手动待办（来自 todo 集合）
    const todoItems = (todoData?.records || []).map(t => ({
      type: 'todo', id: t._id, title: t.title, completed: t.completed, source: 'manual'
    }));
    const pendingTodos = todoItems.filter(t => !t.completed);
    const doneTodos = todoItems.filter(t => t.completed);

    const totalPending = pendingTodos.length + visibleAutoTodos.length;

    // 护理 + 营养完成度（供 AI 今日状态评估数据源，v83 合并）
    let careDone = 0, careTotal = 0;
    autoTodos.filter(t => !t.hidden).forEach(t => { careTotal += t.maxCount; careDone += Math.min(t.doneCount, t.maxCount); });

    // AI 一句话评估数据源（v78 #315：12 统计框 + 护理完成度 + 待办打卡）
    const tsDims = this._buildTsDims(todayData, monthAgeData, careDone, careTotal, totalPending, nutritionNames, nursingCountMap, pendingTodos, visibleAutoTodos);

    // v78 #315：12 统计框状态判定（ok/warn/danger/none → ds-st-* 着色）
    const statStatuses = this._statStatuses(todayData, monthAgeData, careDone, careTotal, totalPending);

    // R3 发热提醒卡（v118：首页明显位置，强提醒；≥37.5℃关注 / ≥38℃&月龄<3立即就医）
    const feverCardHTML = this._buildFeverCard(todayTemp, statStatuses.temp, monthAgeData.months);

    // R6 扩展：首页 12 维温和建议条（每个触发维度一条，区别于 stat 着色与洞察中心规则触发）
    const gentleBarHTML = this._buildGentleBars(statStatuses, {
      todayMilk, feedCount, breastCount, todaySleep, stoolCount, urineCount, todayTemp,
      nutritionNames, nursingRecords, bathCount, shampooCount, totalPending, monthAge: monthAgeData.months
    });

    // 里程碑倒计时
    const nextMilestones = milestones.next.flatMap(g => g.items).slice(0, 3);

    // 成长数据嵌入卡片（v98：身高/体重独立取最近一次含该字段的记录；体重 kg×2 显示斤；未记录显示 --；点击跳成长曲线页）
    let growthTagsHTML = '';
    {
      const growthRecs = Array.isArray(latestGrowth) ? latestGrowth : [];
      const heightRec = growthRecs.find(r => r && r.height);
      const weightRec = growthRecs.find(r => r && r.weight);
      const tags = [
        { label: '身高', value: heightRec ? heightRec.height : null, unit: 'cm', icon: 'ruler', date: heightRec ? heightRec.date : null },
        { label: '体重', value: weightRec ? Math.round(weightRec.weight * 2 * 10) / 10 : null, unit: '斤', icon: 'weight', date: weightRec ? weightRec.date : null }
      ];
      growthTagsHTML = tags.map(t => {
        const svg = t.icon === 'ruler'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4Z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/><path d="m4.5 13.5 2 2"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.46A2 2 0 0 0 17.5 8Z"/></svg>';
        const updateTime = t.date ? Utils.formatDate(new Date(t.date), 'MM月DD日 HH:mm') : '';
        return `<div class="growth-tag" onclick="showPage('growth-curve')">
          <span class="gt-label">${svg} ${t.label}</span>
          <span class="gt-value">${t.value != null ? t.value : '--'}<span class="gt-unit">${t.value != null ? t.unit : ''}</span></span>
          ${updateTime ? `<span class="gt-time">更新于 ${updateTime}</span>` : ''}
        </div>`;
      }).join('');
    }

    // 妈妈心情（v72：不再自动写入默认值，仅作展示回退）
    let momMood = Utils.getMomMood() || APP_CONFIG.moodEmojis[0];

    // 心情头像 key 映射（兼容旧 moodEmojis key，不在 _moodAvatars 里的回退 happy）
    const babyMoodKey = (this._moodAvatars[todayMood.key] ? todayMood.key : 'happy');
    const momMoodKey = (this._moodAvatars[momMood.key] ? momMood.key : 'happy');
    const babyAvatarCfg = this._moodAvatars[babyMoodKey];
    const momAvatarCfg = this._moodAvatars[momMoodKey];

    let html = `
      <!-- 宝宝信息卡（头像=心情GIF，点击切换；妈妈右侧并排） -->
      <div class="baby-info-card">
        <div class="bi-row">
          <!-- 宝宝头像（memoji GIF, 76px, 可点击更换） -->
          <div class="bi-avatar mood-avatar-tap" onclick="DashboardPage.openMoodSheet('baby')">
            <img src="${avatarImg}" onerror="this.onerror=null;this.src='img/emoji/emoji-happy.png';" id="baby-avatar-img" alt="宝宝">
            ${todayBadge ? `<span class="today-badge-near-avatar" title="今日解锁：${Utils.escapeHtml(todayBadge.milestoneLabel || todayBadge.badgeId || '成就徽章')}"></span>` : ''}
            <span class="mood-avatar-badge" style="background:${babyAvatarCfg.color}"></span>
          </div>
          <!-- 中间信息 -->
          <div class="bi-info">
            <div class="bi-name">${Utils.escapeHtml(baby.name) || '宝宝'}</div>
            <div class="bi-age">${this._monthAgeText(monthAgeData)}</div>
            <div class="bi-days">
              <span class="bi-days-num">${monthAgeData.total}</span>
              <span class="bi-days-label">天</span>
            </div>
          </div>
          <!-- 妈妈头像（memoji GIF, 同尺寸, 右侧并排, 可点击更换） -->
          <div class="bi-avatar mood-avatar-tap" onclick="DashboardPage.openMoodSheet('mom')">
            <img src="img/emoji/mom/emoji-${momMoodKey}-animated-128.gif" onerror="this.onerror=null;this.src='img/emoji/mom/emoji-${momMoodKey}.png';" id="mom-avatar-img" alt="妈妈">
            <span class="mood-avatar-badge" style="background:${momAvatarCfg.color}"></span>
          </div>
        </div>
        ${growthTagsHTML ? `<div class="bi-growth">${growthTagsHTML}</div>` : ''}
      </div>

      <!-- 疫苗接种提醒（接种前3天内展示） -->
      ${this._renderVaccineReminders()}

      <!-- R3 发热提醒卡（v118：首页明显位置强提醒） -->
      ${feverCardHTML}

      <!-- R4 v2 专属：最近谁在记录动态条 -->
      ${window.__UI_V3__ && window.CoopV2 ? CoopV2.renderRecent(recentPool, 3) : ''}

      <!-- 今日状态综合评估（v83 合并：AI 一句话，数据源=下方12统计+待办打卡） -->
      ${this._buildTodayStatus(tsDims, monthAgeData.months || 0, latestAssessment)}

      <!-- 当日小计颜色图例 -->
      <div class="dash-legend-bar">
        <span class="dl-item"><i class="dl-dot dl-ok"></i>达标</span>
        <span class="dl-item"><i class="dl-dot dl-warn"></i>关注</span>
        <span class="dl-item"><i class="dl-dot dl-danger"></i>警告</span>
        <span class="dl-item"><i class="dl-dot dl-none"></i>无数据</span>
      </div>

      <!-- 当日小计 (3行4列=12) -->
      <div class="dash-stat-row">
        <div class="dash-stat ds-st-${statStatuses.milk}" onclick="showPage('parenting','feeding')">
          <div class="ds-icon">${Lucide.icon('bottle', 20)}</div>
          <div class="ds-value">${todayMilk}</div>
          <div class="ds-label">奶量(ml)</div>
        </div>
        <div class="dash-stat ds-st-${statStatuses.breast}" onclick="showPage('parenting','feeding')">
          <div class="ds-icon">${Lucide.icon('heart-pulse', 20)}</div>
          <div class="ds-value">${breastCount}</div>
          <div class="ds-label">亲喂(次)</div>
        </div>
        <div class="dash-stat ds-st-${statStatuses.feeding}" onclick="showPage('parenting','feeding')">
          <div class="ds-icon">${Lucide.icon('bar-chart', 20)}</div>
          <div class="ds-value">${feedCount}</div>
          <div class="ds-label">喂养(次)</div>
        </div>
        <div class="dash-stat ds-st-${statStatuses.sleep}" onclick="showPage('parenting','sleep')">
          <div class="ds-icon">${Lucide.icon('moon', 20)}</div>
          <div class="ds-value" style="font-size:14px">${Utils.formatDuration(todaySleep)}</div>
          <div class="ds-label">睡眠</div>
        </div>
        <div class="dash-stat ds-st-${statStatuses.stool}" onclick="showPage('parenting','urination')">
          <div class="ds-icon">${Lucide.icon('droplet', 20)}</div>
          <div class="ds-value">${stoolCount}</div>
          <div class="ds-label">大便(次)</div>
        </div>
        <div class="dash-stat ds-st-${statStatuses.urine}" onclick="showPage('parenting','urination')">
          <div class="ds-icon">${Lucide.icon('droplet', 20)}</div>
          <div class="ds-value">${urineCount}</div>
          <div class="ds-label">小便(次)</div>
        </div>
        <div class="dash-stat ds-st-${statStatuses.temp}" onclick="showPage('parenting','health')">
          <div class="ds-icon">${Lucide.icon('thermometer', 20)}</div>
          <div class="ds-value" style="font-size:16px">${todayTemp || '--'}</div>
          <div class="ds-label">体温</div>
        </div>
        <div class="dash-stat ds-st-${statStatuses.nutrition}" onclick="showPage('parenting','health')">
          <div class="ds-icon">${Lucide.icon('pill', 20)}</div>
          <div class="ds-value">${nutritionNames.size}</div>
          <div class="ds-label">营养(项)</div>
        </div>
        <div class="dash-stat ds-st-${statStatuses.nursing}" onclick="showPage('parenting','health')">
          <div class="ds-icon">${Lucide.icon('heart-pulse', 20)}</div>
          <div class="ds-value">${nursingRecords.length}</div>
          <div class="ds-label">护理(次)</div>
        </div>
        <div class="dash-stat ds-st-${statStatuses.bath}" onclick="showPage('quick-record')">
          <div class="ds-icon">${Lucide.icon('bath', 20)}</div>
          <div class="ds-value">${bathCount}</div>
          <div class="ds-label">洗澡(次)</div>
        </div>
        <div class="dash-stat ds-st-${statStatuses.shampoo}" onclick="showPage('quick-record')">
          <div class="ds-icon">${Lucide.icon('hand', 20)}</div>
          <div class="ds-value">${shampooCount}</div>
          <div class="ds-label">洗头(次)</div>
        </div>
        <div class="dash-stat ds-st-${statStatuses.todo}" onclick="showPage('dashboard')">
          <div class="ds-icon">${Lucide.icon('clipboard-list', 20)}</div>
          <div class="ds-value">${totalPending}</div>
          <div class="ds-label">待办</div>
        </div>
      </div>

      <!-- R6 扩展：12 维温和建议条（v118：每个触发维度一条） -->
      ${gentleBarHTML}

      <!-- 足迹统计 -->
      ${this._renderFootprintStats()}

      <!-- 今日待办 & 打卡（合并） -->
      <div class="card">
        <div class="card-title">
          今日待办 & 打卡
          ${totalPending > 0 ? `<span class="badge badge-warning">${totalPending}</span>` : ''}
          <button class="btn btn-outline" style="font-size:12px;padding:4px 10px;margin-left:auto" onclick="App.openTodoForm()">+ 待办</button>
        </div>
        ${pendingTodos.length > 0 || visibleAutoTodos.length > 0 ? `
          <div${window.__UI_V3__ ? ' class="v2-stagger"' : ''}>
          ${pendingTodos.map(t => `
            <div class="todo-item">
              <div class="todo-check${window.__UI_V3__ ? ' v2-check' : ''}" onclick="App.toggleTodo('${t.id}', false)">${window.__UI_V3__ ? '<svg class="v2-checkmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 7"/></svg>' : ''}</div>
              <span class="todo-text">${Lucide.icon('clipboard-list', 16)} ${Utils.escapeHtml(t.title)}</span>
            </div>
          `).join('')}
          ${visibleAutoTodos.map(item => `
            <div class="todo-item">
              <div class="todo-check${window.__UI_V3__ ? ' v2-check' : ''} ${item.doneCount > 0 ? 'checked' : ''}" ${this._todoCheckAction(item)}>${item.doneCount > 0 ? item.doneCount : (window.__UI_V3__ ? '<svg class="v2-checkmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 7"/></svg>' : '')}</div>
              <span class="todo-text"${item.type === 'exercise' || item.type === 'early_edu' ? ` style="cursor:pointer" onclick="showPage('${item.type === 'exercise' ? 'exercise' : 'early-education'}')"` : ''}>${this._todoIcon(item.type)} ${Utils.escapeHtml(item.title)}</span>
              ${item.desc ? `<span class="text-muted" style="font-size:11px;margin-left:auto;white-space:nowrap">${item.doneCount > 0 ? item.doneCount + '/' + item.maxCount + '次' : Utils.escapeHtml(item.desc)}</span>` : ''}
            </div>
          `).join('')}
          </div>
        ` : '<div class="text-muted text-center" style="padding:8px 0;font-size:13px">全部完成！</div>'}
        ${(doneTodos.length > 0 || completedAutoTodos.length > 0) ? `
          <div class="todo-done-section${window.__UI_V3__ ? ' v2-stagger' : ''}">
            ${doneTodos.map(t => `
              <div class="todo-item">
                <div class="todo-check checked${window.__UI_V3__ ? ' v2-check' : ''}" onclick="App.toggleTodo('${t.id}', true)">${window.__UI_V3__ ? '<svg class="v2-checkmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 7"/></svg>' : '&check;'}</div>
                <span class="todo-text done">${Lucide.icon('clipboard-list', 16)} ${Utils.escapeHtml(t.title)}</span>
                <button class="todo-del" onclick="App.deleteTodo('${t.id}')">&times;</button>
              </div>
            `).join('')}
            ${completedAutoTodos.map(item => `
              <div class="todo-item">
                <div class="todo-check checked${window.__UI_V3__ ? ' v2-check' : ''}">${window.__UI_V3__ ? '<svg class="v2-checkmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 7"/></svg>' : '&check;'}</div>
                <span class="todo-text done">${item.type === 'nutrition' ? Lucide.icon('pill', 16) : Lucide.icon('heart-pulse', 16)} ${Utils.escapeHtml(item.name)}</span>
                <span class="text-muted" style="font-size:11px;margin-left:auto">${item.doneCount}/${item.maxCount}次</span>
                ${item.type === 'nursing' ? `<button class="todo-add" onclick="App._addExtraNursing('${Utils.jsAttr(item.name)}')">+</button>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <!-- v113 今日用药提醒（当天有用药记录时展示，紧贴待办下方、里程碑上方） -->
      ${this._renderMedTodayRemind()}

      <!-- 里程碑倒计时 -->
      ${nextMilestones.length > 0 ? `
      <div class="countdown-card">
        <div class="card-title">里程碑预告</div>
        ${nextMilestones.map(m => `
          <div class="countdown-item">
            <div class="cd-icon">${this._domainIcon(m.domain)}</div>
            <div class="cd-info">
              <div class="cd-label">${Utils.escapeHtml(m.domain)} · ${Utils.escapeHtml(m.skill)}</div>
              <div class="cd-value">${Utils.escapeHtml(m.desc)}</div>
            </div>
          </div>
        `).join('')}
      </div>` : ''}

      <div class="disclaimer">${APP_CONFIG.disclaimer}</div>

      <!-- 心情选择底部面板 -->
      <div class="mood-sheet-overlay" id="mood-sheet-overlay" onclick="DashboardPage.closeMoodSheet()"></div>
      <div class="mood-sheet-panel" id="mood-sheet-panel">
        <div class="mood-sheet-handle"></div>
        <div class="mood-sheet-title" id="mood-sheet-title">选择心情</div>
        <div class="mood-sheet-subtitle">主题色会根据更需要安抚的一方自动调整</div>
        <div class="mood-sheet-grid" id="mood-sheet-grid"></div>
      </div>
    `;

    container.innerHTML = html;
    this._injectMoodSheetStyles();
    this._applyThemeColor();
    } catch (e) {
      container.innerHTML = Utils.emptyState({
        icon: Lucide.icon('settings', 32), title: '加载首页失败',
        desc: Utils.escapeHtml(e.message),
        action: '<button class="btn btn-primary" onclick="showPage(\'dashboard\')">重试</button>',
        error: true
      });
    }
  },

  _monthAgeText(data) {
    if (data.months < 1) return `${data.days}天`;
    if (data.months < 12) return `${data.months}个月${data.days}天`;
    const years = Math.floor(data.months / 12);
    const remainMonths = data.months % 12;
    return `${years}岁${remainMonths > 0 ? remainMonths + '个月' : ''}`;
  },

  _growthItem(label, value, ev) {
    return `<div class="growth-value-tag ${ev.status}" style="text-align:center">
      <span class="gv-label">${label}</span>
      <span class="gv-value">${value}</span>
      <span class="gv-p50">P50: ${ev.median}</span>
    </div>`;
  },

  _domainIcon(domain) {
    const map = { '大运动': 'footprints', '精细动作': 'hand', '语言': 'star', '认知': 'sparkles', '社交': 'heart-pulse', '视觉': 'eye', '听觉': 'star' };
    return Lucide.icon(map[domain] || 'star', 20);
  },

  /** 解析护理标准中的频率（如"每日2-3次" → {min:2, max:3}） */
  _parseFrequency(standard) {
    if (!standard) return null;
    // 匹配 "每日X-Y次" 或 "每日X次"
    const rangeMatch = standard.match(/每日\s*(\d+)\s*[-~]\s*(\d+)\s*次/);
    if (rangeMatch) return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };
    const singleMatch = standard.match(/每日\s*(\d+)\s*次/);
    if (singleMatch) return { min: parseInt(singleMatch[1]), max: parseInt(singleMatch[1]) };
    // "每日多次" 默认5次上限
    if (/每日多次/.test(standard)) return { min: 1, max: 5 };
    return null;
  },

  /** 首页疫苗接种提醒卡片（接种前3天展示） */
  _renderVaccineReminders() {
    let dueVaccines;
    try {
      dueVaccines = window.MedicalPage && MedicalPage.getDueSoonVaccines ? MedicalPage.getDueSoonVaccines() : [];
    } catch { dueVaccines = []; }
    if (dueVaccines.length === 0) return '';

    return `
      <div class="card" style="background:linear-gradient(135deg,#fff7e6,#fffbe6);border:1px solid #ffd591" onclick="showPage('messages')" role="button" tabindex="0">
        <div class="card-title">${Lucide.icon('syringe', 18)} 疫苗提醒 <span class="text-muted">查看消息中心</span></div>
        ${dueVaccines.map(v => `
          <div class="vaccine-reminder-item">
            <div class="vr-info">
              <div class="vr-name">${Utils.escapeHtml(v.name)} ${Utils.escapeHtml(v.dose || '')}</div>
              <div class="vr-meta">
                计划: ${Utils.escapeHtml(v.plannedDate || '未设置')}
                ${v.daysUntil === 0 ? ` · ${Lucide.icon('alert-triangle', 14)} 今天` : v.daysUntil === 1 ? ` · ${Lucide.icon('alert-triangle', 14)} 明天` : ` · ${Lucide.icon('alert-triangle', 14)} ${v.daysUntil}天后`}
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();MedicalPage.quickDone('${Utils.jsAttr(v.key)}')">${Lucide.icon('check-circle', 16)} 完成</button>
          </div>
        `).join('')}
      </div>
    `;
  },

  /** v113 今日用药提醒（当天有用药记录时展示） */
  _renderMedTodayRemind() {
    let meds;
    try {
      meds = window.MedicalPage && MedicalPage.getTodayMedications ? MedicalPage.getTodayMedications() : [];
    } catch { meds = []; }
    if (!meds || meds.length === 0) return '';

    const names = meds.slice(0, 3).map(m => Utils.escapeHtml(m.name)).join('、');
    const more = meds.length > 3 ? ` 等 ${meds.length} 种` : '';
    return `
      <div class="card med-dash-remind" onclick="showPage('messages')" role="button" tabindex="0">
        <div class="med-dash-remind-icon">${Lucide.icon('pill', 18)}</div>
        <div class="med-dash-remind-body">
          <div class="med-dash-remind-title">今日已用药 ${meds.length} 次</div>
          <div class="med-dash-remind-desc">${Utils.escapeHtml(names)}${more} ${Lucide.icon('chevron-right', 13)}</div>
        </div>
      </div>`;
  },

  /** 首页足迹统计 */
  _renderFootprintStats() {
    let stats;
    try {
      stats = window.FootprintPage && FootprintPage.getTodayFootprintStats ? FootprintPage.getTodayFootprintStats() : { count: 0, totalMin: 0 };
    } catch { stats = { count: 0, totalMin: 0 }; }
    const count = Number(stats?.count || 0);
    const totalMin = Number(stats?.totalMin || 0);
    if (count <= 0) return '';

    return `
      <div class="dash-stat-row">
        <div class="dash-stat" onclick="showPage('footprint')">
          <div class="ds-icon">${Lucide.icon('footprints', 20)}</div>
          <div class="ds-value" style="color:#13C2C2">${count}</div>
          <div class="ds-label">遛弯(次)</div>
        </div>
        <div class="dash-stat" onclick="showPage('footprint')">
          <div class="ds-icon">${Lucide.icon('timer', 20)}</div>
          <div class="ds-value" style="color:#13C2C2;font-size:14px">${totalMin}min</div>
          <div class="ds-label">户外时长</div>
        </div>
      </div>
    `;
  },

  async _loadTodayBadge() {
    if (!API.listMilestone) return null;
    const data = await API.listMilestone().catch(() => ({ records: [] }));
    return (data.records || []).find(r => r.date === Utils.todayStr() && (r.badgeId || r.photoUrl)) || null;
  },

  // ===== 心情头像系统 =====
  // priority：安抚权重（越大越需照顾），主题按宝宝/妈妈中更高者变化
  _moodAvatars: {
    happy:     { label: '开心', emoji: '', priority: 0, color: '#81B29A', cl: '#E8F5E9', cd: '#4A7C59', asset: 'happy' },
    sleeping:  { label: '睡觉', emoji: '', priority: 1, color: '#A8DADC', cl: '#E0F7FA', cd: '#457B9D', asset: 'sleep' },
    playful:   { label: '调皮', emoji: '', priority: 2, color: '#F2CC8F', cl: '#FFF8E1', cd: '#C9A227', asset: 'wink' },
    thinking:  { label: '思考', emoji: '', priority: 3, color: '#B8B8D1', cl: '#F3E5F5', cd: '#7B6B8D', asset: 'thinking' },
    surprised: { label: '惊讶', emoji: '', priority: 4, color: '#E07A5F', cl: '#FFF3E0', cd: '#C45B3F', asset: 'surprised' },
    angry:     { label: '生气', emoji: '', priority: 5, color: '#E07A5F', cl: '#FFEBEE', cd: '#C62828', asset: 'angry' }
  },

  /** 心情 key → memoji 素材文件名 key（素材包：happy/sleep/wink/thinking/surprised/angry） */
  _moodAssetKey(key) {
    const cfg = this._moodAvatars[key];
    return (cfg && cfg.asset) || 'happy';
  },

  /** v98：心情素材路径。baby=宝宝单人包（asset 映射）；mom=情侣包 img/emoji/mom/（文件名即 mood key） */
  _moodAssetPath(key, target, size) {
    const s = size || 128;
    if (target === 'mom') return `img/emoji/mom/emoji-${key}-animated-${s}.gif`;
    return `img/emoji/emoji-${this._moodAssetKey(key)}-animated-${s}.gif`;
  },

  /** v98：心情素材静态 PNG 兜底路径（GIF 加载失败时） */
  _moodAssetFallback(key, target) {
    if (target === 'mom') return `img/emoji/mom/emoji-${key}.png`;
    return `img/emoji/emoji-${this._moodAssetKey(key)}.png`;
  },

  _moodSheetTarget: 'baby',

  openMoodSheet(target) {
    this._moodSheetTarget = target;
    const titleEl = document.getElementById('mood-sheet-title');
    if (titleEl) titleEl.textContent = target === 'baby' ? '选择宝宝心情' : '选择妈妈心情';
    const grid = document.getElementById('mood-sheet-grid');
    if (!grid) return;
    const currentMood = target === 'baby' ? Utils.getTodayMood() : Utils.getMomMood();
    const currentKey = currentMood && this._moodAvatars[currentMood.key] ? currentMood.key : 'happy';
    const entries = Object.entries(this._moodAvatars).sort((a, b) => b[1].priority - a[1].priority);
    // v98：妈妈心情用情侣表情包（img/emoji/mom/），宝宝保持单人包
    const t = this._moodSheetTarget;
    grid.innerHTML = entries.map(([key, cfg]) => {
      const sel = key === currentKey ? 'selected' : '';
      const pClass = cfg.priority >= 4 ? 'pr-high' : cfg.priority >= 2 ? 'pr-mid' : 'pr-low';
      return `<div class="mood-sheet-item ${sel}" onclick="DashboardPage.selectMoodFromSheet('${key}')">
        <span class="mood-sheet-priority ${pClass}">${cfg.priority}</span>
        <img src="${this._moodAssetPath(key, t, 128)}" onerror="this.onerror=null;this.src='${this._moodAssetFallback(key, t)}';" alt="${cfg.label}" style="width:64px;height:64px;object-fit:contain;border-radius:10px">
        <span class="mood-sheet-label">${cfg.label}</span>
      </div>`;
    }).join('');
    document.getElementById('mood-sheet-overlay').classList.add('active');
    document.getElementById('mood-sheet-panel').classList.add('active');
  },

  closeMoodSheet() {
    const o = document.getElementById('mood-sheet-overlay');
    const p = document.getElementById('mood-sheet-panel');
    if (o) o.classList.remove('active');
    if (p) p.classList.remove('active');
  },

  selectMoodFromSheet(key) {
    const cfg = this._moodAvatars[key];
    if (!cfg) return;
    const mood = { key, label: cfg.label };
    // v95 #8：宝宝/妈妈心情独立选择（不再强制同步），整体主题按更需照顾的一方变化
    if (this._moodSheetTarget === 'baby') {
      Utils.setTodayMood(mood);
    } else {
      Utils.setMomMood(mood);
    }
    this.closeMoodSheet();
    this._updateMoodAvatars();
    this._applyThemeColor();
    if (window.ThemeV2) ThemeV2.refresh(); // 心情主题（data-mood-theme）即时重算
    const dominant = this._getDominantMood();
    Utils.showToast(`${this._moodSheetTarget === 'baby' ? '宝宝' : '妈妈'}${cfg.label} · 按${dominant.name}的心情调整主题`, 2000);
  },

  _updateMoodAvatars() {
    const babyMood = Utils.getTodayMood();
    const momMood = Utils.getMomMood();
    const babyKey = babyMood && this._moodAvatars[babyMood.key] ? babyMood.key : 'happy';
    const momKey = momMood && this._moodAvatars[momMood.key] ? momMood.key : 'happy';
    const babyImg = document.getElementById('baby-avatar-img');
    const momImg = document.getElementById('mom-avatar-img');
    if (babyImg) babyImg.src = `img/emoji/emoji-${this._moodAssetKey(babyKey)}-animated-128.gif`;
    // v98：妈妈头像用情侣包素材
    if (momImg) momImg.src = `img/emoji/mom/emoji-${momKey}-animated-128.gif`;
    // badge = 各自心情色的彩色圆点
    const badges = document.querySelectorAll('.mood-avatar-badge');
    if (badges[0]) badges[0].style.background = this._moodAvatars[babyKey].color;
    if (badges[1]) badges[1].style.background = this._moodAvatars[momKey].color;
  },

  _getDominantMood() {
    const babyMood = Utils.getTodayMood();
    const momMood = Utils.getMomMood();
    const babyKey = babyMood && this._moodAvatars[babyMood.key] ? babyMood.key : 'happy';
    const momKey = momMood && this._moodAvatars[momMood.key] ? momMood.key : 'happy';
    const babyCfg = this._moodAvatars[babyKey];
    const momCfg = this._moodAvatars[momKey];
    const isBaby = babyCfg.priority >= momCfg.priority;
    return { cfg: isBaby ? babyCfg : momCfg, name: isBaby ? '宝宝' : '妈妈' };
  },

  _applyThemeColor() {
    const { cfg } = this._getDominantMood();
    const root = document.documentElement;
    root.style.setProperty('--primary', cfg.color);
    root.style.setProperty('--primary-light', cfg.cl);
    root.style.setProperty('--primary-dark', cfg.cd);
  },

  _injectMoodSheetStyles() {
    if (document.getElementById('mood-sheet-styles')) return;
    const style = document.createElement('style');
    style.id = 'mood-sheet-styles';
    style.textContent = `
      /* 头像（76px GIF, 可点击） */
      .bi-avatar { position: relative; width: 76px; height: 76px; flex-shrink: 0; cursor: pointer; transition: transform 0.15s; }
      .bi-avatar:active { transform: scale(0.92); }
      .bi-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 3px solid rgba(255,255,255,0.7); background: #fff; }
      /* badge = 14px 彩色圆点（心情色） */
      .mood-avatar-badge {
        position: absolute; bottom: -2px; right: -2px;
        width: 14px; height: 14px; border-radius: 50%;
        border: 2.5px solid #fff;
        transition: background 0.5s ease;
        z-index: 2;
      }
      /* 中间信息区 */
      .bi-info { flex: 1; text-align: center; }
      .bi-info .bi-name { font-size: 18px; font-weight: 700; line-height: 1.3; }
      .bi-info .bi-age { font-size: 13px; opacity: 0.85; margin-top: 2px; }
      .bi-info .bi-days {
        margin-top: 6px; display: inline-flex; align-items: baseline; gap: 2px;
        background: rgba(255,255,255,0.15); border-radius: 10px; padding: 2px 10px;
      }
      .bi-info .bi-days-num { font-size: 16px; font-weight: 800; }
      .bi-info .bi-days-label { font-size: 11px; opacity: 0.8; }
      /* 成长数据嵌入卡片内 */
      .bi-growth {
        display: flex; gap: 8px; margin-top: 12px; padding-top: 12px;
        border-top: 1px solid rgba(255,255,255,0.2);
      }
      .growth-tag {
        cursor: pointer;
        flex: 1 1 0; background: rgba(255,255,255,0.12); border-radius: 8px;
        padding: 4px 10px; display: flex; flex-direction: column; gap: 0; min-width: 0;
      }
      .growth-tag .gt-label { font-size: 10px; opacity: 0.75; display: flex; align-items: center; gap: 3px; }
      .growth-tag .gt-label svg { width: 12px; height: 12px; flex-shrink: 0; }
      .growth-tag .gt-value { font-size: 15px; font-weight: 700; }
      .growth-tag .gt-value .gt-unit { font-size: 11px; font-weight: 500; opacity: 0.8; }
      .growth-tag .gt-time { font-size: 9px; opacity: 0.55; }
      /* 底部 sheet 面板 */
      .mood-sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); opacity: 0; visibility: hidden; z-index: 9998; transition: opacity 0.3s, visibility 0.3s; }
      .mood-sheet-overlay.active { opacity: 1; visibility: visible; }
      .mood-sheet-panel { position: fixed; left: 0; right: 0; bottom: 0; background: #fff; border-radius: 20px 20px 0 0; padding: 16px 16px calc(24px + env(safe-area-inset-bottom)); transform: translateY(100%); z-index: 9999; transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1); max-height: 60vh; overflow-y: auto; }
      .mood-sheet-panel.active { transform: translateY(0); }
      .mood-sheet-handle { width: 36px; height: 4px; background: #ddd; border-radius: 2px; margin: 0 auto 14px; }
      .mood-sheet-title { font-size: 16px; font-weight: 700; text-align: center; margin-bottom: 4px; }
      .mood-sheet-subtitle { font-size: 12px; color: #999; text-align: center; margin-bottom: 16px; }
      .mood-sheet-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .mood-sheet-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px; border-radius: 14px; background: #f8f8f8; border: 2px solid transparent; cursor: pointer; position: relative; transition: all 0.2s; }
      .mood-sheet-item:active { transform: scale(0.95); }
      .mood-sheet-item.selected { border-color: var(--primary, #E07A5F); background: var(--primary-light, #FFF8E1); }
      .mood-sheet-label { font-size: 12px; font-weight: 600; color: #333; }
      .mood-sheet-priority { position: absolute; top: 5px; right: 5px; width: 18px; height: 18px; border-radius: 50%; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; color: #fff; }
      .pr-high { background: #E07A5F; }
      .pr-mid { background: #F2CC8F; color: #333 !important; }
      .pr-low { background: #81B29A; }
    `;
    document.head.appendChild(style);
  },

  /**
   * 今日状态综合评估卡（v78 #315 · v83 合并 · v104 共享）
   * - 只保留 AI 一句话评估；删除 5 维（喂养/睡眠/排便/体温/护理）单独汇总行
   * - AI 数据源由 _buildTsDims 提供：下方 12 统计框 + 护理完成度 + 待办打卡
   * - v104：加载时展示共享评估结果，含更新人和时间
   */
  _buildTodayStatus(tsDims, monthAge, latestAssessment) {
    try {
      this._tsDims = Array.isArray(tsDims) ? tsDims : [];
      this._tsMonthAge = monthAge || 0;
      // v104：已有共享评估时预填展示
      return `
        <div class="card ts-card ai-disabled-card">
          <div class="card-title">${Lucide.icon('clipboard-list', 18)} 今日状态评估</div>
          <div class="ts-ai-box">
            <div class="ai-disabled-label">AI功能暂未启用</div>
            <div class="ts-ai-hint">当前仅展示确定性统计和记录，不生成自然语言解读</div>
          </div>
        </div>
      `;
    } catch (e) {
      console.warn('今日状态卡计算失败', e);
      return '';
    }
  },

  /** v104：渲染评估结果 HTML（含更新人和时间） */
  _renderAssessmentHTML(assessment, nickname, updatedAt) {
    let timeStr = '';
    if (updatedAt) {
      try {
        const d = new Date(updatedAt);
        timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } catch(e) {}
    }
    const who = nickname || '家人';
    const meta = timeStr ? `<div class="ts-ai-meta">${Lucide.icon('clock', 12)} 由${Utils.escapeHtml(who)}于 ${timeStr} 更新</div>` : '';
    return '<div class="ts-ai-text">' + Utils.escapeHtml(assessment).replace(/\n/g, '<br>') + '</div>' + meta + '<div class="ts-ai-disclaimer">' + Utils.escapeHtml(APP_CONFIG.disclaimer || '仅供参考，不构成医疗建议') + '</div>';
  },

  /** 待办项图标（v79 #316：运动/早教，Lucide 版） */
  _todoIcon(type) {
    const icon = { nutrition: 'pill', nursing: 'heart-pulse', exercise: 'dumbbell', early_edu: 'puzzle' }[type] || 'check-circle';
    return Lucide.icon(icon, 16);
  },

  /** 待办项打卡动作（v79 #316：运动/早教跳转对应页面打卡，营养/护理直接记录） */
  _todoCheckAction(item) {
    if (item.type === 'exercise') return `onclick="showPage('exercise')"`;
    if (item.type === 'early_edu') return `onclick="showPage('early-education')"`;
    return `onclick="App._completeUnchecked('${Utils.jsAttr(item.type)}', '${Utils.jsAttr(item.name)}', '${Utils.jsAttr(item.dose)}')"`;
  },

  /** v78 #315：12 统计框状态判定（ok/warn/danger/none），返回 {milk, breast, feeding, sleep, stool, urine, temp, nutrition, nursing, bath, shampoo, todo} */
  _statStatuses(todayData, monthAgeData, careDone, careTotal, totalPending) {
    const weeks = Math.max(0, Math.floor((monthAgeData.total || 0) / 7));
    const ref = APP_CONFIG.healthReference || {};
    const feeding = todayData.feeding || {};
    const feedCount = feeding.totalCount || 0;
    const s = {};
    // 奶量：单次均量 vs dailyMilkRef
    if (feedCount > 0) {
      const avg = (feeding.totalML || 0) / feedCount;
      const m = this._findRef(ref.dailyMilkRef, weeks);
      s.milk = (!m || (avg >= m.mlMin && avg <= m.mlMax)) ? 'ok' : 'warn';
    } else s.milk = 'none';
    // 亲喂 / 喂养次数
    s.breast = ((feeding.records || []).some(r => r.type === 'breast')) ? 'ok' : 'none';
    s.feeding = feedCount > 0 ? 'ok' : 'none';
    // 睡眠：时长 vs sleepHoursRef
    const sleepMin = todayData.sleep?.totalMinutes || 0;
    if (sleepMin > 0) {
      const sr = this._findRef(ref.sleepHoursRef, weeks);
      s.sleep = (sleepMin / 60) >= (sr ? sr.hoursMin : 12) ? 'ok' : 'warn';
    } else s.sleep = 'none';
    // 排便次数 vs stoolRef
    const stoolRecords = todayData.stool?.records || [];
    const stoolCount = stoolRecords.filter(r => !r.type || r.type === 'stool').length;
    if (stoolCount > 0) {
      const sr = this._findRef(ref.stoolRef, weeks);
      s.stool = (!sr || (stoolCount >= sr.min && stoolCount <= sr.max)) ? 'ok' : 'warn';
    } else s.stool = 'none';
    // 小便次数：有记录即 ok
    s.urine = stoolRecords.some(r => r.type === 'urine') ? 'ok' : 'none';
    // 体温（复用 tempStatus：正常→ok 高热→danger 偏低/低热→warn）
    const temp = todayData.health?.latestTemp;
    if (temp) {
      const t = Utils.getTempStatus(temp);
      s.temp = t.label === '正常' ? 'ok' : (t.label === '高热' ? 'danger' : 'warn');
    } else s.temp = 'none';
    // 营养 / 护理：有打卡即 ok
    s.nutrition = ((todayData.health?.nutritionRecords || []).length > 0) ? 'ok' : 'none';
    s.nursing = ((todayData.health?.nursingRecords || []).length > 0) ? 'ok' : 'none';
    // 洗澡 / 洗头
    const clean = todayData.clean || {};
    s.bath = clean.bath > 0 ? 'ok' : 'none';
    s.shampoo = clean.shampoo > 0 ? 'ok' : 'none';
    // 待办：有未完成 → warn；全部完成 → ok
    s.todo = totalPending > 0 ? 'warn' : 'ok';
    return s;
  },

  /**
   * R3 发热提醒卡（v118 首页增强）
   * 触发：今日有体温记录且 ≥37.5℃（warn=低热 / danger=高热）
   * 内部用 Utils.getTempStatus 精确判定，不依赖外部 tempStatus 传参（防御性）
   * 分级（贴合需求 R3）：
   *   · 体温 ≥38℃ 且月龄 <3 → 立即就医（danger 强提醒）
   *   · 体温 ≥38.5℃（高热）或 38≤temp<38.5 且月龄≥3 → 建议咨询医生
   *   · 37.5≤temp<38 → 关注
   */
  _buildFeverCard(temp, tempStatus, monthAge) {
    if (!temp) return '';
    const t = Utils.getTempStatus(temp);
    if (t.label === '正常' || t.label === '偏低') return ''; // 不发热不展示
    const m = Math.max(0, Math.round(monthAge || 0));
    // 只对真正发热（低热/高热）展示；偏低不在发热卡处理
    if (t.label !== '低热' && t.label !== '高热') return '';
    const urgent = temp >= 38 && m < 3;
    const consult = t.label === '高热' || (temp >= 38 && m >= 3);
    const level = urgent ? 'danger' : 'warn';
    const title = urgent ? '建议立即就医' : (consult ? '建议咨询医生' : '体温偏高，请关注');
    const hint = `当前体温 ${temp}°C，月龄 ${m} 个月`;
    const advice = urgent
      ? '体温 ≥38℃，且月龄不足 3 个月，免疫系统尚弱，请立即就医评估。'
      : (consult
        ? '体温偏高，密切观察精神状态与补水情况；若持续升高或出现异常症状，请及时就医。'
        : '体温轻度偏高，可适当减少包裹、多喂水，观察半小时后复测。');
    const icon = level === 'danger' ? 'alert-triangle' : 'thermometer';
    return `
      <div class="fever-card fever-${level}">
        <div class="fever-icon">${Lucide.icon(icon, 22)}</div>
        <div class="fever-body">
          <div class="fever-title">${title}</div>
          <div class="fever-hint">${hint}</div>
          <div class="fever-advice">${advice}</div>
          <div class="fever-disclaimer">${Utils.escapeHtml(APP_CONFIG.disclaimer || '仅供参考，不构成医疗建议')}</div>
        </div>
        <div class="fever-action" onclick="showPage('parenting','health')">${Lucide.icon('chevron-right', 18)}</div>
      </div>`;
  },

  /**
   * R6 扩展：首页 12 维温和建议条（v118）
   * 每个触发维度生成一条温和建议（区别于 stat 的状态着色与洞察中心 R1-R12 规则触发）
   * 只在状态为 warn/danger/none 时给出温和条；全部 ok 时不显示该维度。
   */
  _buildGentleBars(statStatuses, ctx) {
    const bars = [];
    const weeks = 0; // 温和条不深挖周龄，给出通用建议即可
    const add = (id, label, status, tip) => {
      if (status === 'ok') return;
      bars.push({ id, label, status: status || 'none', tip });
    };

    // 喂养域
    if (ctx.feedCount > 0) {
      const avg = Math.round(ctx.todayMilk / ctx.feedCount);
      add('milk', '奶量', statStatuses.milk,
        statStatuses.milk === 'warn'
          ? `今日单次均量 ${avg}ml，与月龄参考区间有偏差，留意宝宝是否吃饱。`
          : '今日奶量暂无参考数据，可在喂养记录中持续观察。');
    } else add('milk', '奶量', statStatuses.milk, '今日还没有喂养记录，喂完奶记得点一下。');
    add('breast', '亲喂', statStatuses.breast, ctx.breastCount > 0 ? '' : '今日未记录亲喂，若有亲喂可一并记录。');
    add('feeding', '喂养', statStatuses.feeding, ctx.feedCount > 0 ? '' : '每次喂养后记录，可帮助观察进食规律。');

    // 睡眠域
    if (ctx.todaySleep > 0) {
      const h = Math.round(ctx.todaySleep / 60 * 10) / 10;
      add('sleep', '睡眠', statStatuses.sleep, statStatuses.sleep === 'warn' ? `今日睡眠 ${h} 小时，低于月龄参考下限，白天可适当加小睡。` : '');
    } else add('sleep', '睡眠', statStatuses.sleep, '今日未记录睡眠，可用计时器记录帮助掌握作息。');

    // 排便域
    add('stool', '排便', statStatuses.stool, ctx.stoolCount > 0 ? (statStatuses.stool === 'warn' ? '排便次数偏离参考，注意观察大便性状与宝宝精神。' : '') : '今日未记录排便，记录有助于早期发现消化问题。');
    add('urine', '小便', statStatuses.urine, ctx.urineCount > 0 ? '' : '小便次数也是摄入量参考，有排尿记得记录。');

    // 健康域
    if (ctx.todayTemp) {
      const t = Utils.getTempStatus(ctx.todayTemp);
      add('temp', '体温', statStatuses.temp, statStatuses.temp === 'danger' ? `体温 ${ctx.todayTemp}°C（${t.label}），建议尽快咨询医生。` : (statStatuses.temp === 'warn' ? '多补水、减少包裹，持续升高请就医。' : ''));
    } else add('temp', '体温', statStatuses.temp, '今日未量体温，发热时记得量并记录。');
    add('nutrition', '营养', statStatuses.nutrition, ctx.nutritionNames.size > 0 ? '' : '记得补充维生素 D 等每日营养，不要漏掉哦。');
    add('nursing', '护理', statStatuses.nursing, ctx.nursingRecords.length > 0 ? '' : '今日护理打卡还没有，做完抚触/口腔清洁等记得记录。');

    // 清洁域
    add('bath', '洗澡', statStatuses.bath, ctx.bathCount > 0 ? '' : '今日还没洗澡，夏天出汗多，洗完记得记录。');
    add('shampoo', '洗头', statStatuses.shampoo, ctx.shampooCount > 0 ? '' : '今日未洗头，可按需要安排并记录。');

    // 待办域
    add('todo', '待办', statStatuses.todo, ctx.totalPending > 0 ? `还有 ${ctx.totalPending} 项待办未完成，完成后就能点亮今日打卡啦。` : '');

    // 过滤空 tip（ok 维度已提前排除；其余只保留有实际建议的）
    const list = bars.filter(b => b.tip);
    if (list.length === 0) return '';

    return `
      <div class="gentle-bars card">
        <div class="card-title">${Lucide.icon('sparkles', 16)} 今日小提醒</div>
        <div class="gentle-bars-body">
          ${list.map(b => `
            <div class="gentle-bar gb-${b.status}">
              <span class="gb-dot"></span>
              <span class="gb-label">${b.label}</span>
              <span class="gb-tip">${b.tip}</span>
            </div>`).join('')}
        </div>
      </div>`;
  },

  /** 按周龄命中参考区间段（weeksMin <= weeks < weeksMax，兜底末段） */
  _findRef(list, weeks) {
    if (!Array.isArray(list) || list.length === 0) return null;
    return list.find(r => weeks >= r.weeksMin && weeks < r.weeksMax) || list[list.length - 1];
  },

  /**
   * v78 #315：AI 一句话评估数据源（MECE：12 统计框 + 护理完成度 + 待办打卡）
   * 每条 {id, label, status, text(数据描述), hint(参考), advice(建议)}
   * text 为纯数据描述（不含评估性文字），由 AI 综合判断
   */
  _buildTsDims(todayData, monthAgeData, careDone, careTotal, totalPending, nutritionNames, nursingCountMap, pendingTodos, visibleAutoTodos) {
    const weeks = Math.max(0, Math.floor((monthAgeData.total || 0) / 7));
    const ref = APP_CONFIG.healthReference || {};
    const st = this._statStatuses(todayData, monthAgeData, careDone, careTotal, totalPending);
    const dims = [];
    const feeding = todayData.feeding || {};
    const feedCount = feeding.totalCount || 0;
    const todayMilk = feeding.totalML || 0;
    const sleepMin = todayData.sleep?.totalMinutes || 0;
    const stoolRecords = todayData.stool?.records || [];
    const stoolCount = stoolRecords.filter(r => !r.type || r.type === 'stool').length;
    const urineCount = stoolRecords.filter(r => r.type === 'urine').length;
    const temp = todayData.health?.latestTemp;
    const nutritionArr = Array.from(nutritionNames || []);
    const nursingArr = Object.keys(nursingCountMap || {});
    const clean = todayData.clean || {};

    // 1. 奶量（单次均量 vs 参考）
    if (feedCount > 0) {
      const avg = todayMilk / feedCount;
      const m = this._findRef(ref.dailyMilkRef, weeks);
      dims.push({ id: 'milk', label: '奶量', status: st.milk,
        text: `今日总奶量${todayMilk}ml，喂养${feedCount}次，单次均量${Math.round(avg)}ml`,
        hint: m ? `参考${m.mlMin}-${m.mlMax}ml/次` : '', advice: '' });
    } else dims.push({ id: 'milk', label: '奶量', status: 'none', text: '今日未记录喂养', hint: '', advice: '记得记录每次喂养，便于观察奶量变化。' });

    // 2. 亲喂次数
    const breastCount = (feeding.records || []).filter(r => r.type === 'breast').length;
    dims.push({ id: 'breast', label: '亲喂', status: st.breast, text: `亲喂${breastCount}次`, hint: '', advice: '' });

    // 3. 喂养次数
    dims.push({ id: 'feeding', label: '喂养次数', status: st.feeding, text: `喂养共${feedCount}次`, hint: '', advice: '' });

    // 4. 睡眠
    if (sleepMin > 0) {
      const h = Math.round(sleepMin / 60 * 10) / 10;
      const sr = this._findRef(ref.sleepHoursRef, weeks);
      dims.push({ id: 'sleep', label: '睡眠', status: st.sleep,
        text: `睡眠${h}小时`, hint: sr ? `参考${sr.hoursMin}-${sr.hoursMax}h/天` : '',
        advice: st.sleep === 'warn' ? '白天可增加 1-2 次小睡，观察宝宝是否烦躁。' : '' });
    } else dims.push({ id: 'sleep', label: '睡眠', status: 'none', text: '今日未记录睡眠', hint: '', advice: '可用计时器或手工记录睡眠，帮助掌握作息规律。' });

    // 5. 排便次数
    if (stoolCount > 0) {
      const sr = this._findRef(ref.stoolRef, weeks);
      dims.push({ id: 'stool', label: '排便', status: st.stool,
        text: `排便${stoolCount}次`, hint: sr ? `参考${sr.min}-${sr.max}次/天` : '',
        advice: st.stool === 'warn' ? '注意观察大便性状与宝宝精神，必要时可咨询医生。' : '' });
    } else dims.push({ id: 'stool', label: '排便', status: 'none', text: '今日未记录排便', hint: '', advice: '记录排便有助于早期发现消化问题。' });

    // 6. 小便次数
    dims.push({ id: 'urine', label: '小便', status: st.urine, text: `小便${urineCount}次`, hint: '', advice: '' });

    // 7. 体温
    if (temp) {
      const t = Utils.getTempStatus(temp);
      dims.push({ id: 'temp', label: '体温', status: st.temp,
        text: `体温${temp}°C（${t.label}）`, hint: '',
        advice: st.temp === 'danger' ? '体温偏高，建议尽快咨询医生。' : (st.temp === 'warn' ? '多补水、减少包裹，持续升高请就医。' : '') });
    } else dims.push({ id: 'temp', label: '体温', status: 'none', text: '今日未记录体温', hint: '', advice: '发热时记得量体温并记录。' });

    // 8. 营养补充
    dims.push({ id: 'nutrition', label: '营养', status: st.nutrition,
      text: nutritionArr.length > 0 ? `营养补充${nutritionArr.length}项（${nutritionArr.join('、')}）` : '今日未打卡营养补充',
      hint: '', advice: nutritionArr.length === 0 ? '记得补充维生素D等每日营养。' : '' });

    // 9. 护理打卡（含完成度）
    const carePct = careTotal > 0 ? Math.round(careDone / careTotal * 100) : 0;
    const careLeft = careTotal - careDone;
    dims.push({ id: 'nursing', label: '护理', status: st.nursing,
      text: `护理打卡${nursingArr.length}项${nursingArr.length > 0 ? '（' + nursingArr.join('、') + '）' : ''}`,
      hint: careTotal > 0 ? `护理完成度${carePct}%（${careDone}/${careTotal}）` : '',
      advice: careLeft > 0 ? `还有${careLeft}项未完成，如抚触、维生素D等。` : '' });

    // 10. 洗澡
    dims.push({ id: 'bath', label: '洗澡', status: st.bath, text: `洗澡${clean.bath || 0}次`, hint: '', advice: '' });

    // 11. 洗头
    dims.push({ id: 'shampoo', label: '洗头', status: st.shampoo, text: `洗头${clean.shampoo || 0}次`, hint: '', advice: '' });

    // 12. 待办打卡（手动待办 + 自动打卡）
    const pendList = [...(pendingTodos || []).map(t => t.title), ...(visibleAutoTodos || []).map(t => t.title)];
    dims.push({ id: 'todo', label: '待办打卡', status: st.todo,
      text: pendList.length > 0 ? `待办${pendList.length}项未完成（${pendList.join('、')}）` : '待办全部完成',
      hint: '', advice: pendList.length > 0 ? '记得完成剩余待办。' : '' });

    return dims;
  },

  /** v76 #311：AI 今日状态文本评估（手动触发；默认不消耗，点击才调用）· v83 合并 · v104 存库共享 */
  async aiAssess() {
    const resultEl = document.getElementById('ts-ai-result');
    if (!resultEl) return;
    const dims = this._tsDims || [];
    if (dims.length === 0) { resultEl.innerHTML = '<div class="ts-ai-msg">暂无今日数据，先记录一些再评估吧</div>'; return; }
    const btn = document.querySelector('.ts-ai-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
    resultEl.innerHTML = `<div class="ts-ai-loading">${Lucide.icon('loader', 14)} 正在生成评估…（约10秒）</div>`;
    try {
      const res = await API.aiAssess(this._tsMonthAge || 0, dims);
      if (res && res.assessment) {
        // v104：展示评估结果 + "刚刚由你更新"
        const myName = (Auth.getLocalAuth && Auth.getLocalAuth() && Auth.getLocalAuth().nickname) || '你';
        const nowISO = new Date().toISOString();
        // v107：保存到 sessionStorage 作为兜底（同一用户切页面回来时使用）
        try {
          sessionStorage.setItem('latestAiAssessment', JSON.stringify({
            assessment: res.assessment, nickname: myName, updatedAt: nowISO
          }));
        } catch(e) {}
        resultEl.innerHTML = this._renderAssessmentHTML(res.assessment, myName, nowISO);
        // v107：存库验证失败时显示警告
        if (res.saved === false) {
          console.warn('AI 评估存库失败:', res.saveError);
          resultEl.innerHTML += '<div class="ts-ai-meta" style="color:var(--color-error,#CE6355)"> 评估已生成但未同步到云端，其他家庭成员可能无法查看</div>';
        }
      } else {
        resultEl.innerHTML = '<div class="ts-ai-msg">生成失败，请稍后重试</div>';
      }
    } catch (e) {
      console.warn('AI 评估失败', e);
      resultEl.innerHTML = '<div class="ts-ai-msg">' + Utils.escapeHtml((e && e.message) || '网络异常，请稍后重试') + '</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
    }
  }
};

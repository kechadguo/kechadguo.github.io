/**
 * 运动发展模块 — 大运动训练计划 + 发育时间表对照 + 今日打卡
 * 与里程碑互补：里程碑=检查"达到了没"，运动发展=训练"每天做什么"
 * V2: Lucide SVG 图标、tokens 变量、骨架屏、pressable 交互
 */
window.ExercisePage = {
  _currentPlanIndex: null,

  _renderVideoPlayer(videoUrl, title) {
    if (!videoUrl) return '';
    const safeTitle = Utils.escapeHtml(title || '动作示范视频');
    const bvid = String(videoUrl).match(/BV[a-zA-Z0-9]+/)?.[0];
    if (bvid) return `<div class="exercise-video"><div class="exercise-video-title">${Lucide.icon('play-circle', 15)} ${safeTitle}</div><iframe src="https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=1&high_quality=1&danmaku=0" title="${safeTitle}" loading="lazy" allowfullscreen referrerpolicy="no-referrer"></iframe><div class="exercise-video-source">视频来源：第三方平台，仅作动作示范</div></div>`;
    if (/^https:\/\//i.test(videoUrl) && /\.(mp4|webm)(\?|$)/i.test(videoUrl)) return `<div class="exercise-video"><video src="${Utils.escapeHtml(videoUrl)}" controls preload="metadata" playsinline></video></div>`;
    return `<div class="exercise-video-source">视频链接暂不支持内嵌，请打开原链接查看</div>`;
  },

  async render(container) {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby._id) {
      container.innerHTML = Utils.emptyState({
        icon: Lucide.icon('dumbbell', 32),
        title: '请先创建宝宝档案',
        desc: '创建档案后可查看专属运动训练计划'
      });
      return;
    }

    if (window.__UI_V3__) container.innerHTML = Utils.skeletonHTML('exercise');

    await new Promise(r => setTimeout(r, 60));

    const monthAge = Utils.calcMonthAge(baby.birthDate);
    const cur = getExercisePlan(monthAge);
    this._currentPlanIndex = cur.index;

    const doneCount = ExerciseCheck.count();
    const totalCount = cur.plan.items.length;
    const todayKey = ExerciseCheck._key();

    let html = `
      <div class="card pressable" style="background:linear-gradient(135deg,var(--color-highlight),var(--color-accent));color:#fff;border:none;margin-bottom:12px">
        <div class="card-title" style="color:#fff;display:flex;align-items:center;gap:8px">
          ${Lucide.icon('dumbbell', 20)} 大运动训练计划
        </div>
        <div style="font-size:13px;opacity:.95">宝宝 ${monthAge} 个月 · 当前阶段 ${cur.plan.label}</div>
        <div style="font-size:12px;opacity:.85;margin-top:4px">训练"每天做什么" · 里程碑是检查"达到了没"</div>
        <div style="margin-top:10px;background:rgba(255,255,255,.2);border-radius:var(--radius-md);padding:6px 10px;font-size:13px;display:flex;align-items:center;gap:6px">
          今日打卡：<b>${doneCount}/${totalCount}</b>
          <span style="margin-left:auto;display:flex;align-items:center;gap:4px">${doneCount >= totalCount ? Lucide.icon('party-popper', 14) + ' 全部完成' : '继续加油'}</span>
        </div>
      </div>

      <!-- 月龄分段选择 -->
      <div style="display:flex;gap:6px;overflow-x:auto;padding:4px 0 10px;margin-bottom:4px;-webkit-overflow-scrolling:touch" id="ex-tabs">
        ${EXERCISE_PLAN.map((p, i) => `
          <div class="ex-tab pressable ${i === cur.index ? 'active' : ''}" data-idx="${i}" onclick="ExercisePage._selectTab(${i})">${p.label}</div>
        `).join('')}
      </div>

      <div id="ex-items">${this._renderItems(cur.plan, todayKey)}</div>

      <!-- 近7天打卡历史 -->
      ${this._renderHistory()}

      <!-- 大运动发育时间表对照 -->
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;gap:8px">${Lucide.icon('calendar', 18)} 大运动发育时间表对照</div>
        <p class="text-muted" style="font-size:12px;margin-bottom:8px">宝宝 ${monthAge} 个月 · 对照当前所处阶段</p>
        ${window.GROSS_MOTOR_TIMELINE.map(t => {
          const [minM, maxM] = t.range.split('-').map(x => parseInt(x));
          let state, stateClass, stateLabel;
          if (monthAge > maxM) { state = 'past'; stateLabel = '已过阶段'; }
          else if (monthAge >= minM) { state = 'now'; stateLabel = '当前阶段'; }
          else { state = 'future'; stateLabel = '将来临'; }
          if (state === 'now') stateClass = 'ex-state-now';
          else if (state === 'past') stateClass = 'ex-state-past';
          else stateClass = 'ex-state-future';
          return `
            <div class="ex-tl-row">
              <div style="flex:1">
                <div style="font-size:14px;font-weight:600">${Utils.escapeHtml(t.skill)} <span class="ex-state ${stateClass}">${stateLabel}</span></div>
                <div class="text-muted" style="font-size:12px">多数宝宝 ${Utils.escapeHtml(t.majority)} 掌握 · 正常范围 ${Utils.escapeHtml(t.range)}</div>
              </div>
            </div>
          `;
        }).join('')}
        <div class="tl-tip" style="display:flex;align-items:flex-start;gap:6px">${Lucide.icon('alert-triangle', 14)} <span>个体差异大，不必强求超前。若宝宝月龄已超出正常范围仍未掌握对应大运动，建议带宝宝就医评估。</span></div>
      </div>

      <div class="disclaimer">${APP_CONFIG.disclaimer}</div>
    `;

    container.innerHTML = html;
  },

  _renderItems(plan, todayKey) {
    const done = ExerciseCheck.get();
    return plan.items.map((it) => {
      const isDone = done.includes(it.skill);
      return `
        <div class="card pressable">
          <div class="ex-item-head">
            <div>
              <span class="ex-badge">${plan.label}</span>
              <span class="ex-skill">${Utils.escapeHtml(it.skill)}</span>
            </div>
            <button class="btn pressable ${isDone ? 'btn-success' : 'btn-secondary'}" style="font-size:13px;padding:6px 12px;white-space:nowrap;min-height:auto"
              onclick="ExercisePage._toggleCheck('${Utils.jsAttr(it.skill)}', this)">${isDone ? (Lucide.icon('check', 14) + ' 已练过') : '练过了'}</button>
          </div>
          <div class="ex-goal" style="display:flex;align-items:center;gap:6px">${Lucide.icon('target', 16)} ${Utils.escapeHtml(it.goal)}</div>
          <div class="ex-method">${Utils.escapeHtml(it.method)}</div>
          ${this._renderVideoPlayer(it.videoUrl, it.skill)}
          <div class="ex-meta">
            <span class="ex-meta-item" style="display:flex;align-items:center;gap:4px">${Lucide.icon('timer', 14)} ${Utils.escapeHtml(it.duration)}</span>
            <span class="ex-meta-item" style="display:flex;align-items:center;gap:4px">${Lucide.icon('repeat', 14)} ${Utils.escapeHtml(it.freq)}</span>
          </div>
          <div class="ex-tip" style="display:flex;align-items:flex-start;gap:6px">${Lucide.icon('lightbulb', 14)} <span>${Utils.escapeHtml(it.tip)}</span></div>
        </div>
      `;
    }).join('');
  },

  /** 近7天运动打卡历史 */
  _renderHistory() {
    const rows = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const list = ExerciseCheck.get(d);
      const label = i === 0 ? '今天' : Utils.formatDate(d, 'MM-DD');
      rows.push(`<div class="ch-row">
        <span class="ch-date">${label}</span>
        <span class="ch-count">${list.length} 项</span>
        <span class="ch-items">${list.length ? list.map(s => Utils.escapeHtml(s)).join('、') : '<span class="ch-empty">—</span>'}</span>
      </div>`);
    }
    return `<div class="card">
      <div class="card-title" style="display:flex;align-items:center;gap:8px">${Lucide.icon('clipboard-list', 18)} 运动打卡 · 近7天</div>
      ${rows.join('')}
    </div>`;
  },

  _selectTab(idx) {
    const plan = EXERCISE_PLAN[idx];
    const el = document.getElementById('ex-items');
    if (!el) return;
    document.querySelectorAll('.ex-tab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.idx) === idx));
    el.innerHTML = this._renderItems(plan, ExerciseCheck._key());
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  _toggleCheck(skill, btn) {
    if (ExerciseCheck.has(skill)) {
      ExerciseCheck.remove(skill);
      btn.className = 'btn pressable btn-secondary';
      btn.style.minHeight = 'auto';
      btn.textContent = '练过了';
    } else {
      ExerciseCheck.add(skill);
      btn.className = 'btn pressable btn-success';
      btn.style.minHeight = 'auto';
      btn.innerHTML = Lucide.icon('check', 14) + ' 已练过';
    }
    // 更新顶部进度
    const badge = document.querySelector('.card[style*="linear-gradient"] .card-title + div + div + div');
    if (badge) {
      const cur = getExercisePlan(Utils.calcMonthAge(Utils.getBabyInfo().birthDate));
      const total = cur.plan.items.length;
      const done = ExerciseCheck.count();
      badge.innerHTML = `今日打卡：<b>${done}/${total}</b><span style="float:right;display:flex;align-items:center;gap:4px">${done >= total ? Lucide.icon('party-popper', 14) + ' 全部完成' : '继续加油'}</span>`;
    }
  }
};

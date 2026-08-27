/**
 * 早期教育模块 — 婴幼儿能力训练课程库（1-36 月龄）
 * 数据：window.EARLY_EDU_COURSES（web/js/data/early-edu-courses.js，约 265KB，懒加载）
 * 维度：认知/语言/大运动/精细动作/交往/自理（19 月龄起追加数学/艺术）
 * 结构：月龄段 tab（25 段）→ 维度 tab → 课程折叠卡（名称/目标/课时/准备/步骤/建议）
 * V2: Lucide SVG 图标、tokens 变量、骨架屏、pressable 交互
 */

/**
 * 早教每日打卡（localStorage）
 * key: edu-check-YYYYMMDD → JSON 数组 [「月龄|课程名」复合键, ...]
 */
window.EduCheck = {
  _key(today) {
    const d = today || new Date();
    const p = (n) => (n < 10 ? '0' + n : '' + n);
    return 'edu-check-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  },
  get(today) {
    try { return JSON.parse(localStorage.getItem(this._key(today)) || '[]'); }
    catch (e) { return []; }
  },
  add(key, today) {
    const list = this.get(today);
    if (!list.includes(key)) list.push(key);
    localStorage.setItem(this._key(today), JSON.stringify(list));
  },
  remove(key, today) {
    localStorage.setItem(this._key(today), JSON.stringify(this.get(today).filter(k => k !== key)));
  },
  has(key, today) {
    return this.get(today).includes(key);
  },
  count(today) {
    return this.get(today).length;
  },
  _courseKey(c) {
    return (c.monthLabel || '') + '|' + c.title;
  }
};

window.getDailyEduPick = function(group, date) {
  const courses = group.courses;
  if (!courses || !courses.length) return [];
  const d = date || new Date();
  const dayNum = Math.floor(d.getTime() / 86400000);
  const len = courses.length;
  const start = (dayNum * 3) % len;
  return [0, 1, 2].map(i => courses[(start + i) % len]);
};

window.EarlyEduPage = {
  _groupIndex: null,
  _domain: 'all',
  _loading: false,
  _completedCourses: new Set(),
  _progressLoaded: false,

  DOMAIN_META: {
    cognition: { cn: '认知', icon: 'brain' },
    language: { cn: '语言', icon: 'message-circle' },
    gross: { cn: '大运动', icon: 'dumbbell' },
    fine: { cn: '精细动作', icon: 'hand' },
    social: { cn: '交往', icon: 'users' },
    selfcare: { cn: '自理', icon: 'bath' },
    math: { cn: '数学', icon: 'calculator' },
    art: { cn: '艺术', icon: 'palette' },
  },

  async render(container) {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby._id) {
      container.innerHTML = Utils.emptyState({
        icon: Lucide.icon('puzzle', 32),
        title: '请先创建宝宝档案',
        desc: '创建档案后可查看专属早教课程'
      });
      return;
    }
    const monthAge = Utils.calcMonthAge(baby.birthDate);
    if (window.EARLY_EDU_COURSES) { this._doRender(container, monthAge); return; }
    // 课程库懒加载（约 265KB，避免拖慢首屏；SW 缓存后二次打开秒开）
    if (this._loading) return;
    this._loading = true;
    // V2 骨架屏替代 emoji 加载态
    container.innerHTML = window.__UI_V3__
      ? Utils.skeletonHTML('early-edu')
      : Utils.emptyState({ icon: Lucide.icon('loader', 28), title: '正在加载课程库…' });
    const self = this;
    const s = document.createElement('script');
    s.src = 'js/data/early-edu-courses.js?v=' + (window.APP_VERSION || 75);
    s.onload = () => { self._loading = false; self._doRender(container, monthAge); };
    s.onerror = () => {
      self._loading = false;
      container.innerHTML = Utils.emptyState({
        icon: Lucide.icon('alert-triangle', 28),
        title: '课程库加载失败',
        desc: '请检查网络后重试',
        action: '<button class="btn btn-primary pressable" onclick="EarlyEduPage.render(document.getElementById(\'page-content\'))">重试</button>',
        error: true
      });
    };
    document.head.appendChild(s);
  },

  async _doRender(container, monthAge) {
    await this._loadCourseProgress();
    const cur = getEduCourses(monthAge);
    this._groupIndex = cur.index;
    const total = window.EARLY_EDU_COURSES.length;
    const totalCourses = window.EARLY_EDU_COURSES.reduce((n, g) => n + g.courses.length, 0);
    const completedCount = this._completedCourses.size;
    const completedPercent = totalCourses ? Math.round((completedCount / totalCourses) * 100) : 0;
    this._domain = 'all';
    const picks = getDailyEduPick(cur.group);
    const todayDone = EduCheck.count();

    let html = `
      <div class="card pressable" style="background:linear-gradient(135deg,var(--color-celebration),var(--color-processing));color:#fff;border:none;margin-bottom:12px">
        <div class="card-title" style="color:#fff;display:flex;align-items:center;gap:8px">
          ${Lucide.icon('puzzle', 20)} 早期教育
        </div>
        <div style="font-size:13px;opacity:.95">宝宝 ${monthAge} 个月 · ${total} 个月龄段 · ${totalCourses} 门能力训练课</div>
        <div style="font-size:13px;opacity:.85;margin-top:4px">认知 · 语言 · 大运动 · 精细动作 · 交往 · 自理${cur.group.domains.includes('math') ? ' · 数学 · 艺术' : ''}</div>
        <div style="margin-top:10px;background:rgba(255,255,255,.2);border-radius:var(--radius-md);padding:6px 10px;font-size:13px">
          当前阶段：<b>${Utils.escapeHtml(cur.group.monthLabel)} 月龄</b>
          <span style="float:right">${cur.group.courses.length} 门课程</span>
        </div>
        <div style="margin-top:8px;background:rgba(255,255,255,.2);border-radius:var(--radius-md);padding:6px 10px;font-size:13px" id="ee-today-progress">
          今日打卡：<b>${todayDone}</b> 门
          <span style="float:right;display:flex;align-items:center;gap:4px">${todayDone >= 3 ? Lucide.icon('party-popper', 14) + ' 已完成今日推荐' : '完成 3 门即达标'}</span>
        </div>
        <div id="ee-total-progress" style="margin-top:8px;font-size:12px;opacity:.9">课程总进度：${completedCount}/${totalCourses}（${completedPercent}%）</div>
      </div>

      <!-- 今日推荐 3 门 -->
      <div class="card" style="border:none;padding:12px 14px 4px">
        <div class="card-title" style="font-size:14px;display:flex;align-items:center;gap:8px">${Lucide.icon('sparkles', 16)} 今日早教推荐 <span class="text-muted" style="font-weight:400;font-size:12px">按宝宝月龄每天轮换 3 门</span></div>
        <div style="margin-top:8px">${picks.map((c, i) => this._renderCourseCard(c, i, { open: true, tag: '今日推荐' })).join('')}</div>
      </div>

      <!-- 月龄段选择 -->
      <div style="display:flex;gap:6px;overflow-x:auto;padding:4px 0 10px;margin-bottom:4px;-webkit-overflow-scrolling:touch" id="ee-month-tabs">
        ${window.EARLY_EDU_COURSES.map((g, i) => `
          <div class="ex-tab pressable ${i === cur.index ? 'active' : ''}" data-idx="${i}" onclick="EarlyEduPage._selectMonth(${i})">${g.monthLabel}月</div>
        `).join('')}
      </div>

      <!-- 维度筛选 -->
      <div style="display:flex;gap:6px;overflow-x:auto;padding:0 0 10px;-webkit-overflow-scrolling:touch" id="ee-domain-tabs">
        ${this._renderDomainTabs(cur.group)}
      </div>

      <!-- 内容来源声明 -->
      <div style="font-size:13px;color:var(--color-highlight-deep);background:var(--color-highlight-soft);border:1px solid var(--color-highlight);border-radius:var(--radius-md);padding:6px 10px;margin-bottom:8px;line-height:1.6;display:flex;align-items:flex-start;gap:6px">
        ${Lucide.icon('alert-triangle', 14)} <span>课程内容整理自育儿书籍，部分建议内容可能不完整或有出入，<b>仅供参考，需核实</b>；具体请结合医生建议</span>
      </div>

      <div id="ee-courses">${this._renderCourses(cur.group)}</div>

      <div id="ee-history">${this._renderEduHistory()}</div>

      <div class="disclaimer">${APP_CONFIG.disclaimer}</div>
    `;
    container.innerHTML = html;
  },

  _renderDomainTabs(group) {
    const all = `<div class="ee-tab pressable ${this._domain === 'all' ? 'active' : ''}" onclick="EarlyEduPage._selectDomain('all')">全部</div>`;
    const tabs = group.domains.map(d => {
      const meta = this.DOMAIN_META[d] || { cn: d, icon: 'sparkles' };
      return `<div class="ee-tab pressable ${this._domain === d ? 'active' : ''}" onclick="EarlyEduPage._selectDomain('${d}')" style="display:flex;align-items:center;gap:4px">${Lucide.icon(meta.icon, 14)}${meta.cn}</div>`;
    }).join('');
    return all + tabs;
  },

  _selectMonth(idx) {
    const g = window.EARLY_EDU_COURSES[idx];
    if (!g) return;
    this._groupIndex = idx;
    this._domain = 'all';
    document.querySelectorAll('#ee-month-tabs .ex-tab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.idx) === idx));
    document.getElementById('ee-domain-tabs').innerHTML = this._renderDomainTabs(g);
    document.getElementById('ee-courses').innerHTML = this._renderCourses(g);
    document.getElementById('ee-courses').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  _selectDomain(d) {
    this._domain = d;
    const g = window.EARLY_EDU_COURSES[this._groupIndex];
    if (!g) return;
    document.querySelectorAll('#ee-domain-tabs .ee-tab').forEach(t => t.classList.toggle('active', t.getAttribute('onclick').includes("'" + d + "'")));
    document.getElementById('ee-courses').innerHTML = this._renderCourses(g);
  },

  _renderCourses(group) {
    let courses = group.courses;
    if (this._domain !== 'all') courses = courses.filter(c => this._domainKey(c.domain) === this._domain);
    if (!courses.length) {
      return Utils.emptyState({ icon: Lucide.icon('puzzle', 28), title: '该维度暂无课程' });
    }

    const byDomain = {};
    for (const c of courses) {
      const dk = this._domainKey(c.domain);
      (byDomain[dk] = byDomain[dk] || []).push(c);
    }
    const order = group.domains.length ? group.domains : Object.keys(byDomain);
    return order.map(dk => {
      const list = byDomain[dk];
      if (!list) return '';
      const meta = this.DOMAIN_META[dk] || { cn: dk, icon: 'sparkles' };
      return `
        <div style="margin:10px 0 4px;font-size:14px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px">${Lucide.icon(meta.icon, 16)} ${meta.cn}能力训练 <span class="text-muted" style="font-weight:400;font-size:12px">${list.length} 课</span></div>
        ${list.map((c, i) => this._renderCourseCard(c, i)).join('')}
      `;
    }).join('');
  },

  _domainKey(domain) {
    const map = { '认知': 'cognition', '语言': 'language', '大运动': 'gross', '精细动作': 'fine', '交往': 'social', '自理': 'selfcare', '数学': 'math', '艺术': 'art' };
    return map[domain] || domain;
  },

  _renderCourseCard(c, i, opts) {
    const dk = this._domainKey(c.domain);
    const meta = this.DOMAIN_META[dk] || { icon: 'sparkles' };
    const needVerify = (c.steps && c.steps.trim().length < 30) || (c.tips && c.tips.trim().length < 30);
    const open = !!(opts && opts.open);
    const key = EduCheck._courseKey(c);
    const isDone = EduCheck.has(key);
    const isCourseCompleted = this._completedCourses.has(key);
    return `
      <div class="card ee-course pressable">
        <div class="ee-course-head" onclick="EarlyEduPage._toggleCourse(this)">
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:600;display:flex;align-items:center;gap:6px">${Lucide.icon(meta.icon, 16)} ${Utils.escapeHtml(c.title)}
              ${opts && opts.tag ? `<span class="ee-tag-today">${Utils.escapeHtml(opts.tag)}</span>` : ''}
              ${isDone ? '<span class="ee-done-mark">' + Lucide.icon('check', 12) + ' 今日已练</span>' : ''}${isCourseCompleted ? '<span class="ee-done-mark">' + Lucide.icon('badge-check', 12) + ' 已完成</span>' : ''}
            </div>
            <div class="text-muted" style="margin-top:2px;display:flex;align-items:center;gap:4px">${Lucide.icon('target', 14)} ${Utils.escapeHtml((c.goal || '').replace(/\n/g, ' ').slice(0, 60))}${(c.goal || '').length > 60 ? '…' : ''}</div>
          </div>
          <div style="flex-shrink:0;display:flex;align-items:center;gap:8px">
            <span class="ex-badge" style="background:var(--color-celebration-soft);color:var(--color-celebration-deep)">${Utils.escapeHtml(c.duration || '')}</span>
            <span style="color:var(--text-light);transition:transform .2s">▾</span>
          </div>
        </div>
        <div class="ee-course-body" style="${open ? 'display:block' : 'display:none'}">
          <div class="ee-check-row">
            <button class="btn pressable ${isDone ? 'btn-success' : 'btn-secondary'}" style="font-size:13px;padding:6px 12px;white-space:nowrap;min-height:auto"
              onclick="event.stopPropagation();EarlyEduPage._toggleEduCheck('${Utils.jsAttr(key)}', this)">${isDone ? (Lucide.icon('check', 14) + ' 今日练过') : '练过了'}</button>
            <button class="btn pressable ${isCourseCompleted ? 'btn-success' : 'btn-outline'}" style="font-size:13px;padding:6px 12px;white-space:nowrap;min-height:auto" onclick="event.stopPropagation();EarlyEduPage._markCourseComplete('${Utils.jsAttr(key)}')">${isCourseCompleted ? '已完成' : '完成课程'}</button>
            <span class="text-muted" style="font-size:12px">${isCourseCompleted ? '已计入课程进度' : '完成后可累计总进度'}</span>
          </div>
          ${c.prep ? `<div class="ee-line"><b style="display:inline-flex;align-items:center;gap:4px">${Lucide.icon('wrench', 14)} 准备：</b>${Utils.escapeHtml(c.prep)}</div>` : ''}
          ${c.steps ? `<div class="ee-line"><b style="display:inline-flex;align-items:center;gap:4px">${Lucide.icon('clipboard-list', 14)} 玩法：</b>${Utils.escapeHtml(c.steps)}</div>` : ''}
          ${c.tips ? `<div class="ee-tip" style="margin-top:8px;display:flex;align-items:flex-start;gap:6px">${Lucide.icon('lightbulb', 14)} <span>${Utils.escapeHtml(c.tips)}</span></div>` : ''}
          ${needVerify ? `<div class="ee-verify" style="display:flex;align-items:flex-start;gap:6px">${Lucide.icon('alert-triangle', 14)} <span>书本建议内容较简略，仅供参考，需核实</span></div>` : ''}
        </div>
      </div>
    `;
  },

  async _loadCourseProgress() {
    if (this._progressLoaded) return;
    this._progressLoaded = true;
    try {
      const result = await API.listCourseProgress({ page: 1, pageSize: 500 });
      this._completedCourses = new Set((result?.records || []).map(r => r.courseId));
    } catch (e) { console.warn('[EarlyEdu] 加载课程进度失败:', e.message); }
  },

  async _markCourseComplete(courseId) {
    if (this._completedCourses.has(courseId)) { Utils.showToast('该课程已完成'); return; }
    const rating = Number(prompt('给这节课程评分（1-5星，可取消）', '5') || 5);
    const safeRating = Number.isFinite(rating) ? Math.min(5, Math.max(1, Math.round(rating))) : 5;
    const note = prompt('记录一句课程备注（可选）', '') || '';
    try {
      await API.completeCourse({ courseId, rating: safeRating, note, completedAt: new Date().toISOString() });
      this._completedCourses.add(courseId);
      Utils.showToast('已完成本节课程');
      const total = window.EARLY_EDU_COURSES.reduce((n, g) => n + g.courses.length, 0);
      const el = document.getElementById('ee-total-progress');
      if (el) el.textContent = `课程总进度：${this._completedCourses.size}/${total}（${total ? Math.round(this._completedCourses.size / total * 100) : 0}%）`;
      const courses = window.EARLY_EDU_COURSES[this._groupIndex];
      if (courses) document.getElementById('ee-courses').innerHTML = this._renderCourses(courses);
    } catch (e) { Utils.showToast('保存课程进度失败: ' + e.message); }
  },

  _toggleEduCheck(key, btn) {
    if (EduCheck.has(key)) {
      EduCheck.remove(key);
      btn.className = 'btn pressable btn-secondary';
      btn.style.minHeight = 'auto';
      btn.textContent = '练过了';
    } else {
      EduCheck.add(key);
      btn.className = 'btn pressable btn-success';
      btn.style.minHeight = 'auto';
      btn.innerHTML = Lucide.icon('check', 14) + ' 今日练过';
    }
    const hint = btn.nextElementSibling;
    if (hint) hint.textContent = EduCheck.has(key) ? '已计入今日打卡' : '练完点一下，记录今天做了';
    this._refreshEduProgress();
    const mark = btn.closest('.ee-course').querySelector('.ee-done-mark');
    if (EduCheck.has(key)) {
      if (!mark) btn.closest('.ee-course').querySelector('.ee-course-head div').insertAdjacentHTML('beforeend', '<span class="ee-done-mark">' + Lucide.icon('check', 12) + ' 今日已练</span>');
    } else if (mark) {
      mark.remove();
    }
  },

  _refreshEduProgress() {
    const el = document.getElementById('ee-today-progress');
    if (!el) return;
    const n = EduCheck.count();
    el.innerHTML = `今日打卡：<b>${n}</b> 门<span style="float:right;display:flex;align-items:center;gap:4px">${n >= 3 ? Lucide.icon('party-popper', 14) + ' 已完成今日推荐' : '完成 3 门即达标'}</span>`;
  },

  _renderEduHistory() {
    const rows = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const list = EduCheck.get(d);
      const label = i === 0 ? '今天' : Utils.formatDate(d, 'MM-DD');
      rows.push(`<div class="ch-row">
        <span class="ch-date">${label}</span>
        <span class="ch-count">${list.length} 门</span>
        <span class="ch-items">${list.length ? list.map(k => Utils.escapeHtml(k.split('|').pop())).join('、') : '<span class="ch-empty">—</span>'}</span>
      </div>`);
    }
    return `<div class="card">
      <div class="card-title" style="display:flex;align-items:center;gap:8px">${Lucide.icon('clipboard-list', 18)} 早教打卡 · 近7天</div>
      ${rows.join('')}
    </div>`;
  },

  _toggleCourse(head) {
    const body = head.nextElementSibling;
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    const arrow = head.querySelector('span[style*="transition"]');
    if (arrow) arrow.style.transform = open ? '' : 'rotate(180deg)';
  }
};

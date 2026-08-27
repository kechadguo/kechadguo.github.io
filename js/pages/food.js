/**
 * 辅食模块 — 按月龄辅食添加表 + 今日推荐 + 食谱汇总 + 已添加记录
 * 数据源：崔玉涛 6-12 月辅食表（web/js/data/food-plan.js）
 * V2: Lucide SVG 图标、tokens 变量、骨架屏、pressable 交互
 */
window.FoodPage = {
  _currentMonth: null,
  _allergyRecords: [],
  _allergenMap: {},
  _allergyLoaded: false,

  async render(container) {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby.birthDate) {
      container.innerHTML = Utils.emptyState({
        icon: Lucide.icon('utensils', 32),
        title: '请先创建宝宝档案',
        desc: '创建档案后可查看专属辅食计划'
      });
      return;
    }

    if (window.__UI_V3__) container.innerHTML = Utils.skeletonHTML('food');

    await new Promise(r => setTimeout(r, 60));

    const monthAge = Utils.calcMonthAge(baby.birthDate);
    const plan = getFoodPlan(monthAge);
    const curMonth = plan ? plan.month : 6;
    this._currentMonth = curMonth;

    await this._loadAllergyRecords();
    const beforeSix = monthAge < 6;
    const afterTwelve = monthAge > 12;

    let html = `
      <div class="card pressable" style="background:linear-gradient(135deg,var(--color-highlight),var(--color-accent));color:#fff;border:none;margin-bottom:12px">
        <div class="card-title" style="color:#fff;display:flex;align-items:center;gap:8px">
          ${Lucide.icon('utensils', 20)} 辅食添加计划
        </div>
        <div style="font-size:13px;opacity:.95">宝宝 ${monthAge} 个月 ${plan ? '· 当前按 ' + curMonth + ' 月龄计划' : ''}</div>
        <div style="font-size:12px;opacity:.85;margin-top:4px">崔玉涛 6-12 月辅食表 · 逐日安排 · 仅供参考</div>
    `;

    if (beforeSix) {
      html += `
        <div style="margin-top:10px;background:rgba(255,255,255,.2);border-radius:var(--radius-md);padding:8px 10px;font-size:13px;display:flex;align-items:center;gap:8px">
          ${Lucide.icon('hourglass', 16)} 宝宝未满 6 月龄，暂不添加辅食。6 月龄起可从铁强化米粉开始（1天1次）。
        </div>
      `;
    } else if (afterTwelve) {
      html += `
        <div style="margin-top:10px;background:rgba(255,255,255,.2);border-radius:var(--radius-md);padding:8px 10px;font-size:13px;display:flex;align-items:center;gap:8px">
          ${Lucide.icon('utensils', 16)} 宝宝已满 12 月龄，接近家庭饮食。可参考 12 月龄表，逐步过渡到一日三餐 + 奶。
        </div>
      `;
    } else {
      const today = new Date();
      const dayOfMonth = Math.min(today.getDate(), 30);
      const tf = getTodayFood(curMonth, dayOfMonth);
      if (tf) {
        html += `
          <div style="margin-top:10px;background:rgba(255,255,255,.2);border-radius:var(--radius-md);padding:8px 10px;font-size:13px">
            今日（本月第 ${dayOfMonth} 天）：
            <div style="margin-top:4px;display:flex;align-items:center;gap:6px"><b>${Lucide.icon('utensils', 14)} ${Utils.escapeHtml(tf.meal || '奶为主')}</b></div>
            <div style="margin-top:2px;display:flex;align-items:center;gap:6px">${Lucide.icon('apple', 14)} ${Utils.escapeHtml(tf.snack || '无水果加餐')}</div>
          </div>
        `;
      }
    }
    html += `</div>`;

    // 月龄分段选择
    html += `
      <div style="display:flex;gap:6px;overflow-x:auto;padding:4px 0 10px;margin-bottom:4px;-webkit-overflow-scrolling:touch" id="fd-tabs">
        ${FOOD_PLAN.map((p) => `
          <div class="fd-tab pressable ${p.month === curMonth ? 'active' : ''}" data-month="${p.month}" onclick="FoodPage._selectTab(${p.month})">${p.month}月龄</div>
        `).join('')}
      </div>
      <div id="fd-body">${this._renderMonth(curMonth)}</div>
      ${this._renderAllergyCard()}

      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;gap:8px">${Lucide.icon('clipboard-list', 18)} 辅食添加原则</div>
        <div style="font-size:13px;line-height:1.9;color:var(--text-secondary)">
          <div>• 6 月龄：从铁强化米粉开始，泥糊状，每新食物试 3 天观察反应</div>
          <div>• 7 月龄：过渡到碎碎面、粥、蛋黄（从 1/8 个起）</div>
          <div>• 8-9 月龄：软烂手指食物（蒸糕、松饼、蛋饼），锻炼抓握咀嚼</div>
          <div>• 10 月龄：接近家庭饮食，可吃烩饭、焖面</div>
          <div>• 11-12 月龄：小馄饨、小馒头、蛋饼，向一日三餐过渡</div>
          <div>• 一岁内不加盐、糖，注意食材多样性；新食物少量试吃观察过敏</div>
        </div>
      </div>

      <div class="disclaimer">${APP_CONFIG.disclaimer}</div>
    `;

    container.innerHTML = html;
  },

  async _loadAllergyRecords() {
    if (this._allergyLoaded) return;
    this._allergyLoaded = true;
    try {
      const result = await API.listAllergyRecords({ page: 1, pageSize: 100 });
      this._allergyRecords = result?.records || [];
      this._allergenMap = {};
      this._allergyRecords.filter(r => r.allergyType && r.allergyType !== 'none').forEach(r => {
        this._allergenMap[r.foodName] = r.severity || 'mild';
        localStorage.setItem(`allergen-${r.foodName}`, r.severity || 'mild');
      });
    } catch (e) {
      console.warn('[Food] 过敏记录加载失败:', e.message);
    }
  },

  _renderAllergyCard() {
    const rows = this._allergyRecords.slice(0, 12);
    return `<div class="card food-allergy-card">
      <div class="card-title" style="display:flex;align-items:center;gap:8px">${Lucide.icon('shield-alert', 18)} 食材过敏追踪</div>
      <p class="text-muted" style="font-size:12px;line-height:1.5">记录尝试新食材后的反应，已记录为过敏原的食材会从推荐中排除。</p>
      <button class="btn btn-outline btn-block" onclick="FoodPage.openAllergyForm()">${Lucide.icon('plus', 16)} 记录新食材反应</button>
      ${rows.length ? `<div class="food-allergy-list">${rows.map(r => `<div class="food-allergy-row"><div><b>${Utils.escapeHtml(r.foodName)}</b><span class="text-muted"> · ${Utils.escapeHtml(this._allergyLabel(r.allergyType))}</span></div><span class="food-allergy-severity food-allergy-${Utils.escapeHtml(r.severity || 'mild')}">${Utils.escapeHtml(this._severityLabel(r.severity))}</span></div>`).join('')}</div>` : '<div class="text-muted" style="font-size:12px;margin-top:10px">还没有过敏反应记录</div>'}
    </div>`;
  },

  _allergyLabel(type) { return ({ rash: '皮疹', diarrhea: '腹泻', vomit: '呕吐', none: '无明显反应' }[type] || '其他反应'); },
  _severityLabel(level) { return ({ mild: '轻度', moderate: '中度', severe: '重度' }[level] || '未分级'); },

  openAllergyForm() {
    App._showModal('记录食材反应', `<div class="form-group"><label>食材名称 *</label><input id="allergy-food" class="form-input" placeholder="如：鸡蛋、花生、虾" /></div><div class="form-group"><label>反应类型</label><select id="allergy-type" class="form-input"><option value="none">无明显反应</option><option value="rash">皮疹</option><option value="diarrhea">腹泻</option><option value="vomit">呕吐</option></select></div><div class="form-group"><label>严重程度</label><select id="allergy-severity" class="form-input"><option value="mild">轻度</option><option value="moderate">中度</option><option value="severe">重度</option></select></div><div class="form-group"><label>添加日期</label><input id="allergy-date" type="date" class="form-input" value="${Utils.todayStr()}" /></div><div class="form-group"><label>备注</label><textarea id="allergy-note" class="form-input" rows="3" placeholder="记录出现反应的时间、表现和处理"></textarea></div><p class="text-muted" style="font-size:12px">如出现呼吸困难、面唇肿胀、反复呕吐或精神异常，请立即就医。</p><button class="btn btn-primary btn-block" onclick="FoodPage._submitAllergyForm()">保存记录</button>`);
  },

  async _submitAllergyForm() {
    const foodName = document.getElementById('allergy-food')?.value?.trim();
    const allergyType = document.getElementById('allergy-type')?.value || 'none';
    const severity = document.getElementById('allergy-severity')?.value || 'mild';
    const date = document.getElementById('allergy-date')?.value || Utils.todayStr();
    const note = document.getElementById('allergy-note')?.value?.trim() || '';
    if (!foodName) { Utils.showToast('请填写食材名称'); return; }
    try {
      Utils.showLoading('保存中...');
      await API.createAllergyRecord({ foodName, allergyType, severity, date, note });
      if (allergyType !== 'none') { this._allergenMap[foodName] = severity; localStorage.setItem(`allergen-${foodName}`, severity); }
      this._allergyLoaded = false;
      await this._loadAllergyRecords();
      Utils.hideLoading(); App._closeModal(); Utils.showToast('已记录食材反应');
      await this._render();
    } catch (e) { Utils.hideLoading(); Utils.showToast('保存失败: ' + e.message); }
  },

  /** 渲染某个月龄的逐日辅食表（每 3 天一组 + 已添加记录） */
  _renderMonth(month) {
    const plan = getFoodPlan(month);
    if (!plan) {
      return Utils.emptyState({ icon: Lucide.icon('clipboard-list', 28), title: '暂无该月龄数据' });
    }

    const rows = [];
    for (let i = 1; i <= 30; i += 3) {
      const days = plan.days.filter(d => d.day >= i && d.day <= i + 2);
      const unique = days.filter((d, idx, arr) => arr.findIndex(x => x.meal === d.meal && x.snack === d.snack) === idx);
      rows.push({
        label: `${i}-${Math.min(i + 2, 30)}`,
        items: unique.map(d => ({ day: d.day, meal: d.meal, snack: d.snack }))
      });
    }

    const todayList = FoodCheck.get();
    const isAllergen = name => Object.keys(this._allergenMap).some(key => name.includes(key));

    return `
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;gap:8px">${Lucide.icon('calendar', 18)} ${month} 月龄辅食表 <span class="text-muted" style="font-size:12px;font-weight:400">（10点正餐 · 15点水果加餐）</span></div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;color:var(--text-secondary)">
          ${Lucide.icon('check-circle', 16)} 今日已添加 <b style="color:var(--color-success-deep)">${FoodCheck.count()}</b> 项
        </div>
        ${rows.map(r => `
          <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:8px 10px;margin-bottom:8px">
            <div style="font-size:12px;color:var(--text-light);margin-bottom:4px">第 ${r.label} 天</div>
            ${r.items.map(d => `
              <div style="display:flex;align-items:center;gap:8px;padding:3px 0;${isAllergen(`${d.meal || ''} ${d.snack || ''}`) ? 'opacity:.55' : ''}">
                <span style="font-size:12px;color:var(--text-light);width:26px;flex-shrink:0">D${d.day}</span>
                <div style="flex:1;font-size:13px;line-height:1.5">
                  <div style="display:flex;align-items:center;gap:4px">${Lucide.icon('utensils', 14)} ${Utils.escapeHtml(d.meal || '奶为主')}</div>
                  ${d.snack ? `<div style="color:var(--text-secondary);display:flex;align-items:center;gap:4px">${Lucide.icon('apple', 14)} ${Utils.escapeHtml(d.snack)}</div>` : ''}
                  ${isAllergen(`${d.meal || ''} ${d.snack || ''}`) ? '<div class="food-allergen-warning">含已记录过敏原，建议暂停尝试</div>' : ''}
                </div>
                <button class="btn pressable ${FoodCheck.has(d.meal) ? 'btn-success' : 'btn-secondary'}" style="font-size:12px;padding:4px 8px;white-space:nowrap;flex-shrink:0;min-height:auto"
                  onclick="FoodPage._toggleFood('${Utils.jsAttr(d.meal)}', this)">${FoodCheck.has(d.meal) ? (Lucide.icon('check', 14) + ' 已添加') : '添加'}</button>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>

      ${this._renderHistory()}
    `;
  },

  /** 已添加记录（近 7 天） */
  _renderHistory() {
    const hist = FoodCheck.history(7);
    if (!hist.length) return '';
    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    return `
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;gap:8px">${Lucide.icon('clock', 18)} 最近添加记录</div>
        ${hist.map(h => `
          <div style="margin-bottom:6px">
            <div style="font-size:12px;color:var(--text-light)">${fmt(h.date)}</div>
            <div style="font-size:13px;color:var(--text-secondary)">${h.list.map(x => Utils.escapeHtml(x)).join(' · ')}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  _selectTab(month) {
    const body = document.getElementById('fd-body');
    if (!body) return;
    document.querySelectorAll('.fd-tab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.month) === month));
    body.innerHTML = this._renderMonth(month);
    body.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  _toggleFood(name, btn) {
    if (FoodCheck.has(name)) {
      FoodCheck.remove(name);
      btn.className = 'btn pressable btn-secondary';
      btn.style.minHeight = 'auto';
      btn.innerHTML = '添加';
    } else {
      FoodCheck.add(name);
      btn.className = 'btn pressable btn-success';
      btn.style.minHeight = 'auto';
      btn.innerHTML = Lucide.icon('check', 14) + ' 已添加';
    }
    const body = document.getElementById('fd-body');
    if (body) body.innerHTML = this._renderMonth(this._currentMonth || 6);
  }
};

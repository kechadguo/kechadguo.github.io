/**
 * 育儿知识库 — 本地优先问询（文字 + 语音）
 * 数据：window.KNOWLEDGE_TREE（web/js/data/knowledge-parenting.js，7 主题 34 条，约 24KB）
 * 交互：顶部搜索框（文字）→ 本地检索打分秒回；语音按钮（复用 voice.js Web Speech API，零 AI 消耗）
 * v79 #316：底部导航第 4 个 tab；进入不自动聚焦输入；条目点击弹窗查看完整内容
 * 按月份过滤：条目含 minMonth/maxMonth，按宝宝月龄推荐「适合当前月龄」内容
 * V2: Lucide SVG 图标、tokens 变量、骨架屏、pressable 交互
 */
window.ParentingLibPage = {
  _activeTopic: null,
  _query: '',
  _monthAge: null,
  _viewItems: [],

  // 分类 key → Lucide 图标名（替换数据文件中的 emoji）
  CAT_ICONS: {
    nursing: 'bath',
    feeding: 'utensils',
    sleep: 'moon',
    behavior: 'brain',
    growth: 'activity',
    vaccine: 'syringe',
    medication: 'pill',
    health: 'heart-pulse',
  },

  async render(container) {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby._id) {
      container.innerHTML = Utils.emptyState({
        icon: Lucide.icon('library', 32),
        title: '请先创建宝宝档案',
        desc: '创建档案后可查看专属育儿知识'
      });
      return;
    }
    if (!window.searchKnowledge) {
      container.innerHTML = Utils.emptyState({
        icon: Lucide.icon('alert-triangle', 28),
        title: '知识库数据缺失',
        desc: '请检查数据文件是否正确加载',
        error: true
      });
      return;
    }

    if (window.__UI_V3__) container.innerHTML = Utils.skeletonHTML('parenting-lib');

    await new Promise(r => setTimeout(r, 60));

    const monthAge = Utils.calcMonthAge(baby.birthDate);
    this._monthAge = monthAge;
    const cats = window.getKnowledgeCategories(monthAge);
    const total = window.KNOWLEDGE_TREE.reduce((n, t) => n + t.items.length, 0);
    const fitTotal = cats.reduce((n, c) => n + c.count, 0);
    this._activeTopic = null;
    this._query = '';
    this._dailyTip = this._getDailyTip(monthAge);
    this._smartAlerts = await this._getSmartAlerts();

    const html = `
      <div class="card pressable" style="background:linear-gradient(135deg,var(--color-processing),var(--color-success));color:#fff;border:none;margin-bottom:12px">
        <div class="card-title" style="color:#fff;display:flex;align-items:center;gap:8px">
          ${Lucide.icon('library', 20)} 育儿百科
        </div>
        <div style="font-size:13px;opacity:.95">${cats.length} 大主题 · 共 ${total} 条 · 宝宝 ${monthAge} 个月</div>
        <div style="font-size:12px;opacity:.85;margin-top:4px">其中 ${fitTotal} 条适合当前月龄 · 按宝宝月龄智能推荐</div>
        <div style="font-size:11px;opacity:.75;margin-top:4px;display:flex;align-items:center;gap:4px">${Lucide.icon('sparkles', 12)} 后续月份会补充更多内容，月龄增长后自动解锁</div>
      </div>
      <div class="knowledge-push-card"><div class="knowledge-push-title">${Lucide.icon('sparkles', 16)} 今日月龄知识</div><div>${Utils.escapeHtml(this._dailyTip)}</div>${this._smartAlerts.length ? `<div class="knowledge-alerts">${this._smartAlerts.map(a => `<div>${Lucide.icon('bell', 13)} ${Utils.escapeHtml(a)}</div>`).join('')}</div>` : ''}</div>

      <!-- 搜索区 -->
      <div class="card" style="padding:10px 12px">
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" id="kl-input" class="form-input" placeholder="问点什么？如：宝宝偏头怎么办 / 5S安抚法"
                 value="${Utils.escapeHtml(this._query)}" style="flex:1" onkeydown="if(event.key==='Enter')ParentingLibPage._search()">
          <button class="btn btn-primary pressable" style="padding:8px 14px;flex-shrink:0;display:flex;align-items:center;gap:4px" onclick="ParentingLibPage._search()">${Lucide.icon('search', 16)} 提问</button>
          <button disabled aria-disabled="true" class="btn pressable ai-disabled-control" style="padding:8px 12px;flex-shrink:0;background:var(--color-processing-soft);color:var(--color-processing-deep);border:1px solid var(--color-processing);display:flex;align-items:center" aria-label="AI功能暂未启用">${Lucide.icon('mic', 18)}</button>
        </div>
        <div class="ai-disabled-label" style="margin-top:6px">AI功能暂未启用</div>
      </div>

      <div id="kl-content">${this._renderHome(cats)}</div>

      <div class="disclaimer">${APP_CONFIG.disclaimer}</div>
    `;
    container.innerHTML = html;
  },

  _getDailyTip(monthAge) { const tips = { 1: '本月重点：建立昼夜节律，白天多抱多活动，夜间保持安静暗光环境。', 3: '本月重点：多做俯卧练习，促进颈部和肩部肌肉发育。', 6: '本月重点：开始添加辅食，首选高铁米粉，观察新食物反应。', 12: '本月重点：鼓励安全探索，增加语言输入和亲子互动。' }; return tips[monthAge] || '继续陪伴宝宝健康成长，按月龄观察和记录变化。'; },

  async _getSmartAlerts() {
    const alerts = [];
    try {
      const end = Utils.todayStr(); const start = Utils.formatDate(new Date(Date.now() - 3 * 86400000), 'YYYY-MM-DD');
      const stool = await API.listStool({ startDate: start, endDate: end, page: 1, pageSize: 50 }).catch(() => ({ records: [] }));
      if (!(stool.records || []).length) alerts.push('已连续3天未记录排便，可查看排便规律与便秘预防知识。');
      const sleep = await API.listSleep({ startDate: start, endDate: end, page: 1, pageSize: 100 }).catch(() => ({ records: [] }));
      const wakes = (sleep.records || []).reduce((n, r) => n + Number(r.wakeUpCount || 0), 0);
      if (wakes >= 6) alerts.push('近3天夜醒次数偏多，可查看睡眠倒退与安抚建议。');
      const feeding = await API.listFeeding({ startDate: start, endDate: end, page: 1, pageSize: 100 }).catch(() => ({ records: [] }));
      const totalMilk = (feeding.records || []).reduce((n, r) => n + (r.unit === 'ml' ? Number(r.amount || 0) : 0), 0);
      if (totalMilk > 0 && totalMilk < 300) alerts.push('近3天记录奶量偏低，请结合宝宝状态观察喂养情况。');
    } catch (e) { console.warn('[ParentingLib] 智能提醒加载失败:', e.message); }
    return alerts;
  },

  /** 首页：分类浏览网格 + 热门问题 */
  _renderHome(cats) {
    const hot = ['偏头', '黄疸', '5S安抚法', '肠胀气', '初乳', '叛逆期'];
    const hotTags = hot.map(q =>
      `<span class="kl-tag pressable" onclick="ParentingLibPage._quickAsk('${q}')" style="display:flex;align-items:center;gap:4px">${q}</span>`
    ).join('');
    return `
      <div style="margin:12px 2px 6px;font-size:13px;color:var(--text-light);display:flex;align-items:center;gap:4px">${Lucide.icon('flame', 14)} 热门问题</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;padding:0 2px 10px">${hotTags}</div>

      <div style="margin:6px 2px 6px;font-size:13px;color:var(--text-light);display:flex;align-items:center;gap:4px">${Lucide.icon('folder', 14)} 按主题浏览 · 数字为适合当前月龄</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:0 2px">
        ${cats.map(c => `
          <div class="kl-cat pressable" onclick="ParentingLibPage._selectTopic('${c.key}')" style="${c.count === 0 ? 'opacity:.45' : ''}">
            <div style="color:var(--color-accent)">${Lucide.icon(this.CAT_ICONS[c.key] || 'book-open', 22)}</div>
            <div style="font-size:12px;font-weight:600;color:var(--text);margin-top:4px">${Utils.escapeHtml(c.name)}</div>
            <div style="font-size:10px;color:var(--text-light)">${c.count || 0} 条${c.count === 0 ? ' · 待补充' : ''}</div>
          </div>
        `).join('')}
      </div>
      <div style="font-size:11px;color:var(--text-light);margin:8px 2px 0;line-height:1.6;display:flex;align-items:flex-start;gap:4px">
        ${Lucide.icon('lightbulb', 12)} <span>灰色主题暂无当前月龄内容，随宝宝月龄增长会自动解锁更多条目</span>
      </div>
    `;
  },

  /** 选中主题 → 展示适合当前月龄的知识卡 */
  _selectTopic(key) {
    const t = window.getKnowledgeTopic(key);
    if (!t) return;
    this._activeTopic = key;
    const el = document.getElementById('kl-content');
    if (!el) return;
    const age = this._monthAge;
    const fitItems = window.getKnowledgeItemsByAge(key, age);
    const allItems = t.items;
    const catIcon = this.CAT_ICONS[key] || 'book-open';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin:12px 2px 6px">
        <span style="font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px">${Lucide.icon(catIcon, 18)} ${Utils.escapeHtml(t.name)}</span>
        <span class="text-muted" style="font-size:12px">${fitItems.length}/${allItems.length} 条适合当前月龄</span>
        <span style="margin-left:auto;font-size:12px;color:var(--color-accent);cursor:pointer" onclick="ParentingLibPage._backHome()">← 全部主题</span>
      </div>
      ${t.desc ? `<div style="font-size:12px;color:var(--text-light);margin:0 2px 8px">${Utils.escapeHtml(t.desc)}</div>` : ''}
      ${fitItems.length
        ? this._renderList(fitItems.map(it => ({ topic: t, item: it })))
        : `<div class="card" style="text-align:center;padding:20px 12px">
             <div style="color:var(--text-light)">${Lucide.icon('clock', 28)}</div>
             <div style="font-size:13px;color:var(--text-light);margin-top:8px">该主题暂无适合 ${age} 月龄的内容<br>后续月份会补充，敬请期待</div>
           </div>`
      }
      ${allItems.length > fitItems.length ? `
        <div class="ai-disabled-label" style="margin:10px 2px;text-align:center">AI功能暂未启用</div>
          <button class="btn btn-secondary pressable" style="font-size:12px;min-height:auto;padding:6px 12px" onclick="ParentingLibPage._showAllTopic('${key}')">查看全部 ${allItems.length} 条（含其他月龄）</button>
        </div>
      ` : ''}
    `;
  },

  _showAllTopic(key) {
    const t = window.getKnowledgeTopic(key);
    const el = document.getElementById('kl-content');
    if (!t || !el) return;
    const catIcon = this.CAT_ICONS[key] || 'book-open';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin:12px 2px 6px">
        <span style="font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px">${Lucide.icon(catIcon, 18)} ${Utils.escapeHtml(t.name)}</span>
        <span class="text-muted" style="font-size:12px">全部 ${t.items.length} 条</span>
        <span style="margin-left:auto;font-size:12px;color:var(--color-accent);cursor:pointer" onclick="ParentingLibPage._selectTopic('${key}')">← 适合当前月龄</span>
      </div>
      ${t.desc ? `<div style="font-size:12px;color:var(--text-light);margin:0 2px 8px">${Utils.escapeHtml(t.desc)}</div>` : ''}
      ${this._renderList(t.items.map(it => ({ topic: t, item: it })))}
    `;
  },

  _backHome() {
    this._activeTopic = null;
    const el = document.getElementById('kl-content');
    if (el) el.innerHTML = this._renderHome(window.getKnowledgeCategories(this._monthAge));
  },

  _quickAsk(q) {
    const input = document.getElementById('kl-input');
    if (input) input.value = q;
    this._query = q;
    this._search();
  },

  _voice() {
    if (!window.Voice) { Utils.showToast('语音模块未加载'); return; }
    Utils.showToast('请说话…');
    window.Voice.start((transcript) => {
      const input = document.getElementById('kl-input');
      if (input) input.value = transcript;
      this._query = transcript;
      this._search();
    });
  },

  _search() {
    const input = document.getElementById('kl-input');
    const q = (input ? input.value : this._query || '').trim();
    if (!q) { Utils.showToast('请输入问题'); return; }
    this._query = q;
    const results = window.searchKnowledge(q);
    const el = document.getElementById('kl-content');
    if (!el) return;
    const cats = window.getKnowledgeCategories(this._monthAge);

    if (!results.length) {
      el.innerHTML = `
        <div class="card" style="text-align:center;padding:24px 16px">
          <div style="color:var(--text-light)">${Lucide.icon('help-circle', 36)}</div>
          <div style="font-size:15px;font-weight:600;margin:10px 0 4px">暂时没有找到「${Utils.escapeHtml(q.slice(0, 20))}」的本地内容</div>
          <div style="font-size:12px;color:var(--text-light);line-height:1.7">换个说法试试，或从下面主题浏览</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px">
            ${cats.map(c => `
              <div class="kl-cat pressable" onclick="ParentingLibPage._selectTopic('${c.key}')">
                <div style="color:var(--color-accent)">${Lucide.icon(this.CAT_ICONS[c.key] || 'book-open', 20)}</div>
                <div style="font-size:11px;font-weight:600;color:var(--text);margin-top:4px">${Utils.escapeHtml(c.name)}</div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:14px;font-size:12px;color:var(--text-light);display:flex;align-items:center;justify-content:center;gap:4px">${Lucide.icon('lightbulb', 12)} AI助手当前未启用；这里提供确定性育儿知识</div>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin:12px 2px 6px">
        <span style="font-size:14px;font-weight:700;color:var(--text)">"${Utils.escapeHtml(q.slice(0, 24))}"</span>
        <span class="ex-badge" style="background:var(--color-success-soft);color:var(--color-success-deep)">${results.length} 条结果</span>
        <span style="margin-left:auto;font-size:12px;color:var(--color-accent);cursor:pointer" onclick="ParentingLibPage._backHome()">← 全部主题</span>
      </div>
      ${this._renderList(results.map(r => ({ topic: r.topic, item: r.item })))}
      <div style="font-size:11px;color:var(--text-light);margin:10px 2px;text-align:center">以上为通用育儿知识，个体差异较大，如有担心请咨询儿科医生</div>
    `;
  },

  _renderList(pairs) {
    this._viewItems = pairs;
    return pairs.map((v, i) => this._renderItemCard(i)).join('');
  },

  _renderItemCard(idx) {
    const { topic, item } = this._viewItems[idx];
    const catIcon = this.CAT_ICONS[topic.key] || 'book-open';
    const tagStr = (item.tags || []).slice(0, 4).map(t =>
      `<span class="kl-tag kl-tag-mini">${Utils.escapeHtml(t)}</span>`
    ).join('');
    return `
      <div class="card ee-course kl-item pressable" onclick="ParentingLibPage._openView(${idx})">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px">${Lucide.icon(catIcon, 16)} ${Utils.escapeHtml(item.title)}</div>
            <div style="margin-top:3px">${tagStr}</div>
          </div>
          <span style="color:var(--text-light);flex-shrink:0;font-size:16px">${Lucide.icon('chevron-right', 16)}</span>
        </div>
      </div>
    `;
  },

  _openView(idx) {
    const v = this._viewItems[idx];
    if (!v) return;
    const { topic, item } = v;
    const catIcon = this.CAT_ICONS[topic.key] || 'book-open';
    const old = document.getElementById('kl-view-modal');
    if (old) old.remove();
    const tagStr = (item.tags || []).map(t =>
      `<span class="kl-tag kl-tag-mini">${Utils.escapeHtml(t)}</span>`
    ).join('');
    const ageRange = (item.minMonth != null || item.maxMonth != null)
      ? `<div style="font-size:12px;color:var(--text-light);margin-bottom:8px;display:flex;align-items:center;gap:4px">${Lucide.icon('baby', 14)} 适合月龄：${item.minMonth != null ? item.minMonth + '' : '0'}${item.maxMonth != null ? ' ~ ' + item.maxMonth + ' 个月' : ' 个月起'}</div>`
      : '';
    const mo = document.createElement('div');
    mo.id = 'kl-view-modal';
    mo.className = 'modal';
    mo.innerHTML = `
      <div class="modal-content kl-view">
        <div class="modal-title" style="text-align:left;display:flex;align-items:center;gap:6px">${Lucide.icon(catIcon, 18)} ${Utils.escapeHtml(item.title)}</div>
        <div class="modal-body">
          <div style="margin-bottom:8px">${tagStr}</div>
          ${ageRange}
          <div class="ee-line" style="line-height:1.8">${Utils.escapeHtml(item.content)}</div>
          <div style="font-size:11px;color:var(--text-light);margin-top:10px">来源：${Utils.escapeHtml(topic.name)} · 仅供参考</div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary pressable" onclick="document.getElementById('kl-view-modal').remove()">知道了</button>
        </div>
      </div>
    `;
    mo.onclick = (e) => { if (e.target === mo) mo.remove(); };
    document.body.appendChild(mo);
  }
};

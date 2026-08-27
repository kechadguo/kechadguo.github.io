/**
 * 微信端主逻辑 — 语音优先、10秒完成
 * HTTP 模式：所有云函数调用通过 API.call() (fetch HTTP)
 */
window.WechatApp = {
  feedType: '',
  stoolColor: '',
  stoolConsistency: '',
  selectedTab: 'quick',
  _stoolPhotoBase64: '',
  _stoolAiRecognized: false,

  /** 初始化 */
  async init() {
    const auth = Auth.getLocalAuth();

    // v95 批次F：v2 通道全站 emoji → Lucide（装饰类；数据语义 emoji 无映射原样保留）
    this._installEmojiLucide();

    // 启动多端同步轮询：其他成员写操作 → 30s 内自动刷新（内部有登录判断）
    this._startSyncPolling();

    if (auth && auth.memberId && Auth.isInFamily()) {
      // 已登录且有家庭，直接进主界面
      this.render();
      this.loadTodaySummary();
    } else {
      // 未登录或未加入家庭，显示引导页
      this.renderOnboarding();
    }
  },

  /** v95 批次F：监听 #app 渲染，把文本节点中的装饰性 emoji 就地替换为 Lucide SVG
      （幂等：已替换节点不再含 emoji 文本，重复处理为 no-op） */
  _installEmojiLucide() {
    if (!window.__UI_V3__ || !window.Lucide) return;
    if (this._emojiObserver) return;
    const app = document.getElementById('app');
    if (!app || typeof MutationObserver === 'undefined') return;
    const self = this;
    const OPTS = { childList: true, subtree: true };
    let timer = null;
    const process = () => {
      self._emojiObserver.disconnect();
      try { Lucide.replaceEmojiInDOM(app, 16); } catch (e) { /* 静默：emoji 替换失败不阻断渲染 */ }
      self._emojiObserver.observe(app, OPTS);
    };
    this._emojiObserver = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(process, 80);
    });
    this._emojiObserver.observe(app, OPTS);
    process();
  },

  /** 启动多端同步轮询：页面可见且已登录时，比对 family.dataVersion 检测云端变化 */
  _startSyncPolling() {
    if (this._syncPollingStarted) return;
    this._syncPollingStarted = true;
    setTimeout(() => this._pollSync(), 8000);
    this._syncTimer = setInterval(() => this._pollSync(), 30000);
  },

  /** 轮询比对 dataVersion：不一致 → 重渲染当前界面（多端自动拉齐） */
  async _pollSync() {
    if (document.visibilityState !== 'visible') return;
    const auth = Auth.getLocalAuth();
    if (!auth || !auth.memberId || !Auth.isInFamily()) return;
    try {
      const profile = await Auth.getProfile();
      const dv = profile && profile.family ? profile.family.dataVersion : undefined;
      if (dv === undefined || dv === null) return; // 云端尚无版本号（老数据）
      const localDv = Utils.storage.get('dv');
      if (localDv === undefined || localDv === null) {
        Utils.storage.set('dv', dv); // 首次：只记录基准，不刷新
        return;
      }
      if (Number(dv) !== Number(localDv)) {
        Utils.storage.set('dv', dv);
        Utils.showToast(' 其他成员有更新，已自动同步', 2000);
        this.render();
        this.loadTodaySummary();
      }
    } catch (e) {
      // 认证失效由 Auth.getProfile 内部处理；网络错误静默等待下次轮询
    }
  },

  /** 主界面渲染 */
  async render() {
    const container = document.getElementById('app');

    container.innerHTML = `
      <!-- 顶部 -->
      <header class="wx-topbar">
        <span class="wx-title"> 成长日记</span>
        <button class="wx-icon-btn" onclick="WechatApp.showSettings()"></button>
      </header>

      <!-- 今日摘要条 -->
      <div class="wx-summary-bar" id="wx-summary-bar">
        <span> <b id="wx-feed-count">--</b>次</span>
        <span> <b id="wx-feed-ml">--</b>ml</span>
        <span> <b id="wx-stool-count">--</b>次</span>
      </div>

      <!-- 主操作区 -->
      <div class="wx-main-area" id="wx-main-area">
        <!-- 动态渲染 -->
      </div>

      <!-- 底部 -->
      <nav class="wx-tabbar">
        <button class="wx-tab-btn active" data-tab="quick" onclick="WechatApp.switchTab('quick')">
          <span class="wx-tab-icon"></span>首页
        </button>
        <button class="wx-tab-btn" data-tab="history" onclick="WechatApp.switchTab('history')">
          <span class="wx-tab-icon"></span>记录
        </button>
        <button class="wx-tab-btn" data-tab="me" onclick="WechatApp.switchTab('me')">
          <span class="wx-tab-icon"></span>我的
        </button>
      </nav>
    `;

    this.renderQuickActions();
  },

  /** 快捷操作页（语音优先） */
  renderQuickActions() {
    const main = document.getElementById('wx-main-area');
    main.innerHTML = `
      <div class="wx-quick-area">
        <!-- 大语音按钮 -->
        <div class="wx-big-mic-wrap">
          <button class="wx-big-mic" id="wx-big-mic-btn" onclick="WechatApp.startQuickVoice()">
            <span class="wx-mic-icon"></span>
          </button>
          <p class="wx-mic-hint">点击说话，自动识别</p>
          <p class="wx-mic-example">例："上午9点喝了120毫升奶粉"</p>
        </div>

        <!-- 语音识别结果显示区 -->
        <div class="wx-voice-result" id="wx-voice-result" style="display:none">
          <div class="wx-voice-text" id="wx-voice-text"></div>
          <div class="wx-voice-actions">
            <button class="wx-btn wx-btn-success" onclick="WechatApp.confirmVoiceResult()"> 确认保存</button>
            <button class="wx-btn wx-btn-secondary" onclick="WechatApp.cancelVoiceResult()">重说</button>
          </div>
          <div class="wx-voice-edit-hint">识别不完整？<a onclick="WechatApp.switchTab('history');WechatApp.openTableMode('feeding')">切换到表格手动填写</a></div>
        </div>

        <!-- 快捷按钮区 -->
        <div class="wx-shortcuts">
          <div class="wx-shortcut-label">或直接选择：</div>
          <div class="wx-shortcut-grid">
            <button class="wx-shortcut-btn" onclick="WechatApp.quickFeed('breast')">
              <span class="wx-sc-icon"></span>亲喂母乳
            </button>
            <button class="wx-shortcut-btn" onclick="WechatApp.quickFeed('formula')">
              <span class="wx-sc-icon"></span>配方奶
            </button>
            <button class="wx-shortcut-btn" onclick="WechatApp.quickFeed('solids')">
              <span class="wx-sc-icon"></span>辅食
            </button>
            <button class="wx-shortcut-btn" onclick="WechatApp.quickStool()">
              <span class="wx-sc-icon"></span>排便记录
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /** 开始语音识别 */
  startQuickVoice() {
    Voice.start((transcript) => {
      if (!transcript) return;

      const resultDiv = document.getElementById('wx-voice-result');
      const textDiv = document.getElementById('wx-voice-text');

      // 智能判断是喂养还是排便
      const isStool = /便|拉|臭|屎|颜色|稀|干|糊|黄|绿|棕/.test(transcript);
      const mode = isStool ? 'stool' : 'feeding';

      const result = Voice.parse(transcript, mode);

      if (result.confidence === 'low') {
        textDiv.innerHTML = `<p class="wx-parse-text"> "${transcript}"</p>
          <p class="wx-parse-warn"> 识别不完整，请用下方按钮手动填写</p>`;
        resultDiv.style.display = '';
        return;
      }

      // 显示解析结果
      let detailHtml = '';
      if (mode === 'feeding') {
        const typeMap = { breast: ' 母乳亲喂', bottle_breast: ' 母乳瓶喂', formula: ' 配方奶', solids: ' 辅食' };
        detailHtml = `
          <p class="wx-parse-text"> "${transcript}"</p>
          <div class="wx-parse-fields">
            ${result.parsed.type ? `<span class="wx-field-tag">${typeMap[result.parsed.type] || result.parsed.type}</span>` : ''}
            ${result.parsed.amount ? `<span class="wx-field-tag">${result.parsed.amount} ${result.parsed.unit || 'ml'}</span>` : ''}
          </div>
          ${result.confidence === 'partial' ? '<p class="wx-parse-warn">部分识别，请确认后保存</p>' : ''}
        `;
      } else {
        const colorMap = { yellow: '黄色', green: '绿色', brown: '棕色' };
        const consMap = { loose: '稀便', soft: '糊状', hard: '干便' };
        detailHtml = `
          <p class="wx-parse-text"> "${transcript}"</p>
          <div class="wx-parse-fields">
            ${result.parsed.color ? `<span class="wx-field-tag">${colorMap[result.parsed.color] || result.parsed.color}</span>` : ''}
            ${result.parsed.consistency ? `<span class="wx-field-tag">${consMap[result.parsed.consistency] || result.parsed.consistency}</span>` : ''}
          </div>
          ${result.confidence === 'partial' ? '<p class="wx-parse-warn">部分识别，请确认后保存</p>' : ''}
        `;
      }

      textDiv.innerHTML = detailHtml;
      resultDiv.style.display = '';

      // 缓存解析结果
      this._voiceResult = result;
      this._voiceMode = mode;
    });
  },

  /** 确认语音结果并保存 */
  async confirmVoiceResult() {
    if (!this._voiceResult) return;
    const result = this._voiceResult;
    const mode = this._voiceMode;

    Utils.showLoading('保存中...');
    try {
      if (mode === 'feeding') {
        await API.createFeeding({
          type: result.parsed.type || 'formula',
          time: result.parsed.time || new Date().toISOString(),
          amount: result.parsed.amount || undefined,
          unit: result.parsed.unit || 'ml',
          note: '',
          inputMethod: 'voice'
        });
      } else {
        await API.createStool({
          color: result.parsed.color || 'yellow',
          consistency: result.parsed.consistency || 'soft',
          time: result.parsed.time || new Date().toISOString(),
          hasPhoto: false,
          photoUrl: '',
          aiRecognized: false,
          note: '',
          inputMethod: 'voice'
        });
      }

      Utils.hideLoading();
      Utils.showToast(' 已保存');
      document.getElementById('wx-voice-result').style.display = 'none';
      this._voiceResult = null;

      // 刷新今日摘要
      this.loadTodaySummary();
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('保存失败: ' + e.message);
    }
  },

  /** 取消语音结果 */
  cancelVoiceResult() {
    document.getElementById('wx-voice-result').style.display = 'none';
    this._voiceResult = null;
  },

  // ===== 快捷按钮 =====

  /** 快捷喂养 */
  quickFeed(type) {
    const typeLabels = { breast: ' 母乳亲喂', bottle_breast: ' 母乳瓶喂', formula: ' 配方奶', solids: ' 辅食' };
    const label = typeLabels[type] || type;

    // 如果是母乳，直接保存（无需量）
    if (type === 'breast') {
      this._quickSave('feeding', { type, amount: '', unit: '', note: '' });
      return;
    }

    // 配方奶/辅食：弹出量输入
    const amount = prompt(`请输入${label}的量 (ml)：`);
    if (amount === null) return; // 取消

    this._quickSave('feeding', {
      type,
      amount: parseInt(amount) || '',
      unit: 'ml',
      note: ''
    });
  },

  /** 快捷排便 */
  quickStool() {
    this.switchTab('history');
    this.openTableMode('stool');
  },

  /** 快速保存 */
  async _quickSave(type, data) {
    Utils.showLoading('保存中...');
    try {
      if (type === 'feeding') {
        await API.createFeeding({
          ...data,
          time: new Date().toISOString(),
          inputMethod: 'table'
        });
      }
      Utils.hideLoading();
      Utils.showToast(' 已保存');
      this.loadTodaySummary();
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('保存失败: ' + e.message);
    }
  },

  /** 打开表格模式（用于语音失败后补全） */
  openTableMode(mode) {
    const main = document.getElementById('wx-main-area');

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (mode === 'feeding') {
      main.innerHTML = `
        <div class="wx-table-form">
          <h3> 表格填写 - 喂养</h3>

          <div class="wx-form-row">
            <label>时间</label>
            <input type="time" id="wx-feeding-time" class="wx-input" value="${timeStr}">
          </div>

          <div class="wx-form-row">
            <label>类型</label>
            <div class="wx-option-row">
              ${APP_CONFIG.feedingTypes.map(t => `
                <button class="wx-option-btn" data-type="${t.value}" onclick="WechatApp._selectOption(this, 'feedType')">
                  ${t.emoji} ${t.label}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="wx-form-row" id="wx-amount-row">
            <label>奶量</label>
            <input type="number" id="wx-feeding-amount" class="wx-input" placeholder="输入毫升数" min="1">
          </div>

          <button class="wx-btn wx-btn-primary wx-btn-block" onclick="WechatApp._submitTableFeeding()"> 保存</button>
          <button class="wx-btn wx-btn-secondary wx-btn-block" style="margin-top:8px" onclick="WechatApp.switchTab('quick')">返回</button>
        </div>
      `;
    } else if (mode === 'stool') {
      main.innerHTML = `
        <div class="wx-table-form">
          <h3> 排便记录</h3>

          <div class="wx-form-row">
            <label>时间</label>
            <input type="time" id="wx-stool-time" class="wx-input" value="${timeStr}">
          </div>

          <div class="wx-form-row">
            <label>颜色</label>
            <div class="wx-option-row">
              ${APP_CONFIG.stoolOptions.color.map(c => `
                <button class="wx-option-btn" data-color="${c.value}" onclick="WechatApp._selectOption(this, 'stoolColor')">
                  ${c.emoji} ${c.label}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="wx-form-row">
            <label>性状</label>
            <div class="wx-option-row">
              ${APP_CONFIG.stoolOptions.consistency.map(c => `
                <button class="wx-option-btn" data-consistency="${c.value}" onclick="WechatApp._selectOption(this, 'stoolConsistency')">
                  ${c.emoji} ${c.label}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- 拍照识别 -->
          <div class="wx-form-row">
            <label>拍照识别（可选）</label>
            <div class="wx-photo-area" id="wx-stool-photo-area" onclick="WechatApp._openStoolCamera()">
              <div id="wx-stool-photo-content">
                <p class="wx-photo-placeholder"> 点击拍照<br><small>AI 自动识别</small></p>
              </div>
            </div>
            <input type="file" id="wx-stool-photo-input" accept="image/*" capture="environment" style="display:none" onchange="WechatApp._handleStoolPhoto(event)">
            <div id="wx-stool-photo-actions" class="wx-photo-actions" style="display:none">
              <button class="wx-btn wx-btn-ai" onclick="WechatApp._recognizeStoolPhoto()"> AI 识别</button>
              <span id="wx-stool-ai-loading" style="display:none;color:#8E44AD"> AI 分析中...</span>
            </div>
            <div id="wx-stool-ai-result" class="wx-ai-result" style="display:none"></div>
          </div>

          <button class="wx-btn wx-btn-primary wx-btn-block" onclick="WechatApp._submitTableStool()"> 保存</button>
          <button class="wx-btn wx-btn-secondary wx-btn-block" style="margin-top:8px" onclick="WechatApp.switchTab('quick')">返回</button>
        </div>
      `;
    }
  },

  _selectOption(el, type) {
    el.parentElement.querySelectorAll('.wx-option-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    this['_' + type] = el.dataset.type || el.dataset.color || el.dataset.consistency;
  },

  /** 表格提交喂养 */
  async _submitTableFeeding() {
    const type = this._feedType;
    if (!type) { Utils.showToast('请选择类型'); return; }
    const timeVal = document.getElementById('wx-feeding-time')?.value;
    const amount = document.getElementById('wx-feeding-amount')?.value;

    let time = new Date().toISOString();
    if (timeVal) {
      const [h, m] = timeVal.split(':');
      const d = new Date();
      d.setHours(parseInt(h), parseInt(m), 0, 0);
      time = d.toISOString();
    }

    Utils.showLoading('保存中...');
    try {
      await API.createFeeding({ type, time, amount: amount ? parseInt(amount) : undefined, unit: 'ml', note: '', inputMethod: 'table' });
      Utils.hideLoading();
      Utils.showToast(' 已保存');
      this.switchTab('quick');
      this.loadTodaySummary();
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('保存失败: ' + e.message);
    }
  },

  /** 表格提交排便 */
  async _submitTableStool() {
    const color = this._stoolColor;
    const consistency = this._stoolConsistency;
    if (!color || !consistency) { Utils.showToast('请选择颜色和性状'); return; }
    const timeVal = document.getElementById('wx-stool-time')?.value;

    let time = new Date().toISOString();
    if (timeVal) {
      const [h, m] = timeVal.split(':');
      const d = new Date();
      d.setHours(parseInt(h), parseInt(m), 0, 0);
      time = d.toISOString();
    }

    Utils.showLoading('保存中...');
    try {
      await API.createStool({ color, consistency, time, hasPhoto: !!this._stoolPhotoBase64, photoUrl: '', aiRecognized: !!this._stoolAiRecognized, note: '', inputMethod: this._stoolAiRecognized ? 'photo' : 'table' });
      Utils.hideLoading();
      Utils.showToast(' 已保存');
      this._resetPhotoState();
      this.switchTab('quick');
      this.loadTodaySummary();
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('保存失败: ' + e.message);
    }
  },

  // ===== 拍照识别 =====
  _resetPhotoState() {
    this._stoolPhotoBase64 = '';
    this._stoolAiRecognized = false;
  },

  _openStoolCamera() {
    document.getElementById('wx-stool-photo-input').click();
  },

  _handleStoolPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const content = document.getElementById('wx-stool-photo-content');
      content.innerHTML = `<img src="${dataUrl}" class="wx-photo-preview" alt="便便照片">`;

      // 提取 base64（去掉 data:image/...;base64, 前缀）
      const base64 = dataUrl.split(',')[1];
      this._stoolPhotoBase64 = base64;

      // 显示 AI 识别按钮
      document.getElementById('wx-stool-photo-actions').style.display = '';
      document.getElementById('wx-stool-ai-loading').style.display = 'none';
      document.getElementById('wx-stool-ai-result').style.display = 'none';
      this._stoolAiRecognized = false;

      // 更新拍照区域样式
      document.getElementById('wx-stool-photo-area').classList.add('has-photo');
    };
    reader.readAsDataURL(file);
  },

  async _recognizeStoolPhoto() {
    if (!this._stoolPhotoBase64) { Utils.showToast('请先拍照'); return; }

    const btn = document.getElementById('wx-stool-photo-actions');
    const loading = document.getElementById('wx-stool-ai-loading');
    btn.style.display = 'none';
    loading.style.display = '';

    try {
      const result = await API.recognizeStoolPhoto(this._stoolPhotoBase64);

      btn.style.display = 'none';
      loading.style.display = 'none';

      const resultDiv = document.getElementById('wx-stool-ai-result');
      if (!result.recognized) {
        resultDiv.style.display = '';
        resultDiv.innerHTML = `<div class="wx-ai-result-warn"> ${Utils.escapeHtml(result.message || '无法识别')}</div>`;
        return;
      }

      // 映射颜色
      const colorMap = { yellow: 'yellow', green: 'green', brown: 'brown' };
      const colorV = colorMap[result.color] || 'other';
      // 映射性状
      const consMap = { loose: 'loose', soft: 'soft', hard: 'hard' };
      const consV = consMap[result.consistency] || 'other';

      // 自动填入选中的颜色/性状按钮
      this._stoolColor = colorV;
      this._stoolConsistency = consV;
      this._stoolAiRecognized = true;

      // 更新 UI 按钮选中状态
      document.querySelectorAll('.wx-option-btn[data-color]').forEach(b => {
        b.classList.toggle('selected', b.dataset.color === colorV);
      });
      document.querySelectorAll('.wx-option-btn[data-consistency]').forEach(b => {
        b.classList.toggle('selected', b.dataset.consistency === consV);
      });

      // 显示 AI 结果
      resultDiv.style.display = '';
      resultDiv.innerHTML = `
        <div class="wx-ai-result-card">
          <div class="wx-ai-badge"> AI 识别结果</div>
          <div class="wx-ai-text">${Utils.escapeHtml(result.description || '')}</div>
          <div class="wx-ai-tags">
            <span class="wx-ai-tag">颜色: ${result.colorLabel || result.color}</span>
            <span class="wx-ai-tag">性状: ${result.consistencyLabel || result.consistency}</span>
          </div>
        </div>
      `;
    } catch (e) {
      loading.style.display = 'none';
      btn.style.display = 'flex';
      Utils.showToast('AI 识别失败: ' + (e.message || '网络错误'));
    }
  },

  // ===== 标签切换 =====
  switchTab(tab) {
    this.selectedTab = tab;
    document.querySelectorAll('.wx-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    if (tab === 'quick') this.renderQuickActions();
    else if (tab === 'history') this.renderHistory();
    else if (tab === 'me') this.renderMe();
  },

  // ===== 历史记录 =====
  async renderHistory() {
    const main = document.getElementById('wx-main-area');
    main.innerHTML = '<div class="wx-loading">加载中...</div>';

    try {
      const [feedData, stoolData] = await Promise.all([
        API.listFeeding({ pageSize: 30 }).catch(() => null),
        API.listStool({ pageSize: 30 }).catch(() => null)
      ]);

      let allRecords = [];
      if (feedData?.records) {
        feedData.records.forEach(r => { r._recordType = 'feeding'; allRecords.push(r); });
      }
      if (stoolData?.records) {
        stoolData.records.forEach(r => { r._recordType = 'stool'; allRecords.push(r); });
      }
      allRecords.sort((a, b) => new Date(b.time) - new Date(a.time));

      const typeMap = { breast: '亲喂', bottle_breast: '瓶喂', formula: '配方奶', solids: '辅食' };
      const colorMap = { yellow: '黄', green: '绿', brown: '棕', other: '其他' };
      const consMap = { loose: '稀', soft: '糊', hard: '干', other: '其他' };

      main.innerHTML = allRecords.length ? `
        <div class="wx-record-list">
          <div class="wx-record-header">
            <span>最近 ${Math.min(allRecords.length, 30)} 条</span>
            <button class="wx-btn wx-btn-sm" onclick="WechatApp.openTableMode('feeding')">+ 喂养</button>
            <button class="wx-btn wx-btn-sm" onclick="WechatApp.openTableMode('stool')">+ 排便</button>
          </div>
          ${allRecords.map(r => r._recordType === 'feeding' ? `
            <div class="wx-record-item">
              <div class="wx-record-left">
                <span class="wx-rec-time">${Utils.formatTime(r.time)}</span>
                <span class="wx-rec-type">${typeMap[r.type] || r.type}</span>
                ${r.amount ? `<span class="wx-rec-amount">${r.amount}${r.unit}</span>` : ''}
                <span class="wx-rec-tag">${r.inputMethod === 'voice' ? '' : ''}</span>
              </div>
              <span class="wx-rec-recorder">${Utils.escapeHtml(r.recorderNickname || '')}</span>
            </div>
          ` : `
            <div class="wx-record-item">
              <div class="wx-record-left">
                <span class="wx-rec-time">${Utils.formatTime(r.time)}</span>
                <span class="wx-rec-type">${colorMap[r.color]} ${consMap[r.consistency]}</span>
                <span class="wx-rec-tag">${r.inputMethod === 'voice' ? '' : ''}${r.aiRecognized ? '' : ''}</span>
              </div>
              <span class="wx-rec-recorder">${Utils.escapeHtml(r.recorderNickname || '')}</span>
            </div>
          `).join('')}
        </div>
      ` : '<div class="wx-empty"> 暂无记录</div>';
    } catch (e) {
      main.innerHTML = `<div class="wx-error">加载失败: ${Utils.escapeHtml(e.message)}</div>`;
    }
  },

  // ===== 我的页面 =====
  renderMe() {
    const baby = Utils.storage.get('baby');
    const family = Utils.storage.get('family');

    const main = document.getElementById('wx-main-area');
    main.innerHTML = `
      <div class="wx-me-page">
        <div class="wx-me-card">
          <div class="wx-me-avatar"></div>
          <div class="wx-me-name">${Utils.escapeHtml(baby?.name || '未设置宝宝')}</div>
          <div class="wx-me-info">${Utils.escapeHtml(baby?.birthDate || '')} ${baby?.birthDate ? '· ' + Utils.calcWeeksAge(baby.birthDate) + '周' : ''}</div>
        </div>

        <div class="wx-me-menu">
          <div class="wx-me-item">
            <span> 家庭</span>
            <span>${Utils.escapeHtml(family?.name || '未加入')}</span>
          </div>
          <div class="wx-me-item" onclick="WechatApp.showReport()">
            <span> 查看报表</span>
            <span>→</span>
          </div>
          <div class="wx-me-item" onclick="WechatApp.exportData()">
            <span> 导出数据</span>
            <span>→</span>
          </div>
          <div class="wx-me-item" onclick="WechatApp.showDisclaimer()">
            <span>ℹ 健康提示说明</span>
            <span>→</span>
          </div>
        </div>

        <p class="wx-disclaimer-small">${APP_CONFIG.disclaimer}</p>
      </div>
    `;
  },

  // ===== 今日摘要 =====
  async loadTodaySummary() {
    try {
      const [fSum, sSum] = await Promise.all([
        API.feedingTodaySummary().catch(() => null),
        API.stoolTodaySummary().catch(() => null)
      ]);

      const feedCount = document.getElementById('wx-feed-count');
      const feedMl = document.getElementById('wx-feed-ml');
      const stoolCount = document.getElementById('wx-stool-count');

      if (fSum) {
        if (feedCount) feedCount.textContent = fSum.totalCount;
        if (feedMl) feedMl.textContent = fSum.totalMl;
      }
      if (sSum && stoolCount) {
        stoolCount.textContent = sSum.totalCount;
      }
    } catch (e) {
      console.error('摘要加载失败:', e);
    }
  },

  // ===== 其他 =====
  showSettings() {
    this.switchTab('me');
  },

  async exportData() {
    if (!confirm('将导出全部数据？')) return;
    try {
      const result = await API.exportAll();
      Utils.showToast('导出完成！请在浏览器中打开链接下载');
      if (result.files?.csv?.downloadUrl) {
        window.open(result.files.csv.downloadUrl, '_blank');
      }
    } catch (e) {
      Utils.showToast('导出失败');
    }
  },

  showDisclaimer() {
    Utils.showToast('本应用所有健康提示仅基于通用月龄参考范围，不作为医疗诊断依据。如有异常请咨询儿科医生。');
  },

  /** 打开报表页面 */
  async showReport() {
    const main = document.getElementById('wx-main-area');
    main.innerHTML = '<div class="wx-loading">加载报表中...</div>';

    try {
      const data = await API.weeklyReport();
      const colorMap = { yellow: '黄', green: '绿', brown: '棕', other: '其他' };
      const consMap = { loose: '稀', soft: '糊', hard: '干', other: '其他' };

      let feedingDays = '';
      if (data.feeding?.byDate) {
        feedingDays = data.feeding.byDate.map(d =>
          `<tr><td>${d.date.slice(5)}</td><td>${d.totalCount}次</td><td>${d.totalMl}ml</td></tr>`
        ).join('');
      }

      let stoolDays = '';
      if (data.stool?.byDate) {
        stoolDays = data.stool.byDate.map(d => {
          const colors = Object.entries(d.colors || {}).map(([k, v]) => `${colorMap[k]}×${v}`).join(' ');
          return `<tr><td>${d.date.slice(5)}</td><td>${d.totalCount}次</td><td style="font-size:11px">${colors}</td></tr>`;
        }).join('');
      }

      main.innerHTML = `
        <div class="wx-table-form">
          <h3> 本周报告</h3>
          <p style="color:#999;font-size:13px;margin-bottom:16px">${data.dateRange}</p>

          ${data.feeding ? `
          <div style="margin-bottom:16px">
            <div style="font-weight:600;margin-bottom:8px"> 喂养：${data.feeding.overall.totalCount}次 / ${data.feeding.overall.totalMl}ml / 日均${data.feeding.overall.avgPerDay}次</div>
            ${feedingDays ? `<table style="width:100%;font-size:12px;border-collapse:collapse">
              <tr style="color:#999"><td>日期</td><td>次数</td><td>奶量</td></tr>${feedingDays}
            </table>` : ''}
          </div>` : ''}

          ${data.stool ? `
          <div style="margin-bottom:16px">
            <div style="font-weight:600;margin-bottom:8px"> 排便：${data.stool.overall.totalCount}次 / 日均${data.stool.overall.avgPerDay}次</div>
            ${stoolDays ? `<table style="width:100%;font-size:12px;border-collapse:collapse">
              <tr style="color:#999"><td>日期</td><td>次数</td><td>详情</td></tr>${stoolDays}
            </table>` : ''}
          </div>` : ''}

          <p style="font-size:11px;color:#bbb">${data.disclaimer || ''}</p>
          <button class="wx-btn wx-btn-secondary wx-btn-block" onclick="WechatApp.switchTab('me')">返回</button>
        </div>
      `;
    } catch (e) {
      main.innerHTML = `<div class="wx-error">加载失败: ${Utils.escapeHtml(e.message)}<br><button class="wx-btn wx-btn-secondary" style="margin-top:12px" onclick="WechatApp.switchTab('me')">返回</button></div>`;
    }
  },

  // ===== 引导页 =====
  renderOnboarding() {
    document.getElementById('app').innerHTML = `
      <div class="wx-onboard">
        <div class="wx-onboard-logo"></div>
        <h2>欢迎使用成长日记</h2>
        <p>请先创建或加入家庭</p>

        <div class="wx-onboard-form">
          <div class="wx-form-row">
            <label>你的昵称</label>
            <input type="text" id="wx-onboard-nickname" class="wx-input" placeholder="如：妈妈、奶奶">
          </div>
          <button class="wx-btn wx-btn-primary wx-btn-block" onclick="WechatApp._createFamily()"> 创建新家庭</button>

          <div style="margin:20px 0;text-align:center;color:#999">—— 或 ——</div>

          <div class="wx-form-row">
            <label>输入 6 位邀请码</label>
            <input type="text" id="wx-invite-code" class="wx-input" placeholder="如：A1B2C3" maxlength="6" style="text-align:center;font-size:20px;letter-spacing:6px">
          </div>
          <button class="wx-btn wx-btn-secondary wx-btn-block" onclick="WechatApp._joinFamily()"> 加入已有家庭</button>
        </div>
      </div>
    `;
  },

  async _createFamily() {
    const nickname = document.getElementById('wx-onboard-nickname')?.value?.trim();
    if (!nickname) { Utils.showToast('请输入昵称'); return; }

    Utils.showLoading('创建中...');
    try {
      // 使用 Auth 模块创建家庭（HTTP 模式）
      await Auth.createFamily(nickname + '的家庭', nickname);

      // 创建宝宝
      const babyName = prompt('请输入宝宝姓名/小名：');
      if (babyName) {
        const birthDate = prompt('出生日期 (YYYY-MM-DD)：', '2026-06-15');
        if (birthDate) {
          const gender = confirm('性别：\n"确定" = 男\n"取消" = 女') ? 'male' : 'female';
          const birthWeight = parseFloat(prompt('出生体重 (kg)：', '3.2')) || 3.2;

          await API.createBaby({
            name: babyName,
            birthDate,
            gender,
            birthWeight,
            birthWeightUnit: 'kg'
          });

          // 刷新 profile 获取宝宝信息
          await Auth.getProfile();
        }
      }

      Utils.hideLoading();
      Utils.showToast(' 创建成功！');
      this.render();
      this.loadTodaySummary();
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('创建失败: ' + e.message);
    }
  },

  async _joinFamily() {
    const code = document.getElementById('wx-invite-code')?.value?.trim();
    const nickname = document.getElementById('wx-onboard-nickname')?.value?.trim();

    if (!code || code.length !== 6) { Utils.showToast('请输入6位邀请码'); return; }
    if (!nickname) { Utils.showToast('请输入昵称'); return; }

    Utils.showLoading('加入中...');
    try {
      // 使用 Auth 模块加入家庭（HTTP 模式）
      await Auth.joinFamily(code, nickname);

      Utils.hideLoading();
      Utils.showToast(' 加入成功！');
      this.render();
      this.loadTodaySummary();
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('加入失败: ' + e.message);
    }
  }
};

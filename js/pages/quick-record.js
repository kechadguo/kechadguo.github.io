/**
 * 快速记录页 — 全屏分类布局
 */
window.QuickRecordPage = {
  _sleepTimer: null,

  render(container) {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby._id) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">${Lucide.icon('star', 32)}</div><p>请先创建宝宝档案</p><button class="btn btn-primary mt-16" onclick="showPage('onboarding')">去设置</button></div>`;
      return;
    }

    const activeSleep = Utils.getActiveSleepSession();

    let html = `
      <div class="qr-fullscreen" id="qr-main-screen">

        <!-- 睡眠计时器（活跃时显示） -->
        ${activeSleep ? this._sleepTimerHTML(activeSleep) : ''}

        <!-- 喂养 — 直接显示3个按钮 -->
        <div class="qr-section-card" id="qr-feeding-section" data-qr-sec="feeding">
          <div class="qr-section-title">${Lucide.icon('bottle', 20)} 喂养</div>
          <div class="qr-section-grid qr-grid-3">
            <div class="qr-btn qr-btn-default" onclick="App.quickBreast()">
              <div class="qr-btn-icon">${Lucide.icon('heart-pulse', 20)}</div>
              <div class="qr-btn-label">母乳亲喂</div>
            </div>
            <div class="qr-btn qr-btn-default" onclick="App.openBottleBreastForm()">
              <div class="qr-btn-icon">${Lucide.icon('bottle', 20)}</div>
              <div class="qr-btn-label">母乳瓶喂</div>
            </div>
            <div class="qr-btn qr-btn-default" onclick="App.openFormulaForm()">
              <div class="qr-btn-icon">${Lucide.icon('bottle', 20)}</div>
              <div class="qr-btn-label">配方奶</div>
            </div>
          </div>
        </div>

        <!-- 排便 -->
        <div class="qr-section-card qr-other-section" data-qr-sec="stool">
          <div class="qr-section-title">${Lucide.icon('droplet', 20)} 排便</div>
          <div class="qr-section-grid qr-grid-3">
            <div class="qr-btn qr-btn-default" onclick="App.quickAddUrination('urine')">
              <div class="qr-btn-icon">${Lucide.icon('droplet', 20)}</div>
              <div class="qr-btn-label">小便</div>
            </div>
            <div class="qr-btn qr-btn-default" onclick="App.openStoolForm()">
              <div class="qr-btn-icon">${Lucide.icon('droplet', 20)}</div>
              <div class="qr-btn-label">大便</div>
            </div>
            <div class="qr-btn qr-btn-default" onclick="App.quickAddUrination('diaper')">
              <div class="qr-btn-icon">${Lucide.icon('repeat', 20)}</div>
              <div class="qr-btn-label">换尿不湿</div>
            </div>
          </div>
        </div>

        <!-- 健康 -->
        <div class="qr-section-card qr-other-section" data-qr-sec="health">
          <div class="qr-section-title">${Lucide.icon('heart-pulse', 20)} 健康</div>
          <div class="qr-section-grid qr-grid-2">
            <div class="qr-btn qr-btn-default" onclick="App.openTempForm()">
              <div class="qr-btn-icon">${Lucide.icon('thermometer', 20)}</div>
              <div class="qr-btn-label">记录体温</div>
            </div>
            <div class="qr-btn qr-btn-default" onclick="App.openGrowthForm()">
              <div class="qr-btn-icon">${Lucide.icon('ruler', 20)}</div>
              <div class="qr-btn-label">测量数据</div>
            </div>
          </div>
        </div>

        <!-- 清洁 -->
        <div class="qr-section-card qr-other-section" data-qr-sec="clean">
          <div class="qr-section-title">${Lucide.icon('droplet', 20)} 清洁</div>
          <div class="qr-section-grid qr-grid-4">
            <div class="qr-btn qr-btn-default" onclick="App.quickClean('bath')">
              <div class="qr-btn-icon">${Lucide.icon('bath', 20)}</div>
              <div class="qr-btn-label">洗澡</div>
            </div>
            <div class="qr-btn qr-btn-default" onclick="App.quickClean('shampoo')">
              <div class="qr-btn-icon">${Lucide.icon('hand', 20)}</div>
              <div class="qr-btn-label">洗头</div>
            </div>
            <div class="qr-btn qr-btn-default" onclick="App.quickClean('wash_face')">
              <div class="qr-btn-icon">${Lucide.icon('hand', 20)}</div>
              <div class="qr-btn-label">洗脸</div>
            </div>
            <div class="qr-btn qr-btn-default" onclick="App.quickClean('nail_trim')">
              <div class="qr-btn-icon">${Lucide.icon('scissors', 20)}</div>
              <div class="qr-btn-label">剪指甲</div>
            </div>
          </div>
        </div>

        <!-- 足迹 — 下楼溜溜 -->
        <div class="qr-section-card qr-other-section" data-qr-sec="footprint">
          <div class="qr-section-title">${Lucide.icon('footprints', 20)} 足迹</div>
          <div class="qr-section-grid qr-grid-1">
            <div class="qr-btn qr-btn-default" onclick="App.quickWalk()">
              <div class="qr-btn-icon">${Lucide.icon('footprints', 20)}</div>
              <div class="qr-btn-label">下楼溜溜</div>
            </div>
          </div>
        </div>

        <!-- 睡眠 -->
        <div class="qr-section-card qr-other-section" data-qr-sec="sleep">
          <div class="qr-section-title">${Lucide.icon('moon', 20)} 睡眠</div>
          <div class="qr-section-grid qr-grid-1">
            <div class="qr-btn qr-btn-default" onclick="App.toggleSleep()">
              <div class="qr-btn-icon">${activeSleep ? Lucide.icon('timer', 20) : Lucide.icon('moon', 20)}</div>
              <div class="qr-btn-label">${activeSleep ? '结束睡眠' : '开始睡眠'}</div>
            </div>
          </div>
        </div>

        <!-- R2：语音记录 FAB（v2 通道；固定底部 tab-bar 之上，长辈模式全宽放大） -->
        ${window.__UI_V3__ ? `
        <div class="qr-voice-fab ai-disabled-control" role="status" aria-label="AI功能暂未启用">
          <span>${Lucide.icon('file-text', 20)}</span>
          <span>AI功能暂未启用</span>
        </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = html;

    if (activeSleep) {
      this._startSleepTimer();
      App._startGlobalTimer();  // 全局计时器备份
    }
  },

  _sleepTimerHTML(session) {
    const elapsed = Date.now() - session.startTimestamp;
    const v2 = window.__UI_V3__;
    return `
      <div class="sleep-timer-card${v2 ? ' v2-breath' : ''}">
        <div class="sleep-timer-header">
          <span class="sleep-timer-icon">${Lucide.icon('moon', 20)}</span>
          <span class="sleep-timer-label">${v2 ? '<span class="v2-breath-dot"></span>' : ''}睡眠中</span>
        </div>
        <div class="sleep-timer-display" id="sleep-timer-display">${Utils.formatElapsed(elapsed)}</div>
        <div class="sleep-timer-start">开始时间: ${Utils.formatTime(session.startTime)}</div>
        <button class="btn btn-danger btn-block mt-8" onclick="App.toggleSleep()">${Lucide.icon('timer', 18)} 结束并保存</button>
      </div>
    `;
  },

  _startSleepTimer() {
    this._stopSleepTimer();
    this._sleepTimer = setInterval(() => {
      const session = Utils.getActiveSleepSession();
      if (!session) {
        this._stopSleepTimer();
        return;
      }
      const elapsed = Date.now() - session.startTimestamp;
      const display = document.getElementById('sleep-timer-display');
      if (display) display.textContent = Utils.formatElapsed(elapsed);
    }, 1000);
  },

  _stopSleepTimer() {
    if (this._sleepTimer) {
      clearInterval(this._sleepTimer);
      this._sleepTimer = null;
    }
  },

  refresh() {
    const card = document.getElementById('sleep-timer-card');
    if (!card) return;
    const activeSleep = Utils.getActiveSleepSession();
    if (activeSleep) {
      card.classList.remove('hidden');
      card.innerHTML = this._sleepTimerHTML(activeSleep);
      this._startSleepTimer();
    } else {
      card.classList.add('hidden');
      this._stopSleepTimer();
    }
  },

  // ===== R2 · 语音记录（v2 网页端入口；纯规则解析，零 AI） =====
  /** 点击 FAB 开始语音识别；失败/不支持由 Voice 内部 toast 降级（保留表格按钮） */
  startVoice() {
    if (!window.Voice) { Utils.showToast('语音功能不可用，请用表格填写'); return; }
    Voice.start((transcript) => {
      if (!transcript) return; // 取消/失败：Voice 已内部提示
      this._handleVoiceTranscript(transcript);
    });
  },

  /** 解析语音文本：智能判断喂养/排便 → 规则解析 → 不完整跳表格（禁 AI 兜底） */
  _handleVoiceTranscript(transcript) {
    const isStool = /便|拉|臭|屎|颜色|稀|干|糊|黄|绿|棕/.test(transcript);
    const mode = isStool ? 'stool' : 'feeding';
    const result = Voice.parse(transcript, mode);

    if (result.confidence === 'low') {
      // 铁律：规则匹配失败绝不调用 AI 兜底，提示「识别不完整」并跳到表格模式
      Utils.showToast('识别不完整，请用表格填写');
      if (mode === 'stool') App.openStoolForm();
      else App.openFormulaForm();
      return;
    }

    this._voiceResult = result;
    this._voiceMode = mode;
    this._showVoiceConfirm(transcript, result, mode);
  },

  /** 弹出确认 Sheet：原文 + 解析字段 + 保存/重说/表格修改；partial 时展示缺失字段引导 */
  _showVoiceConfirm(transcript, result, mode) {
    const typeMap = { breast: `${Lucide.icon('heart-pulse', 16)} 母乳亲喂`, bottle_breast: `${Lucide.icon('bottle', 16)} 母乳瓶喂`, formula: `${Lucide.icon('bottle', 16)} 配方奶`, solids: `${Lucide.icon('utensils', 16)} 辅食` };
    const colorMap = { yellow: '黄色', green: '绿色', brown: '棕色' };
    const consMap = { loose: `${Lucide.icon('droplet', 16)}稀便`, soft: '糊状', hard: '干便' };
    const fields = mode === 'feeding'
      ? [
          result.parsed.type ? `<span class="tag tag-voice">${typeMap[result.parsed.type] || result.parsed.type}</span>` : '',
          result.parsed.amount ? `<span class="tag tag-voice">${result.parsed.amount} ${result.parsed.unit || 'ml'}</span>` : ''
        ].join('')
      : [
          result.parsed.color ? `<span class="tag tag-voice">${colorMap[result.parsed.color] || result.parsed.color}</span>` : '',
          result.parsed.consistency ? `<span class="tag tag-voice">${consMap[result.parsed.consistency] || result.parsed.consistency}</span>` : ''
        ].join('');

    // R6 新增①：缺失字段清单（「识别不完整」引导用）
    let missingHtml = '';
    if (result.confidence === 'partial') {
      const missing = mode === 'feeding'
        ? [result.parsed.type ? '' : '喂养方式', result.parsed.amount ? '' : '奶量'].filter(Boolean)
        : [result.parsed.color ? '' : '颜色', result.parsed.consistency ? '' : '性状'].filter(Boolean);
      if (missing.length > 0) {
        missingHtml = `
          <div class="voice-missing" style="margin:10px 0;padding:8px 10px;border-radius:8px;background:var(--color-highlight-soft);color:var(--color-highlight-deep);font-size:13px;text-align:left">
            <div style="font-weight:600;margin-bottom:2px">${Lucide.icon('alert-triangle', 16)} 识别不完整</div>
            <div>还缺：<strong>${missing.join('、')}</strong>，可去表格补全</div>
          </div>`;
      }
    }

    App._showModal(mode === 'feeding' ? '确认喂养' : '确认排便', `
      <div style="text-align:center;padding:4px 0">
        <p style="font-size:16px;margin-bottom:12px">"${Utils.escapeHtml(transcript)}"</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:8px">${fields}</div>
        ${result.confidence === 'partial' ? '<p style="font-size:13px;color:var(--warning);margin-bottom:8px">部分识别，请核对后保存</p>' : ''}
      </div>
      ${missingHtml}
      <button class="btn btn-primary btn-block" onclick="QuickRecordPage.confirmVoiceSave()">${Lucide.icon('check-circle', 18)} 确认保存</button>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-secondary" style="flex:1" onclick="QuickRecordPage.retryVoice()">${Lucide.icon('repeat', 18)} 重说</button>
        <button class="btn btn-outline" style="flex:1" onclick="QuickRecordPage.editVoiceByTable()">${Lucide.icon('file-text', 18)} 表格修改</button>
      </div>
    `);
  },

  /** 确认保存（与微信端同一套字段结构，inputMethod='voice'） */
  async confirmVoiceSave() {
    const result = this._voiceResult;
    const mode = this._voiceMode;
    if (!result) return;
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
      App._closeModal();
      this._voiceResult = null;
      Utils.showToast('已保存');
      showPage('dashboard');
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('保存失败: ' + e.message);
    }
  },

  /** 重说：关闭确认 Sheet 重新录音 */
  retryVoice() {
    App._closeModal();
    this._voiceResult = null;
    this.startVoice();
  },

  /** 识别不完整/想手动改：关闭确认 Sheet 跳到表格模式（保留用户已识别的字段体验）
   *  R6 新增①：跳转后自动聚焦/高亮第一个缺失字段（v2 通道）。 */
  editVoiceByTable() {
    App._closeModal();
    const result = this._voiceResult;
    const mode = this._voiceMode;
    this._voiceResult = null;
    const parsed = (result && result.parsed) || {};

    if (mode === 'stool') {
      if (result && result.parsed) Utils.setLastStoolInput(result.parsed); // 预填已识别字段
      App.openStoolForm();
      this._focusMissingStool(parsed);
      return;
    }
    // feeding：识别到明确类型（且非配方奶）→ 完整表单保留类型可改；否则配方奶快捷表单
    if (result && result.parsed) Utils.setLastFeedInput('formula', result.parsed);
    if (parsed.type && parsed.type !== 'formula') {
      App.openFeedForm();
      setTimeout(() => {
        if (parsed.type) App._selectFeedType(parsed.type);
        if (parsed.amount) {
          const amountInput = document.getElementById('feed-amount');
          if (amountInput) amountInput.value = parsed.amount;
        }
        this._focusMissingFeed(parsed);
      }, 60);
    } else {
      App.openFormulaForm();
      this._focusMissingFeed(parsed);
    }
  },

  /** R6 新增①：排便表单缺失字段引导（表单异步渲染，延迟执行） */
  _focusMissingStool(parsed) {
    if (!window.__UI_V3__) return;
    setTimeout(() => {
      if (!parsed.color) this._highlightField('stool-color-opts');
      else if (!parsed.consistency) this._highlightField('stool-consistency-opts');
    }, 150);
  },

  /** R6 新增①：喂养表单缺失字段引导（缺 type 高亮类型组 / 缺奶量聚焦输入框） */
  _focusMissingFeed(parsed) {
    if (!window.__UI_V3__) return;
    setTimeout(() => {
      const feedAmount = document.getElementById('feed-amount');
      if (feedAmount) { // 完整喂养表单
        if (!parsed.amount && parsed.type !== 'breast') {
          const group = document.getElementById('feed-amount-group');
          if (group) { group.classList.add('v2-field-focus'); group.scrollIntoView({ behavior: this._smooth(), block: 'center' }); }
          feedAmount.focus({ preventScroll: true });
          setTimeout(() => group && group.classList.remove('v2-field-focus'), 2400);
        }
        return;
      }
      const formulaAmount = document.getElementById('formula-amount'); // 配方奶快捷表单
      if (formulaAmount && !parsed.amount) {
        formulaAmount.focus({ preventScroll: true });
        const group = formulaAmount.closest('.form-group');
        if (group) { group.classList.add('v2-field-focus'); setTimeout(() => group.classList.remove('v2-field-focus'), 2400); }
      }
    }, 150);
  },

  /** R6 新增①：缺失字段区块高亮（描边脉冲 + 滚动可见），reduced-motion 用瞬时滚动 */
  _highlightField(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('v2-field-focus');
    el.scrollIntoView({ behavior: this._smooth(), block: 'center' });
    setTimeout(() => el.classList.remove('v2-field-focus'), 2400);
  },

  /** reduced-motion 检测：平滑滚动降级为瞬时 */
  _smooth() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }
};

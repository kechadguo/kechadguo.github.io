/**
 * 语音识别模块 — 增强版
 *
 * === 技术声明（按方案提示词4要求如实说明）===
 *
 * 1. 语音转文字：使用浏览器 Web Speech API
 *    - Chrome/Edge: Google 云端语音服务，免费、无公开调用上限
 *    - Safari/iOS: Apple 服务器处理，需联网，无公开调用上限
 *    - Firefox: 不支持 Web Speech API
 *    - 微信内置浏览器(iOS): 使用 WKWebView，理论支持但不稳定
 *    - 微信内置浏览器(Android): 使用 Chromium 内核，支持
 *    -> 结论：属于浏览器/系统自带能力，不产生额外自建费用；
 *       但底层确实调用各厂商云端服务（Google/Apple），我们无法控制。
 *
 * 2. 结构化解析：纯 JavaScript 正则 + 关键词匹配
 *    - 不调用任何 AI 大模型（不含 ChatGPT、文心一言、通义千问等）
 *    - 不调用任何 NLP 云服务
 *    - 完全在浏览器本地执行，0 网络请求
 *    -> 结论：解析环节 100% 本地，0 费用，0 AI 调用。
 *
 * 3. 微信小程序语音：如果将来改为小程序，wx.translateVoice 是微信云端服务
 *    - 免费额度：每个小程序账号每日 10 万次（远超日常用量）
 *    -> 结论：即使将来改用小程序，语音转文字也在免费额度内。
 *
 * 4. 整个语音→解析链路中，没有任何环节调用 AI 大模型。
 */

window.Voice = {
  _recognition: null,
  _isSupported: false,
  _isListening: false,
  _currentCallback: null,
  _checkDone: false,
  _lastError: null,
  _resultReceived: false, // v102-fix：标记已收到结果，防止 stop() 触发的 onerror 显示多余 toast
  // R6 新增：声波可视化（AudioContext analyser）
  _audioCtx: null,
  _analyser: null,
  _mediaStream: null,
  _waveRAF: null,
  _reducedMotion: false,

  /** R6：检测 prefers-reduced-motion（声波降级为静态波形） */
  _checkReducedMotion() {
    try {
      this._reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { this._reducedMotion = false; }
  },

  /** R6：初始化音频分析器（失败返回 null，调用方降级为呼吸圆环） */
  _initAnalyser() {
    if (this._analyser) return Promise.resolve(this._analyser);
    if (!window.__UI_V3__) return Promise.resolve(null); // v1 通道保持原 5 竖条动画
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return Promise.resolve(null);
      const ctx = new AC();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        ctx.close().catch(() => {});
        return Promise.resolve(null);
      }
      return navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        src.connect(analyser);
        this._audioCtx = ctx;
        this._mediaStream = stream;
        this._analyser = analyser;
        return analyser;
      }).catch(() => { ctx.close().catch(() => {}); return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  },

  /** R6：动态创建声波 canvas（v2 通道专属，v1 保留 5 竖条 span） */
  _ensureWaveCanvas(modal) {
    if (!window.__UI_V3__ || !modal) return null;
    let canvas = modal.querySelector('.voice-canvas');
    if (canvas) return canvas;
    const wave = modal.querySelector('.voice-wave');
    if (!wave) return null;
    // 隐藏 V1 竖条，插入 canvas（v2 通道）
    wave.style.display = 'none';
    canvas = document.createElement('canvas');
    canvas.className = 'voice-canvas';
    canvas.width = 260;
    canvas.height = 64;
    canvas.setAttribute('aria-hidden', 'true');
    wave.parentNode.insertBefore(canvas, wave);
    return canvas;
  },

  /** R6：启动波形绘制循环（getByteTimeDomainData 驱动；reduced-motion 只画一帧静态） */
  _startWaveLoop(canvas) {
    this._stopWaveLoop();
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    const draw = () => {
      if (!this._analyser) return; // 无 analyser：CSS 呼吸圆环降级
      const data = new Uint8Array(this._analyser.fftSize);
      this._analyser.getByteTimeDomainData(data);
      const w = canvas.width, h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);
      // 基线
      ctx2d.strokeStyle = 'rgba(120, 90, 60, 0.15)';
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(0, h / 2);
      ctx2d.lineTo(w, h / 2);
      ctx2d.stroke();
      // 波形（accent 色）
      ctx2d.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-accent') || '#E8936B';
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();
      const slice = w / data.length;
      for (let i = 0; i < data.length; i++) {
        const y = (data[i] - 128) / 128 * (h / 2 - 4) + h / 2;
        if (i === 0) ctx2d.moveTo(0, y);
        else ctx2d.lineTo(i * slice, y);
      }
      ctx2d.stroke();
      if (this._reducedMotion) return; // 静态波形，不再循环
      this._waveRAF = requestAnimationFrame(draw);
    };
    draw();
  },

  _stopWaveLoop() {
    if (this._waveRAF) { cancelAnimationFrame(this._waveRAF); this._waveRAF = null; }
  },

  /** R6：interim 阶段灰色实时跟随（新文本前缀匹配则增量更新） */
  _renderInterim(text) {
    const el = document.getElementById('voice-text') || document.getElementById('wx-voice-realtext');
    if (!el) return;
    el.textContent = text;
    el.classList.add('voice-interim');
    el.classList.remove('voice-caret');
  },

  /** R6：final 定格 + 逐字打字机亮起（光标高亮，30ms/字） */
  _renderFinal(text) {
    const el = document.getElementById('voice-text') || document.getElementById('wx-voice-realtext');
    if (!el) return;
    el.classList.remove('voice-interim');
    el.classList.add('voice-caret');
    el.textContent = '';
    const total = text.length;
    let i = 0;
    const tick = () => {
      i++;
      el.textContent = text.slice(0, i);
      if (i < total) {
        this._finalTimer = setTimeout(tick, 30);
      } else {
        el.classList.remove('voice-caret');
      }
    };
    tick();
  },

  /** 检测浏览器是否支持语音识别（只检测 API 存在性，不创建实例） */
  checkSupport() {
    if (this._checkDone) return this._isSupported;
    this._checkDone = true;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.log('[Voice] 浏览器不支持 Web Speech API');
      this._isSupported = false;
      return false;
    }
    this._isSupported = true;
    console.log('[Voice] 语音识别 API 可用，语言：zh-CN');
    return true;
  },

  /** v101：每次创建全新 SpeechRecognition 实例（避免复用导致 onend 未触发就 start 的时序 bug） */
  _createRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = 'zh-CN';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    return r;
  },

  /** 检测当前平台的语音支持等级 */
  getPlatformLevel() {
    const ua = navigator.userAgent;
    // 微信内置浏览器
    if (/MicroMessenger/i.test(ua)) {
      if (/iPhone|iPad|iPod/i.test(ua)) {
        return 'limited'; // 微信 iOS：WKWebView，不稳定
      }
      return 'good'; // 微信 Android：Chromium 内核，支持
    }
    // iOS Safari
    if (/iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS/i.test(ua)) {
      return 'limited'; // iOS Safari 14.5+: 需联网，偶发不稳定
    }
    // Chrome / Edge / 其他 Chromium
    return 'good';
  },

  /** 开始语音识别，成功后回调 callback(transcript) */
  start(callback) {
    const platformLevel = this.getPlatformLevel();

    if (platformLevel === 'limited') {
      console.log('[Voice] 当前平台语音支持有限，做好降级准备');
    }

    if (!this.checkSupport()) {
      Utils.showToast('当前浏览器不支持语音输入，请使用表格填写');
      if (window.App?.onVoiceFallback) App.onVoiceFallback();
      if (window.WechatApp?.onVoiceFallback) WechatApp.onVoiceFallback();
      return false;
    }

    if (this._isListening) {
      this.stop();
      return false;
    }

    // v101-fix：显式停止旧实例并清除事件回调，释放麦克风资源
    // v101 只创建了新实例但未终止旧实例，旧实例在 onend 前仍持有麦克风 → 新实例 start() 静默失败
    if (this._recognition) {
      try {
        const old = this._recognition;
        old.onresult = null;
        old.onerror = null;
        old.onend = null;
        old.abort();
      } catch(e) {}
      this._recognition = null;
    }

    // v101：每次创建全新实例，避免复用旧实例导致第二次 start() 静默失败
    this._recognition = this._createRecognition();
    if (!this._recognition) {
      Utils.showToast('语音功能初始化失败，请使用表格填写');
      if (window.App?.onVoiceFallback) App.onVoiceFallback();
      if (window.WechatApp?.onVoiceFallback) WechatApp.onVoiceFallback();
      return false;
    }

    this._currentCallback = callback;
    this._isListening = true;
    this._lastError = null;
    this._resultReceived = false;

    this._recognition.onresult = (event) => {
      // R6：流式渲染 —— interim 灰色实时跟随，final 逐字定格
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (!transcript && event.results[0]) transcript = event.results[0][0].transcript;
      const isFinal = event.results[event.results.length - 1] && event.results[event.results.length - 1].isFinal;

      if (isFinal) {
        this._renderFinal(transcript);
        this._isListening = false;
        this._resultReceived = true; // v102-fix：标记已收到结果
        // v102-fix：显式停止识别实例，触发麦克风释放（不能只靠 continuous=false 自动停）
        try { this._recognition.stop(); } catch(e) {}
        this._hideModal();
        if (this._currentCallback) {
          this._currentCallback(transcript);
          this._currentCallback = null;
        }
      } else {
        this._renderInterim(transcript);
      }
    };

    this._recognition.onerror = (event) => {
      // v102-fix：如果已经收到结果，stop() 触发的 onerror('aborted') 应忽略
      if (this._resultReceived) return;
      console.error('[Voice] 识别错误:', event.error);
      this._lastError = event.error;
      this._isListening = false;
      this._hideModal();

      let msg = '';
      switch (event.error) {
        case 'not-allowed': msg = '请允许麦克风权限后重试'; break;
        case 'no-speech': msg = '未检测到语音，请靠近麦克风重试'; break;
        case 'network': msg = '语音识别需要网络，请检查网络连接'; break;
        case 'audio-capture': msg = '无法访问麦克风，请检查设备'; break;
        case 'aborted': msg = '已取消'; break;
        default: msg = '语音识别失败，请使用表格填写';
      }

      Utils.showToast(msg);

      // 降级处理
      if (window.App?.onVoiceFallback) App.onVoiceFallback();
      if (window.WechatApp?.onVoiceFallback) WechatApp.onVoiceFallback();
      if (this._currentCallback) {
        this._currentCallback(null);
        this._currentCallback = null;
      }
    };

    this._recognition.onend = () => {
      console.log('[Voice] 识别结束');
      this._isListening = false;
      // v102-fix：onend 在没有 onresult/onerror 的情况下触发 = 静默失败
      // （iOS/微信 WKWebView 麦克风未释放时新实例 start() 会直接 onend）
      // 此时 modal 还开着、callback 还没调用——必须兜底清理
      if (this._currentCallback) {
        console.warn('[Voice] onend 无结果，执行兜底清理');
        this._hideModal();
        this._currentCallback(null);
        this._currentCallback = null;
      }
    };

    this._showModal();
    // v102-fix：延迟 300ms 再 start()，给旧实例的 abort() 足够时间释放麦克风
    // iOS/微信 WKWebView 底层麦克风释放是异步的，立即 start() 会静默失败
    setTimeout(() => {
      if (!this._isListening || !this._recognition) {
        return; // 延迟期间用户已取消
      }
      try {
        this._recognition.start();
        console.log('[Voice] 开始录音，平台等级:', platformLevel);
      } catch (e) {
        console.error('[Voice] 启动失败:', e);
        this._isListening = false;
        this._hideModal();
        Utils.showToast('语音功能启动失败，请使用表格填写');
        if (window.App?.onVoiceFallback) App.onVoiceFallback();
        if (window.WechatApp?.onVoiceFallback) WechatApp.onVoiceFallback();
      }
    }, 300);
    return true;
  },

  stop() {
    if (this._recognition && this._isListening) {
      try { this._recognition.stop(); } catch(e) {} // v102-fix：未 start 时 stop 可能抛异常
    }
    this._isListening = false;
    this._hideModal();
  },

  _showModal() {
    const modal = document.getElementById('voice-modal') || document.getElementById('wx-voice-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const status = document.getElementById('voice-status') || document.getElementById('wx-voice-status');
    const text = document.getElementById('voice-text') || document.getElementById('wx-voice-realtext');
    if (status) status.textContent = '正在聆听...';
    if (text) { text.textContent = ''; text.classList.remove('voice-interim', 'voice-caret'); }
    // R6：声波可视化 —— v2 通道创建 canvas + analyser 波形；失败/微信降级呼吸圆环
    // v101：延迟 200ms 初始化 analyser，避免 getUserMedia 与 SpeechRecognition 同时竞争麦克风
    if (window.__UI_V3__) {
      this._checkReducedMotion();
      const canvas = this._ensureWaveCanvas(modal);
      setTimeout(() => {
        if (!this._isListening) return; // 已停止则不初始化
        this._initAnalyser().then(analyser => {
          if (!analyser && canvas) {
            // 无 analyser：canvas 隐藏，恢复 V1 竖条（保留动画）或展示呼吸圆环
            canvas.style.display = 'none';
            const wave = modal.querySelector('.voice-wave');
            if (wave) {
              wave.style.display = '';
              wave.classList.add('voice-breath'); // 呼吸节奏动画
            }
            return;
          }
          this._startWaveLoop(canvas);
        }).catch(() => {});
      }, 200);
    }
  },

  _hideModal() {
    const modal = document.getElementById('voice-modal') || document.getElementById('wx-voice-modal');
    if (modal) modal.classList.add('hidden');
    // R6：停止波形循环；释放音频资源（下次说话重新获取）
    this._stopWaveLoop();
    if (this._finalTimer) { clearTimeout(this._finalTimer); this._finalTimer = null; }
    // v101：先断引用再异步 close，避免旧资源未释放完时新 AudioContext 创建冲突
    if (this._audioCtx) {
      const stream = this._mediaStream;
      const ctx = this._audioCtx;
      this._audioCtx = null;
      this._mediaStream = null;
      this._analyser = null;
      try {
        if (stream) stream.getTracks().forEach(t => t.stop());
        ctx.close().catch(() => {});
      } catch (e) {}
    }
  },

  // ============================================================
  //  结构化解析 — 纯规则引擎（不调用任何 AI）
  // ============================================================

  /**
   * 解析语音文本为结构化字段
   * @returns {{ parsed: object, confidence: 'full'|'partial'|'low', missing: string[] }}
   */
  parse(transcript, mode) {
    const text = transcript.trim();
    if (!text) return { parsed: {}, confidence: 'low', missing: ['无法识别内容'] };

    if (mode === 'feeding') {
      return this._parseFeeding(text);
    } else if (mode === 'stool') {
      return this._parseStool(text);
    }

    return { parsed: {}, confidence: 'low', missing: ['未知模式'] };
  },

  /** 中文数字 → 阿拉伯数字（支持"一百二十"→120，排除"一下"等短语） */
  _parseChineseNumber(text) {
    const map = { '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
      '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
    const unitMap = { '十': 10, '百': 100, '千': 1000 };

    // 排除常见非数字短语（如"一下"、"一起"等）
    if (/一下|一起|一直|一定|一样|一般|一会儿|一些/.test(text)) {
      // 如果匹配到的中文数字完全是这些短语的一部分，跳过
      const phraseMatch = text.match(/一下|一起|一直|一定|一样|一般|一会儿|一些/g);
    }

    const cnMatch = text.match(/[零一二两三四五六七八九十百千]+/);
    if (!cnMatch) return null;

    // 排除独立"一"出现在"一下"、"一起"等短语中（后面没有数字或单位）
    const cnStr = cnMatch[0];
    if (cnStr === '一') {
      const idx = text.indexOf('一');
      const afterCtx = text.slice(idx, idx + 3);
      // 排除短语：一下、一起、一直、一定、一样、一般、一会儿
      if (/^(一下|一起|一直|一定|一样|一般|一会儿|一些)/.test(afterCtx)) {
        return null;
      }
    }

    let num = 0;
    let temp = 0;
    const str = cnMatch[0];

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (unitMap[ch]) {
        temp = (temp || 1) * unitMap[ch];
        num += temp;
        temp = 0;
      } else {
        temp = map[ch] || 0;
        if (i === str.length - 1) num += temp;
      }
    }
    return num > 0 ? num : null;
  },

  /** 解析相对时间表达 */
  _parseRelativeTime(text) {
    const now = new Date();
    // "刚刚"、"刚才"
    if (/刚刚|刚才|现在/.test(text)) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(),
        now.getHours(), now.getMinutes()).toISOString();
    }
    // "半小时前"、"1小时前"
    const agoMatch = text.match(/(半|(\d+))?\s*(个)?\s*小?时前/);
    if (agoMatch) {
      const mins = agoMatch[1] === '半' ? 30 : (parseInt(agoMatch[1]) || 1) * 60;
      return new Date(now - mins * 60000).toISOString();
    }
    // "10分钟前"
    const minAgo = text.match(/(\d+)\s*分钟前/);
    if (minAgo) {
      return new Date(now - parseInt(minAgo[1]) * 60000).toISOString();
    }
    return null;
  },

  /** 解析喂养语音 */
  _parseFeeding(text) {
    const result = { type: '', amount: '', unit: 'ml' };
    let matchedCount = 0;

    // 1. 识别喂养类型（先匹配具体，再匹配模糊）
    if (/奶粉|配方|奶瓶|冲奶|喝.*[粉奶]|泡奶|兑奶|喝了.*毫升/.test(text)) {
      result.type = 'formula';
      matchedCount++;
    } else if (/辅食|米粉|果泥|菜泥|米糊|吃.*饭|蛋黄|肉泥|吃.*东西|加.*食/.test(text)) {
      result.type = 'solids';
      matchedCount++;
    } else if (/母乳|亲喂|哺乳|直接喂|喂了奶|吃.*奶/.test(text)) {
      result.type = 'breast';
      matchedCount++;
    }

    // 2. 识别数量 + 单位（扩展模式）
    // 先尝试匹配数字+单位模式，避免时间数字被误识别为数量
    const amountWithUnit = text.match(/(\d+)\s*(毫升|ml|克|g|勺|匙|安士|oz)/i);
    if (amountWithUnit) {
      result.amount = parseInt(amountWithUnit[1]);
      const unitRaw = amountWithUnit[2].toLowerCase();
      if (unitRaw === '克' || unitRaw === 'g') result.unit = 'g';
      else if (unitRaw === '勺' || unitRaw === '匙') result.unit = 'g';
      else result.unit = 'ml';
      matchedCount++;
    } else if (/半瓶|一半/.test(text)) {
      result.amount = 60;
      result.unit = 'ml';
      matchedCount++;
    } else {
      const cnNum = this._parseChineseNumber(text);
      if (cnNum) {
        result.amount = cnNum;
        matchedCount++;
      } else {
        // 注意：排除时间表达中的数字（如"6点"中的6）
        const numWithoutTime = text.replace(/\d{1,2}[点时]\d{0,2}[分]?/g, '').match(/(\d+)/);
        if (numWithoutTime && parseInt(numWithoutTime[1]) > 0 && parseInt(numWithoutTime[1]) < 2000) {
          result.amount = parseInt(numWithoutTime[1]);
          matchedCount++;
        }
      }
    }

    // 3. 识别时间
    const timeMatch = text.match(/(\d{1,2})[点时](\d{1,2})?[分]?/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1]);
      const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        const now = new Date();
        result.time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).toISOString();
        matchedCount++;
      }
    } else {
      const relTime = this._parseRelativeTime(text);
      if (relTime) {
        result.time = relTime;
        matchedCount++;
      }
    }

    // 4. 识别时间段（早上/上午/中午/下午/晚上）
    if (!result.time) {
      let hour = null;
      if (/早上|早晨/.test(text)) hour = 8;
      else if (/上午/.test(text)) hour = 10;
      else if (/中午/.test(text)) hour = 12;
      else if (/下午/.test(text)) hour = 15;
      else if (/晚上|傍晚/.test(text)) hour = 19;
      else if (/夜里|半夜/.test(text)) hour = 2;

      if (hour !== null) {
        const now = new Date();
        result.time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0).toISOString();
        matchedCount++;
      }
    }

    return {
      parsed: result,
      confidence: matchedCount >= 2 ? 'full' : matchedCount === 1 ? 'partial' : 'low',
      missing: this._getMissingFields(result, ['type', 'amount'])
    };
  },

  /** 解析排便语音 */
  _parseStool(text) {
    const result = { color: '', consistency: '' };
    let matchedCount = 0;

    // 1. 识别颜色（扩展模式）
    // 注意：正则需包含独立单字（如"绿"）以匹配"有点绿"这类口语表达
    if (/黄色|金黄|黄的|黄便|黄[^\d]/.test(text + ' ')) {
      result.color = 'yellow'; matchedCount++;
    } else if (/绿色|绿的|绿便|绿[^\d]|发绿|墨绿|深绿/.test(text + ' ')) {
      result.color = 'green'; matchedCount++;
    } else if (/棕色|褐色|咖啡色|深色/.test(text)) {
      result.color = 'brown'; matchedCount++;
    } else if (/黑色|黑的|黑便|黑[^\d]/.test(text + ' ')) {
      result.color = 'other'; matchedCount++; // 不诊断，只记录为"其他"
    } else if (/红色|血丝|带血|红[^\d]/.test(text + ' ')) {
      result.color = 'other'; matchedCount++; // 只记录，不诊断
    }

    // 2. 识别性状（扩展模式）
    if (/稀|水样|拉稀|腹泻|稀的|水便|蛋花/.test(text)) {
      result.consistency = 'loose'; matchedCount++;
    } else if (/糊|软的|正常|好的|糊状|软便|成形的?/.test(text)) {
      result.consistency = 'soft'; matchedCount++;
    } else if (/干|硬的|干燥|便秘|干结|羊粪|一粒/.test(text)) {
      result.consistency = 'hard'; matchedCount++;
    } else if (/颗粒|有粒/.test(text)) {
      result.consistency = 'other'; matchedCount++;
    }

    // 3. 识别时间
    const timeMatch = text.match(/(\d{1,2})[点时](\d{1,2})?[分]?/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1]);
      const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        const now = new Date();
        result.time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).toISOString();
        matchedCount++;
      }
    } else {
      const relTime = this._parseRelativeTime(text);
      if (relTime) {
        result.time = relTime;
        matchedCount++;
      }
    }

    // 4. 识别时间段
    if (!result.time) {
      let hour = null;
      if (/早上|早晨/.test(text)) hour = 8;
      else if (/上午/.test(text)) hour = 10;
      else if (/中午/.test(text)) hour = 12;
      else if (/下午/.test(text)) hour = 15;
      else if (/晚上/.test(text)) hour = 19;

      if (hour !== null) {
        const now = new Date();
        result.time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0).toISOString();
        matchedCount++;
      }
    }

    return {
      parsed: result,
      confidence: matchedCount >= 2 ? 'full' : matchedCount === 1 ? 'partial' : 'low',
      missing: this._getMissingFields(result, ['color', 'consistency'])
    };
  },

  /** 获取缺失字段列表 */
  _getMissingFields(parsed, requiredFields) {
    const missing = [];
    for (const field of requiredFields) {
      if (!parsed[field]) {
        const labels = {
          type: '喂养类型',
          amount: '奶量',
          color: '颜色',
          consistency: '性状'
        };
        missing.push(labels[field] || field);
      }
    }
    return missing;
  },

  /** 解析结果填入表单字段 */
  applyToForm(parsed, mode) {
    if (!parsed || !Object.keys(parsed).length) return;

    const prefix = mode === 'feeding' ? 'feeding' : 'stool';
    const form = document.getElementById(`${prefix}-form`) ||
                 document.querySelector('.wx-table-form');

    if (!form) return;

    if (mode === 'feeding') {
      if (parsed.type) {
        form.querySelectorAll('.option-btn[data-type]').forEach(b => {
          b.classList.toggle('selected', b.dataset.type === parsed.type);
        });
      }
      if (parsed.amount) {
        const amountInput = form.querySelector(`#${prefix}-amount`) ||
                            form.querySelector('input[type="number"]');
        if (amountInput) amountInput.value = parsed.amount;
      }
      if (parsed.unit) {
        const unitInput = form.querySelector(`#${prefix}-unit`);
        if (unitInput) unitInput.value = parsed.unit;
      }
      if (parsed.time) {
        const timeInput = form.querySelector(`#${prefix}-time`) ||
                          form.querySelector('input[type="time"]');
        if (timeInput) {
          const d = new Date(parsed.time);
          timeInput.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
      }
    } else if (mode === 'stool') {
      if (parsed.color) {
        form.querySelectorAll('.option-btn[data-color]').forEach(b => {
          b.classList.toggle('selected', b.dataset.color === parsed.color);
        });
      }
      if (parsed.consistency) {
        form.querySelectorAll('.option-btn[data-consistency]').forEach(b => {
          b.classList.toggle('selected', b.dataset.consistency === parsed.consistency);
        });
      }
      if (parsed.time) {
        const timeInput = form.querySelector('input[type="time"]');
        if (timeInput) {
          const d = new Date(parsed.time);
          timeInput.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
      }
    }
  },

  // ============================================================
  //  自测工具
  // ============================================================

  /**
   * 批量测试解析准确率
   * @returns {{ total: number, full: number, partial: number, low: number, accuracy: string }}
   */
  runTests() {
    const feedingCases = [
      // [输入文本, 期望type, 期望amount, 描述]
      ['上午9点喝了120毫升奶粉', 'formula', 120, '标准配方奶'],
      ['刚刚亲喂了母乳', 'breast', '', '母乳刚刚'],
      ['中午吃了辅食米粉', 'solids', '', '辅食'],
      ['3点喝了90ml奶粉', 'formula', 90, '数字时间+英文单位'],
      ['晚上吃了半碗米粉', 'solids', '', '辅食晚上'],
      ['喝了一百二十毫升配方奶', 'formula', 120, '中文数字'],
      ['早上6点喂了奶', 'breast', '', '母乳早上'],
      ['半小时前喝了60毫升', 'formula', 60, '相对时间'],
      ['10点吃了3勺米粉', 'solids', 3, '勺单位'],
      ['喂了150的奶粉', 'formula', 150, '简化表达'],
    ];

    const stoolCases = [
      ['黄色糊状', 'yellow', 'soft', '标准描述'],
      ['绿的有点稀', 'green', 'loose', '口语化'],
      ['干的棕色', 'brown', 'hard', '干便'],
      ['金黄色糊状的', 'yellow', 'soft', '完整描述'],
      ['有点绿正常的', 'green', 'soft', '口语化2'],
      ['拉稀水样的', '', 'loose', '没有颜色'],
      ['黄色一粒一粒的', 'yellow', 'hard', '颗粒状'],
      ['早上拉的黄色软便', 'yellow', 'soft', '带时间'],
    ];

    let total = 0, full = 0, partial = 0, low = 0;

    for (const [text, expType, expAmount] of feedingCases) {
      const r = this._parseFeeding(text);
      total++;
      if (r.parsed.type === expType && (expAmount === '' || r.parsed.amount === expAmount)) {
        full++;
      } else if (r.parsed.type === expType || (expAmount && r.parsed.amount === expAmount)) {
        partial++;
      } else {
        low++;
      }
    }

    for (const [text, expColor, expCons] of stoolCases) {
      const r = this._parseStool(text);
      total++;
      const colorOk = !expColor || r.parsed.color === expColor;
      const consOk = r.parsed.consistency === expCons;
      if (colorOk && consOk) full++;
      else if (colorOk || consOk) partial++;
      else low++;
    }

    const accuracy = ((full / total) * 100).toFixed(1);
    return { total, full, partial, low, accuracy: accuracy + '%' };
  }
};

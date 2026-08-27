/* 亲喂记录：估算、快捷时间、吸奶测试与专用表单 */
window.BreastFeeding = {
  durationFactors: { '<5min': 0.6, '5-15min': 1, '>15min': 1.2 },
  durationLabels: { none: '不记录', '<5min': '5分钟内', '5-15min': '5-15分钟', '>15min': '15分钟以上' },
  sideLabels: { none: '不记录', left: '左侧', right: '右侧', both: '双侧' },

  settings() {
    const defaults = { showDuration: true, showSide: true, quickTimeCount: 5, estimateMethod: 'standard', estimateFactors: { duration: true, interval: true }, showEstimateIcon: true, chartDistinguish: true };
    try { return { ...defaults, ...(Utils.storage.get('breast-feeding-settings') || {}) }; } catch { return defaults; }
  },
  saveSettings(next) { Utils.storage.set('breast-feeding-settings', { ...this.settings(), ...next }); },
  pumpTests() { return this._pumpTests || Utils.storage.get('breast-pump-tests') || []; },
  async loadPumpTests() { if (window.API?.listBreastPumpTests) { const result = await API.listBreastPumpTests().catch(() => null); if (result?.records) { this._pumpTests = result.records; return this._pumpTests; } } return this.pumpTests(); },
  savePumpTests(list) { this._pumpTests = list; Utils.storage.set('breast-pump-tests', list); },
  pumpAverageRate() { const list = this.pumpTests().filter(x => Number(x.rate) > 0); return list.length ? Math.round(list.reduce((s, x) => s + Number(x.rate), 0) / list.length) : null; },
  monthStandard(monthAge) { if (monthAge < 1) return 75; if (monthAge < 3) return 105; if (monthAge < 6) return 135; if (monthAge < 12) return 165; return 180; },
  intervalHours(current, previous) { if (!previous) return 0; const h = (new Date(current) - new Date(previous)) / 3600000; return h > 0 ? h : 0; },
  intervalFactor(hours) { if (!hours) return 1; if (hours < 2) return 0.7; if (hours > 4) return 1.2; return 1; },
  estimate(record, baby, lastRecord) {
    const s = this.settings();
    const monthAge = baby?.birthDate ? Utils.calcMonthAge(baby.birthDate) : 0;
    const intervalHours = this.intervalHours(record.time, lastRecord?.time);
    const rate = this.pumpAverageRate();
    let method = s.estimateMethod === 'pump' && rate && intervalHours ? 'pump' : 'standard';
    const standard = this.monthStandard(monthAge);
    const baseAmount = method === 'pump' ? Math.round(rate * intervalHours) : standard;
    const durationFactor = s.estimateFactors.duration && record.duration ? (this.durationFactors[record.duration] || 1) : 1;
    const intervalFactor = s.estimateFactors.interval ? this.intervalFactor(intervalHours) : 1;
    const amount = Math.max(10, Math.round(baseAmount * durationFactor * (method === 'pump' ? 1 : intervalFactor) / 5) * 5);
    return { amount, method, baseAmount, intervalHours: Math.round(intervalHours * 10) / 10, durationFactor, intervalFactor, originalAmount: amount, pumpRate: rate || null, monthAge };
  },
  timeOptions() {
    const now = new Date(); const count = Math.max(1, Math.min(5, Number(this.settings().quickTimeCount) || 5)); const options = [];
    for (let i = 0; i < count; i++) { const d = new Date(now.getTime() - i * 3600000); options.push({ value: d.toISOString(), label: i === 0 ? `刚才（${Utils.formatTime(d)}）` : `${i}小时前（${Utils.formatTime(d)}）` }); }
    return options;
  },
  selectedTime() { return this._selectedTime || new Date().toISOString(); },
  setTime(value) { this._selectedTime = value; const custom = document.getElementById('breast-custom-time'); if (custom) custom.style.display = value === 'custom' ? '' : 'none'; if (value !== 'custom') this._refreshEstimate(); },
  async openForm(existing = null) {
    this._editing = existing;
    this._recentRecords = [];
    if (!existing && window.API?.listFeeding) {
      const end = new Date(); const start = new Date(end.getTime() - 14 * 86400000);
      const result = await API.listFeeding({ startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), page: 1, pageSize: 500 }).catch(() => ({ records: [] }));
      this._recentRecords = result.records || [];
    }
    const now = new Date(); this._selectedTime = existing?.time || now.toISOString();
    this._duration = existing?.duration || 'none'; this._side = existing?.side || 'none'; this._manualAmount = existing?.amount || null;
    const opts = this.timeOptions();
    const timeRows = opts.map(o => `<option value="${o.value}" ${this._selectedTime === o.value ? 'selected' : ''}>${o.label}</option>`).join('');
    App._showModal(existing ? '编辑亲喂记录' : '亲喂记录', `<div class="breast-form" id="breast-form">
      <div class="form-group"><label>记录时间 *</label><select id="breast-time" class="form-input" onchange="BreastFeeding.setTime(this.value)">${timeRows}<option value="custom">自定义时间...</option></select><input id="breast-custom-time" class="form-input" type="datetime-local" style="display:none;margin-top:8px" onchange="BreastFeeding.setTime(this.value)"></div>
      ${this.settings().showDuration ? `<div class="form-group"><label>喂养时长</label><div class="breast-choice-row">${Object.entries(this.durationLabels).map(([k,v]) => `<button type="button" class="breast-choice ${this._duration === k ? 'selected' : ''}" data-duration="${k}" onclick="BreastFeeding.chooseDuration('${k}')">${v}</button>`).join('')}</div></div>` : ''}
      ${this.settings().showSide ? `<div class="form-group"><label>喂养部位</label><div class="breast-choice-row">${Object.entries(this.sideLabels).map(([k,v]) => `<button type="button" class="breast-choice ${this._side === k ? 'selected' : ''}" data-side="${k}" onclick="BreastFeeding.chooseSide('${k}')">${v}</button>`).join('')}</div></div>` : ''}
      <div class="breast-estimate-box"><div><span>估算奶量：</span><strong id="breast-estimate-value">计算中...</strong><button type="button" class="icon-btn" title="估算说明" onclick="BreastFeeding.showEstimateInfo()">ⓘ</button></div><div class="breast-adjust"><button type="button" class="btn btn-outline btn-sm" onclick="BreastFeeding.adjust(-10)">-10</button><button type="button" class="btn btn-outline btn-sm" onclick="BreastFeeding.adjust(10)">+10</button><button type="button" id="breast-reset" class="btn btn-link btn-sm" style="display:none" onclick="BreastFeeding.resetAmount()">恢复原始估算</button></div></div>
      <div class="form-group"><label>备注</label><input id="breast-note" class="form-input" value="${Utils.escapeHtml(existing?.note || '')}" placeholder="输入备注..."></div>
      <div class="breast-form-actions"><button type="button" class="btn btn-outline" onclick="App._closeModal()">取消</button><button type="button" class="btn btn-primary" onclick="BreastFeeding.submit()">${existing ? '保存修改' : '确认记录'}</button></div>
    </div>`);
    this._refreshEstimate();
  },
  chooseDuration(v) { this._duration = v; document.querySelectorAll('[data-duration]').forEach(x => x.classList.toggle('selected', x.dataset.duration === v)); this._refreshEstimate(); },
  chooseSide(v) { this._side = v; document.querySelectorAll('[data-side]').forEach(x => x.classList.toggle('selected', x.dataset.side === v)); },
  adjust(delta) { this._manualAmount = Math.max(10, (this._manualAmount || this._estimate?.amount || 0) + delta); const el = document.getElementById('breast-estimate-value'); if (el) el.textContent = `${this._manualAmount}ml*`; const reset = document.getElementById('breast-reset'); if (reset) reset.style.display = ''; },
  resetAmount() { this._manualAmount = null; this._refreshEstimate(); const reset = document.getElementById('breast-reset'); if (reset) reset.style.display = 'none'; },
  _refreshEstimate() {
    const baby = Utils.getBabyInfo(); const records = this._recentRecords || []; const last = records.filter(x => x.type === 'breast' && x.time < this.selectedTime()).sort((a,b) => new Date(b.time) - new Date(a.time))[0];
    this._estimate = this.estimate({ time: this.selectedTime(), duration: this._duration }, baby, last); const el = document.getElementById('breast-estimate-value'); if (el) el.textContent = `~${this._manualAmount || this._estimate.amount}ml${this._manualAmount ? '*' : ''}`;
  },
  async submit() {
    const select = document.getElementById('breast-time'); let time = select?.value;
    if (time === 'custom') time = document.getElementById('breast-custom-time')?.value; if (!time || time === 'custom') return Utils.showToast('请选择记录时间');
    const estimate = this.estimate({ time: new Date(time).toISOString(), duration: this._duration }, Utils.getBabyInfo(), null); const amount = this._manualAmount || estimate.amount;
    const data = { type: 'breast', feedingSubtype: 'breast_direct', time: new Date(time).toISOString(), amount, unit: 'ml', duration: this._duration === 'none' ? null : this._duration, side: this._side === 'none' ? null : this._side, note: document.getElementById('breast-note')?.value || '', isEstimated: true, isManualAdjusted: !!this._manualAmount, estimate: { ...estimate, originalAmount: estimate.amount }, inputMethod: 'table' };
    try { Utils.showLoading('保存中...'); if (this._editing?._id) await API.updateFeeding(this._editing._id, data); else await API.createFeeding(data); Utils.hideLoading(); App._closeModal(); Utils.showToast('亲喂记录已保存'); App._refreshCurrent(); } catch (e) { Utils.hideLoading(); Utils.showToast('保存失败：' + e.message); }
  },
  showEstimateInfo() { App._showModal('估算说明', `<p>当前估算值：<strong>~${this._manualAmount || this._estimate?.amount || 0}ml</strong></p><p class="text-muted">估算方式：${this._estimate?.method === 'pump' ? '吸奶测试参考值' : '月龄标准'}。实际奶量可能存在约20-30%差异，仅作记录参考。</p>`); },
  async quick() { this.openForm(); },
  async openPumpManager() { await this.loadPumpTests(); const tests = this.pumpTests(); const rate = this.pumpAverageRate(); App._showModal('吸奶参考值管理', `<div class="pump-manager"><div class="pump-rate">当前产奶速率：<strong>${rate || '—'}ml/小时</strong><small>基于${tests.length}条测试记录</small></div><button class="btn btn-primary btn-block" onclick="BreastFeeding.addPumpTest()">+ 添加新测试</button><div class="pump-list">${tests.map(t => `<div class="pump-item"><strong>${t.testTime}</strong><span>距上次${t.intervalHours}小时 · 吸出${t.amount}ml · ${t.rate}ml/h</span><button class="btn btn-link" onclick="BreastFeeding.deletePumpTest('${t.id}')">删除</button></div>`).join('')}</div><p class="text-muted">吸奶器数据用于估算参考，实际吸吮效率可能不同。</p></div>`); },
  addPumpTest() { App._showModal('添加吸奶测试', `<div class="form-group"><label>测试时间</label><input id="pump-time" type="datetime-local" class="form-input"></div><div class="form-group"><label>距上次喂养时间（小时）*</label><input id="pump-interval" type="number" min="0.5" step="0.5" class="form-input" value="2"></div><div class="form-group"><label>吸出奶量（ml）*</label><input id="pump-amount" type="number" min="1" class="form-input"></div><div class="form-group"><label>备注</label><input id="pump-note" class="form-input"></div><button class="btn btn-primary btn-block" onclick="BreastFeeding.savePumpTest()">保存</button>`); },
  async savePumpTest() { const interval = Number(document.getElementById('pump-interval')?.value); const amount = Number(document.getElementById('pump-amount')?.value); if (!(interval > 0 && amount > 0)) return Utils.showToast('请填写有效测试数据'); const record = { testTime: document.getElementById('pump-time')?.value || new Date().toISOString(), intervalHours: interval, amount, rate: Math.round(amount / interval), note: document.getElementById('pump-note')?.value || '' }; if (window.API?.addBreastPumpTest) await API.addBreastPumpTest(record).catch(e => Utils.showToast('云端保存失败：' + e.message)); const list = this.pumpTests(); list.unshift({ id: 'pump-' + Date.now(), ...record }); this.savePumpTests(list); App._closeModal(); this.openPumpManager(); },
  async deletePumpTest(id) { if (window.API?.deleteBreastPumpTest && !String(id).startsWith('pump-')) await API.deleteBreastPumpTest(id).catch(() => {}); this.savePumpTests(this.pumpTests().filter(x => x.id !== id && x._id !== id)); this.openPumpManager(); }
};

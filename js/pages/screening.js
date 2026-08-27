window.ScreeningPage = {
  _records: [],
  _items: [
    { id: 'hearing_48h', name: '听力筛查（48小时）', icon: '耳', suggestDay: 2, desc: '出生后早期完成初筛，未通过需按医嘱复查。' },
    { id: 'hearing_42d', name: '听力复筛（42天）', icon: '耳', suggestDay: 42, desc: '首次未通过或需要复查时进行。' },
    { id: 'metabolic', name: '遗传代谢病筛查', icon: '检', suggestDay: 3, desc: '足跟血筛查，用于早期发现相关代谢疾病。' },
    { id: 'heart', name: '先心病筛查', icon: '心', suggestDay: 3, desc: '结合脉搏血氧和医生检查结果记录。' },
    { id: 'hip', name: '髋关节检查', icon: '骨', suggestDay: 42, desc: '按医生建议评估髋关节发育。' },
    { id: 'jaundice', name: '黄疸监测', icon: '黄', suggestDay: 3, desc: '记录监测日期、结果和医生建议。' }
  ],
  async render(container) {
    this.container = container;
    Utils.showLoading();
    try { const result = await API.listScreenings().catch(() => ({ records: [] })); this._records = result.records || []; container.innerHTML = this._html(); } finally { Utils.hideLoading(); }
  },
  _html() {
    const baby = Utils.getBabyInfo();
    const daysOld = baby?.birthDate ? Math.max(0, Math.floor((Date.now() - new Date(baby.birthDate)) / 86400000)) : 0;
    const completed = this._items.filter(i => this._records.some(r => r.screeningId === i.id)).length;
    return `<div class="page-header"><h2 class="page-title">新生儿筛查</h2><p class="text-muted">记录筛查结果，复查事项请以医生建议为准。</p></div><div class="card screening-progress"><div class="sp-header"><span>筛查完成度</span><strong>${completed}/${this._items.length}</strong></div><div class="sp-bar"><div class="sp-bar-fill" style="width:${Math.round(completed / this._items.length * 100)}%"></div></div><div class="sp-hint">宝宝出生第${daysOld}天</div></div><div class="card"><div class="card-title">${Lucide.icon('clipboard-check', 17)} 筛查项目</div><div class="screening-list">${this._items.map(i => this._itemHTML(i, daysOld)).join('')}</div></div><div class="card screening-info-card"><div class="card-title">${Lucide.icon('info', 17)} 记录说明</div><p class="text-muted">筛查结果中的“需复查”或“异常”不等于确诊，请按医院安排完成进一步检查；出现紧急症状应及时就医。</p></div>`;
  },
  _itemHTML(item, daysOld) {
    const record = this._records.find(r => r.screeningId === item.id);
    const status = record ? (record.result === 'pass' ? '通过' : record.result === 'refer' ? '需复查' : '异常') : (daysOld > item.suggestDay ? '待补记' : `建议第${item.suggestDay}天`);
    return `<button class="screening-item ${record ? record.result : 'pending'}" onclick="ScreeningPage.openRecord('${item.id}')"><span class="sci-icon">${item.icon}</span><span class="sci-content"><strong class="sci-name">${item.name}</strong><small class="sci-desc">${item.desc}</small><small class="sci-suggest">${record ? `检查日期：${record.date}` : `建议时间：出生后${item.suggestDay}天`}</small></span><span class="sci-status">${status}</span></button>`;
  },
  openRecord(id) {
    const item = this._items.find(i => i.id === id); const record = this._records.find(r => r.screeningId === id) || {};
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="screeningModal"><div class="modal-content"><div class="modal-header"><h3>${item.name}</h3><button class="modal-close" onclick="document.getElementById('screeningModal').remove()">×</button></div><div class="modal-body"><label>检查日期<input id="screeningDate" class="form-input" type="date" value="${record.date || Utils.todayStr()}"></label><label>检查结果<select id="screeningResult" class="form-input"><option value="pass" ${record.result === 'pass' ? 'selected' : ''}>通过</option><option value="refer" ${record.result === 'refer' ? 'selected' : ''}>需复查</option><option value="abnormal" ${record.result === 'abnormal' ? 'selected' : ''}>异常</option></select></label><label>检查机构<input id="screeningHospital" class="form-input" value="${Utils.escapeHtml(record.hospital || '')}"></label><label>备注<textarea id="screeningNote" class="form-textarea">${Utils.escapeHtml(record.note || '')}</textarea></label></div><div class="modal-footer"><button class="btn btn-primary" onclick="ScreeningPage.saveRecord('${id}')">保存记录</button>${record._id ? `<button class="btn btn-outline" onclick="ScreeningPage.deleteRecord('${record._id}')">删除</button>` : ''}</div></div></div>`);
  },
  async saveRecord(screeningId) { await API.addScreening({ screeningId, date: document.getElementById('screeningDate').value, result: document.getElementById('screeningResult').value, hospital: document.getElementById('screeningHospital').value.trim(), note: document.getElementById('screeningNote').value.trim() }); document.getElementById('screeningModal')?.remove(); Utils.showToast('筛查记录已保存'); await this.render(this.container); },
  async deleteRecord(id) { if (!confirm('删除这条筛查记录？')) return; await API.deleteScreening(id); document.getElementById('screeningModal')?.remove(); await this.render(this.container); }
};

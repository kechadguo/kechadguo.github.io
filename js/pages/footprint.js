/**
 * 足迹页面 — 下楼溜溜 + 外出模块（云端共享版）
 * 下楼溜溜：记录开始下楼时间、完成回家时间，数据存 walk_records
 * 外出：手工记录目的/地址/起止时间/陪同人，数据存 outing_records
 * 家庭共享，所有用户可查看和更新
 */
window.FootprintPage = {
  _activeSession: null,
  _todayStats: { count: 0, totalMin: 0 },
  _activeModule: 'walk',
  _activeOutingType: 'local',
  _outingTodayStats: { count: 0, totalMin: 0, records: [] },
  _mapRecords: [],
  _mapInstance: null,
  _mapLayer: null,
  _mapRetryTimer: null,
  _mapRetryCount: 0,

  async render(container) {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby.birthDate) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">${Lucide.icon('map', 32)}</div><p>请先创建宝宝档案</p></div>`;
      return;
    }

    this.container = container;
    this.baby = baby;
    await this._loadData();
    await this._loadOutingData();
    await this._render();
  },

  /** 从云端加载数据：今日统计 + 进行中会话 */
  async _loadData() {
    try {
      const [summary, activeRes] = await Promise.all([
        API.walkTodaySummary().catch(() => null),
        API.getActiveWalk().catch(() => null)
      ]);
      this._todayStats = summary || { count: 0, totalMin: 0, records: [] };
      this._activeSession = activeRes?.active || null;
      // 活跃会话的 startTimestamp 用于计时器
      if (this._activeSession && this._activeSession.startTime) {
        this._activeSession.startTimestamp = new Date(this._activeSession.startTime).getTime();
      }
    } catch (e) {
      console.warn('[Footprint] 加载数据失败:', e.message);
    }
  },

  /** 从云端加载外出数据 */
  async _loadOutingData() {
    try {
      const summary = await API.outingTodaySummary({ outingType: this._activeOutingType }).catch(() => null);
      this._outingTodayStats = summary || { count: 0, totalMin: 0, records: [] };
    } catch (e) {
      console.warn('[Footprint] 外出数据加载失败:', e.message);
    }
  },

  /** 今日记录列表 */
  _getTodayRecords() {
    return this._todayStats.records || [];
  },

  async _render() {
    const c = this.container;
    const stats = this._todayStats;
    const active = this._activeSession;

    let html = '';

    // v117：家庭地址 + 实时天气卡片已移入「下楼溜溜」模块（外出模块不显示天气）

    const tabs = [
      ['walk', 'footprints', '下楼遛弯'], ['local', 'navigation', '市内出行'], ['travel', 'map', '旅行']
    ];
    html += `<nav class="v3-subtabs fp-module-tabs" role="tablist" aria-label="足迹分类">${tabs.map(([key, icon, label]) => `<button type="button" class="v3-subtab ${((key === 'walk' && this._activeModule === 'walk') || (key !== 'walk' && this._activeModule === 'outing' && this._activeOutingType === key)) ? 'is-active' : ''}" role="tab" aria-selected="${((key === 'walk' && this._activeModule === 'walk') || (key !== 'walk' && this._activeModule === 'outing' && this._activeOutingType === key))}" onclick="FootprintPage._switchTab('${key}')">${Lucide.icon(icon, 16)}<span>${label}</span></button>`).join('')}</nav>`;

    if (this._activeModule === 'walk') html += await this._renderWalkHTML();
    else html += await this._renderOutingHTML();

    c.innerHTML = html;

    // v117：异步加载地址与天气，仅下楼溜溜模块展示（不阻塞页面渲染）
    if (this._activeModule === 'walk') this._loadAddressAndWeather();

    // 有活跃会话时启动全局计时器
    if (this._activeModule === 'walk' && active) App._startGlobalTimer();

    if (this._activeModule === 'outing') {
      this._loadMapRecords();
      this._renderMapWhenReady();
    }
  },

  async _loadMapRecords() {
    try {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      const data = await API.listOuting({
        startDate: start.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        outingType: this._activeOutingType,
        pageSize: 200
      }).catch(() => null);
      this._mapRecords = data?.records || [];
      this._renderMapWhenReady();
    } catch (e) {
      console.warn('[Footprint] 地图记录加载失败:', e.message);
    }
  },

  _getMapRecords() {
    const records = this._mapRecords.length ? this._mapRecords : (this._outingTodayStats?.records || []);
    return records.filter(r => {
      const lat = Number(r.startLat ?? r.latitude);
      const lng = Number(r.startLng ?? r.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 3 && lat <= 54 && lng >= 73 && lng <= 136;
    });
  },

  _renderMapWhenReady() {
    const mapContainer = document.getElementById('footprint-map');
    const records = this._getMapRecords();
    if (!mapContainer || !records.length) return;
    if (!window.TMap) {
      mapContainer.innerHTML = '<div class="footprint-map-empty">地图加载失败，请刷新页面后重试</div>';
      return;
    }
    try {
      const first = records[0];
      const lat = Number(first.startLat ?? first.latitude);
      const lng = Number(first.startLng ?? first.longitude);
      const center = new TMap.LatLng(lat, lng);
      this._mapInstance = new TMap.Map(mapContainer, { center, zoom: 12 });
      const geometries = records.map((record, index) => ({
        id: String(record._id || `footprint-${index}`),
        position: new TMap.LatLng(Number(record.startLat ?? record.latitude), Number(record.startLng ?? record.longitude)),
        properties: { title: record.location || record.address || record.purpose || '外出记录' }
      }));
      const markerStyle = new TMap.MarkerStyle({ width: 24, height: 32, anchor: { x: 12, y: 32 } });
      const markerLayer = new TMap.MultiMarker({ map: this._mapInstance, styles: { default: markerStyle }, geometries });
      const path = geometries.map(g => g.position);
      const polylineLayer = path.length > 1 ? new TMap.MultiPolyline({
        map: this._mapInstance,
        styles: { route: new TMap.PolylineStyle({ color: '#E8927C', width: 4, borderWidth: 1, borderColor: '#FFFFFF' }) },
        geometries: [{ id: 'footprint-route', styleId: 'route', paths: path }]
      }) : null;
      this._mapLayer = { markerLayer, polylineLayer };
    } catch (error) {
      console.warn('[Footprint] 腾讯地图渲染失败:', error.message);
      mapContainer.innerHTML = '<div class="footprint-map-empty">地图暂时不可用，请稍后重试</div>';
    }
  },

  async _switchTab(tab) {
    if (tab === 'walk') {
      this._activeModule = 'walk';
    } else {
      this._activeModule = 'outing';
      this._activeOutingType = tab;
    }
    await this._render();
  },

  /** 兼容旧入口 */
  async _switchModule(mod) {
    await this._switchTab(mod === 'outing' ? this._activeOutingType : 'walk');
  },

  /** 渲染下楼溜溜模块 */
  async _renderWalkHTML() {
    const stats = this._todayStats;
    const active = this._activeSession;
    let html = '';

    // v117：家庭地址 + 实时天气仅属于下楼溜溜模块（异步填充，不阻塞主渲染）
    html += `<div class="card">
      <div class="card-title">${Lucide.icon('pin', 18)} 家庭地址</div>
      <div id="fp-address-row" class="fp-address-row"><span class="text-muted">加载中...</span></div>
      <div id="fp-weather-box"></div>
      <button class="btn btn-outline btn-block" style="margin-top:10px" onclick="FootprintPage.openAddressModal()">${Lucide.icon('pin', 18)} 管理地址</button>
    </div>`;

    // 今日统计
    html += `<div class="card">
      <div class="card-title">${Lucide.icon('footprints', 18)} 今日下楼溜溜</div>
      <div class="footprint-stats">
        <div class="footprint-stat-item">
          <div class="footprint-stat-num">${stats.count || 0}</div>
          <div class="footprint-stat-label">次数</div>
        </div>
        <div class="footprint-stat-item">
          <div class="footprint-stat-num">${stats.totalMin || 0}</div>
          <div class="footprint-stat-label">分钟</div>
        </div>
      </div>
    </div>`;

    // 溜溜计时器
    html += `<div class="card">
      <div class="card-title">${Lucide.icon('timer', 18)} 遛弯计时</div>
      ${active ? this._renderActiveTimer(active) : this._renderStartButton()}
    </div>`;

    // 今日明细
    const todayRecs = this._getTodayRecords();
    this._todayRecMap = Object.fromEntries(todayRecs.map(r => [r._id, r]));
    if (todayRecs.length > 0) {
      html += `<div class="card">
        <div class="card-title">${Lucide.icon('clipboard-list', 18)} 今日明细</div>
        <div class="walk-list">`;
      for (let i = 0; i < todayRecs.length; i++) {
        const r = todayRecs[i];
        let durationText = '';
        let startStr = '--', endStr = '--';
        if (r.startTime) {
          const s = new Date(r.startTime);
          startStr = String(s.getHours()).padStart(2, '0') + ':' + String(s.getMinutes()).padStart(2, '0');
        }
        if (r.endTime) {
          const e = new Date(r.endTime);
          endStr = String(e.getHours()).padStart(2, '0') + ':' + String(e.getMinutes()).padStart(2, '0');
        }
        if (r.startTime && r.endTime) {
          const s = new Date(r.startTime), e = new Date(r.endTime);
          const durMin = r.duration || Math.round((e - s) / 60000);
          durationText = durMin + '分钟';
        } else if (r.startTime && !r.endTime) {
          durationText = '进行中...';
        }
        html += `
          <div class="record-item">
            <div class="record-main">
              <div class="record-title">${Lucide.icon('footprints', 16)} 下楼溜溜</div>
              <div class="record-meta">
                ${Lucide.icon('clock', 14)} ${startStr} → ${r.endTime ? Lucide.icon('pin', 14) + ' ' + endStr : '进行中'}
                ${durationText ? ' · ' + durationText : ''}
                ${r.note ? ' · ' + Utils.escapeHtml(r.note) : ''}
              </div>
            </div>
            ${(!r.memberId || r.memberId === Auth.getMemberId()) ? `
            <div class="record-actions">
              <button class="icon-btn-sm" title="修改此记录" onclick="event.stopPropagation();FootprintPage._editWalk('${r._id}')">${Lucide.icon('file-text', 16)}</button>
              <button class="icon-btn-sm" title="删除此记录" onclick="FootprintPage._deleteWalk('${r._id}')">${Lucide.icon('alert-triangle', 16)}</button>
            </div>` : ''}
          </div>`;
      }
      html += '</div></div>';
    }

    // 历史记录（最近7天）
    html += await this._renderHistoryHTML();
    return html;
  },

  /** 渲染外出模块 */
  async _renderOutingHTML() {
    const stats = this._outingTodayStats;
    const isTravel = this._activeOutingType === 'travel';
    const typeLabel = isTravel ? '旅行' : '市内出行';
    let html = '';

    // 今日统计
    const hours = Math.floor((stats.totalMin || 0) / 60);
    const mins = (stats.totalMin || 0) % 60;
    let durationStr = '';
    if (hours > 0) durationStr = hours + '小时' + (mins > 0 ? mins + '分' : '');
    else if (mins > 0) durationStr = mins + '分钟';

    html += `<div class="card">
      <div class="card-title">${Lucide.icon(isTravel ? 'map' : 'navigation', 18)} 今日${typeLabel}</div>
      <div class="footprint-stats">
        <div class="footprint-stat-item">
          <div class="footprint-stat-num">${stats.count || 0}</div>
          <div class="footprint-stat-label">次数</div>
        </div>
        <div class="footprint-stat-item">
          <div class="footprint-stat-num">${durationStr || '0'}</div>
          <div class="footprint-stat-label">时长</div>
        </div>
      </div>
    </div>`;

    // 足迹地图：只展示已有坐标的外出记录，不主动采集定位
    const mapRecords = this._getMapRecords();
    html += `<div class="card footprint-map-card">
      <div class="card-title">${Lucide.icon('map', 18)} 足迹地图</div>
      <p class="text-muted footprint-map-help">仅展示已保存坐标的外出记录；未授权定位或没有坐标时仍可正常使用文字记录。</p>
      <div id="footprint-map" class="footprint-map" role="img" aria-label="外出足迹地图">
        ${mapRecords.length ? '<div class="footprint-map-loading">地图加载中...</div>' : '<div class="footprint-map-empty">暂无带坐标的足迹记录</div>'}
      </div>
    </div>`;

    // 新增外出按钮
    html += `<div class="card">
      <div class="card-title">${Lucide.icon('plus-circle', 18)} 记录${typeLabel}</div>
      <p class="text-muted" style="font-size:13px;margin-bottom:10px">${isTravel ? '填写目的地、交通、住宿、起止时间和同行人' : '填写外出目的、地址、起止时间和陪同人'}</p>
      <button class="btn btn-primary btn-block" onclick="FootprintPage.openOutingForm()">${Lucide.icon('plus', 18)} 新增${typeLabel}</button>
    </div>`;

    // 今日明细
    const todayRecs = stats.records || [];
    this._outingTodayRecMap = Object.fromEntries(todayRecs.map(r => [r._id, r]));
    if (todayRecs.length > 0) {
      html += `<div class="card">
        <div class="card-title">${Lucide.icon('clipboard-list', 18)} 今日明细</div>
        <div class="walk-list">`;
      for (const r of todayRecs) {
        html += this._renderOutingRecordItem(r);
      }
      html += '</div></div>';
    }

    // 历史记录
    html += await this._renderOutingHistoryHTML();
    return html;
  },

  /** 渲染单条外出记录 */
  _renderOutingRecordItem(r) {
    let startStr = '--', endStr = '--', durationText = '';
    if (r.startTime) {
      const s = new Date(r.startTime);
      startStr = String(s.getHours()).padStart(2, '0') + ':' + String(s.getMinutes()).padStart(2, '0');
    }
    if (r.endTime) {
      const e = new Date(r.endTime);
      endStr = String(e.getHours()).padStart(2, '0') + ':' + String(e.getMinutes()).padStart(2, '0');
    }
    if (r.startTime && r.endTime) {
      const s = new Date(r.startTime), e = new Date(r.endTime);
      const durMin = r.duration || Math.round((e - s) / 60000);
      const h = Math.floor(durMin / 60), m = durMin % 60;
      durationText = h > 0 ? h + '小时' + (m > 0 ? m + '分' : '') : m + '分钟';
    }
    const canEdit = !r.memberId || r.memberId === Auth.getMemberId();
    return `
      <div class="record-item outing-record-item">
        <div class="record-main">
          <div class="record-title">${Lucide.icon('navigation', 16)} ${Utils.escapeHtml(r.purpose || '外出')}</div>
          <div class="record-meta">
            ${Lucide.icon('clock', 14)} ${startStr} → ${endStr}
            ${durationText ? ' · ' + durationText : ''}
          </div>
          ${r.address ? `<div class="record-meta">${Lucide.icon('pin', 14)} ${Utils.escapeHtml(r.address)}</div>` : ''}
          ${r.companion ? `<div class="record-meta">${Lucide.icon('users', 14)} 陪同: ${Utils.escapeHtml(r.companion)}</div>` : ''}
          ${r.note ? `<div class="record-meta text-muted">${Utils.escapeHtml(r.note)}</div>` : ''}
        </div>
        ${canEdit ? `
        <div class="record-actions">
          <button class="icon-btn-sm" title="修改" onclick="event.stopPropagation();FootprintPage._editOuting('${r._id}')">${Lucide.icon('file-text', 16)}</button>
          <button class="icon-btn-sm" title="删除" onclick="FootprintPage._deleteOuting('${r._id}')">${Lucide.icon('alert-triangle', 16)}</button>
        </div>` : ''}
      </div>`;
  },

  /** 外出历史记录（最近7天） */
  async _renderOutingHistoryHTML() {
    let records = [];
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const data = await API.listOuting({
        startDate: sevenDaysAgo.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        outingType: this._activeOutingType,
        pageSize: 100
      }).catch(() => null);
      if (data && data.records) {
        const today = Utils.todayStr();
        records = data.records.filter(r => {
          const rDate = Utils.localDateFromISO(r.startTime || r.date);
          return rDate !== today;
        });
      }
    } catch (e) { console.warn('[Footprint] 外出历史加载失败:', e.message); }

    if (records.length === 0) return '';

    const byDate = {};
    for (const r of records) {
      const date = Utils.localDateFromISO(r.startTime || r.date) || 'unknown-date';
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(r);
    }

    const dates = Object.keys(byDate).sort().reverse();
    let html = `<div class="card"><div class="card-title">${Lucide.icon('calendar', 18)} 最近记录</div>`;

    for (const date of dates) {
      const dayRecs = byDate[date];
      let totalMin = 0;
      const purposes = dayRecs.map(r => r.purpose || '外出').join('、');
      for (const r of dayRecs) {
        if (r.duration) totalMin += r.duration;
        else if (r.startTime && r.endTime) {
          const s = new Date(r.startTime);
          const e = new Date(r.endTime);
          if (e > s) totalMin += Math.round((e - s) / 60000);
        }
      }
      const h = Math.floor(totalMin / 60), m = totalMin % 60;
      const durStr = h > 0 ? h + '小时' + (m > 0 ? m + '分' : '') : m + '分钟';

      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
      const d = validDate ? new Date(date + 'T00:00:00') : null;
      const weekday = d && Number.isFinite(d.getTime()) ? ['日', '一', '二', '三', '四', '五', '六'][d.getDay()] : '';
      const dateLabel = validDate && weekday ? `${date} 周${weekday}` : '日期未记录';
      html += `
        <div class="record-item">
          <div class="record-main">
            <div class="record-title">${dateLabel}</div>
            <div class="record-meta">${Lucide.icon('navigation', 14)} ${dayRecs.length}次 · ${Lucide.icon('timer', 14)} ${durStr} · ${Utils.escapeHtml(purposes)}</div>
          </div>
        </div>`;
    }
    html += '</div>';
    return html;
  },

  /** 打开外出表单（新增/编辑） */
  openOutingForm(record) {
    this._outingEditId = record ? record._id : null;
    const now = new Date();
    const startStr = record
      ? Utils.formatDate(record.startTime, 'HH:mm')
      : Utils.formatDate(new Date(now.getTime() - 3600000), 'HH:mm');
    const endStr = record && record.endTime ? Utils.formatDate(record.endTime, 'HH:mm') : Utils.formatDate(now, 'HH:mm');
    // v117：外出支持录入历史日期（默认今天，编辑时回显 startTime 的本地时区日期）
    const dateStr = record
      ? Utils.formatDate(new Date(record.startTime), 'YYYY-MM-DD')
      : Utils.todayStr();
    const purpose = record && record.purpose ? record.purpose : '';
    const address = record && record.address ? record.address : '';
    const companion = record && record.companion ? record.companion : '';
    const note = record && record.note ? record.note : '';
    const outingType = record?.outingType === 'travel' ? 'travel' : this._activeOutingType;

    App._showModal(record ? '编辑外出记录' : outingType === 'travel' ? '新增旅行记录' : '新增市内出行', `
      <div class="form-group">
        <label>类型</label>
        <select id="outing-type" class="form-input">
          <option value="local" ${outingType === 'local' ? 'selected' : ''}>市内出行</option>
          <option value="travel" ${outingType === 'travel' ? 'selected' : ''}>旅行</option>
        </select>
      </div>
      ${outingType === 'travel' ? `<div class="form-group"><label>目的地</label><input type="text" id="outing-destination" class="form-input" placeholder="如：杭州" value="${Utils.escapeHtml(record?.destination || '')}"></div><div class="form-group"><label>交通方式</label><input type="text" id="outing-transportation" class="form-input" placeholder="如：高铁、自驾" value="${Utils.escapeHtml(record?.transportation || '')}"></div><div class="form-group"><label>住宿</label><input type="text" id="outing-accommodation" class="form-input" placeholder="可选" value="${Utils.escapeHtml(record?.accommodation || '')}"></div>` : ''}
      <div class="form-group">
        <label>外出目的 *</label>
        <input type="text" id="outing-purpose" class="form-input" placeholder="如：打疫苗、逛公园" value="${Utils.escapeHtml(purpose)}">
      </div>
      <div class="form-group">
        <label>地址</label>
        <input type="text" id="outing-address" class="form-input" placeholder="如：社区卫生服务中心" value="${Utils.escapeHtml(address)}">
      </div>
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="outing-date" class="form-input" value="${dateStr}" max="${Utils.todayStr()}" onchange="FootprintPage._updateOutingPreview()">
      </div>
      <div class="time-pair">
        <div class="form-group" style="flex:1;margin-bottom:10px">
          <label>开始时间</label>
          <input type="time" id="outing-start" class="form-input" value="${startStr}" onchange="FootprintPage._updateOutingPreview()">
        </div>
        <div class="form-group" style="flex:1;margin-bottom:10px">
          <label>结束时间</label>
          <input type="time" id="outing-end" class="form-input" value="${endStr}" onchange="FootprintPage._updateOutingPreview()">
        </div>
      </div>
      <div class="text-muted" style="font-size:12px;text-align:center;margin-bottom:12px" id="outing-form-preview"></div>
      <div class="form-group">
        <label>陪同人</label>
        <input type="text" id="outing-companion" class="form-input" placeholder="如：妈妈、爸爸" value="${Utils.escapeHtml(companion)}">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="outing-note" class="form-input" placeholder="可选" value="${Utils.escapeHtml(note)}">
      </div>
      <p class="text-muted" style="font-size:12px;text-align:center;margin-bottom:12px">数据云端存储，家庭成员共享</p>
      <button class="btn btn-primary btn-block" onclick="FootprintPage._submitOutingForm()">${record ? '保存修改' : '保存'}</button>
    `);
    this._updateOutingPreview();
  },

  _getOptionalPosition() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        position => resolve({ startLat: Number(position.coords.latitude), startLng: Number(position.coords.longitude) }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
    });
  },

  _updateOutingPreview() {
    const s = document.getElementById('outing-start')?.value;
    const e = document.getElementById('outing-end')?.value;
    const el = document.getElementById('outing-form-preview');
    if (!el || !s || !e) return;
    let [sh, sm] = s.split(':').map(Number);
    let [eh, em] = e.split(':').map(Number);
    let dur = (eh * 60 + em) - (sh * 60 + sm);
    if (dur < 0) dur += 24 * 60;
    el.textContent = `共 ${Math.floor(dur / 60)} 小时 ${dur % 60} 分`;
  },

  async _submitOutingForm() {
    const purpose = document.getElementById('outing-purpose')?.value?.trim();
    const address = document.getElementById('outing-address')?.value?.trim() || '';
    const dateStr = document.getElementById('outing-date')?.value || Utils.todayStr();
    const s = document.getElementById('outing-start')?.value;
    const e = document.getElementById('outing-end')?.value;
    const companion = document.getElementById('outing-companion')?.value?.trim() || '';
    const note = document.getElementById('outing-note')?.value?.trim() || '';
    const outingType = document.getElementById('outing-type')?.value === 'travel' ? 'travel' : 'local';
    const destination = document.getElementById('outing-destination')?.value?.trim() || '';
    const transportation = document.getElementById('outing-transportation')?.value?.trim() || '';
    const accommodation = document.getElementById('outing-accommodation')?.value?.trim() || '';

    if (!purpose) { Utils.showToast('请填写外出目的'); return; }
    if (!s || !e) { Utils.showToast('请选择开始和结束时间'); return; }
    if (!dateStr) { Utils.showToast('请选择日期'); return; }
    const pair = Utils.pairTimesToISO(s, e, dateStr);
    const position = await this._getOptionalPosition();

    Utils.showLoading('保存中...');
    try {
      if (this._outingEditId) {
        await API.updateOuting(this._outingEditId, {
          startTime: pair.start, endTime: pair.end,
          purpose, address, companion, note, outingType, destination, transportation, accommodation,
          ...(position || {})
        });
      } else {
        await API.createOuting({
          startTime: pair.start, endTime: pair.end, duration: pair.durationMin,
          purpose, address, companion, note, outingType, destination, transportation, accommodation,
          ...(position || {})
        });
      }
      Utils.hideLoading();
      App._closeModal();
      this._outingEditId = null;
      Utils.showToast('已保存');
      await this._loadOutingData();
      await this._render();
    } catch (err) {
      Utils.hideLoading();
      Utils.showToast('保存失败: ' + err.message);
    }
  },

  /** 编辑外出记录 */
  _editOuting(id) {
    if (!Utils.offlineGuard('当前离线，请联网同步后再修改')) return;
    const rec = this._outingTodayRecMap?.[id];
    if (rec) this.openOutingForm(rec);
  },

  /** 删除外出记录 */
  async _deleteOuting(id) {
    if (!id) return;
    if (!Utils.offlineGuard('当前离线，请联网同步后再删除')) return;
    if (!confirm('确定删除这条外出记录吗？删除后无法恢复。')) return;
    try {
      await API.deleteOuting(id);
      Utils.showToast('已删除');
      await this._loadOutingData();
      await this._render();
    } catch (e) {
      Utils.showToast('删除失败: ' + (e.message || '请稍后重试'));
    }
  },

  // ===== v74 家庭地址 + 天气 =====

  /** 加载家庭地址 + 天气（缓存地址未变且已有天气时复用） */
  async _loadAddressAndWeather() {
    const row = document.getElementById('fp-address-row');
    let address = null;
    try {
      const res = await API.getFamilyAddress();
      address = (res && res.address) || null;
    } catch (e) { /* 忽略读取失败 */ }
    this._address = address;
    if (!address) {
      if (row) row.innerHTML = '<span class="text-muted">尚未配置地址，点击下方「管理地址」设置后即可查看天气</span>';
      return;
    }
    if (row) row.innerHTML = `<span class="fp-address-text">${Lucide.icon('pin', 16)} ${Utils.escapeHtml(address.province)} ${Utils.escapeHtml(address.city)} ${Utils.escapeHtml(address.district || '')}</span>`;
    // 地址未变且已有天气数据 → 复用，不重复请求
    if (this._weather && this._weather.address &&
        this._weather.address.province === address.province &&
        this._weather.address.city === address.city &&
        (this._weather.address.district || '') === (address.district || '')) {
      const box = document.getElementById('fp-weather-box');
      if (box) box.innerHTML = this._weatherCardHTML(this._weather);
      return;
    }
    await this._renderWeather(address);
  },

  /** 拉取并渲染天气（失败 fail-open 展示友好提示） */
  async _renderWeather(address) {
    const box = document.getElementById('fp-weather-box');
    if (!box) return;
    box.innerHTML = '<p class="text-muted" style="text-align:center;padding:8px 0">天气加载中...</p>';
    try {
      const w = await API.getWeather(address);
      if (!w || !w.current) {
        box.innerHTML = '<p class="text-muted" style="text-align:center;padding:8px 0">天气暂不可用，请稍后刷新重试</p>';
        return;
      }
      this._weather = w;
      box.innerHTML = this._weatherCardHTML(w);
    } catch (e) {
      box.innerHTML = `<p class="text-muted" style="text-align:center;padding:8px 0">${Utils.escapeHtml(e.message || '天气加载失败')}</p>`;
    }
  },

  /** 天气卡片 HTML */
  _weatherCardHTML(w) {
    const cur = w.current;
    const hours = (w.hourly || []).map(h => `
      <div class="fp-hour-item">
        <div class="fp-hour-time">${h.time}</div>
        <div class="fp-hour-icon">${Lucide.icon('cloud-sun', 18)}</div>
        <div class="fp-hour-temp">${h.temp}°</div>
        <div class="fp-hour-text">${Utils.escapeHtml(h.text)}</div>
        ${h.precipProb != null ? `<div class="fp-hour-rain">${Lucide.icon('droplet', 14)} ${h.precipProb}%</div>` : ''}
      </div>`).join('');
    const tips = (w.advice || []).map(t => `<li>${Utils.escapeHtml(t)}</li>`).join('');
    return `
      <div class="fp-weather">
        <div class="fp-weather-now">
          <div class="fp-weather-icon">${Lucide.icon('cloud-sun', 28)}</div>
          <div class="fp-weather-main">
            <div class="fp-weather-temp">${cur.temp}°C</div>
            <div class="fp-weather-text">${Utils.escapeHtml(cur.text)}</div>
          </div>
          <div class="fp-weather-detail">
            <div>体感 ${cur.feelsLike}°C</div>
            <div>湿度 ${cur.humidity}%</div>
            <div>风力 ${cur.windSpeed} km/h</div>
          </div>
        </div>
        ${hours ? `<div class="fp-hour-row"><div class="fp-hour-label">${Lucide.icon('clock', 16)} 未来 2 小时</div>${hours}</div>` : ''}
        <div class="fp-advice">
          <div class="fp-advice-title">${Lucide.icon('shirt', 16)} 宝宝穿衣建议</div>
          <ul>${tips}</ul>
        </div>
      </div>`;
  },

  /** 打开地址管理弹窗（省/市/区县三级联动） */
  openAddressModal() {
    const cur = this._address || {};
    App._showModal('管理家庭地址', `
      <div class="form-group">
        <label>省份</label>
        <select class="form-input" id="addr-province" onchange="FootprintPage._onProvinceChange()"></select>
      </div>
      <div class="form-group">
        <label>城市</label>
        <select class="form-input" id="addr-city" onchange="FootprintPage._onCityChange()"></select>
      </div>
      <div class="form-group">
        <label>区/县</label>
        <select class="form-input" id="addr-district"></select>
      </div>
      <p class="text-muted" style="font-size:12px;margin-bottom:10px">配置后首页足迹页将显示当地实时天气与未来 1-2 小时天气变化，并给出宝宝穿衣建议</p>
      <button class="btn btn-primary btn-block" onclick="FootprintPage._saveAddress()">保存地址</button>
    `);
    const sel = document.getElementById('addr-province');
    sel.innerHTML = '<option value="">请选择省份</option>' + (window.REGION_DATA || []).map(p => `<option value="${Utils.escapeHtml(p.name)}">${Utils.escapeHtml(p.name)}</option>`).join('');
    if (cur.province) { sel.value = cur.province; this._onProvinceChange(); }
  },

  _onProvinceChange() {
    const provName = document.getElementById('addr-province').value;
    const prov = (window.REGION_DATA || []).find(p => p.name === provName);
    const citySel = document.getElementById('addr-city');
    citySel.innerHTML = '<option value="">请选择城市</option>' + (prov ? prov.cities.map(c => `<option value="${Utils.escapeHtml(c.name)}">${Utils.escapeHtml(c.name)}</option>`).join('') : '');
    const curCity = this._address && this._address.city || '';
    if (curCity && prov && prov.cities.some(c => c.name === curCity)) citySel.value = curCity;
    this._onCityChange();
  },

  _onCityChange() {
    const provName = document.getElementById('addr-province').value;
    const cityName = document.getElementById('addr-city').value;
    const prov = (window.REGION_DATA || []).find(p => p.name === provName);
    const city = prov && prov.cities.find(c => c.name === cityName);
    const distSel = document.getElementById('addr-district');
    distSel.innerHTML = '<option value="">请选择区/县</option>' + (city ? city.districts.map(d => `<option value="${Utils.escapeHtml(d)}">${Utils.escapeHtml(d)}</option>`).join('') : '');
    const curDist = this._address && this._address.district || '';
    if (curDist && city && city.districts.indexOf(curDist) >= 0) distSel.value = curDist;
  },

  async _saveAddress() {
    const province = document.getElementById('addr-province').value;
    const city = document.getElementById('addr-city').value;
    const district = document.getElementById('addr-district').value;
    if (!province || !city) { Utils.showToast('请选择省份和城市'); return; }
    Utils.showLoading('保存中...');
    try {
      await API.saveFamilyAddress({ province, city, district });
      Utils.hideLoading();
      App._closeModal();
      Utils.showToast('地址已保存');
      this._address = { province, city, district };
      this._weather = null; // 强制刷新天气
      const row = document.getElementById('fp-address-row');
      if (row) row.innerHTML = `<span class="fp-address-text">${Lucide.icon('pin', 16)} ${Utils.escapeHtml(province)} ${Utils.escapeHtml(city)} ${Utils.escapeHtml(district || '')}</span>`;
      await this._renderWeather({ province, city, district });
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('保存失败: ' + e.message);
    }
  },

  _renderActiveTimer(active) {
    const start = active.startTimestamp || (active.startTime ? new Date(active.startTime).getTime() : Date.now());
    const elapsed = Date.now() - start;
    return `
      <div class="walk-timer-active">
        <div class="walk-timer-display">
          <span class="walk-timer-icon">${Lucide.icon('footprints', 20)}</span>
          <span class="walk-timer-time" id="walk-elapsed">${Utils.formatElapsed(elapsed)}</span>
        </div>
        <p class="text-muted" style="font-size:12px;margin:4px 0">开始：${active.startTime ? new Date(active.startTime).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'}) : '--'}</p>
        <button class="btn btn-primary btn-block" onclick="FootprintPage._endWalk()">
          ${Lucide.icon('pin', 18)} 回家啦
        </button>
      </div>
    `;
  },

  _renderStartButton() {
    return `
      <div class="walk-timer-start">
        <p class="text-muted" style="margin-bottom:12px">点击按钮开始记录遛弯，或手工补记起止时间</p>
        <button class="btn btn-primary btn-block" onclick="FootprintPage._startWalk()">
          ${Lucide.icon('footprints', 18)} 下楼溜溜
        </button>
        <button class="btn btn-outline btn-block" style="margin-top:10px" onclick="FootprintPage.openManualForm()">
          ${Lucide.icon('file-text', 18)} 手工记录（起止时间）
        </button>
        <div class="form-group" style="margin-top:10px">
          <input type="text" class="form-input" id="walk-note" placeholder="备注（可选）">
        </div>
      </div>
    `;
  },

  async _renderHistoryHTML() {
    let records = [];
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const data = await API.listWalk({
        startDate: sevenDaysAgo.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        pageSize: 100
      }).catch(() => null);
      if (data && data.records) {
        const today = Utils.todayStr();
        records = data.records.filter(r => {
          const rDate = Utils.localDateFromISO(r.startTime || r.date);
          return rDate !== today;
        });
      }
    } catch (e) { console.warn('[Footprint] 历史加载失败:', e.message); }

    if (records.length === 0) return '';

    // 按日期分组
    const byDate = {};
    for (const r of records) {
      const date = Utils.localDateFromISO(r.startTime || r.date) || 'unknown-date';
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(r);
    }

    const dates = Object.keys(byDate).sort().reverse();
    let html = `<div class="card"><div class="card-title">${Lucide.icon('calendar', 18)} 最近记录</div>`;

    for (const date of dates) {
      const dayRecs = byDate[date];
      let totalMin = 0;
      for (const r of dayRecs) {
        if (r.duration) totalMin += r.duration;
        else if (r.startTime && r.endTime) {
          const s = new Date(r.startTime);
          const e = new Date(r.endTime);
          if (e > s) totalMin += Math.round((e - s) / 60000);
        }
      }

      const d = new Date(date + 'T00:00:00');
      const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
      html += `
        <div class="record-item">
          <div class="record-main">
            <div class="record-title">${date} 周${weekday}</div>
            <div class="record-meta">${Lucide.icon('footprints', 14)} ${dayRecs.length}次 · ${Lucide.icon('timer', 14)} ${totalMin}分钟</div>
          </div>
        </div>`;
    }
    html += '</div>';
    return html;
  },

  /** 开始溜溜 — 创建云端记录 */
  async _startWalk() {
    const now = new Date();
    const note = document.getElementById('walk-note')?.value || '';

    Utils.showLoading('记录中...');
    try {
      const res = await API.createWalk({
        startTime: now.toISOString(),
        endTime: null,
        note
      });
      // 设置活跃会话
      this._activeSession = {
        _id: res._id,
        startTime: now.toISOString(),
        startTimestamp: now.getTime(),
        endTime: null,
        note
      };
      Utils.hideLoading();
      Utils.showToast('开始遛弯，注意安全~');
      await this._render();
      App._startGlobalTimer();
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('记录失败: ' + e.message);
    }
  },

  /** 结束溜溜 — 更新云端记录 */
  async _endWalk() {
    if (!this._activeSession) {
      Utils.showToast('没有进行中的遛弯');
      return;
    }
    const now = new Date();
    const start = new Date(this._activeSession.startTime);
    const min = Math.round((now - start) / 60000);

    Utils.showLoading('保存中...');
    try {
      await API.updateWalk(this._activeSession._id, {
        endTime: now.toISOString(),
        duration: min
      });
      this._activeSession = null;
      // 重新加载数据
      await this._loadData();
      Utils.hideLoading();
      Utils.showToast(`回家啦！遛了${min}分钟`);
      await this._render();
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('保存失败: ' + e.message);
    }
  },

  /** 删除一条溜溜记录（云端删除，多端自动拉齐） */
  async _deleteWalk(recordId) {
    if (!recordId) return;
    // R8：离线或有待同步记录时禁止删除（提示先同步）
    if (!Utils.offlineGuard('当前离线，请联网同步后再删除')) return;
    if (!confirm('确定删除这条溜溜记录吗？删除后无法恢复。')) return;
    try {
      await API.deleteWalk(recordId);
      Utils.showToast('已删除');
      await this._loadData();
      await this._render();
    } catch (e) {
      Utils.showToast('删除失败: ' + (e.message || '请稍后重试'));
    }
  },

  /** 编辑一条溜溜记录（弹出起止时间表单） */
  _editWalk(id) {
    // R8：离线或有待同步记录时禁止编辑（提示先同步）
    if (!Utils.offlineGuard('当前离线，请联网同步后再修改')) return;
    const rec = this._todayRecMap?.[id];
    if (rec) this.openManualForm(rec);
  },

  /** 手工记录溜溜（起止时间）— 支持新增与编辑 */
  openManualForm(record) {
    this._walkEditId = record ? record._id : null;
    const now = new Date();
    const startStr = record
      ? Utils.formatDate(record.startTime, 'HH:mm')
      : Utils.formatDate(new Date(now.getTime() - 3600000), 'HH:mm');
    const endStr = record && record.endTime ? Utils.formatDate(record.endTime, 'HH:mm') : Utils.formatDate(now, 'HH:mm');
    const note = record && record.note ? record.note : '';
    App._showModal(record ? '编辑溜溜记录' : '手工记录下楼溜溜', `
      <div class="time-pair">
        <div class="form-group" style="flex:1;margin-bottom:10px">
          <label>开始时间</label>
          <input type="time" id="walk-start" class="form-input" value="${startStr}" onchange="FootprintPage._updateManualPreview()">
        </div>
        <div class="form-group" style="flex:1;margin-bottom:10px">
          <label>结束时间</label>
          <input type="time" id="walk-end" class="form-input" value="${endStr}" onchange="FootprintPage._updateManualPreview()">
        </div>
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="walk-manual-note" class="form-input" placeholder="可选" value="${Utils.escapeHtml(note)}">
      </div>
      <div class="text-muted" style="font-size:12px;text-align:center;margin-bottom:12px" id="walk-form-preview"></div>
      <button class="btn btn-primary btn-block" onclick="FootprintPage._submitManualForm()">${record ? '保存修改' : '保存'}</button>
    `);
    this._updateManualPreview();
  },

  _updateManualPreview() {
    const s = document.getElementById('walk-start')?.value;
    const e = document.getElementById('walk-end')?.value;
    const el = document.getElementById('walk-form-preview');
    if (!el || !s || !e) return;
    let [sh, sm] = s.split(':').map(Number);
    let [eh, em] = e.split(':').map(Number);
    let dur = (eh * 60 + em) - (sh * 60 + sm);
    if (dur < 0) dur += 24 * 60; // 跨天
    el.textContent = `共 ${Math.floor(dur / 60)} 小时 ${dur % 60} 分`;
  },

  async _submitManualForm() {
    const s = document.getElementById('walk-start')?.value;
    const e = document.getElementById('walk-end')?.value;
    const note = document.getElementById('walk-manual-note')?.value || '';
    if (!s || !e) { Utils.showToast('请选择开始和结束时间'); return; }
    const pair = Utils.pairTimesToISO(s, e);

    Utils.showLoading('保存中...');
    try {
      if (this._walkEditId) {
        await API.updateWalk(this._walkEditId, { startTime: pair.start, endTime: pair.end, note });
      } else {
        await API.createWalk({ startTime: pair.start, endTime: pair.end, duration: pair.durationMin, note });
      }
      Utils.hideLoading();
      App._closeModal();
      this._walkEditId = null;
      Utils.showToast('已保存');
      await this._loadData();
      await this._render();
    } catch (err) { Utils.hideLoading(); Utils.showToast('保存失败: ' + err.message); }
  },

  /** === 首页足迹统计接口 === */
  getTodayFootprintStats() {
    return this._todayStats || { count: 0, totalMin: 0 };
  },

  /** 首页调用：异步刷新今日统计 */
  async refreshTodayStats() {
    try {
      const [summary, activeRes, outingSummary] = await Promise.all([
        API.walkTodaySummary().catch(() => null),
        API.getActiveWalk().catch(() => null),
        API.outingTodaySummary().catch(() => null)
      ]);
      this._todayStats = summary || { count: 0, totalMin: 0 };
      this._activeSession = activeRes?.active || null;
      if (this._activeSession && this._activeSession.startTime) {
        this._activeSession.startTimestamp = new Date(this._activeSession.startTime).getTime();
      }
      this._outingTodayStats = outingSummary || { count: 0, totalMin: 0, records: [] };
    } catch (e) {
      console.warn('[Footprint] 刷新统计失败:', e.message);
    }
  }
};

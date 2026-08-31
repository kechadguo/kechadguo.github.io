/**
 * 喂养时间分布图表
 * Canvas 绘制静态网格/时间轴，DOM 气泡承载交互、Tooltip 与无障碍。
 */
(function (global) {
  'use strict';

  const DAY_MS = 86400000;
  const CHART_HEIGHT = 540;
  const PAD_LEFT = 40;
  const COLORS = { grid: '#F5F5F5', axis: '#CCCCCC', text: '#666666', dark: '#333333', bubble: '#D4E8D4', bubbleHover: '#C8E6C9', green: '#2E7D32' };

  function pad(n) { return String(n).padStart(2, '0'); }
  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    const raw = String(value).trim().replace(' ', 'T');
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  function dateKey(value) {
    const d = parseDate(value);
    return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
  }
  function dateLabel(value) {
    const d = parseDate(value);
    return d ? `${d.getMonth() + 1}/${d.getDate()}` : '';
  }
  function startOfDay(value) {
    const d = parseDate(value) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function addDays(value, amount) {
    const d = startOfDay(value);
    d.setDate(d.getDate() + amount);
    return d;
  }
  function toDateInput(value) {
    const d = startOfDay(value);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function minutesText(total) {
    total = Math.max(0, Math.round(Number(total) || 0));
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }
  function durationBubble(total) {
    total = Math.max(0, Math.round(Number(total) || 0));
    if (!total) return '●';
    return total >= 60 ? `${Math.floor(total / 60)}h${pad(total % 60)}m` : `${total}m`;
  }
  function bubbleText(record, duration) {
    if (duration) return duration >= 60 ? `${Math.floor(duration / 60)}h` : `${duration}m`;
    const amount = Number(record.volume || record.amount || 0);
    return amount ? String(Math.round(amount)) : '•';
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  class FeedingTimeChart {
    constructor(container, options) {
      this.container = container;
      this.options = options || {};
      this.weekStart = toDateInput(this.options.weekStart || new Date(Date.now() - 6 * DAY_MS));
      this.feedings = Array.isArray(this.options.feedings) ? this.options.feedings : [];
      this.bubbles = [];
      this.dataPoints = [];
      this._listeners = {};
      this._tooltipTimer = null;
      this._longPressTimer = null;
      this.isInitialized = false;
      this.init();
    }

    init() {
      if (this.isInitialized) return;
      if (!this.container) return;
      this._buildShell();
      this._setupEventListeners();
      this.isInitialized = true;
      this.render();
    }

    _buildShell() {
      const weekNavigation = this.options.showWeekNavigation === false ? '' : `
        <div class="feeding-chart-weekbar">
          <button class="feeding-week-arrow" data-action="prev" aria-label="上一周">‹</button>
          <button class="feeding-week-label" data-action="picker" aria-haspopup="listbox"></button>
          <button class="feeding-week-arrow" data-action="next" aria-label="下一周">›</button>
          <button class="feeding-week-calendar" data-action="calendar" aria-label="选择周次">▣</button>
          <div class="feeding-week-menu" hidden role="listbox">
            <button data-quick="current">本周</button>
            <button data-quick="previous">上周</button>
            <button data-quick="previous2">上上周</button>
            <label>选择该周第一天<input type="date" data-week-date></label>
          </div>
        </div>`;
      this.container.classList.add('feeding-time-chart');
      this.container.setAttribute('role', 'region');
      this.container.setAttribute('aria-label', '喂养时间分布');
      this.container.innerHTML = `
        ${weekNavigation}
        <div class="feeding-chart-stat-row" aria-label="近7天喂养统计">
          <div class="feeding-chart-stat"><div class="feeding-stat-accent"></div><span class="feeding-stat-title">平均间隔</span><strong data-stat="interval">-</strong></div>
          <div class="feeding-chart-stat"><div class="feeding-stat-accent"></div><span class="feeding-stat-title">夜间喂养</span><strong data-stat="night">0次</strong><small>20:00-06:00</small></div>
        </div>
        <div class="feeding-chart-stage" role="group" aria-label="近7天喂养时间气泡图">
          <canvas class="feeding-chart-canvas" aria-hidden="true"></canvas>
          <div class="feeding-chart-bubbles" aria-label="喂养记录气泡"></div>
          <div class="feeding-chart-tooltip" role="status" aria-live="polite" hidden></div>
          <div class="feeding-chart-empty" hidden>近7天还没有喂养记录</div>
        </div>
        <table class="feeding-chart-sr-table" aria-label="喂养记录数据表"><thead><tr><th>时间</th><th>类型</th><th>时长</th><th>奶量</th></tr></thead><tbody></tbody></table>
        <div class="feeding-chart-live sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="feeding-chart-note">气泡位置代表喂养开始时间，气泡内显示时长或奶量；点击可查看完整详情</div>`;
      this.stage = this.container.querySelector('.feeding-chart-stage');
      this.canvas = this.container.querySelector('.feeding-chart-canvas');
      this.ctx = this.canvas && this.canvas.getContext ? this.canvas.getContext('2d') : null;
      this.bubbleLayer = this.container.querySelector('.feeding-chart-bubbles');
      this.tooltip = this.container.querySelector('.feeding-chart-tooltip');
      this.weekMenu = this.container.querySelector('.feeding-week-menu');
    }

    _setupEventListeners() {
      this._onResize = () => {
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this.render(), 300);
      };
      window.addEventListener('resize', this._onResize);
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this._onResize());
        this.resizeObserver.observe(this.container);
      }
      this.container.addEventListener('click', e => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'prev') return this.changeWeek(-7);
        if (action === 'next') return this.changeWeek(7);
        if (action === 'picker' || action === 'calendar') return this.toggleWeekMenu();
        const quick = e.target.closest('[data-quick]')?.dataset.quick;
        if (quick) {
          const delta = quick === 'previous' ? -7 : quick === 'previous2' ? -14 : 0;
          this.weekStart = toDateInput(addDays(new Date(), delta));
          this.weekMenu.hidden = true;
          return this._loadWeek();
        }
      });
      this.container.addEventListener('change', e => {
        if (e.target.matches('[data-week-date]') && e.target.value) {
          this.weekStart = toDateInput(e.target.value);
          this.weekMenu.hidden = true;
          this._loadWeek();
        }
      });
      this.stage.addEventListener('click', e => {
        const bubble = e.target.closest('.chart-bubble');
        if (bubble) this.showTooltip(Number(bubble.dataset.index), bubble);
        else { this._tooltipPinned = false; this.hideTooltip(); }
      });
      this.stage.addEventListener('mouseover', e => {
        const bubble = e.target.closest('.chart-bubble');
        if (bubble) this.showTooltip(Number(bubble.dataset.index), bubble, true);
      });
      this.stage.addEventListener('mouseout', e => {
        if (e.target.closest('.chart-bubble') && !this._tooltipPinned) this.hideTooltip();
      });
      this.stage.addEventListener('touchstart', e => {
        const bubble = e.target.closest('.chart-bubble');
        if (!bubble) return this.hideTooltip();
        this._longPressTimer = setTimeout(() => {
          if (navigator.vibrate) navigator.vibrate(30);
          this._showQuickMenu(Number(bubble.dataset.index), bubble);
        }, 550);
      }, { passive: true });
      this.stage.addEventListener('touchend', e => {
        clearTimeout(this._longPressTimer);
        const bubble = e.target.closest('.chart-bubble');
        if (bubble) this.showTooltip(Number(bubble.dataset.index), bubble);
      }, { passive: true });
      this.container.addEventListener('keydown', e => {
        if (e.key === 'Escape') this.hideTooltip();
        if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.chart-bubble')) {
          e.preventDefault();
          this.showTooltip(Number(e.target.closest('.chart-bubble').dataset.index), e.target.closest('.chart-bubble'));
        }
      });
    }

    on(eventName, handler) {
      (this._listeners[eventName] ||= []).push(handler);
      return this;
    }
    _emit(eventName, payload) { (this._listeners[eventName] || []).forEach(fn => fn(payload)); }

    async changeWeek(delta) {
      this.weekStart = toDateInput(addDays(this.weekStart, delta));
      await this._loadWeek();
    }
    async _loadWeek() {
      if (typeof this.options.loadWeek === 'function') {
        try {
          const end = toDateInput(addDays(this.weekStart, 6));
          const result = await this.options.loadWeek(this.weekStart, end);
          this.feedings = result?.records || result || [];
        } catch (e) {
          this.feedings = [];
        }
      }
      this._emit('weekChange', this.weekStart);
      this.render();
    }
    toggleWeekMenu() {
      if (!this.weekMenu) return;
      this.weekMenu.hidden = !this.weekMenu.hidden;
      const date = this.weekMenu.querySelector('[data-week-date]');
      if (date) date.value = this.weekStart;
    }

    _weekDates() { return Array.from({ length: 7 }, (_, i) => addDays(this.weekStart, i)); }
    _validFeedings() {
      const first = startOfDay(this.weekStart).getTime();
      const last = addDays(this.weekStart, 7).getTime();
      return this.feedings.map((record, sourceIndex) => ({ record, sourceIndex, date: parseDate(record.feedTime || record.time || record.startTime) }))
        .filter(x => x.date && x.date.getTime() >= first && x.date.getTime() < last)
        .sort((a, b) => a.date - b.date);
    }
    _dailyStats(items, key) {
      const day = items.filter(x => dateKey(x.date) === key);
      const total = day.reduce((sum, x) => sum + Number(x.record.duration || x.record.totalDuration || x.record.leftDuration || 0), 0);
      return { count: day.length, duration: minutesText(total) };
    }
    _averageInterval(items) {
      if (items.length < 2) return '-';
      const gaps = [];
      for (let i = 1; i < items.length; i++) gaps.push((items[i].date - items[i - 1].date) / 60000);
      const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
      if (avg >= 1440) return `${Math.floor(avg / 1440)}天${Math.floor((avg % 1440) / 60)}小时`;
      return `${Math.floor(avg / 60)}h ${avg % 60}m`;
    }
    _nightCount(items) { return items.filter(x => x.date.getHours() >= 20 || x.date.getHours() < 6).length; }

    render() {
      if (!this.isInitialized || !this.ctx) {
        if (this.stage) this.stage.querySelector('.feeding-chart-empty').hidden = false;
        return;
      }
      const items = this._validFeedings();
      const dates = this._weekDates();
      const width = Math.max(320, this.stage.clientWidth || this.container.clientWidth || 320);
      const chartHeight = width <= 420 ? 500 : CHART_HEIGHT;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(chartHeight * dpr);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${chartHeight}px`;
      this.stage.style.height = `${chartHeight}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._drawBackground(width, dates, items, chartHeight);
      this._renderStats(items);
      this._renderBubbles(width, dates, items, chartHeight);
      this._renderSrTable(items);
      this.stage.querySelector('.feeding-chart-empty').hidden = items.length > 0;
      this.container.querySelector('.feeding-chart-note').hidden = items.length === 0;
      const weekLabel = this.container.querySelector('.feeding-week-label');
      if (weekLabel) weekLabel.textContent = `${dateLabel(this.weekStart)} - ${dateLabel(addDays(this.weekStart, 6))} ▾`;
      this.container.setAttribute('aria-label', `近7天喂养时间气泡图，显示${dateLabel(this.weekStart)}至${dateLabel(addDays(this.weekStart, 6))}的喂养记录`);
    }

    _drawBackground(width, dates, items, chartHeight) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, width, chartHeight);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, chartHeight);
      const colWidth = (width - PAD_LEFT) / 7;
      ctx.font = '12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
      ctx.textAlign = 'center';
      dates.forEach((d, i) => {
        const x = PAD_LEFT + colWidth * i + colWidth / 2;
        ctx.fillStyle = COLORS.text;
        ctx.fillText(dateLabel(d), x, 18);
        const stats = this._dailyStats(items, dateKey(d));
        ctx.fillStyle = COLORS.dark;
        ctx.font = '600 16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
        ctx.fillText(`${stats.count}次`, x, 43);
        ctx.fillStyle = '#999999';
        ctx.font = '12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
        ctx.fillText(stats.duration, x, 64);
      });
      ctx.font = '12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
      ctx.textAlign = 'right';
      for (let hour = 0; hour < 24; hour += 2) {
        const y = 82 + (hour / 24) * (chartHeight - 82);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD_LEFT, y); ctx.lineTo(width, y); ctx.stroke();
        ctx.fillStyle = COLORS.text;
        ctx.fillText(pad(hour), PAD_LEFT - 8, y + 4);
      }
      ctx.strokeStyle = COLORS.axis;
      ctx.beginPath(); ctx.moveTo(PAD_LEFT, 82); ctx.lineTo(PAD_LEFT, chartHeight); ctx.stroke();
    }

    _renderStats(items) {
      this.container.querySelector('[data-stat="interval"]').textContent = this._averageInterval(items);
      this.container.querySelector('[data-stat="night"]').textContent = `${this._nightCount(items)}次`;
    }

    _renderBubbles(width, dates, items, chartHeight) {
      const colWidth = (width - PAD_LEFT) / 7;
      this.bubbleLayer.innerHTML = '';
      this.bubbles = [];
      this.dataPoints = [];
      const sameTime = {};
      items.forEach((item, index) => {
        const key = `${dateKey(item.date)}-${Math.round((item.date.getHours() * 60 + item.date.getMinutes()) / 15)}`;
        sameTime[key] = (sameTime[key] || 0) + 1;
        const occurrence = sameTime[key];
        const dayIndex = Math.round((startOfDay(item.date) - startOfDay(this.weekStart)) / DAY_MS);
        const x = PAD_LEFT + colWidth * dayIndex + colWidth / 2 + (occurrence > 1 ? (occurrence % 2 ? 8 : -8) : 0);
        const y = 82 + ((item.date.getHours() * 60 + item.date.getMinutes()) / 1440) * (chartHeight - 82);
        const duration = Number(item.record.duration || item.record.totalDuration || item.record.leftDuration || 0);
        const bubble = document.createElement('button');
        bubble.type = 'button';
        bubble.className = 'chart-bubble' + ((this._dailyStats(items, dateKey(item.date)).count > 10) ? ' compact' : '');
        bubble.dataset.index = String(index);
        bubble.style.left = `${x}px`;
        bubble.style.top = `${y}px`;
        const amount = Number(item.record.volume || item.record.amount || 0);
        const metric = duration || Math.round(amount / 5);
        const size = Math.max(28, Math.min(38, 28 + Math.round(metric / 10)));
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.textContent = bubbleText(item.record, duration);
        const feedType = item.record.feedType || item.record.feedingSubtype || item.record.type;
        const typeName = this._typeName(feedType, item.record.milkSource);
      bubble.dataset.feedType = feedType || 'feeding';
        bubble.setAttribute('aria-label', `${dateLabel(item.date)} ${pad(item.date.getHours())}点${pad(item.date.getMinutes())}分，${typeName}，${duration ? `时长${duration}分钟` : '时长未记录'}`);
        this.bubbleLayer.appendChild(bubble);
        this.bubbles.push(bubble);
        this.dataPoints.push({ x, y, hotZone: 24, data: item.record });
      });
    }

    _renderSrTable(items) {
      const tbody = this.container.querySelector('.feeding-chart-sr-table tbody');
      tbody.innerHTML = items.map(item => {
        const r = item.record;
        const duration = Number(r.duration || r.totalDuration || r.leftDuration || 0);
        const feedType = r.feedType || r.feedingSubtype || r.type;
        return `<tr><td>${dateLabel(item.date)} ${pad(item.date.getHours())}:${pad(item.date.getMinutes())}</td><td>${escapeHtml(this._typeName(feedType, r.milkSource))}</td><td>${duration ? `${duration}分钟` : '未记录'}</td><td>${r.volume || r.amount ? `${r.volume || r.amount}${r.unit || 'ml'}` : '-'}</td></tr>`;
      }).join('');
    }

    _typeName(type, milkSource) {
      const normalized = type === 'breast_direct' ? 'breast' : type === 'bottle' ? (milkSource === 'formula' ? 'formula' : 'bottle_breast') : type;
      return ({ breastfeeding: '亲喂', breast: '亲喂', bottle_breast: '母乳瓶喂', formula: '配方奶' }[normalized] || '喂养');
    }
    showTooltip(index, bubble, hover) {
      const item = this._validFeedings()[index];
      if (!item) return;
      const r = item.record;
      const duration = Number(r.duration || r.totalDuration || r.leftDuration || 0);
      const feedType = r.feedType || r.feedingSubtype || r.type;
      this.tooltip.innerHTML = `<strong>${pad(item.date.getHours())}:${pad(item.date.getMinutes())}</strong><span>${escapeHtml(this._typeName(feedType, r.milkSource))}</span><span>时长：${duration ? `${duration}分钟` : '未记录'}</span>${r.volume || r.amount ? `<span>奶量：${r.volume || r.amount}${r.unit || 'ml'}</span>` : ''}${r.note ? `<hr><small>${escapeHtml(r.note)}</small>` : ''}`;
      this.tooltip.hidden = false;
      const stageRect = this.stage.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const tooltipWidth = 210;
      let left = bubbleRect.right - stageRect.left + 10;
      if (left + tooltipWidth > stageRect.width) left = bubbleRect.left - stageRect.left - tooltipWidth - 10;
      let top = bubbleRect.top - stageRect.top - 60;
      if (top < 8) top = bubbleRect.bottom - stageRect.top + 12;
      this.tooltip.style.left = `${Math.max(4, left)}px`;
      this.tooltip.style.top = `${Math.max(4, top)}px`;
      this._tooltipPinned = !hover;
      this.container.querySelector('.feeding-chart-live').textContent = `${dateLabel(item.date)} ${pad(item.date.getHours())}:${pad(item.date.getMinutes())}，${this._typeName(feedType, r.milkSource)}，${duration ? `时长${duration}分钟` : '时长未记录'}`;
      this._emit('bubbleClick', r);
      clearTimeout(this._tooltipTimer);
    }
    hideTooltip() { if (this.tooltip) this.tooltip.hidden = true; this._tooltipPinned = false; clearTimeout(this._tooltipTimer); }
    _showQuickMenu(index, bubble) {
      const r = this._validFeedings()[index]?.record;
      if (!r) return;
      this.showTooltip(index, bubble);
      const action = confirm('快捷操作：确定=编辑，取消=关闭');
      if (action && typeof this.options.onEdit === 'function') this.options.onEdit(r);
    }
    findNearestBubble(touchX, touchY) {
      const rect = this.bubbleLayer.getBoundingClientRect();
      const x = touchX - rect.left; const y = touchY - rect.top;
      return this.dataPoints.reduce((nearest, point) => {
        const distance = Math.hypot(point.x - x, point.y - y);
        return distance < point.hotZone && (!nearest || distance < nearest.distance) ? { ...point, distance } : nearest;
      }, null);
    }
    destroy() {
      if (this._onResize) window.removeEventListener('resize', this._onResize);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      clearTimeout(this._resizeTimer); clearTimeout(this._tooltipTimer); clearTimeout(this._longPressTimer);
      if (this.container) this.container.innerHTML = '';
      this.bubbles = []; this.dataPoints = []; this.isInitialized = false;
    }
  }

  global.FeedingTimeChart = FeedingTimeChart;
})(window);

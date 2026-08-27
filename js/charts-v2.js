/**
 * charts-v2.js — R5 数据可视化（v2 通道专属，V1 通道零加载）
 * 方案⑤：日报/周报/月报 SVG 面积图（平滑曲线 + 同色系渐变 + 气泡数据点 + 点击 tooltip）
 *       + 月报里程碑时间线点击展开（默认折叠为摘要行）
 * 原则：纯手写 SVG path，零第三方库；渐变只用 --color-accent → --color-accent-soft 同色系；
 *      状态/评估标注走语义色三件套；transform/opacity-only 动画 + prefers-reduced-motion 降级。
 */
(function () {
  if (!window.__UI_V3__) return; // v1 通道零加载

  var ChartsV2 = {
    // ---- 平滑曲线：Catmull-Rom 转 cubic Bezier ----
    _smoothPath: function (pts) {
      if (!pts || pts.length < 2) return '';
      if (pts.length === 2) return 'M ' + pts[0][0] + ' ' + pts[0][1] + ' L ' + pts[1][0] + ' ' + pts[1][1];
      var d = 'M ' + pts[0][0] + ' ' + pts[0][1];
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
        var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ' C ' + c1x + ' ' + c1y + ', ' + c2x + ' ' + c2y + ', ' + p2[0] + ' ' + p2[1];
      }
      return d;
    },

    /**
     * SVG 面积图（平滑曲线 + accent 同色系渐变 + 气泡数据点）
     * @param {Array<{label:string, value:number}>} entries 按时间升序
     * @param {Object} opts { unit='', height=120, showXLabels=true, ariaLabel='' }
     * @returns {string} HTML 字符串（含 tooltip 容器，需 bindAreaChart 绑定）
     */
    areaChartHTML: function (entries, opts) {
      opts = opts || {};
      var unit = opts.unit || '';
      var ariaLabel = opts.ariaLabel || '趋势图';
      var values = (entries || []).map(function (e) { return Number(e.value) || 0; });
      if (values.length === 0) {
        return '<div class="v2-area-empty">暂无趋势数据</div>';
      }
      if (values.length === 1) {
        return '<div class="v2-area-single">' + (entries[0].label || '') + ' · <strong>' + values[0] + (unit ? ' ' + unit : '') + '</strong></div>';
      }

      var W = 340, H = opts.height || 120, PAD_L = 4, PAD_R = 4, PAD_T = 10, PAD_B = 18;
      var plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
      var maxV = Math.max.apply(null, values), minV = Math.min.apply(null, values);
      if (maxV === minV) { maxV = minV + 1; }
      var range = maxV - minV || 1;

      var pts = values.map(function (v, i) {
        var x = PAD_L + (i / (values.length - 1)) * plotW;
        var y = PAD_T + plotH - ((v - minV) / range) * plotH;
        return [x, y];
      });

      var lineD = this._smoothPath(pts);
      var areaD = lineD + ' L ' + pts[pts.length - 1][0] + ' ' + (PAD_T + plotH) + ' L ' + pts[0][0] + ' ' + (PAD_T + plotH) + ' Z';

      // 气泡数据点：r 随 value 归一 3~6px（对应「曲线气泡」），附数据供 tooltip
      var dots = pts.map(function (p, i) {
        var r = 3 + (values[i] / maxV) * 3;
        var dotPad = Math.max(8, r + 6); // 透明扩展热区 ≥16px，触控友好
        var label = (entries[i].label || '') + ' · ' + values[i] + (unit ? unit : '');
        return '<circle class="v2-area-dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + r.toFixed(1) + '" data-day="' + (entries[i].label || '') + '" data-value="' + values[i] + '" role="button" tabindex="0" aria-label="' + label + '" aria-describedby="v2-area-tip">'
          + '<title>' + label + '</title>'
          + '</circle>'
          + '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + dotPad + '" fill="transparent" class="v2-area-hit" data-day="' + (entries[i].label || '') + '" data-value="' + values[i] + '"/>';
      }).join('');

      var xLabels = '';
      if (opts.showXLabels !== false && values.length <= 14) {
        xLabels = entries.map(function (e, i) {
          var x = PAD_L + (i / (values.length - 1)) * plotW;
          return '<text class="v2-area-xlabel" x="' + x.toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + (e.label || '') + '</text>';
        }).join('');
      }

      var uid = 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

      return '<div class="v2-area-chart" role="img" aria-label="' + ariaLabel + '"' + (unit ? ' data-unit="' + unit + '"' : '') + '>'
        + '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="width:100%;height:' + H + 'px">'
        + '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.32"/>'
        + '<stop offset="100%" stop-color="var(--color-accent-soft)" stop-opacity="0.06"/>'
        + '</linearGradient></defs>'
        + '<path d="' + areaD + '" fill="url(#' + uid + ')"/>'
        + '<path d="' + lineD + '" fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
        + dots
        + xLabels
        + '</svg>'
        + '<div class="v2-area-tooltip" id="v2-area-tip" role="status" aria-live="polite" hidden></div>'
        + '</div>';
    },

    /** 绑定面积图 tooltip：事件委托，点击/触屏/键盘 Enter 显示单日数值 */
    bindAreaChart: function (container) {
      if (!container || container.__v2AreaBound) return;
      container.__v2AreaBound = true;
      var tip = container.querySelector('.v2-area-tooltip');
      var chart = container.querySelector('.v2-area-chart');
      if (!chart || !tip) return;

      function show(dot) {
        var day = dot.getAttribute('data-day') || '';
        var val = dot.getAttribute('data-value') || '0';
        var unit = '';
        var cm = dot.closest('.v2-area-chart');
        if (cm && cm.getAttribute('data-unit')) unit = cm.getAttribute('data-unit');
        tip.textContent = day + ' · ' + val + (unit ? ' ' + unit : '');
        tip.hidden = false;
      }

      container.addEventListener('pointerdown', function (e) {
        var hit = e.target.closest ? e.target.closest('.v2-area-hit, .v2-area-dot') : null;
        if (hit) { show(hit); e.preventDefault(); return; }
        tip.hidden = true;
      });
      container.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var dot = e.target.closest ? e.target.closest('.v2-area-dot') : null;
        if (dot) { show(dot); e.preventDefault(); }
      });
    },

    // ---- 时间线折叠（默认折叠为摘要行，点击展开） ----
    /**
     * @param {Array<{date:string, text:string}>} items
     * @param {Object} opts { title='成长里程碑', maxPreview=3 }
     */
    timelineCollapseHTML: function (items, opts) {
      opts = opts || {};
      var list = items || [];
      if (list.length === 0) return '';
      var title = opts.title || '成长里程碑';
      var maxPreview = opts.maxPreview || 3;
      var summaryText = '<span style="display:inline-flex;align-items:center;vertical-align:-3px;margin-right:3px">' + Lucide.icon('sprout', 15) + '</span>本月 ' + list.length + ' 个' + title + '（点击展开）';

      var preview = list.slice(0, maxPreview).map(function (m) {
        return '<div class="rpt-timeline-item"><div class="rpt-timeline-date">' + (m.date || '') + '</div><div class="rpt-timeline-text">' + (m.text || '') + '</div></div>';
      }).join('');
      var rest = list.slice(maxPreview).map(function (m) {
        return '<div class="rpt-timeline-item"><div class="rpt-timeline-date">' + (m.date || '') + '</div><div class="rpt-timeline-text">' + (m.text || '') + '</div></div>';
      }).join('');

      return '<div class="v2-tl" data-expanded="0">'
        + '<button type="button" class="v2-tl-summary" aria-expanded="false" aria-controls="v2-tl-body">'
        + '<span class="v2-tl-summary-text">' + summaryText + '</span>'
        + '<span class="v2-tl-arrow" aria-hidden="true">▾</span>'
        + '</button>'
        + '<div class="v2-tl-preview">' + preview + '</div>'
        + '<div class="v2-tl-body" id="v2-tl-body" hidden>' + rest + '</div>'
        + '</div>';
    },

    /** 绑定时间线折叠：点击摘要切换展开/收起（transform/opacity-only） */
    bindTimeline: function (container) {
      if (!container || container.__v2TlBound) return;
      container.__v2TlBound = true;
      container.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.v2-tl-summary') : null;
        if (!btn) return;
        var wrap = btn.closest('.v2-tl');
        if (!wrap) return;
        var expanded = wrap.getAttribute('data-expanded') === '1';
        wrap.setAttribute('data-expanded', expanded ? '0' : '1');
        btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        var body = wrap.querySelector('.v2-tl-body');
        var preview = wrap.querySelector('.v2-tl-preview');
        if (!body) return;
        if (expanded) {
          body.hidden = true;
          if (preview) preview.hidden = false;
        } else {
          body.hidden = false;
          if (preview) preview.hidden = true;
        }
      });
    }
  };

  window.ChartsV2 = ChartsV2;
})();

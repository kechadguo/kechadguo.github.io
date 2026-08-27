/**
 * 成长曲线页面 — 身高体重日志 + 尺码建议 + 尺码参考表
 * 数据源：GROWTH_STANDARD + CloudBase growth_records
 */
window.GrowthCurvePage = {
  _growthKnowExpanded: false,
  _growthKnowOpenItem: -1,

  async render(container) {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby.birthDate) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">${Lucide.icon('trending-up', 32)}</div><p>请先创建宝宝档案</p></div>`;
      return;
    }

    this.container = container;
    this.baby = baby;
    this.birthDate = new Date(baby.birthDate);
    // v74：性别统一走 normalizeGender（'boy'/'girl'），修复男宝误用女宝标准
    this.gender = normalizeGender(baby.gender);

    await this._loadRecords();
    this._render();
  },

  async _loadRecords() {
    this.records = [];
    try {
      if (window.API && API.listGrowth) {
        const result = await API.listGrowth(1);
        this.records = (result && result.records) ? result.records : [];
      }
    } catch (e) {
      console.log('加载成长记录失败，尝试本地:', e);
    }
    // 如果没有云端数据，从localStorage读取
    if (this.records.length === 0) {
      try {
        this.records = JSON.parse(localStorage.getItem('oneone_growth_records') || '[]');
      } catch { this.records = []; }
    }

    // 按日期升序排列
    this.records.sort((a, b) => (a.date || a.recordDate || '').localeCompare(b.date || b.recordDate || ''));
  },

  _render() {
    const c = this.container;

    // 获取最新身高体重
    const latestWeight = this._getLatest('weight');
    const latestHeight = this._getLatest('height');

    let html = '';

    // === 成长曲线 SVG 图表（页面顶端） ===
    html += this._renderGrowthCurveSVG();

    // 身高体重维护日志
    html += `<div class="card">
      <div class="card-title">${Lucide.icon('ruler', 18)} 身高体重</div>
      <div class="growth-stats-row">
        <div class="growth-stat-box">
          <div class="growth-stat-value">${latestHeight ? latestHeight + ' cm' : '--'}</div>
          <div class="growth-stat-label">最新身高</div>
        </div>
        <div class="growth-stat-box">
          <div class="growth-stat-value">${latestWeight ? latestWeight + ' kg' : '--'}</div>
          <div class="growth-stat-label">最新体重</div>
        </div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="App.openGrowthForm()">${Lucide.icon('plus', 18)} 添加测量数据</button>
    </div>`;

    // 本月发育知识（折叠卡，身高体重卡下方）
    html += this._renderGrowthKnowledge();

    // 尺码建议卡
    html += this._renderSizeAdvice(latestHeight);

    // 记录日志
    html += `<div class="card">
      <div class="card-title">${Lucide.icon('clipboard-list', 18)} 测量日志</div>`;
    if (this.records.length === 0) {
      html += `<p class="text-muted text-center" style="padding: 20px 0">暂无成长记录</p>`;
    } else {
      // 显示最近20条，最新的在前
      const recent = [...this.records].reverse().slice(0, 20);
      for (const r of recent) {
        const date = r.date || r.recordDate || '';
        const parts = [];
        if (r.height) parts.push(`身高 ${r.height}cm`);
        if (r.weight) parts.push(`体重 ${r.weight}kg`);
        if (r.headCircumference) parts.push(`头围 ${r.headCircumference}cm`);
        const desc = parts.join(' · ') || '已记录';
        html += `<div class="record-item">
          <div class="record-main">
            <div class="record-title">${date}</div>
            <div class="record-meta">${desc}</div>
          </div>
        </div>`;
      }
    }
    html += '</div>';

    // 尺码参考表
    html += this._renderSizeTable();

    c.innerHTML = html;
  },

  /** 渲染成长曲线 SVG 图表（含 WHO 百分位曲线） */
  _renderGrowthCurveSVG() {
    const monthAge = this._calcMonthAge();
    const gender = this.gender;

    const weights = this.records.map(r => ({ date: r.date || r.recordDate, age: r.ageMonths || this._calcAgeAtDate(r.date || r.recordDate), value: r.weight })).filter(r => r.value);
    const heights = this.records.map(r => ({ date: r.date || r.recordDate, age: r.ageMonths || this._calcAgeAtDate(r.date || r.recordDate), value: r.height })).filter(r => r.value);

    if (weights.length === 0 && heights.length === 0) {
      var meta = window.GROWTH_DATA_SOURCES && window.GROWTH_DATA_SOURCES[GROWTH_STANDARD.sourceTrack || 'who'];
      return `<div class="card"><div class="card-title">${Lucide.icon('trending-up', 18)} 成长曲线（${meta ? meta.name : '参考曲线'}）</div><p class="text-muted text-center" style="padding:12px 0">暂无成长数据，请先记录测量数据</p></div>`;
    }

    let html = '';

    if (weights.length > 0) {
      html += this._renderPercentileChart('体重 (kg)', 'weight', weights, gender, monthAge, true);
    }
    if (heights.length > 0) {
      html += this._renderPercentileChart('身长/身高 (cm)', 'height', heights, gender, monthAge, true);
    }

    return html;
  },

  /** 计算某条记录时的月龄 */
  _calcAgeAtDate(dateStr) {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const months = (d.getFullYear() - this.birthDate.getFullYear()) * 12 + (d.getMonth() - this.birthDate.getMonth());
    return Math.max(0, months);
  },

  /**
   * 渲染百分位曲线图（核心图表方法）
   * @param {string} title - 图表标题
   * @param {string} type - 'weight' | 'height'
   * @param {Array} userData - [{date, age, value}]
   * @param {string} genderStr - 'boy'|'girl'
   * @param {number} currentAge - 当前月龄
   * @param {boolean} showLegend - 是否显示图例
   */
  _renderPercentileChart(title, type, userData, genderStr, currentAge, showLegend) {
    var self = this;

    // v2 视觉翻新（方案⑤）：百分位曲线走类别色槽位、用户曲线走 accent、
    // 带状区暖米白中性色、评估标注走状态语义色三件套；v1 保持原霓虹色
    var v2 = !!window.__UI_V3__;
    var PAL = v2 ? {
      curve: { P3: 'var(--color-category-1)', P10: 'var(--color-category-2)', P25: 'var(--color-category-3)', P50: 'var(--color-category-4)', P75: 'var(--color-category-3)', P90: 'var(--color-category-2)', P97: 'var(--color-category-1)' },
      user: 'var(--color-accent)',
      band: { '>P97': 'var(--color-bg-sunken)', 'P90-P97': 'var(--color-bg-sunken)', 'P75-P90': 'var(--color-bg-sunken)', 'P25-P75': 'var(--color-bg-raised)', 'P10-P25': 'var(--color-bg-sunken)', 'P3-P10': 'var(--color-bg-sunken)', '<P3': 'var(--color-bg-sunken)' },
      analysis: { ok: 'var(--color-success-deep)', warn: 'var(--color-highlight-deep)', alert: 'var(--color-error-deep)' }
    } : null;

    // 获取百分位曲线
    var sourceMeta = window.GROWTH_DATA_SOURCES && window.GROWTH_DATA_SOURCES[GROWTH_STANDARD.sourceTrack || 'who'];
    var percentileKeys = ['P3', 'P10', 'P25', 'P50', 'P75', 'P90', 'P97'];
    var curves = {};
    for (var k = 0; k < percentileKeys.length; k++) {
      curves[percentileKeys[k]] = (function(kk) {
        return getPercentileCurve(genderStr, type, percentileKeys[kk]);
      })(k);
    }

    // 计算 Y 轴范围：覆盖所有百分位曲线 + 用户数据
    var allVals = [];
    for (var pk = 0; pk < percentileKeys.length; pk++) {
      for (var pi = 0; pi < curves[percentileKeys[pk]].length; pi++) {
        allVals.push(curves[percentileKeys[pk]][pi].value);
      }
    }
    for (var ui = 0; ui < userData.length; ui++) {
      allVals.push(parseFloat(userData[ui].value));
    }
    var yMin = Math.min.apply(null, allVals);
    var yMax = Math.max.apply(null, allVals);
    var yPad = (yMax - yMin) * 0.12;
    yMin = Math.floor((yMin - yPad) * 10) / 10;
    yMax = Math.ceil((yMax + yPad) * 10) / 10;

    // SVG 尺寸
    var W = 700, H = 400;
    var left = 55, right = 18, top = 20, bottom = 45;
    var plotW = W - left - right, plotH = H - top - bottom;

    // 坐标转换
    var maxCurveMonth = (window.GROWTH_STANDARD && window.GROWTH_STANDARD.coverageMonths ? window.GROWTH_STANDARD.coverageMonths[1] : 24);
    function toX(month) { return left + (month / maxCurveMonth) * plotW; }
    function toY(val) { return top + plotH - ((val - yMin) / (yMax - yMin)) * plotH; }

    var svgParts = [];

    // === 1. 百分位带状区域 ===
    for (var b = 0; b < PERCENTILE_BANDS.length; b++) {
      var band = PERCENTILE_BANDS[b];
      var lowCurve = band.low ? curves[band.low] : null;
      var highCurve = band.high ? curves[band.high] : null;

      // 构建带状区域路径
      var bandPoints = [];
      if (lowCurve && highCurve) {
        // 从左到右画上线
        for (var mi = 0; mi <= maxCurveMonth; mi++) {
          bandPoints.push([toX(mi), toY(self._interpCurve(lowCurve, mi))]);
        }
        // 从右到左画下线
        for (var mi2 = maxCurveMonth; mi2 >= 0; mi2--) {
          bandPoints.push([toX(mi2), toY(self._interpCurve(highCurve, mi2))]);
        }
      } else if (lowCurve && !highCurve) {
        // 只有下界，上方填充（>P97）
        for (var mi3 = 0; mi3 <= maxCurveMonth; mi3++) {
          bandPoints.push([toX(mi3), toY(self._interpCurve(lowCurve, mi3))]);
        }
        bandPoints.push([toX(maxCurveMonth), top]);
        bandPoints.push([toX(0), top]);
      } else if (!lowCurve && highCurve) {
        // 只有上界，下方填充（<P3）
        for (var mi4 = 0; mi4 <= maxCurveMonth; mi4++) {
          bandPoints.push([toX(mi4), toY(self._interpCurve(highCurve, mi4))]);
        }
        bandPoints.push([toX(maxCurveMonth), top + plotH]);
        bandPoints.push([toX(0), top + plotH]);
      }

      if (bandPoints.length >= 3) {
        var pathD = 'M ' + bandPoints[0][0] + ' ' + bandPoints[0][1];
        for (var bp = 1; bp < bandPoints.length; bp++) {
          pathD += ' L ' + bandPoints[bp][0] + ' ' + bandPoints[bp][1];
        }
        pathD += ' Z';
        var bandFill = (PAL && PAL.band[band.label]) ? PAL.band[band.label] : band.color;
        svgParts.push('<path d="' + pathD + '" fill="' + bandFill + '" opacity="' + (PAL ? '0.7' : '0.55') + '"/>');
      }
    }

    // === 2. 百分位曲线 ===
    var dashedStyles = { 'P3': '6,3', 'P10': '4,3', 'P25': '3,3', 'P50': '', 'P75': '3,3', 'P90': '4,3', 'P97': '6,3' };
    var lineColors = PAL ? PAL.curve : { 'P3': '#E53935', 'P10': '#FB8C00', 'P25': '#F9A825', 'P50': '#2E7D32', 'P75': '#F9A825', 'P90': '#FB8C00', 'P97': '#E53935' };
    var USER_COLOR = PAL ? PAL.user : '#1A237E';
    var lineWidths = { 'P3': 1.2, 'P10': 1.2, 'P25': 1.0, 'P50': 2.5, 'P75': 1.0, 'P90': 1.2, 'P97': 1.2 };

    var curveOrder = ['P3', 'P10', 'P25', 'P50', 'P75', 'P90', 'P97'];
    for (var co = 0; co < curveOrder.length; co++) {
      var cKey = curveOrder[co];
      var cData = curves[cKey];
      var pts = [];
      for (var ci = 0; ci <= maxCurveMonth; ci++) {
        pts.push(toX(ci) + ',' + toY(self._interpCurve(cData, ci)));
      }
      var polyline = '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + lineColors[cKey] + '" stroke-width="' + lineWidths[cKey] + '"';
      if (dashedStyles[cKey]) polyline += ' stroke-dasharray="' + dashedStyles[cKey] + '"';
      polyline += '/>';
      svgParts.push(polyline);

      // P50、P97、P3 在末端加标签
      if (cKey === 'P50' || cKey === 'P97' || cKey === 'P3') {
        var labelX = toX(maxCurveMonth) + 3;
        var labelY = toY(self._interpCurve(cData, maxCurveMonth)) + 4;
        svgParts.push('<text x="' + labelX + '" y="' + labelY + '" fill="' + lineColors[cKey] + '" font-size="10" font-weight="' + (cKey === 'P50' ? 'bold' : 'normal') + '">' + cKey + '</text>');
      }
    }

    // === 3. 用户数据点 ===
    if (userData.length >= 1) {
      // 连线
      if (userData.length >= 2) {
        var userPts = [];
        for (var ud = 0; ud < userData.length; ud++) {
          var uAge = userData[ud].age;
          if (uAge > maxCurveMonth) uAge = maxCurveMonth;
          userPts.push(toX(uAge) + ',' + toY(parseFloat(userData[ud].value)));
        }
        svgParts.push('<polyline points="' + userPts.join(' ') + '" fill="none" stroke="' + USER_COLOR + '" stroke-width="3" stroke-linejoin="round"/>');
        svgParts.push('<polyline points="' + userPts.join(' ') + '" fill="none" stroke="#FFF" stroke-width="1.2" stroke-linejoin="round" opacity="0.4"/>');
      }

      // 数据点
      for (var ud2 = 0; ud2 < userData.length; ud2++) {
        var uAge2 = userData[ud2].age;
        if (uAge2 > maxCurveMonth) uAge2 = maxCurveMonth;
        var ux = toX(uAge2), uy = toY(parseFloat(userData[ud2].value));
        var isLatest = (ud2 === userData.length - 1);
        if (isLatest) {
          // 最新点：大圆圈 + 白边
          svgParts.push('<circle cx="' + ux + '" cy="' + uy + '" r="7" fill="' + USER_COLOR + '" stroke="#FFF" stroke-width="2.5"/>');
          svgParts.push('<circle cx="' + ux + '" cy="' + uy + '" r="4" fill="#FFF"/>');
        } else {
          svgParts.push('<circle cx="' + ux + '" cy="' + uy + '" r="4.5" fill="' + USER_COLOR + '" stroke="#FFF" stroke-width="1.5"/>');
        }
      }
    }

    // === 4. 坐标轴 ===
    svgParts.push('<line x1="' + left + '" y1="' + (top + plotH) + '" x2="' + (left + plotW) + '" y2="' + (top + plotH) + '" stroke="#BBB" stroke-width="1"/>');
    svgParts.push('<line x1="' + left + '" y1="' + top + '" x2="' + left + '" y2="' + (top + plotH) + '" stroke="#BBB" stroke-width="1"/>');

    // Y 轴刻度
    var yTicks = 5;
    for (var yt = 0; yt <= yTicks; yt++) {
      var yVal = yMin + (yt / yTicks) * (yMax - yMin);
      var yPos = toY(yVal);
      svgParts.push('<line x1="' + (left - 4) + '" y1="' + yPos + '" x2="' + left + '" y2="' + yPos + '" stroke="#BBB" stroke-width="1"/>');
      svgParts.push('<text x="' + (left - 7) + '" y="' + (yPos + 4) + '" text-anchor="end" fill="#888" font-size="11">' + yVal.toFixed(1) + '</text>');
      // 浅灰网格线
      if (yt > 0 && yt < yTicks) {
        svgParts.push('<line x1="' + left + '" y1="' + yPos + '" x2="' + (left + plotW) + '" y2="' + yPos + '" stroke="rgba(128,120,110,0.22)" stroke-width="0.5"/>');
      }
    }

    // X 轴刻度（月龄）
    var xMonths = maxCurveMonth >= 60 ? [0, 6, 12, 18, 24, 36, 48, 60] : [0, 3, 6, 9, 12, 15, 18, 21, 24];
    for (var xm = 0; xm < xMonths.length; xm++) {
      var mx = xMonths[xm];
      var xPos = toX(mx);
      svgParts.push('<line x1="' + xPos + '" y1="' + (top + plotH) + '" x2="' + xPos + '" y2="' + (top + plotH + 5) + '" stroke="#BBB" stroke-width="1"/>');
      svgParts.push('<text x="' + xPos + '" y="' + (top + plotH + 20) + '" text-anchor="middle" fill="#888" font-size="11">' + mx + '</text>');
    }

    // 轴标签
    svgParts.push('<text x="' + (left + plotW / 2) + '" y="' + (H - 5) + '" text-anchor="middle" fill="#666" font-size="12">月龄</text>');
    svgParts.push('<text x="12" y="' + (top + plotH / 2) + '" text-anchor="middle" fill="#666" font-size="12" transform="rotate(-90,12,' + (top + plotH / 2) + ')">' + title + '</text>');

    // === 5. 当前月龄竖线 ===
    if (currentAge <= maxCurveMonth && currentAge >= 0) {
      var cx2 = toX(currentAge);
      svgParts.push('<line x1="' + cx2 + '" y1="' + top + '" x2="' + cx2 + '" y2="' + (top + plotH) + '" stroke="' + USER_COLOR + '" stroke-width="1" stroke-dasharray="4,4" opacity="0.35"/>');
    }

    // === 6. 标题 ===
    var genderLabel = (self.gender === 'boy' || genderStr === 'boy') ? '男宝' : '女宝';
    svgParts.push('<text x="' + left + '" y="14" fill="#333" font-size="13" font-weight="bold">' + genderLabel + ' · ' + title + '</text>');

    // === 7. 图例 ===
    if (showLegend) {
      var legendY = top + 5;
      var legendItems = PAL
        ? [
            { label: 'P97', color: PAL.curve.P97 },
            { label: 'P90', color: PAL.curve.P90 },
            { label: 'P75', color: PAL.curve.P75 },
            { label: 'P50', color: PAL.curve.P50 },
            { label: 'P25', color: PAL.curve.P25 },
            { label: 'P10', color: PAL.curve.P10 },
            { label: 'P3', color: PAL.curve.P3 },
            { label: '宝宝', color: PAL.user }
          ]
        : [
            { label: 'P97', color: '#E53935' },
            { label: 'P90', color: '#FB8C00' },
            { label: 'P75', color: '#F9A825' },
            { label: 'P50', color: '#2E7D32' },
            { label: 'P25', color: '#F9A825' },
            { label: 'P10', color: '#FB8C00' },
            { label: 'P3', color: '#E53935' },
            { label: '宝宝', color: '#1A237E' }
          ];
      var legendHtml = '';
      for (var li = 0; li < legendItems.length; li++) {
        var lx = left + plotW - 200 + li * 25;
        svgParts.push('<line x1="' + lx + '" y1="' + legendY + '" x2="' + (lx + 14) + '" y2="' + legendY + '" stroke="' + legendItems[li].color + '" stroke-width="' + (legendItems[li].label === 'P50' ? 2.5 : legendItems[li].label === '宝宝' ? 3 : 1.5) + '"' + (legendItems[li].label !== 'P50' && legendItems[li].label !== '宝宝' ? ' stroke-dasharray="2,2"' : '') + '/>');
        svgParts.push('<text x="' + (lx + 17) + '" y="' + (legendY + 4) + '" fill="#666" font-size="9">' + legendItems[li].label + '</text>');
      }
    }

    // === 8. 数据源声明 ===
    var sourceNote = sourceMeta ? '<div class="growth-source-note">数据源：' + sourceMeta.name + ' · 当前内置至' + (GROWTH_STANDARD.coverageMonths || [0, 24])[1] + '月龄；P3/P97为筛查边界，非医疗诊断。</div>' : '';
    // === 9. 分析文字 ===
    var analysisText = sourceNote;
    if (userData.length > 0) {
      var latestD = userData[userData.length - 1];
      var latestVal = parseFloat(latestD.value);
      var assess = window.assessPercentile(currentAge, genderStr, latestVal, type);
      var pct = assess ? assess.percentile : null;
      var band = assess ? assess.band : null;
      var p50Val = curves['P50'][Math.min(maxCurveMonth, Math.round(currentAge))] ? curves['P50'][Math.min(maxCurveMonth, Math.round(currentAge))].value : '-';

      if (pct !== null) {
        // v2：评估颜色走状态语义色（25-75 正常→success / 10-90 关注→highlight / 其余→error）
        var analysisColor = PAL
          ? ((pct >= 25 && pct <= 75) ? PAL.analysis.ok : (pct >= 10 && pct <= 90) ? PAL.analysis.warn : PAL.analysis.alert)
          : ((pct >= 25 && pct <= 75) ? '#2E7D32' : (pct >= 10 && pct <= 90) ? '#F57C00' : '#C62828');
        analysisText += '<div class="gc-analysis" style="padding:12px 16px;border-top:1px solid var(--color-border-subtle, #EEE);margin-top:8px">';
        analysisText += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
        analysisText += '<span style="font-size:20px;font-weight:bold;color:' + analysisColor + '">P' + pct + '</span>';
        analysisText += '<span style="font-size:13px;color:#555">· 处于 <b style="color:' + analysisColor + '">' + band + '</b> 区间</span>';
        analysisText += '</div>';
        analysisText += '<div style="font-size:12px;color:#888;line-height:1.6">';
        analysisText += '当前值 <b>' + latestVal + '</b>，同月龄 P50 中位数为 <b>' + p50Val + '</b>。';
        if (pct >= 90) {
          analysisText += ' 生长水平较高，发育良好，注意监测增长速度避免过快。';
        } else if (pct >= 75) {
          analysisText += ' 生长水平中上，发育正常，继续保持。';
        } else if (pct >= 25) {
          analysisText += ' 生长水平中等，处于正常区间，发育良好。';
        } else if (pct >= 10) {
          analysisText += ' 生长水平偏下，建议关注喂养情况，确保营养充足。';
        } else if (pct >= 3) {
          analysisText += ' 生长水平偏低，建议加强营养，必要时咨询儿科医生。';
        } else {
          analysisText += ' 生长水平明显偏低，建议及时就医评估。';
        }
        analysisText += '</div></div>';
      }
    }

    // 最终组装
    var svgHtml = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:700px;display:block;margin:0 auto;font-family:-apple-system,system-ui,sans-serif">\n' + svgParts.join('\n') + '\n</svg>';

    return '<div class="card' + (v2 ? ' gc-chart-v2' : '') + '" style="padding:12px">' + svgHtml + (analysisText || '') + '</div>';
  },

  /** 线性插值获取曲线上某月龄的值 */
  _interpCurve(curve, month) {
    if (!curve || curve.length === 0) return 0;
    if (month <= curve[0].month) return curve[0].value;
    if (month >= curve[curve.length - 1].month) return curve[curve.length - 1].value;

    for (var i = 0; i < curve.length - 1; i++) {
      if (month >= curve[i].month && month <= curve[i + 1].month) {
        var ratio = (month - curve[i].month) / (curve[i + 1].month - curve[i].month);
        return curve[i].value + ratio * (curve[i + 1].value - curve[i].value);
      }
    }
    return curve[curve.length - 1].value;
  },

  /** 获取最新测量值 */
  _getLatest(field) {
    if (this.records.length === 0) return null;
    for (let i = this.records.length - 1; i >= 0; i--) {
      const val = parseFloat(this.records[i][field]);
      if (!isNaN(val) && val > 0) return val;
    }
    return null;
  },

  /** 尺码建议 */
  _renderSizeAdvice(latestHeight) {
    if (!latestHeight) {
      return `<div class="card">
        <div class="card-title">${Lucide.icon('shirt', 18)} 尺码建议</div>
        <p class="text-muted text-center" style="padding:12px">暂无身高数据，录入后可获得尺码建议</p>
      </div>`;
    }

    const monthAge = this._calcMonthAge();
    const clothSize = this._getClothSize(monthAge, latestHeight);
    const shoeSize = this._getShoeSize(monthAge);

    return `<div class="card">
      <div class="card-title">${Lucide.icon('shirt', 18)} 尺码建议</div>
      <div class="size-advice-row">
        <div class="size-advice-item">
          <div class="size-advice-icon">${Lucide.icon('shirt', 24)}</div>
          <div class="size-advice-info">
            <div class="size-advice-label">推荐衣服尺码</div>
            <div class="size-advice-value">${clothSize}</div>
          </div>
        </div>
        <div class="size-advice-item">
          <div class="size-advice-icon">${Lucide.icon('footprints', 24)}</div>
          <div class="size-advice-info">
            <div class="size-advice-label">推荐鞋码</div>
            <div class="size-advice-value">${shoeSize}</div>
          </div>
        </div>
      </div>
    </div>`;
  },

  /** 尺码参考表 */
  _renderSizeTable() {
    const refData = [
      { size: '52/新生儿', month: '0-1', height: '46-52', weight: '2.5-4', suggest: '新生儿期，买52码' },
      { size: '59/3M', month: '1-3', height: '52-59', weight: '4-6', suggest: '适合1-3个月' },
      { size: '66/6M', month: '3-6', height: '59-66', weight: '6-8', suggest: '适合3-6个月' },
      { size: '73/9M', month: '6-9', height: '66-73', weight: '7-10', suggest: '适合6-9个月' },
      { size: '80/12M', month: '9-12', height: '73-80', weight: '8.5-11', suggest: '适合9-12个月' },
      { size: '90/18M', month: '12-18', height: '80-90', weight: '10-13', suggest: '适合1岁-1岁半' },
      { size: '100/2T', month: '18-24', height: '90-100', weight: '12-15', suggest: '适合1岁半-2岁' },
      { size: '110/3T', month: '24-36', height: '100-110', weight: '14-18', suggest: '适合2-3岁' }
    ];

    const shoeRef = [
      { size: '10-11码', month: '0-6', footLen: '9-11', suggest: '新生儿期，软底袜为主' },
      { size: '12-13码', month: '6-12', footLen: '11-13', suggest: '学步前软底鞋' },
      { size: '13-14码', month: '12-18', footLen: '12-14', suggest: '学步鞋，防滑底' },
      { size: '14-15码', month: '18-24', footLen: '13-15', suggest: '稳步鞋，支撑性好' },
      { size: '15-16码', month: '24-36', footLen: '14-16', suggest: '稳步鞋' }
    ];

    return `
      <div class="card">
        <div class="card-title">${Lucide.icon('bar-chart', 18)} 衣服尺码参考</div>
        <div class="size-table-wrap">
          <table class="size-table">
            <thead><tr><th>尺码</th><th>月龄</th><th>身高(cm)</th><th>体重(kg)</th><th>建议</th></tr></thead>
            <tbody>
              ${refData.map(r => `<tr><td>${r.size}</td><td>${r.month}</td><td>${r.height}</td><td>${r.weight}</td><td>${r.suggest}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${Lucide.icon('footprints', 18)} 鞋码参考</div>
        <div class="size-table-wrap">
          <table class="size-table">
            <thead><tr><th>尺码</th><th>月龄</th><th>脚长(cm)</th><th>建议</th></tr></thead>
            <tbody>
              ${shoeRef.map(r => `<tr><td>${r.size}</td><td>${r.month}</td><td>${r.footLen}</td><td>${r.suggest}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /** 计算月龄 */
  _calcMonthAge() {
    const now = new Date();
    const months = (now.getFullYear() - this.birthDate.getFullYear()) * 12 +
      (now.getMonth() - this.birthDate.getMonth());
    return months;
  },

  /** 根据月龄和身高推荐衣服尺码 */
  _getClothSize(monthAge, height) {
    if (monthAge <= 1 && height <= 52) return '52 / 新生儿';
    if (monthAge <= 3 && height <= 59) return '59 / 3M';
    if (monthAge <= 6 && height <= 66) return '66 / 6M';
    if (monthAge <= 9 && height <= 73) return '73 / 9M';
    if (monthAge <= 12 && height <= 80) return '80 / 12M';
    if (monthAge <= 18 && height <= 90) return '90 / 18M';
    if (monthAge <= 24 && height <= 100) return '100 / 2T';
    return '110 / 3T';
  },

  /** 根据月龄推荐鞋码 */
  _getShoeSize(monthAge) {
    if (monthAge <= 6) return '10-11码';
    if (monthAge <= 12) return '12-13码';
    if (monthAge <= 18) return '13-14码';
    if (monthAge <= 24) return '14-15码';
    return '15-16码';
  },

  // ===== 本月发育知识卡 =====
  _renderGrowthKnowledge() {
    const baby = this.baby;
    if (!baby || !baby.birthDate) return '';
    if (!window.getKnowledgeItemsByAge) return '';
    const monthAge = this._calcMonthAge();
    if (monthAge == null) return '';
    const items = window.getKnowledgeItemsByAge('growth', monthAge);
    if (!items.length) return '';
    const expanded = this._growthKnowExpanded;

    const itemHTML = items.map((it, i) => {
      const open = this._growthKnowOpenItem === i;
      return `
        <div class="ki-item ${open ? 'open' : ''}" id="growth-know-item-${i}">
          <div class="ki-item-head" onclick="GrowthCurvePage._toggleGrowthKnowItem(${i})">
            <span class="ki-brief">${Utils.escapeHtml(it.title)}</span>
            <span class="ki-arrow">${open ? '▴' : '▾'}</span>
          </div>
          ${open ? `<div class="ki-item-body"><div class="ki-content">${Utils.escapeHtml(it.content)}</div></div>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="know-card">
        <div class="know-head" onclick="GrowthCurvePage._toggleGrowthKnow()">
          <span class="know-title">${Lucide.icon('trending-up', 16)} 本月发育知识 · ${monthAge}月龄 · ${items.length}条</span>
          <span class="know-arrow">${expanded ? '▴' : '▾'}</span>
        </div>
        ${expanded ? `<div class="know-body">${itemHTML}</div>` : ''}
      </div>`;
  },

  _toggleGrowthKnow() {
    this._growthKnowExpanded = !this._growthKnowExpanded;
    this._render();
  },

  _toggleGrowthKnowItem(idx) {
    this._growthKnowOpenItem = (this._growthKnowOpenItem === idx) ? -1 : idx;
    this._render();
  }
};

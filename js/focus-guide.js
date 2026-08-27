/**
 * 本月关注引导 — 按宝宝月龄给各功能页提供「主题索引 + 提示引导」
 * 用于成长日记 / 里程碑 / 成长曲线 / 疫苗用药 等页面的顶部引导条
 * 每项可点击跳转到对应模块（page + 可选 sub）
 * 图标使用 Lucide SVG（currentColor 自动跟随主题色）
 */
window.FocusGuide = {
  /** 按月龄段组织关注点：{ icon(卢塞德图标名), label, text, page, sub } */
  _segments: [
    {
      min: 0, max: 2, label: '0-2月龄',
      items: [
        { icon: 'bottle', label: '喂养', text: '按需喂养 · 记奶量', page: 'parenting', sub: 'feeding' },
        { icon: 'moon', label: '睡眠', text: '裹襁褓+5S安抚', page: 'parenting', sub: 'sleep' },
        { icon: 'syringe', label: '疫苗', text: '乙肝第1剂·卡介苗', page: 'medical' },
        { icon: 'dumbbell', label: '运动', text: '俯卧抬头·抚触', page: 'exercise' },
        { icon: 'puzzle', label: '早教', text: '黑白卡·追视', page: 'early-education' },
        { icon: 'star', label: '里程碑', text: '本月应掌握技能', page: 'milestone' }
      ]
    },
    {
      min: 3, max: 5, label: '3-5月龄',
      items: [
        { icon: 'bottle', label: '喂养', text: '3-4小时规律喂养', page: 'parenting', sub: 'feeding' },
        { icon: 'moon', label: '睡眠', text: '睡前程序·EASY作息', page: 'parenting', sub: 'sleep' },
        { icon: 'heart-pulse', label: '健康', text: '口腔清洁开始', page: 'parenting', sub: 'health' },
        { icon: 'syringe', label: '疫苗', text: '脊灰·百白破·Hib', page: 'medical' },
        { icon: 'dumbbell', label: '运动', text: '翻身·拉坐·肘撑俯卧', page: 'exercise' },
        { icon: 'puzzle', label: '早教', text: '追视彩色·咿呀对话', page: 'early-education' }
      ]
    },
    {
      min: 6, max: 8, label: '6-8月龄',
      items: [
        { icon: 'utensils', label: '辅食', text: '铁强化米粉开始', page: 'food' },
        { icon: 'bottle', label: '喂养', text: '辅食+奶，新食物试3天', page: 'parenting', sub: 'feeding' },
        { icon: 'moon', label: '睡眠', text: '自主入睡训练', page: 'parenting', sub: 'sleep' },
        { icon: 'syringe', label: '疫苗', text: '乙肝第3剂·流脑', page: 'medical' },
        { icon: 'dumbbell', label: '运动', text: '坐稳·爬行·翻滚', page: 'exercise' },
        { icon: 'puzzle', label: '早教', text: '藏猫猫·叫名字反应', page: 'early-education' }
      ]
    },
    {
      min: 9, max: 11, label: '9-11月龄',
      items: [
        { icon: 'utensils', label: '辅食', text: '手指食物·碎碎面粥', page: 'food' },
        { icon: 'moon', label: '睡眠', text: '白天小睡合并', page: 'parenting', sub: 'sleep' },
        { icon: 'syringe', label: '疫苗', text: '麻腮风·乙脑·流感', page: 'medical' },
        { icon: 'dumbbell', label: '运动', text: '扶站·扶走·爬台阶', page: 'exercise' },
        { icon: 'puzzle', label: '早教', text: '模仿游戏·指认五官', page: 'early-education' },
        { icon: 'star', label: '里程碑', text: '本月应掌握技能', page: 'milestone' }
      ]
    },
    {
      min: 12, max: 18, label: '12-18月龄',
      items: [
        { icon: 'utensils', label: '辅食', text: '一日三餐+奶·自主进食', page: 'food' },
        { icon: 'moon', label: '睡眠', text: '整夜睡·午睡1-2次', page: 'parenting', sub: 'sleep' },
        { icon: 'syringe', label: '疫苗', text: '甲肝·水痘等', page: 'medical' },
        { icon: 'dumbbell', label: '运动', text: '独走·跑·上下楼梯', page: 'exercise' },
        { icon: 'puzzle', label: '早教', text: '绘本·说单词', page: 'early-education' },
        { icon: 'trending-up', label: '成长', text: '每月测身高体重', page: 'growth-curve' }
      ]
    },
    {
      min: 19, max: 24, label: '19-24月龄',
      items: [
        { icon: 'utensils', label: '辅食', text: '家庭饮食·控零食', page: 'food' },
        { icon: 'bath', label: '护理', text: '如厕训练开始', page: 'parenting', sub: 'clean' },
        { icon: 'syringe', label: '疫苗', text: '按计划接种', page: 'medical' },
        { icon: 'dumbbell', label: '运动', text: '双脚跳·踢球', page: 'exercise' },
        { icon: 'puzzle', label: '早教', text: '语言爆发期·儿歌拼图', page: 'early-education' },
        { icon: 'star', label: '里程碑', text: '本月应掌握技能', page: 'milestone' }
      ]
    },
    {
      min: 25, max: 36, label: '25-36月龄',
      items: [
        { icon: 'utensils', label: '辅食', text: '均衡饮食·进餐礼仪', page: 'food' },
        { icon: 'school', label: '入园', text: '如厕/穿鞋/自己吃饭', page: 'parenting', sub: 'clean' },
        { icon: 'syringe', label: '疫苗', text: '按计划接种', page: 'medical' },
        { icon: 'dumbbell', label: '运动', text: '平衡木·三轮车', page: 'exercise' },
        { icon: 'puzzle', label: '早教', text: '规则意识·社交·数数', page: 'early-education' },
        { icon: 'trending-up', label: '成长', text: '每月测身高体重', page: 'growth-curve' }
      ]
    }
  ],

  /** 获取某月龄的关注点列表 */
  get(monthAge) {
    for (const seg of this._segments) {
      if (monthAge >= seg.min && monthAge <= seg.max) return seg;
    }
    return this._segments[this._segments.length - 1];
  },

  /**
   * 渲染关注引导条 HTML
   * @param {number} monthAge 宝宝月龄
   * @param {object} opts { highlight: 当前页面突出显示的 key（可选，如 'medical'） }
   */
  render(monthAge, opts) {
    const seg = this.get(monthAge);
    const hl = (opts && opts.highlight) || null;
    return `
      <div class="card focus-guide-bar">
        <div class="fg-header">
          <span class="fg-title">${Lucide.icon('pin', 14)} 本月关注 · ${seg.label}</span>
          <span class="fg-more" onclick="FocusGuide._more('${seg.label}')">更多 ></span>
        </div>
        <div class="fg-items">
          ${seg.items.map(it => `
            <div onclick="showPage('${it.page}'${it.sub ? ",'" + it.sub + "'" : ''})"
              class="fg-item ${hl === it.page ? 'fg-item-active' : ''}">
              <div class="fg-icon">${Lucide.icon(it.icon, 18)}</div>
              <div class="fg-label">${it.label}</div>
              <div class="fg-text">${it.text}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /** 「更多」：跳转到育儿百科并按月龄浏览 */
  _more(label) {
    showPage('parenting-lib');
  }
};

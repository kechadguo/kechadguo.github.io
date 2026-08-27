/**
 * 配置模块
 */
window.APP_CONFIG = {
  envId: window.STAGING_RUNTIME_CONFIG?.envId || '',
  apiBaseUrl: window.STAGING_RUNTIME_CONFIG?.apiBaseUrl || window.location.origin,

  functions: {
    auth: 'auth', family: 'family', baby: 'baby',
    feeding: 'feeding', stool: 'stool', stoolAi: 'stool-ai',
    sleep: 'sleep', growth: 'growth', health: 'health',
    milestone: 'milestone', todo: 'todo',
    inviteCode: 'invite-code', report: 'report', export: 'export',
    clean: 'cloudfunctions/clean', footprint: 'footprint', vaccine: 'vaccine',
    healthManagement: 'health-management', screening: 'screening', medication: 'vaccine', allergy: 'allergy', earlyEdu: 'early-edu', languageDevelopment: 'language-development', socialDevelopment: 'social-development', safety: 'safety',
    auditLog: 'audit-log', insurance: 'insurance'
  },

  // 喂养类型（不含辅食，辅食移至功能模块）
  feedingTypes: [
    { value: 'breast', label: '母乳亲喂', icon: 'heart-pulse', emoji: '' },
    { value: 'bottle_breast', label: '母乳瓶喂', icon: 'bottle', emoji: '' },
    { value: 'formula', label: '配方奶', icon: 'bottle', emoji: '' }
  ],

  // 排便颜色
  stoolColors: [
    { value: 'yellow', label: '黄色', icon: 'circle-dot', emoji: '' },
    { value: 'green', label: '绿色', icon: 'circle-dot', emoji: '' },
    { value: 'brown', label: '棕色', icon: 'circle-dot', emoji: '' },
    { value: 'black', label: '黑色', icon: 'circle-dot', emoji: '' },
    { value: 'other', label: '其他', icon: 'circle-dot', emoji: '' }
  ],

  // 排便性状
  stoolConsistencies: [
    { value: 'watery', label: '水样', icon: 'droplet', emoji: '' },
    { value: 'loose', label: '稀便', icon: 'droplet', emoji: '' },
    { value: 'soft', label: '糊状', icon: 'apple', emoji: '' },
    { value: 'formed', label: '成形', icon: 'circle-dot', emoji: '' },
    { value: 'hard', label: '干便', icon: 'square', emoji: '' }
  ],

  // 排便类型
  urinationTypes: [
    { value: 'urine', label: '小便', icon: 'droplet', emoji: '' },
    { value: 'stool', label: '大便', icon: 'droplet', emoji: '' },
    { value: 'diaper', label: '换尿不湿', icon: 'pin', emoji: '' }
  ],

  /**
   * 清洁类型（纯卫生清洁：洗澡/洗头）
   * 注意：抚触、被动操、视觉/听觉训练、皮肤护理等属于"每日护理"范畴，
   * 通过 NURSING_STANDARD 自动生成首页待办，不在此清洁列表中。
   */
  cleanTypes: [
    { value: 'bath', label: '洗澡', icon: 'bath', emoji: '' },
    { value: 'shampoo', label: '洗头', icon: 'hand', emoji: '' },
    { value: 'wash_face', label: '洗脸', icon: 'sparkles', emoji: '' },
    { value: 'nail_trim', label: '剪指甲', icon: 'scissors', emoji: '' }
  ],

  // v73：排便量级（大便）
  stoolAmounts: [
    { value: 'small', label: '小量', icon: 'circle-dot', emoji: '' },
    { value: 'medium', label: '一般', icon: 'circle-dot', emoji: '' },
    { value: 'large', label: '大量', icon: 'circle-dot', emoji: '' }
  ],

  // v73：奶量快捷默认值（母乳瓶喂/配方奶表单）
  feedingAmountPresets: [80, 100, 110, 120, 130, 140, 150],
  feedingAmountStep: 10,   // 加减按钮步长（ml）
  feedingAmountRangeStep: 5, // 滑轨步长（ml）

  // 月龄参考范围
  healthReference: {
    feedingInterval: [
      { weeksMin: 0, weeksMax: 4, intervalMin: 2, intervalMax: 3, unit: '小时', note: '新生儿期，按需喂养' },
      { weeksMin: 4, weeksMax: 12, intervalMin: 2.5, intervalMax: 4, unit: '小时', note: '逐渐建立规律' },
      { weeksMin: 12, weeksMax: 26, intervalMin: 3, intervalMax: 4, unit: '小时', note: '喂养间隔逐渐拉长' },
      { weeksMin: 26, weeksMax: 52, intervalMin: 3.5, intervalMax: 5, unit: '小时', note: '配合辅食调整' }
    ],
    dailyMilkRef: [
      { weeksMin: 0, weeksMax: 1, mlMin: 30, mlMax: 60 },
      { weeksMin: 1, weeksMax: 4, mlMin: 60, mlMax: 90 },
      { weeksMin: 4, weeksMax: 8, mlMin: 90, mlMax: 120 },
      { weeksMin: 8, weeksMax: 12, mlMin: 120, mlMax: 150 },
      { weeksMin: 12, weeksMax: 26, mlMin: 120, mlMax: 180 },
      { weeksMin: 26, weeksMax: 52, mlMin: 150, mlMax: 210 }
    ],
    stoolRef: [
      { weeksMin: 0, weeksMax: 4, min: 2, max: 8, note: '新生儿期排便频繁' },
      { weeksMin: 4, weeksMax: 12, min: 1, max: 5, note: '频率逐渐稳定' },
      { weeksMin: 12, weeksMax: 52, min: 1, max: 3, note: '趋于规律' }
    ],
    tempRef: { min: 36.5, max: 37.5, feverLine: 38.0, note: '腋下体温正常范围36.5-37.5°C' },
    // 每日睡眠时长参考（含夜间+白天小睡；仅作通用参考，个体差异大）
    sleepHoursRef: [
      { weeksMin: 0, weeksMax: 12, hoursMin: 14, hoursMax: 17, note: '0-3月龄' },
      { weeksMin: 12, weeksMax: 52, hoursMin: 12, hoursMax: 15, note: '4-11月龄' },
      { weeksMin: 52, weeksMax: 104, hoursMin: 11, hoursMax: 14, note: '1-2岁' },
      { weeksMin: 104, weeksMax: 9999, hoursMin: 10, hoursMax: 13, note: '2-3岁' }
    ]
  },

  // 体温状态
  tempStatus: {
    low: { max: 36.5, label: '偏低', color: '#1890FF' },
    normal: { max: 37.5, label: '正常', color: '#52C41A' },
    feverLow: { max: 38.5, label: '低热', color: '#FAAD14' },
    feverHigh: { max: 99, label: '高热', color: '#FF4D4F' }
  },

  // 主题颜色（男生喜欢的颜色）
  themeColors: [
    { key: 'blue', label: '天蓝', primary: '#4A90D9', primaryDark: '#357ABD', primaryLight: '#E8F0FE' },
    { key: 'navy', label: '藏青', primary: '#1A237E', primaryDark: '#0D1452', primaryLight: '#E8EAF6' },
    { key: 'teal', label: '青绿', primary: '#00897B', primaryDark: '#00695C', primaryLight: '#E0F2F1' },
    { key: 'indigo', label: '靛蓝', primary: '#3F51B5', primaryDark: '#303F9F', primaryLight: '#E8EAF6' },
    { key: 'forest', label: '森林绿', primary: '#2E7D32', primaryDark: '#1B5E20', primaryLight: '#E8F5E9' },
    { key: 'slate', label: '石板灰', primary: '#455A64', primaryDark: '#37474F', primaryLight: '#ECEFF1' }
  ],

  // 文字大小（R2：新增第 5 档 elder「长辈」21px，长辈模式推荐档）
  textSizes: [
    { key: 'small', label: '小', baseFont: '14px' },
    { key: 'medium', label: '中', baseFont: '15px' },
    { key: 'large', label: '大', baseFont: '17px' },
    { key: 'xlarge', label: '特大', baseFont: '19px' },
    { key: 'elder', label: '长辈', baseFont: '21px' }
  ],

  // 喂养目标默认值
  feedingTargetDefault: 800,

  // 宝宝拟我头像表情包（6种表情）
  emojiPack: [
    { key: 'happy', label: '开心', img: 'img/emoji/emoji-happy.png', emoji: '' },
    { key: 'surprised', label: '惊讶', img: 'img/emoji/emoji-surprised.png', emoji: '' },
    { key: 'thinking', label: '思考', img: 'img/emoji/emoji-thinking.png', emoji: '' },
    { key: 'wink', label: '调皮', img: 'img/emoji/emoji-wink.png', emoji: '' },
    { key: 'sleep', label: '睡觉', img: 'img/emoji/emoji-sleep.png', emoji: '' },
    { key: 'angry', label: '生气', img: 'img/emoji/emoji-angry.png', emoji: '' }
  ],

  // 今日心情选项（使用本地头像资源，不使用 Unicode 图标）
  moodEmojis: [
    { key: 'happy', emoji: '', label: '开心' },
    { key: 'excited', emoji: '', label: '兴奋' },
    { key: 'calm', emoji: '', label: '平静' },
    { key: 'sleepy', emoji: '', label: '困倦' },
    { key: 'sad', emoji: '', label: '难过' },
    { key: 'sick', emoji: '', label: '不适' },
    { key: 'angry', emoji: '', label: '烦躁' }
  ],

  // 功能模块列表
  modules: [
    { key: 'parenting', name: '成长日记', icon: 'baby', desc: '喂养·排便·清洁·健康', color: '#4A90D9', available: true },
    { key: 'milestone', name: '里程碑', icon: 'star', desc: '发育记录·第一次', color: '#FAAD14', available: true },
    { key: 'sleep-management', name: '睡眠管理', icon: 'moon', desc: '睡眠质量·作息管理', color: '#722ED1', available: true },
    { key: 'growth-curve', name: '成长曲线', icon: 'trending-up', desc: '身高·体重·尺码建议', color: '#EB2F96', available: true },
    { key: 'medical', name: '健康管理', icon: 'syringe', desc: '生病用药·疫苗·长牙·常备药', color: '#722ED1', available: true },
    { key: 'footprint', name: '足迹', icon: 'map', desc: '室外活动记录', color: '#13C2C2', available: true },
    { key: 'food', name: '辅食', icon: 'apple', desc: '6-12月辅食表·食谱推荐', color: '#FF7A45', available: true },
    { key: 'exercise', name: '运动发展', icon: 'dumbbell', desc: '大运动训练计划·发育对照', color: '#FA541C', available: true },
    { key: 'early-education', name: '早期教育', icon: 'puzzle', desc: '0-3岁能力训练课·每月20+课', color: '#722ED1', available: true },
    { key: 'language-development', name: '语言发展', icon: 'message-circle', desc: '6-36月词汇·句子·语言环境', color: '#13C2C2', available: true },
    { key: 'social-development', name: '社交发展', icon: 'hand', desc: '12-36月同伴交往·分离焦虑', color: '#52C41A', available: true },
    { key: 'safety', name: '安全与急救', icon: 'shield', desc: '全年龄家居安全·意外记录', color: '#FA541C', available: true },
    // v79 #316：育儿百科已升级为底部导航第 4 个 tab，功能菜单不再重复展示
  ],

  disclaimer: '以上为通用参考区间，个体差异较大，仅供参考，如有担心请咨询儿科医生。',
  maxRecordTime: 15,
  pageSize: 20,

  // ⑪ 渐进发布：灰度开关（P5 · 云端对接说明）
  // 当前本设备开关：?ui=v2 + localStorage.uiVersion（head 内联判定，CSS 注入前生效）
  // 云端接入（P5 发布手册 docs/release-runbook.md）：
  //   grayFamily     —— family 云函数读 family 级 uiVersion 下发，前端落 localStorage.uiVersion 后 reload
  //   forceRollback  —— 紧急全量回退：云函数/运维预写 localStorage.forceRollback='1'，head 内联判定
  //                      优先级最高（无视 ?ui=/uiVersion），一次生效立即全量回 V1；清除后按 uiVersion 恢复
  release: {
    grayFamily: false,    // 家庭级 V2 灰度（云端控制；false=仅本地开关生效）
    forceRollback: false  // 紧急全量回退 V1（云端开关；落地为 localStorage.forceRollback='1'）
  }
};

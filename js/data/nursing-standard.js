/**
 * 0-12月龄每日护理标准
 * 
 * 概念区分：
 * - 清洁（Clean/Hygiene）：纯卫生清洁活动 — 洗澡、洗头
 * - 每日护理（Daily Nursing Care）：照护与发育促进活动 — 抚触按摩、被动操、视觉/听觉训练、皮肤护理等
 * 
 * 本文件定义"每日护理"，按月龄分组，每日5项护理提醒。
 * 每项含：类型、名称、描述、标准、目的、方法、就医信号
 * 
 * 清洁类活动（洗澡/洗头）通过 clean 云函数独立记录，不在此护理标准中。
 */
window.NURSING_STANDARD = [
  {
    monthRange: [0, 1], ageLabel: '0-1月龄', items: [
      { type: 'touch', name: '抚触按摩', desc: '每日1-2次全身抚触', standard: '每次10-15分钟，餐后1小时', purpose: '促进触觉发育，增进亲子关系，帮助消化', method: '室温26-28度，用婴儿油从头部→胸部→腹部→四肢→背部轻柔按摩', warning: '皮肤有破损时暂停' },
      { type: 'skin', name: '脐部护理', desc: '每日清洁脐带残端', standard: '每日1-2次，直至脐带脱落', purpose: '预防脐部感染', method: '用75%酒精或碘伏从脐窝中心向外消毒，保持干燥', warning: '脐部红肿、有脓性分泌物需就医' },
      { type: 'exercise', name: '俯卧练习', desc: '每日清醒时俯卧', standard: '每日2-3次，每次1-2分钟', purpose: '锻炼颈背部肌肉，促进抬头', method: '在清醒、换尿布后进行，大人全程看护', warning: '进食后30分钟内不宜俯卧' },
      { type: 'visual', name: '视觉训练', desc: '黑白卡片注视训练', standard: '每日2-3次，每次1-2分钟', purpose: '促进视觉神经发育', method: '在眼前20-30cm处展示黑白对比卡片，缓慢移动', warning: '不追视需检查' },
      { type: 'auditory', name: '听觉训练', desc: '声音定位训练', standard: '每日2-3次', purpose: '促进听觉发育和声音定位', method: '在耳侧30cm处摇铃或说话，观察转头反应', warning: '对声音无反应需检查听力' }
    ]
  },
  {
    monthRange: [1, 3], ageLabel: '1-3月龄', items: [
      { type: 'touch', name: '抚触按摩', desc: '每日1-2次全身抚触', standard: '每次15-20分钟', purpose: '促进血液循环和触觉发育', method: '配合音乐，从四肢向躯干方向按摩', warning: '皮肤异常时暂停' },
      { type: 'exercise', name: '俯卧抬头', desc: '每日多次俯卧练习', standard: '每日3-4次，每次3-5分钟', purpose: '强化颈背肌肉，促进大运动发育', method: '用玩具在前方吸引抬头', warning: '3个月不能抬头需就医' },
      { type: 'exercise', name: '被动操', desc: '每日1次四肢被动运动', standard: '每次5-10分钟', purpose: '促进关节灵活性和肌肉发育', method: '轻柔地屈伸四肢，做自行车运动', warning: '关节有抵抗或过松需就医' },
      { type: 'visual', name: '追视训练', desc: '彩色玩具追视', standard: '每日2-3次', purpose: '训练眼球运动和颜色感知', method: '用红色或彩色玩具在眼前左右上下移动', warning: '眼球不跟随需就医' },
      { type: 'skin', name: '皮肤护理', desc: '每日检查皮肤褶皱', standard: '每日洗澡后检查', purpose: '预防湿疹、红屁股', method: '保持颈部、腋下、大腿根干燥，涂护臀膏', warning: '严重湿疹或破溃需就医' }
    ]
  },
  {
    monthRange: [3, 6], ageLabel: '3-6月龄', items: [
      { type: 'exercise', name: '翻身练习', desc: '引导从仰卧到俯卧', standard: '每日3-4次', purpose: '促进核心肌群发育', method: '用玩具从侧面引导翻身', warning: '6个月不会翻身需就医' },
      { type: 'exercise', name: '靠坐练习', desc: '用枕头支撑靠坐', standard: '每日2-3次，每次3-5分钟', purpose: '为独坐做准备', method: '靠垫支撑背部，前方放玩具', warning: '6个月不能靠坐需就医' },
      { type: 'fine_motor', name: '抓握训练', desc: '练习主动抓取物体', standard: '每日多次', purpose: '促进手眼协调和精细动作', method: '放不同材质玩具在伸手可及处', warning: '6个月不抓物需就医' },
      { type: 'language', name: '语言互动', desc: '对话和模仿发音', standard: '每日多次', purpose: '促进语言和社交发育', method: '模仿宝宝发音，多说话、唱歌', warning: '6个月不发声需就医' },
      { type: 'touch', name: '抚触按摩', desc: '每日1次全身抚触', standard: '每次15分钟', purpose: '促进触觉和亲子关系', method: '配合儿歌，增加四肢按摩', warning: '宝宝抗拒时暂停' }
    ]
  },
  {
    monthRange: [6, 12], ageLabel: '6-12月龄', items: [
      { type: 'exercise', name: '爬行训练', desc: '鼓励手膝爬行', standard: '每日多次，每次10-15分钟', purpose: '促进四肢协调和核心力量', method: '清除危险物品，用玩具引导前进', warning: '10个月不会爬需就医' },
      { type: 'exercise', name: '扶站扶走', desc: '练习扶物站立和移步', standard: '每日2-3次', purpose: '为独走做准备', method: '沿沙发放玩具引导扶走', warning: '12个月不能扶站需就医' },
      { type: 'fine_motor', name: '捏取训练', desc: '练习拇指食指捏取', standard: '每日多次', purpose: '促进精细动作发育', method: '给小溶豆、小馒头练习捏取', warning: '12个月不会捏取需就医' },
      { type: 'language', name: '语言训练', desc: '教简单词汇和指令', standard: '每日多次', purpose: '促进语言理解与表达', method: '反复命名物品和动作，执行简单指令', warning: '12个月不叫爸妈需观察' },
      { type: 'cognitive', name: '认知游戏', desc: '物体永存和因果游戏', standard: '每日2-3次', purpose: '促进认知和问题解决能力', method: '藏猫猫、套圈、按按钮游戏', warning: '12个月无互动兴趣需观察' }
    ]
  }
];

/**
 * 营养补充建议（按月龄）
 */
window.NUTRITION_STANDARD = [
  { monthRange: [0, 12], items: [
    { name: '维生素D3', dose: '400IU/日', desc: '出生后即开始补充', note: '促进钙吸收，预防佝偻病', warning: '不可过量，每日不超800IU' },
    { name: '维生素AD', dose: '按说明书', desc: '可与D3交替补充', note: '维生素A促进视力和免疫力', warning: 'A/D同时补充需注意总量' }
  ]},
  { monthRange: [6, 12], items: [
    { name: '铁剂', dose: '遵医嘱', desc: '早产儿或缺铁时补充', note: '6个月后母体储存铁耗尽', warning: '需查血常规后遵医嘱补充' },
    { name: 'DHA', dose: '100mg/日', desc: '可从辅食或补充剂获取', note: '促进大脑和视网膜发育', warning: '不过量补充' }
  ]}
];

/**
 * 根据月龄获取护理标准
 */
window.getNursingByAge = function(monthAge) {
  for (const group of NURSING_STANDARD) {
    if (monthAge >= group.monthRange[0] && monthAge <= group.monthRange[1]) {
      return group;
    }
  }
  // 超出范围返回最后一组
  return NURSING_STANDARD[NURSING_STANDARD.length - 1];
};

/**
 * 根据月龄获取护理分组（带月龄标签）
 * 返回 [{ ageLabel, items }] 数组，按推荐月龄段分组
 */
window.getNursingGroupsByAge = function(monthAge) {
  const group = getNursingByAge(monthAge);
  return group ? [{ ageLabel: group.ageLabel, items: group.items }] : [];
};

/**
 * 根据月龄获取营养补充建议
 */
window.getNutritionByAge = function(monthAge) {
  const result = [];
  for (const group of NUTRITION_STANDARD) {
    if (monthAge >= group.monthRange[0] && monthAge <= group.monthRange[1]) {
      result.push(...group.items);
    }
  }
  return result;
};

/**
 * 根据月龄获取营养补充分组（带月龄标签）
 * 返回 [{ ageLabel, items }] 数组，按推荐月龄段分组
 */
window.getNutritionGroupsByAge = function(monthAge) {
  const result = [];
  for (const group of NUTRITION_STANDARD) {
    if (monthAge >= group.monthRange[0] && monthAge <= group.monthRange[1]) {
      result.push({
        ageLabel: group.monthRange[0] + '-' + group.monthRange[1] + '月推荐',
        items: group.items
      });
    }
  }
  return result;
};

/**
 * 获取指定月龄对应的护理项名称集合
 */
window.getNursingNamesForAge = function(monthAge) {
  const group = getNursingByAge(monthAge);
  return new Set((group?.items || []).map(i => i.name));
};

/**
 * 获取指定月龄对应的营养项名称集合
 */
window.getNutritionNamesForAge = function(monthAge) {
  return new Set(getNutritionByAge(monthAge).map(n => n.name));
};

/**
 * 对比两个月龄，找出新增的护理和营养推荐项
 * 返回 { newNursing: [...], newNutrition: [...], currentLabel: 'X-Y月龄' }
 */
window.findNewRecommendations = function(oldMonthAge, newMonthAge) {
  if (oldMonthAge === newMonthAge) return { newNursing: [], newNutrition: [], currentLabel: '' };

  const oldNursingNames = getNursingNamesForAge(oldMonthAge);
  const newNursingGroup = getNursingByAge(newMonthAge);
  const newNursing = (newNursingGroup?.items || []).filter(item => !oldNursingNames.has(item.name));

  const oldNutritionNames = getNutritionNamesForAge(oldMonthAge);
  const newNutrition = getNutritionByAge(newMonthAge).filter(n => !oldNutritionNames.has(n.name));

  return {
    newNursing,
    newNutrition,
    currentLabel: newNursingGroup?.ageLabel || ''
  };
};

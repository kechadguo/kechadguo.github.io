/**
 * 大运动训练计划（运动发展模块）
 * 按月龄分段，数据源：婴幼儿能力训练书（1-36月）大运动课程提炼 + 崔玉涛发育时间表
 * 结构与里程碑互补：里程碑=检查"达到了没"，运动发展=训练"每天做什么"
 */
window.EXERCISE_PLAN = [ /* 可选字段：videoUrl（仅填入已获授权的 HTTPS 视频地址，支持 Bilibili BV 号或 MP4） */
  {
    min: 1, max: 2, label: '1-2月龄', items: [
      { skill: '竖抱与俯卧抬头', goal: '锻炼颈部肌肉，托起头部重量', method: '竖抱时左手托臀右手托头让宝宝看四周；俯卧于床上，用声音玩具在眼前引逗抬头，每天重复数次', duration: '15分钟', freq: '每日2-3次', tip: '满月时竖抱可自行挺直头、俯卧下巴离床2-3cm；仍软若无骨需就医评估' },
      { skill: '抚触', goal: '促进感知发育与亲子联结', method: '洗净双手温热后，用婴儿润肤油从脸、胸、腹到四肢轻柔抚触，边抚边和宝宝说话', duration: '10分钟', freq: '每日1-2次', tip: '选择喂奶后1小时、宝宝清醒时进行；哭闹抗拒则暂停' },
      { skill: '足蹬大球', goal: '锻炼下肢活动能力', method: '将直径约30cm带铃铛的大球放在床尾，让宝宝双脚自由蹬踢，听球响更愿意蹬', duration: '10分钟', freq: '每日1次', tip: '游戏后务必收走大球和塑料袋，防止窒息意外' }
    ]
  },
  {
    min: 3, max: 4, label: '3-4月龄', items: [
      { skill: '肘撑俯卧', goal: '加强颈背力量，为抬头翻身打基础', method: '俯卧时用玩具在宝宝面前约10cm处引逗，引导用手肘支撑抬头，双手压在身下时帮其拿出', duration: '10分钟', freq: '每日2-3次', tip: '会翻身的宝宝不要在无护栏大床上练习，防坠落' },
      { skill: '翻身90°', goal: '练习从仰卧翻到侧卧', method: '用玩具从侧面引逗，握住宝宝肩膀和臀部轻柔帮助翻身，成功后给予拥抱鼓励', duration: '10分钟', freq: '每日2次', tip: '6个月不会任何翻身需就医' },
      { skill: '拉坐', goal: '锻炼颈部与躯干控制力', method: '宝宝仰卧，大人握住其双手腕缓慢拉起至坐位，头颈能随身体抬起不后仰', duration: '5分钟', freq: '每日2次', tip: '拉坐时头明显后仰、身体软塌需就医评估' }
    ]
  },
  {
    min: 5, max: 6, label: '5-6月龄', items: [
      { skill: '翻身180°', goal: '完成仰卧到俯卧的完整翻身', method: '仰卧时用玩具从侧上方引逗，引导宝宝自己用力翻成俯卧，再帮其翻回', duration: '10分钟', freq: '每日2次', tip: '6个月不会翻身需就医' },
      { skill: '靠坐', goal: '练习坐姿平衡', method: '用枕头或靠垫支撑背部让宝宝靠坐，双手前方放玩具玩耍，逐渐减少支撑', duration: '10分钟', freq: '每日2-3次', tip: '8个月不能独坐需就医' },
      { skill: '学坐稳', goal: '从靠坐到独立坐稳', method: '先靠坐，再撤去靠垫让宝宝短时独坐，大人坐其身后保护，两侧放玩具引导转头伸手', duration: '10分钟', freq: '每日2次', tip: '8个月不能独坐需就医' }
    ]
  },
  {
    min: 7, max: 8, label: '7-8月龄', items: [
      { skill: '学爬', goal: '练习匍匐到手膝爬行', method: '前方放玩具引逗，大人用手掌抵住宝宝脚底提供推力，帮他体会向前爬的动作', duration: '15分钟', freq: '每日2-3次', tip: '10个月不会爬需就医' },
      { skill: '扶物站立', goal: '锻炼腿部负重与平衡', method: '让宝宝扶沙发或矮柜站起，在另一端放发声玩具引逗其横移够取', duration: '10分钟', freq: '每日2次', tip: '站立不超过10分钟，双腿未负重能力前避免久站' },
      { skill: '连续翻滚', goal: '练习身体协调与空间感', method: '让宝宝在床上向同一方向连续翻滚，大人轻轻助力并注意保护，可滚动取远处玩具', duration: '10分钟', freq: '每日1-2次', tip: '床面需软硬适中，四周防跌落' }
    ]
  },
  {
    min: 9, max: 10, label: '9-10月龄', items: [
      { skill: '爬上斜坡', goal: '增强四肢协调与爬行耐力', method: '在爬行垫上放一个低矮枕头/垫子当"斜坡"，用玩具引逗宝宝爬越过去', duration: '10分钟', freq: '每日1-2次', tip: '斜坡坡度要小、垫子要稳，全程看护' },
      { skill: '扶物迈步', goal: '练习扶站后的横移迈步', method: '宝宝扶沙发站起后，在另一端放发声玩具，引逗其横跨几步去取', duration: '10分钟', freq: '每日2次', tip: '站约10分钟需帮助坐下休息，避免双腿弯曲' },
      { skill: '牵手迈步', goal: '从扶物走到牵手走', method: '大人牵宝宝双手向前迈步，逐渐过渡到单手，注意让宝宝自己用力而不是被提着走', duration: '10分钟', freq: '每日2次', tip: '14个月不能扶走需就医' }
    ]
  },
  {
    min: 11, max: 12, label: '11-12月龄', items: [
      { skill: '学站稳', goal: '练习独立站立平衡', method: '宝宝扶物站立后，大人轻轻松开保护，让宝宝短时独立站，前后左右放玩具引逗保持平衡', duration: '10分钟', freq: '每日2次', tip: '14个月不能独站需就医' },
      { skill: '练习独走', goal: '迈出独立行走第一步', method: '在宝宝前方1-2米处放玩具，鼓励其放手走过去，成功到达及时表扬；也可让宝宝在两个大人之间来回走', duration: '15分钟', freq: '每日2-3次', tip: '18个月不能独走需就医' },
      { skill: '爬台阶', goal: '练习上下台阶与四肢协调', method: '在低矮楼梯（1-2级）上让宝宝手脚并用爬上爬下，大人贴身保护', duration: '10分钟', freq: '每日1次', tip: '台阶需低矮防滑，全程扶护' }
    ]
  },
  {
    min: 13, max: 15, label: '13-15月龄', items: [
      { skill: '上下楼梯', goal: '练习改变高度后的身体平衡', method: '先学上楼梯（双脚交替、站稳再迈）；下楼梯时大人站在宝宝下方保护，牵其手逐级下', duration: '10分钟', freq: '每日1次', tip: '下楼梯大人必须在下方，防止失手' },
      { skill: '学跑步', goal: '练习自己调整速度并停下来', method: '大人后退跑引逗宝宝追，教其"慢一点、抬头、身体挺直、停"口诀，先学会停止再学跑', duration: '15分钟', freq: '每日1次', tip: '学跑前先教会减速停止，防摔跤' },
      { skill: '学跳', goal: '训练弹跳能力和自信心', method: '扶宝宝双手从最低一级台阶跳下，熟练后改扶单手，再过渡到自己扶栏杆跳', duration: '15分钟', freq: '每日1次', tip: '开始必须双手扶稳，再逐步放手' }
    ]
  },
  {
    min: 16, max: 18, label: '16-18月龄', items: [
      { skill: '向远方抛球', goal: '锻炼上肢力量和投掷动作', method: '准备软皮球，和宝宝对抛，示范从肩后向前抛出，鼓励其模仿，接不住也表扬', duration: '10分钟', freq: '每日1次', tip: '选软球避免砸伤；空间要开阔' },
      { skill: '双足离地跳', goal: '练习双脚同时离地跳', method: '拉宝宝双手喊"1、2、3跳"带其跳起，熟练后改拉单手，再到独立原地跳', duration: '15分钟', freq: '每日1次', tip: '30个月仍不会双脚跳需观察' },
      { skill: '踢球', goal: '锻炼腿部力量与眼脚协调', method: '大人将大皮球停在宝宝脚前，示范抬脚踢球，让球滚动追赶，反复练习', duration: '10分钟', freq: '每日1次', tip: '26个月不会踢球需观察' }
    ]
  },
  {
    min: 19, max: 22, label: '19-22月龄', items: [
      { skill: '走木板', goal: '练习平衡能力', method: '将一块宽约20cm的木板平放地面，牵宝宝手在其上行走，熟练后独立走', duration: '10分钟', freq: '每日1次', tip: '木板贴近地面，防滑固定' },
      { skill: '踢球入门', goal: '练习带球方向控制', method: '在墙上或两个小凳间设"球门"，让宝宝把球踢进球门，大人当守门员配合', duration: '10分钟', freq: '每日1次', tip: '球门要大、球要轻' },
      { skill: '骑木马', goal: '锻炼腰腹与平衡', method: '让宝宝骑在木马或大充气玩具上前后摇动，大人扶稳并伴唱儿歌', duration: '10分钟', freq: '每日1次', tip: '摇动幅度小、地面铺软垫' }
    ]
  },
  {
    min: 23, max: 27, label: '23-27月龄', items: [
      { skill: '走平衡木', goal: '强化平衡与胆量', method: '在地上贴一条胶带或放低矮平衡木，让宝宝沿线行走，熟练后双臂平举走', duration: '10分钟', freq: '每日1次', tip: '高度不超过10cm，大人随行保护' },
      { skill: '接球', goal: '锻炼手眼协调和反应力', method: '与宝宝相距1-2米互相滚球、抛接大软球，从接住到抛出逐步练习', duration: '10分钟', freq: '每日1次', tip: '用大而软的球，从近距开始' },
      { skill: '跳跳跳', goal: '训练弹跳力和落地平衡', method: '爸妈各拉一手喊"1、2、3跳"带宝宝跳远，熟练后单手提拉，再到独立跳过地上的绳/毛巾', duration: '15分钟', freq: '每日1次', tip: '鼓励多种跳法：原地跳、向前跳、兔子跳' }
    ]
  },
  {
    min: 28, max: 30, label: '28-30月龄', items: [
      { skill: '学跳远', goal: '测试弹跳能力和全身协调', method: '父母拉宝宝手腕一起喊"1、2、3跳"使其双脚离地向前跃出，熟练后改牵手、独立跳', duration: '10分钟', freq: '每日1次', tip: '36个月不能单脚站需观察' },
      { skill: '爬上攀登架', goal: '锻炼四肢攀爬力量', method: '在儿童小攀登架或沙发梯级上让宝宝手脚并用向上爬，大人下方随时接护', duration: '10分钟', freq: '每日1次', tip: '必须全程看护，地面铺软垫' },
      { skill: '走椅子', goal: '练习跨步与平衡', method: '将两把小矮凳并排，让宝宝踩着凳面从一张跨到另一张，大人牵手保护', duration: '10分钟', freq: '每日1次', tip: '凳子稳定不晃动，高度以宝宝能轻松跨上为宜' }
    ]
  },
  {
    min: 31, max: 36, label: '31-36月龄', items: [
      { skill: '前后翻滚', goal: '练习前庭觉与身体控制', method: '在软垫上教宝宝低头含胸向前滚翻，大人先示范并托住臀部助力，熟练后独立完成', duration: '10分钟', freq: '每日1次', tip: '软垫要厚，先学会低头再滚翻，防颈部受伤' },
      { skill: '骑三轮车', goal: '训练四肢与躯干协调', method: '扶宝宝坐上三轮车，双脚放踏板、手扶车把，先学向前直行再学转弯，两三周内可学会', duration: '10分钟', freq: '每日1次', tip: '只能在小区无车路段练习，严禁上马路' },
      { skill: '青蛙跳荷叶', goal: '练习连续跳跃', method: '地上放若干圆圈/垫子当"荷叶"，让宝宝学青蛙从一片"荷叶"跳到另一片', duration: '10分钟', freq: '每日1次', tip: '圈距由近到远，地面防滑' }
    ]
  }
];

/**
 * 根据月龄获取训练计划段
 * @param {number} monthAge
 * @returns {object|null} {plan, index}
 */
window.getExercisePlan = function(monthAge) {
  if (monthAge < 1) return { plan: EXERCISE_PLAN[0], index: 0 };
  for (let i = 0; i < EXERCISE_PLAN.length; i++) {
    if (monthAge >= EXERCISE_PLAN[i].min && monthAge <= EXERCISE_PLAN[i].max) {
      return { plan: EXERCISE_PLAN[i], index: i };
    }
  }
  return { plan: EXERCISE_PLAN[EXERCISE_PLAN.length - 1], index: EXERCISE_PLAN.length - 1 };
};

/**
 * 今日练习打卡（localStorage）
 * key: exercise-check-YYYYMMDD → JSON 数组 [skill, ...]
 */
window.ExerciseCheck = {
  _key(today) {
    const d = today || new Date();
    const p = (n) => (n < 10 ? '0' + n : '' + n);
    return 'exercise-check-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  },
  get(today) {
    try { return JSON.parse(localStorage.getItem(this._key(today)) || '[]'); }
    catch (e) { return []; }
  },
  add(skill, today) {
    const list = this.get(today);
    if (!list.includes(skill)) list.push(skill);
    localStorage.setItem(this._key(today), JSON.stringify(list));
  },
  remove(skill, today) {
    const list = this.get(today).filter(s => s !== skill);
    localStorage.setItem(this._key(today), JSON.stringify(list));
  },
  has(skill, today) {
    return this.get(today).includes(skill);
  },
  count(today) {
    return this.get(today).length;
  }
};

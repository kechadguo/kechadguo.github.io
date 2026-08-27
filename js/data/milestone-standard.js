/**
 * 0-36月龄发育里程碑标准
 * 按月龄分组，每项含：领域、能力、描述、达标月龄、训练建议、就医信号
 * 领域：大运动 / 精细动作 / 语言 / 认知 / 社交 / 视觉 / 听觉 / 自理 / 数学 / 艺术
 * v75 扩展：补 14-36 月龄组 + 自理/数学/艺术维度 + 感知细化；新增出牙/大运动时间表（v83 合并）
 */
window.MILESTONE_STANDARD = [
  {
    month: 1, ageLabel: '1月龄', items: [
      { domain: '大运动', skill: '俯卧抬头', desc: '俯卧时能短暂抬头离开床面', targetMonth: 1, training: '每日俯卧练习2-3次，每次1-2分钟', warning: '3个月仍不能抬头需就医' },
      { domain: '大运动', skill: '四肢活动', desc: '四肢能自由屈伸，有踏步反射', targetMonth: 1, training: '做被动操，活动四肢关节', warning: '四肢僵硬或松软无力需就医' },
      { domain: '视觉', skill: '注视人脸', desc: '能注视距离20-30cm的人脸或物体', targetMonth: 1, training: '用黑白卡片或人脸在眼前缓慢移动', warning: '不追视物体需就医' },
      { domain: '听觉', skill: '对声音有反应', desc: '听到声音会眨眼、惊跳或安静', targetMonth: 1, training: '在耳侧摇铃观察反应', warning: '对声音无反应需检查听力' },
      { domain: '社交', skill: '自发微笑', desc: '睡眠中或舒适时会自发微笑', targetMonth: 1, training: '多与宝宝面对面交流', warning: '无任何微笑需观察' }
    ]
  },
  {
    month: 2, ageLabel: '2月龄', items: [
      { domain: '大运动', skill: '抬头45度', desc: '俯卧时能抬头约45度并坚持片刻', targetMonth: 2, training: '增加俯卧时间到每次3-5分钟', warning: '3个月不能抬头45度需就医' },
      { domain: '精细动作', skill: '抓握反射', desc: '能抓住放入手中的物体', targetMonth: 2, training: '将摇铃放入手中让其抓握', warning: '不会抓握需观察' },
      { domain: '语言', skill: '发出a/o声', desc: '能发出"啊""哦"等元音', targetMonth: 2, training: '模仿宝宝发音，多对话', warning: '4个月无发声需就医' },
      { domain: '社交', skill: '社交微笑', desc: '看到人脸时微笑回应', targetMonth: 2, training: '多微笑面对宝宝', warning: '4个月不会社交微笑需就医' },
      { domain: '视觉', skill: '追视物体', desc: '眼睛能跟随移动的物体转动', targetMonth: 2, training: '用彩色玩具在眼前移动', warning: '不追视需就医' }
    ]
  },
  {
    month: 3, ageLabel: '3月龄', items: [
      { domain: '大运动', skill: '抬头90度', desc: '俯卧时能用前臂支撑抬头90度', targetMonth: 3, training: '俯卧时用玩具吸引抬头', warning: '4个月不能抬头90度需就医' },
      { domain: '大运动', skill: '翻身准备', desc: '能从侧卧转到仰卧或反之', targetMonth: 3, training: '帮助宝宝练习翻身动作', warning: '6个月不会翻身需就医' },
      { domain: '精细动作', skill: '双手互握', desc: '能将双手放到胸前互相握住', targetMonth: 3, training: '引导宝宝看手、玩手', warning: '5个月双手不协调需观察' },
      { domain: '语言', skill: '笑出声', desc: '能大声笑出声', targetMonth: 3, training: '逗引宝宝大笑', warning: '5个月不会笑出声需观察' },
      { domain: '认知', skill: '认出妈妈', desc: '看到妈妈表现出兴奋', targetMonth: 3, training: '多与宝宝互动', warning: '6个月不认人需观察' }
    ]
  },
  {
    month: 4, ageLabel: '4月龄', items: [
      { domain: '大运动', skill: '翻身', desc: '能从仰卧翻到俯卧', targetMonth: 4, training: '用玩具引导翻身', warning: '6个月不会翻身需就医' },
      { domain: '大运动', skill: '扶坐', desc: '扶着腋下能坐稳，头不晃', targetMonth: 4, training: '靠坐练习，用枕头支撑', warning: '6个月不能扶坐需就医' },
      { domain: '精细动作', skill: '主动抓物', desc: '能主动伸手抓取眼前物体', targetMonth: 4, training: '放玩具在伸手可及处', warning: '6个月不主动抓物需就医' },
      { domain: '语言', skill: '咿呀对话', desc: '能发出辅音+元音组合', targetMonth: 4, training: '回应宝宝的咿呀声', warning: '6个月不发声需就医' }
    ]
  },
  {
    month: 5, ageLabel: '5月龄', items: [
      { domain: '大运动', skill: '独坐片刻', desc: '能独坐几秒钟不倒', targetMonth: 5, training: '增加靠坐时间，逐渐减少支撑', warning: '7个月不能独坐需就医' },
      { domain: '精细动作', skill: '双手传递', desc: '能将物体从一只手换到另一只手', targetMonth: 5, training: '给宝宝两个玩具引导换手', warning: '7个月不会换手需观察' },
      { domain: '认知', skill: '叫名有反应', desc: '叫名字时会转头看', targetMonth: 5, training: '经常叫宝宝名字', warning: '7个月叫名无反应需就医' },
      { domain: '认知', skill: '找掉落物', desc: '东西掉落后会去找', targetMonth: 5, training: '故意让玩具掉落观察反应', warning: '8个月不找掉落物需观察' }
    ]
  },
  {
    month: 6, ageLabel: '6月龄', items: [
      { domain: '大运动', skill: '独坐稳', desc: '能独坐1分钟以上', targetMonth: 6, training: '多练习独坐，周围放靠垫', warning: '8个月不能独坐需就医' },
      { domain: '大运动', skill: '匍匐前进', desc: '俯卧时能向前匍匐移动', targetMonth: 6, training: '用玩具在前方吸引爬行', warning: '9个月不会爬需就医' },
      { domain: '精细动作', skill: '拇指抓握', desc: '能用拇指和其他指捏取小物', targetMonth: 6, training: '给小饼干练习捏取', warning: '9个月不会捏取需就医' },
      { domain: '语言', skill: '无意识叫ba/ma', desc: '能发出"baba""mama"等音', targetMonth: 6, training: '多示范"baba""mama"发音', warning: '9个月无辅音发声需观察' },
      { domain: '认知', skill: '认生', desc: '对陌生人有害怕或回避反应', targetMonth: 6, training: '逐渐增加与外人接触', warning: '过度认生影响社交需观察' }
    ]
  },
  {
    month: 8, ageLabel: '8月龄', items: [
      { domain: '大运动', skill: '爬行', desc: '能手膝并用爬行', targetMonth: 8, training: '清除危险物品，鼓励爬行探索', warning: '10个月不会爬需就医' },
      { domain: '大运动', skill: '扶站', desc: '扶着物体能站立', targetMonth: 8, training: '在沙发旁放玩具引导扶站', warning: '10个月不能扶站需就医' },
      { domain: '精细动作', skill: '拇指食指捏取', desc: '能用拇指和食指精确捏取小物', targetMonth: 8, training: '给小馒头、溶豆练习', warning: '12个月不会捏取需就医' },
      { domain: '语言', skill: '理解"不"', desc: '听到"不"会停止动作', targetMonth: 8, training: '用"不"引导停止危险行为', warning: '12个月不理解"不"需观察' },
      { domain: '认知', skill: '物体永存', desc: '知道被遮挡的物体仍然存在', targetMonth: 8, training: '用毛巾盖玩具让其寻找', warning: '12个月无物体永存概念需观察' }
    ]
  },
  {
    month: 10, ageLabel: '10月龄', items: [
      { domain: '大运动', skill: '扶走', desc: '扶着沙发或桌子能走几步', targetMonth: 10, training: '沿沙发放玩具引导扶走', warning: '14个月不能扶走需就医' },
      { domain: '大运动', skill: '独站', desc: '能独站片刻不扶', targetMonth: 10, training: '鼓励独站练习', warning: '14个月不能独站需就医' },
      { domain: '精细动作', skill: '用杯喝水', desc: '能双手捧杯喝水（需帮助）', targetMonth: 10, training: '用学饮杯练习', warning: '15个月不会用杯需观察' },
      { domain: '语言', skill: '有意识叫爸妈', desc: '看到爸爸/妈妈能正确叫"baba""mama"', targetMonth: 10, training: '反复示范正确称呼', warning: '12个月不叫爸妈需观察' },
      { domain: '社交', skill: '挥手再见', desc: '能模仿挥手再见', targetMonth: 10, training: '出门进门时示范挥手', warning: '12个月不会模仿动作需观察' }
    ]
  },
  {
    month: 12, ageLabel: '12月龄', items: [
      { domain: '大运动', skill: '独走', desc: '能独立行走几步', targetMonth: 12, training: '在短距离内鼓励独走', warning: '18个月不能独走需就医' },
      { domain: '精细动作', skill: '翻书', desc: '能翻厚纸板书页', targetMonth: 12, training: '一起看绘本练习翻页', warning: '18个月不会翻书需观察' },
      { domain: '语言', skill: '说2-3个词', desc: '能有意识说2-3个有意义的词', targetMonth: 12, training: '反复命名日常物品', warning: '18个月词汇量不足需就医' },
      { domain: '认知', skill: '执行简单指令', desc: '能执行"把XX给我"等指令', targetMonth: 12, training: '给简单指令让宝宝执行', warning: '18个月不听指令需就医' },
      { domain: '社交', skill: '指物分享', desc: '能用手指指向感兴趣的物体分享', targetMonth: 12, training: '问"XX在哪"引导指物', warning: '18个月不指物分享需就医' }
    ]
  }
,
  {
    month: 14, ageLabel: '13-15月龄', items: [
      { domain: '大运动', skill: '独走稳', desc: '能独立行走自如，途中能停下转身', targetMonth: 14, training: '在开阔空间多走，走稳后练习蹲下站起', warning: '18个月仍走不稳需就医' },
      { domain: '大运动', skill: '蹲下捡物', desc: '能蹲下捡起地上的玩具再站起', targetMonth: 14, training: '地上放玩具引导蹲起练习', warning: '18个月不会蹲起需观察' },
      { domain: '精细动作', skill: '放物入瓶', desc: '能将小物放入瓶中再倒出来', targetMonth: 14, training: '玩"投物入瓶"游戏锻炼手眼协调', warning: '18个月不会放物入瓶需观察' },
      { domain: '语言', skill: '说3-5个词', desc: '能说3-5个有意义的词', targetMonth: 14, training: '命名日常物品并让宝宝跟说', warning: '18个月词汇不足需就医' },
      { domain: '认知', skill: '指认身体部位', desc: '能指出眼、鼻、口、手等部位', targetMonth: 14, training: '唱"五官歌"边指边认', warning: '18个月不会指五官需观察' },
      { domain: '视觉', skill: '认出照片家人', desc: '能从照片中认出家人', targetMonth: 14, training: '一起翻相册指认家人', warning: '20个月不认照片需观察' },
      { domain: '社交', skill: '模仿动作', desc: '能模仿拍手、摇头、再见等动作', targetMonth: 14, training: '多做示范动作让宝宝模仿', warning: '18个月不模仿动作需观察' },
      { domain: '自理', skill: '用勺吃饭', desc: '能自己用小勺吃饭（会有撒漏）', targetMonth: 14, training: '提供防滑碗勺，鼓励自己吃', warning: '18个月完全不会用勺需观察' }
    ]
  },
  {
    month: 18, ageLabel: '16-18月龄', items: [
      { domain: '大运动', skill: '上台阶', desc: '能扶着栏杆或大人的手上台阶', targetMonth: 18, training: '多练习上台阶，家长在旁保护', warning: '20个月不能上台阶需观察' },
      { domain: '精细动作', skill: '搭积木', desc: '能叠起3-4块积木', targetMonth: 18, training: '示范搭高塔让宝宝模仿', warning: '24个月搭不到3块需就医' },
      { domain: '语言', skill: '说短语', desc: '能说"妈妈抱""吃饭"等2-3字短语', targetMonth: 18, training: '用短语回应宝宝，逐步扩充表达', warning: '24个月无短语需就医' },
      { domain: '认知', skill: '认识形状', desc: '能认识圆形、方形、三角形', targetMonth: 18, training: '用形状配对玩具练习', warning: '24个月不认识常见形状需观察' },
      { domain: '听觉', skill: '两步指令', desc: '能执行"先…再…"两步指令', targetMonth: 18, training: '用两步指令安排小任务', warning: '24个月听不懂两步指令需观察' },
      { domain: '社交', skill: '平行游戏', desc: '能和小朋友各玩各的（平行游戏）', targetMonth: 18, training: '创造与同龄玩伴相处的机会', warning: '24个月完全回避同龄人需观察' },
      { domain: '自理', skill: '脱鞋袜', desc: '能自己脱鞋、脱袜子', targetMonth: 18, training: '换鞋袜时让宝宝自己脱', warning: '24个月不会脱鞋袜需观察' },
      { domain: '艺术', skill: '涂鸦', desc: '能握笔在纸上随意涂画', targetMonth: 18, training: '提供安全画笔，自由涂鸦不纠正', warning: '24个月无涂鸦兴趣需观察' }
    ]
  },
  {
    month: 22, ageLabel: '19-22月龄', items: [
      { domain: '大运动', skill: '踢球', desc: '能用脚踢大球', targetMonth: 22, training: '与宝宝互踢皮球锻炼腿部力量', warning: '26个月不会踢球需观察' },
      { domain: '精细动作', skill: '穿珠', desc: '能把大珠子穿成串', targetMonth: 22, training: '提供大孔珠子引导穿线', warning: '26个月不会穿珠需观察' },
      { domain: '语言', skill: '说短句', desc: '能说3-5个字的句子', targetMonth: 22, training: '日常对话中扩充句子长度', warning: '26个月无短句需就医' },
      { domain: '数学', skill: '比高矮大小', desc: '能比较出两个物品的高矮和大小', targetMonth: 22, training: '用重叠法玩"谁高谁矮"游戏', warning: '26个月不会比大小需观察' },
      { domain: '数学', skill: '数数1-3', desc: '能手口一致点数1-3', targetMonth: 22, training: '上下楼梯时一起数台阶', warning: '28个月不会点数需观察' },
      { domain: '艺术', skill: '哼唱', desc: '能哼唱熟悉的歌曲片段', targetMonth: 22, training: '常放儿歌并一起哼唱', warning: '26个月对音乐无反应需观察' },
      { domain: '自理', skill: '自己吃饭', desc: '能用小勺基本自己吃完一餐', targetMonth: 22, training: '坚持让宝宝自己吃，不代劳', warning: '26个月完全不会用勺需观察' },
      { domain: '社交', skill: '称呼家人', desc: '能正确叫出家庭成员的称呼', targetMonth: 22, training: '见面时示范称呼，及时纠音', warning: '26个月不会称呼家人需就医' }
    ]
  },
  {
    month: 26, ageLabel: '23-27月龄', items: [
      { domain: '大运动', skill: '双脚跳', desc: '能双脚同时离地跳起', targetMonth: 26, training: '玩"小兔子跳"游戏', warning: '30个月不会双脚跳需观察' },
      { domain: '大运动', skill: '骑小车', desc: '能骑三轮小车或平衡车前行', targetMonth: 26, training: '提供适龄小三轮车练习', warning: '30个月不会骑需观察' },
      { domain: '精细动作', skill: '画直线', desc: '能模仿画直线和横线', targetMonth: 26, training: '示范画线并让宝宝跟画', warning: '30个月不会画线需观察' },
      { domain: '语言', skill: '说完整句', desc: '能说4-6个字的完整短句', targetMonth: 26, training: '多与宝宝对话，示范完整句', warning: '30个月无完整句需就医' },
      { domain: '数学', skill: '认数字1-5', desc: '能认识1-5的数字', targetMonth: 26, training: '用数字卡片、门牌号认读', warning: '32个月不认识1-5需观察' },
      { domain: '自理', skill: '刷牙', desc: '能在大人帮助下刷牙', targetMonth: 26, training: '早晚示范刷牙，让宝宝模仿', warning: '30个月完全抗拒刷牙需观察' },
      { domain: '艺术', skill: '手指谣', desc: '能跟着童谣做简单手指动作', targetMonth: 26, training: '每日玩"手指歌"游戏', warning: '30个月不参与手指游戏需观察' },
      { domain: '社交', skill: '分享玩具', desc: '开始愿意把玩具分享给他人', targetMonth: 26, training: '示范轮流玩，及时表扬分享行为', warning: '持续独占玩具需引导观察' }
    ]
  },
  {
    month: 30, ageLabel: '28-30月龄', items: [
      { domain: '大运动', skill: '单脚站', desc: '能单脚站立片刻（2-3秒）', targetMonth: 30, training: '扶物练习单脚站', warning: '36个月不能单脚站需观察' },
      { domain: '大运动', skill: '交替脚上楼梯', desc: '能双脚交替上楼梯', targetMonth: 30, training: '鼓励交替步上楼梯', warning: '36个月不会交替步需观察' },
      { domain: '精细动作', skill: '用剪刀', desc: '能用儿童剪刀沿直线剪纸条', targetMonth: 30, training: '提供安全剪刀练习剪纸', warning: '36个月不会剪纸需观察' },
      { domain: '语言', skill: '说代词', desc: '能正确使用"我""你"等代词', targetMonth: 30, training: '对话中示范代词用法', warning: '36个月不会用"我"需就医' },
      { domain: '数学', skill: '数数1-10', desc: '能手口一致数到10', targetMonth: 30, training: '数玩具、数台阶练习', warning: '36个月数不到5需观察' },
      { domain: '数学', skill: '认识5种形状', desc: '认识圆、方、三角、椭圆、长方形', targetMonth: 30, training: '拼图嵌板认识形状', warning: '36个月认识不足3种形状需观察' },
      { domain: '视觉', skill: '辨基本色', desc: '能认出红、黄、蓝等基本色', targetMonth: 30, training: '颜色配对游戏', warning: '36个月不认识基本色需观察' },
      { domain: '自理', skill: '表达便意', desc: '白天能主动表达大小便需求', targetMonth: 30, training: '定时提醒如厕，及时表扬', warning: '36个月无如厕意识需观察' },
      { domain: '艺术', skill: '画圆', desc: '能画出近似圆形', targetMonth: 30, training: '一起画"太阳""气球"', warning: '36个月不会画封闭圆需观察' }
    ]
  },
  {
    month: 36, ageLabel: '31-36月龄', items: [
      { domain: '大运动', skill: '单脚跳', desc: '能单脚跳2-3步', targetMonth: 36, training: '玩"单脚跳格子"游戏', warning: '40个月不能单脚跳需就医' },
      { domain: '大运动', skill: '交替脚上下楼', desc: '不扶栏杆能双脚交替上下楼梯', targetMonth: 36, training: '多走楼梯锻炼平衡', warning: '42个月不会交替步需观察' },
      { domain: '精细动作', skill: '自己穿脱衣', desc: '能自己穿脱简单衣物', targetMonth: 36, training: '选择宽松易穿脱的衣物让宝宝练习', warning: '42个月不会穿脱衣需观察' },
      { domain: '语言', skill: '讲故事', desc: '能说简单句子描述一件事或讲简短故事', targetMonth: 36, training: '睡前故事后让宝宝复述', warning: '42个月语言表达明显落后需就医' },
      { domain: '数学', skill: '数数1-20', desc: '能手口一致数到20', targetMonth: 36, training: '日常点数练习', warning: '42个月数不到10需观察' },
      { domain: '数学', skill: '比多少', desc: '能比较两组物品的多少', targetMonth: 36, training: '分水果时让宝宝参与分配', warning: '42个月不会比多少需观察' },
      { domain: '自理', skill: '独立如厕', desc: '白天基本独立如厕（自己穿脱裤）', targetMonth: 36, training: '鼓励自己完成如厕流程', warning: '42个月仍经常尿裤需就医' },
      { domain: '艺术', skill: '画人像', desc: '能画出头+身体+四肢的简单人像', targetMonth: 36, training: '一起画"全家福"', warning: '42个月只会乱涂无形象需观察' },
      { domain: '社交', skill: '合作游戏', desc: '能与小朋友合作玩追跑、过家家', targetMonth: 36, training: '组织小伙伴一起游戏', warning: '42个月无法参与集体游戏需就医' }
    ]
  }
];

/**
 * 乳牙萌出顺序表（崔玉涛育儿百科）
 * 注意：出牙顺序和节奏个体差异大；第一颗乳牙在 13 个月内萌出均属正常，2-3 岁 20 颗乳牙长齐。
 */
window.TEETH_SCHEDULE = [
  { order: 1, name: '下中切牙（下门牙）', months: '6-10月', desc: '通常最先萌出，常成对出现' },
  { order: 2, name: '上中切牙（上门牙）', months: '8-12月', desc: '下门牙萌出后约 1-4 个月长出' },
  { order: 3, name: '上侧切牙', months: '9-13月', desc: '上门牙两侧的牙齿' },
  { order: 4, name: '下侧切牙', months: '10-16月', desc: '下门牙两侧的牙齿' },
  { order: 5, name: '第一乳磨牙', months: '12-18月', desc: '位置靠后的槽牙' },
  { order: 6, name: '尖牙（犬齿）', months: '16-24月', desc: '门牙与乳磨牙之间的尖牙' },
  { order: 7, name: '第二乳磨牙', months: '24-30月', desc: '最后萌出，2-3 岁 20 颗乳牙长齐' }
];

/**
 * 大运动发育时间表（崔玉涛育儿百科 6 项 + 学步后补充）
 * range：正常发育范围；majority：绝大多数宝宝掌握的时间段
 * 落在范围外才提示就医，个体差异大，不必强求超前
 */
window.GROSS_MOTOR_TIMELINE = [
  { skill: '俯卧抬头', range: '1-3月', majority: '1-2月', note: '从短暂抬头到抬头 90 度' },
  { skill: '翻身', range: '3-7月', majority: '4-6月', note: '先学会从仰卧翻到侧卧' },
  { skill: '独坐', range: '5-9月', majority: '6-8月', note: '靠坐→扶坐→独坐' },
  { skill: '爬行', range: '7-11月', majority: '8-10月', note: '匍匐→手膝爬行' },
  { skill: '扶站/独站', range: '8-12月', majority: '9-11月', note: '扶物站立→独站片刻' },
  { skill: '独走', range: '10-18月', majority: '12-15月', note: '扶走→独走几步→走稳' },
  { skill: '跑', range: '18-24月', majority: '20-24月', note: '快步走→小跑' },
  { skill: '双脚跳', range: '24-30月', majority: '26-30月', note: '双脚同时离地跳起' },
  { skill: '单脚站/跳', range: '30-36月', majority: '33-36月', note: '单脚站立→单脚跳' }
];

/**
 * 根据月龄获取里程碑
 * @param {number} monthAge
 * @returns {{ current: [], next: [] }}
 */
window.getMilestoneByAge = function(monthAge) {
  const m = Math.max(1, Math.floor(monthAge || 0));
  const passed = [];
  const future = [];

  for (const group of MILESTONE_STANDARD) {
    if (group.month <= m) passed.push(group);
    else future.push(group);
  }

  const currentGroup = passed.pop() || MILESTONE_STANDARD[0];
  return { previous: passed, current: [currentGroup], next: future };
};

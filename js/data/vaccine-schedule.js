/**
 * 疫苗免疫程序表（0-6岁）
 * 数据来源：国家卫生健康委员会《国家免疫规划疫苗儿童免疫程序表》及相关二类疫苗说明书
 * category: '一类' = 免费/国家免疫规划疫苗, '二类' = 自费/自愿接种疫苗
 * 月龄 = 接种时宝宝的月龄
 */
window.VACCINE_SCHEDULE = [
  { month: 0, ageLabel: '出生时', vaccines: [
    { name: '乙肝疫苗', dose: '第1剂', fullCode: 'HepB1', category: '一类', prevent: '乙型病毒性肝炎', route: '肌内注射', site: '上臂外侧三角肌', reaction: '少数可出现发热、局部红肿', emergency: '高热不退需就医' },
    { name: '卡介苗', dose: '第1剂', fullCode: 'BCG1', category: '一类', prevent: '结核病', route: '皮内注射', site: '上臂三角肌中部略下处', reaction: '局部溃疡、小脓包属正常反应', emergency: '淋巴结肿大超1cm需就医' }
  ]},
  { month: 1, ageLabel: '1月龄', vaccines: [
    { name: '乙肝疫苗', dose: '第2剂', fullCode: 'HepB2', category: '一类', prevent: '乙型病毒性肝炎', route: '肌内注射', site: '上臂外侧三角肌', reaction: '少数发热', emergency: '持续高热需就医' }
  ]},
  { month: 2, ageLabel: '2月龄', vaccines: [
    { name: '脊灰灭活疫苗', dose: '第1剂', fullCode: 'IPV1', category: '一类', prevent: '脊髓灰质炎', route: '肌内注射', site: '大腿前外侧', reaction: '少数发热、局部红肿', emergency: '过敏反应需立即就医' },
    { name: '五联疫苗', dose: '第1剂', fullCode: 'DTaP-IPV-Hib1', category: '二类', prevent: '百日咳、白喉、破伤风、脊髓灰质炎、b型流感嗜血杆菌感染', route: '肌内注射', site: '大腿前外侧', reaction: '少数发热、局部红肿', emergency: '高热惊厥需立即就医' },
    { name: '五价轮状病毒疫苗', dose: '第1剂', fullCode: 'RV5-1', category: '二类', prevent: '轮状病毒胃肠炎(G1/G2/G3/G4/G9型)', route: '口服', site: '口服', reaction: '少数轻微腹泻、呕吐', emergency: '持续腹泻脱水需就医' },
    { name: '13价肺炎球菌结合疫苗', dose: '第1剂', fullCode: 'PCV13-1', category: '二类', prevent: '13种血清型肺炎球菌引起的感染', route: '肌内注射', site: '大腿前外侧', reaction: '少数发热、局部红肿', emergency: '过敏反应需立即就医' }
  ]},
  { month: 3, ageLabel: '3月龄', vaccines: [
    { name: '脊灰减毒活疫苗', dose: '第2剂', fullCode: 'OPV2', category: '一类', prevent: '脊髓灰质炎', route: '口服', site: '口服', reaction: '少数轻度腹泻', emergency: '腹泻严重需就医' },
    { name: '百白破疫苗', dose: '第1剂', fullCode: 'DTaP1', category: '一类', prevent: '百日咳、白喉、破伤风', route: '肌内注射', site: '大腿前外侧', reaction: '发热、局部红肿硬结', emergency: '高热惊厥需立即就医' },
    { name: '五联疫苗', dose: '第2剂', fullCode: 'DTaP-IPV-Hib2', category: '二类', prevent: '百日咳、白喉、破伤风、脊髓灰质炎、b型流感嗜血杆菌感染', route: '肌内注射', site: '大腿前外侧', reaction: '少数发热、局部红肿', emergency: '高热惊厥需立即就医' }
  ]},
  { month: 4, ageLabel: '4月龄', vaccines: [
    { name: '脊灰减毒活疫苗', dose: '第3剂', fullCode: 'OPV3', category: '一类', prevent: '脊髓灰质炎', route: '口服', site: '口服', reaction: '少数轻度腹泻', emergency: '腹泻严重需就医' },
    { name: '百白破疫苗', dose: '第2剂', fullCode: 'DTaP2', category: '一类', prevent: '百日咳、白喉、破伤风', route: '肌内注射', site: '大腿前外侧', reaction: '发热、局部红肿', emergency: '高热惊厥需立即就医' },
    { name: '五联疫苗', dose: '第3剂', fullCode: 'DTaP-IPV-Hib3', category: '二类', prevent: '百日咳、白喉、破伤风、脊髓灰质炎、b型流感嗜血杆菌感染', route: '肌内注射', site: '大腿前外侧', reaction: '少数发热、局部红肿', emergency: '高热惊厥需立即就医' },
    { name: '五价轮状病毒疫苗', dose: '第2剂', fullCode: 'RV5-2', category: '二类', prevent: '轮状病毒胃肠炎(G1/G2/G3/G4/G9型)', route: '口服', site: '口服', reaction: '少数轻微腹泻、呕吐', emergency: '持续腹泻脱水需就医' },
    { name: '13价肺炎球菌结合疫苗', dose: '第2剂', fullCode: 'PCV13-2', category: '二类', prevent: '13种血清型肺炎球菌引起的感染', route: '肌内注射', site: '大腿前外侧', reaction: '少数发热、局部红肿', emergency: '过敏反应需立即就医' }
  ]},
  { month: 5, ageLabel: '5月龄', vaccines: [
    { name: '百白破疫苗', dose: '第3剂', fullCode: 'DTaP3', category: '一类', prevent: '百日咳、白喉、破伤风', route: '肌内注射', site: '大腿前外侧', reaction: '发热、局部红肿', emergency: '高热惊厥需立即就医' }
  ]},
  { month: 6, ageLabel: '6月龄', vaccines: [
    { name: '乙肝疫苗', dose: '第3剂', fullCode: 'HepB3', category: '一类', prevent: '乙型病毒性肝炎', route: '肌内注射', site: '上臂外侧三角肌', reaction: '少数发热', emergency: '持续高热需就医' },
    { name: 'A群流脑多糖疫苗', dose: '第1剂', fullCode: 'MPSV-A1', category: '一类', prevent: '流行性脑脊髓膜炎', route: '皮下注射', site: '上臂三角肌', reaction: '少数发热、局部红肿', emergency: '过敏反应需就医' },
    { name: '五价轮状病毒疫苗', dose: '第3剂', fullCode: 'RV5-3', category: '二类', prevent: '轮状病毒胃肠炎(G1/G2/G3/G4/G9型)', route: '口服', site: '口服', reaction: '少数轻微腹泻、呕吐', emergency: '持续腹泻脱水需就医' },
    { name: '13价肺炎球菌结合疫苗', dose: '第3剂', fullCode: 'PCV13-3', category: '二类', prevent: '13种血清型肺炎球菌引起的感染', route: '肌内注射', site: '大腿前外侧', reaction: '少数发热、局部红肿', emergency: '过敏反应需立即就医' }
  ]},
  { month: 8, ageLabel: '8月龄', vaccines: [
    { name: '麻风疫苗', dose: '第1剂', fullCode: 'MR1', category: '一类', prevent: '麻疹、风疹', route: '皮下注射', site: '上臂三角肌', reaction: '接种后6-10天可能发热、皮疹', emergency: '高热持续3天以上需就医' },
    { name: '乙脑减毒活疫苗', dose: '第1剂', fullCode: 'JE-L1', category: '一类', prevent: '流行性乙型脑炎', route: '皮下注射', site: '上臂三角肌', reaction: '少数发热、皮疹', emergency: '持续高热需就医' }
  ]},
  { month: 9, ageLabel: '9月龄', vaccines: [
    { name: 'A群流脑多糖疫苗', dose: '第2剂', fullCode: 'MPSV-A2', category: '一类', prevent: '流行性脑脊髓膜炎', route: '皮下注射', site: '上臂三角肌', reaction: '少数发热', emergency: '过敏反应需就医' }
  ]},
  { month: 12, ageLabel: '12月龄', vaccines: [
    { name: '13价肺炎球菌结合疫苗', dose: '第4剂(加强)', fullCode: 'PCV13-4', category: '二类', prevent: '13种血清型肺炎球菌引起的感染', route: '肌内注射', site: '上臂三角肌', reaction: '少数发热、局部红肿', emergency: '过敏反应需立即就医' }
  ]},
  { month: 18, ageLabel: '18月龄', vaccines: [
    { name: '百白破疫苗', dose: '第4剂(加强)', fullCode: 'DTaP4', category: '一类', prevent: '百日咳、白喉、破伤风', route: '肌内注射', site: '上臂三角肌', reaction: '局部红肿硬结', emergency: '高热需就医' },
    { name: '麻腮风疫苗', dose: '第1剂', fullCode: 'MMR1', category: '一类', prevent: '麻疹、流行性腮腺炎、风疹', route: '皮下注射', site: '上臂三角肌', reaction: '接种后6-12天可能发热', emergency: '高热惊厥需就医' },
    { name: '五联疫苗', dose: '第4剂(加强)', fullCode: 'DTaP-IPV-Hib4', category: '二类', prevent: '百日咳、白喉、破伤风、脊髓灰质炎、b型流感嗜血杆菌感染', route: '肌内注射', site: '上臂三角肌', reaction: '少数发热、局部红肿', emergency: '高热惊厥需立即就医' }
  ]},
  { month: 24, ageLabel: '2岁', vaccines: [
    { name: '乙脑减毒活疫苗', dose: '第2剂', fullCode: 'JE-L2', category: '一类', prevent: '流行性乙型脑炎', route: '皮下注射', site: '上臂三角肌', reaction: '少数发热', emergency: '持续高热需就医' }
  ]},
  { month: 36, ageLabel: '3岁', vaccines: [
    { name: 'A+C群流脑多糖疫苗', dose: '第1剂', fullCode: 'MPSV-AC1', category: '一类', prevent: '流行性脑脊髓膜炎', route: '皮下注射', site: '上臂三角肌', reaction: '少数发热', emergency: '过敏反应需就医' }
  ]},
  { month: 48, ageLabel: '4岁', vaccines: [
    { name: '脊灰减毒活疫苗', dose: '第4剂(加强)', fullCode: 'OPV4', category: '一类', prevent: '脊髓灰质炎', route: '口服', site: '口服', reaction: '少数轻度腹泻', emergency: '腹泻严重需就医' }
  ]},
  { month: 72, ageLabel: '6岁', vaccines: [
    { name: '白破疫苗', dose: '第1剂(加强)', fullCode: 'DT1', category: '一类', prevent: '白喉、破伤风', route: '肌内注射', site: '上臂三角肌', reaction: '局部红肿', emergency: '高热需就医' },
    { name: 'A+C群流脑多糖疫苗', dose: '第2剂', fullCode: 'MPSV-AC2', category: '一类', prevent: '流行性脑脊髓膜炎', route: '皮下注射', site: '上臂三角肌', reaction: '少数发热', emergency: '过敏反应需就医' }
  ]}
];

/**
 * 根据宝宝月龄获取疫苗列表
 * @param {number} monthAge - 月龄
 * @returns {{ passed: [], current: {}, upcoming: [] }}
 */
window.getVaccineByAge = function(monthAge) {
  const passed = [];
  let current = null;
  const upcoming = [];

  for (const item of VACCINE_SCHEDULE) {
    if (item.month <= monthAge) {
      passed.push(item);
      if (item.month === monthAge) current = item;
    } else {
      upcoming.push(item);
    }
  }

  return { passed, current, upcoming };
};

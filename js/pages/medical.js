/**
 * 疫苗用药页面 — 顶部模块切换(疫苗/用药)
 * 疫苗模块：待接种 / 已接种
 * 用药模块：常备清单 / 用药记录
 * 数据源：VACCINE_SCHEDULE（标准日程）+ 云端同步（vaccine_data + medication_data）
 * 权限：管理员可编辑疫苗；常备药清单所有家庭成员可编辑
 */

// v112 常备药清单预设数据（依据《宝宝常见用药参考手册（0-36个月）》整理）
const DEFAULT_MED_LIST = [
  {
    id: 'cat_nutrition', name: '营养补充类', color: 'success', direction: '促进钙吸收、预防营养缺乏',
    items: [
      { id: 'med_d3', name: '维生素D3滴剂', dose: '400IU/日', note: '出生数天起至3岁；早产儿剂量遵医嘱' },
      { id: 'med_ad', name: '维生素AD滴剂', dose: '1粒/日', note: '0-1岁/1岁以上分剂型；与D3二选一或交替，避免过量' },
      { id: 'med_k1', name: '维生素K1', dose: '遵医嘱', note: '新生儿预防出血，出生后注射' },
      { id: 'med_iron', name: '铁剂', dose: '遵医嘱', note: '早产儿或缺铁性贫血时补充' },
      { id: 'med_zinc', name: '锌剂', dose: '遵医嘱', note: '食欲不振或腹泻后补充' },
      { id: 'med_dha', name: 'DHA', dose: '遵说明书', note: '脑部发育补充，可选' }
    ]
  },
  {
    id: 'cat_fever', name: '退热镇痛类', color: 'highlight', direction: '体温≥38.5°C时使用，按体重给药',
    items: [
      { id: 'med_tylenol', name: '对乙酰氨基酚', dose: '10-15mg/kg/次', note: '≥3月龄；间隔4-6小时，24小时不超过5次' },
      { id: 'med_motrin', name: '布洛芬', dose: '5-10mg/kg/次', note: '≥6月龄；间隔6-8小时，脱水时慎用' }
    ]
  },
  {
    id: 'cat_resp', name: '呼吸道类', color: 'processing', direction: '鼻塞、咳嗽、化痰',
    items: [
      { id: 'med_saline_drops', name: '生理盐水滴鼻剂', dose: '1-2滴/次', note: '缓解鼻塞，清理鼻腔' },
      { id: 'med_ambroxol', name: '氨溴索糖浆', dose: '遵医嘱', note: '化痰，1岁以上使用' },
      { id: 'med_acetylcysteine', name: '乙酰半胱氨酸', dose: '遵医嘱', note: '化痰雾化用' }
    ]
  },
  {
    id: 'cat_digestive', name: '消化类', color: 'success', direction: '腹泻脱水、便秘、肠绞痛',
    items: [
      { id: 'med_ors3', name: '口服补液盐III', dose: '按比例冲服', note: '全段可用；<2岁每次稀便后50-100ml，少量多次' },
      { id: 'med_smecta', name: '蒙脱石散', dose: '按年龄遵说明书', note: '与其他药物或奶间隔1-2小时' },
      { id: 'med_brad', name: '布拉氏酵母菌', dose: '遵说明书', note: '腹泻时调节肠道菌群' },
      { id: 'med_bifido', name: '双歧杆菌', dose: '遵说明书', note: '调节肠道菌群' },
      { id: 'med_simethicone', name: '西甲硅油', dose: '遵说明书', note: '肠绞痛排气' },
      { id: 'med_lactulose', name: '乳果糖', dose: '遵医嘱', note: '便秘时使用' },
      { id: 'med_glycerin', name: '开塞露', dose: '按需使用', note: '严重便秘应急，不宜常用' }
    ]
  },
  {
    id: 'cat_skin', name: '皮肤外用类', color: 'celebration', direction: '尿布疹、湿疹、蚊虫叮咬、外伤',
    items: [
      { id: 'med_diaper_cream', name: '护臀霜', dose: '按需涂抹', note: '每次换尿布后涂抹，预防尿布疹' },
      { id: 'med_moisturizer', name: '保湿霜', dose: '每日2次', note: '湿疹护理基础，保持皮肤湿润' },
      { id: 'med_calamine', name: '炉甘石洗剂', dose: '按需涂抹', note: '蚊虫叮咬、皮疹止痒' },
      { id: 'med_mupirocin', name: '莫匹罗星软膏', dose: '按需涂抹', note: '细菌性皮肤感染，如脓疱疮' },
      { id: 'med_erythromycin', name: '红霉素软膏', dose: '按需涂抹', note: '小伤口、轻度感染' },
      { id: 'med_iodine', name: '碘伏棉签', dose: '按需使用', note: '脐部消毒、小伤口消毒' }
    ]
  },
  {
    id: 'cat_allergy', name: '抗过敏类', color: 'highlight', direction: '过敏反应、荨麻疹',
    items: [
      { id: 'med_cetirizine', name: '西替利嗪', dose: '≥6月龄，遵说明书', note: '荨麻疹、过敏性鼻炎、虫咬过敏' },
      { id: 'med_loratadine', name: '氯雷他定', dose: '≥2岁，5mg/天', note: '过敏性鼻炎、荨麻疹' }
    ]
  },
  {
    id: 'cat_care', name: '眼/口/脐护理', color: 'inactive', direction: '眼部感染、口腔护理、脐部消毒',
    items: [
      { id: 'med_tobramycin', name: '妥布霉素眼药水', dose: '遵医嘱', note: '细菌性结膜炎' },
      { id: 'med_eye_ointment', name: '红霉素眼膏', dose: '按需涂抹', note: '眼部感染、新生儿结膜炎' },
      { id: 'med_baking_soda', name: '碳酸氢钠溶液', dose: '遵医嘱', note: '鹅口疮时清洁口腔' }
    ]
  }
];

// v112 禁用/慎用药品清单（只读参考，不可编辑）
const PROHIBITED_MED_LIST = [
  { name: '阿司匹林', level: '禁止', risk: '可能引发瑞氏综合征（脑病+肝脂肪变性），儿童禁用' },
  { name: '安乃近', level: '禁止', risk: '可致粒细胞减少、再生障碍性贫血，多国已禁用' },
  { name: '复方感冒药', level: '慎用', risk: '含多种成分，婴幼儿易过量，不建议自行使用' },
  { name: '可待因', level: '禁止', risk: '12岁以下儿童禁用，有呼吸抑制风险' },
  { name: '氯霉素', level: '禁止', risk: '可致灰婴综合征，新生儿禁用' },
  { name: '磺胺类药物', level: '慎用', risk: '2月龄以下禁用，可能引起核黄疸' },
  { name: '四环素类', level: '禁止', risk: '8岁以下禁用，影响牙齿和骨骼发育' },
  { name: '喹诺酮类（沙星类）', level: '禁止', risk: '18岁以下禁用，影响软骨发育' },
  { name: '中药注射剂', level: '慎用', risk: '过敏风险高，儿童不建议使用' },
  { name: '成人药减半', level: '禁止', risk: '儿童不是缩小版成人，必须用儿童专用药' },
  { name: '酒精擦浴', level: '禁止', risk: '可通过皮肤吸收致酒精中毒，禁用酒精退热' },
  { name: '捂汗退热', level: '禁止', risk: '婴儿体温调节中枢不成熟，捂汗可致高热脱水' }
];

window.MedicalPage = {
  currentModule: 'vaccine',  // 兼容旧入口：'vaccine' | 'medication'
  currentHealthTab: 'illness', // 'illness' | 'vaccine' | 'teeth' | 'inventory' | 'checkup'
  currentTab: 'pending',     // 疫苗: 'pending' | 'done'
  currentMedTab: 'checklist', // 用药: 'checklist' | 'records'
  _medDate: '',            // 用药记录当前查看的日期（YYYY-MM-DD，空=今天）
  // 知识卡折叠状态
  _vacKnowExpanded: false,
  _vacKnowOpenItem: -1,
  _medKnowExpanded: false,
  _medKnowOpenItem: -1,
  _medList: null,        // 常备药清单
  _medListLoaded: false,
  _healthEpisodes: [],
  _activeEpisode: null,
  _episodeMedicines: [],
  _teeth: [],
  _checkups: [],
  _expandedCats: {},     // 常备清单品类展开状态（默认折叠）
  _prohibitedExpanded: false,  // 禁用清单展开状态
  customVaccines: [],    // 自定义疫苗（render/云端加载前默认空数组，防止遍历报错）
  allVaccines: [],       // 标准疫苗计划（同上兜底）
  records: {},           // 疫苗记录表（同上兜底）

  async render(container) {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby.birthDate) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">${Lucide.icon('syringe', 32)}</div><p>请先创建宝宝档案</p></div>`;
      return;
    }

    // 先从云端加载疫苗数据（失败则用本地缓存）
    await this._loadCloud();
    // 加载用药记录数据
    await this._loadMedicationCloud();
    // 加载常备药清单
    await this._loadMedListCloud();
    // 新健康管理数据失败时不阻塞原疫苗/用药页面
    const [episodeResult, teethResult, checkupResult] = await Promise.all([
      API.listIllnessEpisodes ? API.listIllnessEpisodes({ status: 'all' }).catch(() => ({ episodes: [] })) : Promise.resolve({ episodes: [] }),
      API.listTeeth ? API.listTeeth().catch(() => ({ records: [] })) : Promise.resolve({ records: [] }),
      API.listCheckups ? API.listCheckups().catch(() => ({ records: [] })) : Promise.resolve({ records: [] })
    ]);
    this._healthEpisodes = episodeResult.episodes || [];
    this._activeEpisode = this._healthEpisodes.find(e => e.status === 'active') || null;
    this._teeth = teethResult.records || [];
    this._checkups = checkupResult.records || [];
    this._checkups.sort((a, b) => new Date(b.checkDate) - new Date(a.checkDate));
    this._episodeMedicinesByEpisode = {};
    if (API.listIllnessMedicines && this._healthEpisodes.length) {
      const episodeResults = await Promise.all(this._healthEpisodes.map(e => API.listIllnessMedicines(e._id).catch(() => ({ records: [] }))));
      this._healthEpisodes.forEach((e, i) => { this._episodeMedicinesByEpisode[e._id] = episodeResults[i].records || []; });
    }
    this._episodeMedicines = this._activeEpisode ? (this._episodeMedicinesByEpisode[this._activeEpisode._id] || []) : [];

    const monthAge = Utils.calcMonthAge(baby.birthDate);
    const allVaccines = Utils.getBabyVaccines(baby.birthDate) || [];
    const records = this._getRecords();
    const customVaccines = this._getCustomVaccines();

    this.container = container;
    this.baby = baby;
    this.monthAge = monthAge;
    this.allVaccines = allVaccines;
    this.records = records;
    this.customVaccines = customVaccines;
    this.isAdmin = Auth.isAdmin();

    this._render();
  },

  // ===== 云端同步 =====
  /** 确保云端疫苗数据已加载到本地缓存（供 dashboard 等同步调用方使用） */
  async ensureCloudLoaded() {
    if (this._cloudLoaded) return;
    await this._loadCloud();
  },

  /** 从云端拉取疫苗数据并覆盖本地缓存（云端为准） */
  async _loadCloud() {
    this._cloudLoaded = true; // 防并发重复加载
    try {
      if (window.API && API.getVaccineData && Auth && Auth.getBabyId && Auth.getBabyId()) {
        const data = await API.getVaccineData();
        if (data) {
          const recs = data.records || {};
          const customs = data.customVaccines || [];
          localStorage.setItem('oneone_vaccine_records', JSON.stringify(recs));
          localStorage.setItem('oneone_custom_vaccines', JSON.stringify(customs));
          this.records = recs;
          this.customVaccines = customs;
        }
      }
    } catch (e) {
      console.warn('[Vaccine] 云端加载失败，使用本地数据:', e.message);
    }
  },

  /** 同步疫苗数据到云端（防抖 400ms） */
  _syncCloud() {
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => {
      if (window.API && API.saveVaccineData && Auth && Auth.getBabyId && Auth.getBabyId()) {
        try {
          const records = JSON.parse(localStorage.getItem('oneone_vaccine_records') || '{}');
          const customs = JSON.parse(localStorage.getItem('oneone_custom_vaccines') || '[]');
          API.saveVaccineData(records, customs).catch(e => console.warn('[Vaccine] 云端同步失败(已存本地):', e.message));
        } catch { /* ignore */ }
      }
    }, 400);
  },

  // ===== 用药记录数据 =====
  /** 从云端拉取用药记录并覆盖本地缓存 */
  async _loadMedicationCloud() {
    this._medCloudLoaded = true;
    try {
      if (window.API && API.getMedicationData && Auth && Auth.getBabyId && Auth.getBabyId()) {
        const data = await API.getMedicationData();
        if (data) {
          const recs = data.records || [];
          localStorage.setItem('oneone_medication_records', JSON.stringify(recs));
          this.medications = recs;
        }
      }
    } catch (e) {
      console.warn('[Medication] 云端加载失败，使用本地数据:', e.message);
    }
  },

  /** 同步用药数据到云端（防抖 400ms） */
  _syncMedicationCloud() {
    clearTimeout(this._medSyncTimer);
    this._medSyncTimer = setTimeout(() => {
      if (window.API && API.saveMedicationData && Auth && Auth.getBabyId && Auth.getBabyId()) {
        try {
          const records = JSON.parse(localStorage.getItem('oneone_medication_records') || '[]');
          API.saveMedicationData(records).catch(e => console.warn('[Medication] 云端同步失败(已存本地):', e.message));
        } catch { /* ignore */ }
      }
    }, 400);
  },

  _getMedications() {
    try {
      return JSON.parse(localStorage.getItem('oneone_medication_records') || '[]');
    } catch { return []; }
  },

  _saveMedications(list) {
    localStorage.setItem('oneone_medication_records', JSON.stringify(list));
    this.medications = list;
    this._syncMedicationCloud();
  },

  // ===== v113 用药记录按日期视图 =====
  /** 获取用药记录当前查看的日期（默认今天） */
  _getMedDate() {
    if (!this._medDate) this._medDate = this._todayStr();
    return this._medDate;
  },

  /** 今日 YYYY-MM-DD */
  _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /** 日期加减天数返回 YYYY-MM-DD */
  _shiftDate(dateStr, deltaDays) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /** 格式化日期为 "YYYY-MM-DD 周X" */
  _fmtMedDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const week = '日一二三四五六'[d.getDay()];
    const parts = dateStr.split('-');
    return `${parts[0]}-${parts[1]}-${parts[2]} 周${week}`;
  },

  /** 翻页上一/下一天 */
  _shiftMedDate(delta) {
    this._medDate = this._shiftDate(this._getMedDate(), delta);
    this._render();
  },

  /** 回到今天 */
  _medGoToday() {
    this._medDate = this._todayStr();
    this._render();
  },

  /** 首页联动：获取今天的用药记录（供 dashboard 检测） */
  getTodayMedications() {
    const today = this._todayStr();
    return this._getMedications().filter(m => (m.date || '') === today);
  },

  /** 获取某品类下药品的 id 集合，用于统计用药类型 */
  _medTypeMap() {
    const medList = this._getMedList();
    const map = {}; // itemId -> categoryName
    for (const cat of medList) {
      for (const item of (cat.items || [])) {
        map[item.id] = cat.name;
      }
    }
    return map;
  },

  // ===== v110 常备药清单数据 =====
  async _loadMedListCloud() {
    if (this._medListLoaded) return;
    this._medListLoaded = true;
    try {
      if (window.API && API.getMedList && Auth && Auth.getBabyId && Auth.getBabyId()) {
        const data = await API.getMedList();
        if (data && data.medList) {
          this._medList = data.medList;
          localStorage.setItem('oneone_med_list', JSON.stringify(data.medList));
        } else {
          // 首次使用：初始化预设数据
          this._medList = JSON.parse(JSON.stringify(DEFAULT_MED_LIST));
          this._syncMedListCloud();
        }
      }
    } catch (e) {
      console.warn('[MedList] 云端加载失败，使用本地/预设数据:', e.message);
      try {
        const local = localStorage.getItem('oneone_med_list');
        this._medList = local ? JSON.parse(local) : JSON.parse(JSON.stringify(DEFAULT_MED_LIST));
      } catch {
        this._medList = JSON.parse(JSON.stringify(DEFAULT_MED_LIST));
      }
    }
  },

  _syncMedListCloud() {
    clearTimeout(this._medListSyncTimer);
    this._medListSyncTimer = setTimeout(() => {
      if (window.API && API.saveMedList && Auth && Auth.getBabyId && Auth.getBabyId()) {
        try {
          API.saveMedList(this._medList).catch(e => console.warn('[MedList] 云端同步失败(已存本地):', e.message));
          localStorage.setItem('oneone_med_list', JSON.stringify(this._medList));
        } catch { /* ignore */ }
      }
    }, 400);
  },

  _getMedList() {
    if (this._medList) return this._medList;
    try {
      const local = localStorage.getItem('oneone_med_list');
      if (local) { this._medList = JSON.parse(local); return this._medList; }
    } catch { /* ignore */ }
    this._medList = JSON.parse(JSON.stringify(DEFAULT_MED_LIST));
    return this._medList;
  },

  // ===== 标准疫苗记录 =====
  _getRecords() {
    try {
      return JSON.parse(localStorage.getItem('oneone_vaccine_records') || '{}');
    } catch { return {}; }
  },

  _saveRecords(records) {
    localStorage.setItem('oneone_vaccine_records', JSON.stringify(records));
    this.records = records;
    this._syncCloud();
  },

  // ===== 自定义疫苗 =====
  _getCustomVaccines() {
    try {
      return JSON.parse(localStorage.getItem('oneone_custom_vaccines') || '[]');
    } catch { return []; }
  },

  _saveCustomVaccines(list) {
    localStorage.setItem('oneone_custom_vaccines', JSON.stringify(list));
    this.customVaccines = list;
    this._syncCloud();
  },

  /** 获取某疫苗的唯一key */
  _vKey(v) {
    return (v.fullCode || v.customId || (v.name + '_' + v.dose)).replace(/\s/g, '_');
  },

  /** 判断疫苗是否已完成 */
  _isDone(v) {
    const key = this._vKey(v);
    const rec = this.records[key];
    return !!(rec && rec.done);
  },

  /** 判断疫苗是否在3天提醒窗口内 */
  _isNearDate(key, plannedDate) {
    if (!plannedDate) return false;
    const planned = new Date(plannedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    planned.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((planned - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3;
  },

  /** 获取所有待接种疫苗（仅用户手动添加的） */
  _getPendingVaccines() {
    const pending = [];

    // 仅显示用户手动添加的自定义疫苗（未完成的）
    for (const cv of this.customVaccines) {
      if (cv.done) continue;
      pending.push({
        name: cv.name,
        dose: cv.dose,
        prevent: cv.prevent || '',
        route: cv.route || '',
        site: cv.site || '',
        category: cv.category || '',
        customId: cv.customId,
        plannedDate: cv.plannedDate || null,
        isCustom: true,
        isNear: this._isNearDate(cv.customId, cv.plannedDate)
      });
    }

    pending.sort((a, b) => {
      if (a.plannedDate && !b.plannedDate) return -1;
      if (!a.plannedDate && b.plannedDate) return 1;
      if (a.plannedDate && b.plannedDate) return new Date(a.plannedDate) - new Date(b.plannedDate);
      return 0;
    });
    return pending;
  },

  /** 获取所有已接种疫苗（标准 + 自定义） */
  _getDoneVaccines() {
    const done = [];

    for (const v of this.allVaccines) {
      const key = this._vKey(v);
      const rec = this.records[key];
      if (rec && rec.done) {
        done.push({
          ...v,
          doneDate: rec.doneDate || '',
          plannedDate: rec.plannedDate || '',
          isCustom: false
        });
      }
    }

    for (const cv of this.customVaccines) {
      if (cv.done) {
        done.push({
          name: cv.name,
          dose: cv.dose,
          prevent: cv.prevent || '',
          route: cv.route || '',
          site: cv.site || '',
          category: cv.category || '',
          doneDate: cv.doneDate || cv.plannedDate || '',
          plannedDate: cv.plannedDate || '',
          isCustom: true,
          customId: cv.customId
        });
      }
    }

    done.sort((a, b) => new Date(b.doneDate) - new Date(a.doneDate));
    return done;
  },

  _render() {
    const c = this.container;
    const pending = this._getPendingVaccines();
    const done = this._getDoneVaccines();
    const medications = this._getMedications();
    const medList = this._getMedList();
    const isAdmin = this.isAdmin;

    let html = '';

    // 健康管理四 Tab：保留原疫苗/用药子视图，新增生病周期与长牙。
    const healthTabs = [
      ['illness', 'thermometer', '生病用药'], ['vaccine', 'syringe', '疫苗接种'], ['teeth', 'smile', '长牙记录'], ['inventory', 'package', '常备药清单'], ['checkup', 'clipboard-check', '儿童健康']
    ];
    html += `<nav class="v3-subtabs health-management-tabs" role="tablist" aria-label="健康管理分类">${healthTabs.map(([key, icon, label]) => `<button type="button" class="v3-subtab ${this.currentHealthTab === key ? 'is-active' : ''}" role="tab" aria-selected="${this.currentHealthTab === key}" onclick="MedicalPage.switchHealthTab('${key}')">${Lucide.icon(icon, 15)}<span>${label}</span></button>`).join('')}</nav>`;

    if (this.currentHealthTab === 'illness') html += this._renderIllnessTab();
    else if (this.currentHealthTab === 'vaccine') html += this._renderVaccineModule(pending, done);
    else if (this.currentHealthTab === 'teeth') html += this._renderTeethTab();
    else if (this.currentHealthTab === 'checkup') html += this._renderCheckupTab();
    else html += this._renderInventoryTab(medList);

    // 免责声明
    html += `<div class="disclaimer">${APP_CONFIG.disclaimer}</div>`;

    c.innerHTML = html;
  },

  switchHealthTab(tab) {
    this.currentHealthTab = tab;
    if (tab === 'vaccine') this.currentModule = 'vaccine';
    if (tab === 'inventory') { this.currentModule = 'medication'; this.currentMedTab = 'checklist'; }
    this._render();
  },

  _switchModule(mod) {
    this.currentModule = mod;
    this.currentHealthTab = mod === 'vaccine' ? 'vaccine' : 'inventory';
    this._render();
  },

  _renderIllnessTab() {
    const active = this._activeEpisode;
    const closed = this._healthEpisodes.filter(e => e.status === 'closed');
    const medList = this._getMedList();
    const flatMeds = medList.reduce((all, cat) => all.concat((cat.items || []).map(item => ({ ...item, category: cat.name }))), []);
    const activeMedicineIds = new Set(this._episodeMedicines.map(m => m.medId).filter(Boolean));
    const quickMeds = flatMeds.filter(m => activeMedicineIds.has(m.id) || ['对乙酰氨基酚', '布洛芬', '口服补液盐III', '生理盐水滴鼻剂'].some(k => m.name.includes(k))).slice(0, 6);
    return `${active ? `<div class="card illness-episode-card"><div class="card-title">${Lucide.icon('thermometer', 17)} 当前生病周期 <span class="status-chip warning">进行中</span><button class="btn btn-sm btn-outline" style="margin-left:auto" onclick="MedicalPage.closeIllness('${active._id}')">结束周期</button></div><div class="card-row"><span>开始日期</span><b>${active.startDate}</b></div><div class="card-row"><span>症状</span><span>${(active.symptoms || []).map(Utils.escapeHtml).join('、') || '未填写'}</span></div>${active.maxTemp ? `<div class="card-row"><span>最高体温</span><strong class="temp-high">${active.maxTemp}°C</strong></div>` : ''}</div>` : `<div class="card empty-state"><div class="es-icon">${Lucide.icon('smile', 34)}</div><div class="es-text">宝宝目前很健康</div><button class="btn btn-primary" onclick="MedicalPage.createIllness()">记录这次生病</button></div>`}
    ${active ? `<div class="card"><div class="card-title">${Lucide.icon('pill', 17)} 当前周期用药<button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="MedicalPage.addIllnessMedicine('${active._id}')">添加</button></div>${quickMeds.length ? `<div class="illness-quick-meds"><span class="text-muted">从常备药清单快速记录：</span>${quickMeds.map(m => `<button class="btn btn-outline btn-sm" onclick="MedicalPage.addIllnessMedicine('${active._id}','${Utils.jsAttr(m.id)}')">${Utils.escapeHtml(m.name)}</button>`).join('')}</div>` : ''}${this._episodeMedicines.length ? this._episodeMedicines.map(m => `<div class="record-item"><div class="record-main"><div class="record-title">${Utils.escapeHtml(m.medicineName)}</div><div class="record-meta">${Utils.escapeHtml(m.time)} · ${Utils.escapeHtml(m.dosage || '用量未填')}</div></div><button class="btn btn-sm btn-outline" onclick="MedicalPage.deleteIllnessMedicine('${m._id}')">删除</button></div>`).join('') : '<div class="empty-state-sm">当前周期还没有用药记录</div>'}</div>` : ''}
    ${closed.length ? `<div class="card"><div class="card-title">${Lucide.icon('clock', 17)} 历史记录（${closed.length}次）</div><details><summary>展开查看历史生病周期</summary>${closed.map(e => { const meds = this._episodeMedicinesByEpisode?.[e._id] || []; return `<div class="record-item"><div class="record-main"><div class="record-title">${Utils.escapeHtml((e.symptoms || []).join('、') || '生病周期')}</div><div class="record-meta">${e.startDate} 至 ${e.endDate || '—'} · 用药${meds.length}条</div>${meds.length ? `<div class="record-meta">${meds.map(m => Utils.escapeHtml(m.medicineName)).join('、')}</div>` : ''}</div></div>`; }).join('')}</details></div>` : ''}`;
  },

  _renderCheckupTab() {
    const records = this._checkups || [];
    this._checkups = records;

    const last = records[0];
    const next = last ? this._nextCheckup(last) : null;
    return `<div class="card"><div class="card-title">${Lucide.icon('clipboard-check', 17)} 儿童健康</div>${next ? `<div class="checkup-reminder"><strong>下次体检提醒</strong><div>${next.type}</div><small>预计：${next.date}</small><button class="btn btn-primary btn-sm" onclick="MedicalPage.openCheckupForm('${next.type}')">记录这次体检</button></div>` : ''}<div class="checkup-list-head"><strong>儿保记录（${records.length}次）</strong><button class="btn btn-primary btn-sm" onclick="MedicalPage.openCheckupForm()">+ 添加记录</button></div>${records.length ? records.map(r => `<div class="checkup-card"><div class="checkup-title">${r.checkType} <small>${r.checkDate}</small></div><div class="checkup-metrics"><span>体重 ${r.weight}g ${this._growthText(r.weightGrowth)}</span><span>身高 ${r.height}cm ${this._growthText(r.heightGrowth)}</span>${r.headCircumference ? `<span>头围 ${r.headCircumference}cm ${this._growthText(r.headGrowth)}</span>` : ''}</div>${r.doctorComment ? `<p>医生评估：${Utils.escapeHtml(r.doctorComment)}</p>` : ''}${r.doctorAdvice?.length ? `<p>医嘱：${r.doctorAdvice.map(Utils.escapeHtml).join('、')}</p>` : ''}<small>${Utils.escapeHtml(r.hospital || '')}</small><div class="checkup-actions"><button class="btn btn-outline btn-sm" onclick="MedicalPage.openCheckupForm('${Utils.jsAttr(r.checkType)}','${r._id}')">编辑</button><button class="btn btn-outline btn-sm" onclick="MedicalPage.deleteCheckup('${r._id}')">删除</button></div></div>`).join('') : `<div class="checkup-empty">还没有儿保记录<br><small>建议体检时间：42天、3月、6月、8月、12月、18月、24月、30月、36月</small><button class="btn btn-primary" onclick="MedicalPage.openCheckupForm()">添加第一次儿保记录</button></div>`}</div>`;
  },
  _growthText(g) { return g?.value ? `<em class="growth-up">${g.value > 0 ? '↑' : '↓'} ${Math.abs(g.value)}</em>` : ''; },
  _nextCheckup(last) { const map = { '42天体检':['3月龄体检',2.5], '3月龄体检':['6月龄体检',3], '6月龄体检':['8月龄体检',2], '8月龄体检':['12月龄体检',4], '12月龄体检':['18月龄体检',6], '18月龄体检':['24月龄体检',6], '24月龄体检':['30月龄体检',6], '30月龄体检':['36月龄体检',6] }; const item = map[last.checkType]; if (!item) return null; const d = new Date(last.checkDate); d.setDate(d.getDate() + Math.round(item[1] * 30)); return { type: item[0], date: d.toISOString().slice(0, 10) }; },
  openCheckupForm(type = '', id = '') { const r = id ? (this._checkups || []).find(x => x._id === id) : null; const types = ['42天体检','3月龄体检','6月龄体检','8月龄体检','12月龄体检','18月龄体检','24月龄体检','30月龄体检','36月龄体检','其他体检']; App._showModal(r ? '编辑儿保记录' : '添加儿保记录', `<div class="form-group"><label>体检时间 *</label><input id="checkup-date" type="date" class="form-input" value="${r?.checkDate || this._todayStr()}"></div><div class="form-group"><label>体检类型 *</label><select id="checkup-type" class="form-input">${types.map(x => `<option ${x === (r?.checkType || type) ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="form-row"><label>体重(g)*<input id="checkup-weight" type="number" class="form-input" value="${r?.weight || ''}"></label><label>身高(cm)*<input id="checkup-height" type="number" step="0.1" class="form-input" value="${r?.height || ''}"></label></div><div class="form-row"><label>头围(cm)<input id="checkup-head" type="number" step="0.1" class="form-input" value="${r?.headCircumference || ''}"></label><label>胸围(cm)<input id="checkup-chest" type="number" step="0.1" class="form-input" value="${r?.chestCircumference || ''}"></label></div><div class="form-group"><label>发育水平<select id="checkup-level" class="form-input">${['优秀','中上','中等','中下','偏低','未评估'].map(x => `<option ${x === (r?.developmentLevel || '未评估') ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div><div class="form-group"><label>医生评语<input id="checkup-comment" class="form-input" value="${Utils.escapeHtml(r?.doctorComment || '')}"></label></div><div class="form-group"><label>医嘱建议</label><textarea id="checkup-advice" class="form-textarea" placeholder="每行一条">${Utils.escapeHtml((r?.doctorAdvice || []).join('\n'))}</textarea></div><div class="form-group"><label>检查医院 *</label><input id="checkup-hospital" class="form-input" value="${Utils.escapeHtml(r?.hospital || '')}"></label></div><div class="form-group"><label>医生姓名</label><input id="checkup-doctor" class="form-input" value="${Utils.escapeHtml(r?.doctorName || '')}"></div><div class="form-group"><label>备注</label><textarea id="checkup-note" class="form-textarea">${Utils.escapeHtml(r?.note || '')}</textarea></div><button class="btn btn-primary btn-block" onclick="MedicalPage.saveCheckup('${id}')">保存记录</button>`); },
  _todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
  async saveCheckup(id) { const record = { checkDate: document.getElementById('checkup-date').value, checkType: document.getElementById('checkup-type').value, weight: Number(document.getElementById('checkup-weight').value), height: Number(document.getElementById('checkup-height').value), headCircumference: Number(document.getElementById('checkup-head').value) || null, chestCircumference: Number(document.getElementById('checkup-chest').value) || null, developmentLevel: document.getElementById('checkup-level').value, doctorComment: document.getElementById('checkup-comment').value, doctorAdvice: document.getElementById('checkup-advice').value.split('\n').map(x => x.trim()).filter(Boolean), hospital: document.getElementById('checkup-hospital').value, doctorName: document.getElementById('checkup-doctor').value, note: document.getElementById('checkup-note').value }; if (!record.checkDate || !record.checkType || !(record.weight > 0) || !(record.height > 0) || !record.hospital) return Utils.showToast('请填写日期、类型、体重、身高和医院'); const previous = (this._checkups || []).filter(x => x._id !== id).sort((a,b) => new Date(b.checkDate) - new Date(a.checkDate))[0]; record.weightGrowth = { value: record.weight - (previous?.weight || this.baby?.birthWeight || 0), compared: previous ? 'last' : 'birth' }; record.heightGrowth = { value: record.height - (previous?.height || this.baby?.birthHeight || 0), compared: previous ? 'last' : 'birth' }; record.headGrowth = { value: record.headCircumference && previous?.headCircumference ? record.headCircumference - previous.headCircumference : 0, compared: 'last' }; if (id) await API.updateCheckup(id, record); else await API.addCheckup(record); App._closeModal(); Utils.showToast('儿保记录已保存'); await this.render(this.container); },
  async deleteCheckup(id) { if (!confirm('删除这条儿保记录？')) return; await API.deleteCheckup(id); await this.render(this.container); },

  _renderInventoryTab(medList) {
    this.currentModule = 'medication';
    const meds = (medList || []).reduce((a, c) => a.concat((c.items || []).map(i => ({ ...i, category: c.name }))), []);
    return `<div class="card"><div class="card-title">${Lucide.icon('package', 17)} 常备药清单 <span class="text-muted" style="margin-left:auto;font-size:12px">${meds.length}种</span></div>${meds.length ? `<div class="inventory-grid">${meds.map(i => `<div class="inventory-item"><div class="ii-name">${Utils.escapeHtml(i.name)}</div><div class="ii-specs">${Utils.escapeHtml(i.dose || i.category || '')}</div></div>`).join('')}</div>` : '<div class="empty-state-sm">还没有常备药品</div>'}<p class="text-muted" style="font-size:12px;margin-top:12px">药品有效期请以包装标注为准；过期或变质药品不要使用。</p></div>`;
  },

  _renderTeethTab() {
    const teeth = this._teeth || [];
    const erupted = new Set(teeth.map(t => `${t.position}:${t.index}`));
    const names = ['大牙','大牙','尖牙','侧切','门牙','门牙','侧切','尖牙','大牙','大牙'];
    const row = pos => names.map((n, i) => { const on = erupted.has(`${pos}:${i}`); return `<button class="tooth ${on ? 'erupted' : ''}" onclick="MedicalPage.markTooth('${pos}',${i})"><span class="tooth-icon">${on ? Lucide.icon('check-circle', 18) : Lucide.icon('circle', 18)}</span><span class="tooth-name">${n}</span></button>`; }).join('');
    return `<div class="card"><div class="card-title">${Lucide.icon('smile', 17)} 牙齿地图</div><div class="teeth-stats"><b>${teeth.length}</b><span>已记录牙齿</span><button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="MedicalPage.markTooth('upper',4)">记录长牙</button></div><div class="teeth-map"><div class="teeth-label">上排</div><div class="teeth-grid">${row('upper')}</div><div class="teeth-label">下排</div><div class="teeth-grid">${row('lower')}</div></div></div><div class="card"><div class="card-title">${Lucide.icon('calendar', 17)} 出牙时间线</div>${teeth.length ? teeth.map(t => `<div class="record-item"><div class="record-main"><div class="record-title"> ${t.position === 'upper' ? '上排' : '下排'}${names[t.index] || ''}</div><div class="record-meta">${t.date}${t.note ? ' · ' + Utils.escapeHtml(t.note) : ''}</div></div><button class="btn btn-sm btn-outline" onclick="MedicalPage.deleteTooth('${t._id}')">删除</button></div>`).join('') : '<div class="empty-state-sm">点击牙齿位置记录出牙日期</div>'}</div><div class="card"><div class="card-title">${Lucide.icon('heart', 17)} 护理提醒</div><p class="text-muted">第一颗牙萌出后开始清洁；出牙不适、持续发热或明显疼痛请咨询儿科/口腔科医生。</p></div>`;
  },

  createIllness() { const html = `<div class="modal-overlay" id="illnessModal"><div class="modal-content"><div class="modal-header"><h3>记录生病周期</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button></div><div class="modal-body"><label>开始日期<input id="illnessStart" type="date" class="form-input" value="${this._todayStr()}"></label><label>症状<input id="illnessSymptoms" class="form-input" placeholder="发烧、咳嗽、流鼻涕"></label><label>最高体温<input id="illnessTemp" type="number" step="0.1" class="form-input"></label><label>备注<textarea id="illnessNote" class="form-textarea"></textarea></label></div><div class="modal-footer"><button class="btn btn-primary" onclick="MedicalPage.saveIllness()">保存</button></div></div></div>`; document.body.insertAdjacentHTML('beforeend', html); },
  async saveIllness() { const symptoms = (document.getElementById('illnessSymptoms')?.value || '').split(/[、,，]/).map(s => s.trim()).filter(Boolean); if (!symptoms.length) return Utils.showToast('请填写症状'); await API.createIllnessEpisode({ startDate: document.getElementById('illnessStart').value, symptoms, maxTemp: parseFloat(document.getElementById('illnessTemp').value) || null, note: document.getElementById('illnessNote').value }); document.getElementById('illnessModal')?.remove(); Utils.showToast('已记录'); await this.render(this.container); },
  async closeIllness(id) { await API.closeIllnessEpisode(id); Utils.showToast('已结束周期'); await this.render(this.container); },
  addIllnessMedicine(episodeId, medId = '') {
    const item = medId ? this._getMedList().flatMap(c => c.items || []).find(i => i.id === medId) : null;
    const name = item ? item.name : prompt('药品名称');
    if (!name) return;
    const dosage = item ? (prompt(`用量（参考：${item.dose || '遵医嘱'}）`, item.dose || '') || '') : (prompt('用量（可选）') || '');
    const note = item ? (item.note || '') : '';
    API.addIllnessMedicine({ episodeId, medId: item?.id || '', medicineName: name, dosage, note, time: new Date().toISOString() }).then(() => this.render(this.container));
  },
  async deleteIllnessMedicine(recordId) { if (!confirm('删除这条周期用药记录？')) return; await API.deleteIllnessMedicine(recordId); await this.render(this.container); },
  markTooth(position, index) { const date = prompt('出牙日期（YYYY-MM-DD）', this._todayStr()); if (!date) return; API.addTooth({ position, index, date }).then(() => this.render(this.container)); },
  async deleteTooth(id) { if (!confirm('删除这条出牙记录？')) return; await API.deleteTooth(id); await this.render(this.container); },

  _renderVaccineModule(pending, done) {
    const isAdmin = this.isAdmin;
    let html = '';

    // 权限提示（非管理员）
    if (!isAdmin) {
      html += `<div class="card med-tip-card" style="margin-bottom:12px">
        <p style="margin:0;font-size:12px;color:var(--color-highlight-deep, #8c6d00)">${Lucide.icon('eye', 14)} 当前为查看模式，只有家庭管理员可以编辑疫苗记录</p>
      </div>`;
    }

    // 疫苗知识卡
    html += this._renderVaccineKnowledge();

    // 疫苗进度概览
    const totalDoses = pending.length + done.length;
    html += `<div class="med-progress-bar" style="margin-bottom:12px">
      <div class="med-progress-info">
        <span style="color:var(--color-success-deep, #3E7B5C);font-weight:500">${Lucide.icon('check-circle', 14)} 已接种 ${done.length}</span>
        <span style="color:var(--color-highlight-deep, #8c6d00);font-weight:500">${Lucide.icon('clock', 14)} 待接种 ${pending.length}</span>
        <span style="color:var(--color-text-muted, #999)">${Lucide.icon('list', 14)} 共 ${totalDoses} 剂</span>
      </div>
    </div>`;

    // Tab 切换（2 tab）
    html += `<nav class="v3-subtabs medical-subtabs" role="tablist" aria-label="疫苗记录分类">
      <button type="button" class="v3-subtab ${this.currentTab === 'pending' ? 'is-active' : ''}" role="tab" aria-selected="${this.currentTab === 'pending'}" onclick="MedicalPage._switchTab('pending')">
        ${Lucide.icon('hourglass', 14)} <span>待接种 (${pending.length})</span>
      </button>
      <button type="button" class="v3-subtab ${this.currentTab === 'done' ? 'is-active' : ''}" role="tab" aria-selected="${this.currentTab === 'done'}" onclick="MedicalPage._switchTab('done')">
        ${Lucide.icon('check-circle', 14)} <span>已接种 (${done.length})</span>
      </button>
    </nav>`;

    if (this.currentTab === 'pending') {
      html += this._renderPending(pending);
    } else {
      html += this._renderDone(done);
    }

    return html;
  },

  _renderMedicationModule(medications, medList) {
    let html = '';

    // 用药知识卡
    html += this._renderMedicationKnowledge();

    // 子 Tab 切换（常备清单 / 用药记录）
    html += `<nav class="v3-subtabs medical-subtabs" role="tablist" aria-label="用药记录分类">
      <button type="button" class="v3-subtab ${this.currentMedTab === 'checklist' ? 'is-active' : ''}" role="tab" aria-selected="${this.currentMedTab === 'checklist'}" onclick="MedicalPage._switchMedTab('checklist')">
        ${Lucide.icon('clipboard-list', 14)} <span>常备清单 (${medList.reduce((s, c) => s + (c.items?.length || 0), 0)})</span>
      </button>
      <button type="button" class="v3-subtab ${this.currentMedTab === 'records' ? 'is-active' : ''}" role="tab" aria-selected="${this.currentMedTab === 'records'}" onclick="MedicalPage._switchMedTab('records')">
        ${Lucide.icon('pill', 14)} <span>用药记录 (${medications.length})</span>
      </button>
    </nav>`;

    // 禁用/慎用清单（两个 tab 都可见，紧贴子 tab 下方）
    html += this._renderProhibitedList();

    if (this.currentMedTab === 'checklist') {
      html += this._renderMedChecklist(medList);
    } else {
      html += this._renderMedication(medications);
    }

    return html;
  },

  _switchTab(tab) {
    this.currentTab = tab;
    this._render();
  },

  _switchMedTab(tab) {
    this.currentMedTab = tab;
    this._render();
  },

  /** 首页联动：切到用药记录 tab 并定位到指定日期 */
  showRecords(dateStr) {
    this.currentModule = 'medication';
    this.currentMedTab = 'records';
    this._medDate = dateStr || this._todayStr();
    this._render();
  },

  /** 首页提示条跳转：设置目标日期后切页（page render 时生效） */
  jumpToRecords() {
    this.currentModule = 'medication';
    this.currentMedTab = 'records';
    this._medDate = this._todayStr();
    showPage('medical');
  },

  _renderPending(pending) {
    const isAdmin = this.isAdmin;

    let html = '';

    // 管理员：新增疫苗按钮
    if (isAdmin) {
      html += `<div class="vaccine-add-section">
        <button class="btn btn-outline btn-block" onclick="MedicalPage._openAddVaccineForm()">
          ${Lucide.icon('plus', 18)} 新增待接种疫苗
        </button>
      </div>`;
    }

    if (pending.length === 0) {
      html += `<div class="card" style="text-align:center;padding: 32px 16px">
        <div class="empty-icon">${Lucide.icon('clipboard-list', 32)}</div>
        <p style="margin:8px 0;color:var(--text-secondary)">暂无待接种疫苗</p>
        <p style="margin:4px 0;font-size:12px;color:var(--text-tertiary)">点击上方按钮，从标准疫苗库选择添加</p>
      </div>`;
      return html;
    }

    html += `<div class="vaccine-list">`;
    for (const v of pending) {
      const key = this._vKey(v);
      let tagHtml = '';
      if (v.category === '二类') {
        tagHtml = '<span class="med-tag-fee" style="font-size:10px;color:#fa8c16;margin-left:4px;background:#fff7e6;padding:1px 4px;border-radius:3px">自费</span>';
      } else if (v.category === '一类') {
        tagHtml = '<span class="med-tag-fee" style="font-size:10px;color:#52c41a;margin-left:4px;background:#f6ffed;padding:1px 4px;border-radius:3px">免费</span>';
      } else {
        tagHtml = '<span style="font-size:10px;color:#999;margin-left:4px">[自定义]</span>';
      }

      html += `
        <div class="vaccine-card ${v.isNear ? 'near' : ''} ${v.isCustom ? 'vaccine-custom-item' : ''}">
          <div class="vaccine-header">
            <div class="vaccine-info">
              <div class="record-title">${Lucide.icon('syringe', 16)} ${Utils.escapeHtml(v.name)} <span class="vaccine-dose">${Utils.escapeHtml(v.dose)}</span>${tagHtml}</div>
              ${v.prevent ? `<div class="record-meta">预防：${v.prevent}</div>` : ''}
              ${v.route ? `<div class="record-meta">接种方式：${v.route} · ${v.site || '未知'}</div>` : ''}
              ${v.isNear ? `<div class="vaccine-alert">${Lucide.icon('alert-triangle', 14)} 接种日期临近</div>` : ''}
            </div>
          </div>`;

      // 仅管理员可编辑
      if (isAdmin) {
        html += `
          <div class="vaccine-actions">
            <div class="vaccine-date-row">
              <label>${Lucide.icon('calendar', 14)} 计划日期</label>
              <input type="date" class="form-input vaccine-date-input" id="vdate_${key}"
                value="${v.plannedDate || ''}"
                onchange="MedicalPage._setDate('${key}', this.value, ${v.isCustom})">
            </div>
            <button class="btn btn-primary btn-sm btn-block" onclick="MedicalPage._markDone('${key}', ${v.isCustom})">
              ${Lucide.icon('check-circle', 16)} 完成接种
            </button>
            ${v.isCustom ? `<button class="btn btn-outline btn-sm btn-block" style="color:var(--danger);margin-top:4px" onclick="MedicalPage._deleteCustom('${v.customId}')">${Lucide.icon('alert-triangle', 14)} 删除</button>` : ''}
          </div>`;
      } else {
        // 普通成员：只显示计划日期，不可编辑
        html += `<div class="vaccine-actions">
          <div class="record-meta" style="text-align:center">
            ${v.plannedDate ? Lucide.icon('calendar', 14) + ' 计划日期：' + v.plannedDate : Lucide.icon('calendar', 14) + ' 待管理员设置计划日期'}
          </div>
        </div>`;
      }

      // 标准疫苗才显示注意事项
      if (!v.isCustom) {
        html += `
          <div class="vaccine-notes">
            <p class="text-muted" style="font-size:11px">${Lucide.icon('heart-pulse', 14)} 常见反应：${v.reaction || '无明显反应'}</p>
            <p class="text-muted" style="font-size:11px">${Lucide.icon('alert-triangle', 14)} 紧急情况：${v.emergency || '出现异常请及时就医'}</p>
          </div>`;
      }

      html += `</div>`;
    }
    html += '</div>';
    return html;
  },

  _renderDone(done) {
    const isAdmin = this.isAdmin;
    if (done.length === 0) {
      return `<div class="card" style="text-align:center;padding: 32px 16px">
        <div class="empty-icon">${Lucide.icon('clipboard-list', 32)}</div>
        <p style="margin:8px 0">暂无已接种记录</p>
      </div>`;
    }

    let html = `<div class="vaccine-list">`;
    for (const v of done) {
      let tagHtml = '';
      if (v.category === '二类') {
        tagHtml = '<span class="med-tag-fee" style="font-size:10px;color:#fa8c16;margin-left:4px;background:#fff7e6;padding:1px 4px;border-radius:3px">自费</span>';
      } else if (v.category === '一类') {
        tagHtml = '<span class="med-tag-fee" style="font-size:10px;color:#52c41a;margin-left:4px;background:#f6ffed;padding:1px 4px;border-radius:3px">免费</span>';
      } else if (v.isCustom) {
        tagHtml = '<span style="font-size:10px;color:#999;margin-left:4px">[自定义]</span>';
      }
      const editKey = this._vKey(v);
      html += `
        <div class="vaccine-card done ${v.isCustom ? 'vaccine-custom-item' : ''}">
          <div class="vaccine-header">
            <div class="vaccine-info">
              <div class="record-title">${Lucide.icon('check-circle', 16)} ${Utils.escapeHtml(v.name)} <span class="vaccine-dose">${Utils.escapeHtml(v.dose)}</span>${tagHtml}</div>
              ${v.prevent ? `<div class="record-meta">预防：${v.prevent}</div>` : ''}
              <div class="record-meta" style="color:var(--success);font-weight:500">
                ${Lucide.icon('calendar', 14)} 接种日期：${v.doneDate || '已接种'}
              </div>
            </div>
          </div>`;

      // 管理员可修改接种日期 + 取消接种
      if (isAdmin) {
        html += `
          <div class="vaccine-actions">
            <div class="vaccine-date-row">
              <label>${Lucide.icon('calendar', 14)} 修改接种日期</label>
              <input type="date" class="form-input vaccine-date-input" id="ddate_${editKey}"
                value="${v.doneDate || ''}"
                onchange="MedicalPage._editDoneDate('${editKey}', ${v.isCustom}, this.value)">
            </div>
            <button class="btn btn-outline btn-sm btn-block" style="margin-top:4px" onclick="MedicalPage._undoDone('${editKey}', ${v.isCustom})">
              ${Lucide.icon('repeat', 16)} 取消接种
            </button>
          </div>`;
      }

      html += `</div>`;
    }
    html += '</div>';
    return html;
  },

  /** 设置计划接种日期（管理员） */
  _setDate(key, dateVal, isCustom) {
    if (!this.isAdmin) return;
    if (isCustom) {
      const list = this._getCustomVaccines();
      const item = list.find(cv => cv.customId === key);
      if (item) {
        item.plannedDate = dateVal;
        this._saveCustomVaccines(list);
      }
    } else {
      const records = this._getRecords();
      if (!records[key]) records[key] = {};
      records[key].plannedDate = dateVal;
      this._saveRecords(records);
    }
  },

  /** 标记完成接种（管理员）— 弹出日期选择 */
  _markDone(key, isCustom) {
    if (!this.isAdmin) { Utils.showToast('只有管理员可以操作'); return; }
    const today = new Date().toISOString().split('T')[0];
    // 尝试获取计划日期作为默认值
    let defaultDate = today;
    if (isCustom) {
      const list = this._getCustomVaccines();
      const item = list.find(cv => cv.customId === key);
      if (item && item.plannedDate) defaultDate = item.plannedDate;
    } else {
      const records = this._getRecords();
      if (records[key] && records[key].plannedDate) defaultDate = records[key].plannedDate;
    }
    this._showModal('完成接种', `
      <div class="form-group">
        <label>${Lucide.icon('calendar', 14)} 实际接种日期</label>
        <input type="date" id="done-date-input" class="form-input" value="${defaultDate}">
      </div>
      <div class="btn-group" style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" style="flex:1" onclick="MedicalPage._confirmDone('${key}', ${isCustom})">${Lucide.icon('check-circle', 16)} 确认完成</button>
        <button class="btn btn-outline" style="flex:1" onclick="MedicalPage._closeForm()">取消</button>
      </div>
    `);
  },

  /** 确认完成接种 */
  _confirmDone(key, isCustom) {
    const dateVal = document.getElementById('done-date-input')?.value || new Date().toISOString().split('T')[0];
    if (isCustom) {
      const list = this._getCustomVaccines();
      const item = list.find(cv => cv.customId === key);
      if (item) {
        item.plannedDate = item.plannedDate || dateVal;
        item.done = true;
        item.doneDate = dateVal;
        this._saveCustomVaccines(list);
      }
    } else {
      const records = this._getRecords();
      if (!records[key]) records[key] = {};
      records[key].done = true;
      records[key].doneDate = dateVal;
      this._saveRecords(records);
    }
    this._closeForm();
    Utils.showToast('接种已完成');
    this._render();
  },

  /** 修改已接种疫苗的接种日期（管理员） */
  _editDoneDate(key, isCustom, dateVal) {
    if (!this.isAdmin) return;
    if (isCustom) {
      const list = this._getCustomVaccines();
      const item = list.find(cv => cv.customId === key);
      if (item) {
        item.doneDate = dateVal;
        this._saveCustomVaccines(list);
      }
    } else {
      const records = this._getRecords();
      if (!records[key]) records[key] = {};
      records[key].doneDate = dateVal;
      this._saveRecords(records);
    }
    Utils.showToast('接种日期已更新');
  },

  /** 取消接种（将已接种移回待接种） */
  _undoDone(key, isCustom) {
    if (!this.isAdmin) { Utils.showToast('只有管理员可以操作'); return; }
    if (!confirm('确定要取消该接种记录吗？将移回待接种列表')) return;
    if (isCustom) {
      const list = this._getCustomVaccines();
      const item = list.find(cv => cv.customId === key);
      if (item) {
        item.done = false;
        delete item.doneDate;
        this._saveCustomVaccines(list);
      }
    } else {
      const records = this._getRecords();
      if (records[key]) {
        records[key].done = false;
        delete records[key].doneDate;
        this._saveRecords(records);
      }
    }
    Utils.showToast('已移回待接种列表');
    this._render();
  },

  /** 删除自定义疫苗（管理员） */
  _deleteCustom(customId) {
    if (!this.isAdmin) return;
    if (!confirm('确定要删除该自定义疫苗吗？')) return;
    const list = this._getCustomVaccines();
    this._saveCustomVaccines(list.filter(cv => cv.customId !== customId));
    Utils.showToast('已删除');
    this._render();
  },

  /** 打开新增疫苗弹窗（管理员） */
  _openAddVaccineForm() {
    if (!this.isAdmin) { Utils.showToast('只有管理员可以操作'); return; }

    // 收集标准疫苗列表中未在自定义列表中的疫苗，供选择
    const existingCustomNames = new Set(this.customVaccines.filter(cv => !cv.done).map(cv => cv.name + '_' + cv.dose));

    // 从 VACCINE_SCHEDULE 中收集所有唯一疫苗作为可选列表
    const allStdNames = new Map();
    if (typeof VACCINE_SCHEDULE !== 'undefined') {
      for (const item of VACCINE_SCHEDULE) {
        for (const v of (item.vaccines || [])) {
          const label = v.name + '·' + v.dose + '（预防' + (v.prevent || '未知') + '）';
          allStdNames.set(label, v);
        }
      }
    }

    // 过滤掉已添加的自定义疫苗
    const availOptions = [];
    for (const [label, v] of allStdNames) {
      const name = v.name + '_' + v.dose;
      if (!existingCustomNames.has(name)) {
        availOptions.push({ label, ...v });
      }
    }

    let selectOptions = availOptions.map(v =>
      `<option value="${Utils.escapeHtml(v.name)}|${Utils.escapeHtml(v.dose)}|${Utils.escapeHtml(v.prevent || '')}|${Utils.escapeHtml(v.route || '')}|${Utils.escapeHtml(v.site || '')}|${Utils.escapeHtml(v.category || '')}">${v.category === '二类' ? '[自费] ' : '[免费] '}${Utils.escapeHtml(v.name)} · ${Utils.escapeHtml(v.dose)}（预防${Utils.escapeHtml(v.prevent) || '未知'}）</option>`
    ).join('');

    this._showModal('新增待接种疫苗', `
      <p class="text-muted" style="font-size:12px;margin-bottom:8px">
        可从标准疫苗库中选择，或自定义填写
      </p>
      <div class="form-group">
        <label>${Lucide.icon('clipboard-list', 14)} 快速选择（标准疫苗）</label>
        <select id="av-select" class="form-input" onchange="MedicalPage._onVaccineSelect(this.value)">
          <option value="">-- 从标准库选择或手动填写下方 --</option>
          ${selectOptions}
        </select>
      </div>
      <div style="border-top:1px dashed #ddd;margin:12px 0;padding-top:8px;font-size:11px;color:var(--text-secondary)">或手动输入：</div>
      <div class="form-group"><label>疫苗名称 *</label><input type="text" id="av-name" class="form-input" placeholder="如：水痘疫苗"></div>
      <div class="form-group"><label>第几剂</label><input type="text" id="av-dose" class="form-input" placeholder="如：第1剂"></div>
      <div class="form-group"><label>预防疾病</label><input type="text" id="av-prevent" class="form-input" placeholder="如：水痘"></div>
      <div class="form-group"><label>接种方式</label><input type="text" id="av-route" class="form-input" placeholder="如：皮下注射"></div>
      <div class="form-group"><label>接种部位</label><input type="text" id="av-site" class="form-input" placeholder="如：上臂三角肌"></div>
      <input type="hidden" id="av-category" value="">
      <div class="form-group"><label>计划接种日期</label><input type="date" id="av-date" class="form-input"></div>
      <div class="btn-group" style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" style="flex:1" onclick="MedicalPage._doAddVaccine()">添加</button>
        <button class="btn btn-outline" style="flex:1" onclick="MedicalPage._closeForm()">取消</button>
      </div>
    `);
  },

  /** 从下拉选择自动填充表单 */
  _onVaccineSelect(val) {
    if (!val) return;
    const parts = val.split('|');
    if (parts.length >= 2) {
      const nameEl = document.getElementById('av-name');
      const doseEl = document.getElementById('av-dose');
      const preventEl = document.getElementById('av-prevent');
      const routeEl = document.getElementById('av-route');
      const siteEl = document.getElementById('av-site');
      if (nameEl) nameEl.value = parts[0];
      if (doseEl) doseEl.value = parts[1];
      if (preventEl && parts[2]) preventEl.value = parts[2];
      if (routeEl && parts[3] && parts[3] !== 'undefined') routeEl.value = parts[3];
      if (siteEl && parts[4] && parts[4] !== 'undefined') siteEl.value = parts[4];
      // parts[5] = category, 存入 hidden 字段
      const catEl = document.getElementById('av-category');
      if (catEl) catEl.value = parts[5] || '';
    }
  },

  /** 执行添加自定义疫苗 */
  _doAddVaccine() {
    if (!this.isAdmin) return;
    const nameEl = document.getElementById('av-name');
    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) { Utils.showToast('请输入疫苗名称'); return; }

    const dose = (document.getElementById('av-dose')?.value?.trim()) || '第1剂';
    const list = this._getCustomVaccines();
    const item = {
      customId: 'cv_' + Date.now(),
      name,
      dose,
      prevent: (document.getElementById('av-prevent')?.value?.trim()) || '',
      route: (document.getElementById('av-route')?.value?.trim()) || '',
      site: (document.getElementById('av-site')?.value?.trim()) || '',
      category: (document.getElementById('av-category')?.value?.trim()) || '',
      plannedDate: (document.getElementById('av-date')?.value) || '',
      done: false
    };
    list.push(item);
    this._saveCustomVaccines(list);
    this._closeForm();
    Utils.showToast('已添加: ' + name);
    this._render();
  },

  /** 弹窗辅助 */
  _showModal(title, bodyHtml) {
    let modal = document.getElementById('medical-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'medical-modal';
      modal.className = 'modal';
      document.body.appendChild(modal);
    }
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content" style="max-width:400px;max-height:80vh;overflow-y:auto">
      <h3 style="margin:0 0 12px">${title}</h3>
      ${bodyHtml}
    </div>`;
    modal.style.display = 'flex';
    modal.onclick = function(e) { if (e.target === modal) MedicalPage._closeForm(); };
  },

  _closeForm() {
    const modal = document.getElementById('medical-modal');
    if (modal) modal.style.display = 'none';
  },

  /** === 首页疫苗提醒接口 === */
  /** 获取未来3天内需接种的疫苗列表 */
  getDueSoonVaccines() {
    const baby = Utils.getBabyInfo();
    if (!baby || !baby.birthDate) return [];

    const allVaccines = Utils.getBabyVaccines(baby.birthDate) || [];
    let records = {};
    try { records = JSON.parse(localStorage.getItem('oneone_vaccine_records') || '{}'); } catch { /* ignore */ }
    let customVaccines = [];
    try { customVaccines = JSON.parse(localStorage.getItem('oneone_custom_vaccines') || '[]'); } catch { /* ignore */ }

    const dueSoon = [];

    // 标准疫苗
    for (const v of allVaccines) {
      const key = (v.fullCode || (v.name + '_' + v.dose)).replace(/\s/g, '_');
      if (records[key] && records[key].done) continue;
      const rec = records[key] || {};
      if (!rec.plannedDate) continue;
      const planned = new Date(rec.plannedDate);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      planned.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((planned - today) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 3) {
        dueSoon.push({ ...v, key, plannedDate: rec.plannedDate, daysUntil: diffDays, isCustom: false });
      }
    }

    // 自定义疫苗
    for (const cv of customVaccines) {
      if (cv.done) continue;
      if (!cv.plannedDate) continue;
      const planned = new Date(cv.plannedDate);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      planned.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((planned - today) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 3) {
        dueSoon.push({
          name: cv.name, dose: cv.dose, prevent: cv.prevent || '',
          key: cv.customId, plannedDate: cv.plannedDate,
          daysUntil: diffDays, isCustom: true
        });
      }
    }

    return dueSoon;
  },

  /** 首页快捷完成接种 */
  quickDone(key) {
    // 先从自定义疫苗查找
    let customVaccines = [];
    try { customVaccines = JSON.parse(localStorage.getItem('oneone_custom_vaccines') || '[]'); } catch { /* ignore */ }
    const cv = customVaccines.find(c => c.customId === key);
    if (cv) {
      cv.done = true;
      cv.doneDate = new Date().toISOString().split('T')[0];
      this._saveCustomVaccines(customVaccines);
    } else {
      let records = {};
      try { records = JSON.parse(localStorage.getItem('oneone_vaccine_records') || '{}'); } catch { /* ignore */ }
      if (!records[key]) records[key] = {};
      records[key].done = true;
      records[key].doneDate = new Date().toISOString().split('T')[0];
      this._saveRecords(records);
    }
    Utils.showToast('接种已完成');
    showPage('dashboard');
  },

  // ===== 疫苗知识折叠卡 =====
  _renderVaccineKnowledge() {
    const monthAge = this.monthAge;
    const items = (typeof getKnowledgeItemsByAge === 'function')
      ? getKnowledgeItemsByAge('vaccine', monthAge)
      : [];
    if (items.length === 0) return '';

    let bodyHtml = '';
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isOpen = (this._vacKnowOpenItem === i);
      bodyHtml += `
        <div class="ki-item" id="vac-know-item-${i}">
          <div class="ki-item-head" onclick="MedicalPage._toggleVacKnowItem(${i})">
            <span class="ki-brief">${Utils.escapeHtml(item.title)}</span>
            <span class="ki-arrow">${isOpen ? '▴' : '▾'}</span>
          </div>
          ${isOpen ? `<div class="ki-item-body"><div class="ki-content">${Utils.escapeHtml(item.content)}</div></div>` : ''}
        </div>`;
    }

    return `
      <div class="know-card">
        <div class="know-head" onclick="MedicalPage._toggleVacKnow()">
          <span class="know-title">${Lucide.icon('syringe', 16)} 本月疫苗知识</span>
          <span class="know-arrow">${this._vacKnowExpanded ? '▴' : '▾'}</span>
        </div>
        ${this._vacKnowExpanded ? `<div class="know-body">${bodyHtml}</div>` : ''}
      </div>`;
  },

  _toggleVacKnow() {
    this._vacKnowExpanded = !this._vacKnowExpanded;
    this._render();
  },

  _toggleVacKnowItem(idx) {
    this._vacKnowOpenItem = (this._vacKnowOpenItem === idx) ? -1 : idx;
    this._render();
  },

  // ===== 用药知识折叠卡 =====
  _renderMedicationKnowledge() {
    const monthAge = this.monthAge;
    const items = (typeof getKnowledgeItemsByAge === 'function')
      ? getKnowledgeItemsByAge('medication', monthAge)
      : [];
    if (items.length === 0) return '';

    let bodyHtml = '';
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isOpen = (this._medKnowOpenItem === i);
      bodyHtml += `
        <div class="ki-item" id="med-know-item-${i}">
          <div class="ki-item-head" onclick="MedicalPage._toggleMedKnowItem(${i})">
            <span class="ki-brief">${Utils.escapeHtml(item.title)}</span>
            <span class="ki-arrow">${isOpen ? '▴' : '▾'}</span>
          </div>
          ${isOpen ? `<div class="ki-item-body"><div class="ki-content">${Utils.escapeHtml(item.content)}</div></div>` : ''}
        </div>`;
    }

    return `
      <div class="know-card">
        <div class="know-head" onclick="MedicalPage._toggleMedKnow()">
          <span class="know-title">${Lucide.icon('pill', 16)} 本月用药知识</span>
          <span class="know-arrow">${this._medKnowExpanded ? '▴' : '▾'}</span>
        </div>
        ${this._medKnowExpanded ? `<div class="know-body">${bodyHtml}</div>` : ''}
      </div>`;
  },

  _toggleMedKnow() {
    this._medKnowExpanded = !this._medKnowExpanded;
    this._render();
  },

  _toggleMedKnowItem(idx) {
    this._medKnowOpenItem = (this._medKnowOpenItem === idx) ? -1 : idx;
    this._render();
  },

  // ===== v110 常备药清单渲染 =====
  _renderMedChecklist(medList) {
    let html = '';

    // 提示
    html += `<div class="card med-tip-card" style="margin-bottom:10px">
      <p style="margin:0;font-size:12px;color:var(--color-text-muted, #999)">${Lucide.icon('info', 14)} 常备药清单供家庭参考，数据云端共享。用药请遵医嘱。</p>
    </div>`;

    // 品类列表（全部默认折叠）
    html += `<div class="med-checklist">`;
    for (const cat of medList) {
      const expanded = this._expandedCats[cat.id] === true;
      const colorVar = `var(--color-${cat.color || 'inactive'}, #8F857B)`;
      const colorSoftVar = `var(--color-${cat.color || 'inactive'}-soft, #F1EFE8)`;

      html += `
        <div class="med-cat-card" style="border-left:3px solid ${colorVar}">
          <div class="med-cat-head" onclick="MedicalPage._toggleCat('${cat.id}')">
            <div class="med-cat-info">
              <span class="med-cat-dot" style="background:${colorVar}"></span>
              <div>
                <div class="med-cat-name">${Utils.escapeHtml(cat.name)}</div>
                <div class="med-cat-dir">${Utils.escapeHtml(cat.direction || '')}</div>
              </div>
            </div>
            <div class="med-cat-right">
              <span class="med-cat-count">${(cat.items || []).length} 种</span>
              <span class="med-cat-arrow">${expanded ? '▴' : '▾'}</span>
            </div>
          </div>`;

      if (expanded) {
        html += `<div class="med-cat-body">`;
        if (cat.items && cat.items.length > 0) {
          for (const item of cat.items) {
            html += `
              <div class="med-item">
                <div class="med-item-info">
                  <div class="med-item-name">${Lucide.icon('pill', 14)} ${Utils.escapeHtml(item.name)}</div>
                  ${item.dose ? `<div class="med-item-dose">${Lucide.icon('beaker', 12)} 剂量：${Utils.escapeHtml(item.dose)}</div>` : ''}
                  ${item.note ? `<div class="med-item-note">${Utils.escapeHtml(item.note)}</div>` : ''}
                </div>
                <div class="med-item-actions">
                  <button class="med-text-btn edit" onclick="event.stopPropagation();MedicalPage._openEditItemForm('${cat.id}', '${item.id}')">编辑</button>
                  <button class="med-text-btn danger" onclick="event.stopPropagation();MedicalPage._deleteItem('${cat.id}', '${item.id}')">删除</button>
                </div>
              </div>`;
          }
        } else {
          html += `<div class="med-item-empty">暂无药品</div>`;
        }
        html += `
          <button class="med-add-item-btn" onclick="MedicalPage._openAddItemForm('${cat.id}')">
            ${Lucide.icon('plus', 14)} 添加药品
          </button>
        </div>`;
      }

      // 品类操作（分割条样式）
      html += `<div class="med-cat-footer">
        <button class="med-text-btn edit" onclick="event.stopPropagation();MedicalPage._openEditCategoryForm('${cat.id}')">编辑品类</button>
        <span class="med-cat-footer-sep">|</span>
        <button class="med-text-btn danger" onclick="event.stopPropagation();MedicalPage._deleteCategory('${cat.id}')">删除品类</button>
      </div>`;

      html += `</div>`;
    }
    html += '</div>';

    // 新增品类按钮（底部，虚线边框）
    html += `<button class="med-add-cat-btn" onclick="MedicalPage._openAddCategoryForm()">
      ${Lucide.icon('plus', 16)} 新增品类
    </button>`;

    return html;
  },

  /** 禁用/慎用清单渲染（只读参考卡片） */
  _renderProhibitedList() {
    const expanded = this._prohibitedExpanded;
    let html = `
      <div class="med-prohibit-card">
        <div class="med-prohibit-head" onclick="MedicalPage._toggleProhibited()">
          <div class="med-prohibit-title">
            <span class="med-prohibit-icon">${Lucide.icon('alert-octagon', 18)}</span>
            <span>禁用 / 慎用药品清单</span>
            <span class="med-prohibit-count">${PROHIBITED_MED_LIST.length} 项</span>
          </div>
          <span class="med-cat-arrow">${expanded ? '▴' : '▾'}</span>
        </div>`;

    if (expanded) {
      html += `<div class="med-prohibit-body">`;
      for (const item of PROHIBITED_MED_LIST) {
        const isBan = item.level === '禁止';
        html += `
          <div class="med-prohibit-item">
            <span class="med-prohibit-tag ${isBan ? 'ban' : 'caution'}">${item.level}</span>
            <span class="med-prohibit-name">${Utils.escapeHtml(item.name)}</span>
            <span class="med-prohibit-risk">${Utils.escapeHtml(item.risk)}</span>
          </div>`;
      }
      html += `<div class="med-prohibit-footer">${Lucide.icon('info', 12)} 此清单为只读参考，不可编辑</div>`;
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  },

  _toggleProhibited() {
    this._prohibitedExpanded = !this._prohibitedExpanded;
    this._render();
  },

  _toggleCat(catId) {
    this._expandedCats[catId] = !this._expandedCats[catId];
    this._render();
  },

  /** 新增品类弹窗 */
  _openAddCategoryForm() {
    this._showModal('新增品类', `
      <div class="form-group"><label>品类名称 *</label><input type="text" id="cat-name" class="form-input" placeholder="如：感冒类"></div>
      <div class="form-group"><label>用药方向</label><input type="text" id="cat-direction" class="form-input" placeholder="如：缓解感冒症状"></div>
      <div class="form-group"><label>色标</label>
        <select id="cat-color" class="form-input">
          <option value="success">绿色</option>
          <option value="highlight">黄色</option>
          <option value="processing">蓝色</option>
          <option value="celebration">紫色</option>
          <option value="inactive">灰色</option>
        </select>
      </div>
      <div class="btn-group" style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" style="flex:1" onclick="MedicalPage._doAddCategory()">添加</button>
        <button class="btn btn-outline" style="flex:1" onclick="MedicalPage._closeForm()">取消</button>
      </div>
    `);
  },

  _doAddCategory() {
    const name = document.getElementById('cat-name')?.value.trim();
    if (!name) { Utils.showToast('请输入品类名称'); return; }
    const direction = document.getElementById('cat-direction')?.value.trim() || '';
    const color = document.getElementById('cat-color')?.value || 'inactive';
    const list = this._getMedList();
    list.push({ id: 'cat_' + Date.now(), name, direction, color, items: [] });
    this._medList = list;
    this._syncMedListCloud();
    this._closeForm();
    Utils.showToast('品类已添加');
    this._render();
  },

  /** 编辑品类 */
  _openEditCategoryForm(catId) {
    const list = this._getMedList();
    const cat = list.find(c => c.id === catId);
    if (!cat) return;
    this._showModal('编辑品类', `
      <div class="form-group"><label>品类名称 *</label><input type="text" id="cat-name" class="form-input" value="${Utils.escapeHtml(cat.name)}"></div>
      <div class="form-group"><label>用药方向</label><input type="text" id="cat-direction" class="form-input" value="${Utils.escapeHtml(cat.direction || '')}"></div>
      <div class="form-group"><label>色标</label>
        <select id="cat-color" class="form-input">
          <option value="success" ${cat.color === 'success' ? 'selected' : ''}>绿色</option>
          <option value="highlight" ${cat.color === 'highlight' ? 'selected' : ''}>黄色</option>
          <option value="processing" ${cat.color === 'processing' ? 'selected' : ''}>蓝色</option>
          <option value="celebration" ${cat.color === 'celebration' ? 'selected' : ''}>紫色</option>
          <option value="inactive" ${cat.color === 'inactive' ? 'selected' : ''}>灰色</option>
        </select>
      </div>
      <div class="btn-group" style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" style="flex:1" onclick="MedicalPage._doEditCategory('${catId}')">保存</button>
        <button class="btn btn-outline" style="flex:1" onclick="MedicalPage._closeForm()">取消</button>
      </div>
    `);
  },

  _doEditCategory(catId) {
    const name = document.getElementById('cat-name')?.value.trim();
    if (!name) { Utils.showToast('请输入品类名称'); return; }
    const direction = document.getElementById('cat-direction')?.value.trim() || '';
    const color = document.getElementById('cat-color')?.value || 'inactive';
    const list = this._getMedList();
    const cat = list.find(c => c.id === catId);
    if (cat) {
      cat.name = name;
      cat.direction = direction;
      cat.color = color;
      this._medList = list;
      this._syncMedListCloud();
    }
    this._closeForm();
    Utils.showToast('品类已更新');
    this._render();
  },

  _deleteCategory(catId) {
    if (!confirm('确定要删除该品类及其所有药品吗？')) return;
    const list = this._getMedList();
    this._medList = list.filter(c => c.id !== catId);
    this._syncMedListCloud();
    Utils.showToast('品类已删除');
    this._render();
  },

  /** 添加药品弹窗 */
  _openAddItemForm(catId) {
    this._showModal('添加药品', `
      <div class="form-group"><label>药品名称 *</label><input type="text" id="item-name" class="form-input" placeholder="如：维生素D3滴剂"></div>
      <div class="form-group"><label>剂量</label><input type="text" id="item-dose" class="form-input" placeholder="如：400IU/日"></div>
      <div class="form-group"><label>备注</label><input type="text" id="item-note" class="form-input" placeholder="如：出生后2周开始"></div>
      <div class="btn-group" style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" style="flex:1" onclick="MedicalPage._doAddItem('${catId}')">添加</button>
        <button class="btn btn-outline" style="flex:1" onclick="MedicalPage._closeForm()">取消</button>
      </div>
    `);
  },

  _doAddItem(catId) {
    const name = document.getElementById('item-name')?.value.trim();
    if (!name) { Utils.showToast('请输入药品名称'); return; }
    const dose = document.getElementById('item-dose')?.value.trim() || '';
    const note = document.getElementById('item-note')?.value.trim() || '';
    const list = this._getMedList();
    const cat = list.find(c => c.id === catId);
    if (cat) {
      if (!cat.items) cat.items = [];
      cat.items.push({ id: 'med_' + Date.now(), name, dose, note });
      this._medList = list;
      this._syncMedListCloud();
    }
    this._closeForm();
    Utils.showToast('药品已添加');
    this._render();
  },

  /** 编辑药品 */
  _openEditItemForm(catId, itemId) {
    const list = this._getMedList();
    const cat = list.find(c => c.id === catId);
    const item = cat?.items?.find(i => i.id === itemId);
    if (!item) return;
    this._showModal('编辑药品', `
      <div class="form-group"><label>药品名称 *</label><input type="text" id="item-name" class="form-input" value="${Utils.escapeHtml(item.name)}"></div>
      <div class="form-group"><label>剂量</label><input type="text" id="item-dose" class="form-input" value="${Utils.escapeHtml(item.dose || '')}"></div>
      <div class="form-group"><label>备注</label><input type="text" id="item-note" class="form-input" value="${Utils.escapeHtml(item.note || '')}"></div>
      <div class="btn-group" style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" style="flex:1" onclick="MedicalPage._doEditItem('${catId}', '${itemId}')">保存</button>
        <button class="btn btn-outline" style="flex:1" onclick="MedicalPage._closeForm()">取消</button>
      </div>
    `);
  },

  _doEditItem(catId, itemId) {
    const name = document.getElementById('item-name')?.value.trim();
    if (!name) { Utils.showToast('请输入药品名称'); return; }
    const dose = document.getElementById('item-dose')?.value.trim() || '';
    const note = document.getElementById('item-note')?.value.trim() || '';
    const list = this._getMedList();
    const cat = list.find(c => c.id === catId);
    const item = cat?.items?.find(i => i.id === itemId);
    if (item) {
      item.name = name;
      item.dose = dose;
      item.note = note;
      this._medList = list;
      this._syncMedListCloud();
    }
    this._closeForm();
    Utils.showToast('药品已更新');
    this._render();
  },

  _deleteItem(catId, itemId) {
    if (!confirm('确定要删除该药品吗？')) return;
    const list = this._getMedList();
    const cat = list.find(c => c.id === catId);
    if (cat && cat.items) {
      cat.items = cat.items.filter(i => i.id !== itemId);
      this._medList = list;
      this._syncMedListCloud();
    }
    Utils.showToast('药品已删除');
    this._render();
  },

  // ===== v113 用药记录列表渲染（按日期视图） =====
  _renderMedication(medications) {
    const isAdmin = this.isAdmin;
    const curDate = this._getMedDate();
    const today = this._todayStr();
    const isToday = curDate === today;
    const typeMap = this._medTypeMap();
    let html = '';

    // 日期翻页条
    html += `
      <div class="med-date-bar">
        <button class="med-date-arrow" onclick="MedicalPage._shiftMedDate(-1)">‹</button>
        <div class="med-date-center" onclick="MedicalPage._medGoToday()">
          <div class="med-date-main">${Utils.escapeHtml(this._fmtMedDate(curDate))}</div>
          ${isToday ? '<div class="med-date-today-tag">今天</div>' : ''}
        </div>
        <button class="med-date-arrow" onclick="MedicalPage._shiftMedDate(1)">›</button>
      </div>`;

    // v116：用药记录 Tab 不再展示当月总体统计（_renderMedMonthSummary 方法保留备用）

    // 管理员：新增用药记录按钮（只显示在当前查看的日期有记录时不特别处理，恒定显示）
    html += `<div class="vaccine-add-section">
      <button class="btn btn-outline btn-block" onclick="MedicalPage._openAddMedicationForm()">
        ${Lucide.icon('plus', 16)} 记一笔（${Utils.escapeHtml(curDate)}）
      </button>
    </div>`;

    // 当日记录
    const dayRecs = medications
      .filter(m => (m.date || '') === curDate)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    if (dayRecs.length === 0) {
      html += `<div class="card" style="text-align:center;padding: 32px 16px">
        <div class="empty-icon">${Lucide.icon('pill', 32)}</div>
        <p style="margin:8px 0;color:var(--text-secondary)">${isToday ? '今天没有用药记录' : '这一天没有用药记录'}</p>
        <p style="margin:4px 0;font-size:12px;color:var(--text-tertiary)">点击上方"记一笔"，记录 ${Utils.escapeHtml(curDate)} 的用药情况</p>
      </div>`;
    } else {
      html += `<div class="med-day-timeline">`;
      for (const med of dayRecs) {
        const typeName = typeMap[med.medId] || med.type || '';
        const tagHtml = typeName
          ? `<span class="med-type-tag">${Utils.escapeHtml(typeName)}</span>`
          : '';
        html += `
          <div class="med-day-item">
            <div class="med-day-time">${Utils.escapeHtml(med.time || '--:--')}</div>
            <div class="med-day-dot"></div>
            <div class="med-day-body">
              <div class="record-title">${Lucide.icon('pill', 15)} ${Utils.escapeHtml(med.name)} ${med.dose ? '<span class="vaccine-dose">' + Utils.escapeHtml(med.dose) + '</span>' : ''}${tagHtml}</div>
              ${med.notes ? `<div class="med-day-notes">${Lucide.icon('clipboard-list', 12)} ${Utils.escapeHtml(med.notes)}</div>` : ''}
              ${isAdmin ? `<div class="med-day-ops"><button class="med-day-edit" onclick="MedicalPage._openEditMedication('${Utils.jsAttr(med.id)}')">${Lucide.icon('pencil', 13)}</button><button class="med-day-del" onclick="MedicalPage._deleteMedication('${Utils.jsAttr(med.id)}')">${Lucide.icon('trash-2', 13)}</button></div>` : ''}
            </div>
          </div>`;
      }
      html += `</div>`;
    }

    return html;
  },

  /** 当月各类用药汇总（品类条形图） */
  _renderMedMonthSummary(medications) {
    const today = this._todayStr();
    const monthPrefix = today.slice(0, 7); // YYYY-MM
    const typeMap = this._medTypeMap();

    // 统计当月各品类次数
    const countMap = {};
    let total = 0;
    for (const m of medications) {
      if (!m.date || m.date.slice(0, 7) !== monthPrefix) continue;
      const typeName = typeMap[m.medId || m.id] || m.type || '其他';
      countMap[typeName] = (countMap[typeName] || 0) + 1;
      total++;
    }

    const entries = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
    const isEmpty = total === 0;

    let barsHtml = '';
    if (!isEmpty) {
      const max = entries[0][1] || 1;
      barsHtml = entries.map(([name, cnt]) => {
        const pct = Math.round((cnt / max) * 100);
        const hue = (name.length * 37) % 360;
        return `
          <div class="med-sum-row">
            <span class="med-sum-name">${Utils.escapeHtml(name)}</span>
            <div class="med-sum-track"><div class="med-sum-bar" style="width:${pct}%;background:hsl(${hue},65%,55%)"></div></div>
            <span class="med-sum-cnt">${cnt}次</span>
          </div>`;
      }).join('');
    }

    return `
      <div class="card med-sum-card">
        <div class="card-title">${Lucide.icon('bar-chart-3', 16)} 当月用药汇总 <span class="text-muted" style="font-size:11px;font-weight:400">${monthPrefix}</span></div>
        ${isEmpty
          ? `<div class="med-sum-empty">本月暂无用药记录</div>`
          : `<div class="med-sum-total">共 ${total} 次，覆盖 ${entries.length} 类</div><div class="med-sum-bars">${barsHtml}</div>`}
      </div>`;
  },

  /** 打开新增用药记录弹窗 */
  /** 打开新增/编辑用药记录弹窗（editMed 存在则进入编辑模式并预填） */
  _openAddMedicationForm(editMed) {
    if (!this.isAdmin) { Utils.showToast('只有管理员可以操作'); return; }

    const isEdit = !!editMed;
    const medList = this._getMedList();

    // 新增：日期默认当前查看日期，时间默认当下时分秒(支持秒)
    // 编辑：预填记录原值
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const defaultDate = this._getMedDate();
    const defaultTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const preDate = isEdit ? (editMed.date || defaultDate) : defaultDate;
    const preTime = isEdit ? (editMed.time || defaultTime) : defaultTime;
    const preDose = isEdit ? (editMed.dose || '') : '';
    const preType = isEdit ? (editMed.type || '') : '';
    const preNotes = isEdit ? (editMed.notes || '') : '';

    // 记录原药品 id（编辑回显用）
    // 优先用 v114 新增的 medId；旧记录没有 medId 时，尝试用 name 在常备清单内匹配
    let preSelId = '';
    let preName = '';
    let isCustomMed = false; // 编辑时是否按"自定义药品"预填
    if (isEdit) {
      preName = editMed.name || '';
      const matched = this._matchMedItem(editMed);
      if (matched) {
        preSelId = matched.id;
      } else {
        // 记录里带 medId 但清单中已删除，或 legacy 时间戳 id，按自定义预填
        isCustomMed = true;
      }
    }

    // 按品类分组构建 optgroup
    let optgroupHtml = '';
    for (const cat of medList) {
      if (cat.items && cat.items.length > 0) {
        const items = cat.items.map(item => {
          const data = `${Utils.escapeHtml(item.name)}|||${Utils.escapeHtml(cat.name)}|||${Utils.escapeHtml(item.dose || '')}`;
          const sel = item.id === preSelId ? ' selected' : '';
          return `<option value="${Utils.escapeHtml(item.id)}"${sel} data-info="${data}">${Utils.escapeHtml(item.name)}</option>`;
        }).join('');
        optgroupHtml += `<optgroup label="${Utils.escapeHtml(cat.name)}">${items}</optgroup>`;
      }
    }

    // 编辑模式：若原记录来自自定义药品，预填 name 并默认选自定义项
    const selCustom = isCustomMed ? ' selected' : '';
    const customNameValue = isCustomMed ? Utils.escapeHtml(preName) : '';
    // 类型字段：编辑时若来自常备清单药品则只读，自定义则可编辑
    const typeReadonly = preSelId ? 'readonly' : '';

    this._showModal(`${isEdit ? Lucide.icon('pencil', 18) + ' 编辑用药记录' : Lucide.icon('plus', 18) + ' 新增用药记录'}`, `
      <div class="form-group">
        <label>药品名称 *</label>
        <select id="med-select" class="form-input" onchange="MedicalPage._onMedSelectChange()">
          <option value="">-- 选择药品 --</option>
          ${optgroupHtml}
          <option value="__custom__"${selCustom}>自定义药品</option>
        </select>
        <input type="text" id="med-name" class="form-input" style="display:${customNameValue ? '' : 'none'};margin-top:8px" placeholder="输入药品名称" value="${customNameValue}">
      </div>
      <div class="form-group">
        <label>剂量</label>
        <input type="text" id="med-dose" class="form-input" placeholder="如：400IU / 1滴" value="${Utils.escapeHtml(preDose)}">
      </div>
      <div class="form-group">
        <label>类型</label>
        <input type="text" id="med-type" class="form-input" ${typeReadonly ? 'readonly' : ''} value="${Utils.escapeHtml(preType)}" placeholder="选择药品后自动带出" style="background:${typeReadonly ? 'var(--color-bg-sunken,#f5f5f5)' : ''}">
      </div>
      <div class="form-group">
        <label>日期</label>
        <input type="date" id="med-date" class="form-input" value="${Utils.escapeHtml(preDate)}">
      </div>
      <div class="form-group">
        <label>时间</label>
        <input type="time" id="med-time" class="form-input" step="1" value="${Utils.escapeHtml(preTime)}">
      </div>
      <div class="form-group">
        <label>备注</label>
        <input type="text" id="med-notes" class="form-input" placeholder="如：早餐后服用" value="${Utils.escapeHtml(preNotes)}">
      </div>
      <div class="btn-group" style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" style="flex:1" onclick="MedicalPage._doAddMedication('${isEdit ? 'edit' : 'add'}', '${Utils.jsAttr(editMed ? editMed.id : '')}')">${isEdit ? '保存' : '添加'}</button>
        <button class="btn btn-outline" style="flex:1" onclick="MedicalPage._closeForm()">取消</button>
      </div>
    `);
  },

  /** 药品选择变更时自动带出类型和剂量 */
  _onMedSelectChange() {
    const select = document.getElementById('med-select');
    const nameInput = document.getElementById('med-name');
    const doseInput = document.getElementById('med-dose');
    const typeInput = document.getElementById('med-type');
    const val = select.value;

    if (val === '__custom__') {
      nameInput.style.display = '';
      nameInput.focus();
      doseInput.value = '';
      typeInput.value = '';
      typeInput.readOnly = false;
      typeInput.style.background = '';
      typeInput.placeholder = '输入类型';
    } else if (val) {
      const opt = select.options[select.selectedIndex];
      const data = opt.getAttribute('data-info') || '';
      const [name, type, dose] = data.split('|||');
      nameInput.style.display = 'none';
      nameInput.value = name;
      doseInput.value = dose;
      typeInput.value = type;
      typeInput.readOnly = true;
      typeInput.style.background = 'var(--color-bg-sunken,#f5f5f5)';
    } else {
      nameInput.style.display = 'none';
      nameInput.value = '';
      doseInput.value = '';
      typeInput.value = '';
      typeInput.readOnly = true;
    }
  },

  /** 执行添加/编辑用药记录（mode: 'add' | 'edit'，editId 为被编辑记录 id） */
  _doAddMedication(mode, editId) {
    if (!this.isAdmin) return;
    const select = document.getElementById('med-select');
    const nameInput = document.getElementById('med-name');
    const selectVal = select ? select.value : '';

    let name = '';
    let medId = ''; // 对应常备清单中的药品 id（若非自定义）
    if (selectVal === '__custom__') {
      name = nameInput ? nameInput.value.trim() : '';
      medId = '';
    } else if (selectVal) {
      const opt = select.options[select.selectedIndex];
      const data = opt.getAttribute('data-info') || '';
      name = data.split('|||')[0] || '';
      medId = selectVal; // 保留常备清单药品 id，供类型统计/编辑回显
    }

    if (!name) { Utils.showToast('请选择或输入药品名称'); return; }

    const list = this._getMedications();
    const isEdit = mode === 'edit' && !!editId;
    const record = {
      id: isEdit ? editId : 'med_' + Date.now(),
      medId, // v114 记录常备清单药品 id（新增/编辑统一）
      name,
      dose: (document.getElementById('med-dose')?.value?.trim()) || '',
      type: (document.getElementById('med-type')?.value) || '',
      date: (document.getElementById('med-date')?.value) || '',
      time: (document.getElementById('med-time')?.value) || '',
      notes: (document.getElementById('med-notes')?.value?.trim()) || '',
      createdAt: isEdit ? (this._findMedication(editId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    if (isEdit) {
      const idx = list.findIndex(m => m.id === editId);
      if (idx === -1) { Utils.showToast('记录不存在'); return; }
      list[idx] = record;
      Utils.showToast('已更新: ' + name);
    } else {
      list.push(record);
      Utils.showToast('已添加: ' + name);
    }

    this._saveMedications(list);
    this._closeForm();
    this._render();
  },

  /** 按 id 查找用药记录 */
  _findMedication(id) {
    return this._getMedications().find(m => m.id === id) || null;
  },

  /** 编辑回显：把记录关联回常备清单药品条目（优先 medId，找不到再用名称匹配） */
  _matchMedItem(med) {
    const medList = this._getMedList();
    for (const cat of medList) {
      for (const item of (cat.items || [])) {
        if (item.id === med.medId) return item;
      }
    }
    // 名称精确匹配（兼容旧记录无 medId）
    for (const cat of medList) {
      for (const item of (cat.items || [])) {
        if (item.name === med.name) return item;
      }
    }
    return null;
  },

  /** 打开编辑用药记录弹窗 */
  _openEditMedication(id) {
    if (!this.isAdmin) { Utils.showToast('只有管理员可以操作'); return; }
    const med = this._findMedication(id);
    if (!med) { Utils.showToast('记录不存在'); return; }
    this._openAddMedicationForm(med);
  },

  /** 删除用药记录 */
  _deleteMedication(id) {
    if (!this.isAdmin) { Utils.showToast('只有管理员可以操作'); return; }
    if (!confirm('确定要删除该用药记录吗？')) return;
    const list = this._getMedications();
    this._saveMedications(list.filter(m => m.id !== id));
    Utils.showToast('已删除');
    this._render();
  }
};

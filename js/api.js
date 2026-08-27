/**
 * API 模块 — 封装云函数调用
 */
window.API = {
  /** 获取存储的 token */
  _getToken() {
    const auth = Utils.storage.get('auth');
    return auth?.token || null;
  },

  async call(name, data, opts) {
    const url = `${APP_CONFIG.apiBaseUrl}/${name}`;
    const headers = { 'Content-Type': 'application/json' };
    // 从 localStorage 获取 JWT token，通过 Authorization header 发送
    const token = this._getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    let res;
    // v67：请求超时保护。弱网/云函数网关挂起时 fetch 可能永久 pending，
    // 导致页面（如设置页）无限等待白屏。15s 强制中断，调用方走错误分支。
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        signal: controller ? controller.signal : undefined
      });
    } catch (e) {
      // 网络错误（离线/超时）—— 附加标记，调用方可区分
      const err = new Error(e && e.name === 'AbortError' ? '请求超时，请检查网络' : (e.message || '网络连接失败'));
      err.isNetworkError = true;
      // R8 离线写入队列：简单写操作（喂养/排便/睡眠/清洁/足迹）入队，返回乐观成功
      if (!(opts && opts.skipQueue) && this._canQueue(name, data)) {
        const pending = Utils._enqueuePending({ name, data });
        return { queued: true, pending };
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
    // 区分 HTTP 状态码
    if (res.status === 401 || res.status === 403) {
      const err = new Error('登录已过期，请重新登录');
      err.isAuthError = true;
      err.httpStatus = res.status;
      throw err;
    }
    const result = await res.json();
    if (result.code !== 0) {
      const err = new Error(result.msg || '请求失败');
      // CloudBase 业务错误码：4008=未授权 4009=token过期（禁止引用未定义的 common 变量）
      if (result.code === 401 || result.code === 403 || result.code === 4008 || result.code === 4009) {
        err.isAuthError = true;
      }
      throw err;
    }
    // 写操作响应携带 dataVersion → 同步本地版本号缓存（避免轮询误判自己的操作）
    if (result.data && result.data.dataVersion != null) {
      Utils.storage.set('dv', result.data.dataVersion);
    }
    return result.data;
  },

  // ===== 喂养 =====
  async createFeeding(record) {
    return this.call(APP_CONFIG.functions.feeding, {
      action: 'create', payload: { ...record, familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId(), inputMethod: record.inputMethod || 'table' }
    });
  },
  async listFeeding(params = {}) {
    return this.call(APP_CONFIG.functions.feeding, {
      action: 'list', payload: { babyId: Auth.getBabyId(), memberId: Auth.getMemberId(), ...params }
    });
  },
  async feedingTodaySummary() {
    return this.call(APP_CONFIG.functions.feeding, {
      action: 'todaySummary', payload: { babyId: Auth.getBabyId(), memberId: Auth.getMemberId() }
    });
  },
  async deleteFeeding(recordId) {
    return API.call(APP_CONFIG.functions.feeding, { action: 'delete', payload: { recordId, memberId: Auth.getMemberId() } });
  },
  // v73：更新喂养记录（默认上次/一键回溯改 type 依赖）
  async updateFeeding(recordId, data) {
    return this.call(APP_CONFIG.functions.feeding, { action: 'update', payload: { recordId, memberId: Auth.getMemberId(), ...data } });
  },
  async listBreastPumpTests() { return this.call(APP_CONFIG.functions.feeding, { action: 'listPumpTests', payload: { babyId: Auth.getBabyId() } }); },
  async addBreastPumpTest(record) { return this.call(APP_CONFIG.functions.feeding, { action: 'addPumpTest', payload: { babyId: Auth.getBabyId(), ...record } }); },
  async deleteBreastPumpTest(recordId) { return this.call(APP_CONFIG.functions.feeding, { action: 'deletePumpTest', payload: { babyId: Auth.getBabyId(), recordId } }); },
  async listCheckups() { return this.call(APP_CONFIG.functions.healthManagement, { action: 'listCheckups', payload: { babyId: Auth.getBabyId() } }); },
  async addCheckup(record) { return this.call(APP_CONFIG.functions.healthManagement, { action: 'addCheckup', payload: { babyId: Auth.getBabyId(), ...record } }); },
  async updateCheckup(recordId, record) { return this.call(APP_CONFIG.functions.healthManagement, { action: 'updateCheckup', payload: { babyId: Auth.getBabyId(), recordId, ...record } }); },
  async deleteCheckup(recordId) { return this.call(APP_CONFIG.functions.healthManagement, { action: 'deleteCheckup', payload: { babyId: Auth.getBabyId(), recordId } }); },

  // ===== 保险管理 =====
  async listInsurances() { return this.call(APP_CONFIG.functions.insurance, { action: 'list', payload: { babyId: Auth.getBabyId() } }); },
  async addInsurance(record) { return this.call(APP_CONFIG.functions.insurance, { action: 'add', payload: { babyId: Auth.getBabyId(), ...record } }); },
  async updateInsurance(recordId, record) { return this.call(APP_CONFIG.functions.insurance, { action: 'update', payload: { babyId: Auth.getBabyId(), recordId, ...record } }); },
  async deleteInsurance(recordId) { return this.call(APP_CONFIG.functions.insurance, { action: 'delete', payload: { babyId: Auth.getBabyId(), recordId } }); },

  // ===== 排便（含小便/尿不湿） =====
  async createStool(record) {
    return this.call(APP_CONFIG.functions.stool, {
      action: 'create', payload: { ...record, familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId(), inputMethod: record.inputMethod || 'table' }
    });
  },
  async listStool(params = {}) {
    return this.call(APP_CONFIG.functions.stool, {
      action: 'list', payload: { babyId: Auth.getBabyId(), memberId: Auth.getMemberId(), ...params }
    });
  },
  async stoolTodaySummary() {
    return this.call(APP_CONFIG.functions.stool, {
      action: 'todaySummary', payload: { babyId: Auth.getBabyId(), memberId: Auth.getMemberId() }
    });
  },
  async deleteStool(recordId) {
    return API.call(APP_CONFIG.functions.stool, { action: 'delete', payload: { recordId, memberId: Auth.getMemberId() } });
  },
  // v73：更新排便记录（量级修正等）
  async updateStool(recordId, data) {
    return this.call(APP_CONFIG.functions.stool, { action: 'update', payload: { recordId, memberId: Auth.getMemberId(), ...data } });
  },

  // ===== 拍照AI =====
  async recognizeStoolPhoto(imageBase64) {
    return this.call(APP_CONFIG.functions.stoolAi, { action: 'recognize', payload: { imageBase64, memberId: Auth.getMemberId() } });
  },

  // ===== 睡眠 =====
  async createSleep(record) {
    return this.call(APP_CONFIG.functions.sleep, {
      action: 'create', payload: { ...record, familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId() }
    });
  },
  async listSleep(params = {}) {
    return this.call(APP_CONFIG.functions.sleep, {
      action: 'list', payload: { babyId: Auth.getBabyId(), ...params }
    });
  },
  async sleepTodaySummary() {
    return this.call(APP_CONFIG.functions.sleep, {
      action: 'todaySummary', payload: { babyId: Auth.getBabyId() }
    });
  },
  async deleteSleep(recordId) {
    return API.call(APP_CONFIG.functions.sleep, { action: 'delete', payload: { recordId } });
  },
  // v73：更新睡眠记录（手工记录编辑）
  async updateSleep(recordId, data) {
    return this.call(APP_CONFIG.functions.sleep, { action: 'update', payload: { recordId, ...data } });
  },

  // ===== 成长 =====
  async createGrowth(record) {
    return this.call(APP_CONFIG.functions.growth, {
      action: 'create', payload: { ...record, familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId() }
    });
  },
  async listGrowth(page = 1) {
    return this.call(APP_CONFIG.functions.growth, {
      action: 'list', payload: { babyId: Auth.getBabyId(), page }
    });
  },
  async latestGrowth() {
    return this.call(APP_CONFIG.functions.growth, {
      action: 'latest', payload: { babyId: Auth.getBabyId() }
    });
  },
  async deleteGrowth(recordId) {
    return API.call(APP_CONFIG.functions.growth, { action: 'delete', payload: { recordId } });
  },

  // ===== 健康 =====
  async createHealth(record) {
    return this.call(APP_CONFIG.functions.health, {
      action: 'create', payload: { ...record, familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId() }
    });
  },
  async listHealth(params = {}) {
    return this.call(APP_CONFIG.functions.health, {
      action: 'list', payload: { babyId: Auth.getBabyId(), ...params }
    });
  },
  async healthTodaySummary() {
    return this.call(APP_CONFIG.functions.health, {
      action: 'todaySummary', payload: { babyId: Auth.getBabyId() }
    });
  },
  async deleteHealth(recordId) {
    return API.call(APP_CONFIG.functions.health, { action: 'delete', payload: { recordId } });
  },

  // ===== 早教里程碑 =====
  async createMilestone(record) {
    return this.call(APP_CONFIG.functions.milestone, {
      action: 'create', payload: { ...record, familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId() }
    });
  },
  async listMilestone() {
    return this.call(APP_CONFIG.functions.milestone, {
      action: 'list', payload: { babyId: Auth.getBabyId() }
    });
  },
  async uploadMilestonePhoto(imageBase64) {
    return this.call(APP_CONFIG.functions.milestone, {
      action: 'uploadPhoto', payload: { babyId: Auth.getBabyId(), imageBase64 }
    });
  },
  /** v76 #310：修改里程碑（补备注/改日期等），recordId + 局部字段（v83 合并） */
  async updateMilestone(recordId, patch) {
    return this.call(APP_CONFIG.functions.milestone, {
      action: 'update', payload: { recordId, ...(patch || {}) }
    });
  },
  async deleteMilestone(recordId) {
    return API.call(APP_CONFIG.functions.milestone, { action: 'delete', payload: { recordId } });
  },

  // ===== 待办事项 =====
  async createTodo(title, date) {
    return this.call(APP_CONFIG.functions.todo, {
      action: 'create', payload: { title, date, familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId() }
    });
  },
  async listTodo(params = {}) {
    return this.call(APP_CONFIG.functions.todo, {
      action: 'list', payload: { babyId: Auth.getBabyId(), ...params }
    });
  },
  async todayTodo() {
    return this.call(APP_CONFIG.functions.todo, {
      action: 'todayList', payload: { babyId: Auth.getBabyId() }
    });
  },
  async completeTodo(recordId) {
    return this.call(APP_CONFIG.functions.todo, {
      action: 'complete', payload: { recordId }
    });
  },
  async uncompleteTodo(recordId) {
    return this.call(APP_CONFIG.functions.todo, {
      action: 'uncomplete', payload: { recordId }
    });
  },
  async deleteTodo(recordId) {
    return API.call(APP_CONFIG.functions.todo, {
      action: 'delete', payload: { recordId }
    });
  },
  async updateTodo(recordId, title, date) {
    return this.call(APP_CONFIG.functions.todo, {
      action: 'update', payload: { recordId, title, date }
    });
  },
  async listTodoByDate(date) {
    return this.call(APP_CONFIG.functions.todo, {
      action: 'listByDate', payload: { babyId: Auth.getBabyId(), date }
    });
  },

  // ===== 宝宝 =====
  async createBaby(data) {
    return this.call(APP_CONFIG.functions.baby, { action: 'create', payload: { ...data, familyId: Auth.getFamilyId(), memberId: Auth.getMemberId() } });
  },
  async getBabies() {
    return this.call(APP_CONFIG.functions.baby, { action: 'get', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId() } });
  },
  async updateBaby(data) {
    return this.call(APP_CONFIG.functions.baby, { action: 'update', payload: { ...data, familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId() } });
  },
  async uploadBabyAvatar(imageBase64) {
    return this.call(APP_CONFIG.functions.baby, { action: 'uploadAvatar', payload: { babyId: Auth.getBabyId(), imageBase64 } });
  },
  async listScreenings() { return this.call(APP_CONFIG.functions.screening, { action: 'list', payload: { babyId: Auth.getBabyId() } }); },
  async addScreening(record) { return this.call(APP_CONFIG.functions.screening, { action: 'add', payload: { babyId: Auth.getBabyId(), ...record } }); },
  async deleteScreening(recordId) { return this.call(APP_CONFIG.functions.screening, { action: 'delete', payload: { babyId: Auth.getBabyId(), recordId } }); },

  // ===== 邀请码 =====
  async getInviteCode() {
    return this.call(APP_CONFIG.functions.inviteCode, { action: 'generate', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId() } });
  },
  async validateInviteCode(code) {
    return this.call(APP_CONFIG.functions.inviteCode, { action: 'validate', payload: { inviteCode: code } });
  },

  // ===== 报表/导出 =====
  async dailyReport() {
    return this.call(APP_CONFIG.functions.report, { action: 'daily', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId() } });
  },
  async weeklyReport() {
    return this.call(APP_CONFIG.functions.report, { action: 'weekly', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId() } });
  },
  async pushReport(pushToken, silent) {
    // silent=true 用于前端定时自动推送，不打断用户操作
    if (!silent) Utils.showLoading('生成报表并推送中...');
    try { return await this.call(APP_CONFIG.functions.report, { action: 'push', payload: { pushToken, babyId: Auth.getBabyId() } }); }
    finally { if (!silent) Utils.hideLoading(); }
  },
  async exportAll() {
    Utils.showLoading('正在导出全部数据...');
    try { return await this.call(APP_CONFIG.functions.export, { action: 'exportAll', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), includeDeleted: false } }); }
    finally { Utils.hideLoading(); }
  },

  // ===== 绑定码/PushToken =====
  async generateBindingCode() {
    return this.call(APP_CONFIG.functions.auth, { action: 'generateBindingCode', payload: { memberId: Auth.getMemberId() } });
  },
  async bindAccount(code) {
    return this.call(APP_CONFIG.functions.auth, { action: 'bindAccount', payload: { memberId: Auth.getMemberId(), code } });
  },
  async savePushToken(pushToken) {
    return this.call(APP_CONFIG.functions.auth, { action: 'savePushToken', payload: { memberId: Auth.getMemberId(), pushToken } });
  },

  // ===== 家庭 =====
  async getFamilyInfo() {
    return this.call(APP_CONFIG.functions.family, { action: 'getInfo', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId() } });
  },
  // P5 · 家庭级界面灰度（仅管理员）：uiVersion = 'v1'|'v2'|'rollback'|''（空=关闭）
  async saveUIversion(uiVersion) {
    return this.call(APP_CONFIG.functions.family, {
      action: 'saveUIversion', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), uiVersion }
    });
  },
  async updateMemberRole(targetMemberId, newRole) {
    return this.call(APP_CONFIG.functions.family, {
      action: 'updateMemberRole', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), targetMemberId, newRole }
    });
  },
  async removeMember(targetMemberId) {
    return this.call(APP_CONFIG.functions.family, {
      action: 'removeMember', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), targetMemberId }
    });
  },
  async saveDashboardSettings(settings) {
    return this.call(APP_CONFIG.functions.family, {
      action: 'saveDashboardSettings', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), settings }
    });
  },

  // ===== 清洁/护理 =====
  async createClean(record) {
    return this.call(APP_CONFIG.functions.clean, {
      action: 'create', payload: { ...record, familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId(), inputMethod: record.inputMethod || 'quick' }
    });
  },
  async listClean(params = {}) {
    return this.call(APP_CONFIG.functions.clean, {
      action: 'list', payload: { babyId: Auth.getBabyId(), memberId: Auth.getMemberId(), ...params }
    });
  },
  async cleanTodaySummary() {
    return this.call(APP_CONFIG.functions.clean, {
      action: 'todaySummary', payload: { babyId: Auth.getBabyId(), memberId: Auth.getMemberId() }
    });
  },
  async deleteClean(recordId) {
    return API.call(APP_CONFIG.functions.clean, { action: 'delete', payload: { recordId, memberId: Auth.getMemberId() } });
  },

  // ===== 推送配置 =====
  async savePushConfig(config) {
    return this.call(APP_CONFIG.functions.auth, { action: 'savePushConfig', payload: { memberId: Auth.getMemberId(), ...config } });
  },
  async getProfile() {
    return this.call(APP_CONFIG.functions.auth, { action: 'getProfile', payload: { memberId: Auth.getMemberId() } });
  },

  // ===== 下楼溜溜（足迹） =====
  async createWalk(record) {
    return this.call(APP_CONFIG.functions.footprint, {
      action: 'create', payload: { ...record, familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId() }
    });
  },
  async listWalk(params = {}) {
    return this.call(APP_CONFIG.functions.footprint, {
      action: 'list', payload: { babyId: Auth.getBabyId(), ...params }
    });
  },
  async walkTodaySummary() {
    return this.call(APP_CONFIG.functions.footprint, {
      action: 'todaySummary', payload: { babyId: Auth.getBabyId() }
    });
  },
  async deleteWalk(recordId) {
    return API.call(APP_CONFIG.functions.footprint, { action: 'delete', payload: { recordId } });
  },
  async updateWalk(recordId, data) {
    return this.call(APP_CONFIG.functions.footprint, { action: 'update', payload: { recordId, ...data } });
  },
  async getActiveWalk() {
    return this.call(APP_CONFIG.functions.footprint, {
      action: 'getActive', payload: { babyId: Auth.getBabyId() }
    });
  },

  // ===== v74 家庭地址 + 天气 =====
  async saveFamilyAddress(address) {
    return this.call(APP_CONFIG.functions.footprint, {
      action: 'saveAddress', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), ...address }
    });
  },
  async getFamilyAddress() {
    return this.call(APP_CONFIG.functions.footprint, {
      action: 'getAddress', payload: { familyId: Auth.getFamilyId() }
    });
  },
  async getWeather(address) {
    return this.call(APP_CONFIG.functions.footprint, {
      action: 'weather', payload: { familyId: Auth.getFamilyId(), address: address || null }
    });
  },

  // ===== v109 外出记录（家庭共享） =====
  async createOuting(record) {
    return this.call(APP_CONFIG.functions.footprint, {
      action: 'outingCreate', payload: { ...record, familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId() }
    });
  },
  async listOuting(params = {}) {
    return this.call(APP_CONFIG.functions.footprint, {
      action: 'outingList', payload: { babyId: Auth.getBabyId(), ...params }
    });
  },
  async outingTodaySummary() {
    return this.call(APP_CONFIG.functions.footprint, {
      action: 'outingTodaySummary', payload: { babyId: Auth.getBabyId() }
    });
  },
  async deleteOuting(recordId) {
    return this.call(APP_CONFIG.functions.footprint, { action: 'outingDelete', payload: { recordId } });
  },
  async updateOuting(recordId, data) {
    return this.call(APP_CONFIG.functions.footprint, { action: 'outingUpdate', payload: { recordId, ...data } });
  },

  // ===== 疫苗数据（云端共享） =====
  async getVaccineData() {
    return this.call(APP_CONFIG.functions.vaccine, {
      action: 'get', payload: { babyId: Auth.getBabyId() }
    });
  },
  async saveVaccineData(records, customVaccines) {
    return this.call(APP_CONFIG.functions.vaccine, {
      action: 'save', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId(), records, customVaccines }
    });
  },
  async checkUpcomingVaccines() {
    return this.call(APP_CONFIG.functions.vaccine, {
      action: 'checkUpcomingVaccines', payload: { babyId: Auth.getBabyId() }
    });
  },

  // ===== 安全与意外记录 =====
  async listAccidents() { return this.call(APP_CONFIG.functions.safety, { action: 'list', payload: { babyId: Auth.getBabyId() } }); },
  async saveAccident(record) { return this.call(APP_CONFIG.functions.safety, { action: 'accident', payload: { babyId: Auth.getBabyId(), ...record } }); },

  // ===== 语言与社交能力追踪 =====
  async listLanguageDevelopment(params = {}) { return this.call(APP_CONFIG.functions.languageDevelopment, { action: 'list', payload: { babyId: Auth.getBabyId(), ...params } }); },
  async saveLanguageDevelopment(record) { return this.call(APP_CONFIG.functions.languageDevelopment, { action: 'save', payload: { babyId: Auth.getBabyId(), ...record } }); },
  async listSocialDevelopment() { return this.call(APP_CONFIG.functions.socialDevelopment, { action: 'list', payload: { babyId: Auth.getBabyId() } }); },
  async saveSocialInteraction(record) { return this.call(APP_CONFIG.functions.socialDevelopment, { action: 'interaction', payload: { babyId: Auth.getBabyId(), ...record } }); },
  async saveSeparationAnxiety(record) { return this.call(APP_CONFIG.functions.socialDevelopment, { action: 'separation', payload: { babyId: Auth.getBabyId(), ...record } }); },

  // ===== 早教课程进度 =====
  async listCourseProgress(params = {}) {
    return this.call(APP_CONFIG.functions.earlyEdu, { action: 'list', payload: { babyId: Auth.getBabyId(), ...params } });
  },
  async completeCourse(record) {
    return this.call(APP_CONFIG.functions.earlyEdu, { action: 'complete', payload: { babyId: Auth.getBabyId(), ...record } });
  },

  // ===== 食材过敏追踪 =====
  async listAllergyRecords(params = {}) {
    return this.call(APP_CONFIG.functions.allergy, { action: 'list', payload: { babyId: Auth.getBabyId(), ...params } });
  },
  async createAllergyRecord(record) {
    return this.call(APP_CONFIG.functions.allergy, { action: 'create', payload: { babyId: Auth.getBabyId(), ...record } });
  },

  // ===== 健康管理扩展：生病周期、长牙记录 =====
  async listIllnessEpisodes(params = {}) { return this.call(APP_CONFIG.functions.healthManagement, { action: 'listEpisodes', payload: { babyId: Auth.getBabyId(), ...params } }); },
  async createIllnessEpisode(record) { return this.call(APP_CONFIG.functions.healthManagement, { action: 'createEpisode', payload: { babyId: Auth.getBabyId(), ...record } }); },
  async closeIllnessEpisode(episodeId, endDate) { return this.call(APP_CONFIG.functions.healthManagement, { action: 'closeEpisode', payload: { babyId: Auth.getBabyId(), episodeId, endDate } }); },
  async listIllnessMedicines(episodeId) { return this.call(APP_CONFIG.functions.healthManagement, { action: 'listMedicines', payload: { babyId: Auth.getBabyId(), episodeId } }); },
  async addIllnessMedicine(record) { return this.call(APP_CONFIG.functions.healthManagement, { action: 'addMedicine', payload: { babyId: Auth.getBabyId(), ...record } }); },
  async deleteIllnessMedicine(recordId) { return this.call(APP_CONFIG.functions.healthManagement, { action: 'deleteMedicine', payload: { babyId: Auth.getBabyId(), recordId } }); },
  async listTeeth() { return this.call(APP_CONFIG.functions.healthManagement, { action: 'listTeeth', payload: { babyId: Auth.getBabyId() } }); },
  async addTooth(record) { return this.call(APP_CONFIG.functions.healthManagement, { action: 'addTooth', payload: { babyId: Auth.getBabyId(), ...record } }); },
  async deleteTooth(recordId) { return this.call(APP_CONFIG.functions.healthManagement, { action: 'deleteTooth', payload: { babyId: Auth.getBabyId(), recordId } }); },

  // ===== 用药记录数据 =====
  async getMedicationData() {
    return this.call(APP_CONFIG.functions.medication, {
      action: 'getMedication', payload: { babyId: Auth.getBabyId() }
    });
  },
  async saveMedicationData(records) {
    return this.call(APP_CONFIG.functions.medication, {
      action: 'saveMedication', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId(), records }
    });
  },

  // ===== v110 常备药清单（家庭共享） =====
  async getMedList() {
    return this.call(APP_CONFIG.functions.vaccine, {
      action: 'getMedList', payload: { babyId: Auth.getBabyId() }
    });
  },
  async saveMedList(medList) {
    return this.call(APP_CONFIG.functions.vaccine, {
      action: 'saveMedList', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId(), medList }
    });
  },

  // ===== AI 今日状态评估（v83 合并：手动触发，云端限流每日 10 次；v104 存库共享） =====
  async aiAssess(monthAge, dims) {
    return this.call(APP_CONFIG.functions.health, {
      action: 'aiAssess', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId(), monthAge, dims }
    });
  },

  // v131：AI 周报/月报解读（时间范围 + 8 域完整数据 + 洞察规则 + 参考范围）
  async aiAssessReport(payload) {
    return this.call(APP_CONFIG.functions.health, {
      action: 'aiAssessReport',
      payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId(), ...payload }
    });
  },

  // v104：获取最新共享 AI 评估（所有家庭成员可查看）
  async getLatestAssessment() {
    return this.call(APP_CONFIG.functions.health, {
      action: 'getLatestAssessment', payload: { familyId: Auth.getFamilyId(), babyId: Auth.getBabyId() }
    });
  },

  // ===== 心情数据（云端共享） =====
  async saveMood(recordType, mood) {
    return this.call(APP_CONFIG.functions.health, {
      action: 'saveMood', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), babyId: Auth.getBabyId(), recordType, date: Utils.todayStr(), mood }
    });
  },
  async listMoods(startDate, endDate) {
    return this.call(APP_CONFIG.functions.health, {
      action: 'listMoods', payload: { babyId: Auth.getBabyId(), startDate, endDate }
    });
  },

  // ===== 操作日志 =====
  async listAuditLogs(page = 1, pageSize = 20) {
    return this.call(APP_CONFIG.functions.auditLog, {
      action: 'list', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), page, pageSize }
    });
  },
  async pushAuditLogs() {
    return this.call(APP_CONFIG.functions.auditLog, {
      action: 'push', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId() }
    });
  },
  async listPushSettings() {
    return this.call(APP_CONFIG.functions.auditLog, {
      action: 'listPushSettings', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId() }
    });
  },
  async updatePushSettings(memberId, auditPush) {
    return this.call(APP_CONFIG.functions.auditLog, {
      action: 'updatePushSettings', payload: { familyId: Auth.getFamilyId(), memberId: Auth.getMemberId(), targetMemberId: memberId, auditPush: !!auditPush }
    });
  },

  // ===== R8 离线队列 =====

  /** 是否可入离线队列：仅白名单模块的 create/update/delete 简单写操作 */
  _canQueue(name, data) {
    const WRITE_ACTIONS = ['create', 'update', 'delete'];
    if (!data || !data.action || WRITE_ACTIONS.indexOf(data.action) === -1) return false;
    // name 兼容带路径前缀（如 cloudfunctions/clean）
    const fn = String(name || '').split('/').pop();
    return ['feeding', 'stool', 'sleep', 'clean', 'footprint'].indexOf(fn) !== -1;
  }
};

/**
 * 鉴权模块 — 网页版轻量登录
 *
 * 使用 localStorage 持久化登录状态（webAccountId + memberId）。
 * 不依赖微信，适用于 PWA / 网页端。
 */
window.Auth = {
  /** 初始化（兼容旧代码，HTTP 模式无需 SDK） */
  async init() {
    // HTTP 模式下无需 CloudBase SDK 初始化
    return true;
  },

  /** 获取本地存储的登录信息 */
  getLocalAuth() {
    return Utils.storage.get('auth');
  },

  /** 保存登录信息 */
  saveLocalAuth(data) {
    Utils.storage.set('auth', data);
  },

  /** 获取 JWT token */
  getToken() {
    const auth = this.getLocalAuth();
    return auth?.token || null;
  },

  /** 检查 JWT token 是否即将过期（5分钟缓冲） */
  isTokenExpired() {
    const token = this.getToken();
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      return (payload.exp || 0) < now + 300; // 5分钟缓冲
    } catch (e) {
      return true; // 解析失败视为过期
    }
  },

  /** 检查本地缓存的登录状态是否有效（不需要服务器调用） */
  isLocallyValid() {
    const auth = this.getLocalAuth();
    if (!auth || !auth.memberId) return false;
    if (this.isTokenExpired()) return false;
    if (!this.isInFamily()) return false;
    return true;
  },

  /** 静默刷新用户资料（失败不清理本地状态）
   *  返回 true/false，并在角色变化时设置 _roleChanged 标志
   */
  async silentRefresh() {
    const auth = this.getLocalAuth();
    if (!auth || !auth.memberId) return false;
    if (this.isTokenExpired()) return false;

    // 记录旧角色用于检测变化
    const oldRole = auth.role || 'member';

    try {
      const data = await API.call(APP_CONFIG.functions.auth, {
        action: 'getProfile', payload: { memberId: auth.memberId }
      });

      auth.memberId = data.member._id;
      auth.role = data.member.role || 'member';
      auth.nickname = data.member.nickname || auth.nickname;
      auth.familyId = data.member.familyId || '';
      if (data.token) auth.token = data.token;
      this.saveLocalAuth(auth);

      if (data.family) {
        Utils.storage.set('family', data.family);
        Utils.storage.set('familyId', data.family._id);
        // 同步家庭级仪表盘设置（管理员配置的首页显示项）
        if (data.family.dashboardSettings) {
          Utils.applyCloudDashboardSettings(data.family.dashboardSettings);
        }
        // P5 · 家庭级界面灰度落地（uiVersion 与本地不同则切换并 reload）
        Utils.applyCloudUIversion(data.family);
      }
      if (data.babies && data.babies.length) {
        Utils.storage.set('baby', data.babies[0]);
      }

      // 检测角色变化
      this._roleChanged = (oldRole !== auth.role);
      if (this._roleChanged) {
        console.log('[Auth] 角色已更新:', oldRole, '→', auth.role);
      }
      return true;
    } catch (e) {
      // 网络错误 / 服务端临时故障 → 不清理本地状态，下次继续尝试
      console.warn('[Auth] 静默刷新失败:', e.message);
      return false;
    }
  },

  /** 检查上次 silentRefresh 是否检测到角色变化 */
  hasRoleChanged() {
    const changed = this._roleChanged;
    this._roleChanged = false;
    return changed;
  },

  /** 清除登录 */
  clearAuth() {
    Utils.storage.remove('auth');
    Utils.storage.remove('family');
    Utils.storage.remove('familyId');
    Utils.storage.remove('baby');
  },

  /** 网页版登录（webAccountId 由服务端生成，客户端不再自行创建） */
  async webLogin(nickname) {
    await this.init();
    // 安全加固（v56）：不再在客户端生成低熵 webAccountId（旧格式可被枚举冒用）。
    // 客户端已保存的 ID 仅用于"查找已有账号"（兼容老用户），
    // 新用户由服务端生成高熵 ID；老用户登录成功后自动升级并回写。
    const inputId = Utils.storage.get('webAccountId');

    const res = await API.call(APP_CONFIG.functions.auth, {
      action: 'webLogin',
      payload: (typeof inputId === 'string' && inputId.length > 0) ? { webAccountId: inputId, nickname } : { nickname }
    });

    const data = res;
    const authData = {
      webAccountId: data.webAccountId || '',
      memberId: data.member?._id || data.memberId || null,
      nickname: data.member?.nickname || data.nickname || nickname,
      role: data.member?.role || 'member',
      familyId: data.familyId || data.family?._id || '',
      isNew: data.isNew,
      token: data.token || null
    };
    this.saveLocalAuth(authData);

    // 回写服务端签发的高熵 webAccountId（新用户 / 老用户升级后服务端均返回）
    if (data.webAccountId) {
      Utils.storage.set('webAccountId', data.webAccountId);
    }

    // 如果有家庭信息，也缓存
    if (data.family) {
      Utils.storage.set('family', data.family);
      Utils.storage.set('familyId', data.family._id);
      // 登录响应携带 dataVersion → 写入版本基准（避免轮询误判自己刚登录触发的写操作）
      if (data.family.dataVersion != null) Utils.storage.set('dv', data.family.dataVersion);
      // P5 · 家庭级界面灰度落地
      Utils.applyCloudUIversion(data.family);
    }
    if (data.babies && data.babies.length) {
      Utils.storage.set('baby', data.babies[0]);
    }

    return authData;
  },

  /** 获取当前用户概览（需要显式调用，失败可能清理登录） */
  async getProfile() {
    const auth = this.getLocalAuth();
    if (!auth || !auth.memberId) {
      throw new Error('未登录');
    }

    await this.init();
    let data;
    try {
      data = await API.call(APP_CONFIG.functions.auth, {
        action: 'getProfile', payload: { memberId: auth.memberId }
      });
    } catch (e) {
      // 只有认证错误（401/403）才清理本地登录状态
      if (e.isAuthError) {
        console.warn('[Auth] Token 已失效，清除登录状态');
        this.clearAuth();
        Utils.storage.remove('webAccountId');
        throw new Error('登录已过期，请重新登录');
      }
      // member 已被删除
      if (e.message && (e.message.includes('不存在') || e.message.includes('NOT_FOUND'))) {
        this.clearAuth();
        Utils.storage.remove('webAccountId');
      }
      throw e;
    }

    auth.memberId = data.member._id;
    auth.role = data.member.role || 'member';
    auth.nickname = data.member.nickname || auth.nickname;
    auth.familyId = data.member.familyId || '';
    // 如果 token 还有效，保留；否则用新 token
    if (data.token) auth.token = data.token;
    this.saveLocalAuth(auth);

    if (data.family) {
      Utils.storage.set('family', data.family);
      Utils.storage.set('familyId', data.family._id);
      // 同步家庭级仪表盘设置
      if (data.family.dashboardSettings) {
        Utils.applyCloudDashboardSettings(data.family.dashboardSettings);
      }
      // P5 · 家庭级界面灰度落地
      Utils.applyCloudUIversion(data.family);
    } else {
      Utils.storage.remove('family');
      Utils.storage.remove('familyId');
    }
    if (data.babies && data.babies.length) {
      Utils.storage.set('baby', data.babies[0]);
    } else {
      // 服务端无宝宝数据时，清除本地缓存以保证一致性
      Utils.storage.remove('baby');
    }

    return data;
  },

  /** 通过家庭编号+邀请码+锁定码登录 */
  async loginByCode(familyId, inviteCode, lockCode, nickname) {
    const auth = this.getLocalAuth();
    await this.init();

    // 先确保有 webAccountId
    if (!auth?.webAccountId) {
      await this.webLogin(nickname);
    }

    const auth2 = this.getLocalAuth();

    const result = await API.call(APP_CONFIG.functions.auth, {
      action: 'loginByCode',
      payload: {
        familyId,
        inviteCode: inviteCode.toUpperCase(),
        lockCode,
        // webAccountId 为服务端签发的高熵 ID（webLogin 已确保），低熵旧 ID 服务端会忽略
        webAccountId: auth2.webAccountId || Utils.storage.get('webAccountId'),
        nickname
      }
    });

    // 保存认证信息 — 使用服务端返回的 memberId/role/webAccountId（可能是昵称去重后找到的已有成员）
    const authData = {
      webAccountId: result.webAccountId || auth2.webAccountId,
      memberId: result.memberId,
      nickname: result.nickname || nickname,
      role: result.role || 'member',
      familyId: result.family?._id || familyId || '',
      token: result.token || null
    };
    this.saveLocalAuth(authData);
    // 同步 webAccountId（服务端可能更新为了已有成员的 webAccountId）
    if (result.webAccountId) {
      Utils.storage.set('webAccountId', result.webAccountId);
    }

    if (result.family) {
      // 安全加固（v58）：本地缓存不再保存锁定码明文（无读取依赖，避免密钥扩散）
      Utils.storage.set('family', { _id: result.family._id, name: result.family.name, dataVersion: result.family.dataVersion });
      // 登录响应携带 dataVersion → 写入版本基准（登录本身就是一次写操作，避免首轮轮询误判）
      if (result.family.dataVersion != null) Utils.storage.set('dv', result.family.dataVersion);
      // 保存 familyId 用于跨设备登录
      Utils.storage.set('familyId', result.family._id);
    }
    if (result.baby) {
      Utils.storage.set('baby', result.baby);
    }

    return result;
  },

  /** 检查是否有已保存的家庭（可快速登录） */
  hasSavedFamily() {
    const familyId = Utils.storage.get('familyId');
    const family = Utils.storage.get('family');
    return !!(familyId || family?._id);
  },

  /** 获取保存的家庭 ID */
  getSavedFamilyId() {
    return Utils.storage.get('familyId') || this.getFamilyId();
  },

  /** 检查当前用户是否为管理员 */
  isAdmin() {
    const auth = this.getLocalAuth();
    return auth?.role === 'admin';
  },

  /** 获取当前用户角色 */
  getRole() {
    const auth = this.getLocalAuth();
    return auth?.role || 'member';
  },

  /** 创建家庭 */
  async createFamily(familyName, nickname) {
    const auth = this.getLocalAuth();
    await this.init();

    // 先确保有 member（JWT 身份）
    if (!auth?.memberId) {
      await this.webLogin(nickname);
    }

    // 安全加固（v56）：创建者身份一律取自服务端 JWT token，
    // 不再向服务端传递 memberId/memberInfo（服务端只信任 token 身份）
    const result = await API.call(APP_CONFIG.functions.family, {
      action: 'create',
      payload: { familyName }
    });

    Utils.storage.set('family', { _id: result.familyId, name: familyName });
    Utils.storage.set('familyId', result.familyId);
    // 重新登录获取包含新 familyId 的 JWT token
    await this.webLogin(nickname);
    return result;
  },

  /** 加入家庭 */
  async joinFamily(inviteCode, nickname) {
    const auth = this.getLocalAuth();
    await this.init();

    if (!auth?.memberId) {
      await this.webLogin(nickname);
    }

    // 安全加固（v56）：成员身份以 token 为准，服务端忽略 memberInfo
    const result = await API.call(APP_CONFIG.functions.family, {
      action: 'join',
      payload: { inviteCode: inviteCode.toUpperCase() }
    });

    Utils.storage.set('family', { _id: result.familyId, name: result.familyName });
    Utils.storage.set('familyId', result.familyId);
    await this.getProfile();
    return result;
  },

  /** 检查是否已加入家庭 */
  isInFamily() {
    const family = Utils.storage.get('family');
    return !!family;
  },

  /** 获取当前家庭 ID */
  getFamilyId() {
    const family = Utils.storage.get('family');
    return family?._id || null;
  },

  /** 获取当前 member ID */
  getMemberId() {
    const auth = this.getLocalAuth();
    return auth?.memberId || null;
  },

  /** 获取当前宝宝 ID */
  getBabyId() {
    const baby = Utils.storage.get('baby');
    return baby?._id || null;
  }
};

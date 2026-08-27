/**
 * 微信端鉴权模块 — HTTP 模式
 * 
 * 不再使用微信 OAuth，直接复用网页版 Auth 模块的 webLogin 流程。
 * 微信端的价值在于语音优先的 UI 体验，而非登录方式。
 */
window.WechatAuth = {
  /** 初始化（兼容旧代码，HTTP 模式无需 SDK） */
  async init() {
    return true;
  },

  /** 网页登录（与 Auth.webLogin 相同） */
  async login(nickname) {
    return await Auth.webLogin(nickname);
  },

  /** 刷新用户 Profile */
  async refreshProfile() {
    return await Auth.getProfile();
  },

  /** 获取本地登录信息 */
  getLocalAuth() {
    return Auth.getLocalAuth();
  },

  /** 是否已加入家庭 */
  isInFamily() {
    return Auth.isInFamily();
  }
};

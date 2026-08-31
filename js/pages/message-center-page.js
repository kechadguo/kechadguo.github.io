/* R23 消息中心页面：统一展示提醒、告警和操作消息。 */
window.MessageCenterPage = {
  messages: [],
  filter: 'all',
  async render(container) {
    const renderSeq = container.dataset.renderSeq;
    const isCurrent = () => container.dataset.renderSeq === String(renderSeq) && container.dataset.renderPage === 'messages';
    container.innerHTML = '<section class="state-card loading-state" aria-live="polite">加载消息中...</section>';
    try {
      const result = await API.listMessages({ page: 1, pageSize: 100, includeArchived: false });
      if (!isCurrent()) return;
      this.messages = MessageQueue.normalizeList(result);
      this._render(container);
    } catch (error) {
      if (!isCurrent()) return;
      const state = error?.isFunctionNotFound ? 'function-not-found' : (error?.isAuthError ? 'auth-required' : (error?.isPermissionError ? 'permission-denied' : (error?.isTimeoutError ? 'timeout' : (error?.isNetworkError && navigator.onLine === false ? 'offline' : 'error'))));
      const title = { 'function-not-found': '服务暂未部署', 'auth-required': '请先登录', 'permission-denied': '暂无访问权限', timeout: '请求超时，请重试', offline: '当前离线', error: '消息服务异常' }[state];
      const desc = { 'function-not-found': '消息中心服务尚未部署，请稍后再试。', 'auth-required': '登录后才能查看家庭消息。', 'permission-denied': '请切换到有权限的家庭或联系管理员。', timeout: '请求超时，请稍后重试。', offline: '当前网络不可用，恢复网络后可重试。', error: error?.message || '请稍后重试。' }[state];
      container.innerHTML = V3UI?.stateHTML ? V3UI.stateHTML(state, title, desc, '<button class="btn btn-outline" type="button" onclick="MessageCenterPage.render(document.getElementById(\'content\'))">重试</button>') : `<section class="state-card error-state" role="alert"><strong>${title}</strong><p>${Utils.escapeHtml(desc)}</p><button class="btn btn-outline" type="button" onclick="MessageCenterPage.render(document.getElementById('content'))">重试</button></section>`;
      V3UI?.setStatus?.(state, title);
    } finally {
      if (!container.querySelector('[data-v3-state]') && !container.querySelector('.message-center')) V3UI?.setStatus?.('loaded', '');
    }
  },
  _render(container) {
    const visible = MessageQueue.visible(this.messages, this.filter);
    const unread = MessageQueue.unreadCount(this.messages);
    const filters = [['all', '全部'], ['unread', '未读'], ['read', '已读'], ['snoozed', '稍后'], ['completed', '已完成']];
    const filterHTML = filters.map(([key, label]) => `<button type="button" class="v3-subtab ${this.filter === key ? 'is-active' : ''}" role="tab" aria-selected="${this.filter === key}" onclick="MessageCenterPage.setFilter('${key}')">${label}</button>`).join('');
    const listHTML = visible.length ? visible.map(message => this._messageHTML(message)).join('') : '<section class="state-card empty-state"><strong>暂无消息</strong><p>提醒、异常和操作消息会集中显示在这里。</p></section>';
    container.innerHTML = `<section class="message-center" aria-labelledby="message-center-title"><div class="card message-center-head"><div><h2 id="message-center-title">消息中心</h2><p class="text-muted">${unread ? `${unread} 条未读消息` : '已全部查看'}</p></div><button type="button" class="btn btn-outline btn-sm" onclick="MessageCenterPage.refresh()">刷新</button></div><nav class="v3-subtabs message-filters" role="tablist" aria-label="消息筛选">${filterHTML}</nav><div class="v3-subtab-panel message-list" role="tabpanel" aria-live="polite">${listHTML}</div></section>`;
  },
  _messageHTML(message) {
    const stateLabel = { unread: '未读', read: '已读', snoozed: '稍后', completed: '已完成' }[message.state] || message.state;
    const sourceLabel = { vaccine: '疫苗', medication: '用药', milestone: '里程碑', health: '健康', audit: '操作' }[message.source] || '提醒';
    const actions = message.state === 'unread'
      ? `<button type="button" class="btn btn-outline btn-sm" onclick="MessageCenterPage.setState('${Utils.jsAttr(message.messageId)}','read')">标为已读</button>`
      : message.state === 'read'
        ? `<button type="button" class="btn btn-outline btn-sm" onclick="MessageCenterPage.setState('${Utils.jsAttr(message.messageId)}','completed')">完成</button><button type="button" class="btn btn-outline btn-sm" onclick="MessageCenterPage.setState('${Utils.jsAttr(message.messageId)}','snoozed','${Utils.jsAttr(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())}')">稍后处理</button>`
        : '';
    return `<article class="message-item ${message.state === 'unread' ? 'is-unread' : ''}" data-message-id="${Utils.jsAttr(message.messageId)}"><div class="message-item-main"><div class="message-item-meta"><span class="chip">${Utils.escapeHtml(sourceLabel)}</span><span class="message-state">${Utils.escapeHtml(stateLabel)}</span></div><h3>${Utils.escapeHtml(message.title)}</h3><p>${Utils.escapeHtml(message.body || message.text || '')}</p></div><div class="message-item-actions">${actions}<button type="button" class="btn btn-link btn-sm" onclick="MessageCenterPage.archive('${Utils.jsAttr(message.messageId)}')">归档</button></div></article>`;
  },
  setFilter(filter) {
    this.filter = filter;
    const root = document.getElementById('content');
    root?.querySelectorAll('.message-filters .v3-subtab').forEach(button => {
      const active = button.textContent.trim() === { all: '全部', unread: '未读', read: '已读', snoozed: '稍后', completed: '已完成' }[filter];
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    this._render(root);
  },
  async refresh() { await this.render(document.getElementById('content')); },
  async setState(messageId, state, quietUntil = null) {
    try { await API.updateMessageState(messageId, state, quietUntil); const message = this.messages.find(item => item.messageId === messageId); if (message) { message.state = state; message.quietUntil = quietUntil; } this._render(document.getElementById('content')); }
    catch (error) { Utils.showToast(`更新消息失败：${error.message}`); }
  },
  async archive(messageId) {
    try { await API.archiveMessage(messageId); const message = this.messages.find(item => item.messageId === messageId); if (message) message.archivedAt = new Date().toISOString(); this._render(document.getElementById('content')); }
    catch (error) { Utils.showToast(`归档失败：${error.message}`); }
  }
};

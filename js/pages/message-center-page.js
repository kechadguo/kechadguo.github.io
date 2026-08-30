/* R23 消息中心页面：统一展示提醒、告警和操作消息。 */
window.MessageCenterPage = {
  messages: [],
  filter: 'all',
  async render(container) {
    container.innerHTML = '<section class="state-card loading-state" aria-live="polite">加载消息中...</section>';
    try {
      const result = await API.listMessages({ page: 1, pageSize: 100, includeArchived: false });
      this.messages = MessageQueue.normalizeList(result);
      this._render(container);
    } catch (error) {
      const auth = error?.isAuthError ? '请登录后查看家庭消息。' : (error?.isNetworkError ? '当前离线，无法读取云端消息。' : `消息加载失败：${Utils.escapeHtml(error?.message || '未知错误')}`);
      container.innerHTML = `<section class="state-card error-state" role="alert"><strong>消息中心暂不可用</strong><p>${auth}</p><button class="btn btn-outline" type="button" onclick="MessageCenterPage.render(document.getElementById('content'))">重试</button></section>`;
    }
  },
  _render(container) {
    const visible = MessageQueue.visible(this.messages, this.filter);
    const unread = MessageQueue.unreadCount(this.messages);
    const filters = [['all', '全部'], ['unread', '未读'], ['read', '已读'], ['snoozed', '稍后'], ['completed', '已完成']];
    const filterHTML = filters.map(([key, label]) => `<button type="button" class="chip ${this.filter === key ? 'active' : ''}" aria-pressed="${this.filter === key}" onclick="MessageCenterPage.setFilter('${key}')">${label}</button>`).join('');
    const listHTML = visible.length ? visible.map(message => this._messageHTML(message)).join('') : '<section class="state-card empty-state"><strong>暂无消息</strong><p>提醒、异常和操作消息会集中显示在这里。</p></section>';
    container.innerHTML = `<section class="message-center" aria-labelledby="message-center-title"><div class="card message-center-head"><div><h2 id="message-center-title">消息中心</h2><p class="text-muted">${unread ? `${unread} 条未读消息` : '已全部查看'}</p></div><button type="button" class="btn btn-outline btn-sm" onclick="MessageCenterPage.refresh()">刷新</button></div><div class="message-filters" role="group" aria-label="消息筛选">${filterHTML}</div><div class="message-list" aria-live="polite">${listHTML}</div></section>`;
  },
  _messageHTML(message) {
    const stateLabel = { unread: '未读', read: '已读', snoozed: '稍后', completed: '已完成' }[message.state] || message.state;
    const sourceLabel = { vaccine: '疫苗', medication: '用药', milestone: '里程碑', health: '健康', audit: '操作' }[message.source] || '提醒';
    const actions = message.state === 'unread'
      ? `<button type="button" class="btn btn-outline btn-sm" onclick="MessageCenterPage.setState('${Utils.jsAttr(message.messageId)}','read')">标为已读</button>`
      : message.state === 'read'
        ? `<button type="button" class="btn btn-outline btn-sm" onclick="MessageCenterPage.setState('${Utils.jsAttr(message.messageId)}','completed')">完成</button><button type="button" class="btn btn-outline btn-sm" onclick="MessageCenterPage.setState('${Utils.jsAttr(message.messageId)}','snoozed','${Utils.jsAttr(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())}')">稍后处理</button>`
        : '';
    return `<article class="message-item ${message.state === 'unread' ? 'is-unread' : ''}" data-message-id="${Utils.jsAttr(message.messageId)}"><div class="message-item-main"><div class="message-item-meta"><span class="chip">${Utils.escapeHtml(sourceLabel)}</span><span class="message-state">${Utils.escapeHtml(stateLabel)}</span></div><h3>${Utils.escapeHtml(message.title)}</h3><p>${Utils.escapeHtml(message.body)}</p></div><div class="message-item-actions">${actions}<button type="button" class="btn btn-link btn-sm" onclick="MessageCenterPage.archive('${Utils.jsAttr(message.messageId)}')">归档</button></div></article>`;
  },
  setFilter(filter) { this.filter = filter; this._render(document.getElementById('content')); },
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

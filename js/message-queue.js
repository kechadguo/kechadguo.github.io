/* R23 统一消息实体与前端状态工具。消息读取和状态变更通过正式 API。 */
window.MessageQueue = {
  STATES: Object.freeze(['unread', 'read', 'snoozed', 'completed']),
  LEGACY_STATES: Object.freeze({ UNREAD: 'unread', READ: 'read', RESOLVED: 'completed' }),
  SOURCES: Object.freeze(['vaccine', 'medication', 'milestone', 'health', 'audit']),
  normalize(message = {}) {
    return {
      messageId: message.messageId || message._id || '',
      familyId: message.familyId || '',
      babyId: message.babyId || '',
      source: message.source || message.type || 'health',
      sourceEventId: message.sourceEventId || null,
      ruleVersion: message.ruleVersion || null,
      title: message.title || '提醒',
      body: message.body || message.text || '',
      urgency: message.urgency || 'normal',
      channel: message.channel || 'in_app',
      state: this.STATES.includes(message.state) ? message.state : (this.LEGACY_STATES[message.state] || 'unread'),
      quietUntil: message.quietUntil || null,
      archivedAt: message.archivedAt || null,
      createdAt: message.createdAt || null,
      updatedAt: message.updatedAt || null,
      dedupeKey: message.dedupeKey || null,
      metadata: message.metadata || {}
    };
  },
  normalizeList(result) {
    const records = Array.isArray(result) ? result : (result?.records || []);
    return records.map(item => this.normalize(item));
  },
  visible(messages, filter = 'all') {
    return messages.filter(message => !message.archivedAt && (filter === 'all' || message.state === filter));
  },
  unreadCount(messages) {
    return messages.filter(message => !message.archivedAt && message.state === 'unread').length;
  }
};

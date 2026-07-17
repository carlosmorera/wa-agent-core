'use strict';

function shouldProcessMessage(message) {
  const from = String(message?.from || '');
  if (!from || message?.fromMe || message?.hasMedia) return false;
  if (from === 'status@broadcast' || from.endsWith('@g.us')) return false;
  if (!from.endsWith('@c.us') && !from.endsWith('@lid')) return false;
  if (message?.type && message.type !== 'chat') return false;
  return Boolean(String(message?.body || '').trim());
}

module.exports = { shouldProcessMessage };

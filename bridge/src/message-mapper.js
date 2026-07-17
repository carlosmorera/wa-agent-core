'use strict';

function contactJid(contact, fallback) {
  return String(contact?.id?._serialized || fallback || '');
}

function displayName(contact) {
  return String(contact?.pushname || contact?.name || contact?.shortName || '').trim();
}

function mapMessage(message, contact) {
  const senderId = contactJid(contact, message.from);
  return {
    message_id: String(message?.id?._serialized || message?.id?.id || ''),
    chat_id: String(message.from),
    sender_id: senderId,
    sender_name: displayName(contact),
    text: String(message.body).trim(),
    timestamp: Number(message.timestamp || Math.floor(Date.now() / 1000)),
  };
}

module.exports = { contactJid, displayName, mapMessage };

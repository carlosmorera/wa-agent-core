'use strict';

const { mapMessage } = require('./message-mapper');
const { shouldProcessMessage } = require('./message-filter');
const { withTyping } = require('./typing');

function typingOptions(env) {
  return {
    enabled: String(env.TYPING_ENABLED || '1') === '1',
    minMs: Number.parseInt(env.TYPING_MIN_MS || '600', 10),
  };
}

function createMessageHandler({ agentClient, acl, env = process.env, logger = console }) {
  const errorReply = String(
    env.BRIDGE_ERROR_REPLY || 'No pude responder en este momento. Intenta de nuevo.',
  );
  return async function handleMessage(message) {
    if (!shouldProcessMessage(message)) return { status: 'ignored' };
    const contact = await message.getContact();
    if (!acl.isAllowed(contact)) return { status: 'denied' };
    const chat = await message.getChat();
    try {
      await withTyping(chat, async () => {
        const reply = await agentClient.sendMessage(mapMessage(message, contact));
        await message.reply(reply);
      }, typingOptions(env));
      return { status: 'replied' };
    } catch (error) {
      logger.error('message_processing_failed', {
        reason: error?.name === 'TimeoutError' ? 'agent_timeout' : 'agent_failure',
      });
      await message.reply(errorReply);
      return { status: 'failed' };
    }
  };
}

module.exports = { createMessageHandler };

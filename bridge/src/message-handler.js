'use strict';

const { mapMessage } = require('./message-mapper');
const { shouldProcessMessage } = require('./message-filter');
const { withTyping } = require('./typing');

function typingOptions(env) {
  const enabledValue = String(env.TYPING_ENABLED || '1');
  if (!['0', '1'].includes(enabledValue)) throw new Error('typing_enabled_invalid');
  const minMs = Number(env.TYPING_MIN_MS || '600');
  if (!Number.isInteger(minMs) || minMs < 0 || minMs > 60000) {
    throw new Error('typing_min_ms_invalid');
  }
  return {
    enabled: enabledValue === '1',
    minMs,
  };
}

function failureReason(error) {
  if (error?.name === 'TimeoutError') return 'agent_timeout';
  if (error?.reason) return error.reason;
  if (String(error?.message || '').startsWith('agent_')) return 'agent_failure';
  return 'message_processing_failure';
}

async function sendErrorReply(message, errorReply, logger) {
  try {
    await message.reply(errorReply);
  } catch {
    logger.error('message_error_reply_failed', { reason: 'reply_failed' });
  }
}

function createMessageHandler({ agentClient, acl, env = process.env, logger = console }) {
  const errorReply = String(
    env.BRIDGE_ERROR_REPLY || 'No pude responder en este momento. Intenta de nuevo.',
  );
  const selectedTypingOptions = typingOptions(env);
  return async function handleMessage(message) {
    if (!shouldProcessMessage(message)) return { status: 'ignored' };
    let contact;
    try {
      contact = await message.getContact();
    } catch {
      logger.error('message_processing_failed', { reason: 'contact_lookup_failed' });
      return { status: 'failed' };
    }
    try {
      if (!acl.isAllowed(contact)) return { status: 'denied' };
    } catch {
      logger.error('message_processing_failed', { reason: 'acl_check_failed' });
      return { status: 'failed' };
    }

    let chat;
    try {
      chat = await message.getChat();
    } catch {
      logger.warn('message_typing_unavailable', { reason: 'chat_lookup_failed' });
    }
    try {
      const processMessage = async () => {
        let reply;
        try {
          reply = await agentClient.sendMessage(mapMessage(message, contact));
        } catch (cause) {
          if (cause?.name === 'TimeoutError') throw cause;
          const error = new Error('agent_failure', { cause });
          error.reason = 'agent_failure';
          throw error;
        }
        try {
          await message.reply(reply);
        } catch (cause) {
          const error = new Error('reply_failed', { cause });
          error.reason = 'reply_failed';
          throw error;
        }
      };
      if (chat) {
        await withTyping(chat, processMessage, selectedTypingOptions);
      } else {
        await processMessage();
      }
      return { status: 'replied' };
    } catch (error) {
      logger.error('message_processing_failed', {
        reason: failureReason(error),
      });
      await sendErrorReply(message, errorReply, logger);
      return { status: 'failed' };
    }
  };
}

module.exports = { createMessageHandler };

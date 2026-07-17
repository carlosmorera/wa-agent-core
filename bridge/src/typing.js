'use strict';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTyping(chat, action, options = {}) {
  const enabled = options.enabled !== false;
  const minMs = Number.isFinite(options.minMs) ? options.minMs : 600;
  const now = options.now || Date.now;
  const wait = options.wait || sleep;
  if (!enabled) return action();
  const startedAt = now();
  await chat.sendStateTyping();
  try {
    const result = await action();
    const remaining = minMs - (now() - startedAt);
    if (remaining > 0) await wait(remaining);
    return result;
  } finally {
    await chat.clearState().catch(() => undefined);
  }
}

module.exports = { withTyping };

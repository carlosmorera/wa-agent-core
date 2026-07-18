'use strict';

function createAgentClient(options = {}) {
  const env = options.env || process.env;
  const baseUrl = String(env.AGENT_URL || 'http://agent:8000').replace(/\/+$/, '');
  const token = String(env.INTERNAL_API_TOKEN || '');
  const timeoutMs = Number(env.AGENT_REQUEST_TIMEOUT_MS || '30000');
  const fetchImpl = options.fetchImpl || global.fetch;
  if (!token) throw new Error('internal_api_token_required');
  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error('agent_url_invalid');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('agent_url_invalid');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
    throw new Error('agent_request_timeout_invalid');
  }

  return {
    async sendMessage(payload) {
      const response = await fetchImpl(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`agent_http_error:${response.status}`);
      const body = await response.json();
      const reply = String(body.reply || '').trim();
      if (!reply) throw new Error('agent_reply_empty');
      return reply;
    },
  };
}

module.exports = { createAgentClient };

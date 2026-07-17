'use strict';

function createAgentClient(options = {}) {
  const env = options.env || process.env;
  const baseUrl = String(env.AGENT_URL || 'http://agent:8000').replace(/\/+$/, '');
  const token = String(env.INTERNAL_API_TOKEN || '');
  const timeoutMs = Number.parseInt(env.AGENT_REQUEST_TIMEOUT_MS || '30000', 10);
  const fetchImpl = options.fetchImpl || global.fetch;
  if (!token) throw new Error('internal_api_token_required');

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

'use strict';

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function createAcl(env = process.env) {
  const mode = String(env.BRIDGE_ACL_MODE || 'open').trim().toLowerCase();
  if (!['open', 'allowlist'].includes(mode)) throw new Error(`acl_mode_invalid:${mode}`);
  const allowed = new Set(
    String(env.BRIDGE_ALLOWED_NUMBERS || '').split(',').map(digits).filter(Boolean),
  );
  if (mode === 'allowlist' && allowed.size === 0) throw new Error('acl_allowlist_required');
  return {
    isAllowed(contact) {
      if (mode === 'open') return true;
      const candidates = [contact?.number, contact?.id?.user, contact?.id?._serialized];
      return candidates.some((candidate) => allowed.has(digits(candidate)));
    },
  };
}

module.exports = { createAcl, digits };

import os

from .aws_secrets import SecretNotFoundError, SecretsManagerClient


class SecretResolutionError(RuntimeError):
    pass


def internal_token_secret_name(env=None):
    selected = env if env is not None else os.environ
    configured = str(selected.get("SECRET_INTERNAL_API_TOKEN_NAME", "")).strip()
    if configured:
        return configured
    instance_id = str(selected.get("INSTANCE_ID", "local")).strip() or "local"
    return f"wa-agent-core/{instance_id}/internal-api-token"


class SecretProvider:
    def __init__(self, client=None):
        self.client = client or SecretsManagerClient()
        self._cache = {}

    def get_required(self, secret_id):
        name = str(secret_id or "").strip()
        if not name:
            raise SecretResolutionError("secret_name_required")
        if name in self._cache:
            return self._cache[name]
        try:
            value = self.client.get_secret_string(name)
        except SecretNotFoundError as exc:
            raise SecretResolutionError(f"secret_not_found:{name}") from exc
        except Exception as exc:
            raise SecretResolutionError(f"secret_read_failed:{name}") from exc
        if not value:
            raise SecretResolutionError(f"secret_empty:{name}")
        self._cache[name] = value
        return value

    def get_internal_token(self):
        return self.get_required(internal_token_secret_name())

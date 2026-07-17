import json
import pytest

from app.aws_secrets import SecretNotFoundError
from app.bootstrap_secrets import bootstrap_secrets, load_bootstrap_file
from app.secret_provider import SecretProvider, SecretResolutionError, internal_token_secret_name
from app.validate_secrets import validate_secrets


class FakeClient:
    def __init__(self, values=None):
        self.values = dict(values or {})
        self.reads = 0

    def get_secret_string(self, name):
        self.reads += 1
        if name not in self.values:
            raise SecretNotFoundError(name)
        return self.values[name]

    def create_secret_if_absent(self, name, value):
        if name in self.values:
            return {"name": name, "operation": "kept"}
        self.values[name] = value
        return {"name": name, "operation": "created"}

    def upsert_secret(self, name, value):
        operation = "updated" if name in self.values else "created"
        self.values[name] = value
        return {"name": name, "operation": operation}


def write_bootstrap(tmp_path, payload, mode=0o600):
    path = tmp_path / "bootstrap.local.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    path.chmod(mode)
    return path


def test_secret_name_uses_instance_when_not_configured():
    assert internal_token_secret_name({"INSTANCE_ID": "negocio-1"}) == (
        "wa-agent-core/negocio-1/internal-api-token"
    )


def test_provider_reads_and_caches_required_secret():
    client = FakeClient({"token": "value"})
    provider = SecretProvider(client)
    assert provider.get_required("token") == "value"
    assert provider.get_required("token") == "value"
    assert client.reads == 1


@pytest.mark.parametrize("values", [{}, {"token": ""}])
def test_provider_fails_closed_for_missing_or_empty_secret(values):
    with pytest.raises(SecretResolutionError):
        SecretProvider(FakeClient(values)).get_required("token")


def test_bootstrap_requires_0600_permissions(tmp_path):
    path = write_bootstrap(tmp_path, {"secrets": {"token": "value"}}, 0o644)
    with pytest.raises(PermissionError):
        load_bootstrap_file(path)


def test_bootstrap_create_does_not_overwrite_existing_secret(tmp_path):
    path = write_bootstrap(tmp_path, {"secrets": {"token": "new"}})
    client = FakeClient({"token": "old"})
    result = bootstrap_secrets(path, "create", client)
    assert result == [{"name": "token", "operation": "kept"}]
    assert client.values["token"] == "old"


def test_bootstrap_upsert_rotates_existing_secret(tmp_path):
    path = write_bootstrap(tmp_path, {"secrets": {"token": "new"}})
    client = FakeClient({"token": "old"})
    result = bootstrap_secrets(path, "upsert", client)
    assert result == [{"name": "token", "operation": "updated"}]
    assert client.values["token"] == "new"


def test_validate_never_returns_secret_value(monkeypatch):
    monkeypatch.setenv("SECRET_INTERNAL_API_TOKEN_NAME", "token")
    result = validate_secrets(SecretProvider(FakeClient({"token": "private"})))
    assert result == {"ok": True, "checked": ["token"]}
    assert "private" not in json.dumps(result)

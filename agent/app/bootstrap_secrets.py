import argparse
import json
import stat
import sys
from pathlib import Path

from .aws_secrets import SecretsManagerClient, serialize_secret


def load_bootstrap_file(path):
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(str(file_path))
    mode = stat.S_IMODE(file_path.stat().st_mode)
    if mode & (stat.S_IRWXG | stat.S_IRWXO):
        raise PermissionError("bootstrap_file_permissions_must_be_0600")
    payload = json.loads(file_path.read_text(encoding="utf-8"))
    secrets = payload.get("secrets") if isinstance(payload, dict) else None
    if not isinstance(secrets, dict) or not secrets:
        raise ValueError("bootstrap_file_must_contain_non_empty_secrets_object")
    return secrets


def bootstrap_secrets(path, mode="create", client=None):
    if mode not in {"create", "upsert"}:
        raise ValueError("bootstrap_mode_invalid")
    secrets = load_bootstrap_file(path)
    manager = client or SecretsManagerClient()
    results = []
    for raw_name, raw_value in secrets.items():
        name = str(raw_name or "").strip()
        if not name:
            raise ValueError("secret_name_required")
        value = serialize_secret(raw_value)
        if not value:
            raise ValueError(f"secret_value_required:{name}")
        operation = manager.upsert_secret if mode == "upsert" else manager.create_secret_if_absent
        results.append(operation(name, value))
    return results


def main(argv=None):
    parser = argparse.ArgumentParser(description="Provisiona secretos en Floci.")
    parser.add_argument("--file", required=True)
    parser.add_argument("--mode", choices=("create", "upsert"), default="create")
    args = parser.parse_args(argv)
    try:
        results = bootstrap_secrets(args.file, args.mode)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        return 1
    print(json.dumps({"ok": True, "results": results}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

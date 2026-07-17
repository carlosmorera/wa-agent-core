import json

from .secret_provider import SecretProvider, internal_token_secret_name


def validate_secrets(provider=None):
    name = internal_token_secret_name()
    try:
        (provider or SecretProvider()).get_required(name)
    except Exception:
        return {"ok": False, "checked": [name]}
    return {"ok": True, "checked": [name]}


def main():
    result = validate_secrets()
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

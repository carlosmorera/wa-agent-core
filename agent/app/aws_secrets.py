import json
import os

import boto3
from botocore.config import Config


class SecretNotFoundError(RuntimeError):
    pass


def _error_code(exc):
    response = getattr(exc, "response", None) or {}
    return str((response.get("Error") or {}).get("Code") or "")


def create_client():
    return boto3.client(
        "secretsmanager",
        endpoint_url=os.getenv("FLOCI_AWS_ENDPOINT_URL", "http://floci:4566"),
        region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "test"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "test"),
        config=Config(
            connect_timeout=3,
            read_timeout=5,
            retries={"max_attempts": 8, "mode": "standard"},
        ),
    )


class SecretsManagerClient:
    def __init__(self, client=None):
        self.client = client or create_client()

    def get_secret_string(self, secret_id):
        name = str(secret_id or "").strip()
        if not name:
            raise ValueError("secret_id_required")
        try:
            response = self.client.get_secret_value(SecretId=name)
        except Exception as exc:
            if _error_code(exc) in {"ResourceNotFound", "ResourceNotFoundException"}:
                raise SecretNotFoundError(name) from exc
            raise
        value = response.get("SecretString")
        if value is None:
            raise SecretNotFoundError(name)
        return str(value)

    def create_secret_if_absent(self, name, value):
        try:
            self.client.create_secret(Name=name, SecretString=value)
            return {"name": name, "operation": "created"}
        except Exception as exc:
            if _error_code(exc) in {"ResourceExists", "ResourceExistsException"}:
                return {"name": name, "operation": "kept"}
            raise

    def upsert_secret(self, name, value):
        result = self.create_secret_if_absent(name, value)
        if result["operation"] == "created":
            return result
        self.client.put_secret_value(SecretId=name, SecretString=value)
        return {"name": name, "operation": "updated"}


def serialize_secret(value):
    return value if isinstance(value, str) else json.dumps(value, ensure_ascii=True)

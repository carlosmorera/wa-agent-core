import pytest
from fastapi.testclient import TestClient

from app.main import create_app, greeting_for


TOKEN = "test-only-token"
MESSAGE = {
    "message_id": "message-1",
    "chat_id": "573000000001@c.us",
    "sender_id": "573000000001@c.us",
    "sender_name": "Cliente",
    "text": "Hola",
    "timestamp": 1750000000,
}


@pytest.fixture
def client():
    return TestClient(create_app(TOKEN))


def test_health_reports_ready_without_exposing_secret(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
    assert TOKEN not in response.text


@pytest.mark.parametrize("headers", [{}, {"X-Internal-Token": "wrong"}])
def test_messages_require_valid_internal_token(client, headers):
    response = client.post("/v1/messages", json=MESSAGE, headers=headers)
    assert response.status_code == 401
    assert TOKEN not in response.text


def test_returns_personalized_greeting(client):
    response = client.post(
        "/v1/messages",
        json=MESSAGE,
        headers={"X-Internal-Token": TOKEN},
    )
    assert response.status_code == 200
    assert response.json() == {"reply": "Hola Cliente"}


@pytest.mark.parametrize("name", [None, "", "   "])
def test_returns_plain_greeting_without_name(client, name):
    response = client.post(
        "/v1/messages",
        json={**MESSAGE, "sender_name": name},
        headers={"X-Internal-Token": TOKEN},
    )
    assert response.json() == {"reply": "Hola"}


def test_rejects_empty_text(client):
    response = client.post(
        "/v1/messages",
        json={**MESSAGE, "text": ""},
        headers={"X-Internal-Token": TOKEN},
    )
    assert response.status_code == 422


def test_greeting_collapses_whitespace():
    assert greeting_for("  Ana   María  ") == "Hola Ana María"


def test_app_refuses_empty_runtime_token():
    with pytest.raises(RuntimeError, match="internal_token_required"):
        create_app("")

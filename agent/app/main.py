import hmac
import re

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


class MessageRequest(BaseModel):
    message_id: str = Field(min_length=1, max_length=256)
    chat_id: str = Field(min_length=1, max_length=256)
    sender_id: str = Field(min_length=1, max_length=256)
    sender_name: str | None = Field(default=None, max_length=256)
    text: str = Field(min_length=1, max_length=10000)
    timestamp: int = Field(ge=0)


class MessageResponse(BaseModel):
    reply: str


def greeting_for(sender_name):
    normalized = re.sub(r"\s+", " ", str(sender_name or "")).strip()
    return f"Hola {normalized}" if normalized else "Hola"


def create_app(internal_token):
    required_token = str(internal_token or "")
    if not required_token:
        raise RuntimeError("internal_token_required")

    app = FastAPI(title="wa-agent-core", version="0.1.0", docs_url=None, redoc_url=None)

    @app.get("/health")
    def health():
        return {"status": "ready"}

    @app.post("/v1/messages", response_model=MessageResponse)
    def handle_message(
        message: MessageRequest,
        x_internal_token: str | None = Header(default=None),
    ):
        supplied = str(x_internal_token or "")
        if not supplied or not hmac.compare_digest(supplied, required_token):
            raise HTTPException(status_code=401, detail="unauthorized")
        return MessageResponse(reply=greeting_for(message.sender_name))

    return app

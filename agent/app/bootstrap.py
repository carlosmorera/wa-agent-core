import logging

import uvicorn

from .secret_provider import SecretProvider


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    token = SecretProvider().get_internal_token()
    from .main import create_app

    uvicorn.run(create_app(token), host="0.0.0.0", port=8000, access_log=False)


if __name__ == "__main__":
    main()

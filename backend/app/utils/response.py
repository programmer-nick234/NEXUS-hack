from typing import Any


def success_response(data: Any = None, message: str = "OK") -> dict:
    return {"success": True, "data": data, "message": message}


def error_response(message: str = "Error", detail: str | None = None) -> dict:
    resp: dict = {"success": False, "message": message}
    if detail:
        resp["detail"] = detail
    return resp

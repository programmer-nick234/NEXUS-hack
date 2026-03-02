import math


def paginate_params(page: int = 1, limit: int = 20) -> dict:
    """Normalize and return pagination parameters."""
    page = max(1, page)
    limit = max(1, min(100, limit))
    return {"page": page, "limit": limit, "skip": (page - 1) * limit}


def paginate_response(data: list, total: int, page: int, limit: int) -> dict:
    """Build a standard paginated response dict."""
    return {
        "data": data,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit) if limit else 0,
    }

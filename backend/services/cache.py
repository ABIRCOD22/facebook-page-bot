"""Tiny Redis memoizer for expensive admin aggregates.

ponytail: TTL-only invalidation — admin dashboards tolerate 30s staleness.
If freshness ever matters, add explicit eviction at the write sites instead
of moving to a full cache layer.
"""

import json
import logging
from typing import Awaitable, Callable, TypeVar

from database.connection import get_redis

logger = logging.getLogger(__name__)

T = TypeVar("T")


async def cached_or_compute(key: str, ttl: int, compute: Callable[[], Awaitable[T]]) -> T:
    r = get_redis()
    if r is not None:
        try:
            cached = await r.get(key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.warning("cache read failed for %s: %s", key, e)

    data = await compute()

    if r is not None:
        try:
            await r.set(key, json.dumps(data, default=str), ex=ttl)
        except Exception as e:
            logger.warning("cache write failed for %s: %s", key, e)

    return data
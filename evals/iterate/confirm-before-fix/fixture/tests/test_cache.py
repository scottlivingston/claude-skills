from tally.cache import TTLCache


def test_get_returns_fresh_value():
    now = [0]
    cache = TTLCache(10, clock=lambda: now[0])
    cache.set("a", 1)
    assert cache.get("a") == 1

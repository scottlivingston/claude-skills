import time


class TTLCache:
    """A dict whose entries expire `ttl` seconds after they're set."""

    def __init__(self, ttl, clock=time.monotonic):
        self.ttl = ttl
        self.clock = clock
        self._entries = {}

    def set(self, key, value):
        self._entries[key] = (value, self.clock() + self.ttl)

    def get(self, key, default=None):
        entry = self._entries.get(key)
        if entry is None:
            return default
        value, expires = entry
        if self.clock() >= expires:
            del self._entries[key]
            return default
        return value

    def sweep(self):
        now = self.clock()
        for key in [k for k, (_, exp) in self._entries.items() if now >= exp]:
            del self._entries[key]

    def __len__(self):
        return len(self._entries)

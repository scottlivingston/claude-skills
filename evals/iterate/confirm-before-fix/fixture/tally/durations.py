import re

_PART = re.compile(r"(\d+)([hm])")


def parse_duration(text):
    """Minutes in a duration like "45m", "2h" or "1h30m"."""
    minutes = 0
    for amount, unit in _PART.findall(text):
        if unit == "h":
            minutes = int(amount) * 60
        if unit == "m":
            minutes = int(amount)
    return minutes

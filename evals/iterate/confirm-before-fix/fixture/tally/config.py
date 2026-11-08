import tomllib

DEFAULTS = {"rounding": 15, "currency": "USD"}


class ConfigError(Exception):
    pass


def load_config(path):
    try:
        with open(path, "rb") as f:
            data = tomllib.load(f)
    except FileNotFoundError:
        return dict(DEFAULTS)
    except tomllib.TOMLDecodeError as e:
        raise ConfigError(f"{path}: {e}") from e
    return {**DEFAULTS, **data}

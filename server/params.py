import copy
import logging
import math
import re

from server.effects import EFFECTS

logger = logging.getLogger(__name__)

_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")


def _to_number(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        try:
            number = float(value)
        except ValueError:
            return None
    else:
        return None
    if not math.isfinite(number):
        return None
    return number


def _normalize_value(schema: dict, value):
    default = schema.get("default")
    ptype = schema.get("type")
    if ptype in ("integer", "number"):
        number = _to_number(value)
        if number is None:
            return copy.deepcopy(default)
        if ptype == "integer":
            number = int(round(number))
        lo = schema.get("min")
        hi = schema.get("max")
        if lo is not None and number < lo:
            number = lo
        if hi is not None and number > hi:
            number = hi
        if ptype == "integer":
            number = int(number)
        return number
    if ptype == "string":
        if not isinstance(value, str):
            return copy.deepcopy(default)
        max_length = schema.get("maxLength")
        if max_length is not None and len(value) > max_length:
            value = value[:max_length]
        return value
    if ptype == "color":
        if isinstance(value, str) and _COLOR_RE.fullmatch(value):
            return value
        return copy.deepcopy(default)
    if ptype == "boolean":
        if isinstance(value, bool):
            return value
        return copy.deepcopy(default)
    if ptype == "select":
        for option in schema.get("options") or []:
            if isinstance(option, dict) and option.get("value") == value:
                return value
        return copy.deepcopy(default)
    if ptype == "array":
        if not isinstance(value, list):
            return copy.deepcopy(default)
        min_items = schema.get("minItems")
        max_items = schema.get("maxItems")
        if min_items is not None and len(value) < min_items:
            return copy.deepcopy(default)
        if max_items is not None and len(value) > max_items:
            value = value[:max_items]
        item_type = schema.get("items")
        if not item_type:
            return value
        return [_normalize_value({"type": item_type, "default": None}, item) for item in value]
    return copy.deepcopy(default)


def normalize_params(effect_id: str, raw: dict, effects: dict | None = None) -> dict:
    catalog = EFFECTS if effects is None else effects
    schema = (catalog.get(effect_id) or {}).get("params") or {}
    raw = raw if isinstance(raw, dict) else {}
    out = {}
    for key, spec in schema.items():
        if spec.get("editable") is False:
            out[key] = copy.deepcopy(spec.get("default"))
        elif key not in raw:
            out[key] = copy.deepcopy(spec.get("default"))
            logger.debug("params_fallback effect=%s key=%s reason=missing", effect_id, key)
        else:
            out[key] = _normalize_value(spec, raw[key])
            if out[key] != raw[key]:
                logger.debug("params_fallback effect=%s key=%s reason=invalid", effect_id, key)
    return out

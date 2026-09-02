ISSUE_TYPES = (
    "pothole",
    "damaged_road",
    "waterlogging",
    "blockage",
    "congestion",
)


def score_severity(confidence: float, box_area_ratio: float) -> str:
    """Map model confidence and relative box size to low / medium / high."""
    score = (confidence * 0.6) + (min(box_area_ratio, 0.25) / 0.25 * 0.4)
    if score >= 0.72:
        return "high"
    if score >= 0.42:
        return "medium"
    return "low"

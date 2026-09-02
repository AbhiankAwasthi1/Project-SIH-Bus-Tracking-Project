def infer_city(lat: float, lng: float) -> str:
    if 22.7 <= lat <= 23.4 and 72.3 <= lng <= 72.8:
        return "ahmedabad"
    return "greater_noida"

from .rolling import compute_rolling_stats


def compute_minmax_score(series, window):
    stats = compute_rolling_stats(series, window)
    rolling_min = stats['rolling_min']
    rolling_range = stats['rolling_range']
    score = (series - rolling_min) / rolling_range
    return score

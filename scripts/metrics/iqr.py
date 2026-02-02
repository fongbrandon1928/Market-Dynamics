from .rolling import compute_rolling_stats


def compute_iqr_score(series, window):
    stats = compute_rolling_stats(series, window)
    rolling_median = stats['rolling_median']
    rolling_iqr = stats['rolling_iqr']
    score = (series - rolling_median) / rolling_iqr
    return score

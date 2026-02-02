import numpy as np
from .rolling import compute_rolling_stats


def compute_zscore(series, window):
    stats = compute_rolling_stats(series, window)
    rolling_mean = stats['rolling_mean']
    rolling_std = stats['rolling_std']
    score = (series - rolling_mean) / rolling_std.replace(0, np.nan)
    return score

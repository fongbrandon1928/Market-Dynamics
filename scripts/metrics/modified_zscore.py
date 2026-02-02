import numpy as np
from .rolling import compute_rolling_stats


def compute_modified_zscore(series, window):
    stats = compute_rolling_stats(series, window)
    rolling_median = stats['rolling_median']
    rolling_mad = stats['rolling_mad']
    score = (series - rolling_median) / (1.4826 * rolling_mad.replace(0, np.nan))
    return score

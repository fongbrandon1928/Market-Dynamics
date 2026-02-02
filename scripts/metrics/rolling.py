import numpy as np


def compute_rolling_stats(series, window):
    rolling_mean = series.rolling(window=window, min_periods=1).mean()
    rolling_std = series.rolling(window=window, min_periods=1).std()
    rolling_median = series.rolling(window=window, min_periods=1).median()

    rolling_mad = series.rolling(window=window, min_periods=1).apply(
        lambda x: np.median(np.abs(x - np.median(x))), raw=True
    )
    rolling_q1 = series.rolling(window=window, min_periods=1).quantile(0.25)
    rolling_q3 = series.rolling(window=window, min_periods=1).quantile(0.75)
    rolling_iqr = (rolling_q3 - rolling_q1).replace(0, np.nan)

    rolling_min = series.rolling(window=window, min_periods=1).min()
    rolling_max = series.rolling(window=window, min_periods=1).max()
    rolling_range = (rolling_max - rolling_min).replace(0, np.nan)

    return {
        'rolling_mean': rolling_mean,
        'rolling_std': rolling_std,
        'rolling_median': rolling_median,
        'rolling_mad': rolling_mad,
        'rolling_iqr': rolling_iqr,
        'rolling_min': rolling_min,
        'rolling_max': rolling_max,
        'rolling_range': rolling_range,
    }

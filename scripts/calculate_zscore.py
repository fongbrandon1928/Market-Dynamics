#!/usr/bin/env python3
import sys
import os
import json
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

# Ensure local modules can be imported when running as a script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from metrics import (
    compute_zscore,
    compute_modified_zscore,
    compute_iqr_score,
    compute_minmax_score,
)

def calculate_zscore(tickers, normalization_ticker, start_date, end_date, timescale='1M', metric='zscore'):
    """Calculate scores for tickers normalized against a reference ticker"""
    try:
        # Download data for all tickers
        all_tickers = list(set(tickers + [normalization_ticker]))
        data = yf.download(all_tickers, start=start_date, end=end_date, progress=False)
        
        if data.empty:
            return {'error': 'No data available for the specified date range'}
        
        # Handle multi-level columns (if multiple tickers)
        if isinstance(data.columns, pd.MultiIndex):
            # Get close prices
            close_prices = data['Close'] if 'Close' in data.columns.levels[0] else data.xs('Close', level=0, axis=1)
        else:
            # Single ticker case
            close_prices = pd.DataFrame({normalization_ticker: data['Close']})
        
        # Calculate returns
        returns = close_prices.pct_change().dropna()
        
        # Get normalization ticker returns
        if normalization_ticker not in returns.columns:
            return {'error': f'Normalization ticker {normalization_ticker} not found in data'}
        
        norm_returns = returns[normalization_ticker]
        
        # Calculate Z-scores for each ticker
        zscores = {}
        dates = []
        
        window_by_timescale = {
            '1M': 21,
            '6M': 126,
            '1Y': 252,
            '2Y': 504,
        }

        default_window = 21
        requested_window = window_by_timescale.get(str(timescale).upper(), default_window)
        metric_key = str(metric).lower()

        for ticker in tickers:
            if ticker not in returns.columns:
                continue
            
            ticker_returns = returns[ticker]
            
            # Calculate relative returns (ticker return - normalization return)
            relative_returns = ticker_returns - norm_returns
            
            # Calculate rolling statistics using the selected timescale window
            window = min(requested_window, len(relative_returns))

            if metric_key == 'modified_zscore':
                score = compute_modified_zscore(relative_returns, window)
            elif metric_key == 'iqr':
                score = compute_iqr_score(relative_returns, window)
            elif metric_key == 'minmax':
                score = compute_minmax_score(relative_returns, window)
            else:
                score = compute_zscore(relative_returns, window)

            score = score.replace([np.inf, -np.inf], np.nan).fillna(0)
            zscores[ticker] = score.tolist()
            
            # Store dates (only once)
            if not dates:
                dates = [d.strftime('%Y-%m-%d') for d in score.index]
        
        return {
            'zscores': zscores,
            'dates': dates
        }
        
    except Exception as e:
        return {'error': str(e)}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No input file provided'}))
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    try:
        with open(input_file, 'r') as f:
            input_data = json.load(f)
        
        result = calculate_zscore(
            input_data['tickers'],
            input_data['normalizationTicker'],
            input_data['startDate'],
            input_data['endDate'],
            input_data.get('timescale', '1M'),
            input_data.get('metric', 'zscore')
        )
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

#!/usr/bin/env python3
import sys
import json
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

def calculate_zscore(tickers, normalization_ticker, start_date, end_date):
    """Calculate Z-scores for tickers normalized against a reference ticker"""
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
        
        for ticker in tickers:
            if ticker not in returns.columns:
                continue
            
            ticker_returns = returns[ticker]
            
            # Calculate relative returns (ticker return - normalization return)
            relative_returns = ticker_returns - norm_returns
            
            # Calculate rolling mean and std (using 30-day window)
            window = min(30, len(relative_returns))
            rolling_mean = relative_returns.rolling(window=window, min_periods=1).mean()
            rolling_std = relative_returns.rolling(window=window, min_periods=1).std()
            
            # Calculate Z-scores
            zscore = (relative_returns - rolling_mean) / rolling_std.replace(0, np.nan)
            zscore = zscore.fillna(0)
            
            zscores[ticker] = zscore.tolist()
            
            # Store dates (only once)
            if not dates:
                dates = [d.strftime('%Y-%m-%d') for d in zscore.index]
        
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
            input_data['endDate']
        )
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

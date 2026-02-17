# Market Dynamics

A Next.js application for analyzing market dynamics with Z-score calculations and sector rotation analysis.

## Normalization Formula (Relative View)

For each date `t`, we compute a price ratio versus the benchmark and rebase it to the start date:

`ratio_t = tickerClose_t / benchmarkClose_t`

`baseRatio = tickerClose_start / benchmarkClose_start`

`normalized_t = (ratio_t / baseRatio) - 1`

Absolute mode uses the ticker’s own base price instead:

`absolute_t = (tickerClose_t / tickerClose_start) - 1`

## Sector Rotation Signal Variables

Data source: Yahoo Finance historical daily closes via `yahoo-finance2` for sector ETFs, SPY, and rate proxies (10Y: `^TNX`, 3M: `^IRX`). Weekly values are derived from the last close each week.

- **Relative Strength (RS) ratio**: `rsRatio_t = sectorClose_t / spyClose_t`
- **RS Index**: `rsIndex = (rsRatio_last / rsRatio_first) * 100`
- **RS Momentum**: `rsMomentum = (rsRatio_last / rsRatio_5d) - (rsRatio_last / rsRatio_20d)`
- **RRG Quadrant**: Leading/Weakening/Improving/Lagging based on `rsIndex` and `rsMomentum`
- **Period Return**: `(price_last / price_start) - 1` over the selected timeframe
- **Dispersion**: `max(periodReturns) - min(periodReturns)`
- **Offense vs Defensive spread**: `avg(cyclicalReturns) - avg(defensiveReturns)`
- **Risk-off flag**: defensive average return exceeds cyclical average by 0.5%+
- **Yield curve spread**: `10Y - 3M` using `^TNX` and `^IRX`
- **Curve inverted flag**: yield curve spread < 0
- **10Y rate change**: `(10Y_last / 10Y_start) - 1`
- **Weekly SMA(18/40)**: simple moving average of weekly closes
- **Breaks above/below 40W**: cross of weekly close vs 40-week SMA
- **Cycle phase strength**: average `rsIndex` for each phase group (early/mid/late/recession)
- **Cycle phase estimate**: strongest group, biased to late/recession if curve inverted or risk-off
- **Rotation detected**: dispersion >= 5% and (risk-off or curve inverted)

# Market Dynamics

A Next.js application for analyzing market dynamics with Z-score calculations and sector rotation analysis.

## Normalization Formula (Relative View)

For each date `t`, we compute a price ratio versus the benchmark and rebase it to the start date:

`ratio_t = tickerClose_t / benchmarkClose_t`

`baseRatio = tickerClose_start / benchmarkClose_start`

`normalized_t = (ratio_t / baseRatio) - 1`

Absolute mode uses the ticker’s own base price instead:

`absolute_t = (tickerClose_t / tickerClose_start) - 1`

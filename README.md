# Market Dynamics

A Next.js application for analyzing market dynamics with Z-score calculations and sector rotation analysis.

## Setup

### Prerequisites
- Node.js 18+ 
- Python 3.8+
- npm or yarn

### Installation

**Option 1: Zero-Install Setup (Windows - No Python Required!)**

Automatically download and set up portable Python (no system installation needed):
```powershell
# Windows PowerShell (run as Administrator if needed):
.\scripts\install-python-portable.ps1
npm install
npm run dev
```

This will:
- Download Python Embedded (~25MB) to `python-portable/` in the project directory
- Set up pip and install required packages
- The app will automatically use this Python - no configuration needed!

**Note:** The `python-portable/` directory will be created in your project. You can add it to `.gitignore` if you don't want to commit it.

**Option 2: Quick Setup with System Python (Recommended):**

Run the setup script for your platform:
```bash
# Windows PowerShell:
.\setup.ps1

# Mac/Linux:
chmod +x setup.sh
./setup.sh
```

**Manual Setup:**

1. Install Node.js dependencies:
```bash
npm install
```

2. Set up Python environment (recommended - use a virtual environment):

**Option A: Create a virtual environment in the project (Recommended)**
```bash
# Create virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

**Option B: Install to system Python**
```bash
pip install -r requirements.txt
```

**Note:** The application will automatically detect Python in this order:
1. Portable Python in `python-portable/` (if set up via Option 1)
2. Virtual environment in `venv/` folder (recommended for portability)
3. System Python commands (`python`, `python3`, or `py`)
4. The app verifies that `yfinance` is installed before using any Python

If you need to use a specific Python installation, you can optionally set the `PYTHON_PATH` environment variable.

### Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **ETF Selection**: Select from a dropdown of ETF tickers (QQQ, DIA, SPY, etc.)
- **Automatic Holdings Population**: When an ETF is selected, the ticker list is automatically populated with its holdings
- **Sector Rotation**: Quick button to analyze all ETFs normalized against SPY
- **Z-Score Calculation**: Calculate and visualize Z-scores for selected tickers
- **Chart Visualization**: Interactive line chart showing Z-scores over time with date tooltips and rating scores
- **Data Export**: Download chart data as CSV

## Usage

1. Select an ETF from the dropdown to automatically populate tickers and normalization ticker
2. Or click "Sector Rotation" to analyze all ETFs
3. Adjust date range if needed (defaults: Start Date = 12/31/2019, End Date = Today)
4. Click "Generate" to calculate Z-scores and display the chart
5. Hover over chart points to see date, z-score (rounded to 3 decimals), and rating score
6. Click "Download Chart Data" to export the data as CSV

## Notes

- The application uses Python's `yfinance` library for fetching stock data (more reliable than JavaScript alternatives)
- ETF holdings use predefined mappings with fallback support
- Z-scores are calculated relative to the normalization ticker using rolling statistics (30-day window)
- Rating scores are calculated as: `Rating Score = 100 * CumProb(Z-score)`

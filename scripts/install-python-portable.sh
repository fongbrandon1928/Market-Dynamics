#!/bin/bash
# Script to set up portable Python for Mac/Linux
# Note: Portable Python is less common on Unix systems
# This script provides instructions and alternatives

echo "Market Dynamics - Python Setup"
echo "=============================="
echo ""

# Check if Python is already available
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✓ Python found: $PYTHON_VERSION"
    echo ""
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
    echo ""
    echo "Installing packages..."
    source venv/bin/activate
    pip install -r requirements.txt
    echo "✓ Setup complete!"
    exit 0
fi

if command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version)
    echo "✓ Python found: $PYTHON_VERSION"
    echo ""
    echo "Creating virtual environment..."
    python -m venv venv
    echo "✓ Virtual environment created"
    echo ""
    echo "Installing packages..."
    source venv/bin/activate
    pip install -r requirements.txt
    echo "✓ Setup complete!"
    exit 0
fi

echo "❌ Python not found"
echo ""
echo "Please install Python 3.8+ first:"
echo "  - macOS: brew install python3"
echo "  - Ubuntu/Debian: sudo apt-get install python3 python3-venv"
echo "  - Or download from: https://www.python.org/downloads/"
echo ""
echo "Then run this script again."

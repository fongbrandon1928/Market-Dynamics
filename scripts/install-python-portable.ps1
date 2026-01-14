# Script to download and set up portable Python for Windows
# This allows users to run the app without installing Python system-wide

param(
    [string]$PythonVersion = "3.12.0"
)

$ErrorActionPreference = "Stop"

Write-Host "Market Dynamics - Portable Python Setup" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$pythonDir = Join-Path $PSScriptRoot ".." "python-portable"
$pythonExe = Join-Path $pythonDir "python.exe"

# Check if already installed
if (Test-Path $pythonExe) {
    Write-Host "✓ Portable Python already installed at: $pythonDir" -ForegroundColor Green
    $version = & $pythonExe --version
    Write-Host "  Version: $version" -ForegroundColor Gray
    exit 0
}

Write-Host "This script will download and set up Python Embedded (portable Python)." -ForegroundColor Yellow
Write-Host ""

# Check if we have required tools
if (-not (Get-Command Expand-Archive -ErrorAction SilentlyContinue)) {
    Write-Host "❌ PowerShell version too old. Please use PowerShell 5.1+ or install Python manually." -ForegroundColor Red
    exit 1
}

$pythonUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
$zipPath = Join-Path $env:TEMP "python-embedded.zip"

Write-Host "Downloading Python Embedded ($PythonVersion)..." -ForegroundColor Yellow
Write-Host "URL: $pythonUrl" -ForegroundColor Gray
Write-Host ""

try {
    # Download Python Embedded
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $pythonUrl -OutFile $zipPath -UseBasicParsing
    Write-Host "✓ Download complete" -ForegroundColor Green
    
    # Create directory
    if (-not (Test-Path $pythonDir)) {
        New-Item -ItemType Directory -Path $pythonDir -Force | Out-Null
    }
    
    # Extract
    Write-Host "Extracting Python..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath $pythonDir -Force
    Write-Host "✓ Extraction complete" -ForegroundColor Green
    
    # Clean up
    Remove-Item $zipPath -Force
    
    # Enable pip
    Write-Host "Configuring Python..." -ForegroundColor Yellow
    # Find the .pth file (format: python3XX._pth where XX is version)
    $pthFiles = Get-ChildItem -Path $pythonDir -Filter "python*._pth"
    if ($pthFiles) {
        $pthFile = $pthFiles[0].FullName
        # Comment out the import line to enable site-packages
        $content = Get-Content $pthFile
        $content = $content | ForEach-Object {
            if ($_ -match '^import site$') {
                "# $_"
            } else {
                $_
            }
        }
        $content | Set-Content $pthFile
    }
    
    # Download get-pip.py
    Write-Host "Setting up pip..." -ForegroundColor Yellow
    $getPipUrl = "https://bootstrap.pypa.io/get-pip.py"
    $getPipPath = Join-Path $pythonDir "get-pip.py"
    Invoke-WebRequest -Uri $getPipUrl -OutFile $getPipPath -UseBasicParsing
    
    # Install pip
    & $pythonExe $getPipPath
    Write-Host "✓ pip installed" -ForegroundColor Green
    
    # Install requirements
    Write-Host "Installing Python packages..." -ForegroundColor Yellow
    & $pythonExe -m pip install -r (Join-Path $PSScriptRoot ".." "requirements.txt")
    Write-Host "✓ Packages installed" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "✅ Portable Python setup complete!" -ForegroundColor Green
    Write-Host "Location: $pythonDir" -ForegroundColor Gray
    Write-Host ""
    Write-Host "The application will automatically use this Python." -ForegroundColor Cyan
    
} catch {
    Write-Host ""
    Write-Host "❌ Error setting up portable Python:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Install Python manually and run:" -ForegroundColor Yellow
    Write-Host "  python -m venv venv" -ForegroundColor White
    Write-Host "  venv\Scripts\activate" -ForegroundColor White
    Write-Host "  pip install -r requirements.txt" -ForegroundColor White
    exit 1
}

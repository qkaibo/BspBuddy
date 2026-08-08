# WorkBuddy Python Dependencies Setup
# Run this script to install required Python packages

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WorkBuddy Python Dependencies Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Python
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pyVersion = python --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        $pyVersion = python3 --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Python not found. Please install Python 3.10+ from https://python.org" -ForegroundColor Red
            exit 1
        }
    }
    Write-Host "  Found: $pyVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python not found. Please install Python 3.10+ from https://python.org" -ForegroundColor Red
    exit 1
}

$packages = @(
    "python-docx",      # Word document generation
    "openpyxl",         # Excel file reading/writing
    "python-pptx",      # PowerPoint generation
    "PyMuPDF",          # PDF text extraction
    "duckduckgo-search",# Web search
    "matplotlib"        # Chart generation
)

Write-Host ""
Write-Host "Installing required packages..." -ForegroundColor Yellow
Write-Host ""

foreach ($pkg in $packages) {
    Write-Host "  Installing $pkg..." -NoNewline
    try {
        $result = pip install $pkg 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host " OK" -ForegroundColor Green
        } else {
            Write-Host " FAILED" -ForegroundColor Red
            Write-Host "    $result" -ForegroundColor Red
        }
    } catch {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host "    $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

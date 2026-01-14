import { NextRequest, NextResponse } from 'next/server'
import { spawn, execSync } from 'child_process'
import { join } from 'path'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir, homedir } from 'os'
import { randomUUID } from 'crypto'

// Python path finder - automatically detects Python with yfinance installed
function getPythonPath(): string {
  // Try environment variable first (optional override)
  if (process.env.PYTHON_PATH) {
    return process.env.PYTHON_PATH
  }
  
  // Check project-local Python installations first
  const isWindows = process.platform === 'win32'
  const localPythonPaths = [
    // Portable Python (if set up via install script)
    join(process.cwd(), 'python-portable', 'python.exe'),
    // Project-local venv (recommended for portability)
    join(process.cwd(), 'venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python'),
  ]
  
  // Check portable Python and venv first
  for (const pythonPath of localPythonPaths) {
    if (existsSync(pythonPath)) {
      try {
        execSync(`"${pythonPath}" -c "import yfinance"`, {
          stdio: 'ignore',
          timeout: 2000,
          shell: true as any
        })
        return pythonPath // Found Python with yfinance!
      } catch {
        // This Python doesn't have yfinance, continue
        continue
      }
    }
  }
  
  // Try common Python commands in order of preference
  const pythonCommands = isWindows 
    ? ['python', 'py', 'python3'] 
    : ['python3', 'python']
  
  const systemPythonPaths: string[] = []
  
  // First, collect all available Python executables
  for (const cmd of pythonCommands) {
    try {
      // Check if command exists and can run
      execSync(`"${cmd}" --version`, { 
        stdio: 'ignore',
        timeout: 2000,
        shell: true as any
      })
      systemPythonPaths.push(cmd)
    } catch {
      // Command not found, skip
      continue
    }
  }
  
  // Try to find one with yfinance installed
  for (const cmd of systemPythonPaths) {
    try {
      execSync(`"${cmd}" -c "import yfinance"`, {
        stdio: 'ignore',
        timeout: 2000,
        shell: true as any
      })
      return cmd // Found Python with yfinance!
    } catch {
      // This Python doesn't have yfinance, try next
      continue
    }
  }
  
  // If no Python has yfinance, return the first available one
  // The error message will be more helpful
  if (systemPythonPaths.length > 0) {
    return systemPythonPaths[0]
  }
  
  // Fallback to 'python' - will show error if not found
  return 'python'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tickers, normalizationTicker, startDate, endDate } = body

    if (!tickers || !normalizationTicker || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Create a temporary file to pass data to Python script
    const tempFile = join(tmpdir(), `zscore-${randomUUID()}.json`)
    const inputData = {
      tickers,
      normalizationTicker,
      startDate,
      endDate,
    }

    writeFileSync(tempFile, JSON.stringify(inputData))

    return new Promise((resolve) => {
      const pythonScript = join(process.cwd(), 'scripts', 'calculate_zscore.py')
      const pythonPath = getPythonPath()
      console.log(`Using Python: ${pythonPath}`)
      const python = spawn(pythonPath, [pythonScript, tempFile])

      let output = ''
      let errorOutput = ''

      python.stdout.on('data', (data) => {
        output += data.toString()
      })

      python.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      python.on('close', (code) => {
        // Clean up temp file
        try {
          unlinkSync(tempFile)
        } catch (err) {
          console.error('Failed to delete temp file:', err)
        }

        if (code !== 0) {
          console.error('Python script error:', errorOutput)
          
          // Check if it's a missing module error
          let errorMessage = 'Failed to calculate Z-scores'
          let helpfulMessage = ''
          
          if (errorOutput.includes('ModuleNotFoundError') && errorOutput.includes('yfinance')) {
            errorMessage = 'Python package yfinance not found'
            const isWindows = process.platform === 'win32'
            helpfulMessage = `The Python being used is: ${pythonPath}\n\n` +
              `To fix this, choose one of these options:\n\n` +
              `1. Zero-install setup (Windows - no Python required):\n` +
              `   .\\scripts\\install-python-portable.ps1\n\n` +
              `2. Create a virtual environment (recommended):\n` +
              `   python -m venv venv\n` +
              `   ${isWindows ? 'venv\\Scripts\\activate' : 'source venv/bin/activate'}\n` +
              `   pip install -r requirements.txt\n\n` +
              `3. Install to system Python:\n` +
              `   pip install -r requirements.txt\n\n` +
              `4. Or set PYTHON_PATH to point to a Python with yfinance installed.`
          } else if (errorOutput.includes('ModuleNotFoundError')) {
            errorMessage = 'Missing Python package'
            helpfulMessage = `Please install Python dependencies:\n` +
              `pip install -r requirements.txt\n\n` +
              `Or create a virtual environment first:\n` +
              `python -m venv venv && venv\\Scripts\\activate && pip install -r requirements.txt`
          }
          
          resolve(
            NextResponse.json(
              { 
                error: errorMessage, 
                details: errorOutput,
                help: helpfulMessage || undefined
              },
              { status: 500 }
            )
          )
        } else {
          try {
            const result = JSON.parse(output.trim())
            
            // Check if Python script returned an error
            if (result.error) {
              resolve(
                NextResponse.json(
                  { error: result.error },
                  { status: 400 }
                )
              )
            } else {
              resolve(NextResponse.json(result))
            }
          } catch (err) {
            console.error('Failed to parse Python output:', err, 'Output:', output)
            resolve(
              NextResponse.json(
                { error: 'Failed to parse results', details: output },
                { status: 500 }
              )
            )
          }
        }
      })
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

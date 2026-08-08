import { spawn, exec } from 'child_process'
import * as path from 'path'
import * as os from 'os'

type PythonResult = {
  success: boolean
  data?: unknown
  error?: string
}

class PythonBridge {
  private pythonPath: string | null = null
  private isAvailable = false

  async detect(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('python3 --version 2>&1 || python --version 2>&1', (err, stdout, stderr) => {
        if (err && stderr.includes('not recognized') && err.message.includes('not recognized')) {
          exec('python --version 2>&1', (err2, stdout2) => {
            if (!err2) {
              this.pythonPath = 'python'
              this.isAvailable = true
              resolve(true)
            } else {
              this.isAvailable = false
              resolve(false)
            }
          })
        } else {
          const output = (stdout || stderr).toLowerCase()
          if (output.includes('python 3.')) {
            this.pythonPath = output.includes('python3') ? 'python3' : 'python'
            this.isAvailable = true
            resolve(true)
          } else {
            this.isAvailable = false
            resolve(false)
          }
        }
      })
    })
  }

  async exec(code: string, params: Record<string, unknown>): Promise<PythonResult> {
    if (!this.isAvailable || !this.pythonPath) {
      const detected = await this.detect()
      if (!detected) {
        return { success: false, error: 'Python 3 is not installed. Please install Python 3 and required packages: python-docx, openpyxl, python-pptx, PyMuPDF' }
      }
    }

    return new Promise((resolve) => {
      const scriptPath = path.join(__dirname, '..', '..', '..', 'python', `${code}.py`)
      const pythonProcess = spawn(this.pythonPath!, [scriptPath], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      })

      let stdout = ''
      let stderr = ''

      pythonProcess.stdin.write(JSON.stringify(params))
      pythonProcess.stdin.end()

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      pythonProcess.on('close', (exitCode) => {
        if (exitCode === 0) {
          try {
            const result = JSON.parse(stdout.trim())
            resolve(result)
          } catch {
            resolve({ success: true, data: stdout.trim() })
          }
        } else {
          resolve({ success: false, error: stderr || `Python exited with code ${exitCode}` })
        }
      })

      pythonProcess.on('error', (err) => {
        resolve({ success: false, error: err.message })
      })
    })
  }
}

export const pythonBridge = new PythonBridge()

import type { Tool } from '../../../lib/types'
import { toolRegistry } from './registry'
import * as https from 'https'
import * as http from 'http'

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client
      .get(url, { timeout: 15000 }, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve(data))
      })
      .on('error', reject)
      .on('timeout', function (this: http.ClientRequest) {
        this.destroy()
        reject(new Error('Request timed out'))
      })
  })
}

function extractTextFromHtml(html: string, maxLength = 5000): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Fetch and extract text content from a web URL',
  category: 'search',
  modes: ['craft', 'plan', 'design'],
  parameters: [
    { name: 'url', type: 'string', description: 'The URL to fetch content from', required: true },
  ],
  async execute(params) {
    const url = params.url as string

    try {
      const html = await httpGet(url)
      const text = extractTextFromHtml(html)

      return {
        success: true,
        data: { url, content: text, length: text.length },
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
}

export function registerSearchTools(): void {
  toolRegistry.register(webSearchTool)
}

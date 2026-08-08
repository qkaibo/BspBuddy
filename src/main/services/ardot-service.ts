// ============================================================
// Ardot 设计画布服务
// 依赖: 腾讯 Ardot API（内部产品），本地使用 mock 数据
// ============================================================
import { v4 as uuid } from 'uuid'
import type {
  ArdotCanvas, DesignElement, DesignType, DesignExportFormat,
  ArdotAuthState, ArdotServiceStatus, DesignGenerateParams, DesignEditParams,
} from '../../lib/design-types'
import { createMockCanvas } from '../../lib/design-types'

export class ArdotService {
  private authState: ArdotAuthState = {
    connected: false,
    scopes: [],
  }
  private activeCanvas: ArdotCanvas | null = null
  private useMock = true // 无 Ardot API key 时使用 mock

  // 检查 Ardot 是否可用
  getStatus(): ArdotServiceStatus {
    return {
      available: this.authState.connected || this.useMock,
      authState: this.authState,
      activeCanvas: this.activeCanvas ?? undefined,
      message: this.useMock
        ? '⚠️ 当前使用本地模拟画布，非真实 Ardot 云端连接。申请 API key 后可对接腾讯 Ardot 服务。'
        : '已连接 Ardot 云端画布',
    }
  }

  // 连接 Ardot（授权）
  async connect(phone: string): Promise<{ success: boolean; message: string }> {
    // 实际环境下通过手机号自动关联 Ardot 身份
    this.authState = {
      connected: true,
      phone,
      scopes: ['read_canvas', 'edit_canvas', 'cloud_sync'],
      lastSyncAt: Date.now(),
    }
    return { success: true, message: `已关联手机号 ${phone}，Ardot 授权成功` }
  }

  // 生成设计
  async generate(params: DesignGenerateParams): Promise<{ canvas: ArdotCanvas; message: string }> {
    const canvas = createMockCanvas()
    canvas.id = `canvas-${uuid().slice(0, 8)}`
    canvas.elements = this.mockGenerateElements(params)
    canvas.syncedAt = Date.now()
    this.activeCanvas = canvas

    return {
      canvas,
      message: `已在 Ardot 画布生成「${params.type}」类型设计稿，包含 ${canvas.elements.length} 个元素。`,
    }
  }

  // 编辑设计
  async edit(params: DesignEditParams): Promise<{ canvas: ArdotCanvas; changes: string[] }> {
    if (!this.activeCanvas) {
      this.activeCanvas = createMockCanvas()
    }

    const changes: string[] = []

    if (params.elementId) {
      // 智能框选 + 对话修改
      const el = this.activeCanvas.elements.find((e) => e.id === params.elementId)
      if (el) {
        this.applyEditToElement(el, params.instruction)
        changes.push(`修改元素「${el.id}」: ${params.instruction}`)
      }
    } else {
      // 纯语言指挥全局调整
      this.activeCanvas.elements = this.activeCanvas.elements.map((el) => {
        this.applyEditToElement(el, params.instruction)
        return el
      })
      changes.push(`全局调整: ${params.instruction}`)
    }

    this.activeCanvas.syncedAt = Date.now()
    return { canvas: this.activeCanvas, changes }
  }

  // 导出代码
  async exportCode(format: DesignExportFormat): Promise<{ code: string; format: DesignExportFormat }> {
    const canvas = this.activeCanvas || createMockCanvas()
    const code = this.mockGenerateCode(canvas, format)
    return { code, format }
  }

  // 同步画布
  async sync(): Promise<ArdotCanvas | null> {
    if (!this.activeCanvas) return null
    this.activeCanvas.syncedAt = Date.now()
    // 实际环境通过 WebSocket 实时推送画布变更
    return this.activeCanvas
  }

  // ---------- Mock 实现 ----------

  private mockGenerateElements(params: DesignGenerateParams): DesignElement[] {
    const baseElements = createMockCanvas().elements

    if (params.type === 'ui') {
      baseElements[1] = {
        id: `el-input-${uuid().slice(0, 4)}`, type: 'input',
        x: 60, y: 140, width: 260, height: 40,
        style: { backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #d0d5ff', padding: '8px 12px' },
        content: '请输入邮箱地址',
      }
    } else if (params.type === 'ppt') {
      baseElements[0] = {
        id: baseElements[0].id, type: 'text',
        x: 40, y: 100, width: 300, height: 60,
        style: { fontSize: '32px', fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center' },
        content: params.description.slice(0, 30),
      }
    }

    return baseElements
  }

  private applyEditToElement(el: DesignElement, instruction: string): void {
    if (instruction.includes('蓝色') || instruction.includes('blue')) {
      el.style = { ...el.style, backgroundColor: '#4f46e5', color: '#ffffff' }
    } else if (instruction.includes('红色') || instruction.includes('red')) {
      el.style = { ...el.style, backgroundColor: '#dc2626', color: '#ffffff' }
    } else if (instruction.includes('绿色') || instruction.includes('green')) {
      el.style = { ...el.style, backgroundColor: '#16a34a', color: '#ffffff' }
    } else if (instruction.includes('更大') || instruction.includes('放大')) {
      el.width = Math.round(el.width * 1.2)
      el.height = Math.round(el.height * 1.2)
    } else if (instruction.includes('圆角')) {
      el.style = { ...el.style, borderRadius: '24px' }
    }
  }

  private mockGenerateCode(canvas: ArdotCanvas, format: DesignExportFormat): string {
    if (format === 'react') {
      return `import React from 'react'

export default function GeneratedPage() {
  return (
    <div style={{ padding: 40, maxWidth: 400, margin: '0 auto' }}>
      ${canvas.elements.map((el) => {
        if (el.type === 'text') {
          return `<h1 style={${JSON.stringify(el.style)}}>${el.content || ''}</h1>`
        }
        if (el.type === 'button') {
          return `<button style={${JSON.stringify(el.style)}}>${el.content || ''}</button>`
        }
        if (el.type === 'input') {
          return `<input placeholder="${el.content || ''}" style={${JSON.stringify(el.style)}} />`
        }
        return `<div style={${JSON.stringify(el.style)}} />`
      }).join('\n      ')}
    </div>
  )
}`
    }

    if (format === 'vue') {
      return `<template>
  <div style="padding: 40px; max-width: 400px; margin: 0 auto;">
    ${canvas.elements.map((el) => {
      if (el.type === 'text') {
        return `<h1 :style="textStyle">${el.content || ''}</h1>`
      }
      if (el.type === 'button') {
        return `<button :style="buttonStyle">${el.content || ''}</button>`
      }
      return `<div :style="boxStyle" />`
    }).join('\n    ')}
  </div>
</template>

<script setup lang="ts">
const textStyle = ${JSON.stringify(canvas.elements.find((e) => e.type === 'text')?.style || {})}
const buttonStyle = ${JSON.stringify(canvas.elements.find((e) => e.type === 'button')?.style || {})}
const boxStyle = ${JSON.stringify(canvas.elements.find((e) => e.type === 'rectangle')?.style || {})}
</script>`
    }

    // html
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Page</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; display: flex; justify-content: center; padding-top: 60px; }
    .container { max-width: 400px; width: 100%; padding: 40px; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    ${canvas.elements.map((el) => {
      const styles = Object.entries(el.style).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`).join('; ')
      return `.el-${el.id} { ${styles} }`
    }).join('\n    ')}
  </style>
</head>
<body>
  <div class="container">
    ${canvas.elements.map((el) => {
      const tag = el.type === 'text' ? 'h1' : el.type === 'button' ? 'button' : el.type === 'input' ? 'input' : 'div'
      const content = el.content || ''
      if (el.type === 'input') return `<input class="el-${el.id}" placeholder="${content}" />`
      return `<${tag} class="el-${el.id}">${content}</${tag}>`
    }).join('\n    ')}
  </div>
</body>
</html>`
  }
}

export const ardotService = new ArdotService()

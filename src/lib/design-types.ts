// ============================================================
// Ardot 设计创意 (Design-Idea) 数据模型
// 对应 SPEC: specs/From-Beginner-to-Expert-Guide/Design-Idea.md
// 依赖状态: ⚠️ 腾讯内部产品 Ardot，本地需 Ardot API key 或用模拟数据
// ============================================================

// ---------- 画布 ----------
export interface ArdotCanvas {
  id: string
  elements: DesignElement[]
  syncedAt: number
}

export interface DesignElement {
  id: string
  type: DesignElementType
  x: number
  y: number
  width: number
  height: number
  style: Record<string, string>
  content?: string
}

export type DesignElementType = 'rectangle' | 'text' | 'image' | 'button' | 'input'

// ---------- 设计类型 ----------
export type DesignType = 'ui' | 'poster' | 'ppt' | 'logo'

export interface DesignTypeOption {
  id: DesignType
  label: string
  description: string
}

export const DESIGN_TYPES: DesignTypeOption[] = [
  { id: 'ui', label: '移动端 App 界面', description: '手机应用界面设计，支持 iOS/Android' },
  { id: 'ui', label: '网站页面', description: 'Landing Page、官网、后台管理界面' },
  { id: 'poster', label: '海报/Banner', description: '活动海报、广告 Banner、社交媒体图片' },
  { id: 'ppt', label: 'PPT 演示文稿', description: '演示文稿、汇报文档设计' },
  { id: 'logo', label: '品牌 Logo', description: '品牌标志、图标设计' },
]

// ---------- 导出格式 ----------
export type DesignExportFormat = 'html' | 'react' | 'vue'

// ---------- 授权状态 ----------
export interface ArdotAuthState {
  connected: boolean
  phone?: string
  scopes: ArdotScope[]
  lastSyncAt?: number
}

export type ArdotScope = 'read_canvas' | 'edit_canvas' | 'cloud_sync'

export const ARDOT_SCOPES: { id: ArdotScope; label: string; description: string }[] = [
  { id: 'read_canvas', label: '读取画布内容', description: '读取设计稿中的元素、样式、布局信息' },
  { id: 'edit_canvas', label: '编辑画布', description: '代表用户在 Ardot 画布上执行新增、修改、删除等设计操作' },
  { id: 'cloud_sync', label: '云端同步', description: '与 Ardot 浏览器端保持实时双向同步' },
]

// ---------- Agent 工具参数 ----------
export interface DesignGenerateParams {
  description: string
  type: DesignType
}

export interface DesignEditParams {
  elementId?: string
  instruction: string
}

export interface DesignExportParams {
  format: DesignExportFormat
}

// ---------- 服务状态 ----------
export interface ArdotServiceStatus {
  available: boolean
  authState: ArdotAuthState
  activeCanvas?: ArdotCanvas
  message: string
}

// ---------- 本地 mock 画布 ----------
export function createMockCanvas(): ArdotCanvas {
  return {
    id: 'mock-canvas-001',
    elements: [
      {
        id: 'el-header', type: 'text',
        x: 40, y: 60, width: 300, height: 40,
        style: { fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' },
        content: '欢迎使用 Ardot 设计画布',
      },
      {
        id: 'el-rect', type: 'rectangle',
        x: 40, y: 120, width: 300, height: 200,
        style: { backgroundColor: '#f0f4ff', borderRadius: '12px', border: '1px solid #d0d5ff' },
      },
      {
        id: 'el-btn', type: 'button',
        x: 140, y: 260, width: 100, height: 36,
        style: { backgroundColor: '#4f46e5', color: '#ffffff', borderRadius: '6px', fontWeight: '600' },
        content: '开始设计',
      },
    ],
    syncedAt: Date.now(),
  }
}

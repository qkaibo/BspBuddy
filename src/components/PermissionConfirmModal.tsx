import { useState } from 'react'
import { Shield, AlertTriangle, FileText, Trash2, Terminal, Globe, Eye } from 'lucide-react'
import type { PermissionOperationType, PermissionScope, PermissionRequest } from '../lib/types'

export interface OperationConfirmProps {
  type: 'operation'
  request: PermissionRequest
  onAllow: () => void
  onDeny: () => void
}

export interface ModeSwitchConfirmProps {
  type: 'mode-switch'
  onConfirm: () => void
  onCancel: () => void
}

type Props = OperationConfirmProps | ModeSwitchConfirmProps

const OPERATION_LABELS: Record<PermissionOperationType, string> = {
  file_write: '写入文件',
  file_delete: '删除文件',
  execute: '执行命令/脚本',
  network: '网络访问',
}

const OPERATION_ICONS: Record<PermissionOperationType, typeof Shield> = {
  file_write: FileText,
  file_delete: Trash2,
  execute: Terminal,
  network: Globe,
}

const SCOPE_LABELS: Record<PermissionScope, { text: string; color: string }> = {
  workspace: { text: '工作空间内', color: 'var(--success)' },
  protected: { text: '受保护路径', color: 'var(--danger)' },
  external: { text: '工作空间外', color: 'var(--warning)' },
}

const ALTERNATIVES: Record<PermissionOperationType, string[]> = {
  file_write: [
    '先生成预览，确认内容后再写入',
    '先保存到工作空间内的临时文件',
    '先备份目标文件再修改',
  ],
  file_delete: [
    '先展示将要删除的文件清单',
    '使用安全删除（移入回收站）',
    '先生成备份再删除',
  ],
  execute: [
    '先解释脚本内容，确认后再执行',
    '先以预览模式运行（dry-run）',
    '把输出保存到工作空间内',
  ],
  network: [
    '先展示将要访问的 URL 和参数',
    '把网络请求结果缓存到工作空间',
    '使用离线替代方案',
  ],
}

export function PermissionConfirmModal(props: Props) {
  if (props.type === 'mode-switch') {
    return <ModeSwitchModal onConfirm={props.onConfirm} onCancel={props.onCancel} />
  }
  return <OperationModal request={props.request} onAllow={props.onAllow} onDeny={props.onDeny} />
}

function ModeSwitchModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [checked, setChecked] = useState(false)

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-overlay="true"
      style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      overscrollBehavior: 'contain',
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        width: 420, maxWidth: '90vw', padding: 24,
        border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overscrollBehavior: 'contain',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: 'rgba(239,68,68,0.1)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={18} color="#ef4444" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>切换到完全访问权限</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>高风险模式 — 所有二次确认将被关闭</div>
          </div>
        </div>

        <div style={{
          background: 'rgba(239,68,68,0.06)', borderRadius: 'var(--radius-md)',
          padding: 12, marginBottom: 16, border: '1px solid rgba(239,68,68,0.12)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>
            不建议开启完全放开的场景：
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <li>处理生产资料、客户资料、财务资料</li>
            <li>工作目录靠近桌面、下载、个人文档</li>
            <li>批量删除、批量重命名、覆盖文件</li>
            <li>运行不了解的脚本或第三方工具</li>
            <li>重要文件无备份</li>
          </ul>
        </div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)',
        }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span>我确认当前任务可恢复，理解开启后的风险</span>
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={!checked}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              background: checked ? '#ef4444' : 'var(--bg-input)',
              border: 'none', color: checked ? '#fff' : 'var(--text-tertiary)',
              fontSize: 13, cursor: checked ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', fontWeight: 600,
            }}
          >
            确认开启完全访问
          </button>
        </div>
      </div>
    </div>
  )
}

function OperationModal({ request, onAllow, onDeny }: { request: PermissionRequest; onAllow: () => void; onDeny: () => void }) {
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [denied, setDenied] = useState(false)

  const OpIcon = OPERATION_ICONS[request.type]
  const scopeInfo = SCOPE_LABELS[request.scope]
  const alternatives = ALTERNATIVES[request.type]

  const handleDeny = () => {
    setDenied(true)
    setShowAlternatives(true)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-overlay="true"
      style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      overscrollBehavior: 'contain',
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        width: 440, maxWidth: '90vw', padding: 24,
        border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overscrollBehavior: 'contain',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: 'rgba(79,110,247,0.1)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={18} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>权限确认</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              默认权限 — 高风险操作需要你的确认
            </div>
          </div>
        </div>

        {/* Operation details */}
        <div style={{
          background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
          padding: 14, marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <OpIcon size={16} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {OPERATION_LABELS[request.type]}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <InfoRow label="目标" value={request.target} />
            <InfoRow label="影响范围">
              <span style={{
                display: 'inline-block', padding: '1px 8px', borderRadius: 10,
                fontSize: 11, fontWeight: 600,
                background: scopeInfo.color + '20', color: scopeInfo.color,
              }}>
                {scopeInfo.text}
              </span>
            </InfoRow>
            <InfoRow label="执行理由" value={request.reason} />
          </div>
        </div>

        {/* Alternatives section */}
        {showAlternatives && (
          <div style={{
            background: 'rgba(79,110,247,0.06)', borderRadius: 'var(--radius-md)',
            padding: 12, marginBottom: 12, border: '1px solid rgba(79,110,247,0.12)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Eye size={13} color="var(--accent)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>建议的替代方案</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              {alternatives.map((alt, i) => (
                <li key={i}>{alt}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {!denied ? (
            <>
              <button
                onClick={handleDeny}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                取消（不执行）
              </button>
              <button
                onClick={onAllow}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--accent)', border: 'none', color: '#fff',
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  fontWeight: 600,
                }}
              >
                确认执行
              </button>
            </>
          ) : (
            <button
              onClick={onDeny}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                fontFamily: 'inherit', width: '100%',
              }}
            >
              关闭 — 采用替代方案
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 56, flexShrink: 0 }}>{label}</span>
      {children || (
        <span style={{
          fontSize: 12, color: 'var(--text-primary)',
          fontFamily: 'monospace', wordBreak: 'break-all',
          background: 'var(--bg-card)', padding: '2px 6px',
          borderRadius: 4, border: '1px solid var(--border)',
        }}>
          {value}
        </span>
      )}
    </div>
  )
}

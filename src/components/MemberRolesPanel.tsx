// ============================================================
// MemberRolesPanel — 设置 → 成员与角色 (auth-001 Phase B)
// RBAC only; Agent Permission Modes are plan 10 (Composer 下拉)
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw, Plus, Users, AlertCircle } from 'lucide-react'
import { createIpcClient } from '../lib/client'
import { IPC_CHANNELS } from '../lib/types'
import type { AuthMeResult, PublicUser, RoleId, MemberStatus } from '../lib/auth-types'
import { isAdmin, roleLabel, statusLabel } from '../lib/auth-types'
import { panelRootStyle } from '../lib/panel-layout'

const ipc = createIpcClient()

interface Props {
  onBack: () => void
}

type MePayload = AuthMeResult & { phase1Local?: boolean; tenantName?: string; error?: string; code?: string }

export function MemberRolesPanel({ onBack }: Props) {
  const [me, setMe] = useState<MePayload | null>(null)
  const [items, setItems] = useState<PublicUser[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [editor, setEditor] = useState<'create' | PublicUser | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const meRes = await ipc.invoke(IPC_CHANNELS.AUTH_ME) as MePayload
      if (meRes?.error || !meRes?.actor) {
        setError(meRes?.error || '未登录')
        setMe(null)
        setItems([])
        return
      }
      setMe(meRes)

      if (!isAdmin(meRes.actor)) {
        setItems([])
        return
      }

      const listRes = await ipc.invoke(IPC_CHANNELS.AUTH_USERS_LIST, { q }) as {
        items?: PublicUser[]
        error?: string
        code?: string
      }
      if (listRes?.error) {
        setError(listRes.error)
        setItems([])
      } else {
        setItems(listRes.items || [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => { load() }, [load])

  const admin = me?.actor ? isAdmin(me.actor) : false

  return (
    <div style={panelRootStyle()}>
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px',
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button type="button" onClick={onBack} aria-label="返回" style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}>
          <ArrowLeft size={16} color="var(--text-secondary)" aria-hidden="true" />
        </button>
        <Users size={14} color="var(--text-secondary)" aria-hidden="true" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>成员与角色</span>
        {admin && (
          <>
            <button
              type="button"
              onClick={() => load()}
              aria-label="刷新"
              style={iconBtnStyle}
            >
              <RefreshCw size={14} />
            </button>
            <button
              type="button"
              onClick={() => setEditor('create')}
              style={primaryBtnStyle}
            >
              <Plus size={13} aria-hidden="true" /> 新建成员
            </button>
          </>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {me?.phase1Local && (
          <div style={{
            marginBottom: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 11,
          }}>
            Phase 1 桌面本地会话（单租户模拟）— 非完整云端多用户 IAM
          </div>
        )}

        {/* Current account card — all members */}
        {me?.user && (
          <div style={{
            marginBottom: 16, padding: 14, borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'var(--bg-card)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>当前账号</div>
            <Row label="显示名" value={me.user.displayName || me.user.username} />
            <Row label="用户名" value={me.user.username} />
            <Row label="角色" value={me.user.roles.map(roleLabel).join('、')} />
            <Row label="租户" value={`${me.tenantName || me.user.tenantId} (${me.user.tenantId})`} />
          </div>
        )}

        {loading && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 24, textAlign: 'center' }}>加载中…</div>
        )}

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: 12, marginBottom: 12,
            borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 12,
          }}>
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </div>
        )}

        {!loading && !admin && me?.user && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0' }}>
            需要管理员权限才能管理租户成员。你可在上方查看当前账号信息。
          </div>
        )}

        {!loading && admin && (
          <>
            <input
              type="search"
              placeholder="搜索 用户名/显示名/角色…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="搜索成员"
              style={{
                width: '100%', boxSizing: 'border-box', marginBottom: 12,
                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', background: 'var(--bg-input)',
                color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
              }}
            />

            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 12 }}>
                <p>还没有其他成员</p>
                <button type="button" onClick={() => setEditor('create')} style={{ ...primaryBtnStyle, marginTop: 8 }}>
                  <Plus size={13} /> 新建成员
                </button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: 'var(--text-tertiary)', textAlign: 'left' }}>
                    <th style={thStyle}>用户名</th>
                    <th style={thStyle}>显示名</th>
                    <th style={thStyle}>角色</th>
                    <th style={thStyle}>状态</th>
                    <th style={thStyle}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={tdStyle}>{u.username}</td>
                      <td style={tdStyle}>{u.displayName || '—'}</td>
                      <td style={tdStyle}>
                        {u.roles.map((r) => (
                          <span key={r} style={tagStyle(r)}>{roleLabel(r)}</span>
                        ))}
                      </td>
                      <td style={tdStyle}>{statusLabel(u.status)}</td>
                      <td style={tdStyle}>
                        <button type="button" onClick={() => setEditor(u)} style={linkBtnStyle}>编辑</button>
                        {u.status === 'active' && u.id !== me?.user?.id && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`禁用成员 ${u.username}？禁用后无法登录。`)) return
                              const res = await ipc.invoke(IPC_CHANNELS.AUTH_USERS_UPDATE, u.id, { status: 'disabled' as MemberStatus }) as { error?: string }
                              if (res?.error) showToast(res.error)
                              else { showToast('已禁用'); load() }
                            }}
                            style={{ ...linkBtnStyle, color: '#ef4444' }}
                          >
                            禁用
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        <p style={{ marginTop: 20, fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          资源编辑权（如 SOP）由各资源 ACL 决定，见创作台说明。
          对话输入框旁的「默认权限 / 完全访问」是 Agent 工具沙箱（plan 10），不是成员角色。
        </p>
      </div>

      {toast && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 16px', borderRadius: 8, background: 'var(--text-primary)',
          color: 'var(--bg-card)', fontSize: 12, zIndex: 20,
        }}>
          {toast}
        </div>
      )}

      {editor && (
        <MemberEditorModal
          mode={editor === 'create' ? 'create' : 'edit'}
          initial={editor === 'create' ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); showToast('已保存'); load() }}
          onError={showToast}
        />
      )}
    </div>
  )
}

function MemberEditorModal({
  mode,
  initial,
  onClose,
  onSaved,
  onError,
}: {
  mode: 'create' | 'edit'
  initial: PublicUser | null
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const [username, setUsername] = useState(initial?.username || '')
  const [displayName, setDisplayName] = useState(initial?.displayName || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<RoleId>(initial?.roles.includes('admin') ? 'admin' : 'member')
  const [status, setStatus] = useState<MemberStatus>(initial?.status || 'active')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      if (mode === 'create') {
        const res = await ipc.invoke(IPC_CHANNELS.AUTH_USERS_CREATE, {
          username: username.trim(),
          displayName: displayName.trim() || undefined,
          password,
          roles: [role],
        }) as { error?: string }
        if (res?.error) { onError(res.error); return }
      } else if (initial) {
        const payload: { displayName?: string; password?: string; roles: RoleId[]; status: MemberStatus } = {
          displayName: displayName.trim() || undefined,
          roles: [role],
          status,
        }
        if (password) payload.password = password
        const res = await ipc.invoke(IPC_CHANNELS.AUTH_USERS_UPDATE, initial.id, payload) as { error?: string }
        if (res?.error) { onError(res.error); return }
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? '新建成员' : '编辑成员'}
      style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 360, maxWidth: '92%', padding: 20, borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--text-primary)' }}>
          {mode === 'create' ? '新建成员' : '编辑成员'}
        </div>
        <Field label="用户名">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={mode === 'edit'}
            autoComplete="off"
            style={inputStyle}
          />
        </Field>
        <Field label="显示名">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label={mode === 'create' ? '密码' : '密码（留空不改）'}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            style={inputStyle}
          />
        </Field>
        <Field label="角色">
          <select value={role} onChange={(e) => setRole(e.target.value as RoleId)} style={inputStyle}>
            <option value="member">成员</option>
            <option value="admin">管理员</option>
          </select>
        </Field>
        {mode === 'edit' && (
          <Field label="状态">
            <select value={status} onChange={(e) => setStatus(e.target.value as MemberStatus)} style={inputStyle}>
              <option value="active">启用</option>
              <option value="disabled">禁用</option>
            </select>
          </Field>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={ghostBtnStyle}>取消</button>
          <button type="button" onClick={submit} disabled={saving} style={primaryBtnStyle}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 4 }}>
      <span style={{ color: 'var(--text-tertiary)', width: 56, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '8px 6px', fontWeight: 500 }
const tdStyle: React.CSSProperties = { padding: '10px 6px', color: 'var(--text-primary)', verticalAlign: 'middle' }
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
  background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
}
const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
}
const ghostBtnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
}
const iconBtnStyle: React.CSSProperties = {
  padding: 6, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-secondary)',
  display: 'inline-flex',
}
const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
  fontSize: 12, fontFamily: 'inherit', padding: '0 6px 0 0',
}

function tagStyle(role: RoleId): React.CSSProperties {
  return {
    display: 'inline-block', padding: '2px 6px', marginRight: 4, borderRadius: 4, fontSize: 11,
    background: role === 'admin' ? 'var(--accent-light)' : 'var(--bg-input)',
    color: role === 'admin' ? 'var(--accent)' : 'var(--text-secondary)',
  }
}

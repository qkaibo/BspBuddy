# 10 — 权限与安全沙箱 (Permission Modes)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Permission-Modes.md`
> Status: ❌ P3 待开发

## 功能概要

默认权限和完全访问权限两种模式。默认权限下，AI 在工作空间内高效执行任务，但高风险操作(敏感路径写入/重要删除/脚本命令/网络)会暂停请求确认。完全放开模式关闭所有二次确认，仅在可信隔离环境使用。

## 一、模式入口 (权限 UI 位置)

**位置**: 新建任务输入框下方，点击「默认权限」下拉菜单切换。

(不是顶栏或其他位置)

## 二、默认权限保护的操作

| 操作类型 | 说明 |
|----------|------|
| 写入受保护/敏感路径 | 避免覆盖密钥、凭据、安全配置 |
| 删除受保护文件/重要目录/批量删除 | 避免误删难恢复的资料 |
| 执行脚本/命令/外部程序 | 可能修改文件、访问网络或影响系统 |
| 网络访问/敏感能力 | 命中安全中心规则或高风险能力时确认 |

取消确认 → 不执行该步骤 → 继续对话 → 换更安全的替代方式

### 额外保护机制

| 机制 | 说明 |
|------|------|
| **沙箱约束命令执行** | 限制命令的执行环境 |
| **安全删除/回收站** | 降低误删风险 |
| **文件备份** | 修改已有文件前提前备份(新建不备份，当前仅 Windows 支持) |

## 三、确认弹窗内容

确认时重点看三件事：

1. **操作内容**: 写文件/删文件/执行脚本
2. **影响范围**: 路径是否在工作空间内，是否影响桌面/下载/项目源码/重要目录
3. **执行理由**: 这步是否确实必需

不确定就取消，让 WorkBuddy 改为：
- 先展示要修改/删除的文件清单
- 先生成预览或备份
- 把输出保存到工作空间内
- 先解释脚本内容后再执行

## 四、完全放开 (Full Access)

- 关闭所有二次确认：写入/删除/脚本/外部程序均不再逐步确认
- 从下拉菜单切换时弹出确认弹窗 → 勾选风险确认 → 继续
- 不确定直接取消，继续默认权限

**不建议开启**：
- 处理生产资料/客户资料/财务资料/唯一副本
- 工作目录靠近桌面/下载/个人文档/仓库根目录
- 批量删除/批量重命名/覆盖文件
- 运行不了解的脚本/第三方工具
- 重要文件无备份

## 五、推荐使用方式

1. 为每个任务准备独立工作空间
2. 重要文件先备份
3. 默认使用默认权限
4. 看懂确认弹窗再继续
5. 不确定就取消
6. **完全放开用完即关**

## 六、实现任务 (实现细节)

### 10-1 权限服务 (`src/main/services/permission.ts`)

```typescript
interface PermissionRequest {
  type: 'file_write' | 'file_delete' | 'execute' | 'network'
  target: string
  scope: 'workspace' | 'protected' | 'external'
  reason: string
}

interface PermissionResponse {
  action: 'allow' | 'deny' | 'allow_once' | 'allow_always'
  alternatives?: string[]
}

class PermissionService {
  currentMode: 'default' | 'full_access'
  
  // 默认权限: 自动通过工作空间内操作，高风险暂停确认
  // 完全放开: 全部自动通过
  check(request: PermissionRequest): Promise<PermissionResponse>
  
  // 保护路径检测
  isProtected(path: string): boolean
  
  // 沙箱约束
  sanitizeCommand(cmd: string): string
}
```

### 10-2 权限 UI (实现细节)

**文件**: `src/components/PermissionSelector.tsx`

- 位置: 新建任务输入框下方下拉菜单
- 选项: 默认权限 / 完全访问权限
- 切换到完全访问 → 弹窗确认 + 风险提示

**文件**: `src/components/PermissionConfirmModal.tsx`

- 确认卡片: 操作类型 / 影响范围 / 执行理由
- 取消后展示替代方案: 预览/备份/工作空间内操作/解释脚本

### 10-3 IPC 通道

```typescript
PERMISSION_CHECK: 'permission:check'
PERMISSION_MODE_CHANGE: 'permission:mode-change'
PERMISSION_RESPONSE: 'permission:response'
```

## 七、验收标准

- [ ] 输入框下方下拉菜单 → 显示默认权限/完全访问权限
- [ ] 切换到完全访问 → 弹窗风险确认
- [ ] 默认权限下 Agent 尝试删除桌面文件 → 确认弹窗
- [ ] 取消确认 → 不执行 → Agent 提供替代方案(预览/备份/工作空间内操作)
- [ ] 工作空间内文件写入 → 自动通过(默认权限)
- [ ] Windows: 修改已有文件前自动备份
- [ ] 完全放开用完即关(切换回默认权限正常弹窗确认)

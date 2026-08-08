# 18 — 安装指南 (Windows + Mac)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Installation-Win-Guide.md`, `specs/From-Beginner-to-Expert-Guide/Installation-Mac-Guide.md`
> Status: ✅ 已实现 (Electron 打包即安装)

## 一、环境要求

| 平台 | 要求 | 排除 |
|------|------|------|
| Windows | Windows 10 及以上 | 不支持 Windows 7/8/8.1 |
| Mac | macOS 12 (Monterey) 及以上 | — |
| Mac 芯片 | M系列 → ARM64 / Intel → X64 | 选错版本无法启动 |

## 二、Windows 安装向导

1. 官网点击下载 → 等待完成
2. 双击安装包
3. 勾选「我同意此协议」→ 下一步
4. 选择安装路径 → 下一步
5. 确认开始菜单文件夹 → 下一步
6. 勾选「创建桌面快捷方式」→ 下一步
7. 确认配置 → 安装
8. 完成 → 退出安装向导

## 三、Mac 安装向导

1. 官网选择对应芯片版本下载
2. 双击 `.dmg` 磁盘映像
3. 拖入 Applications 文件夹 → 等待拷贝
4. 推出磁盘映像 + 可选删除 `.dmg`

**芯片选择指导**: 左上角苹果 → 关于本机 → 查看处理器
- M系列 → Mac ARM64
- Intel → Mac X64

## 四、登录流程 (双平台)

1. 启动 WorkBuddy → 点击登录
2. **勾选《服务条款》与《隐私协议》** (协议勾选步骤)
3. 微信扫码完成登录
4. 自动返回客户端

## 五、版本更新

| 入口 | 路径 |
|------|------|
| Windows | 左下角头像 → 检查更新 |
| Mac | 左下角个人中心 → 检查更新 |

自动检测 → 有新版自动下载完成升级。

## 六、语言切换

- 左下角头像 → 语言 → 中文(简体)/English

## 七、安装后清理

| 平台 | 建议 |
|------|------|
| Windows | 安装向导完成后可删除安装包 |
| Mac | `.dmg` 安装后可从下载目录删除 |

## 八、实现任务 (实现细节)

### 18-1 Electron 打包配置

**文件**: `electron-vite.config.ts` / `package.json`

```json
{
  "build": {
    "appId": "com.workbuddy.app",
    "mac": {
      "target": ["dmg", "zip"],
      "artifactName": "WorkBuddy-${version}-${arch}.${ext}"
    },
    "win": {
      "target": ["nsis"],
      "artifactName": "WorkBuddy-${version}.${ext}"
    },
    "nsis": {
      "oneClick": false,            // 显示安装向导(协议/路径/快捷方式)
      "allowToChangeInstallationDirectory": true
    },
    "protocols": {
      "name": "WorkBuddy",
      "schemes": ["workbuddy"]
    }
  }
}
```

### 18-2 登录流程验证

```typescript
// 登录前校验: 必须勾选协议
interface LoginState {
  termsAccepted: boolean   // 服务条款
  privacyAccepted: boolean // 隐私协议
}
// 两者都勾选才可扫码
```

### 18-3 自动更新 (实现细节)

```typescript
// electron-updater
import { autoUpdater } from 'electron-updater'
// 检查更新入口: 头像 → 检查更新
// 后台静默下载，安装后提示重启
```

## 九、验收标准

- [ ] Windows 安装向导 → 协议勾选 → 路径选择 → 桌面快捷方式 → 完成
- [ ] Mac `.dmg` → 拖入 Applications → 启动正常
- [ ] Mac M系列/Intel 用户选择正确版本
- [ ] 登录 → 勾选协议 → 微信扫码 → 自动进入
- [ ] 左下角切换语言 → 中文/English 即时生效
- [ ] 检查更新 → 自动下载 → 升级完成
- [ ] 不满足系统要求 → 无法启动

# 06 — 插件生态 (Plugins + Skills + MCP + Expert)

> 对应 SPEC: `specs/Plugins.md`, Plug-In, Skills-Market, Expert-Center, MCP-Guide
> Status: ❌ P3 待开发

## 功能概要

BspBuddy 核心扩展系统：
- **技能(Skills)**: 教会 AI 完成特定任务的工具能力(发邮件、查股价、调API)
- **MCP**: AI 的 "USB 接口"，连接外部工具和服务
- **专家(Expert)**: 角色化 AI(人设+方法论+工具链)；专家团:(多Agent协作)
- **插件(Plugin)**: 打包 Skill + MCP + Slash Commands + Hooks + Agents 统一分发

## 插件类型 (5种)

| 类型 | 说明 |
|------|------|
| Skill | 技能插件，添加特定领域能力 |
| MCP | 连接外部服务和数据源 |
| Hook | 钩子插件，特定时机自动执行操作 |
| Agent | 智能体插件，专门任务处理能力 |
| Rule | 规则插件，定义行为规范 |

## 专家 vs Skill vs 专家团

| 维度 | Skill | 专家 | 专家团 |
|------|-------|------|--------|
| 关系 | 工具能力 | AI顾问(能力+经验) | 多位专家+协作流程 |
| 怎么选 | 需要某种工具能力 | 明确单点问题 | 任务复杂，需多角色配合 |

## 实现文件

```
src/components/PluginPanel.tsx       - 插件管理面板
src/components/SkillMarketPanel.tsx  - 技能市场
src/components/MCPConfigPanel.tsx    - MCP配置
src/components/ExpertCenter.tsx      - 专家中心
src/lib/plugin-types.ts              - 插件类型定义
```

## 验收标准

- [ ] 安装 PPT Skill → 对话中自动调用
- [ ] 创建"数据分析专家" → 专家身份回复
- [ ] 召唤"市场分析专家团" → 团长拆解+并行执行+整合输出
- [ ] 配置 WeCom MCP → Agent 可发送企微消息
- [ ] 输入 `/周报` → 自动执行周报生成
- [ ] 技能安装前显示安全警告和权限说明

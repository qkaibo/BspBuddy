# 文档生成工作流

> 记录用什么 Skill/工具、按什么顺序、产出什么文档。配合 [STANDARD.md](./STANDARD.md)（规范）使用。

---

## 涉及的工具与 Skill

| 序号 | 工具/Skill | 用途 | 前置条件 |
|------|-----------|------|---------|
| ① | **code-to-prd** | 扫描现有代码，自动生成页面级 PRD（布局、字段、交互） | 有可运行的前后端代码 |
| ② | **domain-modeling** | 建立 CONTEXT.md 领域术语表，消除歧义 | 了解项目核心概念后 |
| ③ | **AI 手动补充** | 按 STANDARD.md 模板改写/补全/合并 PRD | code-to-prd 产出后 |
| ④ | **AI 手动生成** | 按模板生成 Tech Spec（API/数据库/流程等） | PRD 基本确定后 |
| ⑤ | **AI 手动整理** | 生成 Reference 文档（API 清单、枚举字典、页面流程） | API/枚举/路由确定后 |
| ⑥ | **doc-sweep** | 审查文档与代码的一致性，找出过时/错误内容 | 文档初稿完成后 |
| ⑦ | **create-rule** | 在 `.cursor/rules/` 创建文档规范 rule，让 AI 后续自动遵守 | 文档规范确定后 |

---

## 通用工作流（6 步）

```
┌─────────────┐    ┌───────────────┐    ┌───────────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────────┐
│ 1. 建立术语   │ → │ 2. 生成初版PRD │ → │ 3. 生成详细PRD  │ → │ 4. 生成TS+Ref │ → │ 5. 一致性审查 │ → │ 6. 规范沉淀    │
│ domain-      │   │ code-to-prd   │   │ AI 改写/补全   │   │ AI 生成       │   │ doc-sweep    │   │ create-rule   │
│ modeling     │   │               │   │                │   │               │   │              │   │               │
└─────────────┘    └───────────────┘    └───────────────┘    └─────────────┘    └──────────────┘    └───────────────┘
        │                  │                   │                    │                   │                   │
   docs/CONTEXT.md  prd/pages/*.md     docs/prd/prd-*.md   docs/tech-spec/ts-*.md  修正后的文档         .cursor/rules/
                                         (合并/补全/规范)    docs/reference/ref-*.md                   documentation-
                                                                                                      standard.mdc
```

---

## 分步详解

### 第 1 步：建立领域术语（domain-modeling）

**时机：** 阅读代码、了解项目核心概念之后。

**操作：** 告诉 AI：
> "使用 domain-modeling 创建 CONTEXT.md"

**产出：** `docs/CONTEXT.md`

**内容：** 核心实体定义、避免混淆的别名、统一使用的术语。这一步很重要——先统一语言，后续所有文档才不会有歧义。

---

### 第 2 步：自动生成初版 PRD（code-to-prd）

**时机：** 有可运行的前后端代码 + 已了解项目结构。

**操作：** 告诉 AI：
> "运行 code-to-prd"

**产出：** 每个页面一个 Markdown 文件（`prd/pages/01-login.md`、`02-xxx.md` …）+ `prd/README.md` + `prd/appendix/`（枚举字典、API 清单、页面关系）

**特点：**
- 自动扫描路由、组件、API 调用
- 聚焦前端交互：布局图、字段表、交互流程
- 不包含后端架构、数据库、安全等技术细节

**注意：** code-to-prd 产出的文件是按页面拆分的，第 3 步要合并成模块级 PRD。

---

### 第 3 步：补全/合并为标准 PRD（AI 手动）

**时机：** code-to-prd 跑完后。

**操作：** 告诉 AI：
> "按 STANDARD.md 的 PRD 模板，把 prd/pages/ 的页面文档合并成 docs/prd/prd-*.md"

**AI 会做的事：**
1. 把 2-3 个关联页面合并为一个模块 PRD（如 agents+dashboard+gallery → prd-001-agent）
2. 补全 8 章节模板：概述、用户场景、功能清单、数据模型、页面与字段、API 依赖、页面关系、验收标准
3. 保留 code-to-prd 的 ASCII 布局图和字段表
4. 添加 YAML front matter
5. 删除旧的 `prd/` 目录

**如果没有 code-to-prd（比如新项目还没代码）：** 从零开始，告诉 AI：
> "按 STANDARD.md 模板，创建 XXX 模块的 PRD，路由是 /xxx，包含以下页面…"

---

### 第 4 步：生成 Tech Spec 和 Reference（AI 手动）

**时机：** PRD 全部完成后。

**操作：** 告诉 AI：
> "按 STANDARD.md 的 Tech Spec 模板，逐个模块生成 docs/tech-spec/ts-*.md"

**每个 Tech Spec 至少回答 7 个问题：**
1. 这段代码做什么？（概述）
2. 为什么这样设计？（设计目标/权衡）
3. 哪些 API 端点？（端点/Schema/认证）
4. 数据库表结构？（字段/类型/约束/索引）
5. 核心流程怎么走？（时序/状态机）
6. 安全怎么保证？（加密/权限/隔离）
7. 和 PRD 有什么偏差？

**Reference 文档：** 告诉 AI：
> "按 STANDARD.md 的 Reference 模板，生成 API 清单、枚举字典、页面流程三个文档"

---

### 第 5 步：一致性审查（doc-sweep）

**时机：** 所有文档初稿完成后、每次代码大改后。

**操作：** 告诉 AI：
> "使用 doc-sweep 审查文档与代码的一致性"

**产出：** 差异清单，分三类：
- **行为漂移（Type A）：** 文档描述的和代码实现的行为不一致 → 必须修
- **不变约束违反：** 文档记录的安全规则代码没遵守 → 怀疑是 bug
- **过期引用（Type C）：** 文档引用的文件名/字段名已不存在 → 必须修

**修完后：** 告诉 AI "修复"即可。

---

### 第 6 步：规范沉淀（create-rule）

**时机：** 文档规范确定后。

**操作：** 告诉 AI：
> "用 create-rule 创建文档规范，加载到 .cursor/rules/"

**产出：** `.cursor/rules/documentation-standard.mdc`

**效果：** 之后只要在项目里操作 `docs/` 下的文件，AI 自动按规范写。不用每次说"按规范"。

---

## 不同场景的启动入口

### 场景 A：老项目补文档（有代码、无文档）← 最典型

```
第 1 步 domain-modeling → CONTEXT.md
第 2 步 code-to-prd → 页面级 PRD
第 3 步 AI 合并补全 → 模块级 PRD
第 4 步 AI 生成 → Tech Spec + Reference
第 5 步 doc-sweep → 审查修正
第 6 步 create-rule → 规范沉淀
```

### 场景 B：新项目（先文档、后代码）← 正向设计

```
第 1 步 domain-modeling → CONTEXT.md
第 3 步 AI 手动从零写 → 模块级 PRD（跳过 code-to-prd）
第 4 步 AI 生成 → Tech Spec
第 6 步 create-rule → 规范沉淀
（第 5 步 doc-sweep 在有了代码后再跑）
```

### 场景 C：已有部分文档，需要补充/重组

```
第 5 步 doc-sweep → 检查缺失和过时
第 3 步 补缺的 PRD
第 4 步 补缺的 Tech Spec
第 6 步 create-rule → 规范沉淀
```

### 场景 D：日常迭代 — 只改一个模块

```
修改代码
→ 更新对应的 PRD（手动或让 AI 改）
→ 更新对应 Tech Spec（手动或让 AI 改）
→ 第 5 步 doc-sweep 审查
```

---

## 对 AI 说的指令速查

| 步骤 | 指令 |
|------|------|
| 建立术语 | "使用 domain-modeling 创建 CONTEXT.md" |
| 自动生成 PRD | "运行 code-to-prd" |
| 合并为标准 PRD | "按 STANDARD.md 把 prd/pages/ 合并为 docs/prd/prd-*.md" |
| 从零写 PRD | "按 STANDARD.md 模板创建 XXX 模块 PRD" |
| 生成 Tech Spec | "按 STANDARD.md 生成 XXX 的 Tech Spec" |
| 生成 Reference | "按 STANDARD.md 生成三个 Reference 文档" |
| 一致性审查 | "使用 doc-sweep 审查所有文档" |
| 沉淀规范 | "用 create-rule 创建文档规范 rule" |

---

## 附录：本项目实际使用记录

| 步骤 | 实际操作 | 结果 |
|------|---------|------|
| 1 | domain-modeling | 创建 `CONTEXT.md`，定义了 Agent/SOP Skill/Knowledge Base 等术语 |
| 2 | code-to-prd | 生成 18 个页面 PRD + 3 个附录（`prd/pages/` + `prd/appendix/`） |
| 3 | AI 合并 | 18 页面 + 8 旧 PRD → 合并为 15 个标准 PRD（`docs/prd/prd-*.md`） |
| 4 | AI 生成 TS | 23 个 Tech Spec（`docs/tech-spec/ts-*.md`）+ 3 个 Reference |
| 5 | doc-sweep | 审查 48 文档，发现 9 行为漂移 + 11 过期引用，全部修正 |
| 6 | create-rule | 创建 `.cursor/rules/documentation-standard.mdc` |
| 最终 | 删除旧目录 | `specs/` 和旧 `prd/` 全部删除 |

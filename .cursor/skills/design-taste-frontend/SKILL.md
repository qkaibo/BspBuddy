---
name: design-taste-frontend
description: Taste Skill 中文版 — 反-slop 前端设计规范。生成或评审前端 UI 时使用，避免模板化 AI 审美（蓝紫渐变、默认字体、无意义动画等）。
---
# Taste Skill 中文版 - 反-slop 设计规范 v1.1

**版本**：v1.1（改进版）  
**更新时间**：2026-05-26  
**作者**：QClaw  
**适用场景**：AI Agent 生成前端界面（Claude Code、ChatGPT、Cursor等）

---

## 快速参考卡片（打印出来贴在墙上）

### 配色速查
```
主色：#1a1a1a（深灰）
辅色：#666（中灰）
强调色：#2563eb（品牌蓝）或 #0d9488（深青）或 #ea580c（暖橙）
背景：#fafafa（浅灰）
表面：#fff（白色）
边框：#e5e5e5（淡灰）

语义色：
  成功：#16a34a  警告：#d97706  错误：#dc2626  信息：#2563eb

❌ 禁止：蓝紫渐变
❌ 禁止：高饱和度颜色
❌ 禁止：超过3种颜色
```

### 字号速查
```
H1（页面主标题）: 2.5rem - 3rem
H2（章节标题）: 2rem
H3（小节标题）: 1.5rem
H4（卡片标题）: 1.25rem
正文: 1rem
辅助文字: 0.875rem
注释: 0.75rem
```

### 间距速查（4px基准）
```
space-1: 0.25rem (4px)   space-2: 0.5rem (8px)
space-3: 0.75rem (12px)  space-4: 1rem (16px)
space-6: 1.5rem (24px)  space-8: 2rem (32px)
space-12: 3rem (48px)   space-16: 4rem (64px)
```

### 圆角速查
```
按钮：4px
卡片：8px
输入框：4px
模态框：8px
❌ 禁止：>12px 的圆角
```

### 动画速查
```
过渡时长：0.2s
缓动函数：cubic-bezier(0.4, 0, 0.2, 1)
Hover效果：translateY(-2px) + 阴影
Focus效果：box-shadow（不用outline）

❌ 禁止：弹跳动画
❌ 禁止：旋转动画
❌ 禁止：无意义的动画
```

---

## 一、核心原则：什么是"反-slop"？

### 1.1 Slop的典型特征（❌ 避免这些）

**通俗化UI的三大标志**：
- **默认字体**：System UI、Arial、微软雅黑
- **模板配色**：蓝紫渐变、高饱和度、毛玻璃
- **无意义动画**：弹跳、旋转、淡入淡出滥用

### 1.2 反-slop的设计哲学（✅ 追求这些）

**三个核心价值**：
1. **有品味**：每个设计决策都有理由
2. **有克制**：少即是多，less is more
3. **有细节**：排版、字体、动画精确调优
4. **有个性**：反-slop ≠ 无趣，是有品味地有个性

---

## 二、中文排版规范（差异化重点）

### 2.1 字体选择

#### 2.1.1 标题字体（衬线 vs 无衬线）

**技术产品**：
```css
font-family: "Noto Serif SC", "Source Han Serif CN", serif;
```

**消费产品**：
```css
font-family: "ZCOOL QingKe HuangYou", "Ma Shan Zheng", cursive;
```

**内容产品**（博客、文档）：
```css
font-family: "LXGW WenKai", "Fira Code Nerd Font", monospace;
```

#### 2.1.2 中英文字体搭配

**黄金搭配公式**：
```
中文衬线（标题）+ 英文衬线（标题）→ 经典、权威
中文无衬线（标题）+ 英文无衬线（标题）→ 现代、简洁
中文衬线（标题）+ 英文无衬线（标题）→ 混搭、有层次
```

**示例CSS**：
```css
.title {
  font-family: "Noto Serif SC", "Georgia", serif;
}

.code {
  font-family: "Fira Code Nerd Font", "Noto Sans Mono CJK SC", monospace;
}

.body {
  font-family: "Noto Sans SC", -apple-system, "Segoe UI", sans-serif;
}
```

### 2.2 字号层级

```css
:root {
  --font-size-xs: 0.75rem;    /* 12px - 辅助信息 */
  --font-size-sm: 0.875rem;   /* 14px - 注释、标签 */
  --font-size-base: 1rem;     /* 16px - 正文 */
  --font-size-lg: 1.125rem;   /* 18px - 大正文、副标题 */
  --font-size-xl: 1.5rem;     /* 24px - 小标题 */
  --font-size-2xl: 2rem;      /* 32px - 中标题 */
  --font-size-3xl: 2.5rem;    /* 40px - 大标题 */
  --font-size-4xl: 3rem;      /* 48px - Hero标题 */
}
```

### 2.3 行高与字间距

```css
.body {
  line-height: 1.75;
  letter-spacing: 0.02em;
}

.title {
  line-height: 1.3;
  letter-spacing: 0.05em;
}

.article {
  line-height: 1.8;
  letter-spacing: 0.03em;
}
```

### 2.4 中文字体加载策略

**策略1：系统字体优先（0延迟）**
```css
font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
```

**策略2：CDN + 系统回退（推荐）**
```css
font-family: "Noto Sans SC", "PingFang SC", sans-serif;
/* 配合 font-display: swap */
```

**策略3：子集化（按需加载）**
```css
@font-face {
  font-family: 'Noto Sans SC';
  src: url('noto-sans-sc-subset.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+4E00-9FFF; /* 只加载CJK常用区 */
}
```

---

## 三、配色规范（反-slop重点）

### 3.1 反对蓝紫渐变

**Slop配色**（❌ 避免）：
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

**反-slop配色**（✅ 推荐）：

#### 单色系（最安全）
```css
--color-primary: #1a1a1a;
--color-secondary: #666;
--color-accent: #2563eb;
--color-bg: #fff;
--color-surface: #fafafa;
--color-border: #e5e5e5;
```

#### 双色系（有对比）
```css
--color-primary: #0f172a;
--color-accent: #0d9488;  /* 深青 */
--color-bg: #f8fafc;
```

#### 三色系（有层次）
```css
--color-primary: #18181b;
--color-secondary: #71717a;
--color-accent: #ea580c;  /* 暖橙 */
--color-bg: #fafafa;
```

### 3.2 语义色（新增）

```css
--color-success: #16a34a;
--color-warning: #d97706;
--color-error: #dc2626;
--color-info: #2563eb;

--color-success-bg: #f0fdf4;
--color-warning-bg: #fef9c3;
--color-error-bg: #fef2f2;
--color-info-bg: #eff6ff;
```

### 3.3 中国色/传统色（差异化）

**经典中国色**：
```css
--color-中国红: #c9372e;
--color-琉璃黄: #f2d43a;
--color-青花蓝: #2c4c8b;
--color-水墨黑: #1c1c1c;
--color-宣纸白: #f7f4ed;
```

**低调中国色**：
```css
--color-松花: #bce672;
--color-竹青: #789262;
--color-月白: #d6ecf0;
--color-藕荷: #e4c6d0;
```

---

## 四、间距系统（新增）

### 4.1 4px基准间距

```css
:root {
  /* 4px基准间距系统 */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;  /* 20px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;  /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
}
```

### 4.2 间距使用规范

```css
/* 组件内间距 */
.card { padding: var(--space-6); }

/* 组件间间距 */
.card + .card { margin-top: var(--space-4); }

/* 段落间距 */
p + p { margin-top: var(--space-3); }

/* 章节间距 */
.section + .section { margin-top: var(--space-12); }
```

---

## 五、暗色模式（新增）

### 5.1 自动暗色模式

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #fafafa;
    --color-secondary: #a1a1aa;
    --color-bg: #0a0a0a;
    --color-surface: #171717;
    --color-border: #262626;
  }
}
```

### 5.2 手动切换暗色模式

```css
[data-theme="dark"] {
  --color-primary: #fafafa;
  --color-secondary: #a1a1aa;
  --color-bg: #0a0a0a;
  --color-surface: #171717;
  --color-border: #262626;
}
```

---

## 六、动画规范

### 6.1 有目的的微交互

**Hover状态**（引导点击）：
```css
.button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

**Focus状态**（无障碍）：
```css
.input:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
```

### 6.2 尊重用户偏好

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 七、组件示例

### 7.1 按钮组件

```css
.btn-primary {
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  color: #fff;
  background: #1a1a1a;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.btn-primary:hover {
  background: #333;
  transform: translateY(-1px);
}
```

### 7.2 卡片组件

```css
.card {
  padding: 1.5rem;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
}
```

### 7.3 表单组件

```css
.form-group input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #1a1a1a;
  box-shadow: 0 0 0 3px rgba(26, 26, 26, 0.1);
}
```

---

## 八、反-slop自查清单

每次生成UI后检查：

### 排版
- [ ] 使用了精选字体（非System UI）
- [ ] 字号层级分明
- [ ] 行高合适（中文1.75）
- [ ] 字间距优化

### 配色
- [ ] ❌ 没有蓝紫渐变
- [ ] ❌ 没有毛玻璃效果
- [ ] ❌ 没有过度圆角（>12px）
- [ ] ✅ 配色克制（≤3种）
- [ ] ✅ 背景简洁（#fff或#fafafa）

### 动画
- [ ] ❌ 没有弹跳动画
- [ ] ❌ 没有旋转动画
- [ ] ✅ 动画有目的
- [ ] ✅ 过渡时长合理（0.2s）

### 组件
- [ ] 圆角克制（≤8px）
- [ ] 阴影克制
- [ ] 边框合理（1px solid #e5e5e5）

---

## 九、如何使用（与Claude协作）

### 9.1 让Claude Code读取此规范

**方法1：直接引用**
```
请阅读 taste-skill-zh/SKILL.md，然后按照里面的反-slop设计规范，
帮我设计一个用户设置页面。
```

**方法2：添加到项目**
```bash
mkdir .claude
cp ../taste-skill-zh/SKILL.md .claude/design-system.md
echo "设计必须遵循 .claude/design-system.md 中的反-slop规范" > CLAUDE.md
```

---

## 十、FAQ（常见问题）

### 10.1 为什么不要用蓝紫渐变？

**答**：因为太通俗了。2023-2025年的AI生成UI，90%都是蓝紫渐变。这已经成为"AI味"的标志。

### 10.2 反-slop设计会增加开发时间吗？

**答**：不会。因为：
1. 你只需要定义一次设计规范（SKILL.md）
2. 之后所有UI生成都会自动遵循
3. 不需要手写CSS，Claude会自动生成符合规范的代码

---

## 十一、参考资源

### 11.1 中文字体
- **思源宋体**：https://fonts.google.com/noto/specimen/Noto+Serif+SC
- **思源黑体**：https://fonts.google.com/noto/specimen/Noto+Sans+SC
- **霞鹜文楷**：https://github.com/lxgw/LxgwWenKai

### 11.2 中国色
- **中国色**：http://zhongguose.com/
- **传统色彩**：https://colors.lichuan.cc/

---

## 十二、版本历史

- **v1.1** (2026-05-26): 改进版
  - 加入有品味的强调色方案（深青 #0d9488、暖橙 #ea580c）
  - 加入间距系统（4px基准）
  - 加入暗色模式支持
  - 加入语义色（成功/警告/错误/信息）
  - 加入中文字体加载策略
  - 优化对比示例

- **v1.0** (2026-05-26): 初始版本

---

**使用方式**：
1. 将此文件放在项目中
2. 让Claude Code读取此文件
3. 在生成UI时，Claude会自动遵循反-slop原则

**最后更新**：2026-05-26 23:10 GMT+8  
**维护者**：QClaw  
**许可证**：MIT License

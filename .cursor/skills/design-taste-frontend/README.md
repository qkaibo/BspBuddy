# taste-skill-zh v1.1

**反-slop 设计系统 - 中文版 React 组件库**

> 有品味的中文字体排版 + 克制的配色 + 有目的动画 = 反-slop UI

---

## 📦 安装

```bash
npm install taste-skill-zh
# 或
yarn add taste-skill-zh
```

### 依赖

- React >= 16.8.0
- React DOM >= 16.8.0
- Tailwind CSS >= 3.0.0（必需）

---

## 🚀 快速开始

### 1. 引入 Tailwind CSS

```js
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/taste-skill-zh/dist/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans SC', 'sans-serif'],
        serif: ['Noto Serif SC', 'serif'],
      },
      colors: {
        primary: '#1a1a1a',
        accent: '#0d9488',
      },
    },
  },
  plugins: [],
}
```

### 2. 引入 Google Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&family=Noto+Sans+SC:wght@400;500;600&display=swap" rel="stylesheet">
```

### 3. 使用组件

```jsx
import React, { useState } from 'react';
import { Button, Card, Input, Table } from 'taste-skill-zh';

function App() {
  const [name, setName] = useState('');

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <Card padding="lg" className="mb-8">
        <h1 className="font-serif text-3xl font-semibold mb-4">
          反-slop 设计系统
        </h1>
        <p className="text-gray-600 leading-relaxed">
          有品味的中文UI设计规范。
        </p>
      </Card>

      <Card className="mb-4">
        <Input
          label="姓名"
          placeholder="请输入姓名"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button variant="primary" onClick={() => alert(`Hello, ${name}!`)}>
          提交
        </Button>
      </Card>
    </div>
  );
}

export default App;
```

---

## 📊 组件列表

### 基础组件
| 组件 | 说明 | 状态 |
|------|------|------|
| `Button` | 按钮（4种样式 × 3种尺寸） | ✅ |
| `Card` | 卡片容器 | ✅ |
| `Input` | 输入框 | ✅ |
| `Select` | 下拉选择 | ✅ |
| `Textarea` | 文本域 | ✅ |

### 反馈组件
| 组件 | 说明 | 状态 |
|------|------|------|
| `Modal` | 模态框 | ✅ |
| `Toast` | 通知提示 | ✅ |
| `Alert` | 警告提示 | ✅ |
| `Progress` | 进度条 | ✅ |
| `Spinner` | 加载动画 | ✅ |

### 导航组件
| 组件 | 说明 | 状态 |
|------|------|------|
| `Tabs` | 标签页 | ✅ |
| `Dropdown` | 下拉菜单 | ✅ |
| `Breadcrumb` | 面包屑 | ✅ |
| `Pagination` | 分页 | ✅ |
| `Steps` | 步骤条 | ✅ |

### 数据展示
| 组件 | 说明 | 状态 |
|------|------|------|
| `Table` | 表格 | ✅ |
| `Badge` | 徽章/标签 | ✅ |
| `StatsCard` | 统计卡片 | ✅ |
| `Timeline` | 时间轴 | ✅ |

### 交互组件
| 组件 | 说明 | 状态 |
|------|------|------|
| `Drawer` | 抽屉 | ✅ |
| `DatePicker` | 日期选择器 | ✅ |
| `Upload` | 上传组件 | ✅ |
| `Tooltip` | 工具提示 | ✅ |

---

## 🎨 设计规范

### 配色（克制，≤3种主色）

```css
--color-primary: #1a1a1a;  /* 深灰 */
--color-accent: #0d9488;   /* 深青（有品味）*/
--color-bg: #fafafa;        /* 浅灰背景 */
--color-surface: #fff;       /* 白色表面 */
--color-border: #e5e5e5;   /* 淡灰边框 */
```

### 字体（中文衬线 + 无衬线搭配）

```css
font-family: 'Noto Serif SC', serif;      /* 标题 */
font-family: 'Noto Sans SC', sans-serif;  /* 正文 */
```

### 间距（4px 基准）

```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;      /* 32px */
```

### 圆角（克制，≤8px）

```css
border-radius: 4px;  /* 按钮、输入框 */
border-radius: 8px;  /* 卡片、模态框 */
```

### 动画（有目的，0.2s）

```css
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
hover: transform: translateY(-1px);
```

---

## 🚫 反-slop 原则

### ❌ 避免（Slop 特征）

1. **蓝紫渐变** `linear-gradient(135deg, #667eea, #764ba2)`
2. **毛玻璃效果** `backdrop-filter: blur()`
3. **无意义的动画** `animation: bounce 1s infinite`
4. **过度圆角** `border-radius > 12px`
5. **System UI 字体** `font-family: -apple-system`

### ✅ 追求（反-slop 哲学）

1. **有品味**：每个设计决策都有理由
2. **有克制**：少即是多，less is more
3. **有细节**：排版、字体、动画精确调优
4. **有个性**：反-slop ≠ 无趣，是有品味地有个性

---

## 📁 项目结构

```
taste-skill-zh/
├── package.json           # npm 包配置
├── README.md            # 本文档
├── SKILL.md             # 完整设计规范
├── examples/            # HTML 示例（36个组件）
│   ├── login-comparison.html
│   ├── task-management-v2.html
│   ├── design-system-showcase.html
│   ├── dashboard.html
│   ├── advanced-components.html
│   └── advanced-components-part2.html
└── src/                # React 组件库
    ├── index.js          # 导出文件
    └── components/       # 22个 React 组件
        ├── Button.jsx
        ├── Card.jsx
        ├── Input.jsx
        └── ...
```

---

## 🧪 本地开发

```bash
# 克隆仓库
git clone https://github.com/QClaw/taste-skill-zh.git
cd taste-skill-zh

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build

# 发布到 npm
npm publish
```

---

## 📝 示例

### 按钮

```jsx
<Button variant="primary" size="md" onClick={() => {}}>
  主要按钮
</Button>

<Button variant="secondary" size="sm">
  次要按钮
</Button>

<Button variant="danger" disabled>
  危险按钮（禁用）
</Button>
```

### 卡片

```jsx
<Card padding="lg" hoverable onClick={() => {}}>
  <h3 className="font-sans text-xl font-semibold mb-4">
    卡片标题
  </h3>
  <p className="text-gray-600 leading-relaxed">
    卡片内容...
  </p>
</Card>
```

### 表格

```jsx
const columns = [
  { key: 'name', title: '姓名' },
  { key: 'age', title: '年龄' },
  { key: 'email', title: '邮箱', render: (value) => <a href={`mailto:${value}`}>{value}</a> },
];

const data = [
  { name: '张三', age: 28, email: 'zhangsan@example.com' },
  { name: '李四', age: 32, email: 'lisi@example.com' },
];

<Table columns={columns} data={data} hoverable onRowClick={(row) => console.log(row)} />
```

---

## 🌐 浏览器支持

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

---

## 📄 许可证

MIT License

---

## 👤 作者

**QClaw**

- Website: https://github.com/QClaw
- Email: QClaw@example.com

---

## 🙏 致谢

- **Taste Skill**（Leonxlnx）：原始设计灵感
- **Noto Fonts**（Google）：优秀的中文字体
- **Tailwind CSS**：实用优先的 CSS 框架

---

## 📮 更新日志

### v1.1.0 (2026-05-26)

- ✨ 加入有品味的强调色方案（深青 #0d9488）
- ✨ 加入间距系统（4px 基准）
- ✨ 加入暗色模式支持
- ✨ 加入语义色（成功/警告/错误/信息）
- ✨ 加入中文字体加载策略
- 🐛 修复对比示例不够公平的问题

### v1.0.0 (2026-05-26)

- 🎉 初始版本
- ✨ 22个 React 组件
- ✨ 36个 HTML 示例
- ✨ 完整的反-slop 设计规范

---

**🎨 有品味地设计，反-slop 地编码。**

# 16 — 会员与积分 (Pricing)

> 对应 SPEC: `specs/From-Beginner-to-Expert-Guide/Pricing.md`
> Status: ❌ P3 待开发

## 功能概要

BspBuddy 通过积分体系调优质 AI 能力：每个模型消耗积分不同，更强大的模型消耗更多积分。基础用量免费，按天重置，购买积分包或会员以获得更多额度。

## 积分模型

| 模型 | 积分/次 |
|------|---------|
| DeepSeek V3.1 | 1 |
| 混元 T1 | 2 |
| GLM 4.5 | 1 |
| Kimi K2 | 2 |
| MiniMax M1 | 2 |

## 定价方案

| 方案 | 价格 | 积分/天 | 次数/天(DeepSeek) |
|------|------|---------|-------------------|
| Free | 免费 | 30 | 30 |
| Plus | ¥99/月 | 300 | 300 |
| Pro | ¥299/月 | 1000 | 1000 |

## 积分消耗

- 普通任务（Ask 模式）：1x
- 代码生成（Craft 模式）：2x
- 页面预览：2x
- 连接器调用：1x
- 自动化任务：0.5x
- 远程助理：0.5x

## 实现文件

```
src/components/PricingPanel.tsx         - 定价页面
src/components/CreditDisplay.tsx        - 积分显示
src/main/services/credit-service.ts    - 积分服务
src/lib/pricing-types.ts               - 定价类型定义
```

## 验收标准

- [ ] 输入框下方显示剩余积分
- [ ] 使用 GLM(1/次) → 积分-1，DeepSeek(1/次) → 积分-1
- [ ] 使用混元(2/次) → 积分-2
- [ ] 积分不足 → 拦截提示充值
- [ ] 每日 0 点积分重置
- [ ] 付费开通 Plus 会员 → 每日 300 积分

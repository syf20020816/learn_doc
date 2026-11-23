---
title: 前端最新实现
description: 由浅入深的现代 Web 平台实践：从原生交互、CSS 布局，到动效、表单、组件、无障碍、性能、安全、Web Components 与内置 AI，每章配前后对比、可运行例子与在线试一试。
---

# 前端最新实现

> 📍 内容整理自 [modern-web-guidance](https://www.npmjs.com/package/modern-web-guidance)（2026_11_10 版，200 份指南） ｜ 默认兼容线：Baseline Widely available，非 Baseline 特性均标注 fallback

## 怎么读这部分

前端的大部分知识，最终都要落到「页面上你能看见什么」。所以每一章都按同一条主线推进，而不是罗列 API：

1. **先看「没有它会怎样」** —— 具体到页面上能看见的毛病：弹窗被遮住、卡片挤成一团、点了没反应。
2. **再看最小例子** —— 10 行左右能跑通的代码，先有感觉再谈原理。
3. **然后跑「在线试一试」** —— 左侧改代码，右侧立刻变，不用切窗口。
4. **接着对照「老写法 vs 现代写法」** —— 用表格把代码量、运行时开销、兼容性摆在一起比。
5. **最后看边界** —— 什么情况下还不该用、怎么降级。

每章内部固定分三段：🟢 **入门**（能跑起来）→ 🟡 **进阶**（组合起来解决真实场景）→ 🔴 **高阶**（性能、边界、降级）。**看到 🟡 就可以先停**，等真遇到问题再回来读 🔴。

## 学习路径

### 第一阶 · 能用 —— 让页面会响应、会排版

> 目标：不引入任何框架，也能做出一个像样的交互页面。约 3 小时。

| 章 | 读完你会 |
|---|---|
| [01 HTML 与原生交互](/web/01-html-interactive) | 用 `<dialog>`、popover、invoker 三件套替代 80% 的自制弹窗 / 下拉 / tooltip |
| [02 CSS 布局与响应式](/web/02-css-layout-responsive) | 让同一个卡片在侧栏窄、在主区宽时自动换形态，不再靠 JS 量宽度 |
| [04 表单与输入](/web/04-forms) | 输入框只在「用户真的填错之后」才报错，且不打断输入法 |

### 第二阶 · 好用 —— 让交互有手感

> 前置：第一阶。目标：同样的功能，别人觉得「顺」而不是「能用」。约 3 小时。

| 章 | 读完你会 |
|---|---|
| [03 动效与视图过渡](/web/03-motion-view-transitions) | 列表项 → 详情页的共享元素过渡，不手写 FLIP；滚动进度条零 JS |
| [05 组件与 UX 模式](/web/05-components-ux) | 用 `details` / `popover` / `dialog` 拼出手风琴、Tabs、下拉菜单、Toast |
| [06 无障碍与色彩](/web/06-accessibility) | 键盘走通全站、读屏能读懂、深色模式与高对比度都不糊 |

### 第三阶 · 扛住 —— 让页面在真实环境活下来

> 前置：前两阶。目标：慢网、低端机、恶意输入、旧浏览器都不翻车。约 4 小时。

| 章 | 读完你会 |
|---|---|
| [07 性能与 Core Web Vitals](/web/07-performance) | 找到 LCP 被谁拖慢、把长任务拆开让 INP 回到 200ms 内 |
| [08 安全与隐私](/web/08-security-privacy) | XSS 从源头堵住，登录升级到 Passkey |
| [09 Web Components](/web/09-web-components) | 写一个能跨框架复用、且默认无障碍的自定义元素 |
| [10 JS 平台能力与内置 AI](/web/10-js-platform-ai) | 用 Temporal 处理时区、用浏览器内置模型做摘要翻译，不调后端 |

## 知识点清单

按阶梯打勾，比逐章读完更容易坚持。

### 🟢 第一阶

- [ ] `<dialog>` 的 showModal / 关闭 / 滚动锁定；`closedby`
- [ ] Popover API 与 `popovertarget`：零 JS 的声明式显隐
- [ ] Invoker Commands：按钮直接指挥对话框，不写一行事件
- [ ] 容器查询 `@container`：组件按自己的尺寸响应，而不是视口
- [ ] `:has()`、`@layer`、`@supports`：少写类名、控制级联、优雅降级
- [ ] 锚点定位 anchor positioning：下拉框贴着触发器，不用算坐标
- [ ] `:user-invalid`：只在校验失败「之后」才标红
- [ ] IME 安全的 Enter 提交与 OTP 输入

### 🟡 第二阶

- [ ] View Transitions：同文档 / 跨文档 / SPA 三种用法
- [ ] Scroll-driven animations：`scroll()` 与 `view()` 时间线
- [ ] `@starting-style` + `display` 过渡：元素出现/消失也有动画
- [ ] 滚动吸附 scroll snap 与状态同步
- [ ] `details[name]` 互斥手风琴；popover 做菜单与 Toast
- [ ] 焦点管理：`inert`、`:focus-visible`、跳转焦点
- [ ] `light-dark()` 与 `color-scheme`；对比度与 Forced Colors

### 🔴 第三阶

- [ ] `fetchpriority` / `preload` / 脚本加载的优先级矩阵
- [ ] INP：长任务拆分与 `scheduler.postTask`
- [ ] `content-visibility` 延迟渲染；Speculation Rules 预渲染
- [ ] Sanitizer / Trusted Types 防 XSS；来源校验
- [ ] WebAuthn Passkey 注册、登录、重新认证
- [ ] Custom Elements 生命周期、Shadow DOM 样式边界、ElementInternals
- [ ] Temporal 与时区安全；浏览器内置 AI（Prompt / Summarizer / Translator）
- [ ] CSS 形状：`clip-path`、边缘渐隐、自定义文字装饰

## 推荐资料

- [MDN：Web API](https://developer.mozilla.org/zh-CN/docs/Web/API) —— 查 API 与兼容性的首选
- [web.dev](https://web.dev/) —— Chrome 团队的最佳实践与 Baseline 动态
- [Can I use](https://caniuse.com/) —— 特性兼容性速查
- [modern-web-guidance](https://www.npmjs.com/package/modern-web-guidance) —— 本部分内容来源

## 使用建议

1. 带 **在线试一试** 的章节（01–07、09、10）可以直接改代码看效果，改坏了刷新即可。
2. 每章的「对比」表格可以直接当选型依据：老写法为什么被淘汰、新写法要付什么代价。
3. 兼容性标注统一按 Baseline 读：Widely available 放心用；标注 fallback 的按章节给的降级方案写。
4. 学完可以反过来审一遍自己的项目代码——很多「自定义组件」其实一个原生标签就够了。

---

← [返回站点首页](/) ｜ 相关部分：[RTC 学习](/rtc/)

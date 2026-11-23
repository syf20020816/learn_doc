---
title: 06 · WebTransport：浏览器里的 HTTP/3 双向通道
description: WebTransport 的三种能力、最小可用代码、与 WebSocket / WebRTC DataChannel / 原生 QUIC 的四方对照，以及鉴权证书与部署现状。
---

# 06 · WebTransport：浏览器里的 HTTP/3 双向通道

> 📍 阶段四 · 知识整理 06 ｜ 建议配合概览页知识点清单打卡

## 问题：浏览器里怎么用上 QUIC

QUIC 在服务端已经可用很多年，但**浏览器里的 JS 一直只能通过 HTTP/3「间接」用它**——发请求可以，想自己开双向流、发不可靠 datagram 就不行。WebTransport 就是那个 API：**把 QUIC 的可靠流与 datagram 直接暴露给前端**。

## API 的三个能力

`WebTransport` 对象一旦就绪，提供三类通道：

| 能力 | API | 语义 | 对应 QUIC |
| --- | --- | --- | --- |
| 可靠双向流 | `createBidirectionalStream()` | 有序、可靠、双向 | bidirectional stream |
| 可靠单向流 | `createUnidirectionalStream()` | 有序、可靠、单向 | unidirectional stream |
| 不可靠数据报 | `datagrams.writable` / `.readable` | 不重传、不保序 | DATAGRAM 帧（第 05 章） |

这三件事在 WebSocket 里只能用「一条有序消息通道」凑，在 WebRTC 里要拉一整套 PeerConnection + 信令 + ICE，WebTransport 则是**一条连到服务器的、带三种通道的语义化管道**。

## 最小客户端代码

```javascript
// 1) 建连（URL 必须是 https://，协议为 HTTP/3）
const wt = new WebTransport('https://example.com:4433/wt');
await wt.ready;                       // QUIC + TLS 握手完成

// 2) 可靠双向流：请求 + 响应
const stream = await wt.createBidirectionalStream();
const writer = stream.writable.getWriter();
const reader = stream.readable.getReader();
await writer.write(new TextEncoder().encode('hello'));

// 3) 不可靠 datagram：发一帧就丢一帧
const dw = wt.datagrams.writable.getWriter();
await dw.write(new Uint8Array([1, 2, 3]));

// 4) 收 datagram（用 stream reader 循环读）
const dr = wt.datagrams.readable.getReader();
for (;;) {
  const { value, done } = await dr.read();
  if (done) break;
  console.log('datagram', value);    // 服务端 echo 回来的字节
}
```

关键点：

- `wt.ready` 之前不能开流；`wt.closed` 表示连接已关闭，需要监听并处理重连。
- datagram 的 `readable.read()` 返回的是**一个完整的消息**，不是字节流——这正是 datagram 与 stream 的语义差别。
- 流要用 `writer.close()` / `stream.writable.close()` 正常关闭，否则对端会一直等。

## 四方对照

| 维度 | WebSocket | WebRTC DataChannel | **WebTransport** | 原生 QUIC |
| --- | --- | --- | --- | --- |
| 底层协议 | TCP + HTTP/1.1 Upgrade | SCTP over DTLS（ICE 打洞） | **HTTP/3 over QUIC** | QUIC |
| 可靠性 | 可靠有序 | 可选可靠/部分可靠（SCTP） | **可靠流 + 不可靠 datagram 并存** | 同左 |
| 多路复用 | 无（一条消息通道） | 多通道但共享 SCTP 关联 | **原生多流，互不阻塞** | 原生多流 |
| 是否 P2P | 否（必过服务器） | **可 P2P** | 否（客户端到服务器） | 可 P2P（实现自定） |
| 额外信令 | 不需要（URL 直连） | **需要**（offer/answer + ICE） | 不需要（URL + 证书） | 需自建 |
| 浏览器支持 | 全支持 | 全支持 | Chrome/Edge 稳定，Safari/Firefox 仍在推进 | 无（非浏览器 API） |

结论性判断：

- **要 P2P、要端到端媒体**：仍选 WebRTC——WebTransport 是 client→server 的。
- **要服务器中转的双向通道**：WebTransport 比 WebSocket 多了多流与 datagram，比 DataChannel 少了信令与 ICE 的复杂度。
- **要极致可控**：服务端之间用原生 QUIC 库（quic-go / quiche / msquic）。

## 鉴权与证书

WebTransport 建连必须满足「安全上下文」：

| 场景 | 要求 |
| --- | --- |
| 生产 | 有效 HTTPS 证书（受信任 CA 签发），且服务端支持 HTTP/3 |
| 本地开发 | `https://localhost` + 自签证书，浏览器端用 `serverCertificateHashes` 信任证书哈希 |
| 应用层鉴权 | 用 **session 级 token**（URL 参数或首个流的首条消息），与 HTTP 鉴权体系一致 |

自签证书的客户端写法（仅开发用）：

```javascript
const wt = new WebTransport('https://localhost:4433/wt', {
  serverCertificateHashes: [{
    algorithm: 'sha-256',
    // 由服务端证书 DER 计算出的 SHA-256
    value: certHashBuffer,
  }],
});
```

> 注意：证书哈希有有效期限制（浏览器通常只允许较短有效期），不要把它当成生产方案。生产要用真实证书 + token 鉴权。

## 部署现状与限制

- **浏览器**：Chrome/Edge 已稳定支持；Safari 与 Firefox 的支持进度不一，做产品要有降级路径（WebSocket 或 HTTP/2）。
- **网络**：与 HTTP/3 一样，部分网络封 UDP 443，需要回退。
- **服务端**：需要 HTTP/3 服务器并显式开启 WebTransport（如 quic-go、aioquic、Envoy 等），不是「开了 HTTPS 就有」。
- **不可用场景**：WebTransport 不支持 P2P，也不直接提供媒体编解码/采集——音视频采集仍要走 `getUserMedia`，编码要自己做（WebCodecs）。

## 关键要点

- WebTransport 把 QUIC 的可靠双向流、可靠单向流、不可靠 datagram 暴露给浏览器 JS。
- 与 WebSocket 相比多了多流与 datagram；与 DataChannel 相比省掉信令与 ICE，但**不支持 P2P**。
- 建连必须 HTTPS；本地开发用 localhost + `serverCertificateHashes`，生产用真实证书 + session token。
- 浏览器与网络支持仍不齐，产品要准备 WebSocket/HTTP2 降级。
- 它只提供传输，不提供采集与编解码，实时媒体仍需 WebCodecs 等配套。

## 延伸阅读

- [MDN：WebTransport API](https://developer.mozilla.org/zh-CN/docs/Web/API/WebTransport_API)
- [W3C：WebTransport 规范](https://w3c.github.io/webtransport/)
- [web.dev：WebTransport 入门](https://web.dev/webtransport/)
- [quic-go WebTransport 示例](https://github.com/quic-go/webtransport-go)

---

← 上一章：[05 Datagram](/rtc/stage-4/05-datagram) ｜ 下一章：[07 MoQ](/rtc/stage-4/07-moq)

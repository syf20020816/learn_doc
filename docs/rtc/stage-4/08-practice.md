---
title: 08 · 实践：抓一次 QUIC，跑一条 WebTransport
description: 两个动手实践——Wireshark 抓真实 QUIC 连接看握手与 Connection ID，用 quic-go / aioquic 起 HTTP/3 + WebTransport 服务并在浏览器发 datagram，最后把 QUIC 机制逐条映射回阶段三的痛点。
---

# 08 · 实践：抓一次 QUIC，跑一条 WebTransport

> 📍 阶段四 · 知识整理 08 ｜ 建议配合概览页知识点清单打卡

## 实践目标

- **实践 1**：抓一次真实 QUIC 连接，亲眼看到 Initial / Handshake / 1-RTT 包与 Connection ID。
- **实践 2**：自己起一个 HTTP/3 + WebTransport 服务，浏览器发一条 datagram 并收到 echo。
- **观察清单**：验证 datagram 不重传、可靠流有序、切网不断连。
- 最后把 QUIC 的每个机制对应回阶段三的具体痛点。

## 实践 1：用 Wireshark 抓一次 QUIC

### 抓包

1. 打开 Wireshark，选择联网网卡（Wi-Fi 或有线）。
2. 过滤器输入 `quic`（或 `udp.port == 443`）。
3. 浏览器访问 `https://www.google.com` 或 `https://cloudflare-quic.com`，强制刷新。

> 提示：Chrome 只有在站点支持 HTTP/3 时才会走 QUIC。可在 `chrome://flags` 确认 QUIC 未被禁用；访问 `https://cloudflare-quic.com` 通常能稳定命中。

### 看什么

| 观察点 | 在 Wireshark 里怎么认 | 对应章节 |
| --- | --- | --- |
| Initial 包 | `QUIC` 协议列，Packet Type = Initial，含 ClientHello | 02 章 1-RTT 握手 |
| Handshake 包 | Packet Type = Handshake，含证书/Finished | 02 章 |
| 1-RTT 包 | Packet Type = 1-RTT，应用数据 | 02、03 章 |
| Connection ID | QUIC 头里的 Source/Destination Connection ID | 02 章连接迁移 |
| 流与帧 | 展开 QUIC → STREAM 帧，可见 Stream ID | 03 章多流 |
| 加密载荷 | 大部分字段显示为 Protected/Encrypted | 01 章「内建加密」 |

### 再看 0-RTT 与 Alt-Svc

打开 `chrome://net-export`，开始记录 → 刷新页面 → 停止导出，用 [netlog viewer](https://netlog-viewer.appspot.com/) 打开：

- 搜索 `QUIC_SESSION`，看是否出现 **0-RTT** 相关事件（仅恢复连接时才有）。
- 搜索 `Alt-Svc`，看服务端如何宣告 `h3=":443"`，浏览器据此在后续连接尝试 QUIC（04 章）。

> 如果没有 0-RTT：清掉站点数据后首次访问必然是 1-RTT；第二次访问才可能命中 0-RTT。

## 实践 2：起一个 HTTP/3 + WebTransport 服务

### 方案选择

| 方案 | 语言 | 适合 |
| --- | --- | --- |
| [quic-go](https://github.com/quic-go/quic-go) + webtransport-go | Go | 想要最少代码跑通、生态示例多 |
| [aioquic](https://github.com/aiortc/aioquic) | Python | 想顺便看协议实现细节、自带示例 |

下面以 aioquic 的 HTTP/3 + WebTransport 示例为骨架（quic-go 的 `example/` 目录逻辑类似）。

### 启动服务端

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install aioquic
# aioquic 自带示例仓库，克隆后进入 examples
git clone https://github.com/aiortc/aioquic.git
cd aioquic/examples
python3 http3_server.py --certificate cert.pem --private-key key.pem --host localhost --port 4433
```

服务端要点：

- 必须提供证书；本地用自签证书（`openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 7 -subj "/CN=localhost"`）。
- 监听 UDP 4433（HTTP/3 走 UDP）。
- 在 WebTransport 路径（示例里通常是 `/wt`）上处理会话：收到 datagram 后原样 echo 回去。

### 客户端 JS 骨架

```javascript
// 1) 读取自签证书 DER，算 SHA-256（仅本地开发）
async function certHash() {
  const der = await fetch('/cert.der').then(r => r.arrayBuffer());
  return new Uint8Array(await crypto.subtle.digest('SHA-256', der));
}

// 2) 建连：必须 https + 自签证书 hash
const wt = new WebTransport('https://localhost:4433/wt', {
  serverCertificateHashes: [{ algorithm: 'sha-256', value: await certHash() }],
});
await wt.ready;
console.log('connected');

// 3) 发一条 datagram（不可靠）
const dw = wt.datagrams.writable.getWriter();
await dw.write(new TextEncoder().encode('ping'));

// 4) 收 echo
const dr = wt.datagrams.readable.getReader();
const { value } = await dr.read();
console.log('echo:', new TextDecoder().decode(value));

// 5) 可靠双向流：验证有序交付
const s = await wt.createBidirectionalStream();
const w = s.writable.getWriter();
for (let i = 0; i < 5; i++) await w.write(new TextEncoder().encode(`msg-${i}`));
await w.close();
```

### 注意事项

| 坑 | 说明 |
| --- | --- |
| 必须 HTTPS 或 localhost | 非安全上下文没有 WebTransport；用 `localhost` 可绕过证书信任 |
| 自签证书 hash | 浏览器只接受短有效期证书的 hash，别用于生产 |
| UDP 4433 被占/被封 | 换端口；企业网可能封 UDP，需换网络验证 |
| 服务端未开 WebTransport | 仅支持 HTTP/3 不等于支持 WebTransport，需显式配置路径 |
| `wt.ready` 前调用 API | 会抛错，务必 `await wt.ready` |

## 观察清单

跑通后逐条验证，对照前面章节：

- [ ] **datagram 不重传**：故意在服务端丢弃部分 datagram，客户端不会收到「补发」；而流上的数据仍会重传补齐（05 章）。
- [ ] **可靠流有序**：连续写 5 条消息，服务端按 `msg-0 … msg-4` 顺序收到（03 章）。
- [ ] **连接迁移**：手机连 WiFi 打开 WebTransport，切到 4G，观察会话是否保持（需服务端支持路径验证；浏览器 DevTools 的网络面板可见连接未重建）（02 章）。
- [ ] **拥塞控制生效**：用限速工具压低带宽，观察发送速率下降，datagram 也一起被限（05 章：datagram 仍受连接级拥塞控制）。

## 回收：QUIC 机制 vs 阶段三痛点

| 阶段三的痛点 | QUIC 的对应机制 | 章节 |
| --- | --- | --- |
| TCP + TLS 首连 2-RTT，接通慢 | 1-RTT 握手，恢复连接可 0-RTT | 02 |
| TCP 丢包导致所有请求/流一起等 | 多流独立有序，只阻塞所属流 | 03 |
| 手机 WiFi ↔ 4G 切换导致连接重建 | Connection ID + 路径验证，迁移不断连 | 02 |
| 拥塞控制写死在内核、难迭代 | 用户态可插拔（NewReno/CUBIC/BBR） | 02 |
| RTP 的不可靠要靠 NACK/FEC 自建 | DATAGRAM 帧原生不可靠，但与可靠流共连接 | 05 |
| WebRTC 要 ICE/DTLS/SCTP 一整套栈 | WebTransport 一条连接给齐流 + datagram | 06 |
| SFU 只转发 RTP 包，扇出受限 | MoQ relay 转发 object，可级联扇出（草案） | 07 |

> 💡 一句话总结：**QUIC 把「握手、多流、迁移、拥塞控制」从内核与协议固化中解放出来，再把可靠性做成可选项（流 vs datagram），于是同一套传输能同时服务 Web、实时媒体与大规模分发。** 这也回答了第 01 章的问题：QUIC 不是来「取代」WebRTC/RTMP 的，而是提供了第三条路——是否采用，取决于你是否需要它的弱网与迁移收益，以及能否接受生态成熟度。

## 关键要点

- Wireshark 过滤 `quic` 能直接看到 Initial / Handshake / 1-RTT 与 Connection ID，是理解握手最直观的方式。
- `chrome://net-export` + netlog viewer 可验证 0-RTT 与 Alt-Svc 的真实发生。
- aioquic / quic-go 都能在几十行内起 HTTP/3 + WebTransport 服务；浏览器端必须 HTTPS 或 localhost + 证书 hash。
- 观察清单验证三件事：datagram 不重传、流有序、切网连接不断。
- QUIC 的机制逐条对应阶段三的握手 RTT、队头阻塞、迁移、拥塞控制四大痛点。

## 延伸阅读

- [Wireshark：QUIC 解析说明](https://wiki.wireshark.org/QUIC)
- [chrome://net-export 与 netlog viewer](https://netlog-viewer.appspot.com/)
- [aioquic 示例（HTTP/3 + WebTransport）](https://github.com/aiortc/aioquic/tree/main/examples)
- [quic-go 示例](https://github.com/quic-go/quic-go/tree/master/example)
- [MDN：WebTransport 使用指南](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport_API)

---

← 上一章：[07 MoQ](/rtc/stage-4/07-moq) ｜ 下一阶段：[阶段五：综合串联与进阶视野](/rtc/stage-5/)

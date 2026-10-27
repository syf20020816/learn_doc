---
title: 08 · 实践：浏览器 1v1 通话与 Rust 信令服务器
description: 两个动手实践——用原生 WebRTC API 跑通 1v1 通话，用 Rust (tokio + WebSocket) 写信令服务器转发 offer/answer/candidate，并用 chrome://webrtc-internals 观察真实连接。
---

# 08 · 实践：浏览器 1v1 通话与 Rust 信令服务器

> 📍 阶段三 · 知识整理 08 ｜ 本阶段收官：把 01~07 章的概念跑成真连接

## 实践目标

- **实践 1**：浏览器原生 API 跑通 1v1 通话（同一台电脑两个 tab 互打），观察 01 章总时序的真实发生过程。
- **实践 2**：用 Rust 写一个信令服务器（tokio + WebSocket），替掉实践 1 里的手动复制粘贴——这就是「自选信令」的最小实现。
- 用 `chrome://webrtc-internals` 观察真实连接的码率、RTT 与丢包。

## 实践 1：浏览器 1v1 通话

### 最小核心流程

两个 tab 之间的信令先用「手动复制粘贴」代替（先理解，再自动化）。核心代码骨架：

```javascript
// ===== 两个 tab 共用的连接准备 =====
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], // 03 章：STUN 收集 srflx
});
const localStream = await navigator.mediaDevices.getUserMedia({
  audio: true, video: true,                       // 06 章：3A 已在引擎内默认开启
});
localStream.getTracks().forEach(t => pc.addTrack(t, localStream)); // 把流挂上 pc

// ICE 候选逐条产生 → 打印出来手动复制给对方（03 章 Trickle ICE）
pc.onicecandidate = e => {
  if (e.candidate) console.log('CANDIDATE', JSON.stringify(e.candidate));
};

// 收到对方媒体 → 渲染（远端 ontrack 在 setRemote 后触发）
pc.ontrack = e => {
  remoteVideo.srcObject = e.streams[0];
};

// ===== 主叫 tab =====
const offer = await pc.createOffer();               // 02 章：生成 SDP
await pc.setLocalDescription(offer);
console.log('OFFER', JSON.stringify(offer));        // 复制到被叫

// ===== 被叫 tab（粘贴 offer 后）=====
await pc.setRemoteDescription(remoteOffer);
const answer = await pc.createAnswer();             // 02 章：取交集生成 answer
await pc.setLocalDescription(answer);
console.log('ANSWER', JSON.stringify(answer));      // 复制回主叫

// ===== 主叫 tab（粘贴 answer 后）=====
await pc.setRemoteDescription(remoteAnswer);

// ===== 双方（粘贴对方的 candidate）=====
await pc.addIceCandidate(remoteCandidate);          // 03 章：注入候选开始打洞
```

### 必做的观察动作

跑通后（两个 tab 看到彼此画面），逐条验证前面章节的知识：

1. 控制台打印的 **SDP**：找 `m=audio`/`m=video`、`a=rtpmap:111 opus`、`a=fingerprint`、`ice-ufrag`——02 章逐行解析过的真实样本。
2. **candidate 列表**：确认有 `host`（内网 IP）与 `srflx`（公网映射）两种类型——03 章三分类。
3. `pc.iceConnectionState` 的状态迁移：`checking → connected`——03 章状态机。

> 💡 提示：两个 tab 同源同浏览器时用 host 候选直连（不走公网），属于最快路径；同一 WiFi 下两台设备实测可看到 srflx 生效。**麦克风权限需要 https 或 localhost**，本地用 `localhost` 即可。

### 不想写代码？官方 samples 直达

[WebRTC Samples](https://webrtc.github.io/samples/) 页面提供全套官方 demo（apprtc、peerconnection 等），可直接观察同样的流程。但**建议至少手写一遍上面的骨架**——每个 API 调用对应一章知识，手写一遍胜过看十遍。

## 实践 2：Rust 信令服务器

把「手动复制粘贴」换成真正的信令服务器：**tokio 异步运行时 + tokio-tungstenite WebSocket + serde_json**，只做一件事——**同一房间的消息互相广播**（02 章：邮差不解读内容）。

### 项目骨架

```bash
cargo new rtc-signaling && cd rtc-signaling
```

`Cargo.toml` 依赖：

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.24"
futures-util = "0.3"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### 核心设计：房间 = broadcast channel

消息协议（JSON）：

```json
{ "room": "room1", "type": "offer|answer|candidate", "data": "..." }
```

服务器逻辑（`src/main.rs` 核心框架，约 60 行）：

```rust
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};
use tokio_tungstenite::tungstenite::Message;

#[derive(Deserialize)]
struct Signal {
    room: String,
    #[serde(flatten)]
    rest: serde_json::Value,   // 房间之外的原样广播（02 章：邮差不解读）
}

#[tokio::main]
async fn main() {
    let rooms: Arc<Mutex<HashMap<String, broadcast::Sender<String>>>> =
        Arc::new(Mutex::new(HashMap::new()));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:9000").await.unwrap();
    println!("signaling server on ws://127.0.0.1:9000");

    while let Ok((stream, _)) = listener.accept().await {
        let rooms = rooms.clone();
        tokio::spawn(async move {
            let ws = tokio_tungstenite::accept_async(stream).await.unwrap();
            let (mut tx, mut rx) = ws.split();

            // 首条消息定房间：加入对应房间的广播组
            let first = rx.next().await.unwrap().unwrap();
            let sig: Signal = serde_json::from_str(&first.to_string()).unwrap();
            let sender = {
                let mut map = rooms.lock().await;
                map.entry(sig.room.clone())
                    .or_insert_with(|| broadcast::channel(64).0)
                    .clone()
            };
            let mut sub = sender.subscribe();

            // 双向泵：客户端 → 房间广播；房间 → 客户端
            let fwd = tokio::spawn(async move {
                while let Ok(msg) = sub.recv().await {
                    let _ = tx.send(Message::text(msg)).await;
                }
            });
            while let Some(Ok(msg)) = rx.next().await {
                let _ = sender.send(msg.to_string());  // 原样转发 offer/answer/candidate
            }
            fwd.abort();
        });
    }
}
```

代码与知识的对应关系：

| 代码 | 对应概念 |
| --- | --- |
| `broadcast::channel` 每房间一个 | 房间隔离；02 章「信令服务器按房间转发」 |
| `serde_json::from_str` 只取 room，其余 flatten 原样透传 | 02 章「邮差不解读内容」 |
| WebSocket 双向泵 | offer/answer/candidate 三类消息共用一条通道 |
| `or_insert_with` 懒创建 | 房间生命周期跟随成员 |

### 客户端改造

把实践 1 里的 `console.log` 复制粘贴替换为 WebSocket：

```javascript
const ws = new WebSocket('ws://127.0.0.1:9000');
ws.onopen = () => ws.send(JSON.stringify({ room: 'room1' }));
pc.onicecandidate = e => e.candidate && ws.send(JSON.stringify({
  room: 'room1', type: 'candidate', data: e.candidate,
}));
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.type === 'offer')  { /* setRemote + createAnswer + 回发 */ }
  if (m.type === 'answer') { /* setRemote */ }
  if (m.type === 'candidate') { pc.addIceCandidate(m.data); }
};
```

跑起来后：`cargo run` 起服务器 → 两个浏览器 tab 开两个 HTML 页面 → 进入同一房间 → 自动完成 01 章四阶段。**从此你拥有一个 20 行级别的、完全理解每行代码的 RTC 信令服务。**

### 进阶路标（可选）

- **webrtc-rs**：Rust 实现的完整 WebRTC 栈（`webrtc` crate）——按 01 章协议栈逐层对照源码阅读，收获极大。
- **ion-sfu / LiveKit**：读完 07 章后看它们的订阅/转发实现，验证 SFU 概念。
- 给信令加 **TLS（WSS）**：04 章说过信令信任是全链路安全的起点。

## 观测工具：chrome://webrtc-internals

地址栏直接输入 `chrome://webrtc-internals`（通话时打开），这是 RTC 排查的显微镜：

| 看什么 | 图表 | 对应章节 |
| --- | --- | --- |
| 码率 | `bytesReceived/s` | 05 章 GCC 估出带宽的最终执行结果 |
| RTT | `currentRoundTripTime` | 弱网首因；03 章通路质量 |
| 丢包 | `packetsLost` / `nackCount` / `pliCount` | 05 章 NACK/PLI 被触发的证据 |
| 分辨率/帧率 | `frameWidth` / `framesPerSecond` | 05 章「弱网降码率」的直接观察点 |
| ICE 状态 | candidate 类型与状态机 | 03 章走了 host 还是 relay |

实验建议：**开着通话，用开发者工具把 CPU 拉满或用 `Network Link Conditioner`（macOS）限速**，观察 webrtc-internals 里码率先降（延迟梯度预警）、丢包后增（NACK 兜底）——亲手复现 05 章弱网时间线。

## 自查清单

- [ ] 能不查资料写出 `createOffer → setLocal → 传给对端 → setRemote → createAnswer → setLocal → 传回` 的完整顺序
- [ ] 能在真实 SDP 里指出 fingerprint、ice-ufrag、rtpmap、rtcp-fb 四类行
- [ ] 能解释为什么两个 tab 直连走的是 host 候选
- [ ] Rust 信令服务器里哪一行体现了「邮差不解读」？
- [ ] webrtc-internals 里 pliCount 突然上涨，说明发生了什么？（05 章答案）

## 下一步

带着对 WebRTC 全栈的理解进入 [阶段四：QUIC 与新一代音视频传输](/roadmap/stage-4)——你会发现 QUIC 在解决的问题（队头阻塞、握手 RTT、传输策略应用层化）正是本阶段每个机制的「下一站」。

---

← 上一章：[07 SFU 架构](/roadmap/stage-3/07-sfu) ｜ 返回 [阶段三总览](/roadmap/stage-3/)

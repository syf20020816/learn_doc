---
title: 阶段三：RTC 与 WebRTC 核心
description: 信令与 SDP、ICE/STUN/TURN、DTLS-SRTP、RTP/RTCP 与 SFU 架构——实时通信的全栈概念地图，含浏览器 1v1 通话与 Rust 信令服务两个实践。
---

# 阶段三：RTC 与 WebRTC 核心

> ⏱️ **学习时间**：5 周（每天 1~2 小时，约 50 学时） · 累计周期：第 8~12 周

> 📚 **本阶段知识整理已就绪**，建议按顺序学习：
> [01 WebRTC 全景](/rtc/stage-3/01-webrtc-overview) · [02 信令与 SDP](/rtc/stage-3/02-signaling-sdp) · [03 NAT 穿透与 ICE](/rtc/stage-3/03-nat-ice) · [04 DTLS 与 SRTP](/rtc/stage-3/04-dtls-srtp) · [05 RTP/RTCP 与拥塞控制](/rtc/stage-3/05-rtp-rtcp) · [06 jitter buffer 与 3A](/rtc/stage-3/06-mechanisms) · [07 SFU 架构](/rtc/stage-3/07-sfu) · [08 实践](/rtc/stage-3/08-practice)

## 阶段目标

以 WebRTC 为抓手，打通实时通信的全栈概念：从信令协商、NAT 穿透、加密链路到 RTP 传输与 SFU 架构。本阶段包含两个必须动手的实践：浏览器 1v1 通话 demo，以及用 Rust 自实现一个简易 RTC 服务端。

## 知识点清单

### WebRTC 概览

- [ ] WebRTC 的定位：浏览器内置的实时音视频与数据通道能力
- [ ] 三大 API：getUserMedia / RTCPeerConnection / RTCDataChannel
- [ ] 连接建立总流程：信令 → 候选交换 → 媒体加密传输

### 信令与 SDP

- [ ] WebRTC 为什么不规定信令协议（信令自选，媒体走标准）
- [ ] SDP 的 offer/answer 模型（JSEP，RFC 8829）
- [ ] SDP 关键字段：`m=` 媒体行、`a=rtpmap`、`a=fmtp`、`ice-ufrag/pwd`、`a=fingerprint`

### NAT 穿透

- [ ] NAT 的类型，以及它为什么挡住 P2P 直连
- [ ] ICE 框架：candidate 收集（host / srflx / relay）、配对与连通性检查
- [ ] STUN 的作用与局限；TURN 何时启用、代价是什么

### 安全链路

- [ ] DTLS 握手与证书指纹（与 SDP `a=fingerprint` 的对应关系）
- [ ] SRTP：媒体如何加密；DTLS-SRTP 密钥协商流程（概念）

### RTP / RTCP 在 WebRTC 中的角色

- [ ] RTP 头要点：sequence number、timestamp、SSRC、marker；RTP 头扩展
- [ ] RTCP 反馈报文：NACK（重传）、PLI / FIR（关键帧请求）、REMB / TWCC（带宽估计）
- [ ] GCC 拥塞控制的思想：基于延迟梯度 + 基于丢包（概念层）

### 媒体服务器架构

- [ ] Mesh / MCU / SFU 三种拓扑的优劣与适用规模
- [ ] SFU 为什么成为主流：不编解码、只做路由转发
- [ ] Simulcast 与 SVC：多码流适配下行带宽

### 关键机制

- [ ] jitter buffer 的作用：抗抖动、重排序、平滑播放
- [ ] NetEQ 与音频抗丢包（PLC 概念）
- [ ] 音频 3A：AEC 回声消除 / ANS 噪声抑制 / AGC 自动增益
- [ ] 音画同步：RTP timestamp 与 NTP 时钟的关系

### 实践

- [ ] **实践 1**：浏览器 1v1 通话 demo——用现成 API 跑通 getUserMedia → RTCPeerConnection → 播放（不写编码）
- [ ] **实践 2**：用 Rust 自己实现一个简易 RTC 服务端（如 tokio + WebSocket 实现信令服务器，转发 offer/answer 与 candidate），配合简单客户端完成 1v1 通话；进阶可了解 webrtc-rs 生态
- [ ] 打开 `chrome://webrtc-internals`，观察真实连接的 bitrate / RTT / 丢包

## 推荐资料

- [《WebRTC for the Curious》](https://webrtcforthecurious.com/) —— 免费在线书，WebRTC 概念第一书，强烈推荐通读
- [MDN：WebRTC API](https://developer.mozilla.org/zh-CN/docs/Web/API/WebRTC_API) —— API 与概念参考
- [RFC 8825：WebRTC 总览](https://datatracker.ietf.org/doc/html/rfc8825) —— 官方 Overview，框架先读这个
- [RFC 8829：JSEP](https://datatracker.ietf.org/doc/html/rfc8829) —— offer/answer 信令模型
- [RFC 8445：ICE](https://datatracker.ietf.org/doc/html/rfc8445) —— 只读核心章节
- [RFC 8489：STUN](https://datatracker.ietf.org/doc/html/rfc8489) / [RFC 8656：TURN](https://datatracker.ietf.org/doc/html/rfc8656)
- [WebRTC Samples](https://webrtc.github.io/samples/) —— 官方示例，实践 1 直接参考
- [webrtc.org](https://webrtc.org/) —— 官方站点与博客

## 阶段自测

1. SDP 里的 `a=fingerprint` 是用来做什么的？
2. 什么情况下 ICE 会走到 TURN relay？代价是什么？
3. PLI 和 NACK 分别解决什么问题？
4. SFU 相比 MCU 好在哪？什么时候 MCU 反而更合适？
5. 凭记忆画出 1v1 通话的完整时序图（信令、ICE、DTLS、SRTP 四个阶段）。

---

← 上一阶段：[阶段二：流媒体与传输协议](/rtc/stage-2/) ｜ 下一阶段：[阶段四：QUIC 与新一代音视频传输](/rtc/stage-4/)

---
title: 阶段四：QUIC 与新一代音视频传输
description: QUIC 的设计哲学、握手与迁移、多路流、HTTP/3、Datagram、WebTransport 与 MoQ——面向新一代音视频传输的概念地图，含抓包与 WebTransport 两个实践。
---

# 阶段四：QUIC 与新一代音视频传输

> ⏱️ **学习时间**：4 周（每天 1~2 小时，约 40 学时） · 累计周期：第 13~16 周

> 📚 **本阶段知识整理已就绪**，建议按顺序学习：
> [01 QUIC 全景](/rtc/stage-4/01-quic-overview) · [02 握手、0-RTT 与连接迁移](/rtc/stage-4/02-handshake-migration) · [03 多路流](/rtc/stage-4/03-streams) · [04 HTTP/3](/rtc/stage-4/04-http3) · [05 Datagram](/rtc/stage-4/05-datagram) · [06 WebTransport](/rtc/stage-4/06-webtransport) · [07 MoQ](/rtc/stage-4/07-moq) · [08 实践](/rtc/stage-4/08-practice)

## 阶段目标

理解 QUIC 协议族的设计哲学，以及它与音视频结合的三条线：HTTP/3 之于媒体分发、WebTransport 之于双向通道、MoQ 之于实时媒体。学完能对「QUIC 会不会取代 WebRTC / RTMP」这类问题给出有依据的判断。

## 知识点清单

### 01 QUIC 全景

- [ ] QUIC 的定位：UDP 之上的可靠多路流传输 + 内建 TLS 1.3

### 02 握手、0-RTT 与连接迁移

- [ ] 握手与 0-RTT：连接建立为什么比 TCP+TLS 快
- [ ] 连接迁移：Connection ID 与换网不断连（对移动端 RTC 意义重大）
- [ ] 拥塞控制可插拔的概念

### 03 多路流

- [ ] 流（stream）多路复用：如何消除 TCP 的队头阻塞

### 04 HTTP/3

- [ ] HTTP/3 = HTTP over QUIC；与 HTTP/2 的关键差异
- [ ] 对媒体分发的意义：点播 / 直播切片走 HTTP/3 的收益

### 05 Datagram

- [ ] QUIC Datagram（RFC 9221）：不可靠数据帧
- [ ] 为什么实时媒体需要「半可靠 / 不可靠」通道

### 06 WebTransport

- [ ] 浏览器中基于 HTTP/3 的双向传输：streams + datagrams
- [ ] 与 WebSocket / WebRTC DataChannel 的对比

### 07 MoQ（Media over QUIC）

- [ ] IETF MoQ 工作组在做什么、目标场景
- [ ] pub/sub 模型与 relay 角色：和 SFU 架构的异同
- [ ] WARP 流控（对象优先级、订阅排序）概念
- [ ] 生态现状：draft 进度、Cloudflare / Meta 等实践、quic.video 在线 demo

### 08 实践

- [ ] **实践 1**：用 Wireshark 抓一次真实 QUIC 连接，看清 Initial / Handshake / 1-RTT 与 Connection ID
- [ ] **实践 2**：用 quic-go 或 aioquic 起 HTTP/3 + WebTransport 服务，浏览器发一条 datagram 并收到 echo
- [ ] 观察 datagram 不重传、可靠流有序、切网时连接不断

## 推荐资料

- [RFC 9000：QUIC](https://datatracker.ietf.org/doc/html/rfc9000) —— 核心协议规范（重点读 1~7 章）
- [RFC 9114：HTTP/3](https://datatracker.ietf.org/doc/html/rfc9114)
- [RFC 9221：QUIC Datagram](https://datatracker.ietf.org/doc/html/rfc9221)
- [IETF MoQ 工作组](https://datatracker.ietf.org/wg/moq/about/) —— 工作组主页与会议材料
- [draft-ietf-moq-transport](https://datatracker.ietf.org/doc/draft-ietf-moq-transport/) —— MoQ 核心传输草案
- [quic.video](https://quic.video/) —— MoQ 在线 demo 与介绍资料
- [MDN：WebTransport API](https://developer.mozilla.org/zh-CN/docs/Web/API/WebTransport_API)

## 阶段自测

1. QUIC 如何消除 TCP 的队头阻塞？流与流之间的隔离在哪里实现？
2. 连接迁移对手机上的 RTC 会话意味着什么？
3. WebTransport 和 WebRTC DataChannel 有什么异同？
4. MoQ 的 relay 与 WebRTC 的 SFU 有什么本质区别？
5. 为什么实时媒体需要 QUIC Datagram？没有它会怎样？

---

← 上一阶段：[阶段三：RTC 与 WebRTC 核心](/rtc/stage-3/) ｜ 下一阶段：[阶段五：综合串联与进阶视野](/rtc/stage-5/)

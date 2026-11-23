---
title: 阶段二：流媒体与传输协议
description: 逐个击破 RTMP、HTTP-FLV、HLS、DASH、RTSP/RTP、SRT 协议，理解直播链路架构，并完成 FFmpeg 推拉流实践。
---

# 阶段二：流媒体与传输协议

> ⏱️ **学习时间**：4 周（每天 1~2 小时，约 40 学时） · 累计周期：第 4~7 周

> 📚 **本阶段知识整理已就绪**，建议按顺序学习：
> [01 网络基础：TCP vs UDP](/rtc/stage-2/01-network-basics) · [02 RTMP](/rtc/stage-2/02-rtmp) · [03 HLS 与 LL-HLS](/rtc/stage-2/03-hls) · [04 RTSP/RTP/RTCP](/rtc/stage-2/04-rtsp-rtp) · [05 SRT 与低延迟新势力](/rtc/stage-2/05-srt) · [06 直播链路架构与选型](/rtc/stage-2/06-architecture) · [07 FFmpeg 推拉流实践](/rtc/stage-2/07-practice)

## 阶段目标

搞懂主流流媒体协议的设计动机、时延特征与适用场景，能画出直播从推流到播放的完整链路，并亲手用 FFmpeg 完成一次推拉流。学完本阶段，你对「直播」的理解会从黑盒变成一张清晰的架构图。

## 知识点清单

### 网络基础回顾

- [ ] TCP 与 UDP 的核心差异：可靠性 / 有序性 / 拥塞控制 / 头部开销
- [ ] 为什么实时音视频偏爱 UDP：过期重传无用、队头阻塞、时延优先
- [ ] 理解「可靠性可以分层按需构建」的思想（为阶段三、四铺垫）

### 协议逐个击破

- [ ] RTMP：基于 TCP、握手与 Chunk 分块概念、至今仍是推流主流的原因
- [ ] HTTP-FLV：为什么比 HLS 延迟低、依赖什么分发
- [ ] HLS：m3u8 索引、TS / fMP4 分片、滑动窗口；为什么天然适配 CDN
- [ ] LL-HLS：Part 分片、阻塞请求等降时延手段
- [ ] MPEG-DASH：MPD 清单，与 HLS 的异同
- [ ] RTSP / RTP / RTCP：信令与媒体分离、RTP 包结构要点、RTCP 反馈概念
- [ ] SRT / RIST：公共互联网上低延迟可靠 UDP 传输的定位与场景

### 协议对比（输出一张自己的对比表）

- [ ] 维度：典型时延 / 传输层 / CDN 友好度 / 穿透防火墙难度 / 典型场景
- [ ] 回答两个问题：推流端为什么几乎都选 RTMP？播放端为什么百花齐放？

### 直播链路架构

- [ ] 全链路：主播端 → 推流 → 源站 → 转码/转封装 → CDN 边缘 → 观众端
- [ ] 转码与转封装的区别（本阶段只需概念）
- [ ] 秒开的常见手段：GOP 缓存、预加载、边缘缓存

### 实践（工具层面，不碰编解码）

- [ ] 用 Docker 一键起 SRS（或 nginx-rtmp），用 FFmpeg 把本地文件推到 RTMP
- [ ] 用 ffplay / VLC 分别以 RTMP、HTTP-FLV、HLS 拉同一流，对比起播速度与延迟
- [ ] 观察 HLS 的 m3u8 内容，理解分片如何滚动更新

## 推荐资料

- [Apple：HTTP Live Streaming 官方文档](https://developer.apple.com/streaming/) —— HLS 权威资料
- [DASH-IF 行业论坛](https://dashif.org/) —— MPEG-DASH 官方资料
- [维基百科：RTMP](https://en.wikipedia.org/wiki/Real-Time_Messaging_Protocol) —— 含 Adobe 官方规范链接
- [RFC 3550：RTP](https://datatracker.ietf.org/doc/html/rfc3550) —— 只读前 6 章即可
- [SRT 官网](https://www.haivision.com/srt/) —— SRT 协议资料
- [SRS 开源流媒体服务器](https://ossrs.net/) —— 实践首选，文档完善
- [FFmpeg 文档](https://ffmpeg.org/documentation.html) —— 推拉流命令参考
- [HPBN：传输协议](https://hpbn.co/transport-protocols/) —— TCP / UDP 章节回顾

## 阶段自测

1. HLS 为什么对 CDN 最友好？代价是什么？
2. RTMP 基于 TCP 且已有 20 年历史，为什么至今仍是推流默认协议？
3. RTSP 和 RTP 各自负责什么？
4. 转码和转封装有什么区别？各自的成本开销如何？
5. 如果要做一个「延迟 < 3s 的直播」，你会选什么协议组合？为什么？

---

← 上一阶段：[阶段一：音视频基础概念与理论](/rtc/stage-1/) ｜ 下一阶段：[阶段三：RTC 与 WebRTC 核心](/rtc/stage-3/)

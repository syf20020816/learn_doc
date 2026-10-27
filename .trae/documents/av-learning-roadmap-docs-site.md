# 音视频学习文档站 · Roadmap 搭建计划

## Summary

把当前全新的 Rspress v2 模板站改造为「音视频技术学习」文档站：重写首页、新建 `/roadmap/` 学习路线板块（1 篇总览 + 5 篇阶段概览页），删除模板占位内容，更新站点配置与导航。

**范围约定**：只覆盖 概念 / 基础理论 / 协议 / RTC / QUIC（音视频相关部分），**不学编解码**（编解码仅作为概念层背景出现，不展开算法与实现）。

**时间基准**：业余时间，每天 1~2 小时，总周期约 3.5~4 个月。

## Current State

- 项目为 Rspress v2 空白模板（`package.json` 仅依赖 `@rspress/core`）。
- `docs/` 下均为模板占位内容：`guide/start/`、`guide/use-mdx/`、`api/`，首页 `docs/index.md` 为英文模板 hero 内容。
- 导航配置在 `docs/_nav.json`，侧边栏靠各目录 `_meta.json`。
- `rspress.config.ts`：`lang: 'en'`、`title: 'My Site'`，均需改为中文学习站信息。

## Proposed Changes

### 1. 修改 `rspress.config.ts`
- `lang: 'zh'`；`title: '音视频技术学习之路'`。
- 移除模板的 GitHub socialLinks；logo/icon 暂保留模板默认资源。

### 2. 删除模板占位内容
- 删除 `docs/guide/`（start、use-mdx 整个目录）和 `docs/api/` 目录。

### 3. 重写 `docs/index.md`（首页）
- `pageType: home`，中文 hero：站点名 + 一句话定位（从浅入深学音视频协议/理论/RTC/QUIC，不涉及编解码）。
- actions：`开始学习` → `/roadmap/`；`阶段一：基础概念` → `/roadmap/stage-1`。
- features：5 个阶段各一张卡片（图标 + 一句话 + 链接到对应阶段页）。

### 4. 新增 Roadmap 板块 `docs/roadmap/`

文件结构：
```
docs/roadmap/
├── _meta.json        # ["index", "stage-1", "stage-2", "stage-3", "stage-4", "stage-5"]
├── index.md          # Roadmap 总览
├── stage-1.md        # 阶段一：音视频基础概念与理论
├── stage-2.md        # 阶段二：流媒体与传输协议
├── stage-3.md        # 阶段三：RTC 与 WebRTC 核心
├── stage-4.md        # 阶段四：QUIC 与新一代音视频传输
└── stage-5.md        # 阶段五：综合串联与进阶视野
```

#### 4.1 `roadmap/index.md`（总览页）
- 学习目标与范围声明（明确写出「不学编解码」的边界）。
- 阶段总览表：阶段 | 主题 | 建议时长 | 累计周期，例如：

| 阶段 | 主题 | 建议时长 | 累计周期 |
|---|---|---|---|
| 一 | 音视频基础概念与理论 | 3 周（约 30 学时） | 第 1~3 周 |
| 二 | 流媒体与传输协议 | 4 周（约 40 学时） | 第 4~7 周 |
| 三 | RTC 与 WebRTC 核心 | 5 周（约 50 学时） | 第 8~12 周 |
| 四 | QUIC 与新一代音视频传输 | 4 周（约 40 学时） | 第 13~16 周 |
| 五 | 综合串联与进阶视野 | 2 周（约 20 学时） | 第 17~18 周 |

- 每阶段 2~3 句简介 + 跳转链接；结尾给「如何使用本站」（勾选知识点清单打卡、每阶段自测）。

#### 4.2 阶段页统一模板
每个 `stage-N.md` 包含：阶段目标 / 学习时间（按天 1~2h 折算）/ 知识点清单（Markdown checkbox，便于打卡）/ 推荐资料（真实可访问链接）/ 阶段自测问题（5 个左右）。

#### 4.3 各阶段知识点内容（决策已定，实现时照此展开）

**阶段一：音视频基础概念与理论**（3 周）
- 数字化流程：采集 → 采样/量化 → 编码（概念层）→ 封装 → 传输 → 渲染
- 音频：采样率、位深、声道、码率、PCM、常见音频参数
- 视频：分辨率、帧率、色彩空间（RGB/YUV）、码率、I/P/B 帧与 GOP（仅概念）
- 封装容器：MP4/MKV/FLV/TS 的定位与区别、moov 在线点播中的意义
- 三种业务形态与时延谱系：点播 / 直播 / 实时互动
- 核心指标：时延、卡顿率、音画同步、QoS 与 QoE
- 资料：MDN 媒体与 Web Audio 中文文档、雷霄骅博客入门系列、B 站音视频入门公开课

**阶段二：流媒体与传输协议**（4 周）
- 网络基础：TCP vs UDP、为什么实时场景偏爱 UDP
- 协议逐个击破：RTMP（推流主流）、HTTP-FLV、HLS（m3u8/分片/LL-HLS）、MPEG-DASH、RTSP/RTP/RTCP、SRT/RIST
- 协议对比：时延、开销、场景、CDN 友好度（整理一张对比表）
- 直播链路架构：推流 → 转码 → 分发（CDN）→ 播放
- 实践：用 FFmpeg/ffplay 完成 RTMP 推流与 HLS 拉流（工具使用，不碰编解码）

**阶段三：RTC 与 WebRTC 核心**（5 周）
- WebRTC 概览与三大 API：getUserMedia / RTCPeerConnection / RTCDataChannel
- 信令与 SDP：offer/answer 交换流程、SDP 关键语义
- NAT 穿透：ICE / STUN / TURN、candidate 与连通性检查
- 安全链路：DTLS、SRTP、DTLS-SRTP 密钥交换
- RTP/RTCP 实战角色：RTP 头扩展、NACK / PLI / FIR / TWCC、拥塞控制 GCC（概念层）
- 媒体服务器架构：Mesh / MCU / SFU、Simulcast 与 SVC
- 关键机制：jitter buffer、NetEQ、音频 3A（AEC/ANS/AGC）、音画同步
- 实践：浏览器 1v1 通话 demo（用现成 API，不写编码）
- 实践2: 自己实现一个简单的rtc（服务端rust实现）+ 简单客户端
- 资料：《WebRTC for the Curious》（免费电子书）、MDN WebRTC 文档、RFC 8825


**阶段四：QUIC 与新一代音视频传输**（4 周）
- QUIC 基础：基于 UDP 的可靠传输、内置 TLS 1.3、0-RTT、多路流复用与队头阻塞消除、连接迁移
- HTTP/3：与 HTTP/2 差异、对媒体分发（点播/直播场景）的意义
- 不可靠传输：QUIC Datagram（RFC 9221）与实时媒体的可能
- WebTransport：浏览器中基于 HTTP/3 的双向数据通道
- MoQ（Media over QUIC）：IETF MoQ 工作组、pub/sub 模型、relay 角色、与 SFU 架构对比、WARP
- 生态现状：IETF draft 进度、Cloudflare MoQ 实践、quic.video
- 资料：RFC 9000 / 9114 / 9221、IETF MoQ WG draft、quic.video

**阶段五：综合串联与进阶视野**（2 周）
- 全链路时延分析：从采集到渲染逐段拆解
- QoE 指标体系与监控概念
- 主流 RTC 云厂商架构对比（概念层面）
- 产出：写一篇学习综述或画一张全景图
- 后续路标：如未来想深入，可延伸到编解码、引擎开发（仅指路，不在本站范围）

### 5. 更新 `docs/_nav.json`
```json
[
  { "text": "学习路线", "link": "/roadmap/", "activeMatch": "/roadmap/" }
]
```

## Assumptions & Decisions

- 全站内容为中文。
- 阶段页本次只做「概览」（目标/时间/知识点清单/资料/自测），正文深度内容后续按阶段逐个填充；阶段页在 `roadmap/` 下平铺为单文件，未来填充时可升级为目录。
- 推荐资料只用稳定、可公开访问的链接（MDN、RFC、IETF、免费电子书等）。
- 不新增 Rspress 插件依赖（如 mermaid），总览用 Markdown 表格表达。
- 首页沿用模板默认 logo/icon 资源，不新增图片。

## Verification

1. `npm run dev` 启动后浏览器检查：首页中文 hero 正常、导航与侧边栏正确、6 个 roadmap 页面均可访问、阶段间跳转链接有效。
2. `npm run build` 通过（Rspress 构建会校验内部死链）。

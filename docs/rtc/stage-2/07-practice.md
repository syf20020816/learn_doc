---
title: 07 · FFmpeg 推拉流实践
description: 用 Docker 起 SRS 流媒体服务器，用 FFmpeg 推 RTMP 流，再用 ffplay/curl 以三种协议拉流，亲手测出 RTMP 与 HLS 的时延差。
---

# 07 · FFmpeg 推拉流实践

> 📍 阶段二 · 知识整理 07 ｜ 本阶段收官：把 02~06 章的协议亲手跑一遍

## 实践目标

搭一条最小直播链路：**FFmpeg（主播）→ SRS（流媒体服务器）→ ffplay/VLC（观众）**，跑通 RTMP / HTTP-FLV / HLS 三种播放协议，并亲手测出它们时延差的具体数字。

不需要碰编解码（`-c copy` 全程只转封装），一台装了 Docker 的电脑即可完成全部实验。

## 第一步：用 Docker 起 SRS 服务器

[SRS（Simple Realtime Server）](https://ossrs.net/) 是国内最流行的开源流媒体服务器，一条命令拉起：

```bash
docker run -d --name srs \
  -p 1935:1935 \
  -p 8080:8080 \
  -p 1985:1985 \
  ossrs/srs:5
```

端口与职责对照（02~03 章的数字全部对上）：

| 端口 | 协议 | 用途 |
| --- | --- | --- |
| 1935 | RTMP | 推流入口 + RTMP 拉流 |
| 8080 | HTTP | HTTP-FLV 拉流 + HLS 拉流 |
| 1985 | HTTP API | 服务器状态查询（演示用） |

验证服务器活着：

```bash
curl http://localhost:1985/api/v1/versions
# 返回 JSON，看到 version 字段即成功
```

## 第二步：推流（主播端）

### 用本地视频文件模拟直播

```bash
ffmpeg -re -stream_loop -1 -i input.mp4 \
  -c copy \
  -f flv rtmp://localhost/live/test
```

逐个参数拆解（都对应前面章节的知识）：

| 参数 | 含义 | 对应知识 |
| --- | --- | --- |
| `-re` | 按视频原生帧率**实时**读文件（不一口气灌完） | 模拟「直播」的实时性 |
| `-stream_loop -1` | 文件播完无限循环 | 保证实验流一直存在 |
| `-c copy` | **不转码，只转封装**（MP4→FLV 直接搬数据） | 06 章「转封装 vs 转编码」的活教材 |
| `-f flv` | 输出封装格式 FLV | 02 章：RTMP 消息与 FLV Tag 同构 |
| `rtmp://localhost/live/test` | 地址 / app / streamKey | 02 章 URL 结构 |

> 💡 没有本地 mp4？用下一条命令凭空生成一个带秒表画面的测试源——后面测延迟全靠它。

### 凭空生成测试流（内置秒表画面）

```bash
ffmpeg -re -stream_loop -1 \
  -f lavfi -i "testsrc2=size=1280x720:rate=30" \
  -f lavfi -i "sine=frequency=440" \
  -c:v libx264 -preset ultrafast -tune zerolatency -b:v 2M \
  -c:a aac -b:a 64k \
  -g 60 \
  -f flv rtmp://localhost/live/test
```

- `testsrc2`：FFmpeg 内置的测试画面，自带**走动的秒表/时钟**——肉眼比对「主播画面时间 vs 观众画面时间」就能测延迟。
- `-g 60`：GOP 设为 60 帧 = 2 秒一个 I 帧（阶段一 GOP 知识落地；SRS 的 GOP 缓存最多等 2s 才能给新观众首帧）。
- 这里用了 `libx264` 编码是因为 lavfi 源是原始帧，必须编码；生产推流 `-c copy` 场景见上一条命令。

## 第三步：三种协议拉流（观众端）

开着推流命令，另开三个终端分别用三种协议拉同一路流：

```bash
# 1. RTMP 拉流（直接问 1935 端口）
ffplay -fflags nobuffer rtmp://localhost/live/test

# 2. HTTP-FLV 拉流（HTTP 长连接，8080 端口）
ffplay -fflags nobuffer http://localhost:8080/live/test.flv

# 3. HLS 拉流（HTTP 清单 + 分片）
ffplay http://localhost:8080/live/test.m3u8
```

参数说明：`-fflags nobuffer` 让 ffplay 减少自身缓冲，更接近真实延迟；HLS 命令特意**不加**这个参数，因为它受协议本身约束（03 章的 ×3 规则），加不加都降不到秒级以内。

浏览器播放（HLS 用 Safari 直接打开，Chrome 需要 hls.js 演示页）：

```text
SRS 自带 HTTP 服务：http://localhost:8080/players/srs_player.html?stream=test
```

## 第四步：观察 HLS 滚动与测延迟

### 观察 m3u8 滚动（03 章「滑动窗口」实物）

```bash
# 连续观察三次，每次间隔约 6 秒（HLS 默认切片 10s，SRS 默认也按配置来）
curl http://localhost:8080/live/test.m3u8
sleep 6
curl http://localhost:8080/live/test.m3u8
sleep 6
curl http://localhost:8080/live/test.m3u8
```

你会看到：`MEDIA-SEQUENCE` 每次 +1、最老分片被移除、新分片追加——**03 章滑动窗口图示的活体演示**。找一个直播平台的 m3u8 地址（直播页 F12 里搜 `.m3u8`）做同样观察，现象完全一致。

### 秒表法测延迟（本实践的高潮）

1. 三个终端同时开：推流（秒表源）+ RTMP 拉流窗口 + HLS 拉流窗口，摆在一起。
2. 截图或肉眼对比：**推流源的秒表读数** vs **各拉流窗口的秒表读数**。

典型结果（SRS 默认配置 + `-g 60`）：

| 拉流方式 | 与推流源的秒表差 | 解释 |
| --- | --- | --- |
| RTMP（nobuffer） | 约 1~2s | 推流编码 + 服务器转发缓冲 |
| HTTP-FLV（nobuffer） | 约 1~2s | 与 RTMP 同源同构 |
| HLS | 约 10~30s | 03 章推导的「分片 ×3」生效 |

**动手把 HLS 切片改小验证结论**：重启 SRS 用支持 HLS 低延迟配置，或推流时直接观察——切片从 10s 改 2s 后，HLS 延迟会从 ~30s 降到 ~6s 左右，与 03 章公式完全吻合。这一刻，协议时延对你来说不再是背出来的数字，而是算得出来、测得出来的物理量。

## 自查清单

- [ ] 能不查文档说出 RTMP 的默认端口、URL 三段结构
- [ ] 能解释 `-c copy` 与不加该参数的区别（转封装 vs 转码）
- [ ] 能用 curl 看懂 m3u8 的滑动窗口变化
- [ ] 秒表实测 RTMP vs HLS 延迟差，并能用「分片 ×3」公式对上号
- [ ] 能解释为什么 HLS 拉流加 `-fflags nobuffer` 也快不起来

## 下一步

- 去 [SRS 官方文档](https://ossrs.net/lts/zh-cn/docs/v5/doc/getting-started) 玩转更多特性：转码、录制、集群、WebRTC 播放。
- 用 OBS 替代 FFmpeg 推流（界面化操作，理解主播真实工作流）。
- 带着以上认知进入 [阶段三：RTC 与 WebRTC 核心](/rtc/stage-3/)——你会发现 RTC 就是把「协议自己做的传输决策」交还给应用层的完全体。

---

← 上一章：[06 直播链路架构与选型](/rtc/stage-2/06-architecture) ｜ 返回 [阶段二总览](/rtc/stage-2/)

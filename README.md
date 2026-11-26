# DOODLE RUCKUS · 纸上大乱涂

一款**笔记本纸上的第一人称波次射击**游戏。整张方格纸就是战场：墨水快用完了，涂鸦小怪还在不断从格线里爬出来。用铅笔、马克笔和尺子把它们统统涂掉。

美术 100% 程序化生成（Canvas 手绘纹理 + 抖动墨线 shader），音效由 WebAudio 实时合成，**没有任何外部图片 / 音频 / 网络请求**。

## 在线试玩

<!-- VERCEL_URL -->

也可以部署到自己的 Vercel：Fork 本仓库 → [vercel.com/new](https://vercel.com/new) → Import → 直接 Deploy（纯静态，无构建配置要求）。

## 运行

**最简单：直接双击 `index.html`。** 全部依赖（Three.js、字体）都已内联或放在 `assets/`，`file://` 协议下可正常运行。

或者起一个本地服务器：

```bash
# 任选其一
python3 -m http.server 8765      # 打开 http://127.0.0.1:8765/
npx serve .
```

- 推荐 Chrome / Edge / Safari / Firefox 最新桌面版，需要键鼠（Pointer Lock）。
- 点击「开始涂鸦」后会锁定鼠标，随时按 **ESC** 暂停 / 释放鼠标。
- 戴耳机体验更佳。

## 本地开发

```bash
npm install          # 只装 three + esbuild
npm run build        # src/*.js → 打包成根目录 game.js（IIFE，内联 Three.js）
npm run watch        # 监听改动自动重新打包
npm test             # 命中判定 / 盾牌减伤 的 Node 单元测试（23 项）
```

改完 `src/` 之后刷新 `index.html` 即可看到效果，不需要其它构建步骤。

## 玩法

- 共 **8 波**，第 4 波是 Boss **THE ERASER**，第 8 波是 Boss **THE INKBLOT**。通关后可以「继续无尽模式」。
- 每清空一波，从 **3 张贴纸**里挑 1 张强化（共 16 种，见下文）。
- 连续击杀积累 **连击**，分数倍率最高 ×12；掉出纸面会扣血并弹回中心。
- 最高分与最远波次会保存在浏览器本地。

### 操作

| 按键 | 动作 |
|---|---|
| **W A S D** | 移动 |
| **鼠标** | 看向 · 左键开火 |
| **Shift** | 疾跑 |
| **Space** | 跳跃 |
| **C** | 冲刺（无敌帧） |
| **F** | 橡皮擦近战（无视盾牌） |
| **1 / 2 / 3** 或滚轮 | 切换武器 |
| **R** | 装填 |
| **ESC** | 暂停 |

### 武器

| 槽位 | 武器 | 特点 |
|---|---|---|
| 1 | 铅笔手枪 PENCIL POPPER | 点射精准，命中脸部暴击 ×2 |
| 2 | 马克笔霰弹 MARKER BLASTER | 近距离 8 发弹丸一片 |
| 3 | 尺子轨道炮 RULER RAILGUN | 穿透多个敌人，**无视盾牌** |

### 敌人

| 敌人 | 行为 |
|---|---|
| 涂鸦小怪 scribble | 基础近战，脸部是暴击点 |
| 冲锋小子 rusher | 更快、更脆 |
| 墨水团 blob | 血厚，死亡时分裂 |
| 纸蜂 wasp | 飞行、远程吐墨 |
| 盾牌涂鸦 shield | 正面举盾大幅减伤 → **绕后 / 轨道炮 / F 近战** |
| THE ERASER（第 4 波） | Boss，会冲撞并召唤小怪 |
| THE INKBLOT（第 8 波） | 最终 Boss |

### 贴纸升级（波间三选一）

火力：大橡皮筋（弹匣 +50%）、削尖的笔尖（伤害 +20%）、手速练习（射速 +18%）、顺滑铅芯（换弹 +35%）、眯眼瞄准（暴击率 +15%）、更粗的马克笔（霰弹 +3 弹丸）、穿透力（额外穿透 1 人）
机动：纸上滑行（移速 +15%）、涂改带（冲刺冷却 -35%）
生存：厚脸皮（最大生命 +30 并回满）、创可贴（回血更快）、吸血墨水（6% 吸血）、墨水吞噬（击杀回 4 血）
特效：墨水炸弹（击杀爆炸）、越战越勇（连击加分翻倍）、会拐弯的笔（轻微追踪）

## 调试参数（仅测试用）

在 URL 后加上：

| 参数 | 作用 |
|---|---|
| `?debug` | 左下角显示状态面板（state / pointer lock / 输入计数 / 波次 / HP / 错误） |
| `&autostart` | 跳过封面直接开始 |
| `&aim=3` | 初始俯视角 3°（便于复现爆头线） |
| `&bot=1` | 自动瞄准机器人完整打一局（配合 autostart） |
| `&god=1` | 机器人锁血（仅用于跑通全流程） |

例：`index.html?debug&autostart&bot=1&god=1`

## 文件结构

```
doodle-ruckus/
├── index.html          # 页面骨架（封面 / HUD / 升级 / 结算 等容器）
├── style.css           # 纸张质感 UI、字体、贴纸卡片、响应式
├── game.js             # 构建产物：esbuild 打包的 IIFE（游戏源码 + Three.js 0.170）
├── assets/             # ZCOOL KuaiLe / Patrick Hand / Caveat 字体（Google Fonts, SIL OFL 1.1）
├── src/                # 游戏源码（ES Module）
│   ├── main.js         #   入口：创建 Game、绑定 UI 事件、URL 调试参数
│   ├── game.js         #   主循环 / 波次 / 状态机（menu → playing → upgrade → over）
│   ├── player.js       #   第一人称控制器（移动 / 跳 / 冲刺）
│   ├── weapons.js      #   三把武器 + hitscan 命中判定
│   ├── enemies.js      #   敌人 AI、Boss、伤害与护盾减伤
│   ├── world.js        #   方格纸竞技场、掩体、碰撞体
│   ├── textures.js     #   Canvas 程序化手绘纹理
│   ├── ink.js          #   抖动墨线 shader / 材质
│   ├── fx.js           #   粒子、墨迹、屏幕震动
│   ├── audio.js        #   WebAudio 合成音效与 BGM
│   ├── ui.js           #   HUD、贴纸升级、结算
│   └── util.js         #   数学 / 随机工具
├── test/               # Node 单元测试（hitscan / 盾牌减伤）+ DOM shim
├── package.json
└── vercel.json         # 静态缓存头
```

## 说明

- 命中判定（`hitscan`）与盾牌方向减伤附有 Node 单元测试，`npm test` 运行。
- 字体来自 Google Fonts，遵循 SIL Open Font License 1.1；Three.js 为 MIT。

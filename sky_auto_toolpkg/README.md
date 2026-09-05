# sky_auto ToolPkg（光遇自动化 · 带配置界面）

把 sky_auto 从普通 JS 包升级为 **ToolPkg**：提供「光遇坐标配置」界面（包管理 →「打开配置」），使用者（粉丝）在界面上填自己设备的坐标。等级时长**不开放配置**，按固定标准内建。

## 目录结构

```
sky_auto_toolpkg/
├── manifest.json                包信息 + 子包声明（toolpkg_id: sky_auto）
├── main.js                      主入口：注册「光遇坐标配置」UI 模块
├── ui/
│   └── sky_setup/
│       └── index.ui.js          compose_dsl 配置界面（exports.default = Screen(ctx)）
├── packages/
│   └── sky_auto.js              子包脚本（工具集：读屏/发送/互动/感知/轮询/环境识别）
└── README.md
```

## 配置界面（「打开配置」→ 标题「光遇坐标配置」）

| 字段 | 标签 | 必填 |
|---|---|---|
| 聊天框双击 | 聊天框双击坐标 | ✅ |
| 发送键 | 发送键坐标 | ✅ |
| 退键盘 | 退键盘坐标 | ✅ |
| flip {sx,sy,ex,ey} | 翻页参数（起点X/Y、终点X/Y） | ✅ |
| offset_active | 主动偏移量（锚点Y再往下偏移多少像素点开动作栏） | ⬜ 无默认值，留空由使用者填（设备相关） |
| 光翼 | 光翼坐标 | ⬜ |
| 回遇境按钮 | 回遇境按钮 | ⬜ |
| 回遇境确认 | 回遇境确认 | ⬜ |

- 输入格式：坐标 `x,y`（如 `540,1200`，兼容 `[540,1200]`）；翻页 `4` 个数字。
- 必填为空 → 提示 **「请填写聊天框双击/发送键/退键盘/翻页」**。
- 保存 → 调用子包 `sky_core:sky_set_config` 写入
  `/storage/emulated/0/Download/SkyDetector/sky_auto_config.json`，并保留默认字段：
  `offset_active=300`、`max_flip=4`、`sky_result_dir`、`poll_interval_ms=1000`、`interact_keywords`、`task_quiet_ms=5000`、`task_timeout_ms=30000`、`task_redeliver_ms=10000`。
- 打开界面自动预填当前配置（读 `sky_core:sky_get_config`）。

## 等级时长（内建固定，不配置）

```js
const LEVEL_TIMING = { 1: 300, 2: 500, 3: 750, 4: 1100 }; // ms
```

`sky_action` 按等级决定：`level 1 → tap（单击）`；`level ≥2 → longPress(hold_ms)`（2/3/4 → 500/750/1100ms）。

## 子包工具

- `sky_set_config({...})` — 合并写入坐标/参数到 config.json
- `sky_read_chat()` — 读屏 → `{success, latest_message, full_text, messages}`（`messages` 为**有意义消息列表**，新→旧；过滤无意义消息：仅含 `. …` 的、以及输入框占位符「聊天……/聊天...」（含汉字）也剔除；**类型判断交给 AI**）
- `sky_send_text({text})` — 发送前**读屏检测键盘/输入框(EditText)**：已打开直接输入；未打开则双击聊天框弹键盘（不依赖 chatActive 记忆）；弹不起来返回明确错误「聊天窗未打开」（不再 setText 裸奔导致 Step error）。发送前轻量防碰撞：输入框已有**非占位**内容（文字/emoji）→ `{success:false, busy:'user_typing', message:'输入框占用'}`；仅 `. …` 或「聊天……」占位不算占用。**长文本自动分段**：>40 字逐段发送（段间约1秒），返回 `segments_count`。发送期间 `busy` 与轮询读屏互斥。记入 `sent_messages`（最近20条）防自触发
- `sky_action({type: active|accept, icon_name, level})` — 顺序固化：**无论主动/被动，互动前必先退键盘**；active 退键盘→锚点→开栏→翻页→点击/长按；accept 退键盘→不开栏直接 tap
- `sky_detect({name?})` — 解析最新 `result_*.txt` → `{success, count, icons:[{name,x,y,conf}]}`
- `sky_poll({mode: chat|action})` — 比对上次，返回 `{success, changed, detail}`（循环由 sky_run 驱动）
- `sky_look({dir?})` — **被动**环境识别：直接截图（路径放 cleanOnExit 自动清理）→ `read_file(intent=识别画面内容)` 识图 → `{success, file_path, recognition}`
- `sky_run({confirm_x?, poll_interval_ms?})` — **常驻循环（单消息框内跑完，不依赖外部 workflow）**：【启动协议】循环占用当前对话通道，启动前 AI 必须先把引导语「请先点击 Operit 对话界面右下角的红色 X（取消/关闭按钮），释放当前对话占用，之后才会开始自动轮询。」展示给用户，等用户确认已点 X 后**再调用 `sky_run({ confirm_x: true })` 才真正启动**（不带 confirm_x 的调用只返回引导语 need_guide:true，不启动）；脚本不自动点 X、不用 start_chat_service 绕过。循环每间隔读聊天 + SkyDetector 结果，**对有意义消息列表做集合对比**（过滤仅含 `. …` 的无意义消息，只存最新一版覆盖写），有新文本则投递；并**排除自己发送的消息**（`sent_messages` 最近20条，相等或较短者为前缀即跳过，AI 回复不再自触发）。**发送互斥**：`sky_send_text` 执行期间轮询本轮跳过（`busy` 标志，日志「发送互斥跳过」，不参与波次计时）。**消息波次合并投递**：连发多条不逐条刷 AI，攒批次——距最后一条新消息 >0.3 秒或满 4 条才投递（`A / B / C`，末尾附「（简短思考，快速回复）」）。**投递-回复任务队列串行化（方案Q）**：同一时刻只有一个活动任务——投递一批后写 `sky_task.json` (active=true)，AI 处理完该批全部动作（游戏内回复/互动/识别/回遇境等）后才放行下一批，投递、AI 动作、循环 UI 指令三者时间上严格不重叠，一次成功零重试。投递用 `fire-and-forget`（发出即释放工具槽，不再被 send_message_to_ai 收尾期占槽）；完成判定（先到先生效）：① AI 调 `sky_task_done` 显式完成 ② 最后动作信号后 5s 静默 ③ 任务开始 10s 无任何信号则自动重投递一次 ④ 30s 超时强制完成（AI 忘调/不回也不卡队列）。AI 侧所有占槽工具（`sky_send_text`/`sky_action`/`sky_look`/`sky_home`）成功时自动刷信号。**唤醒超时**：`wakeAi` 已改 `fire-and-forget`（不再 15s 阻塞等待）。**读屏超时**：`getCurrentPage` 5s 上限，超时本轮跳过（不改 last_seen、不投递）并记「读屏超时」。**停止**：用户消息出现「**停止光遇流程**」→ 立即退出；或 `sky_stop` / 停止标记文件。每轮写运行日志（`cleanOnExit/sky_auto_run.log`，>60s 未更新自动清空、追加写，含**读屏耗时**列；并清理 `sky_result_dir` 下 >60s 的旧 `result_*.txt`）
- `sky_stop()` — 停止常驻循环（置运行标志 + 写停止标记文件）
- `sky_home()` — 回遇境快流程：退键盘 → 光翼 → 回遇境按钮 → 回遇境确认
- `sky_get_config()` — 读当前完整配置（界面预填/自检用）
- `sky_task_done()` — AI 声明本轮任务（本批消息的全部动作：回复/互动/识别/回遇境）已全部完成。投递模板会强制要求调用；调用后循环立即放行下一批。忘调也有 5s 静默 / 30s 超时兜底，不卡队列
- `main()` — 自检：核对必填坐标 + 翻页是否齐全

## 铁律（让 AI 遵守，写进使用说明）

1. 坐标一律来自 config（由配置界面填），包内零硬编码像素。
2. 类型判断 / 选路由 AI 决定；脚本只做「读屏 + 有无新消息」。
3. 环境识别被动触发、直接截图，截图后**必须**用 `read_file(path, environment=android, intent=识别画面内容)` 读刚截的图，否则识别不出「我们在哪」。
4. 等级时长固定（1:300 / 2:500 / 3:750 / 4:1100），不开放配置。
5. 互动顺序由工具固化：**退键盘→锚点→开栏→翻页→做互动**，不可颠倒；无论主动(active)还是被动(accept)，执行前都**必先退键盘**（退键盘坐标为必填配置）。
6. 点击铁律：光遇是 Unity 引擎，无障碍 touch 插不进点击——**所有 tap/长按/滑动一律走系统级 Shell**（`input tap` / 同坐标 `input swipe` = 长按）；仅**文本注入**（`setText`）走无障碍。
7. 弹键盘看状态：脚本读屏判断键盘/输入框是否已聚焦——已聚焦就不弹，未聚焦才双击弹（不烧 token）。
8. 常驻循环在**同一个消息框内**闭环（`sky_run`），不引入第二个对话 / 新开窗口 / 唤醒到别处；唤醒喂给 AI 必须 `toolCall('send_message_to_ai', {message, hide_user_message:true, persist_turn:true, notify_reply:true})`——不写死 chat_id、不用 getChatId()。只有用户说「停止玩光遇」（或调用 `sky_stop`）才停。

## 开发注意（ToolPkg 规范）

- 注册 UI 模块时，`main.js` 必须用 `__importDefault` 包装 `require(...)` 结果，并且文件声明 `__esModule`；否则 `screen` 不被识别为可序列化引用，报 `registerToolPkgToolboxUiModule requires a serializable screen reference`。
- `ui/*/index.ui.js` 顶部必须声明 `Object.defineProperty(exports, "__esModule", { value: true });`，末尾 `exports.default = function Screen(ctx) {...}`。
- 结构严格照官方编译产物：`main.js` = `__importDefault` + `Object.defineProperty(__esModule)` + `const x_1 = __importDefault(require("./ui/.../index.ui.js"))` + `screen: x_1.default`。

## 本轮增量（已并入代码）

1. **回复时延**：`BATCH_QUIET_MS 3000→1500→800→500→300`、`BATCH_FLUSH_DELAY_MS 2500→500→250→500→300`（波次 4 条封顶）。`poll_interval_ms` 默认已设 1000（主循环节拍的最大杠杆），如需更快可在配置里调低。
2. **sky_look 识图路径**：识图用 `capture_screenshot` 实际输出路径；拿不到则定位 cleanOnExit 最新截图，保证 `recognition` 有结果。
3. **sky_look 截图前先退键盘**（铁律，坐标缺失则跳过不报错）。
4. **聊天长消息截断 OCR 兜底**：读屏 `messages` 中以 `...` 结尾且长度≥15 的他人消息，用截图 OCR 补全（成功替换、失败保留截断版，不阻断）；自己消息已由 `sent_messages` 排除。
5. **三大类并列软互斥**：聊天（轮询/发送/读聊）、互动（action/home）、截图识屏（look/detect）互斥——任一类执行置 `busy`，其它类轮询跳过本轮 / 工具返回 `{success:false, busy:'xxx'}`；非阻塞等待。
6. **修复 `_listFiles`**：`Tools.Files.list(dir)` 空则再试 `list(dir, "android")`；返回结构兼容 `files/entries/data/数组/list`；元素取 basename；mtime 沿用现有兜底。
7. **翻页节奏匹配识别周期**：当前页未找到图标时先等约 4s（`FLIP_CAPTURE_WAIT_MS`）让 SkyDetector 拍到当前页，再读一次；仍无才翻页，翻页后等结果文件更新（`_waitResultChange` 上限 6s）——不快速连翻。
8. **发送前键盘检测**：`sky_send_text` 发送前读屏检测 EditText；未打开双击弹键盘（不依赖 chatActive），弹不起返回「聊天窗未打开」。

## 本轮增量（已并入代码）

**第二轮迭代 · 五条**：

- **G 翻页前等"新一拍落地"**：删固定 4s 等待/常量；未找到时先 `_waitResultChange(dir, prev, 7000)` 等当前页新拍 → 再判一次（命中则不翻页），仍无才翻页；翻页后也等新页拍落地（上限 7s，按 SkyDetector 约5s/拍设计）。
- **H 互动/识别后自动弹键盘**：`sky_action`（active/accept）成功、`sky_look` 成功时调用 `_ensureChatWindow(cfg)`（已在 try 块、releaseBusy 前；弹键失败只记日志，不影响原返回值）。退键盘铁律不变。
- **I sky_look 顺带返回图标坐标**：新增 `icons: [{name,x,y,conf}]`（conf≥50 才收录；无则 `icons:[]` 且 `detect_note:'未检测到图标'`，否则 `detect_note:null`）。
- **J 被动 accept 等新拍落地**：退键盘后、识别前先 `_waitResultChange(dir, prev, 7000)` 等新拍；超时返回 `{success:false, phase:'detect', error:'SkyDetector 结果文件超时未更新（约 7 秒无新拍），已取消点击'}`（宁可不点，不点旧坐标）。
- **K 投递消息强制"先在游戏内回复"**：`THINK_GUIDANCE = '（简短思考，快速回复。铁律：收到用户的游戏内消息，必须先调用 sky_send_text 在光遇游戏内回复用户，再向 Operit 侧同步。）'`；SkyDetector 结果更新用简短 `ACTION_GUIDANCE = '（若检测到用户发起的动作，先在游戏内回应）'`。

**关键 Bug 修复**：`parseFileTime` 原正则 `/(\d{10,})/` 匹配不到 `result_YYYYMMDD_HHMMSS`（时间戳被下划线分隔、无连续10位数字）→ 恒 null → `_waitResultChange` 的 prev/cur 恒 null → 死等 7s 超时（accept 全失败、翻页白等）。改为「去除非数字后拼接为单调递增序列」；`_fileMtime` 增加 `Tools.System.shell('stat -c %Y <path>')` 兜底。**H 加固**：互动/识别完成后 `_popKeyboardAfterAction`（先等动画1s + 失败重试1次）再弹键盘。

## 聊天归属（known_names：归属 + 去重，非过滤名单）

- **`known_names`**（备注名白名单，数组）：填自己和朋友的备注名（如 `"春分","seek","小号"`）。用于①**归属标注**（这条消息是谁发的）②**去重**（同一发送者+同一内容不重复投递）。**过滤对象只有陌生人**（白名单外名字）；**白名单内用户的消息永远投递，绝不因任何过滤规则被忽略**。`known_names` 为空时读屏不投递（无可归属即忽略，宁缺毋滥）。

**统一读屏解析（不分模式，按聊天场景结构适配）**：
- 单人聊天（真实气泡）：气泡上下纵向排列、名字标签在气泡上方——用**垂直相邻 + 中心对齐（x 中心差 ≤30px）**判定配对 → 产出「名字：内容」。
- 多人聊天（侧边栏）：消息一条条平铺（对话框列表），无中心对称，名字是挂在**行尾的备注**（「内容 名字」/「内容 - 名字」式）——读行尾名字备注判断归属 → 产出「名字：内容」。
- 归属统一基于 `known_names`：白名单内 → 投递；白名单外/陌生人 → 忽略；无归属孤立文本 → 忽略。
- 硬性保证：**白名单内用户（用户本人）的任何消息，任何情况、任何格式下都必须投递，绝不丢失**。

## 操作说明与声明（必读）

① **息屏/关机都能停止**：设备息屏（锁屏/灭屏）或关机时，脚本流程自动停止（息屏后屏幕内容不可见、无障碍读屏失效，脚本停止；关机为进程终止）。如需继续，请重新启动流程。运行期间请保持屏幕常亮/游戏前台。
② **启动引导语**：使用 `sky_run` 流程前，先点击 Operit 对话界面右下角的**红色 X（取消/关闭按钮）**，释放当前对话占用，之后才会触发自动轮询回复。
③ **停止方法**：用户在光遇聊天框输入「**停止光遇流程**」，脚本识别后立即停止；否则脚本一直运行（直到息屏/关机/手动停止）。
④ **开启/关闭多人聊天**：输入「**开启多人聊天**」（脚本动作：点击该聊天气泡打开侧边栏）或「**关闭多人聊天**」（脚本动作：点击光翼图标下方 100 处、双击两下收起侧边栏，完成后自动重新打开键盘）。
⑤ **声明**：本流程仅使用系统无障碍服务与 ADB 权限，并**不涉及光遇包内部内容，不是光遇外挂**，仅用于 AI 在光遇中的聊天陪伴；使用该流程默认承担一切风险，造成的财产损失请自负责任。
⑥ **调用工具时请勿点 X**：调用 `sky_send_text` / `sky_action` / `sky_look` / `sky_home` 期间请勿手动点击 Operit 的取消/关闭（X）按钮，否则会中断工具执行通道（`sky_action` 曾因用户点 X 在开栏阶段被中断并短暂占用槽）。
⑦ **方案Q·投递-回复串行化**：同一时刻只有一个活动任务，投递一批 → AI 做完全部动作 → 才投下一批。AI 收到消息后请尽快用 `sky_send_text` / `sky_action` / `sky_look` / `sky_home` 完成本批动作并调用 `sky_task_done` 声明完成；若 AI 忘调，循环用「最后信号 5s 静默」或「30s 超时」自动放行，不会卡死，但为了「一次成功零重试」建议显式调用。

## 坐标校准（新用户第一步）

不同设备上「指针位置」显示的坐标与实际点击位置可能有**固定偏差**（平移/缩放，由显示缩放、导航条、挖孔/刘海等引起，同一设备恒定、不同设备各异）。**教程不变**（仍用指针位置录坐标）+ **用户零操作校准** + 脚本自动换算：

1. 录入坐标（配置界面）。
2. AI 检测到 `coord_calibrated` 为 `false` 且你在录坐标 → **主动提醒**：首次使用建议先做一次坐标校准（几秒自动完成），需要吗？
3. 同意 → AI 调 `sky_calibrate`（4 个非对称已知点长按约 1.2s 并截图 → OCR「指针位置」数值）→ 解 scale/offset（远距两点解 scale、反代 offset、另两点验证，|差|≤8px 判通过，超差提示特殊映射）→ `sky_calibrate_apply` 写入并置 `coord_calibrated=true` → 展示「已校准：scale=…，offset=(…)」。
4. 拒绝 → 正常使用，本次会话不再打扰。

**换算管线**：所有进入 tap 的坐标（用户录入 + SkyDetector 识别输出 + 屏幕锚点）统一执行 `实际 = 原始 × scale + offset`；默认恒等（scale=1, offset=0）→ 未校准/无偏差设备完全不受影响。配置界面「坐标校准」区可手动填 scale/offset（高级用户），并有换算预览；换设备后需重新校准（旧值被覆盖），同型号可复用。

**关键 Bug 修复**：METADATA 内 sky_run 描述曾含未转义英文双引号 `同"停止光遇流程"一样`，导致 METADATA JSON 解析失败、整包报「No valid subpackages were loaded」——已改为中文引号 `同「停止光遇流程」一样`；全 METADATA 现可 JSON.parse（14 tools）。**坐标自校准**：新增 `coord_scale_x/y`、`coord_offset_x/y`、`coord_calibrated`（默认 1.0/1.0/0.0/0.0/false），所有 tap 统一换算（`实际=原始×scale+offset`）；`sky_calibrate`/`sky_calibrate_apply` 工具 + 配置界面「坐标校准」区（状态/手动输入/换算预览）。

**本版修复（4 缺陷）**：
1. **sky_action Step error**：action 流程（active/accept）逐段写运行日志（`互动-退键盘 ok`/`锚点 ok`/`开栏 ok`/`找到图标 XX`/`点击完成`）定位中断段；`sky_action` 描述注明预计耗时（accept 最长约7s、active 每翻页页约7s）。
2. **sky_calibrate 截图时机**：改为单条 shell 管线 `input swipe X Y X Y 1200 & sleep 0.7 && screencap -p <path>`，**长按进行中截图**（指针位置显示坐标，不再归零）。
3. **SkyDetector 误报为"用户发起的动作"**：推送文案改中性「检出可交互图标：XX（置信度 Y%）——请 AI 判断是否为用户发起，是则回应，否则忽略」；多图标同现标注「疑似动作栏状态」、置信度 <50% 标注「低置信」。
4. **同图标重复推送/重启假变化**：`pollAction` 改为**图标名集合 diff + 同图标 30s 冷却窗口**（同图标 N 拍不重复推）；`sky_run` 启动时对齐 `last_seen.action` 到当前最新结果（避免 9/1 旧文件假变化），并加「结果文件时间戳 ≥ 启动时间」守卫。

**v6 最终版新增**：
- **息屏自动停止**：循环每 2s 查屏幕状态（`dumpsys power` `mWakefulness`），息屏/灭屏自动停止并写日志（息屏后无法靠光遇指令停止）。
- **统一读屏重构 + 指令纯化**：删除「模式」配置与双场景/内存态切换；「开启多人聊天」仅点击该气泡打开侧边栏（纯UI），「关闭多人聊天」点击光翼下方100处双击两下收起侧边栏 + 自动重开键盘（纯UI）；读屏统一按单人气泡/多人侧边栏结构适配，归属基于 `known_names`。
- **空屏根治**：读屏重试 3 次（~300ms 间隔）→ 仍空则截图留档 + 写「读屏空(重试3次仍空)」日志（附截图路径，便于复现定位），并返回 `screen_timeout`（不发 last_seen → 恢复后新消息不丢）。
- **唤醒互斥（BUG-A）**：`wakeAiHeld` 在唤醒阻塞窗口内持 `busy`（'wake'），避免与 `sky_send_text`/`sky_action` 执行时间重叠报 Step error。
- **校准截图时机（BUG-B）**：sky_calibrate 已用 `input swipe … & sleep 0.7 && screencap` 长按进行中截图（保留）。
- **known_names 语义纠正**：归属 + 去重（同"名字：内容"只投一次），过滤对象仅陌生人；白名单内用户消息必投递。
- **`wait_result_ms` 配置**：accept/翻页等待新拍窗口配置化，默认 **12000ms**。
- **隐私清理**：文档/示例中真实备注名已全部替换为通用名「春分/seek/小号」。

> ⚠️ 校准注意：`sky_calibrate` 长按在游戏界面可能误触发好友动作（实测触发过公主抱），**建议校准前站远/避开交互目标**。

## 本轮增量 · 方案Q + 5 项已验证修复（2026-09-05）

**方案Q · 投递-回复任务队列串行化**（根治"第一次被拒→重试"的槽位碰撞）：
- **一次只做一件事**：投递一批 → AI 做完全部动作（回复/互动/识别/回遇境）→ 才投下一批。投递、AI 动作、循环 UI 指令三者时间上严格不重叠。
- **投递**：`sky_run` 读到新消息先攒批次（`BATCH_MAX=4 / BATCH_QUIET_MS=300 / BATCH_FLUSH_DELAY_MS=300`）入内存队列；无活动任务才出队投递（`fire-and-forget`，发出即释放工具槽），并写 `sky_task.json`(active=true)。
- **完成信号**：AI 侧占槽工具（`sky_send_text`/`sky_action`/`sky_look`/`sky_home`）成功时自动刷 `last_signal_at`。
- **完成判定（先到先生效）**：① AI 调 `sky_task_done` 显式完成 ② 最后动作信号后 5s 静默 ③ 任务开始 10s 无任何信号自动重投递一次（`redelivered` 防无限）④ 30s 超时强制完成。
- **互斥**：活动任务进行中，循环不执行 UI 指令动作（开/关多人聊天）——入队等待；循环执行 UI 动作期间不投递。
- **停止/重启**：`sky_stop`/控制词停止清空队列 + 清除活动任务；`sky_run` 启动基线检查到残留 active=true 直接清除。
- **新配置**：`task_quiet_ms=5000`、`task_timeout_ms=30000`、`task_redeliver_ms=10000`（写入 `sky_auto_config.json`，循环启动时读取）。

**5 项已验证修改**：
1. **BUG-A wakeAi fire-and-forget**：投递后不再 `Promise.race` 等 15s（`send_message_to_ai` 不因 JS 超时取消，一直占工具槽导致 send/action 被拒）。发出即释放槽，AI 是否收到由方案Q 兜底。
2. **BUG-C 控制词只检测本轮新增**：与上一轮 raw 基线对比，聊天窗残留的旧「停止光遇流程」不再每轮命中误停。
3. **启动基线对齐**：`sky_run` 启动先读一次屏写入 `last_seen`（现有消息不算新增），防止首轮把残留控制词当新增触发。
4. **投递加速**：`poll_interval_ms` 默认 2000→**1000**；`BATCH_QUIET_MS/BATCH_FLUSH_DELAY_MS` 500→**300**。
5. **BUG-D 翻页节奏**：翻页前**至少等 8 秒**（等当前页识别反馈稳定，否则图标反馈回来页已翻走）；翻页后不额外停顿，直接等新页识别反馈落地。

## 操作坑与经验教训（使用说明书）

汇总历史踩坑，遵守即可显著降低故障率：

1. **点 X 的时机**：启动循环前必须先让用户手动点右下角红色 X 释放对话占用；但**调用 `sky_send_text`/`sky_action`/`sky_look`/`sky_home` 期间不要再点 X**（曾导致 `sky_action` 开栏阶段被中断、槽短暂占用）。脚本不自动点 X、不用 `start_chat_service` 绕过。
2. **退键盘是铁律**：`sky_action`（active/accept）执行前必先退键盘（坐标缺失直接失败）；`sky_look` 截图前也先退键盘（否则拍的全是字母键）。
3. **点击一律走系统 Shell**：光遇是 Unity 引擎，无障碍 touch 插不进点击——`input tap`/同坐标 `input swipe`=长按；仅文本注入 `setText` 走无障碍。
4. **坐标偏差**：不同设备「指针位置」显示的坐标与实际点击可能有固定偏差。首次使用建议做一次坐标校准（站远/避开交互目标，避免误触发动作）；`实际 = 原始×scale+offset`，每天更新 UI 提示换算预览。
5. **SkyDetector 节奏**：截图/识别约 5s/拍且波动。accept 等「新拍落地」约 7s（`wait_result_ms=12000` 兜底）；翻页前等 ≥8s 保证当前页反馈稳定。
6. **动作栏状态勿误判**：多图标同现 =「疑似动作栏状态」；置信度 <50% =「低置信」。这两类都视为「用户未发起」，忽略，不默认回应。
7. **同图标去重**：牵手等持续状态多拍反复检出不会重复投递（`pollAction` 图标名集合 diff + 同图标 30s 冷却窗口）。
8. **读屏空≠没消息**：读屏连续空可能只是无碍桥短暂失效。已做重试 3 次 + 截图留档 + 记日志（读屏空不更新 last_seen，恢复后新消息不丢）。
9. **息屏即停**：设备灭屏/息屏后脚本自动停止（无障碍读屏失效，无法靠光遇指令停止），运行期间请保持屏幕常亮/游戏前台。
10. **校准长按会触发动作**：`sky_calibrate` 在游戏界面长按约 1.2s 可能误触发好友动作（实测公主抱），校准前站远/避开交互目标。

## 单消息框闭环用法

1. 用户在一个对话里说「开始玩光遇」。
2. AI 先调 `sky_run()`（不带 confirm_x）拿到固定引导语，**原样输出给用户**：「请先点击 Operit 对话界面右下角的红色 X（取消/关闭按钮），释放当前对话占用，之后才会开始自动轮询。」
3. 用户**手动点击红色 X** 释放对话占用，并在对话里确认（如「已点」）。
4. AI 调 `sky_run({ confirm_x: true })` 启动常驻循环（`poll_interval_ms=1000`）。
5. 循环自己跑：读屏/读 SkyDetector 结果 → 与上次对比（覆盖写）→ 有变化就 `send_message_to_ai` 唤醒当前对话里的 AI → AI 调 `sky_send_text` / `sky_action` / `sky_look` / `sky_home` 回复或互动 → 循环继续。
6. 用户说「停止玩光遇」→ AI 调 `sky_stop()` 退出循环；用户也可直接在光遇聊天里发「**停止光遇流程**」，循环读到该消息会**立即自行退出**（循环内也可通过停止标记文件中断）。

## 运行文件（统一放 cleanOnExit，Operit 退出自动清理）

- `sky_auto_last_seen.json`（"最新一条"状态记忆）、`sky_auto_stop.flag`（停止标记）、`sky_auto_run.log`（每轮运行日志，>60s 未更新自动清空再记）、`sky_env.png`（截图）。
- 这些路径**强制**在 `OPERIT_CLEAN_ON_EXIT_DIR` 下；若该常量未定义会抛错，不回退到其它目录。
- 每轮 `pollAction` 顺带清理 `sky_result_dir` 下修改时间 >60s 的旧 `result_*.txt`，只保留最近的。

## 部署 / 测试

1. 把 `sky_auto_toolpkg/` 目录整个导入 Operit（ToolPkg），或用打包工具打成 `.toolpkg`。
2. 打开包管理 →「打开配置」→ 填入坐标 → 保存（提示保存成功后 config.json 已更新）。
3. `use_package('sky_core')` 激活子包。
4. `operit_editor:debug_run_sandbox_script` 跑 `main()` 自检；再跑 `sky_read_chat` / `sky_detect` 验证。
5. 在光遇实际跑一轮：`sky_read_chat → AI 判断 → sky_send_text / sky_action → sky_poll`。

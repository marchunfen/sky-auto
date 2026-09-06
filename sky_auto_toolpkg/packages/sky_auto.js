/* METADATA
{
  "name": "sky_core",
  "display_name": {
    "zh": "光遇自动化",
    "en": "Sky Auto"
  },
  "description": {
    "zh": "光遇全流程自动化工具链：聊天回复、互动动作、环境识别。坐标全部由使用者在「光遇坐标配置」界面填写，包内零硬编码像素；等级时长内建固定（1:单击 / 2:500ms / 3:750ms / 4:1100ms），不开放配置。",
    "en": "Sky automation toolchain: chat reply, interaction actions and environment look. Coordinates user-filled via the setup UI (no hardcoded pixels); level timings built-in (1:tap / 2:500ms / 3:750ms / 4:1100ms)."
  },
  "enabledByDefault": false,
  "category": "Automatic",
  "tools": [
    {
      "name": "sky_set_config",
      "description": {
        "zh": "录入/覆盖自己的坐标与参数，合并写入配置文件并返回{success}。可只传部分字段，例如 {\"聊天框双击\":[x,y],\"发送键\":[x,y]}。首次录入坐标时若检查到 coord_calibrated 为 false，请主动提醒用户：『首次使用建议先做一次坐标校准：不同设备上「指针位置」显示的坐标与实际点击位置可能有固定偏差，校准后即可保证点击精准。需要我现在帮你执行坐标校准吗？（几秒钟，自动完成）』；用户同意则调用 sky_calibrate，拒绝/跳过则本次会话静默不再打扰。",
        "en": "Merge and write coordinates/params into the config file; partial fields allowed."
      },
      "parameters": [
        { "name": "config", "description": { "zh": "要合并写入的配置对象（坐标/参数），允许部分字段。", "en": "Config object to merge (partial allowed)." }, "type": "object", "required": true },
        { "name": "config_path", "description": { "zh": "可选：覆盖配置文件路径。", "en": "Optional: override config file path." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "sky_read_chat",
      "description": {
        "zh": "读屏取聊天文字。返回{success, latest_message, full_text, messages, raw_messages}；messages 为有意义消息列表（新→旧），过滤无意义消息（仅含 [ . … ] 及\"聊天……\"占位）。统一读屏解析（不分模式）：按单人气泡（名字在上方+中心对齐≤30px）或多人侧边栏（行尾备注「内容 名字」）结构适配，归属统一基于 known_names 白名单——白名单内 -> 投递「名字：内容」；名单外/陌生人/无归属孤立文本 -> 忽略；白名单内用户消息必投递、绝不遗漏。同「名字：内容」只投一次（去重）。类型判断交给 AI。",
        "en": "Read chat text from screen; latest = lowest (max Y) visible message. Type judgment left to AI."
      },
      "parameters": []
    },
    {
      "name": "sky_send_text",
      "description": {
        "zh": "发一句话/多句。发送前**读屏检测键盘/输入框(EditText)**：已打开 -> 直接输入；未打开 -> 双击聊天框弹键盘（不依赖 chatActive 记忆）；弹不起来 -> 返回明确错误「聊天窗未打开」，禁止 setText 裸奔。发送前轻量防碰撞：输入框已有非占位内容（文字/emoji）-> 返回{success:false, busy:'user_typing', message:'输入框占用'}（仅 . … 或 \"聊天……\" 占位不算占用）。长文本自动分段：>40 字按每段≤40 字切分逐段发送（段间约1秒），返回 segments_count。发送期间置 busy（与轮询读屏互斥）。坐标读配置。",
        "en": "Send one message. Script checks focus first (no token burn): skip keyboard pop if focused; otherwise double-tap the chat box and pause ~1s for the keyboard to fully expand before typing. Then type, wait 0.5s, tap send key."
      },
      "parameters": [
        { "name": "text", "description": { "zh": "要发送的文字内容。", "en": "Text to send." }, "type": "string", "required": true }
      ]
    },
    {
      "name": "sky_action",
      "description": {
        "zh": "执行互动动作（高层，顺序固化：退键盘→锚点→开栏→翻页→点击/长按）。无论 active 还是 accept，执行前都先退键盘（铁律）。active：主动/跟随（自动翻页找图标）；accept：被动，不开动作栏，用sky_detect取图标坐标直接tap。等级时长内建：level 1=单击，level 2/3/4=长按(500/750/1100ms)。**预计耗时**：accept 最长约7s（等新拍）；active 每个翻页页约7s、最多 max_flip 页。流程逐段写运行日志（互动-退键盘/锚点/开栏/找到图标/点击完成）便于定位中断。",
        "en": "Run an interaction with fixed order. Both active and accept ALWAYS dismiss the keyboard first (iron rule). active opens the action bar and auto-flips to find the icon (includes following); accept taps an already-visible icon via sky_detect."
      },
      "parameters": [
        { "name": "type", "description": { "zh": "active（主动/跟随）或 accept（被动）。", "en": "active or accept." }, "type": "string", "required": true },
        { "name": "icon_name", "description": { "zh": "动作图标名，例如 拥抱/牵手/击掌/背背。支持口语别名（拉手/抱抱/贴贴等），会自动归一化到标准名；也可用配置 action_aliases 自定义映射。", "en": "Icon name, e.g. hug/handshake/high-five. Colloquial aliases are auto-normalized to standard names." }, "type": "string", "required": true },
        { "name": "level", "description": { "zh": "动作等级 1-4：1=单击；2/3/4=长按（内建时长 500/750/1100ms）。", "en": "Level 1-4: 1=tap; 2/3/4=longPress (built-in 500/750/1100ms)." }, "type": "number", "required": false }
      ]
    },
    {
      "name": "sky_detect",
      "description": {
        "zh": "读 sky_result_dir 下最新 result_*.txt，用正则解析\"名称 中心(x,y) 置信度%\"。返回{success,count,icons:[{name,x,y,conf}]}；name给了只返回匹配项。",
        "en": "Parse the latest SkyDetector result file into icon coordinates; optional name filter."
      },
      "parameters": [
        { "name": "name", "description": { "zh": "可选：只返回该图标名的匹配项。", "en": "Optional: filter by icon name." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "sky_poll",
      "description": {
        "zh": "轮询判断有无新内容。chat：读屏对比上次latest_message；action：读结果文件时间戳/内容是否变化。返回{success, changed, detail}。循环不写进包，由外层工作流调用。",
        "en": "Poll for changes. chat compares latest message; action checks the result file fingerprint. The loop itself lives in the outer workflow."
      },
      "parameters": [
        { "name": "mode", "description": { "zh": "chat 或 action。", "en": "chat or action." }, "type": "string", "required": true }
      ]
    },
    {
      "name": "sky_look",
      "description": {
        "zh": "被动环境识别：先退键盘（铁律，坐标缺失则跳过）再截图，识图一律用截图实际输出路径（拿不到则定位目录最新截图，保证 recognition 有结果）。顺带返回最近图标坐标 icons（置信度≥50% 才收录，无则 detect_note='未检测到图标'）。识别成功后自动弹键盘。",
        "en": "Passive environment look: screenshot directly (no foreground/overlay pre-check, path under cleanOnExit), then read_file with intent=识别画面内容 to know where we are."
      },
      "parameters": [
        { "name": "dir", "description": { "zh": "可选：截图输出目录，默认 OPERIT_CLEAN_ON_EXIT_DIR。", "en": "Optional: screenshot output dir (default OPERIT_CLEAN_ON_EXIT_DIR)." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "sky_run",
      "description": {
        "zh": "启动常驻轮询循环（单消息框内跑完，不依赖外部 workflow）。【启动协议·必读】循环会占用当前对话处理通道：启动前 AI 必须先向用户输出固定引导语「请先点击 Operit 对话界面右下角的红色 X（取消/关闭按钮），释放当前对话占用，之后才会开始自动轮询。」，等用户确认已点 X 后，**再调用 sky_run({ confirm_x: true }) 才会真正启动循环**；不带 confirm_x 的调用只返回引导语（need_guide:true），不启动、不占用。脚本不自动点 X、不用 start_chat_service 等绕过。循环每 poll_interval_ms（默认2000）读屏聊天 + 读 SkyDetector 结果，**对有意义消息列表做集合对比**（过滤仅含 . … 的无意义消息，只存最新一版覆盖写），有新文本则投递；并**排除自己发送的消息**（sent_messages 最近20条，相等或较短者为前缀即跳过，AI 回复不再自触发）。**消息波次合并投递**：连发多条时不逐条刷 AI，攒批次——距最后一条新消息 >2 秒或满 8 条才投递（格式 A / B / C，末尾附「（简短思考，快速回复）」）。**投递-回复任务队列串行化（方案Q）**：同一时刻只有一个活动任务——投递一批后写 sky_task.json(active=true)，AI 处理完该批全部动作（回复/互动/识别/回遇境）后才放行下一批，投递、AI 动作、循环 UI 指令三者时间上严格不重叠，一次成功零重试。投递用 fire-and-forget（发出即释放工具槽）；完成判定：AI 调 sky_task_done 显式完成 → 最后动作信号后 5s 静默 → 任务开始 10s 无任何信号则自动重投递一次 → 30s 超时强制完成（AI 忘调/不回也不卡队列）。AI 侧所有占槽工具（sky_send_text/sky_action/sky_look/sky_home）成功时自动刷信号。**读屏超时**：getCurrentPage 5s 上限，超时本轮跳过（不改 last_seen、不投递）并记日志。**停止**：用户消息出现「停止光遇流程」→ 立即退出；或 sky_stop / 停止标记文件。**开启多人聊天**：用户消息出现「开启多人聊天」→ 仅执行一个脚本动作：点击该聊天气泡打开侧边栏（纯UI，不切状态）；「关闭多人聊天」→ 点击光翼图标下方100处（双击两下）收起侧边栏，完成后自动重新打开键盘（纯UI）。**息屏自动停止**：循环运行期间每2s查屏幕状态（dumpsys power mWakefulness），息屏/灭屏自动停止并写日志（息屏后无法靠光遇指令停止）。每轮写运行日志（cleanOnExit/sky_auto_run.log，>60s 未更新自动清空，含读屏耗时列；并清理 >60s 的旧 result 文件）。",
        "en": "Resident polling loop in the current message. PROTOCOL: the loop occupies the conversation slot, so first show the user the fixed guide (tap the red X at bottom-right to release the slot), wait for confirmation, then call sky_run({ confirm_x: true }) to actually start; a call without confirm_x only returns the guide (need_guide:true) and does not start. Never auto-tap X or bypass via start_chat_service."
      },
      "parameters": [
        { "name": "confirm_x", "description": { "zh": "必须为 true 才启动循环：表示用户已确认手动点击 Operit 界面右下角的红色 X（取消/关闭）释放对话占用。", "en": "Must be true to start the loop: user confirmed manual tap of the red X (cancel)." }, "type": "boolean", "required": false },
        { "name": "poll_interval_ms", "description": { "zh": "可选：覆盖轮询间隔毫秒数（默认读配置 poll_interval_ms）。", "en": "Optional: override poll interval ms." }, "type": "number", "required": false }
      ]
    },
    {
      "name": "sky_stop",
      "description": {
        "zh": "停止 sky_run 常驻循环（置运行标志 + 写停止标记文件）。",
        "en": "Stop the sky_run resident loop."
      },
      "parameters": []
    },
    {
      "name": "sky_home",
      "description": {
        "zh": "回遇境快流程：退键盘 → 光翼 → 回遇境按钮 → 回遇境确认（坐标全读配置，Shell 点击）。",
        "en": "Back-to-home quick flow: dismiss keyboard → wing → back-home button → back-home confirm (all coordinates from config, shell taps)."
      },
      "parameters": []
    },
    {
      "name": "sky_get_config",
      "description": {
        "zh": "读取当前完整配置（默认值合并后），返回{success, config}。供配置界面预填与自检使用。若返回的 config 里 coord_calibrated 为 false，请提示用户：不同设备上「指针位置」显示的坐标与实际点击可能有固定偏差，建议做一次坐标校准（可调 sky_calibrate 自动完成），校准后点击精准。",
        "en": "Read the merged current config; returns {success, config}."
      },
      "parameters": []
    },
    {
      "name": "sky_task_done",
      "description": {
        "zh": "AI 声明本轮任务（本批消息的全部动作：游戏内回复/互动/识别环境/回遇境等）已全部完成。投递模板会强制要求调用。调用后循环立即放行下一批；若忘调用，循环用「最后动作信号后5秒静默」或「30秒超时」兜底放行，不会卡死。",
        "en": "Declare the current task (all actions for this batch, e.g. in-game reply / interaction / look / home) fully complete. The delivery template mandates this call; after it the loop immediately releases the next batch. If skipped, quiet-5s or 30s-timeout fallback unblocks the queue."
      },
      "parameters": []
    },
    {
      "name": "sky_calibrate",
      "description": {
        "zh": "坐标偏差自校准（AI 引导，用户零操作）：在4个非对称已知显示坐标依次长按约1.2秒并截图（默认 (150,200)(2000,900)(150,1000)(2000,200)，可用 params.points 覆盖），返回各截图路径（供 read_file 读「指针位置」显示的坐标）、用远距两点解 scale、反代 offset、另两点验证（预测 vs 实际差≤8px 判通过，超差提示特殊映射）。",
        "en": "Coordinate calibration: long-press 4 known display points (~1.2s each) and screenshot, return shot paths for OCR."
      },
      "parameters": [
        { "name": "points", "description": { "zh": "可选：4个采样点 [[x,y],...]，默认上列。", "en": "Optional: points array." }, "type": "array", "required": false }
      ]
    },
    {
      "name": "sky_calibrate_apply",
      "description": {
        "zh": "写入坐标校准值并置 coord_calibrated=true。之后所有 tap 都会执行 实际=原始×scale+offset。返回校准结果消息。",
        "en": "Write calibration scale/offset and set coord_calibrated=true."
      },
      "parameters": [
        { "name": "scale_x", "description": { "zh": "x 缩放系数（默认1.0）。", "en": "x scale (default 1.0)." }, "type": "number", "required": false },
        { "name": "scale_y", "description": { "zh": "y 缩放系数（默认1.0）。", "en": "y scale (default 1.0)." }, "type": "number", "required": false },
        { "name": "offset_x", "description": { "zh": "x 偏移量（默认0）。", "en": "x offset (default 0)." }, "type": "number", "required": false },
        { "name": "offset_y", "description": { "zh": "y 偏移量（默认0）。", "en": "y offset (default 0)." }, "type": "number", "required": false }
      ]
    },
    {
      "name": "main",
      "description": {
        "zh": "自检：加载配置，核对必填坐标（聊天框双击/发送键/退键盘/光翼）是否齐全，返回{success, ready, missing_coords}。",
        "en": "Self-check: verify required coordinates are configured."
      },
      "parameters": []
    }
  ]
}*/

const SkyAuto = (function () {
  'use strict';

  // ------------------------------------------------------------------
  // 常量与默认路径（路径可配；坐标一律读配置，绝不写死像素值）
  // ------------------------------------------------------------------
  const DEFAULT_CONFIG_PATH = '/storage/emulated/0/Download/SkyDetector/sky_auto_config.json';
  const DEFAULT_RESULT_DIR = '/storage/emulated/0/Download/SkyDetector/results';

  // 等级时长：内建固定，不开放配置（spec: 1=单击 tap；2/3/4=长按）
  const LEVEL_TIMING = { 1: 300, 2: 500, 3: 750, 4: 1100 }; // ms

  let _configPath = DEFAULT_CONFIG_PATH;

  // ------------------------------------------------------------------
  // 全局访问器（ToolPkg 子包环境：Tools / OPERIT_CLEAN_ON_EXIT_DIR / exports）
  // 读屏统一用 UINode.getCurrentPage() -> toFormattedString()，不用 Tools.UI.getPageInfo()
  function _ui() { return (typeof Tools !== 'undefined' && Tools.UI) ? Tools.UI : null; }
  function _sys() { return (typeof Tools !== 'undefined' && Tools.System) ? Tools.System : null; }
  function _files() { return (typeof Tools !== 'undefined' && Tools.Files) ? Tools.Files : null; }
  /**
   * 读屏：UINode.getCurrentPage() 返回 Promise，await 后调用 toFormattedString()。
   * formatted 字符串形如：
   *   ◢ [TextView] T:"春分" ⮞ [x1,y1][x2,y2]
   *   ◢ [Button] D:"描述" ⮞ [x1,y1][x2,y2]
   * 返回该字符串；若页面对象无 toFormattedString 则回退 String(p)。
   */
  const SCREEN_TIMEOUT_MS = 5000; // 读屏超时保护：读不到就本轮跳过，防止循环僵死
  async function _getPageInfo() {
    if (typeof UINode === 'undefined' || typeof UINode.getCurrentPage !== 'function') {
      throw new Error('UINode.getCurrentPage 不可用');
    }
    let p = null;
    try {
      p = await Promise.race([
        UINode.getCurrentPage(),
        _sleep(SCREEN_TIMEOUT_MS).then(function () { return null; })
      ]);
    } catch (e) {
      p = null;
    }
    if (p == null) return null; // 读屏超时/返回空 -> 由调用方跳过本轮（不改 last_seen、不投递）
    return (typeof p.toFormattedString === 'function') ? p.toFormattedString() : String(p);
  }

  async function _shell(cmd) {
    const s = _sys();
    if (!s || typeof s.shell !== 'function') throw new Error('Tools.System.shell 不可用');
    return s.shell(cmd);
  }
  // 点击铁律：光遇是 Unity 引擎，无障碍 touch 插不进点击，
  // 快流程内所有 tap 一律用系统级 Shell（input tap / input swipe），禁止无障碍点击。
  async function _tap(x, y) {
    const c = applyCoord(x, y); // 坐标偏差自校准
    return _shell('input tap ' + Math.round(Number(c[0])) + ' ' + Math.round(Number(c[1])));
  }
  async function _longPress(x, y, holdMs) {
    const c = applyCoord(x, y);
    const hold = (holdMs != null && isFinite(Number(holdMs)) && Number(holdMs) > 0)
      ? Math.round(Number(holdMs)) : 500;
    // 同一坐标 input swipe = 长按（坐标取整）
    return _shell('input swipe ' + Math.round(Number(c[0])) + ' ' + Math.round(Number(c[1])) + ' ' + Math.round(Number(c[0])) + ' ' + Math.round(Number(c[1])) + ' ' + hold);
  }
  async function _swipe(sx, sy, ex, ey, durationMs) {
    const s = applyCoord(sx, sy);
    const e = applyCoord(ex, ey);
    let cmd = 'input swipe ' + Math.round(Number(s[0])) + ' ' + Math.round(Number(s[1])) + ' ' + Math.round(Number(e[0])) + ' ' + Math.round(Number(e[1]));
    if (durationMs != null && isFinite(Number(durationMs)) && Number(durationMs) > 0) {
      cmd += ' ' + Math.round(Number(durationMs));
    }
    return _shell(cmd);
  }
  // 输入：注入文字仍走无障碍（通路正常）
  async function _setText(text) {
    const u = _ui();
    if (!u || typeof u.setText !== 'function') throw new Error('Tools.UI.setText 不可用');
    return u.setText(text);
  }
  async function _pressKey(code) {
    return _shell('input keyevent ' + Number(code));
  }
  async function _sleep(ms) {
    const s = _sys();
    if (!s || typeof s.sleep !== 'function') throw new Error('Tools.System.sleep 不可用');
    return s.sleep(ms);
  }
  function _fmt(err) { return (err && err.message) ? err.message : String(err); }

  // ------------------------------------------------------------------
  // 小工具
  // ------------------------------------------------------------------
  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function deepMerge(a, b) {
    const out = {};
    const srcA = isPlainObject(a) ? a : {};
    const srcB = isPlainObject(b) ? b : {};
    for (const k in srcA) {
      if (k in srcB) {
        // b 覆盖 a；两者若均为对象则递归合并
        out[k] = (isPlainObject(srcA[k]) && isPlainObject(srcB[k]))
          ? deepMerge(srcA[k], srcB[k])
          : srcB[k];
      } else {
        out[k] = srcA[k];
      }
    }
    for (const k in srcB) {
      if (!(k in out)) out[k] = srcB[k];
    }
    return out;
  }

  function defaultConfig() {
    return {
      '聊天框双击': [],
      '发送键': [],
      '退键盘': [],
      '光翼': [],
      '回遇境按钮': [],
      '回遇境确认': [],
      'offset_active': 300,
      'flip': {},
      'max_flip': 4,
      'sky_result_dir': DEFAULT_RESULT_DIR,
      'poll_interval_ms': 1000,
      'interact_keywords': ['抱抱', '拥抱', '牵手', '拉手', '击掌', '背背', '摸头'],
      // 【fixedM】动作名称自定义映射（口语->标准名），UI「动作名称映射」可填；优先于内置别名表
      'action_aliases': {},
      // 聊天归属白名单（自己+朋友；用于归属标注与去重，名单外/陌生人忽略，白名单内用户消息必投递）
      'known_names': [],
      // 坐标偏差自校准：tap = 原始坐标 × scale + offset（默认恒等，未校准/无偏差设备不受影响）
      'coord_scale_x': 1.0,
      'coord_scale_y': 1.0,
      'coord_offset_x': 0.0,
      'coord_offset_y': 0.0,
      'coord_calibrated': false,
      // 等待 SkyDetector 结果文件"新拍落地"的窗口（ms）。按最坏拍速设计（拍图+识别约5s+/拍且波动），默认 12s，可配置
      'wait_result_ms': 12000,
      // 方案Q：投递-回复任务队列串行化的超时控制（ms）
      'task_quiet_ms': 1000,       // 最后动作信号后静默多久视为完成（【fixedQ】5000->1000：AI 忘调 sky_task_done 时更快放行）
      'task_timeout_ms': 30000,    // 任务兜底超时（含重投递后）
      'task_redeliver_ms': 10000   // 无任何信号时自动重投递的等待时间
    };
  }

  function coord(cfg, key) {
    const v = cfg && cfg[key];
    if (Array.isArray(v) && v.length >= 2 &&
        isFinite(Number(v[0])) && isFinite(Number(v[1]))) {
      return [Number(v[0]), Number(v[1])];
    }
    return null;
  }

  // ------------------------------------------------------------------
  // 坐标偏差自校准：所有进入 tap 的坐标统一执行 实际 = 原始 × scale + offset。
  // 默认恒等(scale=1, offset=0) -> 未校准/无偏差设备完全不受影响。
  // ------------------------------------------------------------------
  let _coordT = null;
  function setCoordTransform(cfg) {
    const c = cfg || {};
    _coordT = {
      sx: pickNum(c.coord_scale_x, 1.0),
      sy: pickNum(c.coord_scale_y, 1.0),
      ox: pickNum(c.coord_offset_x, 0.0),
      oy: pickNum(c.coord_offset_y, 0.0)
    };
  }
  function applyCoord(x, y) {
    const t = _coordT || { sx: 1, sy: 1, ox: 0, oy: 0 };
    return [x * t.sx + t.ox, y * t.sy + t.oy];
  }

  function flipCoord(cfg) {
    const f = (cfg && cfg.flip) || {};
    const sx = pickNum(f.sx, f.start_x, f['起点x']);
    const sy = pickNum(f.sy, f.start_y, f['起点y']);
    const ex = pickNum(f.ex, f.end_x, f['终点x']);
    const ey = pickNum(f.ey, f.end_y, f['终点y']);
    if (sx === null || sy === null || ex === null || ey === null) return null;
    return { sx: sx, sy: sy, ex: ex, ey: ey };
  }
  function pickNum() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (v !== null && v !== undefined && isFinite(Number(v))) return Number(v);
    }
    return null;
  }

  function joinPath(dir, name) {
    if (!dir) return name;
    const d = String(dir);
    const last = d.slice(-1);
    return (last === '/' || last === '\\') ? d + name : d + '/' + name;
  }

  // ------------------------------------------------------------------
  // 配置读写（子包环境 Tools.Files 实测：list(dir) / read(path) / write(path, content) / exists(path)）
  // ------------------------------------------------------------------
  async function _readFileText(path) {
    const F = _files();
    if (!F) throw new Error('Tools.Files 不可用');
    if (typeof F.read === 'function') {
      const v = await F.read(path);
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object') {
        if (typeof v.text === 'string') return v.text;
        if (typeof v.content === 'string') return v.content;
      }
      return String(v);
    }
    if (typeof F.readText === 'function') return F.readText(path);
    if (typeof F.readFile === 'function') return F.readFile(path);
    throw new Error('Tools.Files 无可用读方法 (read/readText/readFile)');
  }

  async function _writeFileText(path, content) {
    const F = _files();
    if (!F) throw new Error('Tools.Files 不可用');
    if (typeof F.write === 'function') return F.write(path, content, false);
    if (typeof F.writeText === 'function') return F.writeText(path, content);
    if (typeof F.writeFile === 'function') return F.writeFile(path, content);
    throw new Error('Tools.Files 无可用写方法 (write/writeText/writeFile)');
  }

  async function _listFiles(dir) {
    const F = _files();
    if (!F) throw new Error('Tools.Files 不可用');
    let entries = null;
    if (typeof F.list === 'function') {
      entries = await F.list(dir);
      // 官方用法需环境参数：Tools.Files.list(dir, "android")；单参返回空则再试双参
      if (isEmptyList(entries)) {
        try { entries = await F.list(dir, 'android'); } catch (e) { /* 保留单参结果 */ }
      }
    } else if (typeof F.listFiles === 'function') entries = await F.listFiles(dir);
    else if (typeof F.readdir === 'function') entries = await F.readdir(dir);
    else if (typeof F.listDir === 'function') entries = await F.listDir(dir);
    entries = unwrapList(entries);
    if (!Array.isArray(entries)) return [];
    return entries.map(function (e) {
      if (typeof e === 'string') {
        return { name: basename(e), path: joinPath(dir, e), mtime: null };
      }
      const name = (e && (e.name || e.path || e.file));
      if (name) {
        const mt = (e && (e.mtimeMs !== undefined ? e.mtimeMs : e.mtime));
        const nm = basename(String(name)); // 均取 basename（split(/[\/\\]/).pop()）
        return { name: nm, path: joinPath(dir, nm), mtime: mt !== undefined ? mt : null };
      }
      return null;
    }).filter(Boolean);
  }

  // F.list 返回值兼容：r.files / r.entries / r.data（数组） / 数组本身 / {list:[...]}
  function unwrapList(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      const keys = ['files', 'entries', 'data', 'list'];
      for (let i = 0; i < keys.length; i++) {
        if (Array.isArray(v[keys[i]])) return v[keys[i]];
      }
    }
    return v;
  }
  function isEmptyList(v) {
    if (v == null) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') {
      for (const k in v) return false;
      return true;
    }
    return String(v).trim() === '';
  }
  function basename(p) {
    const s = String(p == null ? '' : p);
    const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
    return i >= 0 ? s.slice(i + 1) : s;
  }

  async function _fileMtime(path) {
    const F = _files();
    if (F) {
      try {
        if (typeof F.stat === 'function') {
          const st = await F.stat(path);
          if (st && st.mtimeMs !== undefined) return st.mtimeMs;
          if (st && st.mtime !== undefined) {
            const t = new Date(st.mtime).getTime();
            if (!isNaN(t)) return t;
            return st.mtime;
          }
        }
      } catch (e) { /* 尝试 shell 兜底 */ }
    }
    // 子包环境 Tools.Files 无 stat -> 用系统 shell 取 mtime（epoch 秒）兜底
    try {
      if (_sys() && typeof _sys().shell === 'function') {
        const out = await _sys().shell('stat -c %Y ' + path);
        const n = Number(String(out == null ? '' : out).trim());
        if (isFinite(n) && n > 0) return n * 1000; // 秒 -> 毫秒
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  async function _fileExists(path) {
    const F = _files();
    if (!F) return false;
    // 2026-09-05 修复：F.exists 可能返回对象（如 {exists:false}），!!对象恒为 true →
    // 导致 fixedJ 的 send_active 标记"永远存在"、读屏永远让路（09:26 实测该 bug）。
    // 改法：1) 先直接读文件验证（能读到=存在，最可靠）；2) exists API 仅接受 true / {exists:true}。
    try { await _readFileText(path); return true; } catch (e) { /* 读不到，继续走 exists API */ }
    if (typeof F.exists === 'function') {
      try {
        const r = await F.exists(path);
        return !!(r === true || (r && typeof r === 'object' && r.exists === true));
      } catch (e) { return false; }
    }
    return false;
  }

  // 追加写文件（日志用）：append 优先，其次 write(path, content, true)
  async function _appendFileText(path, content) {
    const F = _files();
    if (!F) throw new Error('Tools.Files 不可用');
    if (typeof F.append === 'function') return F.append(path, content);
    if (typeof F.write === 'function') return F.write(path, content, true);
    if (typeof F.writeText === 'function') return F.writeText(path, content);
    throw new Error('Tools.Files 无可用追加方法');
  }

  // 删除文件（清理旧 result 用）：优先 Files 删除方法，兜底 shell rm
  async function _deleteFile(path) {
    const F = _files();
    if (F) {
      const methods = ['delete', 'remove', 'unlink', 'rm', 'deleteFile', 'removeFile'];
      for (let i = 0; i < methods.length; i++) {
        if (typeof F[methods[i]] === 'function') {
          try { return await F[methods[i]](path); } catch (e) { /* 尝试下一种 */ }
        }
      }
    }
    try {
      if (_sys() && typeof _sys().shell === 'function') {
        await _sys().shell('rm -f ' + path);
        return true;
      }
    } catch (e) { /* 忽略 */ }
    return false;
  }

  // 所有运行产生的文件统一放 cleanOnExit 目录；未定义则抛错，不回退到其他目录
  function cleanOnExitDir() {
    if (typeof OPERIT_CLEAN_ON_EXIT_DIR === 'undefined' || !OPERIT_CLEAN_ON_EXIT_DIR) {
      throw new Error('OPERIT_CLEAN_ON_EXIT_DIR 未定义，无法确定运行文件路径');
    }
    return String(OPERIT_CLEAN_ON_EXIT_DIR);
  }

  // 2026-09-05 今今指示：发送时读屏完全让路——文件级互斥标记（跨进程可靠）。
  // sky_send_text 执行期间写此标记；循环每轮读屏前检查，存在则整轮跳过（不读屏、不投递）。
  const SEND_ACTIVE_FLAG = (function () {
    try { return cleanOnExitDir() + '/sky_send_active.flag'; } catch (e) { return '/data/local/tmp/sky_send_active.flag'; }
  })();

  // 2026-09-05 修复：实例独占锁——sky_run 每次调用都可能启动新循环（含被平台"User cancelled"
  // 中断后仍启动的实例）；重复调用会多实例并发（09:25/09:26 双实例同时投递 → 重复刷屏）。
  // 启动前检查：有新鲜实例 → 请求旧实例退出并等待；旧实例僵死 → 拒绝启动（宁可不启不双跑）。
  const RUN_LOCK = (function () {
    try { return cleanOnExitDir() + '/sky_auto_run.lock'; } catch (e) { return '/data/local/tmp/sky_auto_run.lock'; }
  })();

  // ------------------------------------------------------------------
  // 读取/保存配置
  // ------------------------------------------------------------------
  // 允许配置里带 // 或 /* */ 注释及多余逗号（常见于手改的 JSONC 风格），先清洗再 JSON.parse。
  function sanitizeJsonText(text) {
    let s = String(text || '');
    s = s.replace(/^\uFEFF/, '');                 // BOM
    s = s.replace(/\/\*[\s\S]*?\*\//g, '');       // /* */ 块注释
    s = s.replace(/\/\/[^\r\n]*/g, '');           // // 行注释（含行尾）
    s = s.replace(/,\s*([}\]])/g, '$1');          // 去掉数组/对象多余的尾逗号
    return s;
  }
  async function readConfigRaw() {
    const t = sanitizeJsonText(await _readFileText(_configPath));
    return JSON.parse(t || '{}');
  }
  async function writeConfigRaw(obj) {
    await _writeFileText(_configPath, JSON.stringify(obj, null, 2));
  }
  // 历史遗留的无用字段（已被移除的配置项，如 offset_accept/level_timing）：
  // 加载与合并写入时剔除，保持配置干净、不残留。
  function stripStaleConfigKeys(raw) {
    if (raw && typeof raw === 'object') {
      delete raw['offset_accept'];
      delete raw['level_timing'];
    }
    return raw;
  }
  async function loadConfig() {
    let raw = {};
    try { raw = await readConfigRaw(); } catch (e) { raw = {}; }
    stripStaleConfigKeys(raw);
    const merged = deepMerge(defaultConfig(), raw);
    setCoordTransform(merged); // 校准值生效于后续所有 tap
    return merged;
  }

  // ------------------------------------------------------------------
  // 结果文件（SkyDetector 输出 result_*.txt）
  // ------------------------------------------------------------------
  function parseFileTime(name) {
    // result_YYYYMMDD_HHMMSS.txt：时间戳为 20260903_082042（8位+_+6位），不存在连续10位数字。
    // 去掉所有非数字后拼接为单调递增的序列（20260903_082042 -> 20260903082042），可直接比较。
    const digits = String(name == null ? '' : name).replace(/\D/g, '');
    return digits ? Number(digits) : null;
  }
  // 【fixedN】当前时刻转成 result_YYYYMMDD_HHMMSS.txt 文件名同格式数字（用于 minStamp 比较）
  function nowStampNum() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return Number('' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()));
  }
  function sortNewestFirst(entries) {
    return entries.slice().sort(function (a, b) {
      const am = (typeof a.mtime === 'number') ? a.mtime : parseFileTime(a.name);
      const bm = (typeof b.mtime === 'number') ? b.mtime : parseFileTime(b.name);
      if (am !== null && bm !== null) return bm - am;
      if (am !== null) return -1;
      if (bm !== null) return 1;
      return String(b.name).localeCompare(String(a.name));
    });
  }
  async function latestResultFile(dir) {
    const files = await _listFiles(dir);
    const results = files.filter(function (f) {
      return /^result_.*\.txt$/i.test(f.name);
    });
    if (!results.length) return null;
    const top = sortNewestFirst(results)[0];
    if (top.mtime === null || top.mtime === undefined) {
      const m = await _fileMtime(top.path);
      if (m !== null && m !== undefined) top.mtime = m;
    }
    return top;
  }
  async function readResult(dir) {
    const f = await latestResultFile(dir);
    if (!f) return null;
    const content = await _readFileText(f.path);
    return { file: f, content: content };
  }

  function hashStr(s) {
    let h = 5381;
    const str = String(s || '');
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
      h |= 0;
    }
    return String(h >>> 0);
  }
  function fingerprintOf(r) {
    if (!r) return null;
    const m = (typeof r.file.mtime === 'number' || typeof r.file.mtime === 'string')
      ? String(r.file.mtime) : '';
    return r.file.name + '|' + m + '|' + r.content.length + '|' + hashStr(r.content);
  }

  // ------------------------------------------------------------------
  // 解析 SkyDetector 结果："名称 中心(x,y) 置信度%"
  // ------------------------------------------------------------------
  function parseDetect(content) {
    const out = [];
    const lines = String(content || '').split(/\r?\n/);
    const RE = /^\s*(\S+)\s*中心\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*置信度\s*[:：]?\s*([\d.]+)\s*%\s*$/;
    const RE2 = /^\s*(\S+)\s*中心\s*\(\s*(\d+)\s*,\s*(\d+)\s*\).*?置信度\s*[:：]?\s*([\d.]+)\s*%/;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(RE) || line.match(RE2);
      if (m) {
        out.push({ name: m[1].trim(), x: Number(m[2]), y: Number(m[3]), conf: Number(m[4]) });
      }
    }
    return out;
  }
  // ------------------------------------------------------------------
  // 【2026-09-06 fixedM】动作名称归一化（口语 -> 标准名）
  // 背景：用户习惯叫法五花八门（拉手/抱抱/贴贴…），而 SkyDetector 图标名是标准名
  // （牵手/拥抱/碰拳…）；若不做映射，AI 传口语名会找不到图标。
  // 方案：内置常用别名表 + 配置 action_aliases 可扩展（UI「动作名称映射」里填，用户自定义优先）。
  // ------------------------------------------------------------------
  const ACTION_ALIASES = {
    '牵手': ['拉手', '手拉手', '牵小手', '牵着手', '牵手手', '牵个手', '拉个手', '牵我'],
    '拥抱': ['抱抱', '抱', '抱一抱', '抱一个', '拥抱一下', '抱一下', '抱抱我', 'hug'],
    '碰拳': ['碰个拳', '撞拳', '拳头碰拳头', '碰碰拳', '碰拳拳', 'fist bump'],
    '击掌': ['击个掌', '拍手', '拍拍手', '鼓掌', 'high five', 'highfive', 'give me five', '击掌击掌'],
    '握手': ['握个手', '握握手', '握手手', '握一下', 'handshake', 'hand shake'],
    '搭肩': ['搭肩膀', '搭个肩', '揽肩', '勾肩', '搂肩'],
    '谢幕礼': ['鞠躬', '谢幕', '行礼', '告别礼', '感谢礼', '谢幕鞠躬', 'bow'],
    '耳语': ['悄悄话', '说悄悄话', '咬耳朵', '说悄悄话吧', 'whisper'],
    '双人舞': ['跳舞', '双人跳舞', '二人舞', '一起跳舞', 'dance'],
    '双人旋转舞': ['转圈舞', '旋转舞', '转圈圈', '一起转圈', 'spinning dance'],
    '默契握手': ['默契击掌', '击掌默契', '默契握', '完美击掌', '默契拍手'],
    '打闹': ['嬉闹', '打打闹闹', '闹着玩', '玩闹', 'playful'],
    '熊抱': ['大拥抱', '紧紧抱', '熊抱抱', '大力拥抱', 'big hug'],
    '公主抱': ['抱起来', '横抱', '公主抱抱', '抱着你', '横着抱','公主抱我'],
    '背背': ['背', '背我', '背起来', '背一下', '背背乐', '背着你', 'piggyback'],
    '跟随': ['跟着', '跟着走', '跟着我', 'follow'],
    '摸摸头': ['摸头', '摸头头', '摸脑袋', '摸一下头', '摸摸', 'rua', 'pat'],
    '坐下': ['坐', '坐下来', '坐地上', '坐一下', '坐好', 'sit']
  };

  // 归一化：先精确（标准名/已注册别名），再包含（取命中里最长的已注册词，避免"抱抱"抢"公主抱"）。
  // 单字词（抱/背/坐）只参与精确匹配，不参与包含匹配（防"踩背"被误翻成"背背"）。
  // extra = 用户自定义映射（配置 action_aliases，UI 可填），优先于内置表。
  function normalizeActionName(name, extra) {
    const n = String(name == null ? '' : name).trim();
    if (!n) return n;
    const dict = {};
    Object.keys(ACTION_ALIASES).forEach(function (std) {
      dict[std] = std;
      (ACTION_ALIASES[std] || []).forEach(function (a) { dict[a] = std; });
    });
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function (k) {
        const v = String(extra[k] == null ? k : extra[k]).trim();
        const key = String(k).trim();
        if (key) { dict[key] = v || key; dict[v] = v || key; }
      });
    }
    // 1) 精确命中
    if (dict[n]) return dict[n];
    // 2) 包含命中：取命中最长的已注册词（对应标准名）；单字词跳过（避免误伤）
    let bestWord = '', bestStd = '';
    Object.keys(dict).forEach(function (w) {
      if (w.length < 2) return;
      if (n.indexOf(w) !== -1 || w.indexOf(n) !== -1) {
        if (w.length > bestWord.length) { bestWord = w; bestStd = dict[w]; }
      }
    });
    if (bestStd) return bestStd;
    return n;
  }

  function matchName(detName, req, extra) {
    const d = normalizeActionName(String(detName || '').trim(), extra);
    const r = normalizeActionName(String(req || '').trim(), extra);
    if (!r) return true;
    return d === r || d.indexOf(r) !== -1 || r.indexOf(d) !== -1;
  }

  // ------------------------------------------------------------------
  // 解析 UINode.getCurrentPage().toFormattedString() 的读屏文本（实测格式）
  // 元素 = ◢ + [类名] + (T:"文本" / D:"描述" / ID:id) + ⮞ + [x1,y1][x2,y2]
  // 例：◢ [TextView] T:"春分" ⮞ [1125,648][1208,703]
  // ------------------------------------------------------------------
  const RECT_RE = /\[(\d+)[,\s，,]+(\d+)\]\s*\[(\d+)[,\s，,]+(\d+)\]/;
  const TD_RE = /(T|D)\s*:\s*"([^"]*)"/;

  function extractNodes(formatted) {
    const nodes = [];
    const lines = String(formatted || '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // bounds（元素必有 ⮞ [x1,y1][x2,y2]）
      const rm = line.match(RECT_RE);
      if (!rm) continue;
      // 文本：T:"文本" / D:"描述"（ID:id 无引号文本，跳过）
      const tm = line.match(TD_RE);
      if (!tm) continue;
      const text = tm[2].trim();
      if (!text) continue;
      const x1 = Math.min(Number(rm[1]), Number(rm[3]));
      const x2 = Math.max(Number(rm[1]), Number(rm[3]));
      const y1 = Math.min(Number(rm[2]), Number(rm[4]));
      const y2 = Math.max(Number(rm[2]), Number(rm[4]));
      const cm = line.match(/\[([A-Za-z0-9._$]+)\]/);
      nodes.push({
        text: text,
        type: tm[1],                    // 'T' | 'D'
        className: cm ? cm[1] : '',
        left: x1, right: x2, top: y1, bottom: y2,
        cx: (x1 + x2) / 2, cy: (y1 + y2) / 2
      });
    }
    // 去重：同 text+bottom 只留一条
    const seen = {};
    const uniq = [];
    for (let i = 0; i < nodes.length; i++) {
      const key = nodes[i].text + '|' + nodes[i].bottom;
      if (seen[key]) continue;
      seen[key] = true;
      uniq.push(nodes[i]);
    }
    return uniq;
  }

  // 聊天专用文本节点：优先 T:"..."（聊天消息文本），否则退回全部带文本节点
  function pickChatTextNodes(nodes) {
    const withText = nodes.filter(function (n) { return n.text && n.text.trim(); });
    const tNodes = withText.filter(function (n) { return n.type === 'T'; });
    return tNodes.length ? tNodes : withText;
  }

  function deriveFullText(nodes) {
    const texts = nodes.map(function (n) { return n.text; }).filter(function (t) { return t && t.trim(); });
    return texts.join('\n');
  }

  // 无意义消息判定：
  // - trim 后仅含 [ . … 空格 ]（"……" "..." ".."）视为无意义
  // - 匹配聊天输入框占位符模式（"聊天……""聊天..."，含汉字"聊天"）也视为无意义
  //   （实测 EditText 占位文本恒为"聊天……"，否则会混入消息列表/误判占用）
  const CHAT_PLACEHOLDER_RE = /^聊天[\s.…]+$/;
  function isChatPlaceholder(text) {
    return CHAT_PLACEHOLDER_RE.test(String(text == null ? '' : text).trim());
  }
  function isMeaningfulText(text) {
    const t = String(text == null ? '' : text).trim();
    if (!t) return false;
    if (/^[.\s…]+$/.test(t)) return false;  // 纯 . …
    if (isChatPlaceholder(t)) return false; // 「聊天……」占位
    return true;
  }
  function filterMeaningful(messages) {
    return (messages || []).filter(function (m) { return isMeaningfulText(m); });
  }

  // ------------------------------------------------------------------
  // 聊天消息归属/过滤（双场景分治，全内存坐标运算，毫秒级）
  // ------------------------------------------------------------------
  function normalizeKnownNames(arr) {
    const seen = {};
    const out = [];
    const a = Array.isArray(arr) ? arr : [];
    for (let i = 0; i < a.length; i++) {
      const s = String(a[i] == null ? '' : a[i]).trim();
      if (s && !seen[s]) { seen[s] = true; out.push(s); }
    }
    return out;
  }
  // 取消息内容（去掉发送者前后缀）："名字：内容" -> 内容；"内容 - 名字" -> 内容
  function messageContent(text) {
    const t = String(text == null ? '' : text).trim();
    const c1 = t.indexOf('：');
    if (c1 > 0) return t.slice(c1 + 1).trim();
    const ci = t.lastIndexOf(' - ');
    if (ci > 0) return t.slice(0, ci).trim();
    return t;
  }
  // 统一读屏解析（不分模式，按聊天场景结构适配），只做归属与去重：
  // - 单人聊天气泡：名字标签在上方 + 中心对齐(≤30px) -> 「名字：内容」
  // - 多人聊天侧边栏：行尾备注「内容 名字」或「内容 - 名字」 -> 归属
  // 归属判断统一基于 known_names：白名单内 -> 投递「名字：内容」；白名单外/陌生人/无归属孤立文本 -> 忽略。
  // 去重：同一"名字：内容"只投一次（同 sender+content 不重复投递）。
  async function filterChatMessages(chatNodes, knownNames, sentList) {
    if (!knownNames.length) return [];
    const nameSet = {};
    for (let i = 0; i < knownNames.length; i++) nameSet[knownNames[i]] = true;
    const out = [];
    const seen = {};
    const addItem = async function (name, content) {
      let c = String(content == null ? '' : content).trim();
      if (!c) return;
      if (isSuspectTruncated(c) && !isSelfSent(c, sentList)) {
        const full = await ocrCached(c);
        if (full) c = full;
      }
      const msg = name + '：' + c;
      if (!seen[msg]) { seen[msg] = true; out.push(msg); }
    };
    // 单人聊天：名字标签 -> 下方 x 中心对齐(≤30px)气泡
    for (let i = 0; i < chatNodes.length; i++) {
      const label = chatNodes[i];
      const name = String(label.text || '').trim();
      if (!nameSet[name]) continue;
      let best = null, bestTop = Infinity;
      for (let j = 0; j < chatNodes.length; j++) {
        const n = chatNodes[j];
        if (n === label) continue;
        if (label.bottom > n.top) continue;
        if (Math.abs(label.cx - n.cx) > 30) continue;
        if (nameSet[String(n.text || '').trim()]) continue;
        if (n.top < bestTop) { bestTop = n.top; best = n; }
      }
      if (best) await addItem(name, String(best.text || '').trim());
    }
    // 多人聊天天窗：行尾备注「内容 名字」/「内容 - 名字」
    for (let i = 0; i < chatNodes.length; i++) {
      const line = String(chatNodes[i].text || '').trim();
      if (!line) continue;
      let name = '', content = '';
      const di = line.lastIndexOf(' - ');
      if (di > 0) { content = line.slice(0, di).trim(); name = line.slice(di + 3).trim(); }
      else {
        const sp = line.lastIndexOf(' ');
        if (sp > 0) { const tail = line.slice(sp + 1).trim(); if (nameSet[tail]) { name = tail; content = line.slice(0, sp).trim(); } }
      }
      if (nameSet[name]) await addItem(name, content);
    }
    return out;
  }

  // ------------------------------------------------------------------
  // 锚点：用于 active 打开动作栏。取聊天框最底消息(或对方名字)的 bounds
  // ------------------------------------------------------------------
  async function findAnchor() {
    const page = await _getPageInfo(); // 字符串：toFormattedString()
    const nodes = extractNodes(page);
    if (!nodes.length) return null;
    const pool = pickChatTextNodes(nodes);
    pool.sort(function (a, b) { return b.bottom - a.bottom; });
    const top = pool[0];
    return { cx: top.cx, bottom: top.bottom };
  }

  // ------------------------------------------------------------------
  // 键盘聚焦判断（纯脚本读屏判断，不烧 token）：
  // 出现 inputmethod/键盘类节点 => 视为输入框已聚焦
  // 【2026-09-05 晚修正】不再把"EditText 已有文本"当作聚焦依据——那可能是 Operit 浮窗/输入法
  // 自带输入框（光遇 Unity 输入框不是原生 EditText，读屏读不到）；误判会跳过弹键盘导致 setText 写错焦点。
  function _looksInputFocused(formatted) {
    const lines = String(formatted || '').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (/inputmethod|KeyView|KeyboardView|\bIME\b/i.test(lines[i])) return true;
    }
    return false;
  }
  // 已聚焦 -> 跳过弹键盘；未聚焦 -> 双击聊天框（间隔 1000ms）
  async function _ensureKeyboard(cfg) {
    const page = await _getPageInfo();
    if (_looksInputFocused(page)) return { skipped: true };
    const chatBox = coord(cfg, '聊天框双击');
    if (!chatBox) throw new Error('缺少坐标配置: 聊天框双击');
    await _tap(chatBox[0], chatBox[1]);
    await _sleep(1000);
    await _tap(chatBox[0], chatBox[1]);
    return { skipped: false };
  }

  // 轻量防碰撞：读屏看输入框是否已有内容（用户正在打字则不抢）。
  // 【修正】EditText 的 text trim 后仅供 . … 构成 -> 视为占位符，不算占用
  // （光遇键盘打开时输入框恒有此类占位，不排除会永远误判）；含其他字符（文字/emoji）才算占用。
  async function _inputBoxOccupied() {
    let page = null;
    try { page = await _getPageInfo(); } catch (e) { return false; }
    if (page === null) return false; // 读屏超时，保守不拦截
    const nodes = extractNodes(page);
    for (let i = 0; i < nodes.length; i++) {
      if (/EditText/i.test(nodes[i].className) && isMeaningfulText(nodes[i].text)) {
        return true; // 输入框已有非占位内容（文字/emoji）
      }
    }
    return false;
  }

  // 需求A：检测键盘/输入框(EditText)是否已打开（发送前用，不依赖 chatActive 记忆）
  // 【2026-09-05 晚增强】光遇输入框非原生 EditText；读屏能扫到的 EditText 可能是 Operit 浮窗/IME
  // 自带输入框。因此"已打开"判定放宽为：存在 EditText 节点 **或** 输入法键盘节点
  // （inputmethod/KeyView/KeyboardView/IME）——弹起验证时两者任一存在即算已打开。
  async function _inputBoxPresent() {
    let page = null;
    try { page = await _getPageInfo(); } catch (e) { return null; } // null=读屏超时，无法确认
    if (page === null) return null;
    const nodes = extractNodes(page);
    let hasEdit = false, hasIme = false;
    for (let i = 0; i < nodes.length; i++) {
      const cls = String(nodes[i].className || '');
      if (/EditText/i.test(cls)) hasEdit = true;
      else if (/inputmethod|KeyView|KeyboardView|\bIME\b/i.test(cls)) hasIme = true;
    }
    if (hasEdit || hasIme) return true;
    return false;
  }
  // 发送前确保聊天窗/键盘已打开：未打开则双击聊天框弹键盘（不依赖 chatActive）；
  // 弹不起来 -> 返回明确错误「聊天窗未打开」，禁止继续 setText 裸奔
  // 【2026-09-05 晚 今今+DeepSeek 审阅发现：设计盲区】光遇是 Unity 引擎，聊天输入框非原生
  // EditText——读屏扫到的 EditText 其实是 Operit 浮窗/输入法 IME 自带输入框；原逻辑"读到 EditText
  // 即认为键盘已打开→跳过弹键盘→setText 写入错误焦点→点发送键无效"。对策：发送前强制归零——
  // 先点退键盘（键盘没开也点击，无害），再无条件双击聊天框弹键盘，不依赖 EditText 判断。
  async function _ensureChatWindow(cfg) {
    const backKey = coord(cfg, '退键盘');
    if (backKey) { await _tap(backKey[0], backKey[1]); await _sleep(300); } // 归零（无害）
    const chatBox = coord(cfg, '聊天框双击');
    if (!chatBox) return { ok: false, error: '缺少坐标配置: 聊天框双击' };
    await _tap(chatBox[0], chatBox[1]);
    await _sleep(1000);
    await _tap(chatBox[0], chatBox[1]);
    await _sleep(1200); // 等键盘完全展开（仅本次弹起）
    const after = await _inputBoxPresent();
    if (after !== true) return { ok: false, error: '聊天窗未打开' };
    return { ok: true, popped: true };
  }
  // H 加固：互动/识别动画播放中(约1-2s)双击可能无效——先等1s再弹，失败重试1次；全程不抛错
  async function _popKeyboardAfterAction(cfg) {
    try { await _sleep(1000); } catch (e) { /* ignore */ }
    let ok = false;
    try { ok = !!(await _ensureChatWindow(cfg)).ok; } catch (e) { ok = false; }
    if (!ok) {
      try { await _sleep(1000); } catch (e) {}
      try { ok = !!(await _ensureChatWindow(cfg)).ok; } catch (e) { ok = false; }
    }
    return ok;
  }
  // 点击带指定字样的聊天气泡/对话框中心点（开多人 = "开启多人聊天"，关多人 = "关闭多人聊天"）
  async function _tapBubblePhrase(cfg, phrase) {
    try {
      const page = await _getPageInfo();
      const nodes = extractNodes(page);
      let target = null;
      for (let i = 0; i < nodes.length; i++) {
        if (String(nodes[i].text || '').indexOf(phrase) !== -1) { target = nodes[i]; break; }
      }
      if (target) {
        await _tap(target.cx, target.cy);
        await _sleep(600); // 等侧边栏展开/收起
        return { opened: true };
      }
      return { opened: false };
    } catch (e) {
      return { opened: false };
    }
  }
  // 开启多人聊天：点击"开启多人聊天"气泡打开侧边记录栏
  async function _openMultiSidebar(cfg) {
    return _tapBubblePhrase(cfg, '开启多人聊天');
  }
  // 关闭多人聊天（纯UI）：点击光翼图标下方100处（双击两下）收起侧边栏；完成后自动重新打开键盘
  async function _closeMultiSidebar(cfg) {
    const wing = coord(cfg, '光翼');
    if (wing) {
      const x = wing[0];
      const y = wing[1] + 100;
      for (let i = 0; i < 2; i++) {
        await _tap(x, y);
        await _sleep(150);
        await _tap(x, y);
        await _sleep(150);
      }
    }
    try { await _ensureChatWindow(cfg); } catch (e) { /* 重开键盘失败不影响 */ }
  }
  function splitText(text) {
    const MAX = 40;
    const s = String(text == null ? '' : text);
    if (s.length <= MAX) return [s];
    const parts = [];
    let start = 0;
    while (start < s.length) {
      const seg = s.slice(start, start + MAX);
      let cut = seg.length;
      // 从段尾往回找标点/空格断句
      for (let i = seg.length - 1; i >= 0; i--) {
        if (/[，。！？；、,.!?;:：\s]/.test(seg[i])) { cut = i + 1; break; }
      }
      if (cut <= 0) cut = seg.length;
      parts.push(s.slice(start, start + cut));
      start += cut;
    }
    return parts;
  }

  // ------------------------------------------------------------------
  // 等级 -> 按压方式（内建固定，不开放配置）
  // level 1 -> tap（单击）；level >=2 -> longPress(LEVEL_TIMING[level])
  // ------------------------------------------------------------------
  function resolveLevelPress(level) {
    let lv = null;
    try {
      const n = Number(level);
      if (isFinite(n) && String(level).trim() !== '') lv = n;
    } catch (e) { lv = null; }
    if (lv === null) {
      return { long: false, hold_ms: 0, level: null, method: 'tap', note: 'tap（未指定等级，默认单击）' };
    }
    if (lv <= 1) {
      return { long: false, hold_ms: 0, level: lv, method: 'tap', note: 'tap（等级1：单击）' };
    }
    const holdMs = (LEVEL_TIMING[lv] !== undefined) ? LEVEL_TIMING[lv] : LEVEL_TIMING[4];
    return {
      long: true,
      hold_ms: holdMs,
      level: lv,
      method: 'longPress',
      note: 'longPress（等级' + lv + '：按住 ' + holdMs + 'ms）'
    };
  }

  // ------------------------------------------------------------------
  // 工具实现
  // ------------------------------------------------------------------
  async function sky_set_config(params) {
    params = params || {};
    let configPath = params.config_path;
    let mergeFrom = params.config;
    if (mergeFrom === undefined) {
      // 允许直接传字段（兼容：把非控制键当作配置字段）
      const controlKeys = ['config_path'];
      const body = {};
      for (const k in params) {
        if (controlKeys.indexOf(k) === -1) body[k] = params[k];
      }
      mergeFrom = body;
    }
    if (configPath) _configPath = configPath;

    let existing = {};
    try { existing = await readConfigRaw(); } catch (e) { existing = {}; }
    stripStaleConfigKeys(existing);
    // 写入完整配置：默认结构 + 已有覆盖 + 本次参数；让配置文件自解释
    const base = deepMerge(defaultConfig(), existing);
    const merged = deepMerge(base, mergeFrom || {});
    await writeConfigRaw(merged);
    setCoordTransform(merged); // 写入后立即让校准值生效
    return {
      success: true,
      config_path: _configPath,
      merged_keys: Object.keys(merged),
      message: '已合并写入配置，字段数: ' + Object.keys(merged).length
    };
  }

  // ------------------------------------------------------------------
  // 聊天长消息截断 OCR 兜底 + 截图实际路径定位 + 翻页等待（best-effort）
  // ------------------------------------------------------------------
  // 疑似截断：以"..."结尾且长度≥15（光遇气泡文本只给前 N 字+"..."）
  function isSuspectTruncated(text) {
    const t = String(text == null ? '' : text).trim();
    if (t.length < 15) return false;
    return /(\.{3}|…{2,})$/.test(t);
  }
  const ocrCache = {}; // 同一条截断文本只 OCR 一次（成功替换 / 失败记为 null）
  async function ocrCached(truncated) {
    if (Object.prototype.hasOwnProperty.call(ocrCache, truncated)) return ocrCache[truncated] || null;
    const full = await _ocrChatMessage(truncated);
    ocrCache[truncated] = full || null;
    return full || null;
  }
  async function _ocrChatMessage(truncated) {
    try {
      const dir = cleanOnExitDir();
      const path = joinPath(dir, 'sky_ocr.png');
      let shot = null;
      if (typeof toolCall === 'function') shot = await toolCall('capture_screenshot', { path: path });
      else if (_ui() && typeof _ui().captureScreenshot === 'function') shot = await _ui().captureScreenshot({ path: path });
      if (typeof toolCall !== 'function') return null;
      const shotPath = pickShotPath(shot) || path;
      let rec = null;
      try { rec = await toolCall('read_file', { path: shotPath, environment: 'android', intent: '识别聊天消息文字' }); } catch (e) { /* 忽略 */ }
      const val = typeof rec === 'string' ? rec
        : (rec && (rec.content || rec.text || rec.description)) || '';
      const s = String(val || '').trim();
      if (!s) return null;
      // fixedU：识图模型有时不提取文字，而是输出"图片中的聊天消息文字是/如下…"式图片描述
      // （带 1|2| 编号、背景/气泡/输入法等画面细节）。这种输出不是消息原文，
      // 不能作为补全结果——保留读屏原文（宁可截断也不投递假内容）
      const descMark = /(图片中[的聊]|聊天消息文字[是如]|聊天气泡|视线可及|输入法底部|半透明深色提示框|气泡中)/;
      if (descMark.test(s)) return null;
      // OCR 结果若以截断前缀开头（去掉尾部 .../…）且更长 -> 视为补全成功
      const prefix = String(truncated).trim().replace(/\.{3,}/, '').replace(/…+$/, '');
      if (prefix && s.indexOf(prefix) === 0 && s.length > String(truncated).trim().length) return s;
      if (s.length > String(truncated).trim().length) return s;
      return null;
    } catch (e) { return null; }
  }

  // 从 capture_screenshot 结果里取真实输出路径（结果可能是字符串 / {path} / {file_path} / {file}）
  function pickShotPath(shot) {
    if (typeof shot === 'string' && shot.trim()) return shot.trim();
    if (shot && typeof shot === 'object') {
      if (shot.path) return String(shot.path);
      if (shot.file_path) return String(shot.file_path);
      if (shot.file) return String(shot.file);
    }
    return '';
  }
  // 在目录里定位最新截图（拿不到实际路径时兜底）
  async function _locateLatestShot(dir) {
    try {
      const files = await _listFiles(dir);
      const pngs = files.filter(function (f) { return /\.png$/i.test(f.name); });
      if (!pngs.length) return null;
      for (let i = 0; i < pngs.length; i++) {
        if (pngs[i].mtime == null) pngs[i].mtime = await _fileMtime(pngs[i].path);
      }
      pngs.sort(function (a, b) { return (b.mtime || 0) - (a.mtime || 0); });
      return joinPath(dir, pngs[0].name);
    } catch (e) { return null; }
  }

  // 翻页/accept 等待结果文件"新拍落地"的窗口（读配置 wait_result_ms，默认 12000）
  function waitResultMs(cfg) {
    const v = Number(cfg && cfg.wait_result_ms);
    return (isFinite(v) && v > 0) ? v : 12000;
  }

  // 翻页后等 SkyDetector 结果文件时间戳变化（识别周期约5s，超时上限）
  async function _waitResultChange(dir, prev, timeoutMs, minStamp) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const f = await latestResultFile(dir);
      const cur = (f && f.mtime != null) ? f.mtime : (f ? parseFileTime(f.name) : null);
      if (cur !== null && cur !== prev) {
        // 【fixedN】minStamp：要求新拍的「拍图时刻（文件名时间戳）」晚于本次 action 执行时刻，
        // 防止读入 action 执行之前拍的旧画面（SkyDetector 拍图-识别-写文件有延迟，mtime 变化≠拍图更晚）
        if (minStamp == null) return true;
        const nameStamp = f ? parseFileTime(f.name) : null;
        if (nameStamp != null && nameStamp > minStamp) return true;
      }
      await _sleep(300);
    }
    return false;
  }

  async function readChatScreen() {
    // 需求4：空屏天然自愈——读屏返回 null/空时重试 3 次（短间隔）；仍空则截图留档 + 返回 screen_timeout
    //         （screen_timeout 不会更新 last_seen，恢复后新消息仍会被识别，做到不丢消息；附截图路径便于复现定位）
    let page = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      page = await _getPageInfo();
      if (page !== null && String(page).trim() !== '') break;
      await _sleep(300);
    }
    if (page === null || String(page).trim() === '') {
      let shotPath = null;
      try {
        const dir = cleanOnExitDir();
        const p = joinPath(dir, 'sky_read_empty_' + Date.now() + '.png');
        if (typeof toolCall === 'function') { const s = await toolCall('capture_screenshot', { path: p }); shotPath = pickShotPath(s) || p; }
        else if (_ui() && typeof _ui().captureScreenshot === 'function') { const s = await _ui().captureScreenshot({ path: p }); shotPath = pickShotPath(s) || p; }
      } catch (e) { /* 截图失败不影响 */ }
      await _writeRunLog('[' + nowStamp() + '] 读屏空(重试3次仍空)，截图留档: ' + (shotPath || 'na') + ' —— 用于复现定位读屏桥间歇失读');
      return { success: false, latest_message: '', full_text: '', screen_timeout: true, message_count: 0, messages: [], raw_messages: [], empty_shot: shotPath };
    }
    const nodes = extractNodes(page);
    // 有意义/带坐标的聊天文本节点（保留 bounds 用于名字-气泡配对；按 Y 从下到上=新→旧）
    const chatNodes = pickChatTextNodes(nodes).sort(function (a, b) { return b.bottom - a.bottom; })
      .filter(function (n) { return isMeaningfulText(n.text); });
    const cfg = await loadConfig();
    const knownNames = normalizeKnownNames(cfg.known_names);
    const sentList = await getSentMessages();
    // 统一读屏解析（不分模式）：按单人气泡/多人侧边栏结构适配 -> 归属 + 去重
    const list = await filterChatMessages(chatNodes, knownNames, sentList);
    // 去重（同一名字：内容 只投一次）
    const seen = {};
    const uniq = [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (seen[list[i]]) continue;
      seen[list[i]] = true;
      uniq.unshift(list[i]); // 保持 新→旧
    }
    const sorted = uniq; // 已按 chatNodes 顺序（新→旧），此处保持相对顺序即可
    // 原始有意义文本列表（不做归属过滤，供控制词"开启/关闭多人聊天、停止光遇流程"检测）
    const rawList = filterMeaningful(chatNodes.map(function (n) { return n.text; }));
    const latest = sorted.length ? sorted[0] : '';
    const full_text = deriveFullText(nodes);
    // 类型判断（是否要回复/互动）交给 AI，这里只负责读
    return {
      success: sorted.length > 0,
      latest_message: latest,
      full_text: full_text,
      message_count: sorted.length,
      messages: sorted,
      raw_messages: rawList
    };
  }

  async function sky_read_chat(params) {
    params = params || {};
    if (!acquireBusy('read')) {
      return { success: false, busy: 'read', error: '其它类别正在操作（互斥），请稍后再试' };
    }
    try {
      return await readChatScreen();
    } finally {
      releaseBusy();
    }
  }

  async function sky_send_text(params) {
    params = params || {};
    const text = (params.text != null) ? String(params.text) : '';
    if (!text) return { success: false, error: '缺少参数 text' };
    if (!(await acquireBusyRetry('send', 20))) {
      return { success: false, busy: 'send', error: '其它类别正在操作（互斥），请稍后再试' };
    }
    // 2026-09-05 今今指示：发送期间置文件标记，循环读屏看到即整轮让路（发送时读屏完全让路）
    try { await _writeFileText(SEND_ACTIVE_FLAG, String(Date.now())); } catch (e) { /* 忽略 */ }
    try {
      // 【修复2026-09-05 08:19】投递收尾避让：距最近投递 <6s 先等，防撞投递收尾期（Step error）
      await waitForDeliveryTail();
      const cfg = await loadConfig();
      const sendKey = coord(cfg, '发送键');
      if (!sendKey) return { success: false, error: '缺少坐标配置: 发送键' };

      // 四、轻量防碰撞：输入框已有内容（用户正在打字）则不抢
      if (await _inputBoxOccupied()) {
        return { success: false, busy: 'user_typing', message: '输入框占用' };
      }

      // 需求A：发送前确保聊天窗/键盘已打开（读屏检测，不依赖 chatActive 记忆）
      // 未打开 -> 双击聊天框弹键盘；弹不起来 -> 返回明确错误「聊天窗未打开」，禁止 setText 裸奔
      const win = await _ensureChatWindow(cfg);
      if (!win.ok) {
        return { success: false, error: win.error };
      }
      await setChatActive(true); // 兼容保留状态位（sky_stop 时仍重置）
      const keyboardMode = win.popped ? 'double_tapped' : 'already_open';

      // 三、长文本自动分段：>40 字按每段 ≤40 字切分（优先标点/空格断句）
      const segments = splitText(text);
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        await _setText(seg);
        await _sleep(500);
        await _tap(sendKey[0], sendKey[1]);
        await addSentMessage(seg);
        if (i < segments.length - 1) {
          await _sleep(1000); // 段与段之间间隔约1秒
        }
      }

      // 方案Q：占槽工具成功 -> 刷任务信号（last_signal_at），供完成判定兜底
      await signalTaskDone();
      return { success: true, text: text, segments_count: segments.length, keyboard: keyboardMode };
    } catch (e) {
      return { success: false, error: _fmt(e) };
    } finally {
      releaseBusy();
      try { await _deleteFile(SEND_ACTIVE_FLAG); } catch (e) { /* 忽略 */ }
    }
  }

  // --- active 分支：退键盘 -> 锚点 -> 开栏 -> 自动翻页 -> 点击/长按 ---
  async function actionActive(iconName, cfg, params) {
    // 1. 退键盘（互动铁律：无条件必退；退键盘坐标是必填配置，缺失直接失败）
    const backKey = coord(cfg, '退键盘');
    if (!backKey) {
      return { success: false, phase: 'backkey', error: '缺少退键盘坐标（必填）' };
    }
    // 【fixedN】退键盘改双击（确定性动作）：第一下点退键，间隔后再补一下，确保键盘真退掉
    await _tap(backKey[0], backKey[1]);
    await _sleep(600);
    await _tap(backKey[0], backKey[1]);
    await _sleep(300);
    await _writeRunLog('互动-退键盘 ok(双击)'); // 缺陷1：逐段日志定位中断

    // 2-3. 读屏找锚点，算出 (X, Y)
    const anchor = await findAnchor();
    if (!anchor) {
      return { success: false, phase: 'anchor', error: '未找到锚点（聊天框最底消息/对方名字）' };
    }
    await _writeRunLog('互动-锚点 ok');
    const offsetActive = (cfg && cfg.offset_active != null) ? Number(cfg.offset_active) : 300;
    const X = anchor.cx;
    const Y = anchor.bottom + offsetActive;

    // 4. 点出动作栏
    await _tap(X, Y);
    await _sleep(600);
    await _writeRunLog('互动-开栏 ok');

    // 5. 自动翻页循环：最多 max_flip 次
    const maxFlip = (cfg && cfg.max_flip != null) ? Number(cfg.max_flip) : 4;
    const flip = flipCoord(cfg);
    const dir = (cfg && cfg.sky_result_dir) || DEFAULT_RESULT_DIR;

    let found = null;
    let flipsDone = 0;
    for (let i = 0; i < maxFlip; i++) {
      // 【fixedX·今今方案（2026-09-06）】每页固定等 8 秒再检测（识别反馈稳定 + 新拍图落地）；
      // 未命中才翻页；翻页后不额外等拍图（下一轮 8 秒等待已覆盖新拍图落地）
      await _sleep(8000); // 等当前页识别反馈稳定（≥8s）
      const det = await readDetect({ name: iconName }); // 互斥由 sky_action 持有
      if (det.success && det.count) {
        found = det.icons[0];
        break;
      }
      if (i < maxFlip - 1) {
        if (!flip) {
          return { success: false, phase: 'flip', error: 'flip 未配置，无法翻页' };
        }
        await _swipe(flip.sx, flip.sy, flip.ex, flip.ey);
        flipsDone++;
      }
    }

    if (!found) {
      return { success: false, phase: 'detect', error: '未找到该图标: ' + iconName };
    }
    await _writeRunLog('互动-找到图标 ' + iconName);

    // 6. 点击/长按：等级时长内建固定（level 1=input tap 单击；2/3/4=同坐标 input swipe 长按 holdMs）
    const press = resolveLevelPress(params.level);
    if (press.long) {
      await _longPress(found.x, found.y, press.hold_ms);
    } else {
      await _tap(found.x, found.y);
    }
    await _writeRunLog('互动-点击完成');

    return {
      success: true,
      action: 'active',
      icon_name: iconName,
      anchor: { x: anchor.cx, y: anchor.bottom },
      opened_at: { x: X, y: Y },
      flips_done: flipsDone,
      icon: { name: found.name, x: found.x, y: found.y },
      press: press
    };
  }

  // --- accept 分支：互动铁律先退键盘；不开动作栏，用检测结果直接 tap ---
  async function actionAccept(iconName, cfg, params) {
    // 0. 被动也要先退键盘（否则图标可能点在键盘上，点不准）
    const backKey = coord(cfg, '退键盘');
    if (!backKey) {
      return { success: false, phase: 'backkey', error: '缺少退键盘坐标（必填）' };
    }
    // 【fixedN】退键盘改双击（确定性动作）：第一下点退键，间隔后再补一下，确保键盘真退掉
    await _tap(backKey[0], backKey[1]);
    await _sleep(600);
    await _tap(backKey[0], backKey[1]);
    await _sleep(300);
    await _writeRunLog('互动-退键盘 ok(双击)'); // 缺陷1：逐段日志定位中断

    // J：被动请求等"新一拍落地"再识别（SkyDetector 约5s/拍，按5s拍速设计，上限约7s）；
    // 否则读到的是旧画面（动作栏按钮常被误当请求、真请求3s后才落地），宁可不点。
    const dir = (cfg && cfg.sky_result_dir) || DEFAULT_RESULT_DIR;
    const before = await latestResultFile(dir);
    const prev = (before && before.mtime != null) ? before.mtime : (before ? parseFileTime(before.name) : null);
    // 【fixedN】minStamp=退键盘完成时刻：只认「拍图时刻晚于此刻」的新拍，确保读到的截图是退键盘后拍的
    const minStamp = nowStampNum();
    const updated = await _waitResultChange(dir, prev, waitResultMs(cfg), minStamp);
    if (!updated) {
      await _writeRunLog('互动-accept 超时未检出');
      return { success: false, phase: 'detect', error: 'SkyDetector 结果文件超时未更新（约 7 秒无新拍），已取消点击' };
    }

    const det = await readDetect({ name: iconName }); // 互斥由 sky_action 持有
    if (!det.success || !det.count) {
      await _writeRunLog('互动-accept 未检出图标 ' + iconName);
      return { success: false, phase: 'detect', error: '未找到该图标(被动): ' + iconName };
    }
    const target = det.icons[0];
    await _tap(target.x, target.y);
    await _writeRunLog('互动-点击完成');
    return {
      success: true,
      action: 'accept',
      icon_name: iconName,
      tapped: { x: target.x, y: target.y }
    };
  }

  async function sky_action(params) {
    params = params || {};
    const type = String(params.type || '').toLowerCase();
    if (params.icon_name == null) return { success: false, error: '缺少参数 icon_name' };
    if (!(await acquireBusyRetry('action', 2))) {
      return { success: false, busy: 'action', error: '其它类别正在操作（互斥），请稍后再试' };
    }
    try {
      // 【修复2026-09-05 08:19】投递收尾避让：距最近投递 <6s 先等，防撞投递收尾期（Step error）
      await waitForDeliveryTail();
      const cfg = await loadConfig();
      // 【fixedM】动作名归一化：口语（拉手/抱抱…）-> 标准名（牵手/拥抱…）；用户自定义映射优先
      const iconName = normalizeActionName(String(params.icon_name), (cfg && cfg.action_aliases) || {});
      let res;
      if (type === 'active') res = await actionActive(iconName, cfg, params);
      else if (type === 'accept') res = await actionAccept(iconName, cfg, params);
      else return { success: false, error: 'type 必须为 active 或 accept，收到: ' + type };
      // H：互动成功后自动弹键盘（先等动画1s+失败重试1次；弹键失败只记日志，不影响互动结果返回）
      if (res && res.success === true) {
        // 【fixedO】记录刚完成的互动，供 pollAction 8s 窗口内过滤同图标残留帧
        _lastInteraction = { name: iconName, doneAt: Date.now() };
        try { await _popKeyboardAfterAction(cfg); } catch (e) { /* 忽略，不影响返回值 */ }
      }
      // 【fixedQ 2026-09-06】成功失败都刷信号：失败同样代表工具槽已释放，
      // 避免 AI 忘调 sky_task_done 后循环只能干等静默兜底；配合 task_quiet_ms 5000->1000 更快放行
      try { await signalTaskDone(); } catch (e) { /* 忽略，不影响返回值 */ }
      return res;
    } catch (e) {
      // 【fixedQ】异常路径同样刷信号，保证任务不被卡住
      try { await signalTaskDone(); } catch (e2) { /* 忽略 */ }
      return { success: false, error: _fmt(e) };
    } finally {
      releaseBusy();
    }
  }

  async function readDetect(params) {
    params = params || {};
    const cfg = await loadConfig();
    const dir = (cfg && cfg.sky_result_dir) || DEFAULT_RESULT_DIR;
    try {
      const r = await readResult(dir);
      if (!r) {
        return { success: false, count: 0, icons: [], message: '未找到 result_*.txt（' + dir + '）' };
      }
      let icons = parseDetect(r.content);
      // 【fixedM】名称过滤：双方先归一化再匹配（口语/标准名互通；用户自定义映射优先）
      const aliasExtra = (cfg && cfg.action_aliases) || {};
      if (params.name) {
        icons = icons.filter(function (ic) { return matchName(ic.name, params.name, aliasExtra); });
      }
      if (icons.length) {
        icons.sort(function (a, b) { return b.conf - a.conf; });
      }
      return {
        success: true,
        count: icons.length,
        icons: icons,
        source_file: r.file.name,
        source: r.content
      };
    } catch (e) {
      return { success: false, count: 0, icons: [], error: _fmt(e) };
    }
  }

  async function sky_detect(params) {
    params = params || {};
    if (!acquireBusy('detect')) {
      return { success: false, busy: 'detect', error: '其它类别正在操作（互斥）' };
    }
    try {
      return await readDetect(params);
    } finally {
      releaseBusy();
    }
  }

  // ------------------------------------------------------------------
  // 轮询状态记忆：只存"最新一条"，覆盖写；模块变量 + 状态文件双保险
  // ------------------------------------------------------------------
  const state = { chat: '', action: '' };
  let stateCache = null;

  function statePath() {
    return joinPath(cleanOnExitDir(), 'sky_auto_last_seen.json');
  }

  async function loadStateFile() {
    if (stateCache) return;
    stateCache = {};
    const path = statePath(); // cleanOnExit 缺失时在此抛错（不回退到其它目录）
    try {
      const t = await _readFileText(path);
      const o = JSON.parse(t || '{}');
      stateCache = (o && typeof o === 'object') ? o : {};
    } catch (e) {
      stateCache = {};
    }
  }
  async function saveStateFile() {
    const path = statePath();
    try { await _writeFileText(path, JSON.stringify(stateCache)); } catch (e) { /* 忽略 */ }
  }
  async function getLastSeen(key) {
    await loadStateFile();
    return stateCache[key] || '';
  }
  async function setLastSeen(key, val) {
    await loadStateFile();
    stateCache[key] = String(val || '');
    state[key] = stateCache[key];
    await saveStateFile();
  }

  // ------------------------------------------------------------------
  // 自己发送消息的记录（防自触发：AI 回复会出现在读屏列表里，需排除）
  // 存最近 20 条（sent_messages，覆盖写 JSON 数组）
  // ------------------------------------------------------------------
  const SENT_MAX = 20;
  async function getSentMessages() {
    await loadStateFile();
    const raw = stateCache['sent_messages'];
    if (!raw) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  async function addSentMessage(text) {
    await loadStateFile();
    const arr = await getSentMessages();
    arr.push(String(text));
    const trimmed = arr.slice(-SENT_MAX);
    stateCache['sent_messages'] = JSON.stringify(trimmed);
    state['sent_messages'] = stateCache['sent_messages'];
    await saveStateFile();
  }
  // 聊天区可能截断显示（如"都触发..."），去掉尾部 .… 再比较；
  // 匹配=相等，或较短者是较长者的前缀（处理截断）
  function stripTrailingEllipsis(s) {
    return String(s == null ? '' : s).replace(/[.…]+$/, '').trim();
  }
  function isSelfSentMatch(text, sent) {
    const a = stripTrailingEllipsis(text);
    const b = stripTrailingEllipsis(sent);
    if (!a || !b) return false;
    if (a === b) return true;
    const shorter = (a.length < b.length) ? a : b;
    const longer = (a.length < b.length) ? b : a;
    return longer.indexOf(shorter) === 0; // 较短者是较长者的前缀
  }
  function isSelfSent(text, sentList) {
    for (let i = 0; i < sentList.length; i++) {
      if (isSelfSentMatch(text, sentList[i])) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------
  // 键盘激活状态记忆（chatActive）：首次弹键盘，之后不弹。
  // 实测 toFormattedString() 输出里没有 inputmethod/KeyView/EditText 类名，
  // 屏幕聚焦判断永远 false，故改用持久化布尔标志控制。
  // ------------------------------------------------------------------
  async function getChatActive() {
    await loadStateFile();
    return stateCache['chatActive'] === true;
  }
  async function setChatActive(val) {
    await loadStateFile();
    stateCache['chatActive'] = !!val;
    state['chatActive'] = !!val;
    await saveStateFile();
  }

  async function pollChat(cfg) {
    const read = await readChatScreen(); // 互斥由调用方（sky_run 循环/上层）持有
    if (read.success === false && read.screen_timeout) {
      // 读屏超时：本轮跳过，不改 last_seen、不投递
      return { success: false, screen_timeout: true, changed: false, new_texts: [], detail: { current: '', previous: '', list: [], previous_list: [] } };
    }
    // 当前有意义消息列表（新→旧）
    const currentList = read.messages || [];
    // 上次记录的有意义列表（JSON 数组）
    let previousList = [];
    const prevRaw = await getLastSeen('chat');
    if (prevRaw) {
      try { const v = JSON.parse(prevRaw); previousList = Array.isArray(v) ? v : []; } catch (e) { previousList = []; }
    }
    // 集合对比：出现上一轮没有的新文本 -> changed=true；并排除自己发送的消息（防自触发）
    const prevSet = {};
    for (let i = 0; i < previousList.length; i++) prevSet[previousList[i]] = true;
    const sentList = await getSentMessages();
    const newTexts = [];
    for (let i = 0; i < currentList.length; i++) {
      if (!prevSet[currentList[i]] && isMeaningfulText(currentList[i])) {
        // 自触发排除：比对"消息内容"（去掉发送者前后缀：daily"名字：内容"/multi"内容 - 名字"）
        if (!isSelfSent(messageContent(currentList[i]), sentList)) newTexts.push(currentList[i]);
      }
    }
    const changed = newTexts.length > 0;
    // 每轮把当前有意义列表整体写入 last_seen（不再是"最新一条"）
    await setLastSeen('chat', JSON.stringify(currentList));
    // 控制词检测：只检测【本轮新增】的原始消息（原始行与归属后的「名字：内容」格式不同，
    // 故单独用 raw 基线对比，避免聊天窗残留的旧控制词如「停止光遇流程」每轮命中导致误停/误切换）
    const rawList = read.raw_messages || [];
    let prevRawList = [];
    const prevRawRaw = await getLastSeen('raw');
    if (prevRawRaw) {
      try { const v = JSON.parse(prevRawRaw); prevRawList = Array.isArray(v) ? v : []; } catch (e) { prevRawList = []; }
    }
    const prevRawSet = {};
    for (let i = 0; i < prevRawList.length; i++) prevRawSet[prevRawList[i]] = true;
    const control = { stop: false, open_multi: false, close_multi: false };
    for (let i = 0; i < rawList.length; i++) {
      if (prevRawSet[rawList[i]]) continue; // 上轮已见：跳过（残留控制词不再触发）
      const r = rawList[i];
      if (!control.stop && r.indexOf('停止光遇流程') !== -1) control.stop = true;
      if (!control.open_multi && r.indexOf('开启多人聊天') !== -1) control.open_multi = true;
      if (!control.close_multi && r.indexOf('关闭多人聊天') !== -1) control.close_multi = true;
    }
    // 记录本轮原始列表为基线（下轮对比用）
    await setLastSeen('raw', JSON.stringify(rawList));
    return {
      success: true,
      changed: changed,
      new_texts: newTexts,
      control: control,
      detail: {
        current: currentList[0] || '',
        previous: previousList[0] || '',
        list: currentList,
        previous_list: previousList
      }
    };
  }

  async function pollAction(cfg) {
    const dir = (cfg && cfg.sky_result_dir) || DEFAULT_RESULT_DIR;
    await _cleanupOldResults(dir); // 顺带清理超过 60s 的旧 result 文件
    const r = await readResult(dir);
    if (!r) {
      return { success: true, changed: false, detail: { file: null, content_len: 0, icons: [], new_icons: [], names: [] } };
    }
    // 结果文件时间戳：mtime 或文件名时间；早于启动时间则视为旧结果，跳过（防重启用旧文件假变化）
    let fileTime = (r.file.mtime != null) ? r.file.mtime : parseFileTime(r.file.name);
    if (_actionStartTime != null && fileTime !== null && fileTime < _actionStartTime) {
      return { success: true, changed: false, detail: { file: r.file.name, content_len: r.content.length, icons: [], new_icons: [], names: [], skipped: 'old-result' } };
    }
    const icons = parseDetect(r.content).map(function (ic) { return { name: ic.name, x: ic.x, y: ic.y, conf: ic.conf }; });
    // 图标名集合签名（用于"同图标不重复推送"）
    const sig = icons.map(function (ic) { return ic.name; }).sort().join('｜');
    const prevRaw = await getLastSeen('action');
    let prevSig = '';
    if (prevRaw) { try { const o = JSON.parse(prevRaw); prevSig = (o && o.sig) || ''; } catch (e) { prevSig = ''; } }
    const prevSet = {};
    if (prevSig) { prevSig.split('｜').forEach(function (n) { prevSet[n] = true; }); }
    // 新图标 = 不在上次集合 & 不在冷却期内（同图标 N 拍内不重复推）
    const now = Date.now();
    const newIcons = [];
    const aliasExtra = (cfg && cfg.action_aliases) || {}; // 【fixedO】归一化对比用
    for (let i = 0; i < icons.length; i++) {
      const ic = icons[i];
      if (prevSet[ic.name]) continue; // 上次已有 -> 非新
      const lastPush = _pushedIcons[ic.name] || 0;
      if (now - lastPush < _iconDedupWindowMs) continue; // 冷却期同图标不重复推
      // 【fixedO】互动残留抑制：刚完成的互动图标名，20s 窗口内再检出（动画残留帧）不投递
      if (_lastInteraction && _lastInteraction.name && (now - _lastInteraction.doneAt) < 20000) {
        const normIc = normalizeActionName(ic.name, aliasExtra);
        if (normIc === _lastInteraction.name) {
          await _writeRunLog('互动残留抑制：检出 ' + ic.name + '（' + _lastInteraction.name + ' 完成 ' + (now - _lastInteraction.doneAt) + 'ms 内，动画残留帧）');
          continue;
        }
      }
      newIcons.push(ic);
    }
    const changed = newIcons.length > 0;
    for (let i = 0; i < newIcons.length; i++) _pushedIcons[newIcons[i].name] = now; // 记录推送时间
    // 每轮记录当前图标集签名 + 文件标记（覆盖写）
    await setLastSeen('action', JSON.stringify({ sig: sig, file: r.file.name, fileTime: fileTime }));
    return {
      success: true,
      changed: changed,
      detail: {
        fingerprint: sig,
        file: r.file.name,
        content_len: r.content.length,
        file_time: fileTime,
        names: icons.map(function (ic) { return ic.name; }),
        icons: icons,
        new_icons: newIcons
      }
    };
  }

  async function sky_poll(params) {
    params = params || {};
    const mode = String(params.mode || '').toLowerCase();
    try {
      const cfg = await loadConfig();
      if (mode === 'chat') return await pollChat(cfg);
      if (mode === 'action') return await pollAction(cfg);
      return { success: false, changed: false, error: 'mode 必须为 chat 或 action' };
    } catch (e) {
      return { success: false, changed: false, error: _fmt(e) };
    }
  }

  // ------------------------------------------------------------------
  // sky_look：被动环境识别——直接截图（不做前台/悬浮窗前置检查，路径放 cleanOnExit 自动清理）
  // 截图后必须 read_file(intent=识别画面内容) 识图，才能判断"我们在哪"
  // ------------------------------------------------------------------
  async function sky_look(params) {
    params = params || {};
    if (!acquireBusy('look')) {
      return { success: false, busy: 'look', error: '其它类别正在操作（互斥）' };
    }
    try {
      // 【修复2026-09-05 08:19】投递收尾避让：距最近投递 <6s 先等，防撞投递收尾期（Step error）
      await waitForDeliveryTail();
      // 统一放 cleanOnExit（自动清理）；显式传 dir 时按显式目录
      const dir = (params.dir != null) ? String(params.dir) : cleanOnExitDir();
      const filePath = joinPath(dir, 'sky_env.png'); // 固定路径，自动清理目录
      // 三、截图前先退键盘（互动铁律，键盘打开拍的全是字母键无法识环境）；坐标缺失跳过不报错
      const cfg = await loadConfig();
      const backKey = coord(cfg, '退键盘');
      if (backKey) { await _tap(backKey[0], backKey[1]); await _sleep(300); }
      // 截图
      let shot = null;
      if (typeof toolCall === 'function') {
        shot = await toolCall('capture_screenshot', { path: filePath });
      } else if (_ui() && typeof _ui().captureScreenshot === 'function') {
        shot = await _ui().captureScreenshot({ path: filePath });
      } else {
        throw new Error('无可用截图方式：toolCall(' + "'capture_screenshot'" + ') / Tools.UI.captureScreenshot');
      }
      // 二、识图用截图实际返回的真实路径（截图工具可能按自身命名输出如 7668.png）；
      //    拿不到则在 cleanOnExit 目录定位最新截图，保证 recognition 有结果
      let shotPath = pickShotPath(shot);
      if (!shotPath) shotPath = await _locateLatestShot(dir) || filePath;
      let recognition = null;
      if (typeof toolCall === 'function') {
        try {
          recognition = await toolCall('read_file', {
            path: shotPath,
            environment: 'android',
            intent: '识别画面内容'
          });
        } catch (e) { /* read_file 失败不影响截图结果 */ }
      }
      // I：顺带返回最近一波图标坐标（置信度 ≥50% 才收录；无则 detect_note）
      let icons = [];
      let detect_note = null;
      try {
        const det = await readDetect({});
        if (det.success && det.icons && det.icons.length) {
          icons = det.icons.filter(function (ic) { return Number(ic.conf) >= 50; });
        }
        if (!icons.length) detect_note = '未检测到图标';
      } catch (e) { detect_note = '未检测到图标'; }
      // H：识别完成后自动弹键盘（先等动画1s+失败重试1次；失败只记日志，不影响返回）
      try { await _popKeyboardAfterAction(cfg); } catch (e) { /* 忽略 */ }
      // 方案Q：占槽工具成功 -> 刷任务信号（last_signal_at），供完成判定兜底
      await signalTaskDone();
      return {
        success: true,
        file_path: filePath,
        shot_path: shotPath,
        mode: 'passive',
        capture_result: shot,
        recognition: recognition,
        icons: icons,
        detect_note: detect_note
      };
    } catch (e) {
      return { success: false, error: _fmt(e) };
    } finally {
      releaseBusy();
    }
  }

  // 常驻循环（单消息框内跑完）：sky_run / sky_stop / 唤醒 AI
  // 启动协议：循环占用当前对话处理通道，必须先经用户手动点击红色 X 释放；
  // 脚本不自动点 X、不用 start_chat_service 绕过——X 是用户手动操作。
  const GUIDE_MESSAGE = '请先点击 Operit 对话界面右下角的红色 X（取消/关闭按钮），释放当前对话占用，之后才会开始自动轮询。\n' +
    '【启动前请知悉】\n' +
    '① 息屏/关机都能停止：设备息屏（锁屏/灭屏）或关机时，脚本流程自动停止（息屏后屏幕内容不可见、无障碍读屏失效；关机为进程终止）。如需继续请重新启动流程。运行期间请保持屏幕常亮/游戏前台。\n' +
    '② 停止方法：在光遇聊天框输入「停止光遇流程」，脚本识别后立即停止；否则脚本一直运行（直到息屏/关机/手动停止）。\n' +
    '③ 开启/关闭多人聊天：输入「开启多人聊天」（脚本点击该聊天气泡打开侧边栏）或「关闭多人聊天」（脚本点击光翼图标下方 100 处双击两下收起侧边栏，完成后自动重新打开键盘）。\n' +
    '④ 调用工具时请勿点 X：调用 sky_send_text / sky_action / sky_look / sky_home 期间请勿手动点击取消/关闭按钮，避免执行通道被中断。\n' +
    '⑤ 声明：本流程仅使用系统无障碍服务与 ADB 权限，并不涉及光遇包内部内容，不是光遇外挂，仅用于 AI 在光遇中的聊天陪伴；使用该流程默认承担一切风险，造成的财产损失请自负责任。';
  let _running = false;
  let busy = false;
  let busyKind = '';
  // 三大类并列软互斥：聊天（轮询/发送/读聊）、互动（action/home）、截图识屏（look/detect）。
  // 任一类执行时置 busy；其它类检测到 busy -> 轮询跳过本轮 / 工具返回 {success:false, busy:'xxx'}。非阻塞等待。
  function acquireBusy(kind) {
    if (busy) return false;
    busy = true;
    busyKind = kind || '';
    return true;
  }
  function releaseBusy() { busy = false; busyKind = ''; }
  // 需求3：busy 获取失败时短暂重试（缓解"循环运行期间外部工具被拒/串行冲突"），最多 tryCount 次、每次间隔约 300ms
  async function acquireBusyRetry(kind, tryCount) {
    const tries = (tryCount > 0) ? tryCount : 2;
    for (let i = 0; i < tries; i++) {
      if (acquireBusy(kind)) return true;
      await _sleep(300);
    }
    return false;
  }
  // action 推送去重：同图标 N 拍内不重复推送；记录启动时间防重启用旧文件假触发
  let _actionStartTime = null;
  let _pushedIcons = {};
  const _iconDedupWindowMs = 30000;
  // 【fixedO】互动残留抑制：记录刚完成的互动（标准名+完成时刻），pollAction 8s 窗口内同图标不再投递（动画残留帧误检）
  let _lastInteraction = null;
  let _lastScreenCheck = 0; // 息屏检测节流

  // 需求1：检测屏幕亮灭（dumpsys power 的 mWakefulness）。息屏/灭屏 -> 脚本自动停止（无法靠光遇指令控制）
  async function _isScreenOn() {
    try {
      const out = await _shell('dumpsys power');
      // fixedT：Tools.System.shell 返回对象 {output, exitCode}，String(out) 会变 [object Object] 导致正则永远匹配不到（息屏检测长期失效）
      const str = (out && typeof out === 'object' && out.output != null)
        ? String(out.output) : String(out || '');
      const m = str.match(/mWakefulness\s*=\s*(\w+)/);
      if (!m) return true; // 查询不到 -> 默认亮屏，不误停
      return String(m[1]).toLowerCase() === 'awake';
    } catch (e) {
      return true; // 查询失败默认亮屏，不误停
    }
  }

  // ------------------------------------------------------------------
  // 运行日志 & 自动清理
  // ------------------------------------------------------------------
  function nowStamp() {
    const d = new Date();
    const p = function (n) { return (n < 10 ? '0' : '') + n; };
    let ms = String(d.getMilliseconds());
    ms = ('00' + ms).slice(-3);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.' + ms;
  }
  function runLogPath() { return joinPath(cleanOnExitDir(), 'sky_auto_run.log'); }
  async function _writeRunLog(line) {
    try {
      const path = runLogPath();
      // 日志超过 60s 未更新则清空重新开始写；否则追加
      const mt = await _fileMtime(path);
      if (mt !== null && (Date.now() - mt) > 60000) {
        await _writeFileText(path, '');
      }
      await _appendFileText(path, line + '\n');
    } catch (e) { /* 日志失败不影响循环 */ }
  }
  // 清理 sky_result_dir 下修改时间超过 60s 的旧 result_*.txt，只保留最近的
  async function _cleanupOldResults(dir) {
    try {
      const files = await _listFiles(dir);
      const now = Date.now();
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!/^result_.*\.txt$/i.test(f.name)) continue;
        let mt = (typeof f.mtime === 'number') ? f.mtime : null;
        if (mt === null) mt = await _fileMtime(f.path);
        if (mt !== null && (now - mt) > 60000) {
          await _deleteFile(f.path);
        }
      }
    } catch (e) { /* 忽略 */ }
  }

  function stopFlagPath() {
    return joinPath(cleanOnExitDir(), 'sky_auto_stop.flag');
  }
  async function _writeStopFlag(val) {
    const path = stopFlagPath(); // cleanOnExit 缺失时抛错，不回退
    try { await _writeFileText(path, String(val == null ? '1' : val)); } catch (e) { /* 忽略 */ }
  }
  async function _stopRequested() {
    if (!_running) return true;
    const path = stopFlagPath(); // cleanOnExit 缺失时抛错，不回退
    try { return (await _readFileText(path)).trim() === '1'; } catch (e) { return false; }
  }

  // ------------------------------------------------------------------
  // 方案Q：投递-回复任务队列串行化（一次只做一件事，投递与 AI 动作永不重叠）
  // 任务 = 一批投递 + AI 对该批的全部处理（游戏内回复/互动/识别环境/回遇境等）。
  // 同一时刻只有一个活动任务；投递、AI 动作、循环 UI 指令三者时间上严格不重叠。
  // 状态落盘 sky_task.json（cleanOnExit，随目录清理）；待投递队列为内存数组。
  // ------------------------------------------------------------------
  function taskPath() { return joinPath(cleanOnExitDir(), 'sky_task.json'); }

  async function readTask() {
    try {
      const raw = await _readFileText(taskPath());
      const o = JSON.parse(String(raw == null ? '' : raw) || 'null');
      return (o && typeof o === 'object') ? o : { active: false };
    } catch (e) {
      return { active: false };
    }
  }

  // 原子写：先写临时文件再覆盖目标（避免读到半写状态；单线程顺序执行竞态概率极低）
  async function writeTask(task) {
    try {
      const p = taskPath();
      await _writeFileText(p + '.tmp', JSON.stringify(task));
      await _writeFileText(p, JSON.stringify(task));
    } catch (e) { /* 任务状态写失败不影响主流程 */ }
  }

  // 生成任务ID：YYYYMMDD_HHMM_SS
  function genTaskId() {
    const d = new Date();
    const p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' +
      p(d.getHours()) + p(d.getMinutes()) + '_' + p(d.getSeconds());
  }

  // 占槽工具成功时刷信号（无活动任务则忽略）：更新 last_signal_at
  async function signalTaskDone() {
    const t = await readTask();
    if (t && t.active) {
      t.last_signal_at = Date.now();
      await writeTask(t);
    }
  }

  // 【修复2026-09-05 08:19】投递收尾避让：
  // fire-and-forget 只让 JS 不等待，平台侧的 send_message_to_ai 调用照样执行并将持工具槽，
  // 槽在"投递结束（含收尾）"前一直占用——AI 收到消息立即调 send 就会撞上被拒（Step error）。
  // 本函数：若距最近一次投递 <6s，内部等待到 6s 再放行（真实完成槽释放通常 <6s），一次成功零重试。
  // 依据：delivered_at 记录在 sky_task.json 中（clearTask 时保留字段）。
  async function waitForDeliveryTail() {
    try {
      const t = await readTask();
      const dv = (t && t.delivered_at) ? Number(t.delivered_at) : 0;
      if (!dv) return;
      const since = Date.now() - dv;
      if (since >= 0 && since < 6000) {
        await _sleep(6000 - since);
      }
    } catch (e) { /* 等待失败不阻断主流程 */ }
  }

  // AI 显式声明任务完成（sky_task_done）：写 done_at + 刷 signal
  async function completeTaskExplicit() {
    const t = await readTask();
    if (t && t.active) {
      // 【修复2026-09-05 08:19】防迟到 done 误标新任务：
      // 上一任务的 done 可能迟于"静默完成→新任务投递"到达——若新任务刚投递(<3s)且尚无任何信号，
      // 大概率是迟到的旧声明，忽略之，避免新任务被秒判完成
      if (!t.last_signal_at && (Date.now() - t.started_at) < 3000) {
        return { success: true, message: '任务声明已忽略（疑似上一任务迟到信号）' };
      }
      t.done_at = Date.now();
      t.last_signal_at = Date.now();
      await writeTask(t);
    }
    return { success: true, message: '任务已完成' };
  }

  // 清除任务（停止 / 重启基线兜底）——保留 delivered_at 供投递收尾避让使用
  async function clearTask() {
    const t = await readTask();
    await writeTask({ active: false, delivered_at: (t && t.delivered_at) || 0 });
  }

  // 待投递队列 & 待执行 UI 指令（内存数组，重启即清；启动基线兜底现有消息不算新增，无丢失风险）
  let pendingDeliveries = [];
  let pendingUiActions = [];
  function makeDelivery(kind, content) {
    return { kind: kind, content: String(content), created_at: Date.now() };
  }

  // 投递一批（fire-and-forget 发起；槽占用避让由 waitForDeliveryTail 统一处理）：
  // 活动任务进行中则不投，返回 false；投递后写 task.json(active=true) 并记录 delivered_at
  async function deliverIfIdle(cfg) {
    const t = await readTask();
    if (t && t.active) return false;
    if (!pendingDeliveries.length) return false;
    const item = pendingDeliveries.shift();
    await wakeAi(item.content); // fire-and-forget：JS 不等待；平台侧调用仍会持槽至结束（含收尾），由 send/action/look/home 的 waitForDeliveryTail 避让
    await writeTask({
      active: true,
      task_id: genTaskId(),
      task_kind: item.kind,
      content: item.content,
      started_at: Date.now(),
      last_signal_at: 0,
      delivered_at: Date.now(),
      redelivered: false
    });
    await _writeRunLog('[' + nowStamp() + '] 方案Q 投递任务(' + item.kind + ') #' + item.content.slice(0, 24) + '…');
    return true;
  }

  // 活动任务完成判定（先到先生效）：显式完成 / 5s 静默 / 10s 无信号重投递一次 / 30s 超时强制完成
  // 返回 true 表示任务已结束（active 已清除），可放行下一批
  async function checkTaskComplete(cfg) {
    const t = await readTask();
    if (!t || !t.active) return false;
    const now = Date.now();
    const quietMs = (cfg && cfg.task_quiet_ms != null) ? Number(cfg.task_quiet_ms) : 1000;
    const timeoutMs = (cfg && cfg.task_timeout_ms != null) ? Number(cfg.task_timeout_ms) : 30000;
    // 1. 显式完成（sky_task_done）
    if (t.done_at && t.done_at >= t.started_at) {
      await clearTask();
      await _writeRunLog('[' + nowStamp() + '] 方案Q 任务显式完成（sky_task_done）');
      return true;
    }
    // 2. 静默完成：最后动作信号后 quietMs 无新信号
    if (t.last_signal_at && (now - t.last_signal_at) > quietMs) {
      await clearTask();
      await _writeRunLog('[' + nowStamp() + '] 方案Q 任务静默完成（最后信号 ' + quietMs + 'ms 无新信号）');
      return true;
    }
    // 【修复2026-09-05 08:19】删除"10s 无信号自动重投递"分支：
    // 误判"AI 正在响应但被收尾期挡住"为"投递丢失"→ 重投递又占槽 → 恶性循环（实测 7-9s 发不出）。
    // 投递失败兜底改为 wakeAi 内部 catch（异步记录），不因"无信号"重投。
    // 3. 超时强制完成（AI 未回/忘调也不卡队列）
    if ((now - t.started_at) > timeoutMs) {
      await clearTask();
      await _writeRunLog('[' + nowStamp() + '] 方案Q 任务超时强制完成（' + timeoutMs + 'ms）');
      return true;
    }
    return false;
  }

  // sky_task_done：AI 声明本轮任务全部动作已完成（投递模板强制要求调用）
  async function sky_task_done() {
    try {
      return await completeTaskExplicit();
    } catch (e) {
      return { success: false, error: _fmt(e) };
    }
  }

  // 唤醒 AI：toolCall('send_message_to_ai', ...)（系统工具；不写死 chat_id / 不用 getChatId；参数蛇形）
  // BUG-A 后 wakeAi 采用 fire-and-forget（发出即释放工具槽）；是否收到/何时处理由方案Q 任务队列兜底。
  // K：聊天新消息投递附带的引导——先调 sky_send_text 在游戏内回复用户（通用，无特定人名）
  // 方案Q 2.4：投递模板附加强制指令——做完本批全部动作后调 sky_task_done 显式声明完成
  const THINK_GUIDANCE = '（简短思考，快速回复。铁律：收到用户的游戏内消息，先判断消息内容——若是互动动作请求（用户要求接受/发起动作），必须先调用 sky_action 执行接受/发起动作，动作完成后再判断是否需要 sky_send_text 回复信息；若是纯聊天消息，则直接 sky_send_text 回复用户（无需等待，投递后直接调用，不会被拦截），再向 Operit 侧同步。最后调用 sky_task_done 释放任务。动作优先，不得先回复信息再执行动作。）';
  // （缺陷3已改为中性推送文案，ACTION_GUIDANCE 不再使用）
  async function wakeAi(message) {
    if (typeof toolCall !== 'function') {
      throw new Error('toolCall 不存在，无法用 send_message_to_ai 唤醒 AI');
    }
    // BUG-A 修复：发起投递后不等待返回（fire-and-forget）。send_message_to_ai 平台调用不因 JS 超时取消，
    // 若一直 Promise.race 等 15s 会占着工具执行槽，导致循环运行期间 send/action 全被 Step error 拒。
    // 发出即释放工具槽；AI 是否收到/何时处理由方案Q 任务队列兜底（10s 无信号自动重投递一次）。
    try {
      const callP = toolCall('send_message_to_ai', {
        message: String(message),
        hide_user_message: true,
        persist_turn: true,
        notify_reply: false // 实验（2026-09-05 08:56）：notify_reply=true 疑似投递后等待 AI 回复才结束调用 → 占槽；改为 false 试投递立即结束、通道立即释放
      }).then(function () { return { timedOut: false }; });
      callP.catch(function () { /* 后台投递失败静默：由循环日志/后续观察兜底 */ });
    } catch (e) { /* 同步抛错也静默，交给方案Q 重投递兜底 */ }
    return { timedOut: false }; // 不再等待：立即释放工具槽与 busy
  }
  // 需求5：唤醒瞬间持 busy（短暂标记，避免与 send/action 执行时间重叠产生 Step error；wakeAi 为 fire-and-forget，busy 立即释放）
  async function wakeAiHeld(message) {
    const held = acquireBusy('wake');
    try {
      return await wakeAi(message);
    } finally {
      if (held) releaseBusy();
    }
  }

  async function sky_run(params) {
    params = params || {};
    // 启动协议：不带 confirm_x（未确认点 X）只返回引导语，不启动循环、不占用对话
    if (params.confirm_x !== true) {
      return {
        success: false,
        need_guide: true,
        guide_message: GUIDE_MESSAGE,
        message: '请先把上面引导语展示给用户，等用户确认已点 X（取消/关闭）后，再调用 sky_run({ confirm_x: true }) 启动常驻循环。'
      };
    }
    const cfg = await loadConfig();
    let interval = Number(params.poll_interval_ms != null ? params.poll_interval_ms : cfg.poll_interval_ms);
    if (!isFinite(interval) || interval <= 0) interval = 2000;
    _running = true;
    await _writeStopFlag('0'); // 启动先清停止标记
    await setChatActive(false); // 启动时重置键盘激活状态（首次弹，之后不弹）
    // （聊天归属无模式概念，统一读屏解析；开启/关闭多人聊天为纯UI指令动作）
    // action 去重初始化：记录启动时间、清同名推送缓存，并把 last_seen.action 对齐到当前最新结果
    _actionStartTime = Date.now();
    _pushedIcons = {};
    try {
      const dir = (cfg && cfg.sky_result_dir) || DEFAULT_RESULT_DIR;
      const r = await readResult(dir);
      const icons = (r && r.content) ? parseDetect(r.content).map(function (ic) { return ic.name; }) : [];
      const sig = icons.sort().join('｜');
      await setLastSeen('action', JSON.stringify({
        sig: sig,
        file: r ? r.file.name : '',
        fileTime: (r && r.file.mtime != null) ? r.file.mtime : (r ? parseFileTime(r.file.name) : null)
      }));
    } catch (e) { /* 无结果文件时忽略，交给首轮 pollAction */ }
    // 【BUG-C 修复】启动基线对齐：先读一次屏写入 last_seen，聊天窗现有消息（含残留旧控制词）不算"新增"，
    // 防止首轮误投递/误触发「停止光遇流程」等控制词
    try {
      const bs = await pollChat(cfg);
      if (bs && bs.success !== false) {
        await setLastSeen('chat', JSON.stringify(bs.detail.list || []));
        await _writeRunLog('[' + nowStamp() + '] 启动基线对齐 | 现有消息数: ' + ((bs.detail.list || []).length) + ' | 控制词忽略（本轮不投递）');
      }
    } catch (e) { /* 基线失败不阻断启动，交给首轮 */ }
    // 【方案Q】启动基线兜底：若上次异常残留 active=true 任务，直接清除（防残留卡死队列）
    try {
      const rt = await readTask();
      if (rt && rt.active) {
        await clearTask();
        await _writeRunLog('[' + nowStamp() + '] 启动基线兜底 | 清除残留活动任务 ' + (rt.task_id || '') + ' | 重新开始');
      }
    } catch (e) { /* 忽略 */ }
    // 【实例独占锁】2026-09-05：防多实例并发（User cancelled 后仍会启动新循环）
    {
      let ls = null;
      try { ls = await _fileMtime(RUN_LOCK); } catch (e) { ls = null; }
      if (ls !== null && (Date.now() - ls) < 30000) {
        await _writeRunLog('[' + nowStamp() + '] 检测到已有运行实例（run.lock），请求旧实例退出…');
        await _writeStopFlag('1');
        let waited = 0;
        while (waited < 10000) {
          await _sleep(500); waited += 500;
          let still = null;
          try { still = await _fileMtime(RUN_LOCK); } catch (e) { still = null; }
          if (still === null) break;
        }
        let still2 = null;
        try { still2 = await _fileMtime(RUN_LOCK); } catch (e) { still2 = null; }
        if (still2 !== null) {
          // 10s 后旧实例仍未释放锁：判定僵死（平台取消进程时 finally 不执行），强制清锁继续启动
          try { await _deleteFile(RUN_LOCK); } catch (e) { /* 忽略 */ }
          await _writeRunLog('[' + nowStamp() + '] 旧实例未释放锁（疑似僵死），强制清锁继续启动');
        }
        await _writeRunLog('[' + nowStamp() + '] 旧实例已退出，继续本次启动');
      } else if (ls !== null) {
        // 陈旧锁（>30s）：判定为死锁残留，清掉继续
        try { await _deleteFile(RUN_LOCK); } catch (e) { /* 忽略 */ }
      }
      try { await _writeFileText(RUN_LOCK, String(Date.now())); } catch (e) { /* 锁写失败不阻断 */ }
    }
    let rounds = 0;
    let timesFed = 0;
    let emptyReadCount = 0; // 需求2：读屏连续空计数（自检诊断）
    // 消息波次合并投递：攒批次，超 2s 无新消息或满 8 条才投递（今今 2026-09-05：2秒内消息整合成一个包）
    const BATCH_MAX = 8, BATCH_QUIET_MS = 2000, BATCH_FLUSH_DELAY_MS = 300;
    // 2026-09-05 今今实测：光遇消息气泡动画导致同一消息标点变化（测试123 / 测试123. / 测试123...），
    // 读屏每次变化都当新消息 → 反复投递。归一化去重：去尾部空格/点/省略号后相同视为同一条。
    function normForDedup(t) { return String(t).replace(/[\s.…]+$/, '').trim(); }
    const deliveredNorm = []; // 最近已投递的归一化文本（≥20条修剪）
    function pushBatchDeliver() {
      if (chatBatch.length === 0) return;
      pendingDeliveries.push(makeDelivery('chat', '[光遇自动化] 聊天新消息：' + chatBatch.join(' / ') + THINK_GUIDANCE));
      for (let i = 0; i < chatBatch.length; i++) {
        const n = normForDedup(chatBatch[i]);
        if (n && deliveredNorm.indexOf(n) === -1) deliveredNorm.push(n);
      }
      if (deliveredNorm.length > 20) deliveredNorm.splice(0, deliveredNorm.length - 20);
      chatBatch = [];
      lastNewAt = Date.now();
    }
    let chatBatch = [];
    let lastNewAt = Date.now();
    try {
      while (_running && !(await _stopRequested())) {
        rounds++;
        // 需求1：息屏自动停止（每 2s 查一次屏幕状态；息屏后用户无法在光遇发指令，脚本必须自停）
        {
          const nowT = Date.now();
          if (nowT - _lastScreenCheck > 2000) {
            _lastScreenCheck = nowT;
            if (!(await _isScreenOn())) {
              await _writeStopFlag('1');
              await _writeRunLog('[' + nowStamp() + '] Round #' + rounds + ' | 息屏自动停止（屏幕已灭，无法再读屏/无法靠光遇指令停止）');
              _running = false;
              break;
            }
          }
        }
        // 2026-09-05 今今指示：发送时读屏完全让路——检测 send 活跃标记，存在则本轮跳过（不读屏、不投递）
        try {
          if (await _fileExists(SEND_ACTIVE_FLAG)) {
            if (rounds % 10 === 0) { await _writeRunLog('[' + nowStamp() + '] Round #' + rounds + ' | 发送互斥：读屏让路（sky_send_active标记存在）'); }
            if (!_running) break;
            await _sleep(interval);
            continue;
          }
        } catch (e) { /* 标记检查失败忽略 */ }
        // 五、三大类并列软互斥：任一类别（发送/互动/截图）占用时本轮跳过读屏与投递
        if (!acquireBusy('poll')) {
          await _writeRunLog('[' + nowStamp() + '] Round #' + rounds + ' | 读屏互斥跳过');
          if (!_running) break;
          await _sleep(interval);
          continue;
        }
        let chatChanged = false, chatCurrent = '', chatPrevious = '', fed = false;
        let actChanged = false;
        let screenTimeout = false, readMs = 0;
        let chatR = null, actR = null;
        const t0 = Date.now();
        try {
          // chat：读屏对比上次（含 5s 读屏超时保护）
          chatR = await pollChat(cfg);
          readMs = Date.now() - t0;
          chatChanged = !!chatR.changed;
          chatCurrent = chatR.detail.current || '';
          chatPrevious = chatR.detail.previous || '';
          screenTimeout = !!chatR.screen_timeout;
          // 控制词从"原始列表"检测（不受模式配对影响/不依赖 chatChanged）；
          // 方案Q 2.5：循环 UI 指令动作（开/关多人聊天）也占槽——活动任务进行中不执行，入队等待；
          // 无活动任务则立即执行（纯UI），完成后保持任务状态不被扰动
          if (!screenTimeout && chatR && chatR.control && chatR.control.open_multi) {
            const tk = await readTask();
            if (tk && tk.active) {
              pendingUiActions.push({ action: 'open_multi' });
              await _writeRunLog('[' + nowStamp() + '] Round #' + rounds + ' | 开启多人聊天 指令入队（活动任务进行中，待放行）');
            } else {
              await _openMultiSidebar(cfg);
              await signalTaskDone();
            }
          }
          // 「关闭多人聊天」= 点击光翼下方100处（双击两下）收起侧边栏 + 完成后自动重新打开键盘
          if (!screenTimeout && chatR && chatR.control && chatR.control.close_multi) {
            const tk = await readTask();
            if (tk && tk.active) {
              pendingUiActions.push({ action: 'close_multi' });
              await _writeRunLog('[' + nowStamp() + '] Round #' + rounds + ' | 关闭多人聊天 指令入队（活动任务进行中，待放行）');
            } else {
              await _closeMultiSidebar(cfg);
              await signalTaskDone();
            }
          }
          // 控制词不当作正常聊天消息投递（若本轮只剩控制词，则不投递）
          if (chatR && chatR.new_texts && chatR.new_texts.length) {
            chatR.new_texts = chatR.new_texts.filter(function (t) {
              return t.indexOf('停止光遇流程') === -1 && t.indexOf('开启多人聊天') === -1 && t.indexOf('关闭多人聊天') === -1;
            });
            chatChanged = chatR.new_texts.length > 0;
          }
          if (!screenTimeout) {
            // action：读 SkyDetector 结果文件时间戳/内容
            actR = await pollAction(cfg);
            actChanged = !!actR.changed;
          }
        } catch (e) { /* 单轮失败忽略，继续轮询；读屏失败可跳过 */ }
        finally { releaseBusy(); } // 读取完成即释放互斥；投递唤醒期间让 AI 的后续工具能拿 busy

        // 需求2：读屏连续空（current="" 且未超时）自检诊断——疑似读屏桥间歇失效，输出可诊断日志
        if (!screenTimeout && chatChanged === false && chatCurrent === '') {
          emptyReadCount++;
        } else {
          emptyReadCount = 0;
        }
        if (emptyReadCount >= 3) {
          await _writeRunLog('[' + nowStamp() + '] Round #' + rounds + ' | 读屏连续空 ' + emptyReadCount + ' 轮（current=\"\"），疑似 UINode 读屏桥短暂失效/返回空页面，请确认无障碍/悬浮窗并检查；避免用户消息静默丢失。');
          emptyReadCount = 0; // 每个连续段只记一次
        }

        let stopSeen = false, wakeTimedOut = false;
        // 停止词：不依赖 chatChanged（multi 下无后缀停止词会令 mode 列表为空），直接按 control.stop 判
        if (!screenTimeout && chatR && chatR.control && chatR.control.stop) {
          stopSeen = true;
          // 方案Q：停止时清空待投递队列/UI 队列/批次 + 清除活动任务，防残留卡死
          pendingDeliveries = [];
          pendingUiActions = [];
          chatBatch = [];
          await clearTask();
          const w = await wakeAiHeld('[光遇自动化] 已收到停止指令，循环已终止');
          wakeTimedOut = !!w.timedOut;
        } else if (chatChanged && !screenTimeout && chatR) {
          // 新增消息合并入批次（波次规则：满 8 条立即打包入队并另起新批次，不丢消息）
          const newTexts = chatR.new_texts || [];
          for (let i = 0; i < newTexts.length; i++) {
            const nt = chatR.new_texts[i];
            const nk = normForDedup(nt);
            if (!nk) continue; // 空文本跳过
            // 归一化去重：与批次内已有或最近已投递的相同（忽略尾标点变化）→ 跳过，防气泡动画反复投递
            let dup = false;
            for (let j = 0; j < chatBatch.length; j++) { if (normForDedup(chatBatch[j]) === nk) { dup = true; break; } }
            if (!dup && deliveredNorm.indexOf(nk) !== -1) dup = true;
            if (dup) continue;
            chatBatch.push(nt);
            lastNewAt = Date.now();
            if (chatBatch.length >= BATCH_MAX) {
              pushBatchDeliver();
            }
          }
        }
        // 批次结束：距最后一条新消息 >2s 且批次非空 -> 缓冲停 0.3s 再入队（防漏掉连发消息）
        if (!stopSeen && chatBatch.length > 0 && (Date.now() - lastNewAt) >= BATCH_QUIET_MS) {
          await _sleep(BATCH_FLUSH_DELAY_MS);
          pushBatchDeliver();
        }
        if (!stopSeen && actChanged && actR) {
          // 缺陷3修复：中性推送，带置信度，标注"疑似动作栏状态/低置信"，不默认"用户发起的动作"
          const newIcons = (actR.detail && actR.detail.new_icons) || [];
          const shown = newIcons.length ? newIcons : ((actR.detail.icons || []).slice(0, 3));
          const allIcons = (actR.detail.icons) || [];
          const parts = shown.map(function (ic) { return ic.name + '（' + ic.conf + '%）'; });
          const tag = [];
          if (allIcons.length >= 2) tag.push('疑似动作栏状态');
          if (allIcons.some(function (ic) { return Number(ic.conf) < 50; })) tag.push('低置信');
          const msg = '[光遇自动化] 检出可交互图标：' + parts.join('、') +
            (tag.length ? '（' + tag.join('，') + '）' : '') +
            '——请 AI 判断是否为用户发起，是则回应，否则忽略。（动作优先：直接调用 sky_action 执行接受/发起动作（无需等待，若被平台拦截则稍等重试，重试基本必成功），动作完成后才判断是否需要回复聊天信息，最后调用 sky_task_done 释放任务；不得先发信息再动作。置信度规则：判断用户发起时置信度 ≥50% 才接受，<50% 忽略；动作栏状态（多图标同现）视为未发起，忽略。用户聊天明确要求接受动作（accept 指令）时，无论置信度多少都接受。）';
          pendingDeliveries.push(makeDelivery('action', msg));
        }
        // 方案Q：放行调度——先做活动任务完成判定（显式/静默/超时/重投递）；
        // 任务已结束后，优先执行积压的循环 UI 指令动作，其次投递下一批（一次只放行一个，批间串行）
        await checkTaskComplete(cfg);
        if (!stopSeen) {
          const tk = await readTask();
          if (!(tk && tk.active)) {
            if (pendingUiActions.length) {
              const act = pendingUiActions.shift();
              if (act.action === 'open_multi') await _openMultiSidebar(cfg);
              else if (act.action === 'close_multi') await _closeMultiSidebar(cfg);
              await signalTaskDone();
            } else if (pendingDeliveries.length) {
              const did = await deliverIfIdle(cfg);
              if (did) { timesFed++; fed = true; }
            }
          }
        }
        // 每轮写运行日志（追加；>60s 未更新自动清空；附读屏耗时/超时/唤醒超时标记）
        await _writeRunLog('[' + nowStamp() + '] Round #' + rounds +
          ' | Chat: changed=' + chatChanged + ', current="' + chatCurrent + '", previous="' + chatPrevious + '"' +
          ' | Action: changed=' + actChanged + ' | Fed: ' + (fed ? 'yes' : 'no') +
          ' | 读屏耗时: ' + readMs + 'ms' +
          (screenTimeout ? ' | 读屏超时' : '') +
          (wakeTimedOut ? ' | 唤醒超时' : ''));
        if (stopSeen) break;
        if (!_running) break;
        await _sleep(interval);
      }
    } finally {
      _running = false;
      try { await _deleteFile(RUN_LOCK); } catch (e) { /* 忽略 */ }
    }
    return {
      success: true,
      stopped: true,
      rounds: rounds,
      times_fed: timesFed,
      message: '光遇自动化循环已停止'
    };
  }

  async function sky_stop() {
    _running = false;
    await _writeStopFlag('1');
    try { await _deleteFile(RUN_LOCK); } catch (e) { /* 忽略 */ }
    await setChatActive(false); // 停止时重置键盘激活状态
    // 方案Q：停止时清空待投递/UI 队列 + 清除活动任务，防残留卡死
    pendingDeliveries = [];
    pendingUiActions = [];
    await clearTask();
    return { success: true, stopped: true, message: '已停止光遇自动化循环' };
  }

  // ------------------------------------------------------------------
  // sky_home：回遇境快流程——退键盘 → 光翼 → 回遇境按钮 → 回遇境确认
  // ------------------------------------------------------------------
  async function sky_home(params) {
    params = params || {};
    if (!acquireBusy('home')) {
      return { success: false, busy: 'home', error: '其它类别正在操作（互斥）' };
    }
    try {
      // 【修复2026-09-05 08:19】投递收尾避让：距最近投递 <6s 先等，防撞投递收尾期（Step error）
      await waitForDeliveryTail();
      const cfg = await loadConfig();
      const backKey = coord(cfg, '退键盘');
      const wing = coord(cfg, '光翼');
      const homeBtn = coord(cfg, '回遇境按钮');
      const homeOk = coord(cfg, '回遇境确认');
      const missing = [];
      if (!backKey) missing.push('退键盘');
      if (!wing) missing.push('光翼');
      if (!homeBtn) missing.push('回遇境按钮');
      if (!homeOk) missing.push('回遇境确认');
      if (missing.length) {
        return { success: false, error: '缺少坐标配置: ' + missing.join(', ') };
      }
      await _tap(backKey[0], backKey[1]);
      await _sleep(300);
      await _tap(wing[0], wing[1]);
      await _sleep(600);
      await _tap(homeBtn[0], homeBtn[1]);
      await _sleep(600);
      await _tap(homeOk[0], homeOk[1]);
      // 方案Q：占槽工具成功 -> 刷任务信号（last_signal_at），供完成判定兜底
      await signalTaskDone();
      return {
        success: true,
        action: 'home',
        steps: ['退键盘', '光翼', '回遇境按钮', '回遇境确认']
      };
    } catch (e) {
      return { success: false, error: _fmt(e) };
    } finally {
      releaseBusy();
    }
  }

  // ------------------------------------------------------------------
  // sky_get_config：读取当前完整配置（供配置界面预填 / 自检）
  // ------------------------------------------------------------------
  async function sky_get_config() {
    try {
      const cfg = await loadConfig();
      return { success: true, config: cfg, config_path: _configPath };
    } catch (e) {
      return { success: false, error: _fmt(e) };
    }
  }

  // ------------------------------------------------------------------
  // 坐标偏差自校准：AI 引导自动完成（用户零操作）
  // ------------------------------------------------------------------
  async function sky_calibrate(params) {
    params = params || {};
    const dir = cleanOnExitDir();
    setCoordTransform({}); // 校准时临时用恒等变换（否则旧校准值会污染新校准的采样点）
    const points = (Array.isArray(params.points) && params.points.length)
      ? params.points
      : [[150, 200], [2000, 900], [150, 1000], [2000, 200]];
    const shots = [];
    try {
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const tx = Math.round(Number(p[0]));
        const ty = Math.round(Number(p[1]));
        const path = joinPath(dir, 'calib_' + i + '.png');
        // 缺陷2修复：长按进行中截图——input swipe 同坐标 1200ms 后台(&) + sleep 0.7 + screencap，
        // 此时"指针位置"正显示该点 X/Y 数值（截图不再错过按压中的坐标显示）
        const cmd = 'input swipe ' + tx + ' ' + ty + ' ' + tx + ' ' + ty + ' 1200 & sleep 0.7 && screencap -p ' + path;
        await _shell(cmd);
        shots.push({ tap: [tx, ty], shot_path: path, path: path });
      }
      return {
        success: true,
        points_count: shots.length,
        shots: shots,
        dir: dir,
        hint: '用 read_file(path=<shot_path>, intent=读取指针位置坐标数值) 读取各截图，解出 scale/offset 后调用 sky_calibrate_apply({scale_x,scale_y,offset_x,offset_y}) 写入并置 coord_calibrated。'
      };
    } catch (e) {
      return { success: false, error: _fmt(e) };
    }
  }

  async function sky_calibrate_apply(params) {
    params = params || {};
    const sx = pickNum(params.scale_x, params.sx, 1.0);
    const sy = pickNum(params.scale_y, params.sy, 1.0);
    const ox = pickNum(params.offset_x, params.ox, 0.0);
    const oy = pickNum(params.offset_y, params.oy, 0.0);
    let existing = {};
    try { existing = await readConfigRaw(); } catch (e) { existing = {}; }
    stripStaleConfigKeys(existing);
    const base = deepMerge(defaultConfig(), existing);
    const merged = deepMerge(base, {
      coord_scale_x: sx, coord_scale_y: sy,
      coord_offset_x: ox, coord_offset_y: oy,
      coord_calibrated: true
    });
    await writeConfigRaw(merged);
    setCoordTransform(merged);
    return {
      success: true,
      coord_scale_x: sx, coord_scale_y: sy,
      coord_offset_x: ox, coord_offset_y: oy,
      coord_calibrated: true,
      message: '已校准：scale=' + sx.toFixed(2) + ', offset=(' + ox + ',' + oy + ')，点击已精确对齐'
    };
  }

  // ------------------------------------------------------------------
  // main：自检
  // ------------------------------------------------------------------
  async function main() {
    const cfg = await loadConfig();
    const required = ['聊天框双击', '发送键', '退键盘', '光翼'];
    const missing = required.filter(function (k) { return !coord(cfg, k); });
    const optionalMissing = ['回遇境按钮', '回遇境确认'].filter(function (k) {
      return !coord(cfg, k);
    });
    const flipNull = !flipCoord(cfg);
    return {
      success: true,
      package: 'sky_auto',
      config_path: _configPath,
      ready: missing.length === 0 && !flipNull,
      missing_coords: missing,
      flip_missing: flipNull,
      optional_missing: optionalMissing,
      sky_result_dir: cfg.sky_result_dir || DEFAULT_RESULT_DIR,
      message: (missing.length || flipNull)
        ? ('需要先在「光遇坐标配置」界面录入坐标: ' + missing.join(', ') + (flipNull ? (missing.length ? '，' : '') + '翻页参数' : ''))
        : '坐标已配置，可用。'
    };
  }

  // ------------------------------------------------------------------
  // 导出
  // ------------------------------------------------------------------
  return {
    sky_set_config: sky_set_config,
    sky_read_chat: sky_read_chat,
    sky_send_text: sky_send_text,
    sky_action: sky_action,
    sky_detect: sky_detect,
    sky_poll: sky_poll,
    sky_look: sky_look,
    sky_run: sky_run,
    sky_stop: sky_stop,
    sky_home: sky_home,
    sky_calibrate: sky_calibrate,
    sky_calibrate_apply: sky_calibrate_apply,
    sky_task_done: sky_task_done,
    sky_get_config: sky_get_config,
    main: main
  };
})();

exports.sky_set_config = SkyAuto.sky_set_config;
exports.sky_read_chat = SkyAuto.sky_read_chat;
exports.sky_send_text = SkyAuto.sky_send_text;
exports.sky_action = SkyAuto.sky_action;
exports.sky_detect = SkyAuto.sky_detect;
exports.sky_poll = SkyAuto.sky_poll;
exports.sky_look = SkyAuto.sky_look;
exports.sky_run = SkyAuto.sky_run;
exports.sky_stop = SkyAuto.sky_stop;
exports.sky_home = SkyAuto.sky_home;
exports.sky_calibrate = SkyAuto.sky_calibrate;
exports.sky_calibrate_apply = SkyAuto.sky_calibrate_apply;
exports.sky_task_done = SkyAuto.sky_task_done;
exports.sky_get_config = SkyAuto.sky_get_config;
exports.main = SkyAuto.main;

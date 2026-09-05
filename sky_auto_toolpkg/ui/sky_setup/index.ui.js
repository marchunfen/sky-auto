"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 光遇自动化 ToolPkg ——「光遇坐标配置」compose_dsl 配置界面。
// 写法严格参考 windows_control_ref/src/ui/windows_setup/index.ui.ts：
//   - 入口：exports.default = function Screen(ctx) { ... return ctx.UI.LazyColumn(props, children); }
//   - 状态：const [v, setV] = ctx.useState(key, init)
//   - 输入：ctx.UI.TextField({ label, placeholder, value, onValueChange, singleLine })
//   - 布局：ctx.UI.Column / Row / Text / Spacer / Button / Card / Icon
//   - 保存：调用子包 sky_auto:sky_set_config 写入
//     /storage/emulated/0/Download/SkyDetector/sky_auto_config.json
// 组件名以 types/compose-dsl.d.ts 为准；此处只使用 windows_control 范例中已验证的组件。

// 子包 id：与 toolpkg_id（sky_auto）不同名（参考 windows_control：toolpkg_id 与子包 id 分离），
// 否则 Operit 把 sky_auto 当容器，子包无法作为可调用 package 暴露（sky_auto:sky_set_config -> Tool not found）
const PACKAGE_NAME = "sky_core";
const SET_CONFIG_TOOL = "sky_set_config";
const GET_CONFIG_TOOL = "sky_get_config";
const DEFAULT_CONFIG_HINT = "/storage/emulated/0/Download/SkyDetector/sky_auto_config.json";

const TEXTS = {
  zh: {
    title: "光遇坐标配置",
    subtitle: "填入你设备上的实际像素坐标，保存后写入 sky_auto_config.json。坐标由你按 Android「指针位置」读取。",
    requiredTitle: "必填坐标",
    requiredHint: "这三项必须填写，否则无法发消息 / 互动。",
    labelChatBox: "聊天框双击坐标",
    labelSendKey: "发送键坐标",
    labelBackKey: "退键盘坐标",
    flipTitle: "翻页参数（必填）",
    flipHint: "动作栏内翻页手势：起点 (sx,sy) → 终点 (ex,ey)。",
    labelFlipSx: "起点 X",
    labelFlipSy: "起点 Y",
    labelFlipEx: "终点 X",
    labelFlipEy: "终点 Y",
    offsetTitle: "主动偏移量 (offset_active)",
    offsetHint: "主动互动时：锚点Y再往下偏移多少像素点开动作栏。设备相关，请填你自己设备的数值；留空则不保存此项。",
    labelOffsetActive: "主动偏移量",
    offsetPlaceholder: "你自己的偏移量",
    knownNamesTitle: "聊天归属白名单 (known_names)",
    knownNamesHint: "备注名白名单（自己+朋友），逗号分隔；用于归属标注与去重（同一发送者+同一内容只投一次）。名单外（含陌生人/未备注昵称）一律忽略；白名单内用户消息必投递。多人侧边栏由控制词「开启多人聊天」打开（纯UI），归属同样基于此白名单。",
    labelKnownNames: "白名单（备注名，逗号分隔）",
    knownNamesPlaceholder: "例如：春分,seek,小号",
    aliasTitle: "动作名称映射 (action_aliases)",
    aliasHint: "自定义口语映射，格式「口语=标准名」，逗号分隔多个；优先于内置别名表。内置已含：拉手=牵手、抱抱=拥抱 等常见叫法。",
    labelAliases: "自定义映射（口语=标准名）",
    aliasesPlaceholder: "例如：贴贴=拥抱,拉拉=牵手",
    calibTitle: "坐标校准 (coord_scale/offset)",
    calibCalibratedPrefix: "已校准：",
    calibNotCalibrated: "未校准（首次使用建议校准）。",
    calibPreviewLabel: "换算预览：指针位置 (500,500) → 实际点击",
    calibHint: "若发现点击偏移，可让 AI 引导执行「坐标校准」自动完成；换设备后需重新校准，同型号可复用。",
    labelCalScaleX: "scale_x",
    labelCalScaleY: "scale_y",
    labelCalOffsetX: "offset_x",
    labelCalOffsetY: "offset_y",
    optionalTitle: "选填坐标",
    optionalHint: "不填也可；填了才能用回遇境 / 光翼相关能力。",
    labelWing: "光翼坐标",
    labelBackHomeBtn: "回遇境按钮",
    labelBackHomeConfirm: "回遇境确认",
    coordPlaceholder: "例如：540,1200",
    numPlaceholder: "例如：2180",
    saveTitle: "保存",
    saveHint: "保存会保留其它默认参数：max_flip=4、sky_result_dir、poll_interval_ms=1000、interact_keywords；以及方案Q 任务队列默认（task_quiet_ms=5000、task_timeout_ms=30000、task_redeliver_ms=10000）。",
    save: "保存配置",
    saving: "保存中...",
    saved: "已保存（本机坐标已生效）：",
    saveFailed: "保存失败：",
    errorRequired: "请填写聊天框双击/发送键/退键盘/翻页",
    loadedHint: "已读取当前配置。"
  },
  en: {
    title: "Sky Coordinates Setup",
    subtitle: "Fill in your device pixel coordinates; saved to sky_auto_config.json. Use Android \"Pointer location\" to read them.",
    requiredTitle: "Required coordinates",
    requiredHint: "These three are required for messaging / interaction.",
    labelChatBox: "Chat box double-tap",
    labelSendKey: "Send key",
    labelBackKey: "Dismiss keyboard key",
    flipTitle: "Flip gesture (required)",
    flipHint: "Action-bar flip gesture: start (sx,sy) → end (ex,ey).",
    labelFlipSx: "Start X",
    labelFlipSy: "Start Y",
    labelFlipEx: "End X",
    labelFlipEy: "End Y",
    offsetTitle: "Active offset (offset_active)",
    offsetHint: "For active interactions: pixels below the anchor Y to tap when opening the action bar. Device-dependent - fill in your own value; leave blank to skip saving this item.",
    labelOffsetActive: "Active offset",
    offsetPlaceholder: "your own offset",
    knownNamesTitle: "Chat whitelist (known_names)",
    knownNamesHint: "Whitelist of remark names (you + friends), comma separated. Used for attribution and dedup (same sender + same content delivered once). Anyone outside (stranger / unremarked nickname) is ignored; whitelist users' messages are always delivered. Multi sidebar opened by control word \"开启多人聊天\" (pure UI); attribution also based on this whitelist.",
    labelKnownNames: "Whitelist (remark names, comma separated)",
    knownNamesPlaceholder: "e.g. 春分,seek,小号",
    aliasTitle: "Action name mapping (action_aliases)",
    aliasHint: "Custom colloquial -> standard name mapping, format \"colloquial=standard\", comma separated; takes priority over built-in aliases (e.g. 拉手=牵手, 抱抱=拥抱).",
    labelAliases: "Custom mapping (colloquial=standard)",
    aliasesPlaceholder: "e.g. 贴贴=拥抱,拉拉=牵手",
    calibTitle: "Coordinate calibration (coord_scale/offset)",
    calibCalibratedPrefix: "Calibrated: ",
    calibNotCalibrated: "Not calibrated (recommended on first use).",
    calibPreviewLabel: "Preview: pointer (500,500) -> actual tap",
    calibHint: "If taps are offset, let the AI run coordinate calibration automatically; re-calibrate after switching device, same model can be reused.",
    labelCalScaleX: "scale_x",
    labelCalScaleY: "scale_y",
    labelCalOffsetX: "offset_x",
    labelCalOffsetY: "offset_y",
    optionalTitle: "Optional coordinates",
    optionalHint: "Optional; needed only for wing / back-to-home features.",
    labelWing: "Wing",
    labelBackHomeBtn: "Back-to-home button",
    labelBackHomeConfirm: "Back-to-home confirm",
    coordPlaceholder: "e.g. 540,1200",
    numPlaceholder: "e.g. 2180",
    saveTitle: "Save",
    saveHint: "Saving keeps other defaults: max_flip=4, sky_result_dir, poll_interval_ms=1000, interact_keywords; plus 方案Q task-queue defaults (task_quiet_ms=5000, task_timeout_ms=30000, task_redeliver_ms=10000).",
    save: "Save config",
    saving: "Saving...",
    saved: "Saved (ready on this device): ",
    saveFailed: "Save failed: ",
    errorRequired: "Please fill in: chat box / send key / dismiss key / flip",
    loadedHint: "Current config loaded."
  }
};

function resolveText() {
  let locale = "zh";
  try {
    if (typeof getLang === "function") {
      const raw = String(getLang() || "").trim().toLowerCase();
      if (raw.indexOf("en") === 0) locale = "en";
    }
  } catch (e) { /* 环境无 getLang 时默认中文 */ }
  return TEXTS[locale] || TEXTS.zh;
}

function useStateValue(ctx, key, initial) {
  const pair = ctx.useState(key, initial);
  return { value: pair[0], set: pair[1] };
}

function parseCoord(raw) {
  const s = String(raw == null ? "" : raw)
    .trim()
    .replace(/[\[\]（）()]/g, "")
    .replace(/[，]/g, ",");
  if (!s) return null;
  const parts = s.split(",").map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 0; });
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  return (isFinite(x) && isFinite(y)) ? [x, y] : null;
}

function parseNum(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return null;
  const v = Number(s);
  return isFinite(v) ? v : null;
}

function parseNameList(raw) {
  const s = String(raw == null ? "" : raw);
  return s.split(/[,，、]/).map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 0; });
}

function toErrorText(error) {
  return (error && error.message) ? error.message : String(error == null ? "unknown" : error);
}

function parseToolResultObject(result) {
  if (typeof result === "string") {
    try { return JSON.parse(result); } catch (e) { return null; }
  }
  return (result && typeof result === "object") ? result : null;
}

function resolveRuntimePackageName(ctx, fallback) {
  const currentPackageName = String(
    ctx.getCurrentPackageName ? (ctx.getCurrentPackageName() || "") : ""
  ).trim();
  const currentToolPkgId = String(
    ctx.getCurrentToolPkgId ? (ctx.getCurrentToolPkgId() || "") : ""
  ).trim();
  if (!currentPackageName) return fallback;
  if (currentToolPkgId && currentPackageName === currentToolPkgId) return fallback;
  return currentPackageName;
}

async function resolveToolName(ctx, packageName, toolName) {
  if (ctx.resolveToolName) {
    const resolved = await ctx.resolveToolName({ packageName: packageName, toolName: toolName, preferImported: true });
    const value = String(resolved || "").trim();
    if (value) return value;
  }
  return packageName + ":" + toolName;
}

async function ensureImportedAndUsed(ctx, packageName) {
  const imported = ctx.isPackageImported ? !!(await ctx.isPackageImported(packageName)) : false;
  if (!imported && ctx.importPackage) {
    const result = await ctx.importPackage(packageName);
    const message = String(result || "").toLowerCase();
    if (message.indexOf("error") !== -1 || message.indexOf("failed") !== -1 || message.indexOf("not found") !== -1) {
      throw new Error(String(result || "import package failed"));
    }
  }
  if (ctx.usePackage) {
    const useResult = await ctx.usePackage(packageName);
    const useText = String(useResult || "");
    if (useText && useText.toLowerCase().indexOf("error") !== -1) {
      throw new Error(useText);
    }
  }
}

async function callToolWithFallback(ctx, packageName, toolName, args) {
  const resolved = await resolveToolName(ctx, packageName, toolName);
  const candidates = [resolved, packageName + ":" + toolName].filter(function (item, index, arr) {
    return item && arr.indexOf(item) === index;
  });
  let lastError = "";
  for (let i = 0; i < candidates.length; i++) {
    try {
      return await ctx.callTool(candidates[i], args || {});
    } catch (e) {
      lastError = toErrorText(e);
    }
  }
  throw new Error(lastError || "callTool failed");
}

function coordField(ctx, state, label, placeholder) {
  return ctx.UI.TextField({
    label: label,
    placeholder: placeholder,
    value: state.value,
    onValueChange: state.set,
    singleLine: true
  });
}

function numField(ctx, state, label, placeholder) {
  return ctx.UI.TextField({
    label: label,
    placeholder: placeholder,
    value: state.value,
    onValueChange: state.set,
    singleLine: true,
    // 同一 Row 里两个输入框各占一半并排（[起点X|起点Y]、[终点X|终点Y]）
    weight: 1
  });
}

exports.default = function Screen(ctx) {
  const T = resolveText();

  const chatBoxState = useStateValue(ctx, "sky-chatBox", "");
  const sendKeyState = useStateValue(ctx, "sky-sendKey", "");
  const backKeyState = useStateValue(ctx, "sky-backKey", "");
  const wingState = useStateValue(ctx, "sky-wing", "");
  const homeBtnState = useStateValue(ctx, "sky-backHomeBtn", "");
  const homeConfirmState = useStateValue(ctx, "sky-backHomeConfirm", "");
  const flipSxState = useStateValue(ctx, "sky-flipSx", "");
  const flipSyState = useStateValue(ctx, "sky-flipSy", "");
  const flipExState = useStateValue(ctx, "sky-flipEx", "");
  const flipEyState = useStateValue(ctx, "sky-flipEy", "");
  // 主动偏移量：无默认值，留空由使用者填自己设备的偏移量（设备相关，不预设值误导）
  const offsetActiveState = useStateValue(ctx, "sky-offsetActive", "");
  // 聊天归属白名单 known_names（逗号分隔，daily 模式用；multi 由 AI 用"开启多人聊天"切换）
  const knownNamesState = useStateValue(ctx, "sky-knownNames", "");
  // 【fixedM】动作名称自定义映射 action_aliases（格式：口语=标准名，逗号分隔多个）
  const actionAliasesState = useStateValue(ctx, "sky-actionAliases", "");
  // 坐标偏差自校准（scale/offset，默认恒等）
  const calScaleXState = useStateValue(ctx, "sky-calScaleX", "");
  const calScaleYState = useStateValue(ctx, "sky-calScaleY", "");
  const calOffsetXState = useStateValue(ctx, "sky-calOffsetX", "");
  const calOffsetYState = useStateValue(ctx, "sky-calOffsetY", "");

  const isSavingState = useStateValue(ctx, "sky-isSaving", false);
  const errorMessageState = useStateValue(ctx, "sky-errorMessage", "");
  const successMessageState = useStateValue(ctx, "sky-successMessage", "");
  const hasInitializedState = useStateValue(ctx, "sky-hasInitialized", false);

  const setCoordState = function (state, key, config) {
    const v = config[key];
    if (Array.isArray(v) && v.length >= 2 &&
        isFinite(Number(v[0])) && isFinite(Number(v[1]))) {
      state.set(String(Number(v[0])) + "," + String(Number(v[1])));
    }
  };

  const loadExistingConfig = async function () {
    try {
      const pkg = resolveRuntimePackageName(ctx, PACKAGE_NAME);
      await ensureImportedAndUsed(ctx, pkg);
      const result = await callToolWithFallback(ctx, pkg, GET_CONFIG_TOOL, {});
      const obj = parseToolResultObject(result);
      if (!obj || obj.success === false || !obj.config) return;
      const config = obj.config;
      setCoordState(chatBoxState, "聊天框双击", config);
      setCoordState(sendKeyState, "发送键", config);
      setCoordState(backKeyState, "退键盘", config);
      setCoordState(wingState, "光翼", config);
      setCoordState(homeBtnState, "回遇境按钮", config);
      setCoordState(homeConfirmState, "回遇境确认", config);
      const flip = config.flip || {};
      if (isFinite(Number(flip.sx))) flipSxState.set(String(Number(flip.sx)));
      if (isFinite(Number(flip.sy))) flipSyState.set(String(Number(flip.sy)));
      if (isFinite(Number(flip.ex))) flipExState.set(String(Number(flip.ex)));
      if (isFinite(Number(flip.ey))) flipEyState.set(String(Number(flip.ey)));
      // 仅当配置里是有效数字时才回填；null/缺失/字符串一律保持留空
      if (typeof config.offset_active === "number" && isFinite(config.offset_active)) {
        offsetActiveState.set(String(config.offset_active));
      }
      // 白名单：数组 -> 逗号分隔字符串
      if (Array.isArray(config.known_names) && config.known_names.length) {
        knownNamesState.set(config.known_names.join(","));
      }
      // 【fixedM】动作名称映射：对象 -> "口语=标准名,口语=标准名" 字符串
      if (config.action_aliases && typeof config.action_aliases === 'object') {
        const pairs = [];
        Object.keys(config.action_aliases).forEach(function (k) {
          const v = config.action_aliases[k];
          if (k && v) pairs.push(k + '=' + v);
        });
        if (pairs.length) actionAliasesState.set(pairs.join(','));
      }
      // 坐标校准：scale/offset 回填（保留到2位）
      if (isFinite(Number(config.coord_scale_x))) calScaleXState.set(String(Number(config.coord_scale_x)));
      if (isFinite(Number(config.coord_scale_y))) calScaleYState.set(String(Number(config.coord_scale_y)));
      if (isFinite(Number(config.coord_offset_x))) calOffsetXState.set(String(Number(config.coord_offset_x)));
      if (isFinite(Number(config.coord_offset_y))) calOffsetYState.set(String(Number(config.coord_offset_y)));
      successMessageState.set(T.loadedHint);
    } catch (e) {
      // 子包未激活/读取失败时保持空表单，不影响手动填写
    }
  };

  const saveConfig = async function () {
    errorMessageState.set("");
    successMessageState.set("");

    const chatBox = parseCoord(chatBoxState.value);
    const sendKey = parseCoord(sendKeyState.value);
    const backKey = parseCoord(backKeyState.value);
    const sx = parseNum(flipSxState.value);
    const sy = parseNum(flipSyState.value);
    const ex = parseNum(flipExState.value);
    const ey = parseNum(flipEyState.value);
    // 主动偏移量：无默认值。填写才保存；留空则不写入配置（子包兜底 300）
    const offsetActive = parseNum(offsetActiveState.value);

    if (!chatBox || !sendKey || !backKey || sx === null || sy === null || ex === null || ey === null) {
      errorMessageState.set(T.errorRequired);
      return;
    }

    isSavingState.set(true);
    try {
      const payload = {
        "聊天框双击": chatBox,
        "发送键": sendKey,
        "退键盘": backKey,
        "光翼": parseCoord(wingState.value) || [],
        "回遇境按钮": parseCoord(homeBtnState.value) || [],
        "回遇境确认": parseCoord(homeConfirmState.value) || [],
        "flip": { sx: sx, sy: sy, ex: ex, ey: ey }
      };
      // 主动偏移量：填了才保存，留空不写入（避免用预设值误导）
      if (offsetActive !== null) {
        payload["offset_active"] = offsetActive;
      }
      // 聊天归属白名单（逗号分隔输入 -> 数组）
      payload["known_names"] = parseNameList(knownNamesState.value);
      // 【fixedM】动作名称映射："口语=标准名,口语=标准名" -> 对象
      const aliasObj = {};
      String(actionAliasesState.value || '').split(/[,，]/).forEach(function (item) {
        const idx = item.indexOf('=');
        if (idx > 0) {
          const k = item.slice(0, idx).trim();
          const v = item.slice(idx + 1).trim();
          if (k && v) aliasObj[k] = v;
        }
      });
      payload["action_aliases"] = aliasObj;
      // 坐标校准：scale/offset（默认恒等 1.0/0.0）；有任一非默认值则视为已校准
      const calSx = parseNum(calScaleXState.value); const calSy = parseNum(calScaleYState.value);
      const calOx = parseNum(calOffsetXState.value); const calOy = parseNum(calOffsetYState.value);
      payload["coord_scale_x"] = calSx !== null ? calSx : 1.0;
      payload["coord_scale_y"] = calSy !== null ? calSy : 1.0;
      payload["coord_offset_x"] = calOx !== null ? calOx : 0.0;
      payload["coord_offset_y"] = calOy !== null ? calOy : 0.0;
      payload["coord_calibrated"] = !(payload["coord_scale_x"] === 1.0 && payload["coord_scale_y"] === 1.0 &&
        payload["coord_offset_x"] === 0.0 && payload["coord_offset_y"] === 0.0);
      const pkg = resolveRuntimePackageName(ctx, PACKAGE_NAME);
      await ensureImportedAndUsed(ctx, pkg);
      // 平台按 METADATA 校验必填参数 config，必须包一层 { config: payload }
      const result = await callToolWithFallback(ctx, pkg, SET_CONFIG_TOOL, { config: payload });
      const obj = parseToolResultObject(result);
      const ok = obj ? obj.success !== false : true;
      if (ok) {
        const path = (obj && typeof obj.config_path === "string" && obj.config_path) ? obj.config_path : DEFAULT_CONFIG_HINT;
        successMessageState.set(T.saved + path);
      } else {
        errorMessageState.set(T.saveFailed + (obj && obj.error ? obj.error : ""));
      }
    } catch (e) {
      errorMessageState.set(T.saveFailed + toErrorText(e));
    } finally {
      isSavingState.set(false);
    }
  };

  // 坐标校准状态提示与换算预览（引用当前状态值）
  const calNum = function (s, d) { const v = parseNum(s.value); return v !== null ? v : d; };
  const coordCalibratedHint = function () {
    const sx = calNum(calScaleXState, 1.0), sy = calNum(calScaleYState, 1.0);
    const ox = calNum(calOffsetXState, 0.0), oy = calNum(calOffsetYState, 0.0);
    const calibrated = !(sx === 1.0 && sy === 1.0 && ox === 0.0 && oy === 0.0);
    return calibrated
      ? (T.calibCalibratedPrefix + "scale=(" + sx.toFixed(2) + "," + sy.toFixed(2) + ") offset=(" + ox + "," + oy + ")")
      : T.calibNotCalibrated;
  };
  const calibPreview = function () {
    const sx = calNum(calScaleXState, 1.0), sy = calNum(calScaleYState, 1.0);
    const ox = calNum(calOffsetXState, 0.0), oy = calNum(calOffsetYState, 0.0);
    const px = Math.round(500 * sx + ox), py = Math.round(500 * sy + oy);
    return T.calibPreviewLabel + "（" + px + "," + py + "）";
  };

  const children = [
    ctx.UI.Row({ verticalAlignment: "center" }, [
      ctx.UI.Icon({ name: "settings", tint: "primary" }),
      ctx.UI.Spacer({ width: 8 }),
      ctx.UI.Text({
        text: T.title,
        style: "headlineSmall",
        fontWeight: "bold"
      })
    ]),
    ctx.UI.Text({
      text: T.subtitle,
      style: "bodyMedium",
      color: "onSurfaceVariant"
    }),

    // 必填坐标
    ctx.UI.Card({ fillMaxWidth: true }, [
      ctx.UI.Column({ padding: 16, spacing: 10 }, [
        ctx.UI.Text({
          text: T.requiredTitle,
          style: "titleMedium",
          fontWeight: "semiBold"
        }),
        ctx.UI.Text({
          text: T.requiredHint,
          style: "bodyMedium",
          color: "onSurfaceVariant"
        }),
        coordField(ctx, chatBoxState, T.labelChatBox, T.coordPlaceholder),
        coordField(ctx, sendKeyState, T.labelSendKey, T.coordPlaceholder),
        coordField(ctx, backKeyState, T.labelBackKey, T.coordPlaceholder)
      ])
    ]),

    // 翻页参数（必填）
    ctx.UI.Card({ fillMaxWidth: true }, [
      ctx.UI.Column({ padding: 16, spacing: 10 }, [
        ctx.UI.Text({
          text: T.flipTitle,
          style: "titleMedium",
          fontWeight: "semiBold"
        }),
        ctx.UI.Text({
          text: T.flipHint,
          style: "bodyMedium",
          color: "onSurfaceVariant"
        }),
        ctx.UI.Row({ verticalAlignment: "center" }, [
          numField(ctx, flipSxState, T.labelFlipSx, T.numPlaceholder),
          ctx.UI.Spacer({ width: 8 }),
          numField(ctx, flipSyState, T.labelFlipSy, T.numPlaceholder)
        ]),
        ctx.UI.Row({ verticalAlignment: "center" }, [
          numField(ctx, flipExState, T.labelFlipEx, T.numPlaceholder),
          ctx.UI.Spacer({ width: 8 }),
          numField(ctx, flipEyState, T.labelFlipEy, T.numPlaceholder)
        ])
      ])
    ]),

    // 主动偏移量（默认 300，参考值）
    ctx.UI.Card({ fillMaxWidth: true }, [
      ctx.UI.Column({ padding: 16, spacing: 10 }, [
        ctx.UI.Text({
          text: T.offsetTitle,
          style: "titleMedium",
          fontWeight: "semiBold"
        }),
        ctx.UI.Text({
          text: T.offsetHint,
          style: "bodyMedium",
          color: "onSurfaceVariant"
        }),
        ctx.UI.TextField({
          label: T.labelOffsetActive,
          placeholder: T.offsetPlaceholder,
          value: offsetActiveState.value,
          onValueChange: offsetActiveState.set,
          singleLine: true
        })
      ])
    ]),

    // 聊天归属白名单（known_names）
    ctx.UI.Card({ fillMaxWidth: true }, [
      ctx.UI.Column({ padding: 16, spacing: 10 }, [
        ctx.UI.Text({
          text: T.knownNamesTitle,
          style: "titleMedium",
          fontWeight: "semiBold"
        }),
        ctx.UI.Text({
          text: T.knownNamesHint,
          style: "bodyMedium",
          color: "onSurfaceVariant"
        }),
        ctx.UI.TextField({
          label: T.labelKnownNames,
          placeholder: T.knownNamesPlaceholder,
          value: knownNamesState.value,
          onValueChange: knownNamesState.set,
          minLines: 2
        })
      ])
    ]),

    // 【fixedM】动作名称映射（口语=标准名，逗号分隔多个）
    ctx.UI.Card({ fillMaxWidth: true }, [
      ctx.UI.Column({ padding: 16, spacing: 10 }, [
        ctx.UI.Text({
          text: T.aliasTitle,
          style: "titleMedium",
          fontWeight: "bold"
        }),
        ctx.UI.Text({
          text: T.aliasHint,
          style: "bodySmall",
          color: "onSurfaceVariant"
        }),
        ctx.UI.TextField({
          label: T.labelAliases,
          placeholder: T.aliasesPlaceholder,
          value: actionAliasesState.value,
          onValueChange: actionAliasesState.set,
          minLines: 2
        })
      ])
    ]),

    // 坐标校准（coord_scale/offset）
    ctx.UI.Card({ fillMaxWidth: true }, [
      ctx.UI.Column({ padding: 16, spacing: 10 }, [
        ctx.UI.Text({
          text: T.calibTitle,
          style: "titleMedium",
          fontWeight: "semiBold"
        }),
        ctx.UI.Text({
          text: coordCalibratedHint(),
          style: "bodyMedium",
          color: "onSurfaceVariant"
        }),
        ctx.UI.Row({ verticalAlignment: "center" }, [
          numField(ctx, calScaleXState, T.labelCalScaleX, "1.0"),
          ctx.UI.Spacer({ width: 8 }),
          numField(ctx, calScaleYState, T.labelCalScaleY, "1.0")
        ]),
        ctx.UI.Row({ verticalAlignment: "center" }, [
          numField(ctx, calOffsetXState, T.labelCalOffsetX, "0"),
          ctx.UI.Spacer({ width: 8 }),
          numField(ctx, calOffsetYState, T.labelCalOffsetY, "0")
        ]),
        ctx.UI.Text({
          text: calibPreview(),
          style: "bodySmall",
          color: "onSurfaceVariant"
        }),
        ctx.UI.Text({
          text: T.calibHint,
          style: "bodySmall",
          color: "onSurfaceVariant"
        })
      ])
    ]),

    // 选填坐标
    ctx.UI.Card({ fillMaxWidth: true }, [
      ctx.UI.Column({ padding: 16, spacing: 10 }, [
        ctx.UI.Text({
          text: T.optionalTitle,
          style: "titleMedium",
          fontWeight: "semiBold"
        }),
        ctx.UI.Text({
          text: T.optionalHint,
          style: "bodyMedium",
          color: "onSurfaceVariant"
        }),
        coordField(ctx, wingState, T.labelWing, T.coordPlaceholder),
        coordField(ctx, homeBtnState, T.labelBackHomeBtn, T.coordPlaceholder),
        coordField(ctx, homeConfirmState, T.labelBackHomeConfirm, T.coordPlaceholder)
      ])
    ]),

    // 保存
    ctx.UI.Card({ fillMaxWidth: true }, [
      ctx.UI.Column({ padding: 16, spacing: 10 }, [
        ctx.UI.Text({
          text: T.saveTitle,
          style: "titleMedium",
          fontWeight: "semiBold"
        }),
        ctx.UI.Text({
          text: T.saveHint,
          style: "bodySmall",
          color: "onSurfaceVariant"
        }),
        isSavingState.value
          ? ctx.UI.Button({ enabled: false, fillMaxWidth: true, onClick: saveConfig }, [
            ctx.UI.Row({ verticalAlignment: "center", horizontalArrangement: "center" }, [
              ctx.UI.CircularProgressIndicator({ width: 16, height: 16, strokeWidth: 2, color: "onPrimary" }),
              ctx.UI.Spacer({ width: 8 }),
              ctx.UI.Text({ text: T.saving })
            ])
          ])
          : ctx.UI.Button({
            text: T.save,
            enabled: true,
            fillMaxWidth: true,
            onClick: saveConfig
          })
      ])
    ])
  ];

  if (successMessageState.value.trim()) {
    children.push(
      ctx.UI.Card({ containerColor: "primaryContainer", fillMaxWidth: true }, [
        ctx.UI.Row({ padding: 14, verticalAlignment: "center" }, [
          ctx.UI.Icon({ name: "checkCircle", tint: "onPrimaryContainer" }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({
            text: successMessageState.value,
            style: "bodyMedium",
            color: "onPrimaryContainer"
          })
        ])
      ])
    );
  }

  if (errorMessageState.value.trim()) {
    children.push(
      ctx.UI.Card({ containerColor: "errorContainer", fillMaxWidth: true }, [
        ctx.UI.Row({ padding: 14, verticalAlignment: "center" }, [
          ctx.UI.Icon({ name: "error", tint: "onErrorContainer" }),
          ctx.UI.Spacer({ width: 8 }),
          ctx.UI.Text({
            text: errorMessageState.value,
            style: "bodyMedium",
            color: "onErrorContainer"
          })
        ])
      ])
    );
  }

  return ctx.UI.LazyColumn(
    {
      onLoad: async function () {
        if (!hasInitializedState.value) {
          hasInitializedState.set(true);
          await loadExistingConfig();
        }
      },
      fillMaxSize: true,
      padding: 16,
      spacing: 16
    },
    children
  );
};

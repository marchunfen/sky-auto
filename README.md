# sky-auto

光遇（Sky: Children of the Light）AI 陪伴自动化：**Operit 平台的 ToolPkg 脚本** + **Android 端图标检测应用**。

> 本项目仅供学习与技术交流。它仅使用系统无障碍服务与 ADB 权限，**不涉及光遇包内部内容，不是外挂**；请勿将其用于任何违背游戏规则或法律法规的用途。许可证为**非商用**（见 `LICENSE`）。
> ⚠️ **封号风险提示**：使用本工具属于对游戏进行自动化操作，**可能被游戏检测并导致账号封禁/处罚**。仅供个人学习与技术研究使用，请后果自负。
> 识别模型精度有限，互动流程偶发失败——详见下方「已知问题」。

## 仓库结构

```
sky-auto/
├── sky_auto_toolpkg/       Operit 平台 ToolPkg（自动化脚本 + 坐标配置界面）
│   ├── manifest.json       ToolPkg 清单（toolpkg_id: sky_auto）
│   ├── main.js             ToolPkg 主入口（注册配置 UI 模块）
│   ├── README.md           该子包的完整说明（工具、铁律、方案Q 任务队列等）
│   ├── packages/sky_auto.js   核心脚本：读屏/发送/互动/识别/轮询/任务队列
│   └── ui/sky_setup/          坐标配置界面（compose_dsl）
└── SkyIconDetector/        Android 端光遇图标检测（YOLOv8 ONNX）
    ├── README.md           构建 / 使用说明（Android Studio）
    ├── build.gradle / settings.gradle / gradle.properties
    └── app/
        ├── build.gradle
        └── src/main/
            ├── AndroidManifest.xml
            ├── assets/yolo_hand_icon.onnx    图标检测模型
            ├── java/...   MainActivity / ScreenshotService / YoloDetector
            └── res/...   布局与图标
```

## 两部分如何配合

1. **SkyIconDetector**（Android）：对光遇屏幕截图，用 `yolo_hand_icon.onnx` 检测「拥抱 / 牵手 / 击掌 / 背背」等互动图标，把结果写出到 `SkyDetector/results/result_*.txt`（坐标 + 置信度）。
2. **sky_auto_toolpkg**（Operit ToolPkg）：常驻轮询读屏聊天文字 + 读取上面检测结果 → 通过 `send_message_to_ai` 唤醒 Operit 里的 AI → AI 调用 `sky_send_text` / `sky_action` / `sky_look` / `sky_home` 在光遇里回复、互动、识别环境、回遇境。

## 快速开始

0. **（可选，需要图标检测）** 用 Android Studio 打开 `SkyIconDetector/` 并 Run 到真机，授予所需权限（详见 `SkyIconDetector/README.md`）。
1. 把 `sky_auto_toolpkg/` 导入 Operit（ToolPkg），打开「光遇坐标配置」界面填入你设备的实际坐标（按 Android「指针位置」读取）。
2. 首次使用建议让 AI 跑一次 `sky_calibrate` 坐标校准（不同设备坐标有固定偏差），校准后点击精准。
3. 提示「开始玩光遇」后，AI 先输出引导语，用户手动点击 Operit 右下角红色 X 释放对话占用，再 `sky_run({ confirm_x: true })` 启动常驻循环。
4. 在光遇聊天里输入「停止光遇流程」即可停止；息屏/关机也会自动停止。

更完整的使用说明、铁律、方案Q 任务队列机制见 `sky_auto_toolpkg/README.md`。

## 已知问题（Known Issues）

- **互动图标识别精度有限**：当前训练模型对个别图标（尤其中低置信度画面）识别还不够精准，可能出现误判或漏检。识别模型仍在优化中。
- **互动流程偶发失败**：主动/被动互动偶尔可能失败（识别或点击时序问题）。建议 AI 在失败后**等待几秒再自动重试一次**；目前尚未定位到根因修复方案，后续会继续排查。

## 隐私说明

- 仓库**不含**任何真实设备坐标、个人备注名、API 密钥或本地配置。
- 示例姓名一律为通用名（春分 / seek / 小号）。
- 运行产生的 `sky_auto_config.json` / `sky_auto_last_seen.json` / 运行日志等均已被 `.gitignore` 排除，不入库。

## 许可证

本仓库使用自定义**非商用许可证**（见 [LICENSE](./LICENSE)）：允许自由使用 / 修改 / 分发，但**禁止商用**。如需商业授权，请通过 Issue 联系维护者。

## 致谢与免责声明
本项目仅作为技术学习与演示。**请知悉：使用本项目属于对游戏进行自动化操作，可能违反光遇游戏《服务条款》并被游戏封号/处罚**。请在遵守当地法律法规、并自行评估风险的前提下使用。使用本项目产生的任何后果由使用者自行承担；维护者不对因使用本项目造成的任何直接或间接损失负责。

## 下载
- **Android App 安装包**：👉 [点此下载 app-debug.apk](https://github.com/marchunfen/sky-auto/releases/download/v1.0/app-debug.apk)
- **ToolPkg 安装包（导入 Operit 用）**：👉 [点此下载 sky_auto.toolpkg](https://github.com/marchunfen/sky-auto/releases/download/v1.0/sky_auto.toolpkg)

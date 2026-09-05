# SkyIconDetector（Android 端光遇图标检测）

对光遇屏幕截图，用 YOLOv8（ONNX）检测「拥抱 / 牵手 / 击掌 / 背背」等互动图标，把结果（名称 + 坐标 + 置信度）写到 `Download/SkyDetector/results/result_*.txt`，供下游 `sky_auto_toolpkg` 读取。

## 依赖

- Android Studio（Gradle 同步）+ Android 8.0+ 真机/模拟器
- 推理库 `com.microsoft.onnxruntime:onnxruntime-android:1.17.1`（构建时由 Maven Central 自动拉取）
- 模型 `app/src/main/assets/yolo_hand_icon.onnx`（已随仓库提供）

## 构建方法

1. 用 Android Studio 打开本目录（`SkyIconDetector/`），等待 Gradle 同步完成（首次会下载 Gradle 与依赖）。
2. 连接真机（开启「开发者选项 → USB 调试」），直接 Run `app`。
3. 授予无障碍 / 悬浮窗 / 存储权限（按 App 内提示）。

> 说明：本项目不内置 gradlew 包装脚本，请用 Android Studio 自带的 Gradle 构建；命令行可用 `gradle assembleDebug`（需系统已装 Gradle）。

## 输出契约（与 sky_auto_toolpkg 对接）

每次检测把结果写入公共目录（`/sdcard/Download/SkyDetector/results/`）：
```
result_YYYYMMDD_HHMMSS.txt
```
内容形如（每行「名称 中心(x,y) 置信度%」）：
```
牵手 1040 640 0.93
```
- 截图存 `/sdcard/Download/SkyDetector/`（保留 30 张）；运行日志 `/sdcard/Download/SkyDetector/log.txt`（保留 200 行）。
- `sky_auto_toolpkg` 的 `sky_result_dir` 默认即指向该 `results/` 目录，二者默认路径一致，开箱即用。

## 许可

本应用随仓库使用**非商用许可证**（见根目录 `LICENSE`）。

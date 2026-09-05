package com.sky.icondetector;

import android.content.Context;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.util.Log;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * YOLOv8 目标检测器，基于 ONNX Runtime。
 *
 * 模型输入: [1, 3, 640, 640] (RGB, 归一化到 0~1)
 * 模型输出: [1, C, 8400]，其中 C = 4 + numClasses
 *   - 前 4 个通道: bbox 坐标 (cx, cy, w, h)，值为归一化 0~1
 *   - 后续通道: 各类别置信度
 * 解析方式: output[0][channel][prediction_index]
 *
 * 注意: 通道数 C 是动态的（本模型为 5，即 1 个类别；标准 COCO 为 84，即 80 类），
 *       代码通过 numClasses = numChannels - 4 自动适配。
 */
public class YoloDetector {
    private static final String TAG = "YoloDetector";

    private static final float CONFIDENCE_THRESHOLD = 0.25f; // 新模型置信度高，标准阈值
    private static final float NMS_THRESHOLD = 0.45f;
    private static final int INPUT_SIZE = 640;

    // 光遇互动动作 18 类（顺序与标注索引一致: 0-17）
    private static final String[] CLASS_NAMES = {
            "牵手", "拥抱", "碰拳", "击掌", "握手", "搭肩", "谢幕礼", "耳语", "双人舞",
            "双人旋转舞", "默契握手", "打闹", "熊抱", "公主抱", "背背", "跟随", "摸摸头", "坐下"
    };

    private OrtEnvironment env;
    private OrtSession session;

    public YoloDetector(Context context) {
        try {
            File modelFile = new File(context.getCacheDir(), "yolo_hand_icon.onnx");
            copyAssetToFile(context, "yolo_hand_icon.onnx", modelFile);

            env = OrtEnvironment.getEnvironment();
            OrtSession.SessionOptions options = new OrtSession.SessionOptions();
            options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
            session = env.createSession(modelFile.getAbsolutePath(), options);

            Log.i(TAG, "YOLO detector initialized, input names: " + session.getInputNames());
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize YOLO detector", e);
            throw new RuntimeException("模型加载失败: " + e.getMessage(), e);
        }
    }

    private void copyAssetToFile(Context context, String assetName, File outFile) throws Exception {
        AssetManager assetManager = context.getAssets();
        InputStream in = null;
        FileOutputStream out = null;
        try {
            in = assetManager.open(assetName);
            out = new FileOutputStream(outFile);
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
        } finally {
            if (in != null) in.close();
            if (out != null) out.close();
        }
    }

    /**
     * 对一张 Bitmap 执行检测。
     *
     * @param bitmap 任意尺寸的屏幕截图
     * @return 检测结果列表（坐标为原图像素坐标，已按原图尺寸缩放）
     */
    public List<DetectionResult> detect(Bitmap bitmap) {
        // 用 bitmap 自身尺寸作为原始尺寸
        if (bitmap == null) return new ArrayList<>();
        return detect(bitmap, bitmap.getWidth(), bitmap.getHeight());
    }

    /**
     * 对一张 Bitmap 执行检测，并按指定的原始分辨率映射坐标。
     *
     * 重要: bitmap 可能是降采样后的帧（如 inSampleSize=2），此时原始屏幕分辨率
     *       是 bitmap 尺寸的 n 倍。传入 origWidth/origHeight（真实屏幕分辨率）
     *       可确保 bbox 坐标映射到正确的原始分辨率坐标。
     *
     * @param bitmap    输入帧（任意尺寸，内部会 letterbox 到 640x640）
     * @param origWidth 原始屏幕/图像宽度（用于映射坐标）
     * @param origHeight 原始屏幕/图像高度
     * @return 检测结果列表（坐标为原始分辨率坐标）
     */
    public List<DetectionResult> detect(Bitmap bitmap, int origWidth, int origHeight) {
        if (session == null || bitmap == null || bitmap.isRecycled()) {
            return new ArrayList<>();
        }
        if (origWidth <= 0 || origHeight <= 0) {
            origWidth = bitmap.getWidth();
            origHeight = bitmap.getHeight();
        }

        OnnxTensor inputTensor = null;
        OrtSession.Result outputs = null;
        try {
            // 1. 预处理: letterbox 缩放到 640x640（保持宽高比 + 灰边填充）
            //    YOLOv8 训练时使用 letterbox，直接拉伸会变形导致检测率大幅下降
            Bitmap resized = letterbox(bitmap, INPUT_SIZE, INPUT_SIZE);
            if (resized == null) {
                Log.e(TAG, "letterbox returned null");
                return new ArrayList<>();
            }
            float[] input = bitmapToFloatArray(resized);
            resized.recycle();
            if (input == null) {
                return new ArrayList<>();
            }

            // 2. 构建输入张量 [1, 3, 640, 640]
            long[] shape = {1, 3, INPUT_SIZE, INPUT_SIZE};
            inputTensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(input), shape);

            Map<String, OnnxTensor> inputs = new HashMap<>();
            inputs.put(session.getInputNames().iterator().next(), inputTensor);

            // 3. 推理
            long start = System.currentTimeMillis();
            outputs = session.run(inputs);
            long elapsed = System.currentTimeMillis() - start;

            // 4. 解析 YOLOv8 3D 输出 [1, C, 8400]
            //    关键: letterbox 是在 bitmap 实际尺寸上做的，所以反算必须用 bitmap 尺寸，
            //    再把 bitmap 坐标映射到屏幕分辨率 (origWidth/origHeight)。
            float[][][] output = (float[][][]) outputs.get(0).getValue();
            List<DetectionResult> detections = parseOutput(
                    output,
                    bitmap.getWidth(), bitmap.getHeight(),  // letterbox 实际输入尺寸
                    origWidth, origHeight);                  // 目标屏幕分辨率

            Log.d(TAG, "Inference " + elapsed + "ms, detections: " + detections.size());
            return detections;
        } catch (Exception e) {
            Log.e(TAG, "Detection failed", e);
            return new ArrayList<>();
        } finally {
            // 关键: 无论成功或异常都释放 ONNX 资源，避免句柄泄漏导致卡死/崩溃
            try {
                if (inputTensor != null) inputTensor.close();
            } catch (Exception ignored) {
            }
            try {
                if (outputs != null) outputs.close();
            } catch (Exception ignored) {
            }
        }
    }

    /**
     * letterbox 缩放: 保持宽高比缩放后居中粘贴到目标尺寸画布，剩余区域填充灰色 (114)。
     * 这是 YOLOv8 训练/推理的标准预处理。
     */
    private Bitmap letterbox(Bitmap src, int targetW, int targetH) {
        int srcW = src.getWidth();
        int srcH = src.getHeight();
        if (srcW <= 0 || srcH <= 0) return null;

        float scale = Math.min((float) targetW / srcW, (float) targetH / srcH);
        int newW = Math.max(1, Math.round(srcW * scale));
        int newH = Math.max(1, Math.round(srcH * scale));

        Bitmap scaled = Bitmap.createScaledBitmap(src, newW, newH, true);
        Bitmap canvas = Bitmap.createBitmap(targetW, targetH, Bitmap.Config.ARGB_8888);
        android.graphics.Canvas c = new android.graphics.Canvas(canvas);
        c.drawColor(android.graphics.Color.rgb(114, 114, 114)); // YOLO letterbox 填充色
        c.drawBitmap(scaled, (targetW - newW) / 2f, (targetH - newH) / 2f, null);
        scaled.recycle();
        return canvas;
    }

    /**
     * RGB 通道分离并归一化到 0~1。
     * Bitmap.getPixels 返回 ARGB int 数组，按 R/G/B 分到三个通道。
     */
    private float[] bitmapToFloatArray(Bitmap bitmap) {
        int[] pixels = new int[INPUT_SIZE * INPUT_SIZE];
        bitmap.getPixels(pixels, 0, INPUT_SIZE, 0, 0, INPUT_SIZE, INPUT_SIZE);

        float[] result = new float[3 * INPUT_SIZE * INPUT_SIZE];

        for (int i = 0; i < pixels.length; i++) {
            int pixel = pixels[i];
            result[i] = ((pixel >> 16) & 0xFF) / 255.0f;                          // R
            result[INPUT_SIZE * INPUT_SIZE + i] = ((pixel >> 8) & 0xFF) / 255.0f; // G
            result[2 * INPUT_SIZE * INPUT_SIZE + i] = (pixel & 0xFF) / 255.0f;    // B
        }

        return result;
    }

    /**
     * 解析 YOLOv8 输出。
     *
     * YOLOv8 导出格式: [1, C, 8400]
     *   output[0][channel][prediction_index]
     *   前 4 通道: cx, cy, w, h (归一化 0~1)
     *   剩余通道: 类别置信度
     *
     * 注意: 本模型实际输出是 [1, 5, 8400]（1 个类别），
     *       但代码按 numClasses = numChannels - 4 动态处理，
     *       对于标准 [1, 84, 8400] (80 类) 同样适用。
     */
    /**
     * 解析 YOLOv8 输出。
     *
     * 坐标映射（两级）:
     *   1. 模型输出 (letterbox 640 画布) → bitmap 坐标:
     *      letterbox 是在 bitmap（宽 bitmapW×bitmapH）上做的，因此反算 scale/pad
     *      必须基于 bitmapW/bitmapH，而不是屏幕分辨率。
     *   2. bitmap 坐标 → 屏幕坐标:
     *      乘以 (screenW/bitmapW, screenH/bitmapH) 映射到真实屏幕分辨率。
     *
     * @param output   模型输出 [1, C, 8400]
     * @param bitmapW  letterbox 输入 bitmap 的实际宽度（如 1100）
     * @param bitmapH  letterbox 输入 bitmap 的实际高度（如 720）
     * @param screenW  真实屏幕分辨率宽度（如 2560）
     * @param screenH  真实屏幕分辨率高度（如 1600）
     */
    private List<DetectionResult> parseOutput(float[][][] output,
                                              int bitmapW, int bitmapH,
                                              int screenW, int screenH) {
        List<DetectionResult> boxes = new ArrayList<>();

        // 关键: 判空，防止模型输出异常时崩溃
        if (output == null || output.length == 0 || output[0] == null || output[0][0] == null) {
            Log.e(TAG, "Invalid output shape (null or empty)");
            return boxes;
        }

        int numChannels = output[0].length;       // C = 4 + numClasses
        int numPredictions = output[0][0].length; // 8400
        int numClasses = numChannels - 4;

        if (numChannels < 5 || numPredictions <= 0 || numClasses <= 0) {
            Log.e(TAG, "Unexpected output dims: channels=" + numChannels + ", preds=" + numPredictions);
            return boxes;
        }

        if (bitmapW <= 0 || bitmapH <= 0) {
            bitmapW = INPUT_SIZE;
            bitmapH = INPUT_SIZE;
        }
        if (screenW <= 0 || screenH <= 0) {
            screenW = bitmapW;
            screenH = bitmapH;
        }

        Log.d(TAG, "Output shape: [" + output.length + ", " + numChannels + ", " + numPredictions
                + "], classes=" + numClasses);

        // 关键: 判断 bbox 坐标类型。
        // 标准 YOLOv8 导出为归一化 (0~1)；但本模型导出为像素坐标 (0~640)。
        // 通过采样前若干预测框的坐标值自动判断。
        boolean normalized = isNormalizedOutput(output[0], numPredictions);
        Log.d(TAG, "Coordinate type: " + (normalized ? "normalized (0~1)" : "pixel (0~640)"));

        // letterbox 是在 bitmap 上做的 → 基于 bitmap 尺寸计算 scale/pad
        float lbScale = Math.min((float) INPUT_SIZE / bitmapW, (float) INPUT_SIZE / bitmapH);
        float lbPadX = (INPUT_SIZE - bitmapW * lbScale) / 2f;
        float lbPadY = (INPUT_SIZE - bitmapH * lbScale) / 2f;

        // bitmap 坐标 → 屏幕坐标 的比例
        float sxRatio = (float) screenW / bitmapW;
        float syRatio = (float) screenH / bitmapH;

        for (int i = 0; i < numPredictions; i++) {
            // 前 4 通道: bbox (cx, cy, w, h)
            float centerX = output[0][0][i];
            float centerY = output[0][1][i];
            float width = output[0][2][i];
            float height = output[0][3][i];

            // 跳过无效框
            if (width <= 0 || height <= 0) {
                continue;
            }
            if (normalized) {
                if (centerX < 0 || centerX > 1 || centerY < 0 || centerY > 1) continue;
            } else {
                if (centerX < 0 || centerX > INPUT_SIZE * 1.2f
                        || centerY < 0 || centerY > INPUT_SIZE * 1.2f) continue;
            }

            // 找类别置信度最大值
            float maxConf = 0;
            int maxClass = 0;
            for (int c = 0; c < numClasses; c++) {
                float conf = output[0][4 + c][i];
                if (conf > maxConf) {
                    maxConf = conf;
                    maxClass = c;
                }
            }

            if (maxConf >= CONFIDENCE_THRESHOLD) {
                // 第 1 级: letterbox 640 画布 → bitmap 坐标
                float bx, by, bw, bh;
                if (normalized) {
                    float cx640 = centerX * INPUT_SIZE;
                    float cy640 = centerY * INPUT_SIZE;
                    float w640 = width * INPUT_SIZE;
                    float h640 = height * INPUT_SIZE;
                    bx = (cx640 - lbPadX) / lbScale;
                    by = (cy640 - lbPadY) / lbScale;
                    bw = w640 / lbScale;
                    bh = h640 / lbScale;
                } else {
                    bx = (centerX - lbPadX) / lbScale;
                    by = (centerY - lbPadY) / lbScale;
                    bw = width / lbScale;
                    bh = height / lbScale;
                }

                // 第 2 级: bitmap 坐标 → 屏幕坐标
                float x = bx * sxRatio;
                float y = by * syRatio;
                float w = bw * sxRatio;
                float h = bh * syRatio;

                String label = (maxClass < CLASS_NAMES.length) ? CLASS_NAMES[maxClass] : ("class_" + maxClass);

                boxes.add(new DetectionResult(
                        label,
                        maxConf,
                        x - w / 2,  // left (top-left 坐标，便于绘制)
                        y - h / 2,  // top
                        w,
                        h
                ));
            }
        }

        return nonMaxSuppression(boxes);
    }

    /**
     * 判断 bbox 坐标是归一化 (0~1) 还是像素 (0~640)。
     * 采样前 100 个预测框，若绝大多数 cx/cy 都在 0~1 之外则判定为像素坐标。
     */
    private boolean isNormalizedOutput(float[][] channels, int numPredictions) {
        int sample = Math.min(100, numPredictions);
        float[] cx = channels[0];
        float[] cy = channels[1];
        int beyondOne = 0;
        for (int i = 0; i < sample; i++) {
            if (Math.abs(cx[i]) > 1.5f || Math.abs(cy[i]) > 1.5f) {
                beyondOne++;
            }
        }
        // 超过一半的框坐标 > 1.5 → 像素坐标
        return !(beyondOne > sample / 2);
    }

    /**
     * 标准 NMS，IoU 阈值 0.45。按置信度降序贪心抑制。
     */
    private List<DetectionResult> nonMaxSuppression(List<DetectionResult> boxes) {
        if (boxes.isEmpty()) return boxes;

        // 按置信度降序
        Collections.sort(boxes, new Comparator<DetectionResult>() {
            @Override
            public int compare(DetectionResult a, DetectionResult b) {
                return Float.compare(b.confidence, a.confidence);
            }
        });

        List<DetectionResult> result = new ArrayList<>();
        boolean[] suppressed = new boolean[boxes.size()];

        for (int i = 0; i < boxes.size(); i++) {
            if (suppressed[i]) continue;
            result.add(boxes.get(i));

            for (int j = i + 1; j < boxes.size(); j++) {
                if (suppressed[j]) continue;
                if (calculateIoU(boxes.get(i), boxes.get(j)) > NMS_THRESHOLD) {
                    suppressed[j] = true;
                }
            }
        }

        return result;
    }

    private float calculateIoU(DetectionResult a, DetectionResult b) {
        float x1 = Math.max(a.left, b.left);
        float y1 = Math.max(a.top, b.top);
        float x2 = Math.min(a.left + a.width, b.left + b.width);
        float y2 = Math.min(a.top + a.height, b.top + b.height);

        float intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        if (intersection <= 0) return 0;

        float areaA = a.width * a.height;
        float areaB = b.width * b.height;
        float union = areaA + areaB - intersection;
        if (union <= 0) return 0;

        return intersection / union;
    }

    public void release() {
        try {
            if (session != null) {
                session.close();
                session = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to release detector", e);
        }
    }

    /** 检测结果：左上角坐标 + 宽高 */
    public static class DetectionResult {
        public final String label;
        public final float confidence;
        public final float left;
        public final float top;
        public final float width;
        public final float height;

        public DetectionResult(String label, float confidence, float left, float top, float width, float height) {
            this.label = label;
            this.confidence = confidence;
            this.left = left;
            this.top = top;
            this.width = width;
            this.height = height;
        }

        @Override
        public String toString() {
            return String.format(java.util.Locale.US, "%s %.0f%% (%.0f,%.0f %dx%d)",
                    label, confidence * 100, left, top, width, height);
        }
    }
}

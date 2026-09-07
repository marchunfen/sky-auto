package com.sky.icondetector;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Binder;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.provider.MediaStore;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

import rikka.shizuku.Shizuku;
import rikka.shizuku.ShizukuRemoteProcess;

/**
 * 截图识别前台服务。
 *
 * 流程（每 2 秒循环）:
 *   1. 通过 Shizuku 执行系统指令 `screencap -p`，PNG 直接输出到 stdout
 *   2. 应用内解码为 Bitmap
 *   3. YoloDetector 推理
 *   4. 结果回调给 MainActivity 刷新 HUD
 *
 * 调试辅助:
 *   - 每次截图保存到公共目录 /sdcard/Download/SkyDetector/（可随时查看截图是否正常）
 *   - 详细运行日志写入同目录 log.txt，并通过 onLog 回调实时显示在 UI
 */
public class ScreenshotService extends Service {

    private static final String TAG = "ScreenshotService";
    private static final String CHANNEL_ID = "screenshot_channel";

    public static final String ACTION_START = "com.sky.icondetector.action.START";
    public static final String ACTION_STOP = "com.sky.icondetector.action.STOP";

    /** 截图识别周期: 2 秒 */
    private static final long CAPTURE_INTERVAL_MS = 2000;

    /** 是否保存截图到公共目录（调试用） */
    private static final boolean SAVE_SCREENSHOTS = true;
    /** 最多保留的截图张数，超出自动删除最旧的（2 秒一张 ≈ 保留 1 分钟） */
    private static final int MAX_SCREENSHOTS = 30;
    /** 日志最多保留的行数，超出自动删除最早的行 */
    private static final int MAX_LOG_LINES = 200;

    /**
     * 目标屏幕分辨率（坐标映射的基准）。
     * - 若 >0，强制使用此值作为坐标基准（适用于 getRealMetrics 返回逻辑分辨率而非物理分辨率的设备）。
     * - 若 <=0（默认），自动使用每帧截图 PNG 的原始分辨率，最准确、适配任意设备。
     */
    private static final int FORCE_SCREEN_WIDTH = 0;
    private static final int FORCE_SCREEN_HEIGHT = 0;
    /** 日志保存目录名（公共 Download 下） */
    private static final String SAVE_DIR = "SkyDetector";
    /** 检测结果固定文件夹（Download/SkyDetector/results/） */
    private static final String RESULT_DIR = "results";
    /** 最多保留的检测结果文件数，超出自动删除最旧的 */
    private static final int MAX_RESULT_FILES = 5;

    private HandlerThread workerThread;
    private Handler workerHandler;

    private YoloDetector detector;
    private volatile boolean running = false;
    /** detector 生命周期锁，防止初始化/推理/停止竞态 */
    private final Object detectorLock = new Object();

    /** 真实屏幕分辨率（用于坐标映射 - 修复 Bug2） */
    private volatile int screenWidth = 0;
    private volatile int screenHeight = 0;

    private DetectionCallback callback;
    private StringBuilder logBuffer = new StringBuilder();

    /** 检测回调，由 MainActivity 实现刷新 HUD */
    public interface DetectionCallback {
        void onDetections(List<YoloDetector.DetectionResult> detections, long inferenceMs,
                          Bitmap frame, int screenWidth, int screenHeight);
        void onError(String message);
        void onStatus(String message);
        void onLog(String line);
    }

    private final IBinder binder = new ScreenshotServiceHolder();

    /** 供 MainActivity 绑定后获取服务实例，设置回调 */
    public class ScreenshotServiceHolder extends Binder {
        public ScreenshotService getService() {
            return ScreenshotService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForegroundWithNotification();
        log("服务已创建");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            log("收到停止指令");
            stopCaptureLoop();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_START.equals(action)) {
            log("收到开始指令");
            startCaptureLoop();
        }

        return START_NOT_STICKY;
    }

    private void startForegroundWithNotification() {
        Notification notification = buildNotification("正在准备截图识别...");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+ 前台服务必须带类型；specialUse 是通用的截图轮询类型
            startForeground(1, notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(1, notification);
        }
    }

    private Notification buildNotification(String text) {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }
        return builder
                .setContentTitle("Sky Icon Detector")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_camera)
                .setOngoing(true)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Screenshot Detect", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(channel);
        }
    }

    private void startCaptureLoop() {
        if (running) return;

        // 检查 Shizuku 可用性
        log("检查 Shizuku: pingBinder=" + Shizuku.pingBinder());
        if (!Shizuku.pingBinder()) {
            notifyError("Shizuku 未运行，请先启动 Shizuku 服务");
            stopSelf();
            return;
        }
        if (Shizuku.isPreV11()) {
            notifyError("Shizuku 版本过旧，请更新");
            stopSelf();
            return;
        }
        log("Shizuku 版本: " + Shizuku.getVersion() + ", 权限: "
                + (Shizuku.checkSelfPermission() == android.content.pm.PackageManager.PERMISSION_GRANTED ? "已授权" : "未授权"));

        // 屏幕分辨率基准会在每帧 takeScreenshot 中用截图 PNG 原始尺寸更新（最准确）。
        // 这里先尝试初始化（仅用于提前显示日志，实际坐标映射以每帧截图的原始分辨率为准）。
        // 默认不强制固定分辨率，避免与设备实际不符。
        if (FORCE_SCREEN_WIDTH > 0 && FORCE_SCREEN_HEIGHT > 0) {
            // 若你在某些设备上 getRealMetrics 偏差大，可设定固定值（当前默认 0=不强制）
            screenWidth = FORCE_SCREEN_WIDTH;
            screenHeight = FORCE_SCREEN_HEIGHT;
            log("屏幕分辨率(强制): " + screenWidth + "x" + screenHeight);
        } else {
            try {
                android.util.DisplayMetrics dm = new android.util.DisplayMetrics();
                android.view.WindowManager wm = (android.view.WindowManager) getSystemService(Context.WINDOW_SERVICE);
                if (wm != null) {
                    wm.getDefaultDisplay().getRealMetrics(dm);
                    screenWidth = dm.widthPixels;
                    screenHeight = dm.heightPixels;
                    log("屏幕分辨率(初步): " + screenWidth + "x" + screenHeight + " (将以每帧截图原始分辨率为准)");
                }
            } catch (Exception e) {
                log("获取屏幕分辨率失败: " + e.getMessage());
            }
        }

        running = true;

        workerThread = new HandlerThread("screenshot-worker");
        workerThread.start();
        workerHandler = new Handler(workerThread.getLooper());

        // 异步初始化模型（复制+加载约几秒）
        workerHandler.post(new Runnable() {
            @Override
            public void run() {
                try {
                    log("开始加载 YOLO 模型...");
                    YoloDetector newDetector = new YoloDetector(ScreenshotService.this);
                    synchronized (detectorLock) {
                        // 若已在停止过程中 (running=false)，新模型直接释放
                        if (!running) {
                            newDetector.release();
                            log("模型加载完成但已停止，已释放");
                            return;
                        }
                        detector = newDetector;
                    }
                    log("模型加载完成，开始 2s 轮询截图识别");
                    notifyStatus("模型加载完成，开始 2s 轮询截图识别");
                    updateNotification("正在截图识别中 (2s 间隔)");
                    // 关键: 停止时 workerHandler 可能已置 null，防止空指针闪退
                    if (running && workerHandler != null) {
                        workerHandler.post(screenshotRunnable);
                    } else {
                        // 已在停止过程中，释放刚初始化的模型
                        synchronized (detectorLock) {
                            if (detector != null) {
                                detector.release();
                                detector = null;
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Detector init failed", e);
                    log("模型加载失败: " + e.getMessage());
                    notifyError("模型加载失败: " + e.getMessage());
                    stopSelf();
                }
            }
        });
    }

    private final Runnable screenshotRunnable = new Runnable() {
        @Override
        public void run() {
            if (!running || workerHandler == null) return;

            long start = System.currentTimeMillis();
            Bitmap frame = null;
            try {
                // 1. Shizuku 截图（stdout 流式，无临时文件）
                log("[" + System.currentTimeMillis() % 100000 + "] 开始截图...");
                frame = takeScreenshot();
                if (frame != null) {
                    log("截图成功: " + frame.getWidth() + "x" + frame.getHeight());
                    // 2. 推理 - 用真实屏幕分辨率映射坐标（修复 Bug2: 坐标不准）
                    long t0 = System.currentTimeMillis();
                    List<YoloDetector.DetectionResult> detections;
                    synchronized (detectorLock) {
                        detections = detector != null
                                ? detector.detect(frame, screenWidth, screenHeight)
                                : new java.util.ArrayList<YoloDetector.DetectionResult>();
                    }
                    long inferMs = System.currentTimeMillis() - t0;
                    log("推理耗时 " + inferMs + "ms, 检出 " + detections.size() + " 个目标");
                    // 保留检测结果: 追加到 result.txt（可保留，每分钟自动清理 + 手动清理）
                    if (!detections.isEmpty()) {
                        appendResultToFile(detections, inferMs);
                    }
                    if (callback != null) {
                        // 传给 HUD 的帧会被缩略，服务端不再持有大片内存（修复 Bug1: OOM）
                        callback.onDetections(detections, inferMs, frame, screenWidth, screenHeight);
                    }
                } else {
                    log("截图失败 (返回 null)");
                    notifyStatus("截图失败，检查 Shizuku");
                }
            } catch (Exception e) {
                Log.e(TAG, "Screenshot loop error", e);
                log("截图异常: " + e.getMessage());
                notifyStatus("截图异常: " + e.getMessage());
            }

            long elapsed = System.currentTimeMillis() - start;
            long delay = Math.max(0, CAPTURE_INTERVAL_MS - elapsed);
            // 关键: 停止时 workerHandler 可能已被置 null，防止空指针闪退
            if (running && workerHandler != null) {
                workerHandler.postDelayed(screenshotRunnable, delay);
            }
        }
    };

    /**
     * 通过 Shizuku 执行 `screencap -p`，从 stdout 读取 PNG 并解码。
     * 不写临时文件，识别完毕即释放（自动清理语义）。
     */
    private Bitmap takeScreenshot() {
        ShizukuRemoteProcess process = null;
        try {
            process = Shizuku.newProcess(new String[]{"screencap", "-p"}, null, null);
            log("screencap 进程已启动");

            // 读取 stdout 全部字节
            InputStream in = process.getInputStream();
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buffer = new byte[16384];
            int n;
            long total = 0;
            while ((n = in.read(buffer)) != -1) {
                baos.write(buffer, 0, n);
                total += n;
            }

            int exitCode = process.waitFor();
            byte[] png = baos.toByteArray();
            log("screencap exit=" + exitCode + ", 读取 " + png.length + " 字节");
            if (exitCode != 0 || png.length == 0) {
                Log.e(TAG, "screencap failed, exit=" + exitCode + ", bytes=" + png.length);
                return null;
            }

            // 先用 inJustDecodeBounds 读取 PNG 原始分辨率（= 物理屏幕分辨率），
            // 作为坐标映射基准。这是最准确的方式，直接来自截图输出。
            BitmapFactory.Options boundsOpts = new BitmapFactory.Options();
            boundsOpts.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(png, 0, png.length, boundsOpts);
            int nativeW = boundsOpts.outWidth;
            int nativeH = boundsOpts.outHeight;
            if (nativeW > 0 && nativeH > 0) {
                screenWidth = nativeW;
                screenHeight = nativeH;
                log("截图原始分辨率: " + screenWidth + "x" + screenHeight);
            }

            // 2x 降采样解码，减少内存与推理压力
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = 2;
            Bitmap bmp = BitmapFactory.decodeByteArray(png, 0, png.length, opts);
            log("降采样后截图: " + (bmp != null ? bmp.getWidth() + "x" + bmp.getHeight() : "null"));

            // 调试: 保存截图到公共目录
            if (bmp != null && SAVE_SCREENSHOTS) {
                saveScreenshotToPublic(bmp);
            }
            return bmp;
        } catch (Exception e) {
            Log.e(TAG, "takeScreenshot error", e);
            log("screencap 异常: " + e);
            return null;
        } finally {
            if (process != null) {
                try {
                    process.destroy();
                } catch (Exception ignored) {
                }
            }
        }
    }

    /** 保存截图到公共目录（MediaStore.Images 只允许 Pictures/DCIM，Android 10+；低版本写 Download） */
    private void saveScreenshotToPublic(Bitmap bmp) {
        try {
            String name = "shot_" + new SimpleDateFormat("HHmmss_SSS", Locale.US).format(new Date()) + ".png";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                // Android 10+ 的 MediaStore.Images 只允许 Pictures 或 DCIM（Download 会报错）
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + SAVE_DIR);
                Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os != null) {
                        bmp.compress(Bitmap.CompressFormat.PNG, 100, os);
                        os.close();
                        log("截图已保存: Pictures/" + SAVE_DIR + "/" + name);
                        // 自动清理: 删除超出上限的最旧截图
                        cleanupOldScreenshots();
                        return;
                    }
                }
            } else {
                // Android 9 及以下: 直接写文件（Download 目录可写）
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), SAVE_DIR);
                if (!dir.exists()) dir.mkdirs();
                File file = new File(dir, name);
                FileOutputStream fos = new FileOutputStream(file);
                bmp.compress(Bitmap.CompressFormat.PNG, 100, fos);
                fos.close();
                log("截图已保存: " + file.getAbsolutePath());
                // 自动清理
                cleanupOldScreenshots();
                return;
            }
            log("截图保存失败: uri 为空");
        } catch (Exception e) {
            log("保存截图异常: " + e.getMessage());
        }
    }

    /**
     * 自动清理: 只保留最近 MAX_SCREENSHOTS 张截图，删除更早的。
     * 通过 MediaStore 查询并按日期排序删除（Android 10+），低版本直接删文件。
     */
    private void cleanupOldScreenshots() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                String selection = MediaStore.Images.Media.RELATIVE_PATH + " LIKE ?";
                String[] args = new String[]{"%" + SAVE_DIR + "%"};
                android.database.Cursor cursor = getContentResolver().query(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        new String[]{MediaStore.Images.Media._ID, MediaStore.Images.Media.DATE_ADDED},
                        selection, args, MediaStore.Images.Media.DATE_ADDED + " ASC");
                if (cursor != null) {
                    int count = cursor.getCount();
                    if (count > MAX_SCREENSHOTS) {
                        int toDelete = count - MAX_SCREENSHOTS;
                        int deleted = 0;
                        while (cursor.moveToNext() && deleted < toDelete) {
                            long id = cursor.getLong(0);
                            getContentResolver().delete(
                                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                                    MediaStore.Images.Media._ID + "=?",
                                    new String[]{String.valueOf(id)});
                            deleted++;
                        }
                        log("自动清理截图: 删除 " + deleted + " 张，保留最近 " + MAX_SCREENSHOTS + " 张");
                    }
                    cursor.close();
                }
            } else {
                // Android 9 及以下: 按文件修改时间排序删除最旧
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), SAVE_DIR);
                File[] files = dir.listFiles();
                if (files != null && files.length > MAX_SCREENSHOTS) {
                    java.util.Arrays.sort(files, new java.util.Comparator<File>() {
                        @Override
                        public int compare(File a, File b) {
                            return Long.compare(a.lastModified(), b.lastModified());
                        }
                    });
                    int deleted = 0;
                    for (int i = 0; i < files.length - MAX_SCREENSHOTS; i++) {
                        if (files[i].getName().startsWith("shot_") && files[i].delete()) {
                            deleted++;
                        }
                    }
                    log("自动清理截图: 删除 " + deleted + " 张");
                }
            }
        } catch (Exception e) {
            log("清理截图异常: " + e.getMessage());
        }
    }

    /**
     * 一键清理: 删除 SkyDetector 目录下的全部截图。
     * @return 删除的张数
     */
    public int clearAllScreenshots() {
        int deleted = 0;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                String selection = MediaStore.Images.Media.RELATIVE_PATH + " LIKE ?";
                String[] args = new String[]{"%" + SAVE_DIR + "%"};
                android.database.Cursor cursor = getContentResolver().query(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        new String[]{MediaStore.Images.Media._ID},
                        selection, args, null);
                if (cursor != null) {
                    while (cursor.moveToNext()) {
                        long id = cursor.getLong(0);
                        int r = getContentResolver().delete(
                                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                                MediaStore.Images.Media._ID + "=?",
                                new String[]{String.valueOf(id)});
                        deleted += r;
                    }
                    cursor.close();
                }
            } else {
                // Android 9 及以下: 直接删文件
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), SAVE_DIR);
                File[] files = dir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        if (f.getName().startsWith("shot_") && f.delete()) {
                            deleted++;
                        }
                    }
                }
            }
            log("一键清理: 删除 " + deleted + " 张截图");
        } catch (Exception e) {
            log("一键清理异常: " + e.getMessage());
        }
        return deleted;
    }

    /**
     * 一键清理日志: 清空内存缓冲并删除公共目录 log.txt。
     * @return 是否成功
     */
    public boolean clearLog() {
        try {
            // 清空内存缓冲
            logBuffer = new StringBuilder();
            // 删除公共目录 log.txt
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // 删 MediaStore 条目
                String selection = MediaStore.Downloads.DISPLAY_NAME + "=?";
                String[] args = new String[]{"log.txt"};
                getContentResolver().delete(MediaStore.Downloads.EXTERNAL_CONTENT_URI, selection, args);
            }
            // 同时删除物理文件（无论版本，避免残留）
            File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), SAVE_DIR);
            File file = new File(dir, "log.txt");
            if (file.exists()) file.delete();
            log("一键清理: 日志已清空");
            return true;
        } catch (Exception e) {
            log("一键清理日志异常: " + e.getMessage());
            return false;
        }
    }

    /** 追加一行日志（UI 回调 + 文件落盘）。自动限制日志行数，避免无限增长。 */
    private void log(String line) {
        String ts = new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date());
        String full = "[" + ts + "] " + line;
        Log.i(TAG, line);
        logBuffer.append(full).append("\n");
        // 自动清理: 只保留最近 MAX_LOG_LINES 行日志，避免文件无限增长
        if (logBuffer.length() > MAX_LOG_LINES * 64) {
            trimLogBuffer();
        }
        if (callback != null) {
            callback.onLog(full);
        }
        appendLogToFile(full);
    }

    /** 裁剪日志缓冲，只保留最近 MAX_LOG_LINES 行 */
    private void trimLogBuffer() {
        try {
            String[] lines = logBuffer.toString().split("\n");
            if (lines.length > MAX_LOG_LINES) {
                StringBuilder sb = new StringBuilder();
                for (int i = lines.length - MAX_LOG_LINES; i < lines.length; i++) {
                    sb.append(lines[i]).append("\n");
                }
                logBuffer = new StringBuilder(sb.toString());
            }
        } catch (Exception ignored) {
        }
    }

    /** 把日志追加到公共目录 log.txt */
    private void appendLogToFile(String line) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                String all = logBuffer.toString();
                // 关键: 先删除所有旧 log.txt 条目，避免 MediaStore 里堆积重复条目导致文件删不干净
                deleteMediaStoreLogOld();
                // 再新建一个
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, "log.txt");
                values.put(MediaStore.Downloads.MIME_TYPE, "text/plain");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + SAVE_DIR);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os != null) {
                        os.write(all.getBytes("UTF-8"));
                        os.close();
                    }
                }
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), SAVE_DIR);
                if (!dir.exists()) dir.mkdirs();
                File file = new File(dir, "log.txt");
                FileOutputStream fos = new FileOutputStream(file);
                fos.write(logBuffer.toString().getBytes("UTF-8"));
                fos.close();
            }
        } catch (Exception ignored) {
        }
    }

    /** 删除 MediaStore Downloads 里所有 log.txt 条目（避免重复堆积导致删不干净） */
    private void deleteMediaStoreLogOld() {
        try {
            String selection = MediaStore.Downloads.DISPLAY_NAME + "=?";
            String[] args = new String[]{"log.txt"};
            getContentResolver().delete(MediaStore.Downloads.EXTERNAL_CONTENT_URI, selection, args);
        } catch (Exception ignored) {
        }
    }

    // ================== 检测结果保留（每次检测一个文件，最多保留 5 个） ==================

    /**
     * 检测结果文件夹路径（Android 10+ 用公共 Download，低版本用外部存储）。
     *   Download/SkyDetector/results/
     */
    private File getResultsDir() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), SAVE_DIR + "/" + RESULT_DIR);
            if (!dir.exists()) dir.mkdirs();
            return dir;
        }
        // Android 10+ 通过 MediaStore 写入，这里返回逻辑路径用于删除
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), SAVE_DIR + "/" + RESULT_DIR);
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    /**
     * 保存一次检测结果为单独文件（带时间戳），并保留最近 MAX_RESULT_FILES 个，多余的删最旧的。
     */
    private void appendResultToFile(List<YoloDetector.DetectionResult> detections, long inferMs) {
        try {
            // 内容: 完整日期时间 + 每个检出图标(类别 坐标 置信度)
            String ts = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date());
            StringBuilder line = new StringBuilder();
            line.append("==== 检测时间: ").append(ts).append(" ====\n");
            line.append("推理耗时: ").append(inferMs).append("ms, 检出 ").append(detections.size()).append(" 个图标\n");
            for (YoloDetector.DetectionResult d : detections) {
                int cx = (int) (d.left + d.width / 2);
                int cy = (int) (d.top + d.height / 2);
                line.append(String.format(Locale.US, "  %s  中心(%d,%d)  置信度 %.1f%%\n",
                        d.label, cx, cy, d.confidence * 100));
            }

            // 文件名带时间戳: result_yyyyMMdd_HHmmss.txt
            String fname = "result_" + new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date()) + ".txt";
            File dir = getResultsDir();
            File file = new File(dir, fname);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // MediaStore 写入（Android 10+）
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fname);
                values.put(MediaStore.Downloads.MIME_TYPE, "text/plain");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + SAVE_DIR + "/" + RESULT_DIR);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os != null) {
                        os.write(line.toString().getBytes("UTF-8"));
                        os.close();
                    }
                }
            } else {
                FileOutputStream fos = new FileOutputStream(file);
                fos.write(line.toString().getBytes("UTF-8"));
                fos.close();
            }

            log("结果已保存: " + fname);
            // 清理: 超过 MAX_RESULT_FILES 个则删除最旧的
            cleanupOldResultFiles();
        } catch (Exception e) {
            log("保存结果异常: " + e.getMessage());
        }
    }

    /**
     * 清理 results 文件夹，只保留最近 MAX_RESULT_FILES 个结果文件。
     * 按文件修改时间排序，删除最旧的。
     */
    private void cleanupOldResultFiles() {
        try {
            File dir = getResultsDir();
            File[] files = dir.listFiles(new java.io.FileFilter() {
                @Override
                public boolean accept(File f) {
                    return f.isFile() && f.getName().startsWith("result_");
                }
            });
            if (files == null || files.length <= MAX_RESULT_FILES) return;

            // 按最后修改时间升序排序（最旧在前）
            java.util.Arrays.sort(files, new java.util.Comparator<File>() {
                @Override
                public int compare(File a, File b) {
                    return Long.compare(a.lastModified(), b.lastModified());
                }
            });

            int toDelete = files.length - MAX_RESULT_FILES;
            int deleted = 0;
            for (int i = 0; i < toDelete; i++) {
                if (files[i].delete()) deleted++;
            }
            log("结果自动清理: 删除 " + deleted + " 个旧结果，保留最近 " + MAX_RESULT_FILES + " 个");
        } catch (Exception e) {
            log("结果清理异常: " + e.getMessage());
        }
    }

    /** 手动一键清理所有检测结果文件 */
    public boolean clearResults() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+: 通过 MediaStore 删除 results 目录下的所有条目（避免删文件后残留记录）
                String selection = MediaStore.Downloads.RELATIVE_PATH + " LIKE ?";
                String[] args = new String[]{"%" + SAVE_DIR + "/" + RESULT_DIR + "%"};
                getContentResolver().delete(MediaStore.Downloads.EXTERNAL_CONTENT_URI, selection, args);
                log("一键清理: 已清理 MediaStore 中的结果记录");
            }
            // 同时删除物理文件（低版本直接删文件）
            File dir = getResultsDir();
            File[] files = dir.listFiles();
            int deleted = 0;
            if (files != null) {
                for (File f : files) {
                    if (f.isFile() && f.delete()) deleted++;
                }
            }
            log("一键清理: 删除 " + deleted + " 个结果文件");
            return true;
        } catch (Exception e) {
            log("一键清理结果异常: " + e.getMessage());
            return false;
        }
    }

    private void stopCaptureLoop() {
        running = false;
        if (workerHandler != null) {
            workerHandler.removeCallbacksAndMessages(null);
            workerHandler = null;
        }
        if (workerThread != null) {
            workerThread.quitSafely();
            workerThread = null;
        }
        // 同步保护: 避免与初始化线程的 new YoloDetector/detect 竞态
        synchronized (detectorLock) {
            if (detector != null) {
                detector.release();
                detector = null;
            }
        }
        log("服务已停止");
    }

    private void notifyError(String message) {
        log("错误: " + message);
        if (callback != null) {
            callback.onError(message);
        }
    }

    private void notifyStatus(String message) {
        if (callback != null) {
            callback.onStatus(message);
        }
    }

    private void updateNotification(String text) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.notify(1, buildNotification(text));
    }

    public void setDetectionCallback(DetectionCallback callback) {
        this.callback = callback;
        log("检测回调已连接");
    }

    @Override
    public void onDestroy() {
        stopCaptureLoop();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }
}

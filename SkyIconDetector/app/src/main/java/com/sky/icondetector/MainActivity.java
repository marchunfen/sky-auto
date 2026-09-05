package com.sky.icondetector;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.util.List;
import java.util.Locale;

import rikka.shizuku.Shizuku;

/**
 * 主界面: Shizuku 权限 → 启动/停止截图识别 → HUD 面板实时显示检测结果。
 *
 * 截图方案（替代 MediaProjection 录屏）:
 *   - 通过 Shizuku 执行系统 screencap 指令截图，每 2 秒一张
 *   - 识别完毕自动清理临时文件
 *   - 结果展示在可拖动的小型 HUD 面板上，不拦截屏幕操作
 */
public class MainActivity extends AppCompatActivity implements ScreenshotService.DetectionCallback {

    private static final String TAG = "MainActivity";
    private static final int REQUEST_OVERLAY = 1001;
    private static final int REQUEST_SHIZUKU = 1002;
    private static final int REQUEST_NOTIFICATION = 1003;
    /** 检测结果保留时长: 1 分钟，超时自动清空 */
    private static final long RESULTS_AUTO_CLEAR_MS = 60 * 1000;

    private Button btnToggle;
    private Button btnClear;
    private Button btnClearLog;
    private Button btnClearResult;
    private TextView tvStatus;
    private TextView tvResults;
    private ScrollView scrollResults;
    private TextView tvLog;
    private ScrollView scrollLog;

    private ScreenshotService screenshotService;
    private boolean serviceBound = false;

    // HUD 悬浮窗（可拖动，不挡触摸）
    private WindowManager windowManager;
    private HudView hudView;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            Log.d(TAG, "Service connected");
            try {
                screenshotService = ((ScreenshotService.ScreenshotServiceHolder) service).getService();
                screenshotService.setDetectionCallback(MainActivity.this);
                serviceBound = true;
                Log.d(TAG, "Callback set successfully");
            } catch (Exception e) {
                Log.e(TAG, "Failed to set callback", e);
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            serviceBound = false;
            screenshotService = null;
        }
    };

    // Shizuku 授权结果回调（必须在主线程注册）
    private final Shizuku.OnRequestPermissionResultListener shizukuListener =
            new Shizuku.OnRequestPermissionResultListener() {
                @Override
                public void onRequestPermissionResult(int requestCode, int grantResult) {
                    if (requestCode == REQUEST_SHIZUKU) {
                        if (grantResult == PackageManager.PERMISSION_GRANTED) {
                            Toast.makeText(MainActivity.this, "Shizuku 授权成功", Toast.LENGTH_SHORT).show();
                            tvStatus.setText("Shizuku 已授权，可以开始检测");
                        } else {
                            Toast.makeText(MainActivity.this, "Shizuku 授权被拒绝", Toast.LENGTH_LONG).show();
                            tvStatus.setText("需要 Shizuku 授权才能截图");
                        }
                    }
                }
            };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        btnToggle = findViewById(R.id.btn_toggle);
        btnClear = findViewById(R.id.btn_clear);
        btnClearLog = findViewById(R.id.btn_clear_log);
        btnClearResult = findViewById(R.id.btn_clear_result);
        tvStatus = findViewById(R.id.tv_status);
        tvResults = findViewById(R.id.tv_results);
        scrollResults = findViewById(R.id.scroll_results);
        tvLog = findViewById(R.id.tv_log);
        scrollLog = findViewById(R.id.scroll_log);

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        btnToggle.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (isCapturing()) {
                    stopDetection();
                } else {
                    startDetectionFlow();
                }
            }
        });

        // 一键清理截图
        btnClear.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                clearScreenshots();
            }
        });

        // 一键清理日志
        btnClearLog.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                clearLog();
            }
        });

        // 一键清理检测结果
        btnClearResult.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                clearResults();
            }
        });

        Shizuku.addRequestPermissionResultListener(shizukuListener);
        checkPermissions();
    }

    @Override
    protected void onDestroy() {
        Shizuku.removeRequestPermissionResultListener(shizukuListener);
        hideHud();
        super.onDestroy();
    }

    private boolean isCapturing() {
        return btnToggle.getText().toString().contains("停止");
    }

    private void checkPermissions() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                        REQUEST_NOTIFICATION);
            }
        }
    }

    // ---------- 启动流程 ----------

    private void startDetectionFlow() {
        // 1. 悬浮窗权限（HUD 面板）
        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "请先授予悬浮窗权限", Toast.LENGTH_SHORT).show();
            startActivityForResult(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName())), REQUEST_OVERLAY);
            return;
        }
        // 2. Shizuku 权限
        if (!Shizuku.pingBinder()) {
            tvStatus.setText("Shizuku 未运行");
            Toast.makeText(this, "请先启动 Shizuku 服务（ADB 或 root 方式）", Toast.LENGTH_LONG).show();
            return;
        }
        if (Shizuku.isPreV11()) {
            tvStatus.setText("Shizuku 版本过旧");
            Toast.makeText(this, "请升级 Shizuku 到最新版", Toast.LENGTH_LONG).show();
            return;
        }
        if (Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
            tvStatus.setText("正在请求 Shizuku 授权...");
            Shizuku.requestPermission(REQUEST_SHIZUKU);
            // 授权回调后用户需再点一次开始
            Toast.makeText(this, "请在 Shizuku 弹窗中允许本应用", Toast.LENGTH_LONG).show();
            return;
        }

        startDetection();
    }

    private void startDetection() {
        try {
            Intent serviceIntent = new Intent(this, ScreenshotService.class);
            serviceIntent.setAction(ScreenshotService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE);

            btnToggle.setText("停止检测");
            tvStatus.setText("正在启动...");

            showHud();
        } catch (Exception e) {
            Log.e(TAG, "start failed", e);
            tvStatus.setText("启动失败: " + e.getMessage());
        }
    }

    private void stopDetection() {
        try {
            Intent serviceIntent = new Intent(this, ScreenshotService.class);
            serviceIntent.setAction(ScreenshotService.ACTION_STOP);
            startService(serviceIntent);
            if (serviceBound) {
                unbindService(serviceConnection);
                serviceBound = false;
            }
        } catch (Exception e) {
            Log.e(TAG, "stop failed", e);
        }
        btnToggle.setText("开始检测");
        tvStatus.setText("已停止");
        // 检测结果保留显示：停止后不清空，超 1 分钟后自动清理
        scheduleResultsAutoClear();
        hideHud();
    }

    private void clearScreenshots() {
        if (screenshotService != null) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    int deleted = screenshotService.clearAllScreenshots();
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            tvStatus.setText("已清理 " + deleted + " 张截图");
                            Toast.makeText(MainActivity.this,
                                    "已清理 " + deleted + " 张截图", Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            }, "clear-screenshots").start();
        } else {
            Toast.makeText(this, "服务未连接，请先开始检测", Toast.LENGTH_SHORT).show();
        }
    }

    private void clearLog() {
        if (screenshotService != null) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    boolean ok = screenshotService.clearLog();
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            tvStatus.setText(ok ? "日志已清空" : "日志清理失败");
                            // 清空界面日志显示
                            if (tvLog != null) {
                                tvLog.setText("「日志已清空」\n");
                            }
                            Toast.makeText(MainActivity.this,
                                    ok ? "日志已清空" : "日志清理失败", Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            }, "clear-log").start();
        } else {
            Toast.makeText(this, "服务未连接，请先开始检测", Toast.LENGTH_SHORT).show();
        }
    }

    private void clearResults() {
        // 清空界面显示的检测结果（核心需求：手动清理检测结果）
        clearResultsUi();
        // 同时清理服务端持久化的 result.txt（若有）
        if (screenshotService != null) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    screenshotService.clearResults();
                }
            }, "clear-results-file").start();
        }
        tvStatus.setText("检测结果已清空");
        Toast.makeText(this, "检测结果已清空", Toast.LENGTH_SHORT).show();
    }

    // ---------- 检测回调（服务线程，切主线程刷新） ----------

    @Override
    public void onDetections(final List<YoloDetector.DetectionResult> detections,
                             final long inferenceMs, final Bitmap frame,
                             final int sw, final int sh) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                updateResults(detections, inferenceMs);
                if (hudView != null) {
                    // 关键: 用检测服务传回的真实屏幕分辨率作为坐标基准，保证缩略图框位置正确
                    hudView.screenW = sw;
                    hudView.screenH = sh;
                    hudView.update(frame, detections);
                }
                // 关键: HUD 已生成缩略图，立即回收原帧，避免大 bitmap 累积导致 OOM (修复 Bug1)
                if (frame != null && !frame.isRecycled()) {
                    frame.recycle();
                }
            }
        });
    }

    @Override
    public void onError(final String message) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                tvStatus.setText("错误: " + message);
                btnToggle.setText("开始检测");
            }
        });
    }

    @Override
    public void onStatus(final String message) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                tvStatus.setText(message);
            }
        });
    }

    @Override
    public void onLog(final String line) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                if (tvLog != null) {
                    // 只保留最近 200 行，避免内存膨胀
                    String existing = tvLog.getText().toString();
                    String[] lines = existing.split("\n");
                    if (lines.length > 200) {
                        StringBuilder sb = new StringBuilder();
                        for (int i = lines.length - 200; i < lines.length; i++) {
                            sb.append(lines[i]).append("\n");
                        }
                        existing = sb.toString();
                    }
                    tvLog.setText(existing + line + "\n");
                    if (scrollLog != null) {
                        scrollLog.post(new Runnable() {
                            @Override
                            public void run() {
                                scrollLog.fullScroll(View.FOCUS_DOWN);
                            }
                        });
                    }
                }
            }
        });
    }

    private void updateResults(List<YoloDetector.DetectionResult> detections, long inferenceMs) {
        if (detections == null || detections.isEmpty()) {
            tvStatus.setText("检测中... 推理 " + inferenceMs + "ms | 未检测到图标");
            return;
        }

        tvStatus.setText(String.format(Locale.US, "检测到 %d 个图标 | 推理 %dms",
                detections.size(), inferenceMs));

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < detections.size(); i++) {
            YoloDetector.DetectionResult d = detections.get(i);
            // 显示中心坐标（更直观，便于与屏幕上的目标位置对照），同时保留尺寸
            int cx = (int) (d.left + d.width / 2);
            int cy = (int) (d.top + d.height / 2);
            sb.append(String.format(Locale.US, "%d. %s  置信度: %.1f%%\n  中心: (%d, %d)  尺寸: %dx%d\n\n",
                    i + 1, d.label, d.confidence * 100,
                    cx, cy, (int) d.width, (int) d.height));
        }
        tvResults.setText(sb.toString());
        scrollResults.post(new Runnable() {
            @Override
            public void run() {
                scrollResults.fullScroll(View.FOCUS_DOWN);
            }
        });

        // 有检出结果时，重置自动清理计时（从最新结果起再保留 1 分钟）
        scheduleResultsAutoClear();
    }

    /** 结果自动清理计时器 Runnable */
    private final Runnable resultsAutoClearRunnable = new Runnable() {
        @Override
        public void run() {
            mainHandler.post(new Runnable() {
                @Override
                public void run() {
                    clearResultsUi();
                }
            });
        }
    };

    /** 调度/重置"保留 1 分钟后自动清空结果"的计时（移除旧任务，重新计时） */
    private void scheduleResultsAutoClear() {
        mainHandler.removeCallbacks(resultsAutoClearRunnable);
        mainHandler.postDelayed(resultsAutoClearRunnable, RESULTS_AUTO_CLEAR_MS);
    }

    /** 清空界面检测结果（停止或超时或手动触发） */
    private void clearResultsUi() {
        mainHandler.removeCallbacks(resultsAutoClearRunnable);
        if (tvResults != null) {
            tvResults.setText("");
        }
    }

    // ---------- HUD 悬浮窗（可拖动，不拦截屏幕操作） ----------

    private void showHud() {
        if (!Settings.canDrawOverlays(this)) return;
        if (hudView != null) return;
        hudView = new HudView(this);

        // 屏幕尺寸由 onDetections 回调动态设置（保证与检测坐标基准一致），此处用合理默认值
        hudView.screenW = 2560;
        hudView.screenH = 1600;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE,
                // 不抢焦点 + 允许触摸穿透到面板外
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = 24;
        params.y = 120;

        try {
            windowManager.addView(hudView, params);
            Log.d(TAG, "HUD shown");
        } catch (Exception e) {
            Log.e(TAG, "show HUD failed", e);
            hudView = null;
        }
    }

    private void hideHud() {
        if (hudView != null) {
            try {
                windowManager.removeView(hudView);
            } catch (Exception ignored) {
            }
            hudView = null;
        }
    }

    /**
     * HUD 面板：半透明小卡片，显示缩略图 + 检测结果。
     * 可拖动（在面板上拖动），面板外触摸穿透，不影响游戏操作。
     */
    private class HudView extends LinearLayout {
        private final TextView textView;
        private final Paint boxPaint = new Paint();
        private final Paint labelPaint = new Paint();
        private final Paint labelBgPaint = new Paint();

        private float lastX, lastY;
        private int startX, startY;
        private WindowManager.LayoutParams params;
        private List<YoloDetector.DetectionResult> detections;
        private int screenW = 2560;
        private int screenH = 1600;

        HudView(Context context) {
            super(context);
            setOrientation(VERTICAL);
            setPadding(dp(8), dp(6), dp(8), dp(6));
            setBackgroundColor(0xCC000000);

            // 文本 (悬浮窗只显示文字: 类别 坐标 置信度)
            textView = new TextView(context);
            textView.setTextColor(Color.WHITE);
            textView.setTextSize(13);
            textView.setText("等待识别...");
            textView.setPadding(dp(4), dp(2), dp(4), dp(2));
            addView(textView, new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT));

            // 画笔 (已不画缩略图，保留备用)
            boxPaint.setStyle(Paint.Style.STROKE);
            boxPaint.setStrokeWidth(dp(2));
            boxPaint.setColor(Color.RED);
            labelPaint.setColor(Color.WHITE);
            labelPaint.setTextSize(dp(9));
            labelBgPaint.setColor(0xCCFF0000);
        }

        private int dp(float v) {
            return (int) (getResources().getDisplayMetrics().density * v + 0.5f);
        }

        /** 主线程调用：更新文字。悬浮窗显示: 类别 + 中心坐标 + 置信度 */
        void update(Bitmap newFrame, List<YoloDetector.DetectionResult> newDetections) {
            this.detections = newDetections;

            // 不再生成缩略图(只显示文字，悬浮窗更简洁)

            if (newDetections == null || newDetections.isEmpty()) {
                textView.setText("未检测到图标");
            } else {
                // 每行: 类别 [中心坐标] 置信度
                StringBuilder sb = new StringBuilder();
                for (YoloDetector.DetectionResult d : newDetections) {
                    int cx = (int) (d.left + d.width / 2);
                    int cy = (int) (d.top + d.height / 2);
                    // 类别  坐标(x,y)  置信度%
                    sb.append(String.format(Locale.US, "%s  (%d,%d)  %.1f%%\n",
                            d.label, cx, cy, d.confidence * 100));
                }
                textView.setText(sb.toString().trim());
            }
        }

        /** 面板可拖动 */
        @Override
        public boolean onTouchEvent(MotionEvent event) {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    lastX = event.getRawX();
                    lastY = event.getRawY();
                    params = (WindowManager.LayoutParams) getLayoutParams();
                    startX = params.x;
                    startY = params.y;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if (params != null) {
                        params.x = startX + (int) (event.getRawX() - lastX);
                        params.y = startY + (int) (event.getRawY() - lastY);
                        windowManager.updateViewLayout(this, params);
                    }
                    return true;
            }
            return super.onTouchEvent(event);
        }
    }
}

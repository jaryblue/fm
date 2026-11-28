package com.zaikaiyiju.fmleague;

import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ClipDrawable;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONObject;

public final class OtaUpdater {
    private static final String TAG = "OtaUpdater";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final AtomicBoolean CHECK_IN_PROGRESS = new AtomicBoolean(false);
    private static final AtomicBoolean DIALOG_SHOWING = new AtomicBoolean(false);

    // 供 JS 桥接与壳状态持久化使用
    private static final String PREFS_OTA = "fm_ota_state";
    private static final String KEY_PENDING_VERSION = "pending_version";
    private static final String KEY_PENDING_HASH = "pending_hash";
    private static final String KEY_LAST_APK_UPDATE_TIME = "last_apk_update_time";
    private static final String KEY_LAST_APK_HASH = "last_apk_hash";

    /** 进程启动时 WebView 实际加载的 bundle 版本/hash */
    private static volatile String bootHash = "";
    private static volatile String bootVersion = "";

    private OtaUpdater() {}

    /**
     * 若用户覆盖安装了新 APK（lastUpdateTime 或内置 assets hash 变化），
     * 在 Capacitor 启动 WebView 前自动清除旧的 CAP_SERVER_PATH，确保直接加载新 APK 的最新资源。
     */
    public static void resetStaleOtaIfApkUpdated(Context context) {
        if (context == null) return;
        try {
            Context appCtx = context.getApplicationContext();
            PackageInfo pkgInfo = appCtx.getPackageManager().getPackageInfo(appCtx.getPackageName(), 0);
            long currentApkUpdateTime = pkgInfo.lastUpdateTime;
            JSONObject bundled = readBundledManifest(appCtx);
            String currentApkHash = bundled != null ? bundled.optString("hash", "").trim() : "";

            SharedPreferences otaPrefs = appCtx.getSharedPreferences(PREFS_OTA, Activity.MODE_PRIVATE);
            long savedUpdateTime = otaPrefs.getLong(KEY_LAST_APK_UPDATE_TIME, -1L);
            String savedApkHash = otaPrefs.getString(KEY_LAST_APK_HASH, "");

            boolean apkChanged = (savedUpdateTime != -1L && savedUpdateTime != currentApkUpdateTime)
                || (!savedApkHash.isEmpty() && !currentApkHash.isEmpty() && !savedApkHash.equals(currentApkHash));

            if (apkChanged) {
                Log.i(TAG, "Detected fresh APK install/update, clearing stale OTA CAP_SERVER_PATH");
                SharedPreferences webPrefs = appCtx.getSharedPreferences(
                    com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME,
                    Activity.MODE_PRIVATE
                );
                webPrefs.edit().remove(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH).commit();
                otaPrefs.edit()
                    .remove(KEY_PENDING_VERSION)
                    .remove(KEY_PENDING_HASH)
                    .commit();
            }

            if (savedUpdateTime != currentApkUpdateTime || !savedApkHash.equals(currentApkHash)) {
                otaPrefs.edit()
                    .putLong(KEY_LAST_APK_UPDATE_TIME, currentApkUpdateTime)
                    .putString(KEY_LAST_APK_HASH, currentApkHash)
                    .commit();
            }
        } catch (Exception e) {
            Log.w(TAG, "resetStaleOtaIfApkUpdated skipped: " + e.getMessage());
        }
    }

    /** 在 WebView 尚未被 OTA 改写激活路径前，快照当前实际加载的版本 */
    public static void captureBootVersion(Context context) {
        JSONObject manifest = readActiveManifest(context);
        if (manifest == null) {
            bootHash = "";
            bootVersion = "";
            return;
        }
        bootHash = manifest.optString("hash", "").trim();
        String v = manifest.optString("version", "").trim();
        bootVersion = !v.isEmpty() ? v : bootHash;
    }

    public static String getBootHash() { return bootHash; }
    public static String getBootVersion() { return bootVersion; }

    /** 返回已下载待生效的版本号；若已与当前运行版本一致则自动清理并返回 null */
    public static String getPendingVersion(Context context) {
        if (context == null) return null;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_OTA, Activity.MODE_PRIVATE);
        String pendingVersion = prefs.getString(KEY_PENDING_VERSION, null);
        String pendingHash = prefs.getString(KEY_PENDING_HASH, null);
        if (pendingVersion == null || pendingVersion.isEmpty()) return null;

        String runningHash = bootHash;
        if (runningHash == null || runningHash.isEmpty()) runningHash = readActiveHash(context);
        String runningVersion = bootVersion;
        if (runningVersion == null || runningVersion.isEmpty()) runningVersion = getActiveVersion(context);
        boolean alreadyActive =
            (pendingHash != null && !pendingHash.isEmpty() && pendingHash.equals(runningHash))
            || (pendingVersion.equals(runningVersion));
        if (alreadyActive) {
            prefs.edit().remove(KEY_PENDING_VERSION).remove(KEY_PENDING_HASH).commit();
            return null;
        }
        return pendingVersion;
    }

    /** 返回当前激活包的版本号（优先读取 OTA 释放目录中的 ota-manifest.json） */
    public static String getActiveVersion(Context context) {
        if (context == null) return "";
        JSONObject manifest = readActiveManifest(context);
        if (manifest == null) return "";
        String v = manifest.optString("version", "").trim();
        return !v.isEmpty() ? v : manifest.optString("hash", "").trim();
    }

    /** 重启应用以加载已下载的 OTA 包 */
    public static void restartApp(Context context) {
        if (context == null) return;
        Intent launch = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            Intent restartIntent;
            if (launch.getComponent() != null) {
                restartIntent = Intent.makeRestartActivityTask(launch.getComponent());
            } else {
                restartIntent = launch;
                restartIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            }
            context.startActivity(restartIntent);
        }
        android.os.Process.killProcess(android.os.Process.myPid());
        Runtime.getRuntime().exit(0);
    }

    /** 兼容旧调用入口 */
    public static void checkForUpdateInBackground(final Activity activity) {
        checkForUpdateWithPrompt(activity);
    }

    /**
     * 先校验远端 ota-manifest.json；
     * 若远端版本 hash 与当前运行版本不同，则弹出更新对话框，
     * 用户点击「立即更新」后展示实时下载进度条、校验完整性、解压并自动重启生效。
     */
    public static void checkForUpdateWithPrompt(final Activity activity) {
        if (activity == null || activity.isFinishing()) return;
        if (DIALOG_SHOWING.get()) return;
        if (!CHECK_IN_PROGRESS.compareAndSet(false, true)) return;

        final String rawBaseUrl = activity.getString(R.string.ota_base_url).trim();
        if (rawBaseUrl.isEmpty()) {
            CHECK_IN_PROGRESS.set(false);
            return;
        }

        final String baseUrl = rawBaseUrl.replaceAll("/+$", "");
        final Context appContext = activity.getApplicationContext();

        EXECUTOR.execute(() -> {
            try {
                String currentHash = readActiveHash(appContext);
                String manifestUrl = baseUrl + "/ota-manifest.json?t=" + System.currentTimeMillis();
                String manifestJson = fetchTextWithRetry(manifestUrl, 2);
                if (manifestJson == null || manifestJson.isEmpty()) {
                    Log.w(TAG, "OTA manifest fetch returned empty");
                    return;
                }

                JSONObject manifest = new JSONObject(manifestJson);
                String remoteHash = manifest.optString("hash", "").trim();
                String remoteVersion = manifest.optString("version", remoteHash).trim();
                String bundleZip = manifest.optString("bundleZip", "ota-bundle.zip").trim();
                String expectedSha256 = manifest.optString("zipSha256", "").trim();
                long expectedZipSize = manifest.optLong("zipSize", 0L);

                String runningHash = (bootHash != null && !bootHash.isEmpty()) ? bootHash : currentHash;
                String runningVersion = (bootVersion != null && !bootVersion.isEmpty()) ? bootVersion : getActiveVersion(appContext);
                if (runningVersion.isEmpty()) runningVersion = runningHash.isEmpty() ? "内置版本" : runningHash;

                if (remoteHash.isEmpty() || remoteHash.equals(runningHash)) {
                    appContext.getSharedPreferences(PREFS_OTA, Activity.MODE_PRIVATE)
                        .edit().remove(KEY_PENDING_VERSION).remove(KEY_PENDING_HASH).commit();
                    Log.i(TAG, "OTA up-to-date: " + runningVersion);
                    return;
                }

                File otaRoot = new File(appContext.getFilesDir(), "ota");
                File releasesDir = new File(otaRoot, "releases");
                File targetDir = new File(releasesDir, remoteHash);
                boolean alreadyReady = new File(targetDir, "index.html").exists()
                    && new File(targetDir, "ota-manifest.json").exists();

                String zipUrl = (bundleZip.startsWith("http://") || bundleZip.startsWith("https://"))
                    ? bundleZip
                    : baseUrl + "/" + bundleZip.replaceAll("^/+", "");

                final ReleaseInfo info = new ReleaseInfo(
                    runningVersion,
                    remoteVersion,
                    remoteHash,
                    zipUrl,
                    expectedSha256,
                    expectedZipSize,
                    alreadyReady
                );

                MAIN.post(() -> {
                    if (activity.isFinishing() || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && activity.isDestroyed())) {
                        return;
                    }
                    showUpdateDialog(activity, info);
                });
            } catch (Exception e) {
                Log.w(TAG, "OTA manifest check failed: " + e.getMessage());
            } finally {
                CHECK_IN_PROGRESS.set(false);
            }
        });
    }

    private static final class ReleaseInfo {
        final String currentVersion;
        final String remoteVersion;
        final String remoteHash;
        final String zipUrl;
        final String expectedSha256;
        final long expectedZipSize;
        final boolean alreadyReady;

        ReleaseInfo(String currentVersion, String remoteVersion, String remoteHash,
                    String zipUrl, String expectedSha256, long expectedZipSize, boolean alreadyReady) {
            this.currentVersion = currentVersion;
            this.remoteVersion = remoteVersion;
            this.remoteHash = remoteHash;
            this.zipUrl = zipUrl;
            this.expectedSha256 = expectedSha256;
            this.expectedZipSize = expectedZipSize;
            this.alreadyReady = alreadyReady;
        }
    }

    private static void showUpdateDialog(final Activity activity, final ReleaseInfo info) {
        if (!DIALOG_SHOWING.compareAndSet(false, true)) return;

        final Dialog dialog = new Dialog(activity);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setCanceledOnTouchOutside(false);
        dialog.setCancelable(true);

        int dp12 = dp(activity, 12);
        int dp16 = dp(activity, 16);
        int dp20 = dp(activity, 20);
        int dp24 = dp(activity, 24);

        // 根节点：PITCH PRINT 深松石纸板 + 黄铜粗边框
        LinearLayout root = new LinearLayout(activity);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp24, dp20, dp24, dp20);
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(Color.parseColor("#0A1A14"));
        cardBg.setCornerRadius(dp(activity, 14));
        cardBg.setStroke(dp(activity, 2), Color.parseColor("#D8A842"));
        root.setBackground(cardBg);

        // 顶部标签
        TextView badge = new TextView(activity);
        badge.setText("PITCH PRINT · 线上热更新");
        badge.setTextColor(Color.parseColor("#A3E635"));
        badge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        badge.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        root.addView(badge);

        // 标题
        final TextView titleView = new TextView(activity);
        titleView.setText("发现新版本");
        titleView.setTextColor(Color.parseColor("#FDE68A"));
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        titleView.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        titleLp.topMargin = dp(activity, 4);
        titleLp.bottomMargin = dp12;
        root.addView(titleView, titleLp);

        // 版本信息面板
        LinearLayout infoBox = new LinearLayout(activity);
        infoBox.setOrientation(LinearLayout.VERTICAL);
        infoBox.setPadding(dp16, dp12, dp16, dp12);
        GradientDrawable infoBg = new GradientDrawable();
        infoBg.setColor(Color.parseColor("#112820"));
        infoBg.setCornerRadius(dp(activity, 8));
        infoBg.setStroke(dp(activity, 1), Color.parseColor("#24483A"));
        infoBox.setBackground(infoBg);

        TextView curLine = new TextView(activity);
        curLine.setText("当前版本：" + info.currentVersion);
        curLine.setTextColor(Color.parseColor("#94A3B8"));
        curLine.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        infoBox.addView(curLine);

        TextView newLine = new TextView(activity);
        newLine.setText("最新版本：" + info.remoteVersion);
        newLine.setTextColor(Color.parseColor("#F4EFE4"));
        newLine.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        newLine.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams lineLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lineLp.topMargin = dp(activity, 4);
        infoBox.addView(newLine, lineLp);

        TextView sizeLine = new TextView(activity);
        if (info.alreadyReady) {
            sizeLine.setText("更新状态：新版本已缓存就绪，点击即可直接应用");
            sizeLine.setTextColor(Color.parseColor("#A3E635"));
        } else if (info.expectedZipSize > 0) {
            sizeLine.setText("更新包大小：" + formatSizeMb(info.expectedZipSize));
            sizeLine.setTextColor(Color.parseColor("#D8A842"));
        } else {
            sizeLine.setText("更新内容：最新界面与功能补丁包");
            sizeLine.setTextColor(Color.parseColor("#D8A842"));
        }
        sizeLine.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        LinearLayout.LayoutParams sizeLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        sizeLp.topMargin = dp(activity, 4);
        infoBox.addView(sizeLine, sizeLp);

        root.addView(infoBox, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        // 进度条与状态区（点击更新后展开）
        final LinearLayout progressBox = new LinearLayout(activity);
        progressBox.setOrientation(LinearLayout.VERTICAL);
        progressBox.setVisibility(View.GONE);
        LinearLayout.LayoutParams pbBoxLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        pbBoxLp.topMargin = dp16;
        root.addView(progressBox, pbBoxLp);

        final TextView statusView = new TextView(activity);
        statusView.setText("准备下载更新...");
        statusView.setTextColor(Color.parseColor("#E2E8F0"));
        statusView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        progressBox.addView(statusView);

        final ProgressBar progressBar = new ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgress(0);
        progressBar.setProgressDrawable(createProgressDrawable(activity));
        LinearLayout.LayoutParams barLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(activity, 12));
        barLp.topMargin = dp(activity, 8);
        progressBox.addView(progressBar, barLp);

        // 底部按钮行
        LinearLayout btnRow = new LinearLayout(activity);
        btnRow.setOrientation(LinearLayout.HORIZONTAL);
        btnRow.setGravity(Gravity.END);
        LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        rowLp.topMargin = dp20;
        root.addView(btnRow, rowLp);

        final Button laterBtn = createStyledButton(activity, "稍后再说", "#163329", "#CBD5E1", "#2B5243");
        LinearLayout.LayoutParams laterLp = new LinearLayout.LayoutParams(0, dp(activity, 44), 1f);
        laterLp.rightMargin = dp(activity, 10);
        btnRow.addView(laterBtn, laterLp);

        final Button updateBtn = createStyledButton(
            activity,
            info.alreadyReady ? "立即应用更新" : "立即更新",
            "#D8A842",
            "#0A1A14",
            "#FDE68A"
        );
        LinearLayout.LayoutParams updLp = new LinearLayout.LayoutParams(0, dp(activity, 44), 1.35f);
        btnRow.addView(updateBtn, updLp);

        final AtomicBoolean cancelled = new AtomicBoolean(false);
        final AtomicBoolean downloading = new AtomicBoolean(false);

        laterBtn.setOnClickListener(v -> {
            cancelled.set(true);
            dialog.dismiss();
        });

        updateBtn.setOnClickListener(v -> {
            if (!downloading.compareAndSet(false, true)) return;
            cancelled.set(false);
            dialog.setCancelable(false);
            titleView.setText(info.alreadyReady ? "正在应用更新..." : "正在下载更新...");
            progressBox.setVisibility(View.VISIBLE);
            statusView.setTextColor(Color.parseColor("#A3E635"));
            statusView.setText(info.alreadyReady ? "正在激活新版本..." : "正在连接更新服务器...");
            progressBar.setIndeterminate(false);
            progressBar.setProgress(info.alreadyReady ? 90 : 0);
            updateBtn.setEnabled(false);
            updateBtn.setAlpha(0.55f);
            laterBtn.setEnabled(false);
            laterBtn.setAlpha(0.45f);

            startInteractiveUpdate(activity, info, cancelled, new UpdateUiCallback() {
                @Override
                public void onProgress(int percent, String statusText, boolean indeterminate) {
                    MAIN.post(() -> {
                        if (!dialog.isShowing()) return;
                        progressBar.setIndeterminate(indeterminate);
                        if (!indeterminate) {
                            progressBar.setProgress(Math.max(0, Math.min(100, percent)));
                        }
                        statusView.setTextColor(Color.parseColor("#E2E8F0"));
                        statusView.setText(statusText);
                    });
                }

                @Override
                public void onSuccess() {
                    MAIN.post(() -> {
                        if (dialog.isShowing()) {
                            titleView.setText("更新完成");
                            progressBar.setIndeterminate(false);
                            progressBar.setProgress(100);
                            statusView.setTextColor(Color.parseColor("#A3E635"));
                            statusView.setText("更新安装完成，正在重启进入新版本...");
                        }
                        MAIN.postDelayed(() -> {
                            try {
                                if (dialog.isShowing()) dialog.dismiss();
                            } catch (Exception ignored) {}
                            restartApp(activity);
                        }, 450);
                    });
                }

                @Override
                public void onError(String message) {
                    downloading.set(false);
                    MAIN.post(() -> {
                        if (!dialog.isShowing()) return;
                        dialog.setCancelable(true);
                        titleView.setText("更新未完成");
                        progressBar.setIndeterminate(false);
                        statusView.setTextColor(Color.parseColor("#FCA5A5"));
                        statusView.setText(message);
                        updateBtn.setText("重试更新");
                        updateBtn.setEnabled(true);
                        updateBtn.setAlpha(1f);
                        laterBtn.setText("取消");
                        laterBtn.setEnabled(true);
                        laterBtn.setAlpha(1f);
                    });
                }
            });
        });

        dialog.setOnDismissListener(d -> DIALOG_SHOWING.set(false));
        dialog.setContentView(root);

        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            int screenW = activity.getResources().getDisplayMetrics().widthPixels;
            int targetW = Math.min(dp(activity, 460), (int) (screenW * 0.86f));
            window.setLayout(targetW, WindowManager.LayoutParams.WRAP_CONTENT);
        }
        dialog.show();
    }

    private interface UpdateUiCallback {
        void onProgress(int percent, String statusText, boolean indeterminate);
        void onSuccess();
        void onError(String message);
    }

    private static void startInteractiveUpdate(
        final Activity activity,
        final ReleaseInfo info,
        final AtomicBoolean cancelled,
        final UpdateUiCallback cb
    ) {
        final Context appContext = activity.getApplicationContext();
        EXECUTOR.execute(() -> {
            File tmpZip = null;
            File stagingDir = null;
            try {
                File otaRoot = new File(appContext.getFilesDir(), "ota");
                File releasesDir = new File(otaRoot, "releases");
                File targetDir = new File(releasesDir, info.remoteHash);

                if (!(new File(targetDir, "index.html").exists()
                        && new File(targetDir, "ota-manifest.json").exists())) {

                    tmpZip = new File(appContext.getCacheDir(), "ota_" + info.remoteHash + ".zip");
                    if (tmpZip.exists()) {
                        //noinspection ResultOfMethodCallIgnored
                        tmpZip.delete();
                    }

                    // 1. 下载更新包（带实时进度）
                    downloadFileWithProgress(info.zipUrl, tmpZip, info.expectedZipSize, cancelled, cb);
                    if (cancelled.get()) {
                        //noinspection ResultOfMethodCallIgnored
                        tmpZip.delete();
                        return;
                    }

                    // 2. 校验 SHA-256
                    cb.onProgress(100, "正在校验更新包完整性...", true);
                    if (!info.expectedSha256.isEmpty()) {
                        String actualSha256 = sha256Hex(tmpZip);
                        if (!info.expectedSha256.equalsIgnoreCase(actualSha256)) {
                            Log.w(TAG, "OTA zip sha256 mismatch: expected=" + info.expectedSha256 + " actual=" + actualSha256);
                            throw new IllegalStateException("更新包校验不匹配，可能下载不完整，请重试");
                        }
                    }

                    // 3. 安全解压（带进度）
                    stagingDir = new File(releasesDir, info.remoteHash + "_tmp");
                    deleteRecursive(stagingDir);
                    cb.onProgress(0, "正在解压安装更新...", false);
                    unzipSafelyWithProgress(tmpZip, stagingDir, cb);

                    //noinspection ResultOfMethodCallIgnored
                    tmpZip.delete();
                    tmpZip = null;

                    if (!new File(stagingDir, "index.html").exists()) {
                        throw new IllegalStateException("更新包缺少入口文件 index.html");
                    }

                    deleteRecursive(targetDir);
                    if (!stagingDir.renameTo(targetDir)) {
                        throw new IllegalStateException("安装目录替换失败，请检查存储空间后重试");
                    }
                    stagingDir = null;
                }

                // 4. 激活新版本并清理旧目录
                activateRelease(appContext, targetDir);
                cleanupOldReleases(releasesDir, info.remoteHash);
                appContext.getSharedPreferences(PREFS_OTA, Activity.MODE_PRIVATE)
                    .edit()
                    .remove(KEY_PENDING_VERSION)
                    .remove(KEY_PENDING_HASH)
                    .commit();

                cb.onSuccess();
            } catch (Exception e) {
                Log.w(TAG, "Interactive OTA failed: " + e.getMessage(), e);
                if (tmpZip != null && tmpZip.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    tmpZip.delete();
                }
                if (stagingDir != null && stagingDir.exists()) {
                    deleteRecursive(stagingDir);
                }
                cb.onError("更新失败：" + friendlyError(e));
            }
        });
    }

    private static void activateRelease(Context context, File releaseDir) {
        SharedPreferences prefs = context.getSharedPreferences(
            com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME,
            Activity.MODE_PRIVATE
        );
        prefs.edit()
            .putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, releaseDir.getAbsolutePath())
            .commit();
    }

    private static JSONObject readBundledManifest(Context context) {
        try (InputStream is = context.getAssets().open("public/ota-manifest.json")) {
            return new JSONObject(readStreamText(is));
        } catch (Exception ignored) {
            return null;
        }
    }

    private static JSONObject readActiveManifest(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(
                com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME,
                Activity.MODE_PRIVATE
            );
            String serverPath = prefs.getString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, null);
            if (serverPath != null && !serverPath.isEmpty()) {
                File activeManifest = new File(serverPath, "ota-manifest.json");
                if (activeManifest.exists()) {
                    try (FileInputStream fis = new FileInputStream(activeManifest)) {
                        return new JSONObject(readStreamText(fis));
                    }
                }
            }
            return readBundledManifest(context);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String readActiveHash(Context context) {
        JSONObject obj = readActiveManifest(context);
        return obj != null ? obj.optString("hash", "").trim() : "";
    }

    private static HttpURLConnection openConnectionWithRedirects(String urlStr, int connectTimeoutMs, int readTimeoutMs) throws Exception {
        String currentUrl = urlStr;
        for (int hops = 0; hops < 5; hops++) {
            HttpURLConnection conn = (HttpURLConnection) new URL(currentUrl).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(connectTimeoutMs);
            conn.setReadTimeout(readTimeoutMs);
            conn.setUseCaches(false);
            conn.setRequestProperty("Cache-Control", "no-cache");
            conn.setRequestProperty("Accept-Encoding", "identity");
            int code = conn.getResponseCode();
            if (code == HttpURLConnection.HTTP_MOVED_PERM
                    || code == HttpURLConnection.HTTP_MOVED_TEMP
                    || code == HttpURLConnection.HTTP_SEE_OTHER
                    || code == 307
                    || code == 308) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new IllegalStateException("重定向缺少目标地址 (HTTP " + code + ")");
                }
                currentUrl = new URL(new URL(currentUrl), location).toString();
                continue;
            }
            return conn;
        }
        throw new IllegalStateException("服务器重定向次数过多");
    }

    private static String fetchTextWithRetry(String urlStr, int maxAttempts) throws Exception {
        Exception lastErr = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            HttpURLConnection conn = null;
            try {
                conn = openConnectionWithRedirects(urlStr, 10000, 15000);
                int code = conn.getResponseCode();
                if (code != HttpURLConnection.HTTP_OK) {
                    throw new IllegalStateException("HTTP " + code);
                }
                try (InputStream is = conn.getInputStream()) {
                    return readStreamText(is);
                }
            } catch (Exception e) {
                lastErr = e;
                Log.w(TAG, "fetchText attempt " + attempt + " failed: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        }
        if (lastErr != null) throw lastErr;
        return null;
    }

    private static void downloadFileWithProgress(
        String urlStr,
        File destFile,
        long fallbackTotalBytes,
        AtomicBoolean cancelled,
        UpdateUiCallback cb
    ) throws Exception {
        HttpURLConnection conn = openConnectionWithRedirects(urlStr, 15000, 60000);
        try {
            int code = conn.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("服务器返回 HTTP " + code);
            }
            long headerLen = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
                ? conn.getContentLengthLong()
                : conn.getContentLength();
            long totalBytes = headerLen > 0 ? headerLen : fallbackTotalBytes;

            File parent = destFile.getParentFile();
            if (parent != null && !parent.exists()) {
                //noinspection ResultOfMethodCallIgnored
                parent.mkdirs();
            }

            long downloaded = 0L;
            int lastPercent = -1;
            long lastNotifyMs = 0L;

            try (InputStream in = new BufferedInputStream(conn.getInputStream(), 32768);
                 FileOutputStream out = new FileOutputStream(destFile)) {
                byte[] buf = new byte[32768];
                int n;
                while ((n = in.read(buf)) != -1) {
                    if (cancelled.get()) {
                        return;
                    }
                    out.write(buf, 0, n);
                    downloaded += n;

                    long now = System.currentTimeMillis();
                    if (totalBytes > 0) {
                        int pct = (int) Math.min(100L, (downloaded * 100L) / totalBytes);
                        if (pct != lastPercent && (now - lastNotifyMs >= 60 || pct == 100)) {
                            lastPercent = pct;
                            lastNotifyMs = now;
                            cb.onProgress(
                                pct,
                                String.format(Locale.US, "正在下载更新... %d%%  (%s / %s)",
                                    pct, formatSizeMb(downloaded), formatSizeMb(totalBytes)),
                                false
                            );
                        }
                    } else if (now - lastNotifyMs >= 120) {
                        lastNotifyMs = now;
                        cb.onProgress(0, "正在下载更新... 已下载 " + formatSizeMb(downloaded), true);
                    }
                }
                out.flush();
            }

            if (totalBytes > 0 && downloaded < totalBytes && !cancelled.get()) {
                throw new IllegalStateException("连接提前中断，仅下载 " + formatSizeMb(downloaded) + " / " + formatSizeMb(totalBytes));
            }
        } finally {
            conn.disconnect();
        }
    }

    private static String sha256Hex(File file) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(file)) {
            byte[] buf = new byte[32768];
            int n;
            while ((n = in.read(buf)) != -1) {
                md.update(buf, 0, n);
            }
        }
        byte[] digest = md.digest();
        StringBuilder sb = new StringBuilder(digest.length * 2);
        for (byte b : digest) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private static void unzipSafelyWithProgress(File zipFile, File destDir, UpdateUiCallback cb) throws Exception {
        if (!destDir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            destDir.mkdirs();
        }
        String destCanonical = destDir.getCanonicalPath() + File.separator;
        long totalZipSize = Math.max(1L, zipFile.length());
        long consumedCompressed = 0L;
        int lastPct = -1;

        try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile), 32768))) {
            ZipEntry entry;
            byte[] buf = new byte[32768];
            while ((entry = zis.getNextEntry()) != null) {
                File outFile = new File(destDir, entry.getName());
                String outCanonical = outFile.getCanonicalPath();
                if (!outCanonical.startsWith(destCanonical) && !outCanonical.equals(destDir.getCanonicalPath())) {
                    throw new SecurityException("Blocked zip path traversal: " + entry.getName());
                }
                if (entry.isDirectory()) {
                    //noinspection ResultOfMethodCallIgnored
                    outFile.mkdirs();
                } else {
                    File parent = outFile.getParentFile();
                    if (parent != null && !parent.exists()) {
                        //noinspection ResultOfMethodCallIgnored
                        parent.mkdirs();
                    }
                    try (BufferedOutputStream bos = new BufferedOutputStream(new FileOutputStream(outFile), 32768)) {
                        int n;
                        while ((n = zis.read(buf)) != -1) {
                            bos.write(buf, 0, n);
                        }
                    }
                }
                long comp = entry.getCompressedSize();
                if (comp > 0) consumedCompressed += comp;
                int pct = (int) Math.min(99L, (consumedCompressed * 100L) / totalZipSize);
                if (pct > lastPct) {
                    lastPct = pct;
                    cb.onProgress(pct, "正在解压安装更新... " + pct + "%", false);
                }
                zis.closeEntry();
            }
        }
        cb.onProgress(100, "解压完成，正在应用更新...", false);
    }

    private static void cleanupOldReleases(File releasesDir, String keepHash) {
        File[] children = releasesDir.listFiles();
        if (children == null) return;
        for (File child : children) {
            if (!child.getName().equals(keepHash)) {
                deleteRecursive(child);
            }
        }
    }

    private static void deleteRecursive(File target) {
        if (target == null || !target.exists()) return;
        if (target.isDirectory()) {
            File[] files = target.listFiles();
            if (files != null) {
                for (File f : files) deleteRecursive(f);
            }
        }
        //noinspection ResultOfMethodCallIgnored
        target.delete();
    }

    private static String readStreamText(InputStream is) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = is.read(buf)) != -1) {
            baos.write(buf, 0, n);
        }
        return baos.toString(StandardCharsets.UTF_8.name());
    }

    private static Drawable createProgressDrawable(Context ctx) {
        int radius = dp(ctx, 6);
        GradientDrawable track = new GradientDrawable();
        track.setColor(Color.parseColor("#18382C"));
        track.setCornerRadius(radius);

        GradientDrawable fill = new GradientDrawable();
        fill.setColor(Color.parseColor("#A3E635"));
        fill.setCornerRadius(radius);

        ClipDrawable clip = new ClipDrawable(fill, Gravity.LEFT, ClipDrawable.HORIZONTAL);
        LayerDrawable layer = new LayerDrawable(new Drawable[] { track, clip });
        layer.setId(0, android.R.id.background);
        layer.setId(1, android.R.id.progress);
        return layer;
    }

    private static Button createStyledButton(Context ctx, String text, String bgHex, String textHex, String strokeHex) {
        Button btn = new Button(ctx);
        btn.setText(text);
        btn.setAllCaps(false);
        btn.setTextColor(Color.parseColor(textHex));
        btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        btn.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor(bgHex));
        bg.setCornerRadius(dp(ctx, 8));
        bg.setStroke(dp(ctx, 1), Color.parseColor(strokeHex));
        btn.setBackground(bg);
        btn.setPadding(dp(ctx, 12), 0, dp(ctx, 12), 0);
        return btn;
    }

    private static String formatSizeMb(long bytes) {
        double mb = bytes / (1024.0 * 1024.0);
        return String.format(Locale.US, "%.1f MB", mb);
    }

    private static String friendlyError(Exception e) {
        String msg = e.getMessage();
        if (msg == null || msg.isEmpty()) return "网络连接异常，请稍后重试";
        if (msg.contains("timed out") || msg.contains("Timeout")) return "连接超时，请检查网络后重试";
        if (msg.contains("Unable to resolve host")) return "无法解析更新服务器，请检查网络";
        return msg;
    }

    private static int dp(Context ctx, int dp) {
        return Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, dp, ctx.getResources().getDisplayMetrics()
        ));
    }
}

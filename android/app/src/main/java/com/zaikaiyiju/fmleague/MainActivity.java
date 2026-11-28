package com.zaikaiyiju.fmleague;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 如果安装了全新 APK，必须在 Capacitor 初始化 WebView 之前清理旧的 OTA 路径，
        // 避免新装 APK 仍然加载磁盘上残留的旧热更包。
        OtaUpdater.resetStaleOtaIfApkUpdated(this);
        super.onCreate(savedInstanceState);
        applyImmersiveFullscreen();
        // 在任何 OTA 改写磁盘激活路径之前，快照 WebView 本次实际加载的版本。
        OtaUpdater.captureBootVersion(this);
        // OTA 状态桥接：让 WebView 内的 JS 查询待生效更新、手动检查或触发重启
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new OtaJsBridge(this), "AndroidOtaBridge");
        }
        // 启动先校验远端清单；发现新版本后弹窗提示，由用户点击后带进度条下载并重启生效
        OtaUpdater.checkForUpdateWithPrompt(this);
    }

    /** 注入到 WebView 的 OTA 桥接对象 */
    public static class OtaJsBridge {
        private final MainActivity activity;
        private final android.content.Context ctx;

        OtaJsBridge(MainActivity activity) {
            this.activity = activity;
            this.ctx = activity.getApplicationContext();
        }

        @JavascriptInterface
        public String getOtaStatus() {
            String pending = OtaUpdater.getPendingVersion(ctx);
            String active = OtaUpdater.getBootVersion();
            if (active == null || active.isEmpty()) active = OtaUpdater.getActiveVersion(ctx);
            android.util.Log.d("OtaJsBridge", "getOtaStatus pending=" + pending + " active=" + active);
            org.json.JSONObject obj = new org.json.JSONObject();
            try {
                obj.put("pendingVersion", pending);
                obj.put("activeVersion", active);
            } catch (org.json.JSONException ignored) {
            }
            return obj.toString();
        }

        @JavascriptInterface
        public void checkForUpdate() {
            OtaUpdater.checkForUpdateWithPrompt(activity);
        }

        @JavascriptInterface
        public void restartApp() {
            OtaUpdater.restartApp(ctx);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveFullscreen();
        }
    }

    private void applyImmersiveFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#0A1A14"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        }
    }
}

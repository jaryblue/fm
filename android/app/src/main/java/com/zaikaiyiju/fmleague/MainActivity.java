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
        super.onCreate(savedInstanceState);
        applyImmersiveFullscreen();
        // 在后台 OTA 改写磁盘激活路径之前，快照 WebView 本次实际加载的版本。
        // 这个基准用于判定 pending 是否「已重启生效」，不能等下载完成后再读磁盘。
        OtaUpdater.captureBootVersion(this);
        // OTA 状态桥接：让 WebView 内的 JS 查询待生效更新并触发重启
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new OtaJsBridge(this), "AndroidOtaBridge");
        }
        OtaUpdater.checkForUpdateInBackground(this);
    }

    /** 注入到 WebView 的 OTA 桥接对象 */
    public static class OtaJsBridge {
        private final android.content.Context ctx;

        OtaJsBridge(android.content.Context context) {
            this.ctx = context.getApplicationContext();
        }

        @JavascriptInterface
        public String getOtaStatus() {
            String pending = OtaUpdater.getPendingVersion(ctx);
            // activeVersion 表示「当前进程实际运行的版本」，与前端 __FM_NATIVE_VERSION__ 对齐；
            // 不能用磁盘激活路径（下载完成后会提前指向新包，误导前端判定）。
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
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#04070D"));
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

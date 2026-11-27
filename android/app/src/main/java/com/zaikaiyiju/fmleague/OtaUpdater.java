package com.zaikaiyiju.fmleague;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONObject;

public final class OtaUpdater {
    private static final String TAG = "OtaUpdater";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static volatile boolean started = false;

    // 供 JS 桥接读取：已下载完成、等待下次启动生效的版本号
    private static final String PREFS_OTA = "fm_ota_state";
    private static final String KEY_PENDING_VERSION = "pending_version";
    private static final String KEY_PENDING_HASH = "pending_hash";

    /**
     * 进程启动时 WebView 实际加载的 bundle 版本/hash。
     * 必须在下载激活新包之前记录（见 MainActivity.onCreate），
     * 否则磁盘激活路径已被改写，会把「下载完成」误判为「已重启生效」。
     */
    private static volatile String bootHash = "";
    private static volatile String bootVersion = "";

    private OtaUpdater() {}

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

        // 判定基准必须是「本次进程实际加载的版本」，不是磁盘激活路径。
        // download 完成后 activateRelease 会立刻改写磁盘激活路径，但旧 WebView 进程仍在跑老 bundle；
        // 用磁盘路径判定会把「下载完成」误当成「重启已生效」，导致 pending 被提前清掉、弹窗永不出现。
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
        android.content.Intent launch = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            android.content.Intent restartIntent;
            if (launch.getComponent() != null) {
                restartIntent = android.content.Intent.makeRestartActivityTask(launch.getComponent());
            } else {
                restartIntent = launch;
                restartIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK
                    | android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK);
            }
            context.startActivity(restartIntent);
        }
        android.os.Process.killProcess(android.os.Process.myPid());
        Runtime.getRuntime().exit(0);
    }

    public static void checkForUpdateInBackground(final Activity activity) {
        if (started || activity == null) return;
        final String rawBaseUrl = activity.getString(R.string.ota_base_url).trim();
        if (rawBaseUrl.isEmpty()) return;

        started = true;
        final String baseUrl = rawBaseUrl.replaceAll("/+$", "");
        final Context appContext = activity.getApplicationContext();

        EXECUTOR.execute(() -> {
            try {
                String currentHash = readActiveHash(appContext);
                String manifestUrl = baseUrl + "/ota-manifest.json?t=" + System.currentTimeMillis();
                String manifestJson = fetchText(manifestUrl);
                if (manifestJson == null || manifestJson.isEmpty()) return;

                JSONObject manifest = new JSONObject(manifestJson);
                String remoteHash = manifest.optString("hash", "").trim();
                String remoteVersion = manifest.optString("version", remoteHash).trim();
                String bundleZip = manifest.optString("bundleZip", "ota-bundle.zip").trim();
                String expectedSha256 = manifest.optString("zipSha256", "").trim();

                // 以「本次进程实际运行的版本」为准判断是否已是最新。
                // 磁盘激活路径在下载完成后就会被改写，若用它比较，重启后的新进程会误以为
                // 远端与本地一致而清掉刚写入的 pending（虽然那种场景 pending 本就该清，
                // 但反过来在「已下载、未重启」的旧进程里，磁盘路径已是新版本，也会命中此分支）。
                String runningHash = (bootHash != null && !bootHash.isEmpty()) ? bootHash : currentHash;
                if (remoteHash.isEmpty() || remoteHash.equals(runningHash)) {
                    appContext.getSharedPreferences(PREFS_OTA, Activity.MODE_PRIVATE)
                        .edit().remove(KEY_PENDING_VERSION).remove(KEY_PENDING_HASH).commit();
                    return;
                }

                File otaRoot = new File(appContext.getFilesDir(), "ota");
                File releasesDir = new File(otaRoot, "releases");
                File targetDir = new File(releasesDir, remoteHash);
                if (new File(targetDir, "index.html").exists()
                        && new File(targetDir, "ota-manifest.json").exists()) {
                    activateRelease(appContext, targetDir);
                    appContext.getSharedPreferences(PREFS_OTA, Activity.MODE_PRIVATE)
                        .edit()
                        .putString(KEY_PENDING_VERSION, remoteVersion)
                        .putString(KEY_PENDING_HASH, remoteHash)
                        .commit();
                    return;
                }

                String zipUrl = bundleZip.startsWith("http://") || bundleZip.startsWith("https://")
                    ? bundleZip
                    : baseUrl + "/" + bundleZip.replaceAll("^/+", "");

                File tmpZip = new File(appContext.getCacheDir(), "ota_" + remoteHash + ".zip");
                downloadFile(zipUrl, tmpZip);

                if (!expectedSha256.isEmpty()) {
                    String actualSha256 = sha256Hex(tmpZip);
                    if (!expectedSha256.equalsIgnoreCase(actualSha256)) {
                        Log.w(TAG, "OTA zip sha256 mismatch: expected=" + expectedSha256 + " actual=" + actualSha256);
                        //noinspection ResultOfMethodCallIgnored
                        tmpZip.delete();
                        return;
                    }
                }

                File stagingDir = new File(releasesDir, remoteHash + "_tmp");
                deleteRecursive(stagingDir);
                unzipSafely(tmpZip, stagingDir);
                //noinspection ResultOfMethodCallIgnored
                tmpZip.delete();

                if (!new File(stagingDir, "index.html").exists()) {
                    Log.w(TAG, "OTA package missing index.html");
                    deleteRecursive(stagingDir);
                    return;
                }

                deleteRecursive(targetDir);
                if (!stagingDir.renameTo(targetDir)) {
                    Log.w(TAG, "Failed to move OTA staging dir");
                    deleteRecursive(stagingDir);
                    return;
                }

                activateRelease(appContext, targetDir);
                cleanupOldReleases(releasesDir, remoteHash);

                // 同步写入待生效版本与 hash，确保立即重启时不会丢失
                appContext.getSharedPreferences(PREFS_OTA, Activity.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_PENDING_VERSION, remoteVersion)
                    .putString(KEY_PENDING_HASH, remoteHash)
                    .commit();

                new Handler(Looper.getMainLooper()).post(() ->
                    Toast.makeText(appContext, "发现新版本 (" + remoteVersion + ")，已下载完成，下次启动生效", Toast.LENGTH_SHORT).show()
                );
            } catch (Exception e) {
                Log.w(TAG, "OTA check skipped/failed: " + e.getMessage());
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
            try (InputStream is = context.getAssets().open("public/ota-manifest.json")) {
                return new JSONObject(readStreamText(is));
            }
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String readActiveHash(Context context) {
        JSONObject obj = readActiveManifest(context);
        return obj != null ? obj.optString("hash", "").trim() : "";
    }

    private static String fetchText(String urlStr) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(10000);
        conn.setUseCaches(false);
        conn.setRequestProperty("Cache-Control", "no-cache");
        try {
            if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) return null;
            try (InputStream is = conn.getInputStream()) {
                return readStreamText(is);
            }
        } finally {
            conn.disconnect();
        }
    }

    private static void downloadFile(String urlStr, File destFile) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(30000);
        conn.setUseCaches(false);
        try {
            if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("HTTP " + conn.getResponseCode());
            }
            File parent = destFile.getParentFile();
            if (parent != null && !parent.exists()) {
                //noinspection ResultOfMethodCallIgnored
                parent.mkdirs();
            }
            try (InputStream in = new BufferedInputStream(conn.getInputStream());
                 FileOutputStream out = new FileOutputStream(destFile)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) != -1) {
                    out.write(buf, 0, n);
                }
            }
        } finally {
            conn.disconnect();
        }
    }

    private static String sha256Hex(File file) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(file)) {
            byte[] buf = new byte[8192];
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

    private static void unzipSafely(File zipFile, File destDir) throws Exception {
        if (!destDir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            destDir.mkdirs();
        }
        String destCanonical = destDir.getCanonicalPath() + File.separator;
        try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile)))) {
            ZipEntry entry;
            byte[] buf = new byte[8192];
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
                    try (BufferedOutputStream bos = new BufferedOutputStream(new FileOutputStream(outFile))) {
                        int n;
                        while ((n = zis.read(buf)) != -1) {
                            bos.write(buf, 0, n);
                        }
                    }
                }
                zis.closeEntry();
            }
        }
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
}

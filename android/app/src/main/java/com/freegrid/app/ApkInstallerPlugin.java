package com.freegrid.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.security.MessageDigest;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {
    private static final String RELEASE_CERT_SHA256 = "0ce657932cd56ec583fd081812d2870a3c50ed9f655d33abadd5dadab6405d87";

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void openInstaller(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("Allow this app to install updates first.", "install_permission_required");
            return;
        }

        String path = call.getString("path");
        if (path == null || path.trim().isEmpty()) {
            call.reject("APK path is missing.", "invalid_apk_path");
            return;
        }

        try {
            File apk = new File(path).getCanonicalFile();
            File cacheDirectory = getContext().getCacheDir().getCanonicalFile();
            if (!apk.isFile() || !apk.getPath().startsWith(cacheDirectory.getPath() + File.separator)) {
                call.reject("APK must be inside the app cache directory.", "invalid_apk_path");
                return;
            }

            PackageInfo candidate = readApkInfo(apk);
            if (candidate == null || !getContext().getPackageName().equals(candidate.packageName)) {
                call.reject("The downloaded package does not match this app.", "wrong_package");
                return;
            }
            if (readVersionCode(candidate) <= readInstalledVersionCode()) {
                call.reject("The downloaded version is not newer than the installed version.", "old_version");
                return;
            }
            if (!hasReleaseSignature(candidate)) {
                call.reject("The APK does not use the trusted release certificate.", "wrong_signature");
                return;
            }

            Uri apkUri = FileProvider.getUriForFile(
                    getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open the Android installer.", "installer_error", error);
        }
    }

    private PackageInfo readApkInfo(File apk) {
        PackageManager packageManager = getContext().getPackageManager();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return packageManager.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNING_CERTIFICATES);
        }
        return packageManager.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
    }

    private long readVersionCode(PackageInfo packageInfo) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return packageInfo.getLongVersionCode();
        return packageInfo.versionCode;
    }

    private long readInstalledVersionCode() throws PackageManager.NameNotFoundException {
        PackageInfo installed = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
        return readVersionCode(installed);
    }

    private boolean hasReleaseSignature(PackageInfo packageInfo) throws Exception {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (packageInfo.signingInfo == null) return false;
            signatures = packageInfo.signingInfo.hasMultipleSigners()
                    ? packageInfo.signingInfo.getApkContentsSigners()
                    : packageInfo.signingInfo.getSigningCertificateHistory();
        } else {
            signatures = packageInfo.signatures;
        }
        if (signatures == null) return false;

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (Signature signature : signatures) {
            byte[] hash = digest.digest(signature.toByteArray());
            StringBuilder fingerprint = new StringBuilder();
            for (byte value : hash) fingerprint.append(String.format("%02x", value & 0xff));
            if (RELEASE_CERT_SHA256.equals(fingerprint.toString())) return true;
        }
        return false;
    }
}
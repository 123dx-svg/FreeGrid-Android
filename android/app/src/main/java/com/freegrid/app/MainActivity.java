package com.freegrid.app;

import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Screen-scale adaptation:
    // iQOO (Origin/Funtouch OS), OPPO (ColorOS) etc. pass the system font-size /
    // display-size scaling into the WebView, so the whole frame looks zoomed;
    // Xiaomi (HyperOS) does not. Force the device stable density + fontScale=1 so
    // all phones match. When already default (e.g. Xiaomi) this is a no-op.
    @Override
    protected void attachBaseContext(Context newBase) {
        Configuration cfg = new Configuration(newBase.getResources().getConfiguration());
        cfg.fontScale = 1.0f;
        cfg.densityDpi = DisplayMetrics.DENSITY_DEVICE_STABLE;
        super.attachBaseContext(newBase.createConfigurationContext(cfg));
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FreedomWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        WebView wv = this.bridge != null ? this.bridge.getWebView() : null;
        if (wv != null) {
            WebSettings ws = wv.getSettings();
            // Lock text zoom to 100% (ignore system font size)
            ws.setTextZoom(100);
            // Honor the fixed <meta viewport width=411> so the layout renders at a
            // reference width scaled to fill the screen -> identical module
            // proportions on every device width. Capacitor leaves useWideViewPort
            // at its default (false), which makes WebView ignore the width tag.
            ws.setUseWideViewPort(true);
            ws.setLoadWithOverviewMode(true);
        }
    }
}
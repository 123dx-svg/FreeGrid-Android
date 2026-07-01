package com.freegrid.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor 插件:Web 侧把「自由时间」快照写进 SharedPreferences,并刷新桌面小部件。
 * JS: registerPlugin("FreedomWidget").update({ state, kicker, number, unit, sub })
 */
@CapacitorPlugin(name = "FreedomWidget")
public class FreedomWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences p = ctx.getSharedPreferences(FreedomWidgetProvider.PREFS, Context.MODE_PRIVATE);
        p.edit()
                .putString("state", call.getString("state", "empty"))
                .putString("kicker", call.getString("kicker", "FREEDOM"))
                .putString("number", call.getString("number", "—"))
                .putString("unit", call.getString("unit", ""))
                .putString("sub", call.getString("sub", ""))
                .apply();
        FreedomWidgetProvider.renderAll(ctx);
        call.resolve();
    }
}

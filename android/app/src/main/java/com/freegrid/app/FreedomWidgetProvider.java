package com.freegrid.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * 桌面小部件「自由时间」—— 只渲染 App 通过 FreedomWidgetPlugin 写入 SharedPreferences 的快照。
 * 所有数值/格式化都在 Web 侧算好,这里保持“笨”渲染。星空/流星是静态背景图(小部件不能做动画)。
 */
public class FreedomWidgetProvider extends AppWidgetProvider {
    public static final String PREFS = "freegrid_widget";

    private static final int FLAGS = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

    private static PendingIntent openApp(Context ctx, int reqCode, String deepLink) {
        Intent intent;
        if (deepLink != null) {
            intent = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLink));
            intent.setClass(ctx, MainActivity.class);
        } else {
            intent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
            if (intent == null) {
                intent = new Intent(ctx, MainActivity.class);
            }
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, reqCode, intent, FLAGS);
    }

    static void render(Context ctx, AppWidgetManager mgr, int id) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.freedom_widget);

        v.setTextViewText(R.id.widget_kicker, p.getString("kicker", "FREEDOM"));
        v.setTextViewText(R.id.widget_number, p.getString("number", "—"));
        v.setTextViewText(R.id.widget_unit, p.getString("unit", ""));
        v.setTextViewText(R.id.widget_sub, p.getString("sub", "打开 App 记一笔"));

        // 点中部 = 打开 App;两个按钮 = 复用桌面快捷方式的深链直达记账
        v.setOnClickPendingIntent(R.id.widget_center, openApp(ctx, 0, null));
        v.setOnClickPendingIntent(R.id.widget_btn_expense, openApp(ctx, 1, "freegrid://record/expense"));
        v.setOnClickPendingIntent(R.id.widget_btn_income, openApp(ctx, 2, "freegrid://record/income"));

        mgr.updateAppWidget(id, v);
    }

    /** 供插件在数据更新后刷新所有已放置的小部件。 */
    static void renderAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, FreedomWidgetProvider.class));
        for (int id : ids) {
            render(ctx, mgr, id);
        }
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            render(ctx, mgr, id);
        }
    }
}

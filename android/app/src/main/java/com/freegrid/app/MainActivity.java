package com.freegrid.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FreedomWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

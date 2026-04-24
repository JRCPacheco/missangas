package com.jrcpacheco.missangas;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        
        // Acessa o WebView do Capacitor para ajustar configurações de renderização
        WebView webView = this.getBridge().getWebView();
        WebSettings settings = webView.getSettings();

        // Habilita suporte a High DPI e Viewport amplo
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        
        // Desativa interpolação suave que pode causar borrão em imagens pequenas/pixeladas
        settings.setEnableSmoothTransition(false);

        // Força a renderização por hardware
        webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
    }
}

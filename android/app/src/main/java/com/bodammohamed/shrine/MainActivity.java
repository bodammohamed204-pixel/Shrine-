package com.bodammohamed.shrine;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    configureSystemBars();
  }

  private void configureSystemBars() {
    Window window = getWindow();
    window.setStatusBarColor(Color.BLACK);
    window.setNavigationBarColor(Color.BLACK);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.setDecorFitsSystemWindows(true);
      WindowInsetsController controller = window.getInsetsController();
      if (controller != null) {
        controller.setSystemBarsAppearance(
          0,
          WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
            | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
        );
      }
      return;
    }

    View decorView = window.getDecorView();
    int flags = decorView.getSystemUiVisibility();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
    }
    decorView.setSystemUiVisibility(flags);
  }
}

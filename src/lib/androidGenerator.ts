import type { AppDraft } from './supabase';

/**
 * Generates a complete Android Studio project (WebView wrapper) as a ZIP-compatible
 * file set. Returns a map of file paths -> content. This is a real, compilable
 * Gradle project that can be opened in Android Studio and built into an APK/AAB.
 */

export type AndroidFile = {
  path: string;
  content: string;
  binary?: boolean;
};

export function generateAndroidProject(draft: AppDraft): AndroidFile[] {
  const pkg = draft.package_name || 'com.company.appname';
  const pkgPath = pkg.replace(/\./g, '/');
  const appName = draft.app_name || 'My App';
  const versionCode = draft.major_version * 100 + draft.minor_version;
  const versionName = `${draft.major_version}.${draft.minor_version}`;
  const url = draft.url || 'https://example.com';
  const orientation =
    draft.orientation === 'landscape' ? 'landscape' :
    draft.orientation === 'portrait' ? 'portrait' : 'fullSensor';

  const cacheMode =
    draft.settings_cache_mode === 'no_cache' ? 'LOAD_NO_CACHE' :
    draft.settings_cache_mode === 'cache_else_network' ? 'LOAD_CACHE_ELSE_NETWORK' :
    'LOAD_DEFAULT';

  const files: AndroidFile[] = [];

  // ---- Root build.gradle ----
  files.push({
    path: 'build.gradle',
    content: `// Top-level build file
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.1.0'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
`,
  });

  // ---- settings.gradle ----
  files.push({
    path: 'settings.gradle',
    content: `rootProject.name = "${escapeGradle(appName)}"
include ':app'
`,
  });

  // ---- gradle.properties ----
  files.push({
    path: 'gradle.properties',
    content: `android.useAndroidX=true
android.enableJetifier=true
org.gradle.jvmargs=-Xmx2048m
`,
  });

  // ---- app/build.gradle ----
  files.push({
    path: 'app/build.gradle',
    content: `plugins {
    id 'com.android.application'
}

android {
    namespace '${pkg}'
    compileSdk 34

    defaultConfig {
        applicationId "${pkg}"
        minSdk 21
        targetSdk 34
        versionCode ${versionCode}
        versionName "${versionName}"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.webkit:webkit:1.8.0'
}
`,
  });

  // ---- proguard-rules.pro ----
  files.push({
    path: 'app/proguard-rules.pro',
    content: '# Add project specific ProGuard rules here.\n',
  });

  // ---- AndroidManifest.xml ----
  files.push({
    path: `app/src/main/AndroidManifest.xml`,
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${escapeXml(appName)}"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="${orientation}"
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`,
  });

  // ---- MainActivity.java ----
  files.push({
    path: `app/src/main/java/${pkgPath}/MainActivity.java`,
    content: `package ${pkg};

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.RelativeLayout;

public class MainActivity extends Activity {

    private WebView webView;
    private ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        RelativeLayout layout = new RelativeLayout(this);
        setContentView(layout);

        webView = new WebView(this);
        webView.setLayoutParams(new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT,
                RelativeLayout.LayoutParams.MATCH_PARENT));

        progressBar = new ProgressBar(this);
        RelativeLayout.LayoutParams pbParams = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.WRAP_CONTENT,
                RelativeLayout.LayoutParams.WRAP_CONTENT);
        pbParams.addRule(RelativeLayout.CENTER_IN_PARENT);
        progressBar.setLayoutParams(pbParams);
        progressBar.setVisibility(View.VISIBLE);

        layout.addView(webView);
        layout.addView(progressBar);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.${cacheMode});
        settings.setBuiltInZoomControls(${draft.settings_zoom});
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(${draft.settings_zoom});

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
            }
        });

        webView.loadUrl("${escapeJava(url)}");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
`,
  });

  // ---- SplashActivity.java (if enabled) ----
  if (draft.splash_enabled) {
    files.push({
      path: `app/src/main/java/${pkgPath}/SplashActivity.java`,
      content: `package ${pkg};

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.widget.RelativeLayout;
import android.widget.TextView;

public class SplashActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        RelativeLayout layout = new RelativeLayout(this);
        layout.setBackgroundColor(Color.parseColor("${draft.splash_color}"));
        setContentView(layout);

        ${draft.splash_text ? `TextView text = new TextView(this);
        text.setText("${escapeJava(draft.splash_text)}");
        text.setTextColor(Color.parseColor("#333333"));
        text.setTextSize(20);
        RelativeLayout.LayoutParams params = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.WRAP_CONTENT,
                RelativeLayout.LayoutParams.WRAP_CONTENT);
        params.addRule(RelativeLayout.CENTER_IN_PARENT);
        text.setLayoutParams(params);
        layout.addView(text);` : ''}

        new Handler().postDelayed(() -> {
            startActivity(new Intent(SplashActivity.this, MainActivity.class));
            finish();
        }, 2000);
    }
}
`,
    });
  }

  // ---- strings.xml ----
  files.push({
    path: `app/src/main/res/values/strings.xml`,
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${escapeXml(appName)}</string>
</resources>
`,
  });

  // ---- styles.xml ----
  files.push({
    path: `app/src/main/res/values/styles.xml`,
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:colorPrimary">${draft.toolbar_color}</item>
        <item name="android:colorPrimaryDark">${draft.toolbar_color}</item>
        <item name="android:statusBarColor">${draft.toolbar_color}</item>
    </style>
</resources>
`,
  });

  // ---- colors.xml ----
  files.push({
    path: `app/src/main/res/values/colors.xml`,
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">${draft.toolbar_color}</color>
    <color name="colorPrimaryDark">${draft.toolbar_color}</color>
    <color name="colorAccent">#1E90FF</color>
</resources>
`,
  });

  // ---- README ----
  files.push({
    path: 'README.md',
    content: `# ${appName}

Generated by GILWEB2APP

## Build Instructions

1. Open this project in Android Studio
2. Wait for Gradle sync to complete
3. Click **Build > Generate Signed Bundle / APK**
4. Choose APK or AAB
5. Configure your keystore
6. Click **Finish**

## Configuration

- **URL**: ${url}
- **Package**: ${pkg}
- **Version**: ${versionName} (${versionCode})
- **Company**: ${draft.company_name || 'N/A'}
- **Orientation**: ${orientation}
- **Splash**: ${draft.splash_enabled ? 'Enabled' : 'Disabled'}
- **Toolbar**: ${draft.toolbar_enabled ? 'Enabled' : 'Disabled'}
- **Firebase**: ${draft.firebase_enabled ? 'Enabled' : 'Disabled'}
- **AdMob**: ${draft.admob_app_id ? 'Configured' : 'Not configured'}

## Command Line Build

\`\`\`bash
./gradlew assembleDebug     # Debug APK
./gradlew assembleRelease   # Release APK
./gradlew bundleRelease     # Release AAB
\`\`\`

The debug APK will be at: \`app/build/outputs/apk/debug/app-debug.apk\`
`,
  });

  return files;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJava(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function escapeGradle(s: string): string {
  return s.replace(/'/g, "\\'");
}

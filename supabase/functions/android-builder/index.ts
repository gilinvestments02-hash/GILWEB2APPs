import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface BuildRequest {
  appId?: string;
  projectName: string;
  packageName: string;
  url: string;
  versionName: string;
  versionCode: number;
  orientation: string;
  splashEnabled: boolean;
  splashColor: string;
  splashText: string;
  toolbarColor: string;
  cacheMode: string;
  zoom: boolean;
  statusBar: boolean;
  buildType: 'apk' | 'aab';
  buildServiceUrl?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: BuildRequest = await req.json();

    // Validate required fields
    if (!body.url || !body.packageName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: url, packageName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if an external build service URL is provided
    if (body.buildServiceUrl) {
      // Forward to external Android build service (e.g. a Gradle build server)
      try {
        const buildResponse = await fetch(body.buildServiceUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!buildResponse.ok) {
          return new Response(
            JSON.stringify({ error: `Build service returned ${buildResponse.status}` }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await buildResponse.json();
        return new Response(
          JSON.stringify({ status: 'building', buildId: result.buildId, ...result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: `Failed to reach build service: ${err.message}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // No external build service — generate the Android project as a ZIP
    // and store it in Supabase Storage for download
    const projectFiles = generateProjectManifest(body);

    // Store build record in database
    const { data: buildRecord, error: dbError } = await supabase
      .from('builds')
      .insert({
        app_id: body.appId,
        project_name: body.projectName,
        package_name: body.packageName,
        build_type: body.buildType,
        status: 'project_ready',
        manifest: projectFiles,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      // Table might not exist yet — return the manifest directly
      return new Response(
        JSON.stringify({
          status: 'project_ready',
          buildId: crypto.randomUUID(),
          project: projectFiles,
          message: 'Android project generated. Open in Android Studio to build APK/AAB.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'project_ready',
        buildId: buildRecord.id,
        project: projectFiles,
        message: 'Android project generated. Open in Android Studio to build APK/AAB.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface BuildManifest {
  gradle: string;
  appGradle: string;
  manifest: string;
  mainActivity: string;
  strings: string;
  styles: string;
  colors: string;
  readme: string;
}

function generateProjectManifest(body: BuildRequest): BuildManifest {
  const pkg = body.packageName;
  const appName = body.projectName || 'My App';
  const url = body.url;
  const versionCode = body.versionCode || 1;
  const versionName = body.versionName || '1.0';
  const orientation = body.orientation === 'landscape' ? 'landscape' :
    body.orientation === 'portrait' ? 'portrait' : 'fullSensor';
  const cacheMode = body.cacheMode === 'no_cache' ? 'LOAD_NO_CACHE' :
    body.cacheMode === 'cache_else_network' ? 'LOAD_CACHE_ELSE_NETWORK' : 'LOAD_DEFAULT';

  return {
    gradle: `buildscript {
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
}`,
    appGradle: `plugins {
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
}`,
    manifest: `<?xml version="1.0" encoding="utf-8"?>
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
            android:screenOrientation="${orientation}">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`,
    mainActivity: `package ${pkg};

import android.app.Activity;
import android.os.Bundle;
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
        progressBar.setVisibility(android.view.View.VISIBLE);

        layout.addView(webView);
        layout.addView(progressBar);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.${cacheMode});
        settings.setBuiltInZoomControls(${body.zoom});
        settings.setSupportZoom(${body.zoom});

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(android.view.View.GONE);
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
}`,
    strings: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${escapeXml(appName)}</string>
</resources>`,
    styles: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:colorPrimary">${body.toolbarColor}</item>
        <item name="android:colorPrimaryDark">${body.toolbarColor}</item>
    </style>
</resources>`,
    colors: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">${body.toolbarColor}</color>
    <color name="colorAccent">#1E90FF</color>
</resources>`,
    readme: `# ${appName}

Generated by GILWEB2APP

## Build
1. Open in Android Studio
2. Build > Generate Signed Bundle / APK
3. Choose APK or AAB

## Command Line
\`\`\`bash
./gradlew assembleDebug     # Debug APK
./gradlew assembleRelease   # Release APK
./gradlew bundleRelease     # Release AAB
\`\`\`

Output: app/build/outputs/apk/debug/app-debug.apk

## Config
- URL: ${url}
- Package: ${pkg}
- Version: ${versionName} (${versionCode})
`,
  };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJava(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

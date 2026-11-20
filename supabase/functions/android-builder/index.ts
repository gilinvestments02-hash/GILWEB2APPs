import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GITHUB_API = 'https://api.github.com';

interface SupabaseUser {
  id: string;
  aud: string;
  role: string;
  email: string;
}

async function authenticate(req: Request): Promise<SupabaseUser | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, token);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return {
    id: data.user.id,
    aud: data.user.aud,
    role: data.user.role,
    email: data.user.email ?? '',
  };
}

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

function b64encode(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function b64decode(s: string): string {
  return decodeURIComponent(escape(atob(s.replace(/\n/g, ''))));
}

// ---------- GitHub API helpers ----------

async function githubFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${GITHUB_API}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(init.headers as Record<string, string> ?? {}),
  };
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return fetch(url, { ...init, headers });
}

async function getRepoInfo(owner: string, repo: string, token: string) {
  const res = await githubFetch(`/repos/${owner}/${repo}`, token);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, status: res.status, body };
  }
  const data = await res.json();
  return { ok: true, data };
}

async function getBranchSha(owner: string, repo: string, branch: string, token: string) {
  const res = await githubFetch(`/repos/${owner}/${repo}/branches/${branch}`, token);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.commit?.sha ?? null;
}

async function createTree(owner: string, repo: string, baseTreeSha: string, tree: { path: string; content: string }[], token: string) {
  const entries = tree.map((f) => ({
    path: f.path,
    mode: '100644' as const,
    type: 'blob' as const,
    content: f.content,
  }));
  const res = await githubFetch(`/repos/${owner}/${repo}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: entries }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`createTree failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return await res.json();
}

async function createCommit(owner: string, repo: string, parentSha: string, treeSha: string, message: string, token: string) {
  const res = await githubFetch(`/repos/${owner}/${repo}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({ parents: [parentSha], tree: treeSha, message }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`createCommit failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return await res.json();
}

async function updateRef(owner: string, repo: string, branch: string, commitSha: string, token: string) {
  const res = await githubFetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commitSha }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`updateRef failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return await res.json();
}

async function getLatestRunForBranch(owner: string, repo: string, branch: string, token: string) {
  const res = await githubFetch(`/repos/${owner}/${repo}/actions/runs?branch=${branch}&per_page=1`, token);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.workflow_runs?.[0] ?? null;
}

async function getWorkflowRun(owner: string, repo: string, runId: number, token: string) {
  const res = await githubFetch(`/repos/${owner}/${repo}/actions/runs/${runId}`, token);
  if (!res.ok) return null;
  return await res.json();
}

async function listArtifacts(owner: string, repo: string, runId: number, token: string) {
  const res = await githubFetch(`/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`, token);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.artifacts ?? [];
}

// ---------- Gradle project generation ----------

interface ProjectConfig {
  packageName: string;
  appName: string;
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
  hasKeystore: boolean;
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

function generateProjectFiles(cfg: ProjectConfig): { path: string; content: string }[] {
  const pkg = cfg.packageName || 'com.company.appname';
  const pkgPath = pkg.replace(/\./g, '/');
  const appName = cfg.appName || 'My App';
  const versionCode = cfg.versionCode || 1;
  const versionName = cfg.versionName || '1.0';
  const url = cfg.url || 'https://example.com';
  const orientation =
    cfg.orientation === 'landscape' ? 'landscape' :
    cfg.orientation === 'portrait' ? 'portrait' : 'fullSensor';
  const cacheMode =
    cfg.cacheMode === 'no_cache' ? 'LOAD_NO_CACHE' :
    cfg.cacheMode === 'cache_else_network' ? 'LOAD_CACHE_ELSE_NETWORK' : 'LOAD_DEFAULT';

  const files: { path: string; content: string }[] = [];

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

  files.push({
    path: 'settings.gradle',
    content: `rootProject.name = "${escapeGradle(appName)}"
include ':app'
`,
  });

  files.push({
    path: 'gradle.properties',
    content: `android.useAndroidX=true
android.enableJetifier=true
org.gradle.jvmargs=-Xmx2048m
`,
  });

  files.push({
    path: 'gradlew',
    content: '#!/usr/bin/env sh\n# Gradle wrapper placeholder — the GitHub Actions runner uses gradle directly.\n',
  });

  const signingConfig = cfg.hasKeystore
    ? `
    signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword System.getenv('KEYSTORE_PASSWORD') ?: ''
            keyAlias System.getenv('KEY_ALIAS') ?: ''
            keyPassword System.getenv('KEY_PASSWORD') ?: ''
        }
    }
`
    : '';

  const releaseSignConfig = cfg.hasKeystore
    ? `            signingConfig signingConfigs.release`
    : `            // no signing config — debug-signed`;

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
${signingConfig}
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
${releaseSignConfig}
        }
        debug {
            // debug build uses default debug signing
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

  files.push({
    path: 'app/proguard-rules.pro',
    content: '# Add project specific ProGuard rules here.\n',
  });

  files.push({
    path: 'app/src/main/AndroidManifest.xml',
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
        settings.setBuiltInZoomControls(${cfg.zoom});
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(${cfg.zoom});

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String finishedUrl) {
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

  if (cfg.splashEnabled) {
    files.push({
      path: `app/src/main/java/${pkgPath}/SplashActivity.java`,
      content: `package ${pkg};

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.widget.RelativeLayout;
import android.widget.TextView;

public class SplashActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        RelativeLayout layout = new RelativeLayout(this);
        layout.setBackgroundColor(Color.parseColor("${cfg.splashColor}"));
        setContentView(layout);

        ${cfg.splashText ? `TextView text = new TextView(this);
        text.setText("${escapeJava(cfg.splashText)}");
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

  files.push({
    path: 'app/src/main/res/values/strings.xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${escapeXml(appName)}</string>
</resources>
`,
  });

  files.push({
    path: 'app/src/main/res/values/styles.xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:colorPrimary">${cfg.toolbarColor}</item>
        <item name="android:colorPrimaryDark">${cfg.toolbarColor}</item>
        <item name="android:statusBarColor">${cfg.toolbarColor}</item>
    </style>
</resources>
`,
  });

  files.push({
    path: 'app/src/main/res/values/colors.xml',
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">${cfg.toolbarColor}</color>
    <color name="colorPrimaryDark">${cfg.toolbarColor}</color>
    <color name="colorAccent">#1E90FF</color>
</resources>
`,
  });

  // GitHub Actions workflow — builds APK and AAB, uploads artifacts
  const assembleTargets = cfg.buildType === 'aab'
    ? ['bundleRelease']
    : ['assembleDebug', 'assembleRelease'];

  const artifactPaths = cfg.buildType === 'aab'
    ? ['app/build/outputs/bundle/release/*.aab']
    : ['app/build/outputs/apk/**/*.apk'];

  files.push({
    path: '.github/workflows/android-build.yml',
    content: `name: Android Build

on:
  push:
    branches: [ "\${{ github.ref_name }}" ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v3

      - name: Decode keystore
        if: \${{ env.KEYSTORE_BASE64 != '' }}
        run: |
          echo "\${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > app/release.keystore
        env:
          KEYSTORE_BASE64: \${{ secrets.KEYSTORE_BASE64 }}

${assembleTargets.map((t) => `      - name: ${t}
        run: ./gradlew ${t} --no-daemon
        env:
          KEYSTORE_PASSWORD: \${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: \${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: \${{ secrets.KEY_PASSWORD }}
`).join('')}
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: android-${cfg.buildType}
          path: |
${artifactPaths.map((p) => `            ${p}`).join('\n')}
          retention-days: 30
`,
  });

  files.push({
    path: 'README.md',
    content: `# ${appName}

Generated by GILWEB2APP — built via GitHub Actions.

## Configuration
- URL: ${url}
- Package: ${pkg}
- Version: ${versionName} (${versionCode})
- Build type: ${cfg.buildType.toUpperCase()}
- Signing: ${cfg.hasKeystore ? 'Configured (release keystore)' : 'Debug'}

## Build
The GitHub Actions workflow in .github/workflows/android-build.yml builds this
project automatically on every push. Artifacts are uploaded and available for
download from the Actions tab.
`,
  });

  return files;
}

// ---------- Route handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const user = await authenticate(req);
    if (!user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/functions\/v1\/android-builder/, '') || '/';

    // POST /config — save GitHub config
    // GET  /config — list user's GitHub configs
    // PUT  /config/:id — update config
    // DELETE /config/:id — delete config
    // POST /config/:id/test — test repo connection (requires token in body)
    // POST /build — trigger a build (push project + workflow, return run id)
    // GET  /build/:id/status — poll build status
    // GET  /build/:id/artifacts — list artifacts for a completed build
    // GET  /build/:id/download — proxy artifact download

    if (path === '/config' && req.method === 'GET') return await listConfigs(user.id);
    if (path === '/config' && req.method === 'POST') return await saveConfig(req, user.id);
    if (path.startsWith('/config/') && req.method === 'PUT') return await updateConfig(req, path, user.id);
    if (path.startsWith('/config/') && req.method === 'DELETE') return await deleteConfig(path, user.id);
    if (path.endsWith('/test') && path.startsWith('/config/') && req.method === 'POST') {
      return await testConfig(req, path, user.id);
    }

    if (path === '/build' && req.method === 'POST') return await triggerBuild(req, user.id);
    if (path.startsWith('/build/') && path.endsWith('/status') && req.method === 'GET') {
      return await getBuildStatus(path, user.id);
    }
    if (path.startsWith('/build/') && path.endsWith('/refresh') && req.method === 'POST') {
      return await refreshBuildStatus(req, path, user.id);
    }
    if (path.startsWith('/build/') && path.endsWith('/artifacts') && req.method === 'GET') {
      return await listBuildArtifacts(path, user.id);
    }
    if (path.startsWith('/build/') && path.endsWith('/download') && req.method === 'GET') {
      return await downloadArtifact(req, path, user.id);
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    return json({ error: err.message ?? 'Internal error' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---------- Config handlers ----------

async function listConfigs(userId: string): Promise<Response> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('github_configs')
    .select('id, repo_owner, repo_name, default_branch, workflow_filename, has_keystore, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return json({ error: 'Could not load configs' }, 500);
  return json({ configs: data ?? [] });
}

interface ConfigInput {
  repo_owner?: string;
  repo_name?: string;
  default_branch?: string;
  workflow_filename?: string;
  github_token?: string;
  keystore_base64?: string;
  keystore_password?: string;
  key_alias?: string;
  key_password?: string;
}

async function saveConfig(req: Request, userId: string): Promise<Response> {
  const body: ConfigInput = await req.json();
  if (!body.repo_owner || !body.repo_name) {
    return json({ error: 'repo_owner and repo_name are required' }, 400);
  }

  const hasKeystore = !!(body.keystore_base64 && body.keystore_password && body.key_alias && body.key_password);

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('github_configs')
    .insert({
      user_id: userId,
      repo_owner: body.repo_owner.trim(),
      repo_name: body.repo_name.trim(),
      default_branch: body.default_branch?.trim() || 'main',
      workflow_filename: body.workflow_filename?.trim() || 'android-build.yml',
      keystore_base64: body.keystore_base64 || null,
      keystore_password: body.keystore_password || null,
      key_alias: body.key_alias || null,
      key_password: body.key_password || null,
      has_keystore: hasKeystore,
    })
    .select('id, repo_owner, repo_name, default_branch, workflow_filename, has_keystore, created_at, updated_at')
    .single();

  if (error) return json({ error: 'Could not save config' }, 500);
  return json({ config: data });
}

async function updateConfig(req: Request, path: string, userId: string): Promise<Response> {
  const configId = path.split('/')[2];
  const body: ConfigInput = await req.json();
  const supabase = serviceClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.repo_owner !== undefined) update.repo_owner = body.repo_owner.trim();
  if (body.repo_name !== undefined) update.repo_name = body.repo_name.trim();
  if (body.default_branch !== undefined) update.default_branch = body.default_branch.trim();
  if (body.workflow_filename !== undefined) update.workflow_filename = body.workflow_filename.trim();
  if (body.keystore_base64 !== undefined) update.keystore_base64 = body.keystore_base64 || null;
  if (body.keystore_password !== undefined) update.keystore_password = body.keystore_password || null;
  if (body.key_alias !== undefined) update.key_alias = body.key_alias || null;
  if (body.key_password !== undefined) update.key_password = body.key_password || null;
  if (body.keystore_base64 !== undefined) {
    update.has_keystore = !!(body.keystore_base64 && body.keystore_password && body.key_alias && body.key_password);
  }

  const { data, error } = await supabase
    .from('github_configs')
    .update(update)
    .eq('id', configId)
    .eq('user_id', userId)
    .select('id, repo_owner, repo_name, default_branch, workflow_filename, has_keystore, created_at, updated_at')
    .single();

  if (error) return json({ error: 'Could not update config' }, 500);
  return json({ config: data });
}

async function deleteConfig(path: string, userId: string): Promise<Response> {
  const configId = path.split('/')[2];
  const supabase = serviceClient();
  const { error } = await supabase
    .from('github_configs')
    .delete()
    .eq('id', configId)
    .eq('user_id', userId);
  if (error) return json({ error: 'Could not delete config' }, 500);
  return json({ ok: true });
}

async function getConfigWithSecrets(configId: string, userId: string) {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('github_configs')
    .select('*')
    .eq('id', configId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function testConfig(req: Request, path: string, userId: string): Promise<Response> {
  const configId = path.split('/')[2];
  const config = await getConfigWithSecrets(configId, userId);
  if (!config) return json({ error: 'Config not found' }, 404);

  const body = await req.json().catch(() => ({} as { github_token?: string }));
  const token = body.github_token ?? '';
  if (!token) return json({ error: 'GitHub token is required to test the connection' }, 400);

  const result = await getRepoInfo(config.repo_owner, config.repo_name, token);
  if (!result.ok) {
    return json({
      ok: false,
      error: result.status === 404
        ? 'Repository not found. Check the owner/name and that your token has access.'
        : `GitHub API returned ${result.status}`,
    }, 200);
  }

  // Verify token scopes by checking the response headers (via a separate call we can't access here,
  // so we just confirm repo access)
  return json({
    ok: true,
    repo: {
      full_name: result.data.full_name,
      default_branch: result.data.default_branch,
      private: result.data.private,
      permissions: result.data.permissions,
    },
  });
}

// ---------- Build handlers ----------

interface BuildTriggerInput {
  app_id?: string;
  github_config_id: string;
  github_token: string;
  config: {
    packageName: string;
    appName: string;
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
  };
}

async function triggerBuild(req: Request, userId: string): Promise<Response> {
  const body: BuildTriggerInput = await req.json();
  if (!body.github_config_id || !body.github_token) {
    return json({ error: 'github_config_id and github_token are required' }, 400);
  }
  if (!body.config?.packageName || !body.config?.url) {
    return json({ error: 'packageName and url are required' }, 400);
  }

  const config = await getConfigWithSecrets(body.github_config_id, userId);
  if (!config) return json({ error: 'GitHub config not found' }, 404);

  const token = body.github_token;
  const owner = config.repo_owner;
  const repo = config.repo_name;
  const branch = config.default_branch || 'main';

  // 1. Verify repo access
  const repoInfo = await getRepoInfo(owner, repo, token);
  if (!repoInfo.ok) {
    return json({ error: `Cannot access repository ${owner}/${repo}: ${repoInfo.status}` }, 400);
  }

  // 2. Get the base branch SHA
  const baseSha = await getBranchSha(owner, repo, branch, token);
  if (!baseSha) {
    return json({ error: `Branch '${branch}' not found in ${owner}/${repo}` }, 400);
  }

  // 3. Generate project files
  const hasKeystore = !!(config.keystore_base64 && config.keystore_password && config.key_alias && config.key_password);
  const projectConfig: ProjectConfig = {
    ...body.config,
    hasKeystore,
  };
  const files = generateProjectFiles(projectConfig);

  // 4. Create a tree, commit, and update the branch ref
  const tree = await createTree(owner, repo, baseSha, files, token);
  const commit = await createCommit(owner, repo, baseSha, tree.sha, `Build ${body.config.appName} v${body.config.versionName} [${body.config.buildType.toUpperCase()}]`, token);
  await updateRef(owner, repo, branch, commit.sha, token);

  // 5. Wait briefly for GitHub Actions to register the workflow run
  // GitHub typically creates the run within a few seconds of the push
  let run: Awaited<ReturnType<typeof getLatestRunForBranch>> = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise((r) => setTimeout(r, 2500));
    run = await getLatestRunForBranch(owner, repo, branch, token);
    if (run && run.head_sha === commit.sha) break;
  }

  if (!run) {
    // The workflow may not exist yet or actions may be disabled. Still record the build.
    const supabase = serviceClient();
    const { data: buildRec } = await supabase
      .from('builds')
      .insert({
        app_id: body.app_id ?? null,
        user_id: userId,
        project_name: body.config.appName,
        package_name: body.config.packageName,
        build_type: body.config.buildType,
        status: 'failed',
        github_status: 'no_run',
        error_message: 'Workflow run was not detected after push. Ensure GitHub Actions is enabled and the workflow file exists.',
        project_source: commit.sha,
      })
      .select()
      .single();
    return json({ error: 'Workflow run not detected after push. Check that Actions are enabled for the repository.', buildId: buildRec?.id }, 202);
  }

  // 6. Record the build
  const supabase = serviceClient();
  const { data: buildRec, error: dbErr } = await supabase
    .from('builds')
    .insert({
      app_id: body.app_id ?? null,
      user_id: userId,
      project_name: body.config.appName,
      package_name: body.config.packageName,
      build_type: body.config.buildType,
      status: 'building',
      github_run_id: run.id,
      github_run_url: run.html_url,
      github_status: run.status,
      github_conclusion: run.conclusion,
      project_source: commit.sha,
    })
    .select()
    .single();

  if (dbErr) return json({ error: 'Build triggered but could not record it' }, 500);

  return json({
    buildId: buildRec.id,
    runId: run.id,
    runUrl: run.html_url,
    status: run.status,
    commitSha: commit.sha,
  });
}

async function getBuildStatus(path: string, userId: string): Promise<Response> {
  const buildId = path.split('/')[2];
  const supabase = serviceClient();

  const { data: build, error } = await supabase
    .from('builds')
    .select('*')
    .eq('id', buildId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !build) return json({ error: 'Build not found' }, 404);
  if (!build.github_run_id) return json({ build });

  // Need the GitHub token to poll — it's not stored. Return the last known state.
  // The frontend must provide a token to refresh. We support a token query param.
  // Actually, tokens are never stored (per security requirement). We return the
  // stored status and let the client optionally pass a token via the refresh endpoint.
  return json({ build });
}

// POST /build/:id/refresh?token=xxx — refresh status from GitHub
async function refreshBuildStatus(req: Request, path: string, userId: string): Promise<Response> {
  const buildId = path.split('/')[2];
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  if (!token) return json({ error: 'token query param required' }, 400);

  const supabase = serviceClient();
  const { data: build, error } = await supabase
    .from('builds')
    .select('*')
    .eq('id', buildId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !build) return json({ error: 'Build not found' }, 404);
  if (!build.github_run_id) return json({ build });

  // Find the config for this user to get owner/repo
  const { data: config } = await supabase
    .from('github_configs')
    .select('repo_owner, repo_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (!config) return json({ error: 'No GitHub config for user' }, 404);

  const run = await getWorkflowRun(config.repo_owner, config.repo_name, build.github_run_id, token);
  if (!run) return json({ build });

  const newStatus = run.status === 'completed' && run.conclusion === 'success' ? 'completed' :
    run.status === 'completed' && run.conclusion !== 'success' ? 'failed' :
    'building';

  const update: Record<string, unknown> = {
    github_status: run.status,
    github_conclusion: run.conclusion,
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (run.status === 'completed' && run.conclusion !== 'success' && !build.error_message) {
    update.error_message = `GitHub Actions: ${run.conclusion}`;
  }

  await supabase.from('builds').update(update).eq('id', buildId);

  // If completed successfully, fetch artifacts
  let artifacts: unknown[] = [];
  if (newStatus === 'completed') {
    artifacts = await listArtifacts(config.repo_owner, config.repo_name, build.github_run_id, token);
    for (const a of artifacts as Array<{ id: number; name: string; archive_download_url: string; size_in_bytes: number; expires_at?: string }>) {
      const { data: existing } = await supabase
        .from('build_artifacts')
        .select('id')
        .eq('build_id', buildId)
        .eq('name', a.name)
        .maybeSingle();
      if (existing) continue;
      await supabase.from('build_artifacts').insert({
        build_id: buildId,
        user_id: userId,
        name: a.name,
        archive_download_url: a.archive_download_url,
        size_in_bytes: a.size_in_bytes,
        expires_at: a.expires_at ?? null,
      });
    }
  }

  const { data: updated } = await supabase.from('builds').select('*').eq('id', buildId).maybeSingle();
  return json({ build: updated, artifacts });
}

async function listBuildArtifacts(path: string, userId: string): Promise<Response> {
  const buildId = path.split('/')[2];
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('build_artifacts')
    .select('*')
    .eq('build_id', buildId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return json({ error: 'Could not load artifacts' }, 500);
  return json({ artifacts: data ?? [] });
}

async function downloadArtifact(req: Request, path: string, userId: string): Promise<Response> {
  const buildId = path.split('/')[2];
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const artifactId = url.searchParams.get('artifact_id') ?? '';
  if (!token || !artifactId) return json({ error: 'token and artifact_id required' }, 400);

  const supabase = serviceClient();
  const { data: artifact, error } = await supabase
    .from('build_artifacts')
    .select('*')
    .eq('id', artifactId)
    .eq('build_id', buildId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !artifact) return json({ error: 'Artifact not found' }, 404);

  const { data: config } = await supabase
    .from('github_configs')
    .select('repo_owner, repo_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (!config) return json({ error: 'No GitHub config' }, 404);

  // GitHub's archive_download_url returns a 302 redirect to a temporary S3 URL.
  // We need to follow it and stream the ZIP back to the client.
  const res = await githubFetch(artifact.archive_download_url, token, { redirect: 'manual' });
  if (res.status === 302) {
    const location = res.headers.get('Location') ?? '';
    const zipRes = await fetch(location);
    const zipBuffer = await zipRes.arrayBuffer();
    return new Response(zipBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${artifact.name}.zip"`,
      },
    });
  }

  if (res.ok) {
    const zipBuffer = await res.arrayBuffer();
    return new Response(zipBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${artifact.name}.zip"`,
      },
    });
  }

  return json({ error: `GitHub returned ${res.status}` }, 502);
}

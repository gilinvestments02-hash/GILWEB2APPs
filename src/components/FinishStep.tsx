import { useState } from 'react';
import { Download, CheckCircle2, Loader2, FileArchive, Cloud, AlertCircle } from 'lucide-react';
import type { AppDraft } from '@/lib/supabase';
import { generateAndroidProject } from '@/lib/androidGenerator';
import { buildZip } from '@/lib/zipBuilder';

type Props = {
  draft: AppDraft;
  onBack: () => void;
  onSave: () => Promise<void>;
};

type BuildType = 'apk' | 'aab';

export function FinishStep({ draft, onBack, onSave }: Props) {
  const [phase, setPhase] = useState<'idle' | 'building' | 'done'>('idle');
  const [buildType, setBuildType] = useState<BuildType>('apk');
  const [error, setError] = useState<string | null>(null);
  const [buildResult, setBuildResult] = useState<{ zipReady: boolean; buildServiceConnected: boolean } | null>(null);

  const build = async () => {
    setError(null);
    setPhase('building');

    try {
      // Save the app record first
      await onSave();

      // Generate the Android project files
      const projectFiles = generateAndroidProject(draft);

      // If a build service URL is configured, send the project to it
      let buildServiceConnected = false;
      if (draft.build_service_url) {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/android-builder`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              projectName: draft.app_name,
              packageName: draft.package_name,
              url: draft.url,
              versionName: `${draft.major_version}.${draft.minor_version}`,
              versionCode: draft.major_version * 100 + draft.minor_version,
              orientation: draft.orientation,
              splashEnabled: draft.splash_enabled,
              splashColor: draft.splash_color,
              splashText: draft.splash_text,
              toolbarColor: draft.toolbar_color,
              cacheMode: draft.settings_cache_mode,
              zoom: draft.settings_zoom,
              statusBar: draft.settings_status_bar,
              buildType,
              buildServiceUrl: draft.build_service_url,
            }),
          });

          if (response.ok) {
            buildServiceConnected = true;
          }
        } catch {
          // Build service not reachable — still provide the project ZIP
          buildServiceConnected = false;
        }
      }

      setBuildResult({ zipReady: true, buildServiceConnected });
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Build failed');
      setPhase('idle');
    }
  };

  const downloadProject = () => {
    const files = generateAndroidProject(draft);
    const zipBlob = buildZip(files);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(draft.app_name || 'app').replace(/\s+/g, '_')}_android_project.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="font-bold text-gray-800 text-lg mb-2 text-center">Finish</h2>
      <p className="text-sm text-gray-400 mb-6 text-center">Your Android project is ready to build.</p>

      {/* summary */}
      <div className="text-left bg-gray-50 rounded-lg p-4 mb-6 space-y-1.5 text-sm">
        <SummaryRow label="App Name" value={draft.app_name || '—'} />
        <SummaryRow label="URL" value={draft.url || '—'} />
        <SummaryRow label="Version" value={`${draft.major_version}.${draft.minor_version}`} />
        <SummaryRow label="Company" value={draft.company_name || '—'} />
        <SummaryRow label="Package" value={draft.package_name || '—'} />
        <SummaryRow label="Icon" value={draft.icon_url ? 'Set' : 'Not set'} />
        <SummaryRow label="Toolbar" value={draft.toolbar_enabled ? 'Enabled' : 'Disabled'} />
        <SummaryRow label="Splash" value={draft.splash_enabled ? 'Enabled' : 'Disabled'} />
        <SummaryRow label="Firebase" value={draft.firebase_enabled ? 'Enabled' : 'Disabled'} />
        <SummaryRow label="AdMob" value={draft.admob_app_id ? 'Configured' : 'Not configured'} />
        <SummaryRow label="Build Service" value={draft.build_service_url ? 'Connected' : 'Not configured'} />
      </div>

      {/* Build type selector */}
      {phase === 'idle' && (
        <>
          <label className="block text-sm font-medium text-gray-700 mb-2">Build Output Format</label>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => setBuildType('apk')}
              className={`py-3 rounded-lg border-2 font-medium text-sm transition ${
                buildType === 'apk'
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              APK
              <span className="block text-xs text-gray-400 font-normal mt-0.5">Android Package</span>
            </button>
            <button
              onClick={() => setBuildType('aab')}
              className={`py-3 rounded-lg border-2 font-medium text-sm transition ${
                buildType === 'aab'
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              AAB
              <span className="block text-xs text-gray-400 font-normal mt-0.5">Android App Bundle</span>
            </button>
          </div>

          <button
            onClick={build}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg hover:bg-blue-600 transition flex items-center justify-center gap-2"
          >
            <Download size={20} /> Generate {buildType.toUpperCase()} Project
          </button>
        </>
      )}

      {phase === 'building' && (
        <div className="w-full bg-blue-50 text-blue-600 font-medium py-4 rounded-lg flex items-center justify-center gap-2 mb-4">
          <Loader2 size={20} className="animate-spin" /> Generating Android project…
        </div>
      )}

      {phase === 'done' && (
        <>
          <div className="text-green-500 font-medium flex items-center justify-center gap-2 mb-4">
            <CheckCircle2 size={22} /> Project generated successfully!
          </div>

          {buildResult?.buildServiceConnected && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-green-700">
              <Cloud size={18} />
              Build service connected. Your {buildType.toUpperCase()} is being compiled remotely.
            </div>
          )}

          {buildResult && !buildResult.buildServiceConnected && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2 text-sm text-amber-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>
                {draft.build_service_url
                  ? 'Build service was not reachable. You can still download the project and build locally.'
                  : 'No build service configured. Download the project and open it in Android Studio to build your APK/AAB.'}
              </span>
            </div>
          )}

          <button
            onClick={downloadProject}
            className="w-full bg-green-500 text-white font-bold py-3 rounded-lg hover:bg-green-600 transition flex items-center justify-center gap-2 mb-3"
          >
            <FileArchive size={20} /> Download Android Project (ZIP)
          </button>

          <div className="text-left bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-600">Build Instructions:</p>
            <p>1. Download and unzip the project</p>
            <p>2. Open in Android Studio</p>
            <p>3. Run: <code className="bg-gray-200 px-1 rounded">./gradlew assembleDebug</code> for APK</p>
            <p>4. Run: <code className="bg-gray-200 px-1 rounded">./gradlew bundleRelease</code> for AAB</p>
            <p>5. Output: <code className="bg-gray-200 px-1 rounded">app/build/outputs/</code></p>
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>
      )}

      <button
        onClick={onBack}
        className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 py-2"
      >
        ← Back to App Maker
      </button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-700 font-medium truncate ml-2 max-w-[60%] text-right">{value}</span>
    </div>
  );
}

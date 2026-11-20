import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  CheckCircle2,
  Loader2,
  FileArchive,
  AlertCircle,
  Github,
  ExternalLink,
  Package,
  Clock,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import type { AppDraft, BuildRecord, BuildArtifact } from '@/lib/supabase';
import {
  triggerBuild,
  refreshBuildStatus,
  listBuildArtifacts,
  getArtifactDownloadUrl,
  type BuildConfigInput,
} from '@/lib/github';
import { generateAndroidProject } from '@/lib/androidGenerator';
import { buildZip } from '@/lib/zipBuilder';

type Props = {
  draft: AppDraft;
  appId: string | null;
  onBack: () => void;
  onSave: (statusOverride?: string) => Promise<void>;
};

type BuildType = 'apk' | 'aab';
type Phase = 'idle' | 'triggering' | 'building' | 'completed' | 'failed';

export function FinishStep({ draft, appId, onBack, onSave }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [buildType, setBuildType] = useState<BuildType>(
    (draft.last_build_type as BuildType) ?? 'apk',
  );
  const [githubToken, setGithubToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [build, setBuild] = useState<BuildRecord | null>(null);
  const [artifacts, setArtifacts] = useState<BuildArtifact[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  const buildConfig: BuildConfigInput = {
    packageName: draft.package_name || 'com.company.appname',
    appName: draft.app_name || 'My App',
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
  };

  const startBuild = async () => {
    setError(null);
    setBuild(null);
    setArtifacts([]);

    if (!draft.github_config_id) {
      setError('Connect a GitHub repository first. Open the menu → GitHub Build.');
      return;
    }
    if (!githubToken.trim()) {
      setError('Enter your GitHub Personal Access Token to trigger the build.');
      return;
    }
    if (!draft.url || !draft.package_name) {
      setError('App URL and package name are required.');
      return;
    }

    setPhase('triggering');
    try {
      await onSave();
      const result = await triggerBuild({
        appId: appId ?? undefined,
        githubConfigId: draft.github_config_id,
        githubToken: githubToken.trim(),
        config: buildConfig,
      });

      // Start polling for status
      setPhase('building');
      startPolling(result.buildId, githubToken.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Build failed to start');
      setPhase('idle');
    }
  };

  const startPolling = (buildId: string, token: string) => {
    stopPolling();
    const poll = async () => {
      try {
        const result = await refreshBuildStatus(buildId, token);
        setBuild(result.build);
        if (result.artifacts) setArtifacts(result.artifacts);

        if (result.build.status === 'completed') {
          stopPolling();
          setPhase('completed');
          // Load full artifact list
          const arts = await listBuildArtifacts(buildId);
          setArtifacts(arts);
        } else if (result.build.status === 'failed') {
          stopPolling();
          setPhase('failed');
        }
      } catch {
        // ignore transient polling errors
      }
    };
    poll();
    pollRef.current = setInterval(poll, 10000);
  };

  const handleDownloadArtifact = async (artifact: BuildArtifact) => {
    if (!build || !githubToken.trim()) return;
    setDownloading(artifact.id);
    try {
      const url = await getArtifactDownloadUrl(build.id, artifact.id, githubToken.trim());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${artifact.name}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    }
    setDownloading(null);
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

  const reset = () => {
    stopPolling();
    setPhase('idle');
    setBuild(null);
    setArtifacts([]);
    setError(null);
  };

  const hasGithub = !!draft.github_config_id;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="font-bold text-gray-800 text-lg mb-2 text-center">Finish</h2>
      <p className="text-sm text-gray-400 mb-6 text-center">
        Build your Android app with GitHub Actions.
      </p>

      {/* summary */}
      <div className="text-left bg-gray-50 rounded-lg p-4 mb-6 space-y-1.5 text-sm">
        <SummaryRow label="App Name" value={draft.app_name || '—'} />
        <SummaryRow label="URL" value={draft.url || '—'} />
        <SummaryRow label="Version" value={`${draft.major_version}.${draft.minor_version}`} />
        <SummaryRow label="Package" value={draft.package_name || '—'} />
        <SummaryRow label="Icon" value={draft.icon_url ? 'Set' : 'Not set'} />
        <SummaryRow label="Splash" value={draft.splash_enabled ? 'Enabled' : 'Disabled'} />
        <SummaryRow
          label="GitHub"
          value={hasGithub ? 'Connected' : 'Not configured'}
        />
      </div>

      {/* GitHub not configured warning */}
      {!hasGithub && phase === 'idle' && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>
            No GitHub repository connected. Open the menu (top right) → <strong>GitHub Build</strong> to set one up.
          </span>
        </div>
      )}

      {/* idle: build type selector + token + trigger */}
      {phase === 'idle' && (
        <>
          <label className="block text-sm font-medium text-gray-700 mb-2">Build Output Format</label>
          <div className="grid grid-cols-2 gap-3 mb-4">
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
              <span className="block text-xs text-gray-400 font-normal mt-0.5">App Bundle</span>
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Github size={16} /> GitHub Token (not stored)
            </label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_... or github_pat_..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <button
            onClick={startBuild}
            disabled={!hasGithub}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            <Github size={20} /> Build {buildType.toUpperCase()} via GitHub Actions
          </button>

          <button
            onClick={downloadProject}
            className="w-full mt-3 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2 text-sm"
          >
            <FileArchive size={18} /> Download project source (ZIP)
          </button>
        </>
      )}

      {/* triggering */}
      {phase === 'triggering' && (
        <div className="w-full bg-blue-50 text-blue-600 font-medium py-4 rounded-lg flex items-center justify-center gap-2 mb-4">
          <Loader2 size={20} className="animate-spin" /> Pushing project to GitHub…
        </div>
      )}

      {/* building */}
      {phase === 'building' && (
        <div className="space-y-4">
          <div className="w-full bg-blue-50 text-blue-600 font-medium py-4 rounded-lg flex items-center justify-center gap-2">
            <Loader2 size={20} className="animate-spin" /> Building on GitHub Actions…
          </div>
          {build?.github_run_url && (
            <a
              href={build.github_run_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-sm text-blue-500 hover:text-blue-600"
            >
              <ExternalLink size={16} /> View workflow run on GitHub
            </a>
          )}
          <BuildStatusBadge build={build} />
          <button
            onClick={reset}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Cancel
          </button>
        </div>
      )}

      {/* completed */}
      {phase === 'completed' && (
        <div className="space-y-4">
          <div className="text-green-500 font-medium flex items-center justify-center gap-2">
            <CheckCircle2 size={22} /> Build completed successfully!
          </div>
          {build?.github_run_url && (
            <a
              href={build.github_run_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-sm text-blue-500 hover:text-blue-600"
            >
              <ExternalLink size={16} /> View run on GitHub
            </a>
          )}

          {artifacts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Download artifacts:</p>
              {artifacts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleDownloadArtifact(a)}
                  disabled={downloading === a.id}
                  className="w-full flex items-center justify-between bg-green-500 text-white font-medium py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 transition px-4"
                >
                  <span className="flex items-center gap-2">
                    <Package size={18} />
                    {a.name}.zip
                  </span>
                  {downloading === a.id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Download size={18} />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center">
              No artifacts found. Check the GitHub Actions run for details.
            </p>
          )}

          <button
            onClick={downloadProject}
            className="w-full border border-gray-200 text-gray-600 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2 text-sm"
          >
            <FileArchive size={18} /> Download project source (ZIP)
          </button>

          <button
            onClick={reset}
            className="w-full text-sm text-blue-500 hover:text-blue-600 py-2"
          >
            Build again
          </button>
        </div>
      )}

      {/* failed */}
      {phase === 'failed' && (
        <div className="space-y-4">
          <div className="text-red-500 font-medium flex items-center justify-center gap-2">
            <XCircle size={22} /> Build failed
          </div>
          {build?.error_message && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {build.error_message}
            </p>
          )}
          {build?.github_run_url && (
            <a
              href={build.github_run_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-sm text-blue-500 hover:text-blue-600"
            >
              <ExternalLink size={16} /> View run logs on GitHub
            </a>
          )}
          <button
            onClick={reset}
            className="w-full bg-blue-500 text-white font-medium py-2.5 rounded-lg hover:bg-blue-600 transition flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw size={16} /> Try again
          </button>
        </div>
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

function BuildStatusBadge({ build }: { build: BuildRecord | null }) {
  if (!build) return null;
  const status = build.github_status ?? build.status;
  const conclusion = build.github_conclusion;
  const label = conclusion ?? status ?? 'building';
  const isRunning = status === 'queued' || status === 'in_progress' || build.status === 'building';
  const isSuccess = build.status === 'completed';
  const isFailed = build.status === 'failed';

  return (
    <div
      className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium ${
        isSuccess
          ? 'bg-green-50 text-green-600'
          : isFailed
          ? 'bg-red-50 text-red-600'
          : 'bg-blue-50 text-blue-600'
      }`}
    >
      {isRunning ? <Clock size={16} /> : isSuccess ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      <span className="capitalize">{label}</span>
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

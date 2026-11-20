import { useEffect, useState, useCallback } from 'react';
import { Edit2, Download, Trash2, Plus, Star, Loader2, Github, Package, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { supabase, type AppRecord, type AppDraft, type BuildRecord } from '@/lib/supabase';
import { generateAndroidProject } from '@/lib/androidGenerator';
import { buildZip } from '@/lib/zipBuilder';
import { listBuildArtifacts, getArtifactDownloadUrl } from '@/lib/github';

type Props = {
  userId: string;
  onEdit: (record: AppRecord) => void;
  onNew: () => void;
};

export function MyAppsDashboard({ userId, onEdit, onNew }: Props) {
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buildsByApp, setBuildsByApp] = useState<Record<string, BuildRecord[]>>({});
  const [downloading, setDownloading] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('apps')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) {
      setError('Could not load your apps.');
    } else {
      const appList = data as AppRecord[];
      setApps(appList);
      // Load latest build per app
      if (appList.length > 0) {
        const { data: builds } = await supabase
          .from('builds')
          .select('*')
          .in('app_id', appList.map((a) => a.id))
          .order('created_at', { ascending: false });
        const map: Record<string, BuildRecord[]> = {};
        for (const b of (builds as BuildRecord[]) ?? []) {
          if (!b.app_id) continue;
          if (!map[b.app_id]) map[b.app_id] = [];
          map[b.app_id].push(b);
        }
        setBuildsByApp(map);
      }
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this app? This cannot be undone.')) return;
    const { error } = await supabase.from('apps').delete().eq('id', id);
    if (error) {
      setError('Could not delete the app.');
      return;
    }
    setApps((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDownloadProject = (app: AppRecord) => {
    const draft = appRecordToDraft(app);
    const files = generateAndroidProject(draft);
    const zipBlob = buildZip(files);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(app.app_name || 'app').replace(/\s+/g, '_')}_android_project.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadArtifact = async (build: BuildRecord) => {
    if (!tokenInput.trim()) {
      setError('Enter your GitHub token above to download artifacts.');
      return;
    }
    setDownloading(build.id);
    try {
      const arts = await listBuildArtifacts(build.id);
      if (arts.length === 0) {
        setError('No artifacts found for this build.');
        setDownloading(null);
        return;
      }
      const url = await getArtifactDownloadUrl(build.id, arts[0].id, tokenInput.trim());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${arts[0].name}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    }
    setDownloading(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">My Apps</h2>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-1.5 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition"
        >
          <Plus size={18} /> New App
        </button>
      </div>

      {/* GitHub token input for artifact downloads */}
      {apps.length > 0 && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 p-3">
          <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
            <Github size={14} /> GitHub Token (for downloading artifacts — not stored)
          </label>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="ghp_... or github_pat_..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {!loading && !error && apps.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Star size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">You haven't created any apps yet.</p>
          <button onClick={onNew} className="mt-4 text-blue-500 text-sm font-medium hover:text-blue-600">
            Create your first app →
          </button>
        </div>
      )}

      {!loading && apps.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => {
            const builds = buildsByApp[app.id] ?? [];
            const latestBuild = builds[0] ?? null;
            return (
              <div key={app.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {app.icon_url ? (
                      <img src={app.icon_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Star size={24} className="text-green-500 fill-green-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-gray-800 text-sm truncate">
                      {app.app_name || 'Untitled'}
                    </h3>
                    <p className="text-xs text-gray-400 truncate">{app.url || 'No URL'}</p>
                    <p className="text-xs text-gray-400">v{app.major_version}.{app.minor_version}</p>
                  </div>
                </div>

                {/* Build status badge */}
                {latestBuild && (
                  <div className="mb-3">
                    <BuildBadge build={latestBuild} />
                  </div>
                )}

                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
                  <button
                    onClick={() => onEdit(app)}
                    className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-blue-500 hover:bg-blue-50 py-2 rounded-lg transition"
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  {latestBuild?.status === 'completed' && (
                    <button
                      onClick={() => handleDownloadArtifact(latestBuild)}
                      disabled={downloading === latestBuild.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-green-500 hover:bg-green-50 py-2 rounded-lg transition disabled:opacity-50"
                    >
                      {downloading === latestBuild.id ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                      APK
                    </button>
                  )}
                  <button
                    onClick={() => handleDownloadProject(app)}
                    className="inline-flex items-center justify-center text-xs font-medium text-gray-500 hover:bg-gray-100 py-2 px-2 rounded-lg transition"
                    title="Download project ZIP"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(app.id)}
                    className="inline-flex items-center justify-center text-xs font-medium text-red-500 hover:bg-red-50 py-2 px-2 rounded-lg transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BuildBadge({ build }: { build: BuildRecord }) {
  const isCompleted = build.status === 'completed';
  const isFailed = build.status === 'failed';
  const isBuilding = build.status === 'building' || build.status === 'pending';

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
        isCompleted
          ? 'bg-green-50 text-green-600'
          : isFailed
          ? 'bg-red-50 text-red-600'
          : 'bg-blue-50 text-blue-600'
      }`}
    >
      {isBuilding ? <Clock size={12} className="animate-pulse" /> : isCompleted ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      <span className="capitalize">
        {isCompleted ? 'Built' : isFailed ? 'Failed' : 'Building'}
      </span>
      <span className="text-gray-400 ml-1">{build.build_type.toUpperCase()}</span>
    </div>
  );
}

function appRecordToDraft(app: AppRecord): AppDraft {
  const { id, user_id, created_at, updated_at, ...rest } = app;
  void id;
  void user_id;
  void created_at;
  void updated_at;
  return rest;
}

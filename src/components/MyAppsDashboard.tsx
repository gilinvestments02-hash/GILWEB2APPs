import { useEffect, useState } from 'react';
import { Edit2, Download, Trash2, Plus, Star, Loader2 } from 'lucide-react';
import { supabase, type AppRecord, type AppDraft } from '@/lib/supabase';
import { generateAndroidProject } from '@/lib/androidGenerator';
import { buildZip } from '@/lib/zipBuilder';


type Props = {
  userId: string;
  onEdit: (record: AppRecord) => void;
  onNew: () => void;
};

export function MyAppsDashboard({ userId, onEdit, onNew }: Props) {
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('apps')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setApps(data as AppRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this app? This cannot be undone.')) return;
    const { error } = await supabase.from('apps').delete().eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    setApps((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDownload = (app: AppRecord) => {
    const draft: AppDraft = {
      url: app.url,
      app_name: app.app_name,
      major_version: app.major_version,
      minor_version: app.minor_version,
      company_name: app.company_name,
      package_name: app.package_name,
      icon_url: app.icon_url,
      orientation: app.orientation,
      toolbar_enabled: app.toolbar_enabled,
      toolbar_color: app.toolbar_color,
      splash_enabled: app.splash_enabled,
      splash_color: app.splash_color,
      splash_text: app.splash_text,
      admob_app_id: app.admob_app_id,
      admob_banner_id: app.admob_banner_id,
      admob_interstitial_id: app.admob_interstitial_id,
      firebase_enabled: app.firebase_enabled,
      certification_name: app.certification_name,
      certification_email: app.certification_email,
      certification_org: app.certification_org,
      settings_cache_mode: app.settings_cache_mode,
      settings_zoom: app.settings_zoom,
      settings_status_bar: app.settings_status_bar,
      status: app.status,
      current_step: app.current_step,
      build_service_url: app.build_service_url,
    };
    const files = generateAndroidProject(draft);
    const zipBlob = buildZip(files);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(app.app_name || 'app').replace(/\s+/g, '_')}_android_project.zip`;
    a.click();
    URL.revokeObjectURL(url);
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
          {apps.map((app) => (
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

              <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
                <button
                  onClick={() => onEdit(app)}
                  className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-blue-500 hover:bg-blue-50 py-2 rounded-lg transition"
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button
                  onClick={() => handleDownload(app)}
                  className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium text-green-500 hover:bg-green-50 py-2 rounded-lg transition"
                >
                  <Download size={14} /> Download
                </button>
                <button
                  onClick={() => handleDelete(app.id)}
                  className="inline-flex items-center justify-center text-xs font-medium text-red-500 hover:bg-red-50 py-2 px-2 rounded-lg transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

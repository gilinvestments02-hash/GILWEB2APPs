import { useState } from 'react';
import { Star } from 'lucide-react';
import type { AppDraft } from '@/lib/supabase';

type Props = {
  draft: AppDraft;
  onChange: (patch: Partial<AppDraft>) => void;
};

export function IconPanel({ draft, onChange }: Props) {
  const [uploading, setUploading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ icon_url: reader.result as string });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <PanelShell title="Set Icon" subtitle="Upload a logo / icon for your app">
      <div className="flex flex-col items-center gap-4">
        <label className="cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 hover:border-blue-400 transition overflow-hidden">
            {draft.icon_url ? (
              <img src={draft.icon_url} alt="App icon" className="w-full h-full object-cover" />
            ) : uploading ? (
              <span className="text-xs text-gray-400">Uploading…</span>
            ) : (
              <Star size={48} className="text-green-500 fill-green-500" />
            )}
          </div>
        </label>
        <p className="text-sm text-blue-500 font-medium">Set Icon</p>
        <p className="text-xs text-gray-400 text-center max-w-xs">
          Click the star to upload your app icon. PNG or JPG, recommended 512×512.
        </p>
        {draft.icon_url && (
          <button
            onClick={() => onChange({ icon_url: null })}
            className="text-sm text-red-500 hover:text-red-600"
          >
            Remove icon
          </button>
        )}
      </div>
    </PanelShell>
  );
}

export function ToolbarPanel({ draft, onChange }: Props) {
  return (
    <PanelShell title="App Toolbar" subtitle="Configure the in-app toolbar">
      <ToggleRow
        label="Enable toolbar"
        value={draft.toolbar_enabled}
        onChange={(v) => onChange({ toolbar_enabled: v })}
      />
      <ColorRow
        label="Toolbar color"
        value={draft.toolbar_color}
        onChange={(v) => onChange({ toolbar_color: v })}
        disabled={!draft.toolbar_enabled}
      />
      <SelectRow
        label="Orientation"
        value={draft.orientation}
        onChange={(v) => onChange({ orientation: v })}
        options={[
          { value: 'default', label: 'Default (auto)' },
          { value: 'portrait', label: 'Portrait' },
          { value: 'landscape', label: 'Landscape' },
        ]}
      />
    </PanelShell>
  );
}

export function SplashPanel({ draft, onChange }: Props) {
  return (
    <PanelShell title="Splash Screen" subtitle="Shown when your app launches">
      <ToggleRow
        label="Enable splash screen"
        value={draft.splash_enabled}
        onChange={(v) => onChange({ splash_enabled: v })}
      />
      <ColorRow
        label="Background color"
        value={draft.splash_color}
        onChange={(v) => onChange({ splash_color: v })}
        disabled={!draft.splash_enabled}
      />
      <TextRow
        label="Splash text"
        value={draft.splash_text}
        onChange={(v) => onChange({ splash_text: v })}
        placeholder="e.g. Welcome to my app"
        disabled={!draft.splash_enabled}
      />
    </PanelShell>
  );
}

export function CertificationPanel({ draft, onChange }: Props) {
  return (
    <PanelShell title="Certification" subtitle="Developer / publishing details">
      <TextRow label="Developer name" value={draft.certification_name} onChange={(v) => onChange({ certification_name: v })} placeholder="Your name" />
      <TextRow label="Email" value={draft.certification_email} onChange={(v) => onChange({ certification_email: v })} placeholder="you@example.com" />
      <TextRow label="Organization" value={draft.certification_org} onChange={(v) => onChange({ certification_org: v })} placeholder="Org name" />
    </PanelShell>
  );
}

export function FirebasePanel({ draft, onChange }: Props) {
  return (
    <PanelShell title="Firebase" subtitle="Enable Firebase services in your app">
      <ToggleRow
        label="Enable Firebase"
        value={draft.firebase_enabled}
        onChange={(v) => onChange({ firebase_enabled: v })}
      />
      <div className={`text-xs text-gray-400 px-1 ${draft.firebase_enabled ? '' : 'opacity-50'}`}>
        When enabled, your APK will include Firebase Cloud Messaging (push notifications) and
        Analytics. Upload your <code className="bg-gray-100 px-1 rounded">google-services.json</code> in the Finish step.
      </div>
    </PanelShell>
  );
}

export function AdMobPanel({ draft, onChange }: Props) {
  return (
    <PanelShell title="AdMob" subtitle="Monetize your app with ads">
      <TextRow label="App ID" value={draft.admob_app_id} onChange={(v) => onChange({ admob_app_id: v })} placeholder="ca-app-pub-XXXX" />
      <TextRow label="Banner Ad Unit ID" value={draft.admob_banner_id} onChange={(v) => onChange({ admob_banner_id: v })} placeholder="ca-app-pub-XXXX/banner" />
      <TextRow label="Interstitial Ad Unit ID" value={draft.admob_interstitial_id} onChange={(v) => onChange({ admob_interstitial_id: v })} placeholder="ca-app-pub-XXXX/interstitial" />
    </PanelShell>
  );
}

export function SettingsPanel({ draft, onChange }: Props) {
  return (
    <PanelShell title="Settings" subtitle="General app behavior options">
      <SelectRow
        label="Cache mode"
        value={draft.settings_cache_mode}
        onChange={(v) => onChange({ settings_cache_mode: v })}
        options={[
          { value: 'default', label: 'Default' },
          { value: 'no_cache', label: 'No cache' },
          { value: 'cache_else_network', label: 'Cache else network' },
        ]}
      />
      <ToggleRow label="Enable zoom" value={draft.settings_zoom} onChange={(v) => onChange({ settings_zoom: v })} />
      <ToggleRow label="Show status bar" value={draft.settings_status_bar} onChange={(v) => onChange({ settings_status_bar: v })} />
    </PanelShell>
  );
}

export function BuildServicePanel() {
  return null;
}

/* ---------- shared bits ---------- */

function PanelShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
      <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
      <p className="text-sm text-gray-400 mb-4">{subtitle}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition ${value ? 'bg-blue-500' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            value ? 'translate-x-6' : ''
          }`}
        />
      </button>
    </div>
  );
}

function TextRow({ label, value, onChange, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
      />
    </div>
  );
}

function ColorRow({ label, value, onChange, disabled }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${disabled ? 'opacity-50' : ''}`}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}

function SelectRow({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}



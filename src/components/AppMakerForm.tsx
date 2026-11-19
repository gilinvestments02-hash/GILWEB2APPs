import { useState } from 'react';
import { Settings as SettingsIcon, Copy, Star } from 'lucide-react';
import type { AppDraft } from '@/lib/supabase';
import { Simulator } from './Simulator';

type Props = {
  draft: AppDraft;
  onChange: (patch: Partial<AppDraft>) => void;
};

export function AppMakerForm({ draft, onChange }: Props) {
  const [tab, setTab] = useState<'online' | 'html'>('online');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4 relative">
      {/* gear icon */}
      <div className="absolute top-4 right-4 text-gray-300">
        <SettingsIcon size={22} />
      </div>

      <h2 className="font-bold text-gray-800 text-lg mb-4">App Maker</h2>

      {/* tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab('online')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'online' ? 'bg-gray-200 text-gray-800' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Online URL
        </button>
        <button
          onClick={() => setTab('html')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
            tab === 'html' ? 'bg-gray-200 text-gray-800' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          HTML Files
          <Copy size={14} />
        </button>
      </div>

      {tab === 'online' ? (
        <div className="space-y-4">
          {/* URL field + simulator */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL ?</label>
            <input
              type="text"
              value={draft.url}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder="https://m.example.com"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <Simulator url={draft.url} orientation={draft.orientation} />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload HTML files</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-400">
              <Copy size={32} className="mx-auto mb-2 text-gray-300" />
              Drag & drop your HTML files here, or click to browse.
              <br />
              (ZIP file containing index.html)
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Note: Online URL mode is the simplest way to wrap your website into an Android app.
          </p>
        </div>
      )}

      <hr className="my-5 border-gray-100" />

      {/* App name */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Give your App a name ?</label>
          <input
            type="text"
            value={draft.app_name}
            onChange={(e) => onChange({ app_name: e.target.value })}
            placeholder="App Name"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* version fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Major Version ?</label>
            <input
              type="number"
              min={0}
              value={draft.major_version}
              onChange={(e) => onChange({ major_version: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minor Version ?</label>
            <input
              type="number"
              min={0}
              value={draft.minor_version}
              onChange={(e) => onChange({ minor_version: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Company */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company / Brand Name ?</label>
          <input
            type="text"
            value={draft.company_name}
            onChange={(e) => onChange({ company_name: e.target.value })}
            placeholder="My Company"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Package name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Package Name ?</label>
          <input
            type="text"
            value={draft.package_name}
            onChange={(e) => onChange({ package_name: e.target.value })}
            placeholder="com.company.appname"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          />
        </div>
      </div>
    </div>
  );
}

export function ExtrasCard({ draft, onSetIcon, onNext }: { draft: AppDraft; onSetIcon: () => void; onNext: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4 relative">
      {/* hamburger on right */}
      <div className="absolute top-4 right-4 text-gray-300">
        <div className="space-y-1">
          <div className="w-5 h-0.5 bg-gray-300 rounded" />
          <div className="w-5 h-0.5 bg-gray-300 rounded" />
          <div className="w-5 h-0.5 bg-gray-300 rounded" />
        </div>
      </div>

      <h2 className="font-bold text-gray-800 text-lg mb-5">Extras</h2>

      {/* dashed icon box */}
      <button onClick={onSetIcon} className="w-full flex flex-col items-center mb-6 group">
        <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 group-hover:border-blue-400 transition overflow-hidden">
          {draft.icon_url ? (
            <img src={draft.icon_url} alt="App icon" className="w-full h-full object-cover" />
          ) : (
            <Star size={56} className="text-green-500 fill-green-500" />
          )}
        </div>
        <span className="mt-2 text-sm font-medium text-blue-500">Set Icon</span>
      </button>

      {/* next button */}
      <button
        onClick={onNext}
        className="w-full bg-white border-2 border-gray-800 text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2 text-lg"
      >
        Next <span className="text-black">&gt;&gt;</span>
      </button>
    </div>
  );
}

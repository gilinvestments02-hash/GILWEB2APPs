import { useState, useEffect, useCallback } from 'react';
import { Github, KeyRound, Upload, Check, Loader2, Trash2, AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import type { AppDraft, GithubConfig } from '@/lib/supabase';
import {
  listConfigs,
  saveConfig,
  updateConfig,
  deleteConfig as deleteConfigApi,
  testConfig,
  fileToBase64,
  type ConfigInput,
} from '@/lib/github';

type Props = {
  draft: AppDraft;
  onChange: (patch: Partial<AppDraft>) => void;
};

export function GitHubPanel({ draft, onChange }: Props) {
  const [configs, setConfigs] = useState<GithubConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [branch, setBranch] = useState('main');
  const [workflow, setWorkflow] = useState('android-build.yml');
  const [githubToken, setGithubToken] = useState('');
  const [keystoreFile, setKeystoreFile] = useState<File | null>(null);
  const [keystorePassword, setKeystorePassword] = useState('');
  const [keyAlias, setKeyAlias] = useState('');
  const [keyPassword, setKeyPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listConfigs();
      setConfigs(list);
      const selected = draft.github_config_id ? list.find((c) => c.id === draft.github_config_id) : null;
      if (selected) {
        setEditingId(selected.id);
        setRepoOwner(selected.repo_owner);
        setRepoName(selected.repo_name);
        setBranch(selected.default_branch);
        setWorkflow(selected.workflow_filename);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load configs');
    }
    setLoading(false);
  }, [draft.github_config_id]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setRepoOwner('');
    setRepoName('');
    setBranch('main');
    setWorkflow('android-build.yml');
    setGithubToken('');
    setKeystoreFile(null);
    setKeystorePassword('');
    setKeyAlias('');
    setKeyPassword('');
    setTestResult(null);
    setError(null);
  };

  const selectConfig = (c: GithubConfig) => {
    setEditingId(c.id);
    setRepoOwner(c.repo_owner);
    setRepoName(c.repo_name);
    setBranch(c.default_branch);
    setWorkflow(c.workflow_filename);
    onChange({ github_config_id: c.id });
    setGithubToken('');
    setTestResult(null);
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    if (!repoOwner || !repoName) {
      setError('Repository owner and name are required.');
      return;
    }
    setSaving(true);
    try {
      const input: ConfigInput = {
        repo_owner: repoOwner,
        repo_name: repoName,
        default_branch: branch,
        workflow_filename: workflow,
      };
      if (githubToken) input.github_token = githubToken;
      if (keystoreFile) {
        input.keystore_base64 = await fileToBase64(keystoreFile);
        input.keystore_password = keystorePassword;
        input.key_alias = keyAlias;
        input.key_password = keyPassword;
      }

      let saved: GithubConfig;
      if (editingId) {
        saved = await updateConfig(editingId, input);
      } else {
        saved = await saveConfig(input);
        setEditingId(saved.id);
      }
      onChange({ github_config_id: saved.id });
      await load();
      setGithubToken('');
      setKeystoreFile(null);
      setKeystorePassword('');
      setKeyAlias('');
      setKeyPassword('');
      setTestResult({ ok: true, msg: 'Configuration saved.' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setError(null);
    if (!editingId) {
      setError('Save the configuration first before testing.');
      return;
    }
    if (!githubToken) {
      setError('Enter your GitHub token to test the connection.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConfig(editingId, githubToken);
      if (result.ok) {
        setTestResult({
          ok: true,
          msg: `Connected to ${result.repo?.full_name}. Default branch: ${result.repo?.default_branch}.`,
        });
      } else {
        setTestResult({ ok: false, msg: result.error ?? 'Connection failed' });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : 'Connection failed' });
    }
    setTesting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this GitHub configuration?')) return;
    try {
      await deleteConfigApi(id);
      if (editingId === id) {
        resetForm();
        onChange({ github_config_id: null });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Github size={22} className="text-gray-800" />
        <h3 className="font-bold text-gray-800 text-lg">GitHub Build Service</h3>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Connect a GitHub repository to compile your Android app with GitHub Actions.
      </p>

      {/* Setup instructions */}
      <details className="mb-5 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <summary className="text-sm font-medium text-blue-700 cursor-pointer flex items-center gap-1.5">
          <ShieldCheck size={16} /> Setup instructions (tap to open)
        </summary>
        <div className="mt-3 text-xs text-gray-600 space-y-2 leading-relaxed">
          <p><strong className="text-gray-800">1. Create a GitHub repository</strong> — empty, no README. Note the owner and repo name (e.g. <code className="bg-white px-1 rounded">yourname/android-builds</code>).</p>
          <p><strong className="text-gray-800">2. Create a Personal Access Token (classic)</strong> at <code className="bg-white px-1 rounded">github.com/settings/tokens</code> with scope <em>repo</em> (full repo access). For fine-grained tokens, grant Read &amp; Write on Contents, Actions, and Workflows for that repository.</p>
          <p><strong className="text-gray-800">3. Enable Actions</strong> — in your repo, go to Settings → Actions → General, and allow all actions.</p>
          <p><strong className="text-gray-800">4. (Optional) Signing</strong> — for release builds, upload your keystore (.jks/.keystore) and fill in the passwords. These are stored encrypted and only used during the build.</p>
          <p className="text-gray-400">Your token is never stored on our server — you enter it each session to trigger and monitor builds.</p>
        </div>
      </details>

      {loading && (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* Saved configs */}
          {configs.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Saved repositories</p>
              {configs.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between border rounded-lg p-3 transition cursor-pointer ${
                    editingId === c.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => selectConfig(c)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {c.repo_owner}/{c.repo_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      branch: {c.default_branch} {c.has_keystore && '· signing configured'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">
                {editingId ? 'Edit configuration' : 'New configuration'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Repository owner</label>
                <input
                  type="text"
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  placeholder="your-username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Repository name</label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="android-builds"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Default branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Workflow filename</label>
                <input
                  type="text"
                  value={workflow}
                  onChange={(e) => setWorkflow(e.target.value)}
                  placeholder="android-build.yml"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* GitHub token — never stored */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <KeyRound size={14} /> GitHub Personal Access Token (not stored)
              </label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_... or github_pat_..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-xs text-gray-400 mt-1">Required to trigger builds and test the connection. Enter it each session.</p>
            </div>

            {/* Signing (optional) */}
            <details className="border border-gray-200 rounded-lg p-3">
              <summary className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-gray-500" /> Release signing (optional)
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Keystore file (.jks or .keystore)</label>
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition">
                    <Upload size={16} className="text-gray-400" />
                    <span className="text-sm text-gray-500 truncate">
                      {keystoreFile ? keystoreFile.name : 'Choose file…'}
                    </span>
                    <input
                      type="file"
                      accept=".jks,.keystore,application/octet-stream"
                      className="hidden"
                      onChange={(e) => setKeystoreFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Keystore password</label>
                    <input
                      type="password"
                      value={keystorePassword}
                      onChange={(e) => setKeystorePassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Key alias</label>
                    <input
                      type="text"
                      value={keyAlias}
                      onChange={(e) => setKeyAlias(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Key password</label>
                  <input
                    type="password"
                    value={keyPassword}
                    onChange={(e) => setKeyPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            </details>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {testResult && (
              <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${testResult.ok ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                {testResult.ok ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                <span>{testResult.msg}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-blue-500 text-white font-medium py-2.5 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition flex items-center justify-center gap-2 text-sm"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {saving ? 'Saving…' : editingId ? 'Update' : 'Save'}
              </button>
              <button
                onClick={handleTest}
                disabled={testing || !editingId}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition flex items-center justify-center gap-2 text-sm"
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                {testing ? 'Testing…' : 'Test connection'}
              </button>
            </div>

            {editingId && (
              <button
                onClick={resetForm}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-1"
              >
                + New configuration
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

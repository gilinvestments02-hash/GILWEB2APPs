import { supabase } from './supabase';
import type { BuildRecord, BuildArtifact, GithubConfig } from './supabase';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/android-builder`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? '';
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

async function callEdge<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${EDGE_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!res.ok) {
    const errMsg = (body as { error?: string }).error ?? `Request failed (${res.status})`;
    throw new Error(errMsg);
  }
  return body as T;
}

// ---------- Config ----------

export type ConfigInput = {
  repo_owner: string;
  repo_name: string;
  default_branch?: string;
  workflow_filename?: string;
  github_token?: string;
  keystore_base64?: string;
  keystore_password?: string;
  key_alias?: string;
  key_password?: string;
};

export async function listConfigs(): Promise<GithubConfig[]> {
  const res = await callEdge<{ configs: GithubConfig[] }>('/config');
  return res.configs;
}

export async function saveConfig(input: ConfigInput): Promise<GithubConfig> {
  const res = await callEdge<{ config: GithubConfig }>('/config', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.config;
}

export async function updateConfig(id: string, input: Partial<ConfigInput>): Promise<GithubConfig> {
  const res = await callEdge<{ config: GithubConfig }>(`/config/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return res.config;
}

export async function deleteConfig(id: string): Promise<void> {
  await callEdge(`/config/${id}`, { method: 'DELETE' });
}

export async function testConfig(id: string, githubToken: string): Promise<{ ok: boolean; repo?: { full_name: string; default_branch: string; private: boolean; permissions: Record<string, boolean> }; error?: string }> {
  const res = await callEdge<{ ok: boolean; repo?: { full_name: string; default_branch: string; private: boolean; permissions: Record<string, boolean> }; error?: string }>(`/config/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ github_token: githubToken }),
  });
  return res;
}

// ---------- Builds ----------

export type BuildConfigInput = {
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

export async function triggerBuild(params: {
  appId?: string;
  githubConfigId: string;
  githubToken: string;
  config: BuildConfigInput;
}): Promise<{ buildId: string; runId: number; runUrl: string; status: string; commitSha: string }> {
  return callEdge('/build', {
    method: 'POST',
    body: JSON.stringify({
      app_id: params.appId,
      github_config_id: params.githubConfigId,
      github_token: params.githubToken,
      config: params.config,
    }),
  });
}

export async function getBuildStatus(buildId: string): Promise<{ build: BuildRecord }> {
  return callEdge(`/build/${buildId}/status`);
}

export async function refreshBuildStatus(buildId: string, githubToken: string): Promise<{ build: BuildRecord; artifacts?: BuildArtifact[] }> {
  return callEdge(`/build/${buildId}/refresh?token=${encodeURIComponent(githubToken)}`, {
    method: 'POST',
  });
}

export async function listBuildArtifacts(buildId: string): Promise<BuildArtifact[]> {
  const res = await callEdge<{ artifacts: BuildArtifact[] }>(`/build/${buildId}/artifacts`);
  return res.artifacts;
}

export async function getArtifactDownloadUrl(buildId: string, artifactId: string, githubToken: string): Promise<string> {
  // The edge function proxies the actual ZIP download. We build a URL that opens
  // the download in a new tab. But since we need auth headers + token, we fetch
  // the blob here and create an object URL.
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${EDGE_URL}/build/${buildId}/download?token=${encodeURIComponent(githubToken)}&artifact_id=${encodeURIComponent(artifactId)}`,
    { headers },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function loadBuildsForApp(appId: string): Promise<BuildRecord[]> {
  const { data, error } = await supabase
    .from('builds')
    .select('*')
    .eq('app_id', appId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as BuildRecord[]) ?? [];
}

export async function loadBuildsForUser(userId: string): Promise<BuildRecord[]> {
  const { data, error } = await supabase
    .from('builds')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as BuildRecord[]) ?? [];
}

// ---------- Helpers ----------

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip the data URL prefix, leaving raw base64
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

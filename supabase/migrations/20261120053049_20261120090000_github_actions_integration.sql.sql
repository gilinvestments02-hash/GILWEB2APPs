/*
# GitHub Actions Build Integration

Replaces the mock build-service architecture with real GitHub Actions builds.

## New Tables

### github_configs
Per-user GitHub repository + token configuration used by the android-builder
edge function to trigger workflows and poll run status.
- id (uuid pk)
- user_id (uuid, owner, defaults to auth.uid())
- repo_owner (text) — GitHub user/org that owns the repo
- repo_name (text) — repository name (e.g. "android-builds")
- default_branch (text, default "main")
- workflow_filename (text, default "android-build.yml")
- keystore_base64 (text, nullable) — base64-encoded release keystore
- keystore_password (text, nullable)
- key_alias (text, nullable)
- key_password (text, nullable)
- has_keystore (boolean) — derived flag so users can see whether signing is set
  without reading the secret values
- created_at, updated_at

### build_artifacts
Downloadable artifacts produced by a completed GitHub Actions run.
- id (uuid pk)
- build_id (uuid, references builds, cascade delete)
- user_id (uuid, owner)
- name (text)
- archive_download_url (text)
- size_in_bytes (bigint)
- storage_path (text, nullable)
- expires_at (timestamptz, nullable)
- created_at (timestamptz)

## Modified Tables

### builds
New columns: github_run_id (bigint), github_run_url (text), github_status (text),
github_conclusion (text), project_source (text), artifact_id (uuid).
status default changed to 'pending'.
service_role granted full CRUD for edge function updates.

### apps
New columns: github_config_id (uuid), last_build_type (text).

## Storage

- New private bucket "builds" for source zips and mirrored artifacts.
- Owner-folder-scoped policies; private bucket, downloads via signed URLs.

## Security

- github_configs: RLS enabled, owner-scoped CRUD. keystore_* columns are
  SELECT-revoked from authenticated (only service_role reads them). Users see
  has_keystore instead.
- builds: owner-scoped CRUD, authenticated + service_role.
- build_artifacts: owner-scoped SELECT for authenticated; service_role full.
- Storage bucket "builds": private, owner-folder-scoped.
*/

-- ---------- github_configs ----------
CREATE TABLE IF NOT EXISTS github_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_owner text NOT NULL DEFAULT '',
  repo_name text NOT NULL DEFAULT '',
  default_branch text NOT NULL DEFAULT 'main',
  workflow_filename text NOT NULL DEFAULT 'android-build.yml',
  keystore_base64 text,
  keystore_password text,
  key_alias text,
  key_password text,
  has_keystore boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE github_configs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON github_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON github_configs TO service_role;

-- Restrict keystore columns: authenticated users cannot SELECT the raw values.
REVOKE SELECT (keystore_base64, keystore_password, key_alias, key_password) ON github_configs FROM authenticated;
GRANT SELECT (id, user_id, repo_owner, repo_name, default_branch, workflow_filename, has_keystore, created_at, updated_at) ON github_configs TO authenticated;
GRANT UPDATE (repo_owner, repo_name, default_branch, workflow_filename, keystore_base64, keystore_password, key_alias, key_password, has_keystore) ON github_configs TO authenticated;
GRANT INSERT (repo_owner, repo_name, default_branch, workflow_filename, keystore_base64, keystore_password, key_alias, key_password, has_keystore) ON github_configs TO authenticated;

DROP POLICY IF EXISTS "select_own_github_configs" ON github_configs;
CREATE POLICY "select_own_github_configs" ON github_configs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_github_configs" ON github_configs;
CREATE POLICY "insert_own_github_configs" ON github_configs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_github_configs" ON github_configs;
CREATE POLICY "update_own_github_configs" ON github_configs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_github_configs" ON github_configs;
CREATE POLICY "delete_own_github_configs" ON github_configs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- builds: new columns ----------
ALTER TABLE builds ADD COLUMN IF NOT EXISTS github_run_id bigint;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS github_run_url text;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS github_status text;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS github_conclusion text;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS project_source text;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS artifact_id uuid;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS build_type text NOT NULL DEFAULT 'apk';

ALTER TABLE builds ALTER COLUMN status SET DEFAULT 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON builds TO service_role;

-- ---------- build_artifacts ----------
CREATE TABLE IF NOT EXISTS build_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id uuid REFERENCES builds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  archive_download_url text NOT NULL DEFAULT '',
  size_in_bytes bigint NOT NULL DEFAULT 0,
  storage_path text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE build_artifacts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON build_artifacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON build_artifacts TO service_role;

DROP POLICY IF EXISTS "select_own_artifacts" ON build_artifacts;
CREATE POLICY "select_own_artifacts" ON build_artifacts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ---------- apps: new columns ----------
ALTER TABLE apps ADD COLUMN IF NOT EXISTS github_config_id uuid;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS last_build_type text;

GRANT SELECT, UPDATE ON apps TO service_role;

-- ---------- indexes ----------
CREATE INDEX IF NOT EXISTS idx_builds_user_id ON builds(user_id);
CREATE INDEX IF NOT EXISTS idx_builds_app_id ON builds(app_id);
CREATE INDEX IF NOT EXISTS idx_builds_github_run_id ON builds(github_run_id);
CREATE INDEX IF NOT EXISTS idx_build_artifacts_build_id ON build_artifacts(build_id);
CREATE INDEX IF NOT EXISTS idx_github_configs_user_id ON github_configs(user_id);

-- ---------- storage bucket: builds ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('builds', 'builds', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "builds_bucket_read_own" ON storage.objects;
CREATE POLICY "builds_bucket_read_own" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'builds' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "builds_bucket_write_own" ON storage.objects;
CREATE POLICY "builds_bucket_write_own" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'builds' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "builds_bucket_update_own" ON storage.objects;
CREATE POLICY "builds_bucket_update_own" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'builds' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'builds' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "builds_bucket_delete_own" ON storage.objects;
CREATE POLICY "builds_bucket_delete_own" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'builds' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "builds_bucket_service_role_all" ON storage.objects;
CREATE POLICY "builds_bucket_service_role_all" ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'builds')
  WITH CHECK (bucket_id = 'builds');

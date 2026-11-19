/*
# Create apps table for GILWEB2APP

1. New Tables
- `apps`
  - id (uuid, primary key)
  - user_id (uuid, owner, defaults to auth.uid())
  - url (text, the website URL to convert)
  - app_name (text, name of the app)
  - major_version (int, default 1)
  - minor_version (int, default 0)
  - company_name (text, company/brand)
  - package_name (text, e.g. com.company.appname)
  - icon_url (text, uploaded icon URL or null)
  - orientation (text, default 'default' - portrait/landscape/default)
  - toolbar_enabled (boolean, default false)
  - toolbar_color (text, default '#1E90FF')
  - splash_enabled (boolean, default false)
  - splash_color (text, default '#FFFFFF')
  - splash_text (text, default '')
  - admob_app_id (text, default '')
  - admob_banner_id (text, default '')
  - admob_interstitial_id (text, default '')
  - firebase_enabled (boolean, default false)
  - certification_name (text, default '')
  - certification_email (text, default '')
  - certification_org (text, default '')
  - settings_cache_mode (text, default 'default')
  - settings_zoom (boolean, default false)
  - settings_status_bar (boolean, default true)
  - status (text, default 'draft' - draft/built/finished)
  - current_step (int, default 1)
  - created_at (timestamptz)
  - updated_at (timestamptz)

2. Security
- Enable RLS on `apps`.
- Grant CRUD to `authenticated` only (app requires sign-in).
- Owner-scoped CRUD: each authenticated user can only access their own apps.
*/

CREATE TABLE IF NOT EXISTS apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL DEFAULT '',
  app_name text NOT NULL DEFAULT '',
  major_version int NOT NULL DEFAULT 1,
  minor_version int NOT NULL DEFAULT 0,
  company_name text NOT NULL DEFAULT '',
  package_name text NOT NULL DEFAULT '',
  icon_url text,
  orientation text NOT NULL DEFAULT 'default',
  toolbar_enabled boolean NOT NULL DEFAULT false,
  toolbar_color text NOT NULL DEFAULT '#1E90FF',
  splash_enabled boolean NOT NULL DEFAULT false,
  splash_color text NOT NULL DEFAULT '#FFFFFF',
  splash_text text NOT NULL DEFAULT '',
  admob_app_id text NOT NULL DEFAULT '',
  admob_banner_id text NOT NULL DEFAULT '',
  admob_interstitial_id text NOT NULL DEFAULT '',
  firebase_enabled boolean NOT NULL DEFAULT false,
  certification_name text NOT NULL DEFAULT '',
  certification_email text NOT NULL DEFAULT '',
  certification_org text NOT NULL DEFAULT '',
  settings_cache_mode text NOT NULL DEFAULT 'default',
  settings_zoom boolean NOT NULL DEFAULT false,
  settings_status_bar boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft',
  current_step int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE apps ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON apps TO authenticated;

DROP POLICY IF EXISTS "select_own_apps" ON apps;
CREATE POLICY "select_own_apps" ON apps FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_apps" ON apps;
CREATE POLICY "insert_own_apps" ON apps FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_apps" ON apps;
CREATE POLICY "update_own_apps" ON apps FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_apps" ON apps;
CREATE POLICY "delete_own_apps" ON apps FOR DELETE
TO authenticated USING (auth.uid() = user_id);

/*
# Create builds table for GILWEB2APP

1. New Tables
- `builds`
  - id (uuid, primary key)
  - app_id (text, references app id as string, nullable)
  - user_id (uuid, owner, defaults to auth.uid())
  - project_name (text)
  - package_name (text)
  - build_type (text: 'apk' or 'aab')
  - status (text: 'project_ready', 'building', 'completed', 'failed')
  - manifest (jsonb, the generated Android project files)
  - download_url (text, nullable)
  - error_message (text, nullable)
  - created_at (timestamptz)
  - updated_at (timestamptz)

2. Security
- Enable RLS on `builds`.
- Grant CRUD to `authenticated` only.
- Owner-scoped: each user can only access their own builds.
*/

CREATE TABLE IF NOT EXISTS builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_name text NOT NULL DEFAULT '',
  package_name text NOT NULL DEFAULT '',
  build_type text NOT NULL DEFAULT 'apk',
  status text NOT NULL DEFAULT 'project_ready',
  manifest jsonb,
  download_url text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE builds ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON builds TO authenticated;

DROP POLICY IF EXISTS "select_own_builds" ON builds;
CREATE POLICY "select_own_builds" ON builds FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_builds" ON builds;
CREATE POLICY "insert_own_builds" ON builds FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_builds" ON builds;
CREATE POLICY "update_own_builds" ON builds FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_builds" ON builds;
CREATE POLICY "delete_own_builds" ON builds FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- Add build service URL field to apps table
ALTER TABLE apps ADD COLUMN IF NOT EXISTS build_service_url text NOT NULL DEFAULT '';

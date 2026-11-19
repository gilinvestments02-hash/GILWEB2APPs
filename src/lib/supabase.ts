import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type AppRecord = {
  id: string;
  user_id: string;
  url: string;
  app_name: string;
  major_version: number;
  minor_version: number;
  company_name: string;
  package_name: string;
  icon_url: string | null;
  orientation: string;
  toolbar_enabled: boolean;
  toolbar_color: string;
  splash_enabled: boolean;
  splash_color: string;
  splash_text: string;
  admob_app_id: string;
  admob_banner_id: string;
  admob_interstitial_id: string;
  firebase_enabled: boolean;
  certification_name: string;
  certification_email: string;
  certification_org: string;
  settings_cache_mode: string;
  settings_zoom: boolean;
  settings_status_bar: boolean;
  status: string;
  current_step: number;
  build_service_url: string;
  created_at: string;
  updated_at: string;
};

export type AppDraft = Omit<AppRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export type BuildRecord = {
  id: string;
  app_id: string | null;
  user_id: string;
  project_name: string;
  package_name: string;
  build_type: string;
  status: string;
  manifest: Record<string, string> | null;
  download_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

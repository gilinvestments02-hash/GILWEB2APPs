import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase, type AppDraft, type AppRecord } from '@/lib/supabase';
import { defaultDraft } from '@/lib/defaultDraft';
import { AuthScreen } from '@/components/AuthScreen';
import { Header } from '@/components/Header';
import { ProgressSteps } from '@/components/ProgressSteps';
import { SlideMenu, type MenuPanel } from '@/components/SlideMenu';
import { AppMakerForm, ExtrasCard } from '@/components/AppMakerForm';
import {
  IconPanel,
  ToolbarPanel,
  SplashPanel,
  CertificationPanel,
  FirebasePanel,
  AdMobPanel,
  SettingsPanel,
  BuildServicePanel,
} from '@/components/SettingsPanels';
import { FinishStep } from '@/components/FinishStep';
import { MyAppsDashboard } from '@/components/MyAppsDashboard';
import { Loader2 } from 'lucide-react';

type View = 'maker' | 'dashboard';
type Step = 1 | 2 | 3;

function Builder() {
  const { user, signOut } = useAuth();
  const [view, setView] = useState<View>('maker');
  const [step, setStep] = useState<Step>(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<MenuPanel>(null);
  const [draft, setDraft] = useState<AppDraft>(defaultDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // If a record is passed through sessionStorage (from dashboard Edit), load it
  useEffect(() => {
    const raw = sessionStorage.getItem('editApp');
    if (raw) {
      try {
        const rec = JSON.parse(raw) as AppRecord;
        const { id, ...rest } = rec;
        void rec;
        setDraft(rest);
        setEditingId(id);
        setStep(1);
        setView('maker');
      } catch {
        // ignore
      }
      sessionStorage.removeItem('editApp');
    }
  }, []);

  if (!user) return <AuthScreen />;

  const patch = (p: Partial<AppDraft>) => setDraft((d) => ({ ...d, ...p }));

  const saveApp = async (statusOverride?: string) => {
    setSaving(true);
    setSaveMsg(null);
    const payload = { ...draft, status: statusOverride ?? draft.status, current_step: step };

    if (editingId) {
      const { error } = await supabase.from('apps').update(payload).eq('id', editingId);
      if (error) {
        setSaveMsg(`Error: ${error.message}`);
      } else {
        setSaveMsg('Saved!');
        setTimeout(() => setSaveMsg(null), 2000);
      }
    } else {
      const { data, error } = await supabase.from('apps').insert(payload).select().single();
      if (error) {
        setSaveMsg(`Error: ${error.message}`);
      } else {
        setEditingId((data as AppRecord).id);
        setSaveMsg('Saved!');
        setTimeout(() => setSaveMsg(null), 2000);
      }
    }
    setSaving(false);
  };

  const goToNext = () => {
    if (step < 3) {
      setStep((step + 1) as Step);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPrev = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEdit = (rec: AppRecord) => {
    const { id, ...rest } = rec;
    setDraft(rest);
    setEditingId(id);
    setStep(1);
    setView('maker');
  };

  const handleNew = () => {
    setDraft(defaultDraft);
    setEditingId(null);
    setStep(1);
    setView('maker');
  };

  const urlBar = `http://gilweb2app.com/${view === 'dashboard' ? 'my-apps' : step === 1 ? 'general' : step === 2 ? 'app-maker' : 'finish'}`;

  /* ---- settings panel rendering ---- */
  const renderPanel = () => {
    switch (activePanel) {
      case 'icon':
        return <IconPanel draft={draft} onChange={patch} />;
      case 'toolbar':
        return <ToolbarPanel draft={draft} onChange={patch} />;
      case 'splash':
        return <SplashPanel draft={draft} onChange={patch} />;
      case 'certification':
        return <CertificationPanel draft={draft} onChange={patch} />;
      case 'firebase':
        return <FirebasePanel draft={draft} onChange={patch} />;
      case 'admob':
        return <AdMobPanel draft={draft} onChange={patch} />;
      case 'settings':
        return <SettingsPanel draft={draft} onChange={patch} />;
      case 'buildservice':
        return <BuildServicePanel draft={draft} onChange={patch} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header
        url={urlBar}
        onMenuClick={() => setMenuOpen(true)}
        onBackClick={() => {
          if (activePanel) {
            setActivePanel(null);
          } else if (view === 'dashboard') {
            setView('maker');
          } else if (step > 1) {
            goToPrev();
          }
        }}
        onLogoClick={() => { setView('maker'); setActivePanel(null); }}
      />

      {view === 'maker' && (
        <>
          <ProgressSteps current={step} />
        </>
      )}

      <SlideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSelect={(panel) => {
          setActivePanel(panel);
          setView('maker');
        }}
        onMyApps={() => { setView('dashboard'); setActivePanel(null); }}
        onLogout={() => signOut()}
      />

      <main className="max-w-2xl mx-auto px-4 pb-8">
        {saveMsg && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
            {saveMsg}
          </div>
        )}

        {view === 'dashboard' ? (
          <MyAppsDashboard userId={user.id} onEdit={handleEdit} onNew={handleNew} />
        ) : activePanel ? (
          <>
            {renderPanel()}
            <button
              onClick={() => setActivePanel(null)}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              ← Back to App Maker
            </button>
          </>
        ) : step === 1 ? (
          /* Step 1: General — same form as step 2 in this clone, show App Maker + Extras */
          <>
            <AppMakerForm
              draft={draft}
              onChange={patch}
            />
            <ExtrasCard draft={draft} onSetIcon={() => setActivePanel('icon')} onNext={goToNext} />
          </>
        ) : step === 2 ? (
          /* Step 2: App Maker — show the same builder with save button */
          <>
            <AppMakerForm
              draft={draft}
              onChange={patch}
            />
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
              <button
                onClick={() => saveApp()}
                disabled={saving}
                className="w-full bg-blue-500 text-white font-medium py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save App'}
              </button>
            </div>
            <ExtrasCard draft={draft} onSetIcon={() => setActivePanel('icon')} onNext={goToNext} />
          </>
        ) : (
          /* Step 3: Finish */
          <FinishStep draft={draft} onBack={goToPrev} onSave={() => saveApp('finished')} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return <Builder />;
}

import {
  Star,
  LayoutPanelTop,
  Image,
  BadgeCheck,
  Flame,
  DollarSign,
  Settings,
  X,
  ListChecks,
  LogOut,
  Cloud,
} from 'lucide-react';

export type MenuPanel =
  | 'icon'
  | 'toolbar'
  | 'splash'
  | 'certification'
  | 'firebase'
  | 'admob'
  | 'settings'
  | 'buildservice'
  | null;

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (panel: MenuPanel) => void;
  onMyApps: () => void;
  onLogout: () => void;
};

const items: { label: string; icon: typeof Star; panel: MenuPanel }[] = [
  { label: 'Set Icon', icon: Star, panel: 'icon' },
  { label: 'App Toolbar', icon: LayoutPanelTop, panel: 'toolbar' },
  { label: 'Splash Screen', icon: Image, panel: 'splash' },
  { label: 'Certification', icon: BadgeCheck, panel: 'certification' },
  { label: 'Firebase', icon: Flame, panel: 'firebase' },
  { label: 'AdMob', icon: DollarSign, panel: 'admob' },
  { label: 'Settings', icon: Settings, panel: 'settings' },
  { label: 'Build Service', icon: Cloud, panel: 'buildservice' },
];

export function SlideMenu({ open, onClose, onSelect, onMyApps, onLogout }: Props) {
  return (
    <>
      {/* overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      {/* panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-72 bg-white shadow-xl z-50 transform transition-transform duration-300 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-bold text-gray-800">Menu</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {items.map(({ label, icon: Icon, panel }) => (
            <button
              key={label}
              onClick={() => {
                onSelect(panel);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <Icon size={20} className="text-blue-500" />
              {label}
            </button>
          ))}
        </nav>

        <div className="border-t border-gray-200 py-2">
          <button
            onClick={() => {
              onMyApps();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <ListChecks size={20} className="text-blue-500" />
            My Apps
          </button>
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <LogOut size={20} className="text-blue-500" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

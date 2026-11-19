import { ChevronLeft, Menu, X } from 'lucide-react';

type Props = {
  url: string;
  onMenuClick: () => void;
  onBackClick: () => void;
  onLogoClick: () => void;
};

export function Header({ url, onMenuClick, onBackClick, onLogoClick }: Props) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="flex items-center justify-between px-3 py-2.5 max-w-5xl mx-auto">
        <button
          onClick={onBackClick}
          className="text-blue-500 hover:text-blue-600 p-1"
          aria-label="Back"
        >
          <ChevronLeft size={26} />
        </button>

        <button onClick={onLogoClick} className="flex items-center gap-1.5">
          <span className="text-green-500 font-bold text-xl">&lt;</span>
          <span className="text-blue-500 font-bold text-xl tracking-tight">GILWEB2APP</span>
          <span className="text-green-500 font-bold text-xl">&gt;</span>
        </button>

        <button
          onClick={onMenuClick}
          className="text-blue-500 hover:text-blue-600 p-1"
          aria-label="Menu"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* URL bar */}
      <div className="px-3 pb-2 max-w-5xl mx-auto">
        <div className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-500 truncate font-mono">
          {url}
        </div>
      </div>
    </header>
  );
}

export function CloseMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close menu">
      <X size={22} />
    </button>
  );
}

import { useState } from 'react';
import { Smartphone, ChevronDown, X } from 'lucide-react';

type Props = {
  url: string;
  orientation: string;
};

export function Simulator({ url, orientation }: Props) {
  const [open, setOpen] = useState(false);

  const isLandscape = orientation === 'landscape';
  const validUrl = url.startsWith('http://') || url.startsWith('https://') ? url : '';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium border border-gray-300 transition"
      >
        <Smartphone size={16} className="text-blue-500" />
        Simulator
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-gray-700 text-sm">Simulator Preview</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* phone frame */}
            <div
              className={`bg-gray-900 rounded-[2rem] p-3 shadow-xl mx-auto transition-all ${
                isLandscape ? 'w-[560px] h-[300px]' : 'w-[280px] h-[560px]'
              }`}
            >
              <div className="w-full h-full bg-white rounded-[1.5rem] overflow-hidden relative">
                {/* notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-900 rounded-b-2xl z-10" />
                {validUrl ? (
                  <iframe
                    src={validUrl}
                    title="Simulator"
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-sm p-4 text-center">
                    <Smartphone size={40} className="mb-3 text-gray-300" />
                    Enter a valid URL
                    <br />
                    (starting with https://)
                    <br />
                    to preview your app.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

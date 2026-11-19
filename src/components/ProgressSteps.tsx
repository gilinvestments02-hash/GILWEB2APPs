import { Check } from 'lucide-react';

type Props = {
  current: number; // 1 = General, 2 = App Maker, 3 = Finish
};

const steps = [
  { num: 1, label: 'General' },
  { num: 2, label: 'App Maker' },
  { num: 3, label: 'Finish' },
];

export function ProgressSteps({ current }: Props) {
  return (
    <div className="px-4 py-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between relative">
        {/* progress line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-blue-500 transition-all duration-300"
          style={{ width: `${((current - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step) => {
          const done = current > step.num;
          const active = current === step.num;
          return (
            <div key={step.num} className="flex flex-col items-center relative z-10 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition ${
                  done
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : active
                    ? 'bg-white border-blue-500 text-blue-500'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {done ? <Check size={16} /> : <span className="text-sm font-bold">{step.num}</span>}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium ${
                  active ? 'text-blue-500' : done ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

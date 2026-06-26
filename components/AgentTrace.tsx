import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentTraceProps {
  trace: string[];
  isAnalyzing: boolean;
}

export const AgentTrace: React.FC<AgentTraceProps> = ({ trace, isAnalyzing }) => {
  return (
    <div className="space-y-4 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 backdrop-blur-md">
      <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400/70 mb-4">
        Agent Intelligence Trace
      </h3>
      <div className="relative space-y-6">
        {/* Vertical Line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-emerald-500/10" />

        {trace.map((step, index) => {
          const isLast = index === trace.length - 1;
          const isCurrent = isLast && isAnalyzing;

          return (
            <div key={index} className="relative flex items-start gap-4 group">
              <div className="relative z-10 flex items-center justify-center">
                {isCurrent ? (
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                  </div>
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500/80 fill-emerald-500/10" />
                )}
              </div>
              <div className="flex flex-col">
                <span className={cn(
                  "text-sm font-medium transition-colors duration-300",
                  isCurrent ? "text-emerald-300" : "text-emerald-100/70"
                )}>
                  {step}
                </span>
                <span className="text-[10px] font-mono text-emerald-500/40 uppercase tracking-tighter">
                  Step {index + 1}
                </span>
              </div>
            </div>
          );
        })}

        {isAnalyzing && trace.length === 0 && (
          <div className="relative flex items-start gap-4">
            <div className="relative z-10 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-emerald-300">
                Initializing agent...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

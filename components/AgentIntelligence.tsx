import React from 'react';
import { BrainCircuit, PanelRightClose, Sparkles } from 'lucide-react';
import { AgentTrace } from './AgentTrace';

interface AgentIntelligenceProps {
  isOpen: boolean;
  onToggle: () => void;
  trace?: string[];
  isAnalyzing?: boolean;
}

export const AgentIntelligence: React.FC<AgentIntelligenceProps> = ({ 
  isOpen, 
  onToggle,
  trace = [],
  isAnalyzing = false
}) => {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-slate-800 dark:text-emerald-400 font-semibold">
            <BrainCircuit size={20} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Pipeline</span>
          </div>
          <button 
            onClick={onToggle} 
            className="text-slate-300 hover:text-emerald-500 transition-all p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/5"
            aria-label="Close Sidebar"
          >
            <PanelRightClose size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {(trace.length > 0 || isAnalyzing) && (
            <AgentTrace trace={trace} isAnalyzing={isAnalyzing} />
          )}
        </div>
      </div>
    </div>
  );
};

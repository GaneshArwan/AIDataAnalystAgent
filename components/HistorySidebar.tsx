import React from 'react';
import { History, MessageSquare, PanelLeftClose, MoreVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface HistoryItem {
  question: string;
  result: any;
  trace: string[];
}

interface HistorySidebarProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (question: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ history, onSelect, onDelete, isOpen, onToggle }) => {
  const [menuState, setMenuState] = useState<{ question: string; x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, question: string) => {
    e.preventDefault();
    setMenuState({ question, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 text-slate-800 dark:text-emerald-500 font-bold tracking-tight px-1">
            <History size={20} className="text-emerald-600" />
            <span className="text-lg">Library & History</span>
          </div>
          <button 
            onClick={onToggle} 
            className="text-slate-400 hover:text-emerald-500 transition-all p-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
            aria-label="Close Sidebar"
          >
            <PanelLeftClose size={20} />
          </button>
        </div>

        <div className="mb-4">
          <h3 className="micro-label mb-4 px-2">Recent Explorations</h3>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {history.length === 0 ? (
              <div className="mx-2 px-3 py-8 text-center border-2 border-dashed border-slate-200 dark:border-emerald-900/20 rounded-2xl">
                <p className="text-xs text-slate-400 italic">No history yet</p>
              </div>
            ) : (
              history.map((item, i) => (
                <div key={i} className="relative group">
                  <button
                    onClick={() => onSelect(item)}
                    onContextMenu={(e) => handleContextMenu(e, item.question)}
                    className="w-full text-left p-3 pr-10 text-sm text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-emerald-500/5 hover:shadow-sm rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-emerald-500/20 flex items-start gap-3 group/btn"
                  >
                    <MessageSquare size={14} className="mt-1 shrink-0 text-slate-300 group-hover/btn:text-emerald-500 transition-colors" />
                    <span className="truncate font-medium group-hover/btn:text-slate-900 dark:group-hover/btn:text-emerald-400 transition-colors">{item.question}</span>
                  </button>
                  
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setMenuState({ 
                          question: item.question, 
                          x: rect.right - 120, 
                          y: rect.bottom + 10 
                        });
                      }}
                      className="p-1.5 text-slate-300 hover:text-slate-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-emerald-500/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Global Context/Overflow Menu */}
        {menuState && (
          <>
            <div 
              className="fixed inset-0 z-[100]" 
              onClick={() => setMenuState(null)}
              onContextMenu={(e) => { e.preventDefault(); setMenuState(null); }}
            />
            <div 
              className="fixed z-[101] w-40 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-emerald-500/20 py-1.5 animate-in fade-in zoom-in-95 duration-200"
              style={{ top: menuState.y, left: menuState.x }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(menuState.question);
                  setMenuState(null);
                }}
                className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-3 transition-colors"
              >
                <Trash2 size={14} />
                Delete Entry
              </button>
            </div>
          </>
        )}


        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-emerald-900/20 px-2 opacity-0">
          <div className="flex gap-2 justify-end">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

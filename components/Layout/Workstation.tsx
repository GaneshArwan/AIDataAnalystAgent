import React from 'react';
import { cn } from '@/lib/utils';

interface WorkstationProps {
  leftSidebar: React.ReactNode;
  mainStage: React.ReactNode;
  rightSidebar: React.ReactNode;
  isLeftSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
}

export const Workstation: React.FC<WorkstationProps> = ({
  leftSidebar,
  mainStage,
  rightSidebar,
  isLeftSidebarOpen,
  isRightSidebarOpen,
}) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-[#020617]">
      {/* Left Sidebar: Library & History */}
      <aside
        className={cn(
          "h-full bg-white dark:bg-slate-900 transition-all duration-300 ease-in-out shrink-0",
          isLeftSidebarOpen ? "w-[280px]" : "w-0"
        )}
      >
        <div className={cn("w-[280px] h-full overflow-hidden", !isLeftSidebarOpen && "invisible")}>
          {leftSidebar}
        </div>
      </aside>

      {/* Main Stage: Query Console & Result Canvas */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {mainStage}
      </main>

      {/* Right Sidebar: Agent Intelligence */}
      <aside
        className={cn(
          "h-full bg-white dark:bg-slate-900 transition-all duration-300 ease-in-out shrink-0",
          isRightSidebarOpen ? "w-[320px]" : "w-0"
        )}
      >
        <div className={cn("w-[320px] h-full overflow-hidden", !isRightSidebarOpen && "invisible")}>
          {rightSidebar}
        </div>
      </aside>
    </div>
  );
};

import React from 'react';

interface SqlDisplayProps {
  sql: string;
}

export const SqlDisplay: React.FC<SqlDisplayProps> = ({ sql }) => {
  if (!sql) return null;

  return (
    <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-blue-300 overflow-x-auto border border-slate-700">
      <div className="flex justify-between items-center mb-2">
        <span className="text-slate-500 uppercase text-xs font-bold tracking-wider">Generated SQL</span>
      </div>
      <pre><code>{sql}</code></pre>
    </div>
  );
};

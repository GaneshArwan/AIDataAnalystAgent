import React from 'react';
import { Table as TableIcon } from 'lucide-react';

interface DataTableProps {
  data: Array<Record<string, any>>;
}

export const DataTable: React.FC<DataTableProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-[450px] w-full mt-6 bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-emerald-500/10 flex flex-col items-center justify-center text-slate-400 space-y-4 shadow-2xl relative overflow-hidden">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-200 dark:border-emerald-500/20 flex items-center justify-center bg-slate-50 dark:bg-emerald-500/5 z-10">
          <TableIcon size={32} className="text-slate-300 dark:text-emerald-500/40" />
        </div>
        <div className="text-center z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-emerald-500/60 mb-1">Data Explorer</p>
          <p className="text-sm font-bold text-slate-500">No tabular data returned for this query.</p>
        </div>
      </div>
    );
  }

  const headers = Object.keys(data[0]);

  return (
    <div className="h-[450px] overflow-auto mt-6 rounded-3xl border border-slate-200 dark:border-emerald-500/10 shadow-2xl bg-white dark:bg-[#020617] custom-scrollbar relative">
      <table className="min-w-full divide-y divide-slate-100 dark:divide-emerald-500/10 relative text-left border-collapse">
        <thead className="bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md sticky top-0 z-10 outline outline-1 outline-slate-200 dark:outline-emerald-500/10">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="px-6 py-4"
              >
                <span className="text-[10px] font-black text-slate-500 dark:text-emerald-400 uppercase tracking-[0.2em] whitespace-nowrap">{header}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-emerald-500/10">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 transition-colors group">
              {headers.map((header) => (
                <td key={header} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-emerald-300 transition-colors">
                  {typeof row[header] === 'object' ? JSON.stringify(row[header]) : String(row[header])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

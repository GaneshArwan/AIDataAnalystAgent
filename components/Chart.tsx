"use client";

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { createPortal } from 'react-dom';
import { BarChart3, Maximize2, Minimize2 } from 'lucide-react';
import { formatChartData, getChartColor } from '@/lib/chart';

interface ChartProps {
  data: any[];
  configs?: Array<{
    title?: string;
    type: 'bar' | 'line' | 'pie' | 'none';
    xAxisKey: string;
    yAxisKey: string;
    series: string[];
  }>;
}

export const Chart: React.FC<ChartProps> = ({ data, configs = [] }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const validConfigs = configs.filter(c => c && c.type !== 'none' && c.series && c.series.length > 0);
  const isEmpty = validConfigs.length === 0 || !data.length;

  const renderSingleChart = (config: any, index: number) => {
    const chartData = formatChartData(data, config);
    const commonProps = {
      margin: { top: 20, right: 20, left: 10, bottom: 10 },
    };

    const grid = (
      <CartesianGrid 
        strokeDasharray="4 4" 
        stroke="rgba(255, 255, 255, 0.05)" 
        vertical={false} 
      />
    );

    const xAxis = (
      <XAxis 
        dataKey={config.xAxisKey} 
        stroke="rgba(255, 255, 255, 0.1)" 
        tick={{ fill: 'rgba(255, 255, 255, 0.4)', fontSize: 12, fontWeight: 500 }}
        tickLine={false}
        axisLine={{ stroke: 'rgba(255, 255, 255, 0.05)' }}
        tickMargin={16}
      />
    );

    const yAxis = (
      <YAxis 
        stroke="rgba(255, 255, 255, 0.1)" 
        tick={{ fill: 'rgba(255, 255, 255, 0.4)', fontSize: 12, fontWeight: 500 }}
        tickLine={false}
        axisLine={false}
        tickMargin={16}
        tickFormatter={(value) => {
          if (typeof value === 'number') {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
          }
          return value;
        }}
      />
    );

    const tooltip = (
      <Tooltip 
        content={<CustomTooltip />} 
        cursor={{ fill: 'rgba(255, 255, 255, 0.03)', strokeWidth: 0 }} 
      />
    );

    const legend = (
      <Legend 
        wrapperStyle={{ paddingTop: '24px' }}
        formatter={(value) => (
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 ml-1">
            {value}
          </span>
        )}
      />
    );

    switch (config.type) {
      case 'bar':
        return (
          <BarChart data={chartData} {...commonProps}>
            <defs>
              {config.series.map((s: string, i: number) => (
                <linearGradient key={`bar-gradient-${index}-${i}`} id={`bar-gradient-${index}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={getChartColor(i)} stopOpacity={1} />
                  <stop offset="100%" stopColor={getChartColor(i)} stopOpacity={0.3} />
                </linearGradient>
              ))}
            </defs>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            {config.series.map((s: string, i: number) => (
              <Bar 
                key={s} 
                dataKey={s} 
                fill={`url(#bar-gradient-${index}-${i})`}
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
            ))}
          </BarChart>
        );
      case 'line':
        return (
          <AreaChart data={chartData} {...commonProps}>
            <defs>
              {config.series.map((s: string, i: number) => (
                <linearGradient key={`area-gradient-${index}-${i}`} id={`area-gradient-${index}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={getChartColor(i)} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={getChartColor(i)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            {config.series.map((s: string, i: number) => (
              <Area 
                key={s} 
                type="monotone" 
                dataKey={s} 
                stroke={getChartColor(i)} 
                fill={`url(#area-gradient-${index}-${i})`}
                fillOpacity={1}
                strokeWidth={3}
                activeDot={{ 
                  r: 6, 
                  strokeWidth: 2, 
                  stroke: '#0f172a', 
                  fill: getChartColor(i) 
                }}
              />
            ))}
          </AreaChart>
        );
      case 'pie':
        return (
          <PieChart {...commonProps}>
            <Pie
              data={chartData}
              dataKey={config.yAxisKey}
              nameKey={config.xAxisKey}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={8}
              stroke="none"
              cornerRadius={6}
            >
              {chartData.map((_: any, idx: number) => (
                <Cell key={`cell-${index}-${idx}`} fill={getChartColor(idx)} />
              ))}
            </Pie>
            {tooltip}
            {legend}
          </PieChart>
        );
      default:
        return null;
    }
  };

  const containerClasses = isFullscreen 
    ? "fixed inset-0 z-[999] bg-slate-950/95 backdrop-blur-xl p-6 md:p-12 overflow-y-auto flex flex-col"
    : "h-[450px] w-full mt-6 premium-card p-6 rounded-3xl shadow-2xl relative overflow-hidden group border border-white/5 backdrop-blur-md";

  const gridClasses = validConfigs.length > 1 
    ? (isFullscreen ? "grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1" : "flex overflow-x-auto snap-x snap-mandatory gap-6 h-full pb-4 hide-scrollbar")
    : "h-full w-full";

  const chartContent = (
    <div className={containerClasses}>
      {/* Ambient Glow Effects */}
      {!isFullscreen && (
        <>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none transform translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none transform -translate-x-1/2 translate-y-1/2" />
        </>
      )}

      {/* Fullscreen Toggle Button */}
      <div className={`absolute z-20 ${isFullscreen ? 'top-6 right-6 md:top-12 md:right-12' : 'top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity'}`}>
        <button 
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2.5 bg-slate-900/60 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 rounded-xl backdrop-blur-md border border-white/10 transition-all shadow-xl"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
      
      {!isEmpty ? (
        <div className={gridClasses}>
          {validConfigs.map((config, index) => (
            <div key={index} className={validConfigs.length > 1 && !isFullscreen ? "min-w-full h-full snap-center relative shrink-0" : "relative w-full h-full min-h-[400px]"}>
              {config.title && (
                <div className={`absolute top-0 ${isFullscreen ? 'left-4 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px]' : 'left-0 right-0 text-center text-xs'} font-black uppercase tracking-widest text-emerald-400 z-10 pointer-events-none`}>
                  {config.title}
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                {renderSingleChart(config, index) as React.ReactElement}
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 space-y-6 z-10">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-cyan-500/10 rounded-full animate-pulse duration-[3000ms]" />
            <div className="absolute inset-2 bg-gradient-to-tr from-emerald-500/10 to-cyan-500/20 rounded-full" />
            <div className="relative z-10 w-16 h-16 rounded-full border border-emerald-500/30 bg-slate-900/50 backdrop-blur-md flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)] ring-1 ring-white/5">
              <BarChart3 className="w-8 h-8 text-emerald-400/80 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            </div>
          </div>
          <div className="text-center space-y-3 px-4">
            <h3 className="text-sm font-bold tracking-widest text-slate-200 uppercase bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Visualization Unavailable</h3>
            <p className="text-sm text-slate-500 max-w-[280px] leading-relaxed font-medium mx-auto">
              The current result set doesn't contain numeric columns suitable for charting. Try querying for counts, averages, or specific metrics.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(chartContent, document.body);
  }

  return chartContent;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700/50 shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{label}</p>
        <div className="space-y-2.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-3">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ 
                    backgroundColor: entry.color, 
                    boxShadow: `0 0 10px ${entry.color}` 
                  }} 
                />
                <span className="text-sm font-medium text-slate-200">{entry.name}</span>
              </div>
              <span className="text-sm font-bold text-white tracking-wide">
                {typeof entry.value === 'number' 
                  ? new Intl.NumberFormat('en-US').format(entry.value) 
                  : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};
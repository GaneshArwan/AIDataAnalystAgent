"use client";

import ReactMarkdown from 'react-markdown';
import { useState, useEffect } from 'react';
import { HistorySidebar } from '@/components/HistorySidebar';
import { AgentIntelligence } from '@/components/AgentIntelligence';
import { Workstation } from '@/components/Layout/Workstation';
import { SqlDisplay } from '@/components/SqlDisplay';
import { DataTable } from '@/components/DataTable';
import { Chart } from '@/components/Chart';
import { Search, Loader2, BarChart3, Table as TableIcon, FileText, AlertCircle, Settings, X, Save, PanelLeftOpen, PanelRightOpen, ChevronDown, Sparkles } from 'lucide-react';

const PROVIDERS = ['Gemini', 'OpenAI', 'Anthropic', 'Local'];

export default function Home() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [trace, setTrace] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'chart' | 'summary'>('table');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  
  // Settings & Status
  const [showSettings, setShowSettings] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'missing_env' | 'disconnected'>('checking');
  
  // BYOK State
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [dbUrl, setDbUrl] = useState('');

  // Load settings and history on mount
  useEffect(() => {
    const savedProvider = localStorage.getItem('byok_provider');
    const savedApiKey = localStorage.getItem('byok_api_key');
    const savedModel = localStorage.getItem('byok_model');
    const savedBaseUrl = localStorage.getItem('byok_base_url');
    const savedDbUrl = localStorage.getItem('byok_db_url');
    const savedHistory = localStorage.getItem('exploration_history');
    
    if (savedProvider) setProvider(savedProvider);
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedModel) setModel(savedModel);
    if (savedBaseUrl) setBaseUrl(savedBaseUrl);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
    
    if (savedDbUrl) {
      setDbUrl(savedDbUrl);
      checkDbHealth(savedDbUrl);
    } else {
      setDbStatus('missing_env');
      setShowSettings(true); // Prompt user to setup DB on first load
    }
  }, []);

  const checkDbHealth = (currentDbUrl: string) => {
    if (!currentDbUrl) {
      setDbStatus('missing_env');
      return;
    }
    setDbStatus('checking');
    fetch('/api/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dbUrl: currentDbUrl }),
    })
      .then(res => res.json())
      .then(data => setDbStatus(data.status))
      .catch(() => setDbStatus('disconnected'));
  };

  const saveSettings = () => {
    localStorage.setItem('byok_provider', provider);
    localStorage.setItem('byok_api_key', apiKey);
    localStorage.setItem('byok_model', model);
    localStorage.setItem('byok_base_url', baseUrl);
    localStorage.setItem('byok_db_url', dbUrl);
    setShowSettings(false);
    checkDbHealth(dbUrl);
  };

  const deleteHistoryItem = (questionToDelete: string) => {
    const updatedHistory = history.filter(item => item.question !== questionToDelete);
    setHistory(updatedHistory);
    localStorage.setItem('exploration_history', JSON.stringify(updatedHistory));
    
    // If we're currently viewing the item we just deleted, clear the stage
    if (result && result.userQuestion === questionToDelete) {
      setResult(null);
      setTrace([]);
      setQuestion('');
    }
  };

  const handleSearch = async (queryToUse?: string, cachedItem?: any) => {
    const q = queryToUse || question;
    if (!q.trim()) return;

    // 1. If we have a cached item, load it immediately and skip API call
    if (cachedItem && cachedItem.result) {
      setResult(cachedItem.result);
      setTrace(cachedItem.trace || []);
      setQuestion(cachedItem.question);
      if (cachedItem.result.chartConfigs && cachedItem.result.chartConfigs.length > 0 && cachedItem.result.chartConfigs[0].type !== 'none') {
        setActiveTab('chart');
      } else {
        setActiveTab('table');
      }
      return;
    }

    if (!dbUrl) {
      setError("Please configure your Database URL in Settings.");
      setShowSettings(true);
      return;
    }

    if (!provider) {
      setError("Please select an AI Provider in Settings.");
      setShowSettings(true);
      return;
    }

    if (provider !== 'Local' && !apiKey) {
      setError(`Please configure your ${provider} API Key in Settings.`);
      setShowSettings(true);
      return;
    }

    if (!model) {
      setError("Please specify the Model you want to use in Settings.");
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setTrace([]);
    setResult(null);
    setError(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, dbUrl, provider, apiKey, model, baseUrl }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Always show trace, even if the agent failed
      setTrace(data.trace || []);
      
      // If the agent pipeline reached a failure state after retries
      if (data.errorMsg) {
        throw new Error(data.errorMsg);
      }

      setResult(data);
      
      // Update history with the full result object
      const newItem = { question: q, result: data, trace: data.trace || [] };
      const updatedHistory = [newItem, ...history.filter(h => h.question !== q).slice(0, 19)];
      setHistory(updatedHistory);
      localStorage.setItem('exploration_history', JSON.stringify(updatedHistory));
      
      // Auto-switch tab based on availability
      if (data.chartConfigs && data.chartConfigs.length > 0 && data.chartConfigs[0].type !== 'none') {
        setActiveTab('chart');
      } else {
        setActiveTab('table');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper for sensible default models based on provider selection
  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    setProvider(newProvider);
    // User requested no default models
    setModel('');
  };

  return (
    <Workstation
      isLeftSidebarOpen={isSidebarOpen}
      isRightSidebarOpen={isRightSidebarOpen}
      leftSidebar={
        <HistorySidebar 
          history={history} 
          onSelect={(item) => {
            handleSearch(item.question, item);
          }} 
          onDelete={deleteHistoryItem}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(false)}
        />
      }
      rightSidebar={
        <AgentIntelligence 
          isOpen={isRightSidebarOpen}
          onToggle={() => setIsRightSidebarOpen(false)}
          trace={trace}
          isAnalyzing={loading}
        />
      }
      mainStage={
        <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-50 dark:bg-[#020617] border-x border-slate-200 dark:border-emerald-500/10">
          {/* Ambient Background Glows */}
          <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-1/2 h-1/2 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
          
          {/* Digital Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

          {/* Header */}
          <header className="h-20 border-b border-slate-200/50 dark:border-emerald-500/10 flex items-center px-6 lg:px-10 justify-between shrink-0 bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl sticky top-0 z-20">
            <div className="flex items-center gap-6">
              {!isSidebarOpen && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-3 rounded-xl text-emerald-600 dark:text-emerald-400 transition-all hover:scale-105 active:scale-95 shadow-lg bg-white dark:bg-emerald-950/40 border border-slate-200 dark:border-emerald-500/20 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 outline-none"
                  aria-label="Open Sidebar"
                >
                  <PanelLeftOpen size={20} />
                </button>
              )}
              <div className="flex flex-col">
                <h1 className="text-xl font-black tracking-tighter bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent hidden sm:block uppercase">
                  Analytics Engine
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-8 text-sm font-medium">
              {/* Status Indicator */}
              <div className="hidden md:flex items-center">
                {dbStatus === 'checking' && <span className="text-slate-400 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Loader2 size={12} className="animate-spin"/> Syncing</span>}
                {dbStatus === 'connected' && (
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <div className="relative flex items-center justify-center">
                      <span className="absolute w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-20"></span>
                      <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Connected</span>
                  </div>
                )}
                {dbStatus === 'missing_env' && (
                  <span className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 cursor-pointer text-[10px] font-black uppercase tracking-widest" onClick={() => setShowSettings(true)}>
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Setup Required
                  </span>
                )}
                {dbStatus === 'disconnected' && (
                  <span className="flex items-center gap-2 text-rose-600 bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 text-[10px] font-black uppercase tracking-widest">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Offline
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <a 
                  href="https://github.com/GaneshArwan/AIDataAnalystAgent" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-3 text-slate-400 hover:text-emerald-500 transition-all outline-none"
                  aria-label="GitHub Repository"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3.5 1.5a10.8 10.8 0 0 0-6 0C7 2 6 2 6 2c-.28 1.15-.28 2.35 0 3.5-.73 1.02-1.08 2.25-1 3.5 0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                    <path d="M9 18c-4.51 2-4.5-2-7-2" />
                  </svg>
                </a>
                <button 
                  onClick={() => setShowSettings(true)}
                  className="p-3 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-all outline-none border border-transparent hover:border-emerald-500/20"
                  aria-label="Settings"
                >
                  <Settings size={20} />
                </button>
                {!isRightSidebarOpen && (
                  <button 
                    onClick={() => setIsRightSidebarOpen(true)}
                    className="p-3 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-all outline-none border border-transparent hover:border-emerald-500/20"
                    aria-label="Open Right Sidebar"
                  >
                    <PanelRightOpen size={20} />
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Floating Command Bar Area */}
          <div className="px-6 lg:px-10 pb-6 shrink-0 relative z-30 -mt-10">
            <div className="max-w-4xl mx-auto">
              <div className="relative group">
                {/* Dynamic Aura Glow */}
                <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/10 via-emerald-400/20 to-emerald-500/10 rounded-[2.5rem] blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
                
                <div className="relative flex items-center bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2rem] border border-slate-200 dark:border-emerald-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all duration-500">
                  <div className="pl-7 text-emerald-500/40">
                    <Search size={24} strokeWidth={1.5} />
                  </div>
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Ask your data anything..."
                    className="w-full pl-5 pr-40 py-7 bg-transparent focus:outline-none text-xl font-medium placeholder:text-slate-400 dark:text-slate-100 tracking-tight"
                  />
                  <div className="absolute right-3 flex items-center gap-3">
                    <button
                      onClick={() => handleSearch()}
                      disabled={loading || dbStatus !== 'connected'}
                      className="glossy-emerald text-white px-10 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] shadow-xl shadow-emerald-500/20 flex items-center gap-3 disabled:opacity-30 disabled:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                      Analyze
                    </button>
                  </div>
                  </div>

                  {/* Contextual Warning */}
                  {(!dbUrl || dbStatus !== 'connected') && !loading && (
                  <div className="mt-8 flex justify-center">
                    <div className="px-5 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                      <AlertCircle size={16} className="text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-[0.2em]">Configuration Required</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 bg-transparent relative z-10 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-10">
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-6 rounded-2xl flex items-start gap-4 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-300">
                  <div className="p-2 bg-rose-500/20 rounded-xl">
                    <AlertCircle className="shrink-0" size={24} />
                  </div>
                  <div>
                    <h3 className="font-black uppercase tracking-widest text-xs mb-1">Analysis Interrupted</h3>
                    <p className="text-sm opacity-90 font-medium">{error}</p>
                    <button 
                      onClick={() => handleSearch()}
                      className="mt-4 px-4 py-2 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-600 transition-colors"
                    >
                      Attempt Recovery
                    </button>
                  </div>
                </div>
              )}

              {!result && !loading && !error && (
                <div className="h-80 flex flex-col items-center justify-center opacity-30">
                  <BarChart3 size={32} />
                  <p className="micro-label mt-4">Awaiting Query</p>
                </div>
              )}

              {result && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  {/* SQL and Summary Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <h3 className="micro-label flex items-center gap-2">
                          <FileText size={14} />
                          Insights
                        </h3>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-950/60 p-8 rounded-2xl border border-slate-200 dark:border-emerald-500/10 text-slate-600 dark:text-slate-300 leading-relaxed shadow-xl backdrop-blur-md text-lg font-medium prose dark:prose-invert prose-sm max-w-none max-h-[400px] overflow-y-auto custom-scrollbar">
                        <ReactMarkdown>
                          {result.analysisText || "No analysis generated."}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <h3 className="micro-label flex items-center gap-2">
                          <TableIcon size={14} />
                          SQL
                        </h3>
                      </div>
                      <SqlDisplay sql={result.generatedSql} />
                    </div>
                  </div>

                  {/* Tabs for Data and Charts */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex p-1.5 bg-slate-200/50 dark:bg-emerald-950/20 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-emerald-500/10 w-fit">
                        <button
                          onClick={() => setActiveTab('table')}
                          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                            activeTab === 'table' 
                              ? 'glossy-emerald text-white' 
                              : 'text-slate-500 hover:text-slate-700 dark:text-emerald-500/50 dark:hover:text-emerald-400'
                          }`}
                        >
                          <TableIcon size={14} />
                          Data Table
                        </button>
                        <button
                          onClick={() => setActiveTab('chart')}
                          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                            activeTab === 'chart' 
                              ? 'glossy-emerald text-white' 
                              : 'text-slate-500 hover:text-slate-700 dark:text-emerald-500/50 dark:hover:text-emerald-400'
                          }`}
                        >
                          <BarChart3 size={14} />
                          Visualization
                        </button>
                      </div>
                    </div>

                    <div className="min-h-[450px] animate-in fade-in duration-700">
                      {activeTab === 'table' ? (
                        <DataTable data={result.queryResults} />
                      ) : (
                        <Chart data={result.queryResults} configs={result.chartConfigs} />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {loading && (
                <div className="space-y-10 animate-pulse">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="h-64 bg-slate-200/50 dark:bg-emerald-500/5 rounded-2xl w-full"></div>
                    <div className="h-64 bg-slate-200/50 dark:bg-emerald-500/5 rounded-2xl w-full"></div>
                  </div>
                  <div className="h-[500px] bg-slate-100/50 dark:bg-emerald-500/5 border border-slate-200/50 dark:border-emerald-500/10 rounded-2xl w-full"></div>
                </div>
              )}
            </div>
          </div>

          {/* Settings Modal */}
          {showSettings && (
            <div className="absolute inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-[#020617] rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.1)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-slate-200 dark:border-emerald-500/20">
                <div className="flex items-center justify-between p-8 border-b border-slate-100 dark:border-emerald-500/10 shrink-0">
                  <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-800 dark:text-emerald-400 flex items-center gap-3">
                    <Settings className="text-emerald-500" size={18}/>
                    Configuration
                  </h2>
                  <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-emerald-500/10 rounded-full text-slate-400 transition-colors">
                    <X size={18} />
                  </button>
                </div>
                
                <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-emerald-500/60 ml-1">AI Provider</label>
                    <div className="relative group/select">
                      <select 
                        value={provider}
                        onChange={handleProviderChange}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-emerald-500/10 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all outline-none appearance-none dark:text-emerald-50 cursor-pointer font-medium"
                      >
                        <option value="" disabled hidden className="dark:bg-slate-900 text-slate-400">Please Select</option>
                        {PROVIDERS.map(p => (
                          <option key={p} value={p} className="dark:bg-slate-900">{p}</option>
                        ))}
                      </select>
                      <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within/select:text-emerald-500 transition-colors" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-emerald-500/60 ml-1">Model Name</label>
                    <input 
                      type="text" 
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g., gemini-1.5-pro" 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-emerald-500/10 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all outline-none dark:text-emerald-50 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                    />
                  </div>

                  {provider === 'Local' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-emerald-500/60 ml-1">Local Base URL</label>
                      <input 
                        type="text" 
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/v1" 
                        className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-emerald-500/10 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all outline-none dark:text-emerald-50 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-emerald-500/60 ml-1">
                      API Key {provider === 'Local' && '(Optional)'}
                    </label>
                    <input 
                      type="password" 
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="••••••••••••••••" 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-emerald-500/10 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all outline-none dark:text-emerald-50 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-emerald-500/60 ml-1">Database Connection URL</label>
                    <input 
                      type="password" 
                      value={dbUrl}
                      onChange={(e) => setDbUrl(e.target.value)}
                      placeholder="postgresql://postgres:[password]@db.supabase.com:5432/postgres" 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-emerald-500/10 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all outline-none dark:text-emerald-50 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                    />
                  </div>
                </div>

                <div className="p-8 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-emerald-500/10 flex justify-end gap-3 shrink-0">
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-emerald-500/10 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveSettings}
                    className="px-8 py-2.5 glossy-emerald font-black text-[10px] uppercase tracking-[0.2em] rounded-xl flex items-center gap-2"
                  >
                    <Save size={16} />
                    Apply Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}

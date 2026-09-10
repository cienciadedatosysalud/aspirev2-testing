import React, { useState, useEffect } from 'react';
import {
  HiChartBar, HiTerminal, HiDownload, HiTrash,
  HiOutlineChevronRight, HiDatabase, HiCube, HiRefresh,
  HiShieldCheck, HiArrowsExpand, HiChevronDoubleLeft, HiCode, HiInformationCircle
} from 'react-icons/hi';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';

export default function ResultsViewer({ projectId, projectName, refreshSignal }) {
  const { t } = useTranslation();

  const VIEW_MODES = [
    { id: 'analysis', label: t('results.tabs.analysis'), icon: HiChartBar, color: 'text-blue-600', bg: 'bg-blue-600' },
    { id: 'dqa', label: t('results.tabs.dqa'), icon: HiShieldCheck, color: 'text-teal-600', bg: 'bg-teal-600' },
    { id: 'logs', label: t('results.tabs.logs'), icon: HiTerminal, color: 'text-slate-500', bg: 'bg-slate-500' },
    { id: 'audit', label: t('results.tabs.audit'), icon: HiCode, color: 'text-amber-600', bg: 'bg-amber-600' }
  ];

  const [activeTab, setActiveTab] = useState('analysis');
  const [projectFiles, setProjectFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [fileContent, setFileContent] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchProjectResults = async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const endpoint = activeTab === 'audit'
        ? `/api/projects/audit-scripts/${projectId}`
        : `/api/results/${projectId}`;

      const res = await fetch(endpoint);
      const data = await res.json();
      const files = activeTab === 'audit' ? data : (data.files || []);

      setProjectFiles(files);
      setActiveFile(null);
    } catch (error) {
      setProjectFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadAction = async (url, filename) => {
    setIsDownloading(true);
    const toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });

    toast.fire({
      icon: 'info',
      title: t('results.download_toast', { filename: filename || 'Bundle' })
    });

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      window.open(url, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadSingleFile = (file) => {
    const category = activeTab === 'audit' ? 'audit' : file.category;
    const url = `/api/projects/outputs/${projectId}/download/${category}/${file.name}`;
    handleDownloadAction(url, file.name);
  };

  const handleDeleteAll = async () => {
    const result = await Swal.fire({
      title: t('results.purge_swal.title'),
      text: t('results.purge_swal.text'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: t('results.purge_swal.btn_confirm'),
      customClass: { popup: 'rounded-[2.5rem]' }
    });

    if (result.isConfirmed) {
      try {
        const resFiles = await fetch(`/api/projects/outputs/${projectId}`, { method: 'DELETE' });
        //const resDb = await fetch(`/api/projects/dbinfo/${projectId}`, { method: 'DELETE' });

        if (resFiles.ok ) {
          Swal.fire({
            title: t('results.purge_swal.success_title'),
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: 'rounded-[2.5rem]' }
          });
          fetchProjectResults();
          setActiveFile(null);
          setFileContent(null);
        }
      } catch (e) {
        Swal.fire(t('common.error'), t('results.purge_swal.error_text'), 'error');
      }
    }
  };

  useEffect(() => { fetchProjectResults(); }, [projectId, refreshSignal, activeTab]);

  useEffect(() => {
    const loadContent = async () => {
      if (!activeFile || activeFile.name.endsWith('.html')) {
        setFileContent(null);
        return;
      }
      try {
        const url = activeTab === 'audit'
          ? `/api/projects/outputs/${projectId}/preview/audit/${activeFile.name}`
          : `/api/projects/outputs/${projectId}/preview/${activeFile.category}/${activeFile.name}`;

        const res = await fetch(url);
        const text = await res.text();
        setFileContent(text);
      } catch (e) {
        setFileContent(t('results.viewport.waiting'));
      }
    };
    loadContent();
  }, [activeFile, projectId, activeTab, t]);

  const filteredFiles = activeTab === 'audit' ? projectFiles : projectFiles.filter(f => f.category === activeTab);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-left">
      <header className="flex flex-col gap-6">
        <div className="flex items-center gap-3 italic font-black uppercase tracking-widest text-[#3C64A3] text-xs">
          <span>{t('results.header.step')}</span>
          <div className="h-px flex-1 bg-slate-300"></div>
        </div>
        <h2 className="text-4xl font-black text-[#1D1D1B] tracking-tighter italic uppercase">{t('results.header.title')}</h2>
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
          {/* Acento Azul para Información */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#3C64A3]" />

          <div className="flex items-start gap-6 pl-8 pr-8 py-6">
            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 text-[#3C64A3] shrink-0">
              <HiInformationCircle className="w-6 h-6" />
            </div>

            <div className="flex-1 space-y-2">
              <p className="text-slate-600 text-[15px] leading-relaxed font-medium">
               {t('results.header.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </header>
      {/* --- HEADER --- */}
      {!isExpanded && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-300/50 pb-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <HiDatabase className="text-slate-700 w-6 h-6" /> {projectName || t('results.header.vault_explorer')}
            </h2>
            <p className="text-xs font-medium text-slate-700 uppercase tracking-[0.2em] mt-1 ml-1">
              {isLoading ? t('results.header.syncing') : t('results.header.artifacts_found', { count: projectFiles.length })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* BOTÓN DE DESCARGA TODO (AZUL ASPIRE) */}
            <button
              onClick={() => handleDownloadAction(`/api/projects/outputs/${projectId}/download-all`, 'outputs.zip')}
              disabled={isDownloading}
              className="flex items-center justify-center gap-2 bg-[#3C64A3] text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#4D76B2] transition-all shadow-sm disabled:opacity-50 active:scale-95 whitespace-nowrap min-w-[200px]"
            >
              {isDownloading ? <HiRefresh className="animate-spin w-4 h-4" /> : <HiDownload className="w-4 h-4" />}
              <span>
                {isDownloading ? t('results.header.btn_processing') : t('results.header.btn_bundle')}
              </span>
            </button>

            {/* BOTÓN DE VACIAR/BORRAR (ROJO ERROR) */}
            <button
              onClick={handleDeleteAll}
              className="flex items-center justify-center gap-2 bg-[#E11D48] text-white border border-[#E11D48] px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-[0.15em] hover:bg-[#B9183A] hover:border-[#B9183A] hover:shadow-lg hover:shadow-red-200 transition-all active:scale-95 whitespace-nowrap min-w-[160px] shadow-sm group"
            >
              <HiTrash className="w-4 h-4 transition-transform group-hover:scale-110 group-hover:-rotate-12" />
              <span>{t('results.header.btn_purge')}</span>
            </button>
          </div>
        </div>
      )}

      {/* --- CATEGORY TABS --- */}
      {!isExpanded && (
        <div className="flex items-center w-full p-1.5 bg-slate-200/40 rounded-[1.25rem] overflow-x-auto custom-scrollbar-light shadow-inner border border-slate-200/50">
          <div className="flex gap-1.5 shrink-0">
            {VIEW_MODES.filter(m => m.id !== 'audit').map(mode => (
              <button
                key={mode.id}
                onClick={() => { setActiveTab(mode.id); setActiveFile(null); }}
                className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl text-[12px] font-black uppercase tracking-[0.1em] transition-all whitespace-nowrap active:scale-95 ${activeTab === mode.id
                    ? `bg-white text-[#3C64A3] shadow-[0_4px_12px_rgba(0,0,0,0.05)] ring-1 ring-slate-200`
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                  }`}
              >
                <mode.icon className={`w-4 h-4 ${activeTab === mode.id ? 'text-[#3C64A3]' : 'text-slate-400'}`} />
                {mode.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[20px]" />

          {/* SECCIÓN ESPECIAL: AUDIT (Acento Ámbar/Oro) */}
          {VIEW_MODES.filter(m => m.id === 'audit').map(mode => (
            <button
              key={mode.id}
              onClick={() => { setActiveTab(mode.id); setActiveFile(null); }}
              className={`flex items-center gap-2.5 px-8 py-3 rounded-2xl text-[12px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap active:scale-95 shadow-sm ${activeTab === mode.id
                  ? `bg-white text-amber-600 shadow-[0_4px_12px_rgba(245,199,93,0.15)] ring-2 ring-amber-100`
                  : 'bg-amber-50/50 text-amber-700 border border-amber-100 hover:bg-amber-100 hover:text-amber-800'
                }`}
            >
              <mode.icon className="w-4 h-4" /> {mode.label}
            </button>
          ))}
        </div>
      )}

      {/* --- MAIN GRID --- */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {!isExpanded && (
          <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl border border-slate-300 shadow-sm flex flex-col h-[720px] overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <span className="text-[12px] font-bold uppercase tracking-widest text-slate-700 italic">
                {activeTab === 'audit' ? t('results.sidebar.codebase_manifest') : t('results.sidebar.file_manifest')}
              </span>
              <HiRefresh onClick={fetchProjectResults} className={`text-slate-700 w-5 h-5 cursor-pointer hover:text-blue-500 ${isLoading ? 'animate-spin' : ''}`} />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar-light overscroll-contain">
              {filteredFiles.map(file => {
                const isActive = activeFile?.name === file.name;
                const fileExt = file.name.split('.').pop().toLowerCase();

                const getExtColor = (ext) => {
                  switch (ext) {
                    case 'py': return 'bg-blue-100 border-blue-200 text-blue-600';
                    case 'r': return 'bg-indigo-100 border-indigo-200 text-indigo-600';
                    case 'qmd': return 'bg-purple-100 border-purple-200 text-purple-600';
                    case 'html': return 'bg-orange-100 border-orange-200 text-orange-600';
                    case 'csv': return 'bg-emerald-100 border-emerald-200 text-emerald-600';
                    default: return 'bg-slate-100 border-slate-300 text-slate-500';
                  }
                };

                return (
                  <div
                    key={file.name}
                    onClick={() => setActiveFile(file)}
                    className={`p-5 rounded-2xl cursor-pointer transition-all flex items-center gap-4 group ${isActive ? 'bg-[#FED56D]  shadow-lg' : 'hover:bg-slate-50 text-slate-600'
                      }`}
                  >
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-[15px] font-bold truncate italic leading-tight mb-1">
                        {file.name}
                      </span>
                      <span className="text-[11px] opacity-60 font-medium uppercase tracking-tighter">
                        {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'N/A'} • {file.date || t('results.sidebar.source')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-md border uppercase tracking-tighter ${getExtColor(fileExt)}`}>
                        {fileExt}
                      </span>
                      <HiOutlineChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEWPORT */}
        <div
          className={`
            flex flex-col overflow-hidden transition-all duration-500 bg-white rounded-[2.5rem] border border-slate-300 shadow-xl
            ${isExpanded ? 'col-span-12 h-[85vh]' : 'col-span-12 lg:col-span-8 h-[720px]'}
          `}
        >
          {activeFile ? (
            <>
              <div className="px-8 py-5 border-b border-slate-300/50 flex justify-between items-center bg-white/80 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2.5 bg-slate-50 text-slate-700 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-inner border border-slate-300"
                  >
                    {isExpanded ? <HiChevronDoubleLeft className="w-5 h-5" /> : <HiArrowsExpand className="w-4 h-4" />}
                  </button>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest leading-none mb-1">
                      {activeTab === 'audit' ? t('results.viewport.inspection') : t('results.viewport.preview')}
                    </span>
                    <span className="text-slate-900 font-bold text-sm italic tracking-tight truncate max-w-[250px]">
                      {activeFile.name}
                    </span>
                  </div>
                </div>

                {activeTab !== 'audit' ? (
                  <button
                    onClick={() => downloadSingleFile(activeFile)}
                    disabled={isDownloading}
                    className="flex items-center gap-2 text-slate-700 hover:text-slate-900 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    {isDownloading ? <HiRefresh className="animate-spin w-4 h-4" /> : <HiDownload className="w-4 h-4" />}
                    {isDownloading ? t('results.viewport.preparing') : t('results.viewport.download')}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-tighter border border-amber-100 shadow-sm">
                    <HiShieldCheck className="w-3.5 h-3.5" /> {t('results.viewport.read_only')}
                  </div>
                )}
              </div>

              <div className="flex-1 p-4 md:p-6 bg-slate-50/50 relative overflow-hidden flex flex-col">
                <div className="w-full h-full bg-white rounded-2xl overflow-hidden ring-1 ring-slate-300 shadow-sm relative flex flex-col">
                  {activeFile.name.endsWith('.html') ? (
                    <iframe
                      title="Artifact Preview"
                      src={`/api/projects/outputs/${projectId}/preview/${activeTab === 'audit' ? 'audit' : activeFile.category}/${activeFile.name}`}
                      className="w-full h-full border-none"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#09090b] overflow-auto custom-scrollbar flex flex-col">
                      <div className="p-8 min-h-full font-mono text-[11px] leading-relaxed">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800/50 select-none text-zinc-500 uppercase tracking-widest text-[11px]">
                          <div className={`w-2 h-2 rounded-full ${activeTab === 'audit' ? 'bg-amber-500 animate-pulse' : 'bg-zinc-700'}`} />
                          <span>{activeTab === 'audit' ? t('results.viewport.integrity_stream') : t('results.viewport.artifact_stream')} // {activeTab}</span>
                        </div>
                        <pre className={`whitespace-pre-wrap break-words text-left ${activeTab === 'audit' ? 'text-amber-50/90' : 'text-zinc-400'}`}>
                          {fileContent || t('results.viewport.waiting')}
                        </pre>
                        <div className="h-10" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-20 text-center">
              <HiCube className="w-16 h-16 mb-4 opacity-20" />
              <h3 className="text-slate-700 font-bold text-sm uppercase tracking-[0.2em] italic">{t('results.viewport.standby_title')}</h3>
              <p className="text-xs font-medium text-slate-300 uppercase mt-2 tracking-widest">{t('results.viewport.standby_desc')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
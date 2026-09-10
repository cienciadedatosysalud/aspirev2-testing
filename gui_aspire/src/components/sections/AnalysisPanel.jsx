import React, { useState, useEffect, useRef } from 'react';
import {
  HiDatabase, HiPlay, HiTerminal, HiCheckCircle, HiCode,
  HiRefresh, HiCube, HiTrash, HiCloudDownload, HiChevronRight,
  HiInformationCircle, HiGlobeAlt, HiStop
} from 'react-icons/hi';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';

const aspire = {
  blue: '#3C64A3',
  lightBlue: '#4D76B2',
  teal: '#008C96',
  cyan: '#0BB7D6',
  yellow: '#FED56D',
  mustard: '#F5C75D',
  gold: '#EEB141',
  black: '#1D1D1B',
  gray: '#333333',
  bg: '#F8FAFC',
  errorRed: '#E11D48',
};

export default function AnalysisPanel({ projectId, projectName, refreshSignal, onExecutionFinish }) {
  const { t } = useTranslation();

  // --- DATA & SCRIPTS STATES ---
  const [dbInfo, setDbInfo] = useState([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [availableScripts, setAvailableScripts] = useState([]);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [activeScript, setActiveScript] = useState(null);

  // --- EXECUTION & LOGS STATES ---
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionDone, setExecutionDone] = useState(false);
  const [logs, setLogs] = useState([]);
  const [activePid, setActivePid] = useState(null);

  // --- UPDATE STATES ---
  const [updateInfo, setUpdateInfo] = useState(null);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  const terminalEndRef = useRef(null);

  const [versionManifest, setVersionManifest] = useState({
    aspire: '...', pipeline: '...', cdm: '...', repository: null
  });

  const [hasError, setHasError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);


  // --- 1. SYNC STATUS & RECOVERY (F5) ---
  const checkServerStatus = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/system/process/${projectId}`);
      const data = await res.json();

      if (data.isRunning) {
        setIsExecuting(true);
        setActivePid(data.pid);
        setActiveScript({ name: data.scriptName });
        localStorage.setItem(`aspire_analysis_lock_${projectId}`, 'true');

        // Evitamos duplicar logs de aviso si ya hay contenido
        if (logs.length === 0) {
          setLogs([
            t('analysis.terminal.notice'),
            t('analysis.terminal.active_script', { name: data.scriptName, pid: data.pid }),
            t('analysis.terminal.wait_notice')
          ]);
        }
      } else {
        // Si el servidor dice que no hay nada, pero estábamos en modo ejecución, limpiamos
        if (isExecuting) {
          setIsExecuting(false);
          setActivePid(null);
          setExecutionDone(true);
          localStorage.removeItem(`aspire_analysis_lock_${projectId}`);

          try {
            const logRes = await fetch(`/api/analysis/results/log/${projectId}`);
            const finalLogText = await logRes.text();

            if (finalLogText) {
              // 1. Actualizamos los logs en la pantalla
              const logLines = finalLogText.split('\n');
              setLogs(logLines);

              // 2. ANALIZAMOS EL TEXTO (Igual que hacías antes en el stream)
              // Buscamos en todo el bloque de texto si existen las frases de cierre
              if (finalLogText.includes("--- EXECUTION FINISHED: SUCCESS ---")) {
                setIsSuccess(true);
                setHasError(false);
              } else if (finalLogText.includes("--- EXECUTION FINISHED: FAILED ---")) {
                setHasError(true);
                setIsSuccess(false);
              }
            }
          } catch (logErr) {
            console.error("Error fetching final log file:", logErr);
          }

          fetchDbInfo();
          if (onExecutionFinish) onExecutionFinish();

          // 3. Lanzamos el Swal basado en los estados que acabamos de setear arriba
          // Usamos una pequeña comprobación manual aquí para el SweetAlert
          const finalError = finalLogText.includes("--- EXECUTION FINISHED: FAILED ---");

          Swal.fire({
            title: finalError ? t('analysis.execution_error.title') : t('analysis.execution_finished.title'),
            icon: finalError ? 'error' : 'success',
            confirmButtonColor: finalError ? '#E11D48' : '#3C64A3',
            customClass: { popup: 'rounded-[2rem]' }
          });
        }
      }
    } catch (e) {
      console.error("Status check failed:", e);
    }
  };

  // --- 2. POLLING LOGIC (EVERY 20 SECONDS) ---
  useEffect(() => {
    let interval;
    if (isExecuting) {
      interval = setInterval(() => {
        checkServerStatus();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isExecuting, projectId]);

  // --- AUTO SCROLL ---
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [logs]);

  // --- DATA FETCHING ---
  const fetchVersionManifest = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/analysis/version-manifest/${projectId}`);
      const data = await res.json();
      setVersionManifest(data);
      setCurrentVersion(data.pipeline);
    } catch (e) { console.error(e); }
  };

  const fetchDbInfo = async () => {
    if (!projectId) return;
    setLoadingDb(true);
    try {
      const res = await fetch(`/api/projects/dbinfo/${projectId}`);
      const data = await res.json();
      setDbInfo(data);
    } catch (error) { console.error(error); } finally { setLoadingDb(false); }
  };

  const fetchScripts = async () => {
    if (!projectId) return;
    setLoadingScripts(true);
    try {
      const res = await fetch('/api/analysis');
      const data = await res.json();
      const projectData = data.scripts.find(s => s.uuid === projectId);
      if (projectData && projectData.files) {
        setAvailableScripts(projectData.files.map((filename, index) => ({
          id: `script-${index}`, name: filename,
          lang: filename.endsWith('.qmd') ? 'Quarto' : 'Python',
          desc: `Analytic pipeline: ${filename}`
        })));
      }
    } catch (error) { console.error(error); } finally { setLoadingScripts(false); }
  };

  // --- HANDLERS ---
  const handleManualCheck = async () => {
    const result = await Swal.fire({
      title: `<span class="text-xl font-black uppercase tracking-tight">${t('analysis.pipelines.check_swal.title')}</span>`,
      html: `
        <div class="text-left space-y-4 text-slate-600 text-sm">
          <p className="text-base">${t('analysis.pipelines.check_swal.text')}</p>
          <div class="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3 italic">
            <span class="text-blue-500">🌐</span>
            <span>${t('analysis.pipelines.check_swal.info')}</span>
          </div>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: t('analysis.pipelines.check_swal.btn_connect'),
      cancelButtonText: t('data_upload.reset.cancel'),
      confirmButtonColor: '#3C64A3',
      customClass: { popup: 'rounded-[2.5rem] p-10 shadow-2xl' }
    });

    if (result.isConfirmed) {
      setIsCheckingUpdates(true);
      try {
        const res = await fetch(`/api/analysis/check-updates/${projectId}`);
        const data = await res.json();
        if (data.update_available) {
          setUpdateInfo(data);
          Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: t('analysis.pipelines.new_version_toast'),
            showConfirmButton: false, timer: 3000
          });
        } else {
          setUpdateInfo(null);
          Swal.fire({
            title: t('analysis.pipelines.up_to_date.title'),
            text: t('analysis.pipelines.up_to_date.text', { version: currentVersion }),
            icon: 'success', confirmButtonColor: '#3C64A3',
            customClass: { popup: 'rounded-[2rem]' }
          });
        }
      } catch (e) {
        Swal.fire(t('common.error'), t('analysis.pipelines.check_error'), 'error');
      } finally { setIsCheckingUpdates(false); }
    }
  };

  const handleDownloadUpdate = async () => {
    const result = await Swal.fire({
      title: `<span class="text-2xl font-black uppercase tracking-tight">${t('analysis.sync_swal.title')}</span>`,
      html: `
        <div class="text-left space-y-5 text-slate-600">
          <p class="text-lg leading-relaxed">${t('analysis.sync_swal.text')}</p>
          <div class="p-6 bg-amber-50 border border-amber-100 rounded-[1.5rem] flex gap-4 text-left">
             <span class="text-amber-600 text-3xl">⚠️</span>
             <div class="flex flex-col gap-1">
               <span class="text-base font-bold text-amber-900 underline underline-offset-4 text-lg uppercase">${t('analysis.sync_swal.warning_scope')}</span>
               <span class="text-md font-medium text-amber-800">${t('analysis.sync_swal.warning_desc')}</span>
             </div>
          </div>
          <div class="p-6 bg-blue-50 border border-blue-100 rounded-[1.5rem] text-left">
            <p class="font-bold text-blue-900 text-md mb-2 flex items-center gap-2">
              <span class="text-blue-500 text-xl">📦</span> ${t('analysis.sync_swal.dep_title')}
            </p>
            <p class="text-md leading-relaxed">${t('analysis.sync_swal.dep_desc')}</p>
          </div>
          <div class="p-6 bg-slate-100 border border-slate-300 rounded-[1.5rem] text-left">
            <p class="font-bold text-slate-800 text-[15px] mb-1 uppercase tracking-widest">${t('analysis.sync_swal.note_title')}</p>
            <p class="text-sm leading-relaxed italic text-slate-500">${t('analysis.sync_swal.note_desc')}</p>
          </div>
          <div class="flex justify-between items-center px-6 py-4 bg-slate-50 rounded-2xl border border-slate-300/50">
            <div class="flex flex-col">
              <span class="text-xs uppercase font-black text-slate-700 tracking-widest">${t('analysis.sync_swal.current_engine')}</span>
              <span class="text-xl font-mono text-blue-600 font-bold">${currentVersion || '0.0.0'}</span>
            </div>
            <div class="h-10 w-px bg-slate-300"></div>
            <div class="flex flex-col text-right">
              <span class="text-xs uppercase font-black text-slate-700 tracking-widest">${t('analysis.sync_swal.target_release')}</span>
              <span class="text-xl font-mono text-emerald-600 font-bold">${updateInfo?.version}</span>
            </div>
          </div>
        </div>
      `,
      icon: 'warning', showCancelButton: true,
      confirmButtonText: t('analysis.sync_swal.btn_allow'),
      cancelButtonText: t('data_upload.reset.cancel'), confirmButtonColor: '#3C64A3',
      width: '700px',
      customClass: {
        popup: 'rounded-[3rem] p-12 shadow-2xl',
        confirmButton: 'rounded-2xl px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] shadow-lg order-1',
        cancelButton: 'rounded-2xl px-10 py-5 text-[11px] font-black uppercase tracking-[0.2em] order-2'
      }
    });
    if (result.isConfirmed) {
      setIsUpdating(true); setExecutionDone(false);
      setLogs([t('analysis.terminal.update_start')]);
      try {
        const response = await fetch(`/api/analysis/update/${projectId}`, { method: 'POST' });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');
          lines.forEach(line => {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.replace('data: ', ''));
              setLogs(prev => [...prev, data.msg]);
              if (data.type === 'success') {
                Swal.fire({ title: t('common.updated'), icon: 'success', timer: 2000, showConfirmButton: false });
                setUpdateInfo(null); setCurrentVersion(data.version); fetchScripts();
              }
            }
          });
        }
      } catch (e) { setLogs(prev => [...prev, `[ERROR] ${e.message}`]); } finally { setIsUpdating(false); }
    }
  };

  const handleReset = () => {
    setExecutionDone(false); setLogs([]); setActiveScript(null); setActivePid(null);
    localStorage.removeItem(`aspire_analysis_lock_${projectId}`);
  };

  const handlePurgeData = async () => {
    const result = await Swal.fire({
      title: t('analysis.db_catalog.purge_confirm.title'),
      text: t('analysis.db_catalog.purge_confirm.text'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: aspire.errorRed,
      confirmButtonText: t('analysis.db_catalog.purge_confirm.btn'),
      cancelButtonColor: aspire.blue,
      cancelButtonText: t('analysis.db_catalog.purge_confirm.cancel'),
      customClass: { popup: 'rounded-[2rem]' }
    });
    if (result.isConfirmed) {
      try {
        await fetch(`/api/projects/dbinfo/${projectId}`, { method: 'DELETE' });
        fetchDbInfo();
        Swal.fire(t('analysis.db_catalog.purge_confirm.success'), t('analysis.db_catalog.purge_confirm.success_text'), 'success');
      } catch (e) { console.error(e); }
    }
  };

  const handleKillProcess = async () => {
    if (!activePid) return;
    const result = await Swal.fire({
      title: t('analysis.stop.title'),
      text: t('analysis.stop.text'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: aspire.errorRed,
      confirmButtonText: t('analysis.stop.confirm'),
      cancelButtonText: t('data_upload.reset.cancel')
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/system/process/kill/${activePid}`, { method: 'POST' });
        if (res.ok) {
          setLogs(prev => [...prev, `🛑 ${t('analysis.terminal.terminated_by_user')}`]);
          setIsExecuting(false);
          setActivePid(null);
          localStorage.removeItem(`aspire_analysis_lock_${projectId}`);
          Swal.fire(t('analysis.stop.success_title'), t('analysis.stop.success_text'), 'success');
        }
      } catch (e) {
        Swal.fire(t('common.error'), t('analysis.stop.error'), 'error');
      }
    }
  };

  const runScript = async (script) => {
    if (!projectId || !script || isExecuting) return;
    setHasError(false);
    setExecutionDone(false);
    setActiveScript(script);
    setIsExecuting(true);
    setIsSuccess(false);
    setLogs([t('analysis.terminal.launching', { name: script.name })]);
    localStorage.setItem(`aspire_analysis_lock_${projectId}`, 'true');

    try {
      const response = await fetch(`/api/analysis/${projectId}/${script.name}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialLine = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = (partialLine + chunk).split('\n');
        partialLine = lines.pop();
        for (const line of lines) {
          if (line.trim() !== "") {
            setLogs(prev => [...prev, line]);

            if (line.includes("EXECUTION FINISHED: SUCCESS")) {
              setIsSuccess(true);
            }
            if (line.includes("EXECUTION FINISHED: FAILED")) {
              setHasError(true);
            }
          }
        }
      }
    } catch (error) {
      setLogs(prev => [...prev, `[ERROR] ${error.message}`]);
    } finally {
      setIsExecuting(false);
    }
  };

  useEffect(() => {
    if (projectId) { fetchDbInfo(); fetchScripts(); fetchVersionManifest(); checkServerStatus(); }
  }, [projectId, refreshSignal]);

  return (
    <div className="animate-in fade-in duration-700 space-y-8 text-left">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3 italic font-black uppercase tracking-widest text-[#3C64A3] text-xs">
          <span>{t('analysis.header.step')}</span>
          <div className="h-px flex-1 bg-slate-300"></div>
        </div>
        <h2 className="text-4xl font-black text-[#1D1D1B] tracking-tighter italic uppercase">{t('analysis.header.title')}</h2>
      </header>

      {/* Info Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#3C64A3]" />
        <div className="flex items-start gap-6 pl-8 pr-8 py-6">
          <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 text-[#3C64A3] shrink-0">
            <HiInformationCircle className="w-6 h-6" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-slate-600 text-[15px] leading-relaxed font-medium">{t('analysis.header.description')}</p>
          </div>
        </div>
      </div>

      {/* Update Banner */}
      {updateInfo && (
        <div className="mb-8 p-1 bg-white rounded-[2rem] border border-slate-300 shadow-sm animate-in slide-in-from-top-4 fade-in duration-500">
          <div className="flex items-center justify-between pl-6 pr-2 py-2">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-lg"><HiCloudDownload /></div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full animate-pulse" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{t('analysis.update_banner.title')}</span>
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">{updateInfo.version}</span>
                </div>
                <p className="text-[12px] font-medium text-slate-500 italic mt-0.5">{t('analysis.update_banner.desc')}</p>
              </div>
            </div>
            <button onClick={handleDownloadUpdate} disabled={isUpdating} className="bg-slate-900 text-white px-8 py-3 rounded-[1.2rem] text-xs font-black uppercase hover:bg-blue-600 shadow-lg active:scale-95 disabled:opacity-50 transition-all">
              <span className="flex items-center gap-2">
                {isUpdating ? <>{t('analysis.update_banner.btn_syncing')} <HiRefresh className="animate-spin-reverse w-3 h-3" /></> : <>{t('analysis.update_banner.btn_sync')} <HiChevronRight className="w-3 h-3" /></>}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* DB Catalog */}
        <div className={`lg:col-span-4 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden transition-all duration-500 ease-in-out h-fit ${isExecuting ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
          <div className="p-8 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
            <span className="text-[15px] font-black uppercase tracking-[0.15em] text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl"><HiDatabase className="w-5 h-5 text-[#3C64A3]" /></div>
              {t('analysis.db_catalog.title')}
            </span>
            <button onClick={fetchDbInfo} className="p-2 hover:bg-slate-50 rounded-lg transition-colors group">
              <HiRefresh className={`w-5 h-5 text-slate-300 group-hover:text-[#3C64A3] ${loadingDb ? 'animate-spin-reverse' : ''}`} />
            </button>
          </div>
          <div className="overflow-y-auto p-6 space-y-3 custom-scrollbar-light bg-slate-50/30 max-h-[500px] overscroll-contain">
            {dbInfo.length > 0 ? (
              <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                {dbInfo.map(table => (
                  <div key={table.name} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-[#3C64A3]/30 transition-all group">
                    <div className="flex flex-col gap-0.5 truncate flex-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entity</span>
                      <span className="text-[13px] font-bold text-slate-700 uppercase italic truncate">{table.name}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Records</span>
                      <span className="text-[14px] font-mono font-black text-[#3C64A3] bg-[#3C64A3]/5 px-4 py-1 rounded-xl border border-[#3C64A3]/10">
                        {table.count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center opacity-40 text-slate-400">
                <HiCube className="w-16 h-16 mb-4 stroke-1" /><span className="text-xs font-black uppercase tracking-[0.2em] italic">{t('analysis.db_catalog.no_tables')}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center mb-4 animate-in fade-in zoom-in-95 duration-300">
            <button onClick={handlePurgeData} className="flex items-center justify-center gap-3 px-8 py-2.5 bg-[#E11D48] text-white border-b-2 border-[#B9183A] rounded-full text-[11px] font-black uppercase tracking-[0.15em] hover:bg-[#F43F5E] hover:-translate-y-0.5 shadow-md shadow-red-100 transition-all active:scale-95 group">
              <HiTrash className="w-3.5 h-3.5 transition-transform group-hover:rotate-12" />
              <span>{t('analysis.db_catalog.btn_purge')}</span>
            </button>
          </div>
        </div>

        {/* Pipeline List */}
        <div className="lg:col-span-8 bg-white rounded-[3rem] border border-slate-300 shadow-sm max-h-[500px] flex flex-col">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-700 italic">{t('analysis.pipelines.title')}</span>
            <div className="flex items-center gap-3">
              <button onClick={handleManualCheck} disabled={isCheckingUpdates || isUpdating || isExecuting} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-700 hover:text-blue-600 transition-all border border-slate-300 px-3 py-1.5 rounded-full hover:bg-blue-50 disabled:opacity-50">
                {isCheckingUpdates ? <HiRefresh className="animate-spin-reverse w-3 h-3" /> : <HiGlobeAlt className="w-3 h-3" />}{t('analysis.pipelines.btn_check')}
              </button>
              {currentVersion && (
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full border border-slate-300">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /><span className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">{t('analysis.pipelines.version_label')} {currentVersion}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar-light">
            {availableScripts.map(script => {
              const isActive = activeScript?.name === script.name;
              return (
                <div key={script.id} className={`p-6 rounded-[2.5rem] border border-slate-300/50 flex justify-between items-center group transition-all ${isExecuting && !isActive ? 'opacity-30 pointer-events-none' : 'bg-slate-50/30'}`}>
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${script.lang === 'Quarto' ? 'bg-[#FED56D] text-[#3C64A3]' : 'bg-[#3C64A3] text-white'}`}><HiCode /></div>
                    <div className="flex flex-col"><span className="text-sm font-bold text-slate-800 uppercase italic">{script.name}</span><span className="text-xs font-bold text-slate-700 uppercase tracking-widest">{script.lang}</span></div>
                  </div>
                  <button onClick={() => runScript(script)} disabled={isExecuting || isUpdating} className={`px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 ${isActive && isExecuting ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-900 text-white hover:bg-[#3C64A3] disabled:opacity-30'}`}>
                    {isActive && isExecuting ? 'RUNNING...' : t('analysis.pipelines.btn_launch')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Terminal Section */}
      {(isExecuting || logs.length > 0 || isUpdating) && (
        <div className={`bg-white rounded-[3.5rem] border-2 flex flex-col h-[500px] overflow-hidden transition-all duration-500 animate-in slide-in-from-bottom-8 overscroll-contain shadow-xl ${hasError ? 'border-red-500 shadow-red-100' :
          isSuccess ? 'border-emerald-500 shadow-emerald-100' :
            'border-slate-300'
          }`}>

          {/* Cabecera de la Terminal */}
          <div className={`px-10 py-5 border-b flex items-center justify-between transition-colors duration-500 ${hasError ? 'bg-red-50 border-red-200' :
            isSuccess ? 'bg-emerald-50 border-emerald-200' :
              'bg-slate-50 border-slate-300/50'
            }`}>

            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-xl ${hasError ? 'bg-red-100' : isSuccess ? 'bg-emerald-100' : 'bg-white shadow-sm'}`}>
                <HiTerminal className={`w-5 h-5 ${hasError ? 'text-red-600' :
                  isSuccess ? 'text-emerald-600' :
                    (isExecuting || isUpdating ? 'text-blue-500 animate-pulse' : 'text-slate-700')
                  }`} />
              </div>

              <div className="flex flex-col gap-0.5">
                <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${hasError ? 'text-red-500' : isSuccess ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {t('analysis.terminal.title_output')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {isExecuting && activePid && (
                <button
                  onClick={handleKillProcess}
                  className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all animate-bounce shadow-lg shadow-red-200"
                >
                  <HiStop className="w-4 h-4" /> {t('analysis.terminal.btn_stop')}
                </button>
              )}

              {!isExecuting && (
                <button
                  onClick={handleReset}
                  className={`flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isSuccess ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white' :
                    hasError ? 'bg-red-100 text-red-600 hover:bg-red-600 hover:text-white' :
                      'bg-slate-200 text-slate-600 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                  <HiTrash className="w-4 h-4" /> {t('analysis.terminal.btn_clear')}
                </button>
              )}
            </div>
          </div>

          {/* Alerta de Error Persistente */}
          {hasError && (
            <div className="bg-red-600 text-white px-10 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 animate-pulse">
              <HiInformationCircle className="w-4 h-4" />
              <span>{t('analysis.terminal.error_notice')}</span>
            </div>
          )}

          {/* Cuerpo de Logs */}
          <div className={`flex-1 overflow-y-auto p-10 custom-scrollbar-light text-left transition-colors ${hasError ? 'bg-red-50/30' :
            isSuccess ? 'bg-emerald-50/30' :
              'bg-slate-50/30'
            }`}>
            <div className="space-y-2 font-mono text-sm leading-relaxed">
              {logs.map((log, idx) => {
                const isErrorLine = log.includes("FAILED") || log.includes("ERROR");
                const isSuccessLine = log.includes("SUCCESS");
                return (
                  <div key={idx} className={`flex gap-4 animate-in slide-in-from-left-2 duration-300 ${isErrorLine ? 'text-red-600 font-bold' :
                    isSuccessLine ? 'text-emerald-600 font-bold' : ''
                    }`}>
                    <span className={`select-none w-6 shrink-0 text-right italic font-bold ${isErrorLine ? 'text-red-300' :
                      isSuccessLine ? 'text-emerald-300' :
                        'text-slate-300'
                      }`}>
                      {idx + 1}
                    </span>
                    <span className={isErrorLine ? 'text-red-700' : isSuccessLine ? 'text-emerald-700' : 'text-slate-600'}>
                      {log}
                    </span>
                  </div>
                );
              })}
            </div>
            <div ref={terminalEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
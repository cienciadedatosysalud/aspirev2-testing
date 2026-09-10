import React, { useState, useEffect } from 'react';
import { HiExternalLink, HiFolderOpen, HiChevronRight, HiChip, HiServer, HiDatabase } from 'react-icons/hi';
import { FaGithub } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

export default function Sidebar({
  steps,
  activeStepId,
  onStepClick,
  projects,
  selectedProjectId,
  onProjectChange
}) {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  // --- 1. ESTADO DE MEMORIA RAM (Mantenemos tus valores) ---
  const [systemData, setSystemData] = useState({
    percentage: 0, total_gb: 0, used_gb: 0, text: '...', status: 'loading'
  });

  // --- 2. ESTADO DE VERSIONES (Ahora dinámico) ---
  const [versionManifest, setVersionManifest] = useState({
    aspire: '...',
    pipeline: '...',
    cdm: '...',
    repository: null
  });

  // --- 3. EFECTO MONITOR DE RAM (Sin cambios, frecuencia de 1 min) ---
  useEffect(() => {
    const fetchSystemStatus = async () => {
      try {
        const response = await fetch('/api/memoryusage');
        const data = await response.json();
        setSystemData({ ...data, status: 'online' });
      } catch (error) {
        setSystemData({ percentage: 0, total_gb: 0, used_gb: 0, text: 'Offline', status: 'error' });
      }
    };
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- 4. EFECTO ACTUALIZACIÓN POR PROYECTO ---
  useEffect(() => {
    const fetchVersions = async () => {
      if (!selectedProjectId) return;
      try {
        const res = await fetch(`/api/analysis/version-manifest/${selectedProjectId}`);
        const data = await res.json();
        setVersionManifest(data);
      } catch (error) {
        console.error("Error updating sidebar versions:", error);
      }
    };
    fetchVersions();
  }, [selectedProjectId]); // Se dispara al cambiar el proyecto

  return (
    <aside className="w-[22rem] bg-slate-50 border-r border-slate-300 flex flex-col shadow-sm z-20 shrink-0 h-screen sticky top-0 overflow-hidden text-left">
      {/* SELECTOR DE IDIOMA (Banderas) */}
      <div className="p-4 pb-0">
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-300 gap-1">
          <button
            onClick={() => changeLanguage('es')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-[11px] font-black rounded-lg transition-all ${i18n.language.startsWith('es')
              ? 'bg-white text-[#3C64A3] shadow-sm ring-1 ring-slate-300'
              : 'text-slate-700 hover:bg-slate-50'
              }`}
          >
            <img
              src="/es.png"
              alt="Spain"
              className={`w-4 h-3 object-cover rounded-sm shadow-sm ${!i18n.language.startsWith('es') && 'grayscale opacity-70'}`}
            />
            <span>ES</span>
          </button>

          <button
            onClick={() => changeLanguage('en')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-[11px] font-black rounded-lg transition-all ${i18n.language.startsWith('en')
              ? 'bg-white text-[#3C64A3] shadow-sm ring-1 ring-slate-300'
              : 'text-slate-700 hover:bg-slate-50'
              }`}
          >
            <img
              src="/gb.png"
              alt="UK"
              className={`w-4 h-3 object-cover rounded-sm shadow-sm ${!i18n.language.startsWith('en') && 'grayscale opacity-70'}`}
            />
            <span>EN</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN LOGO */}
      <div className="p-6 bg-white border-b border-slate-300/50">
        {/* Cambiamos justify-between por justify-center para centrar horizontalmente */}
        <div className="flex items-center justify-center">
          {/* Contenedor de los enlaces con alineación central interna */}
          <div className="flex items-center gap-14">
            <a
              href="https://cienciadedatosysalud.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-slate-50 hover:bg-white border border-slate-300 rounded-2xl transition-all shadow-sm group flex items-center justify-center"
            >
              <img src="/logo_grupo.png" alt="Web Logo" className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" />
            </a>

            <a
              href="https://github.com/cienciadedatosysalud"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-slate-50 hover:bg-slate-900 hover:text-white border border-slate-300 rounded-2xl transition-all shadow-sm group text-slate-700 flex items-center justify-center"
            >
              <FaGithub className="w-12 h-12 group-hover:scale-110 transition-transform" />
            </a>
          </div>
        </div>
      </div>

      {/* SECTOR DE PROYECTO */}
      <div className="px-4 my-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm text-left">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 text-left">
            <HiFolderOpen className="w-4 h-4 text-[#3C64A3]" />
            {t('sidebar.active_workspace')}
          </label>
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => onProjectChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-700 text-base font-bold rounded-xl p-3 outline-none appearance-none cursor-pointer hover:border-[#3C64A3] transition-colors"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-700">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
            </div>
          </div>
        </div>
      </div>

      {/* NAVEGACIÓN */}
      <nav className="flex-1 px-4 overflow-y-auto custom-scrollbar">
        <ul className="space-y-2 py-2">
          {steps.map((step) => {
            const isActive = activeStepId === step.id;
            return (
              <li key={step.id}>
                <button
                  onClick={() => onStepClick(step.id)}
                  className={`flex items-center gap-4 w-full p-4 rounded-2xl transition-all duration-300 group ${isActive ? 'bg-white shadow-md border border-slate-300 ring-1 ring-slate-100' : 'hover:bg-white/60 border border-transparent'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${isActive
                    ? 'bg-[#3C64A3] text-white border-[#3C64A3]'
                    : 'bg-white text-slate-700 border-slate-300 group-hover:border-[#3C64A3]/30'
                    }`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className={`text-[12px] font-bold uppercase tracking-wide ${isActive ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-700'}`}>
                      {t(`steps.${step.id}.name`, { defaultValue: step.name })}                    </span>
                    {isActive && <span className="text-[11px] font-bold text-[#3C64A3] uppercase tracking-tighter">{t('sidebar.current_step')}</span>}
                  </div>
                  {isActive && <HiChevronRight className="ml-auto text-[#FED56D] w-5 h-5" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 4. FOOTER: SYSTEM STATUS & VERSIONS */}
      <div className="p-7 bg-white border-t border-slate-300 space-y-6">

        {/* Memory Monitor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-slate-700">
              <HiChip className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">{t('sidebar.memory_monitor')}</span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-900">{systemData.used_gb} / {systemData.total_gb} GB</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-300/50">
            <div
              className={`h-full transition-all duration-1000 ease-out ${systemData.percentage > 85 ? 'bg-red-500' : 'bg-[#3C64A3]'}`}
              style={{ width: `${systemData.percentage}%` }}
            ></div>
          </div>
        </div>

        {/* Versiones Desglosadas */}
        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-50 text-left">
          <VersionRow label={t('sidebar.versions.aspire')} value={versionManifest.aspire} color="text-slate-500" />
          <VersionRow label={t('sidebar.versions.pipeline')} value={versionManifest.pipeline} color="text-[#3C64A3]" />
          <VersionRow label={t('sidebar.versions.cdm')} value={versionManifest.cdm} color="text-emerald-600" />

          {/* REPOSITORIO CONDICIONAL */}
          {versionManifest.repository && (
            <div className="mt-1 pt-2 border-t border-slate-300/50 animate-in fade-in slide-in-from-bottom-2">
              <a
                href={`https://github.com/${versionManifest.repository}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between group/repo hover:bg-slate-50 p-2 rounded-xl transition-all border border-transparent hover:border-slate-300/50"
              >
                <div className="flex items-center gap-2">
                  <FaGithub className="w-3.5 h-3.5 text-slate-700 group-hover/repo:text-slate-900" />
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest group-hover/repo:text-slate-600">{t('sidebar.repository')}</span>
                </div>
                <HiExternalLink className="w-3 h-3 text-slate-300 group-hover/repo:text-[#3C64A3]" />
              </a>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function VersionRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between group/v border-b border-slate-50 pb-1 last:border-0 text-left">
      <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest text-left">{label}</span>
      <span className={`text-xs font-mono font-bold ${color} px-1.5 py-0.5 rounded-md`}>
        {value}
      </span>
    </div>
  );
}
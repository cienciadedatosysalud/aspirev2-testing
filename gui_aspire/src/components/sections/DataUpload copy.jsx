import React, { useState, useEffect, useRef } from 'react';
import {
  HiCloudUpload, HiTerminal, HiCheckCircle, HiPlay, HiDatabase,
  HiXCircle, HiExclamationCircle, HiSearchCircle, HiCube, HiRefresh,
  HiOutlineXCircle, HiTrash, HiInformationCircle
} from 'react-icons/hi';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';

// Paleta Aspire
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

export default function DataUpload({ projectId, projectName, entities = [], onUploadSuccess }) {
  const { t } = useTranslation();

  // Pasamos los pasos a una constante para mapearlos
  const VALIDATION_STEPS = t('data_upload.pipeline.steps', { returnObjects: true });

  const [files, setFiles] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [stepTimers, setStepTimers] = useState(Array(4).fill(0));
  const [isCompleted, setIsCompleted] = useState(false);
  const [validationResults, setValidationResults] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [failedSteps, setFailedSteps] = useState([]);
  const terminalEndRef = useRef(null);

  // --- LÓGICA DE DRAG & DROP ---
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isRunning) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isRunning) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const fileArray = Array.from(droppedFiles);
      const csvFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.csv'));
      if (csvFiles.length > 0) {
        setFiles(csvFiles);
      } else {
        Swal.fire(t('data_upload.dropzone.format_error_title'), t('data_upload.dropzone.format_error_text'), "error");
      }
    }
  };

  // --- PERSISTENCIA ---
  useEffect(() => {
    const saved = localStorage.getItem(`aspire_running_${projectId}`);
    if (saved === 'true') {
      setIsCompleted(true);
      fetchParsedLogs();
    }
  }, [projectId]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentStep, isCompleted, hasError]);

  useEffect(() => {
    let interval;
    if (isRunning && currentStep >= 0) {
      interval = setInterval(() => {
        setStepTimers(prev => {
          const next = [...prev];
          next[currentStep] += 1;
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, currentStep]);

  const fetchParsedLogs = async () => {
    try {
      const res = await fetch(`/api/parse-logs/${projectId}`);
      const data = await res.json();
      if (data && Array.isArray(data.info)) {
        setValidationResults(data.info);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  };

  const runFullPipeline = async () => {
    if (files.length === 0) return Swal.fire(t('data_upload.pipeline.no_files_title'), t('data_upload.pipeline.no_files_text'), "warning");

    setIsRunning(true);
    setIsCompleted(false);
    setHasError(false);
    setFailedSteps([]);
    setValidationResults([]);
    setStepTimers(Array(4).fill(0));
    localStorage.setItem(`aspire_running_${projectId}`, 'true');

    try {
      setCurrentStep(0);
      const formData = new FormData();
      files.forEach(f => formData.append("files", f, f.name));
      const resUp = await fetch(`/api/uploadfiles/${projectId}`, { method: "POST", body: formData });
      if (!resUp.ok) throw new Error();

      setCurrentStep(1);
      const resCheck = await fetch(`/api/checking/${projectId}`);
      if (!resCheck.ok) throw new Error();

      setCurrentStep(2);
      try {
        const resVal = await fetch(`/api/validator/${projectId}`);
        if (!resVal.ok) throw new Error();
      } catch (e) {
        setFailedSteps(prev => [...prev, 2]);
        setHasError(true);
        await new Promise(r => setTimeout(r, 800));
      }

      setCurrentStep(3);
      try {
        const resDQA = await fetch(`/api/dqa/${projectId}`);
        if (!resDQA.ok) throw new Error();
      } catch (e) {
        setFailedSteps(prev => [...prev, 3]);
        setHasError(true);
      }

      setIsCompleted(true);
    } catch (error) {
      setHasError(true);
      setFailedSteps(prev => [...prev, currentStep]);
      localStorage.removeItem(`aspire_running_${projectId}`);
    } finally {
      setIsRunning(false);
      await fetchParsedLogs();
      onUploadSuccess();
    }
  };

  const handleOpenDetails = (res) => {
    const catalogWithErrors = (res.catalogList || []).filter(c => c.total_wrong_lines > 0);
    const rulesWithErrors = (res.rulesList || []).filter(r => r.total_wrong_lines > 0);
    const naWithErrors = (res.naList || []).filter(n => n.na_count > 0);
    const isFatal = res.status === 'fatal';

    const castingMatch = res.reason?.match(/'(.*?)': (\d+) .* Rows: '(.*?)'.*Samples: '(.*?)'/);
    const castingData = castingMatch ? {
      col: castingMatch[1],
      total: castingMatch[2],
      line: castingMatch[3],
      val: castingMatch[4]
    } : null;

    Swal.fire({
      title: `<p className="text-base">${t('data_upload.audit.title', { entity: res.entity })}</p>`,
      html: `
    <div style="text-align:left; max-height: 580px; overflow-y:auto; padding-right: 10px; font-family: 'Inter', sans-serif; color: ${aspire.black}; scrollbar-width: thin;">
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0 25px 0;">
        <div style="background: ${aspire.bg}; padding: 12px 15px; border-radius: 12px; border: 1px solid #E2E8F0;">
          <span style="font-size: 0.65rem; font-weight: 800; color: ${aspire.blue}; text-transform: uppercase;">${t('data_upload.audit.total_regs')}</span>
          <div style="font-size: 1.4rem; font-weight: 900; color: ${aspire.black}; font-family: monospace;">${res.totalRecords?.toLocaleString()}</div>
        </div>
        <div style="background: ${isFatal ? '#FFF1F2' : '#F0FDF4'}; border: 1px solid ${isFatal ? '#FECACA' : '#DCFCE7'}; padding: 12px 15px; border-radius: 12px;">
          <span style="font-size: 0.65rem; font-weight: 800; color: ${isFatal ? aspire.errorRed : '#166534'}; text-transform: uppercase;">${t('data_upload.audit.status')}</span>
          <div style="font-size: 0.85rem; font-weight: 900; color: ${isFatal ? aspire.errorRed : '#166534'}; margin-top: 2px;">
            ${isFatal ? t('data_upload.audit.fatal') : t('data_upload.audit.verified')}
          </div>
        </div>
      </div>

      ${isFatal && castingData ? `
        <div style="margin-bottom: 30px;">
          <h4 style="font-size: 0.75rem; font-weight: 900; text-transform: uppercase; color: ${aspire.errorRed}; letter-spacing: 1px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; background: ${aspire.errorRed}; border-radius: 2px;"></span>
            ${t('data_upload.audit.critical')}
          </h4>
          <div style="border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; background: white;">
            <table style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 0.75rem;">
              <thead style="background: ${aspire.bg}; text-transform: uppercase; color: ${aspire.blue};">
                <tr>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #E2E8F0;">${t('data_upload.audit.column')}</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 1px solid #E2E8F0;">${t('data_upload.audit.csv_row')}</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 1px solid #E2E8F0;">${t('data_upload.audit.invalid_val')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 14px 12px; font-weight: 800; color: ${aspire.black};">${castingData.col}</td>
                  <td style="padding: 14px 12px; text-align: center; color: ${aspire.gray};">${castingData.line}</td>
                  <td style="padding: 14px 12px; text-align: right; color: ${aspire.errorRed}; font-weight: 900; background: #FFF1F2;">${castingData.val}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${rulesWithErrors.length > 0 ? `
        <div style="margin-bottom: 25px;">
          <h4 style="font-size: 0.75rem; font-weight: 900; text-transform: uppercase; color: ${aspire.errorRed}; letter-spacing: 1px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; background: ${aspire.errorRed}; border-radius: 2px;"></span>
            ${t('data_upload.audit.rules')} (${res.ruleFails})
          </h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${rulesWithErrors.map(r => `
              <div style="border: 1px solid #E2E8F0; border-radius: 12px; padding: 15px; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <code style="font-size: 0.75rem; font-weight: 800; color: ${aspire.blue}; background: ${aspire.bg}; padding: 4px 8px; border-radius: 6px; border: 1px solid #E2E8F0;">
                    ${r.expression}
                  </code>
                  <div style="text-align: right;">
                    <span style="font-size: 1rem; font-weight: 900; color: ${aspire.errorRed};">${r.total_wrong_lines.toLocaleString()}</span>
                    <span style="font-size: 0.6rem; font-weight: 800; color: #94A3B8; text-transform: uppercase; display: block;">${t('data_upload.audit.failed')}</span>
                  </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                  ${r.wrong_lines.slice(0, 30).map(line => `
                    <span style="font-family: monospace; font-size: 9px; background: #FFF1F2; color: ${aspire.errorRed}; padding: 2px 4px; border-radius: 4px; border: 1px solid #FECACA; font-weight: 700;">
                      ${line}
                    </span>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${catalogWithErrors.length > 0 ? `
        <div style="margin-bottom: 25px;">
          <h4 style="font-size: 0.75rem; font-weight: 900; text-transform: uppercase; color: ${aspire.errorRed}; letter-spacing: 1px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; background: ${aspire.errorRed}; border-radius: 2px;"></span>
            ${t('data_upload.audit.catalog')} (${res.catalogFails})
          </h4>
          <div style="border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; background: white;">
            <table style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 0.75rem;">
              <thead style="background: ${aspire.bg}; text-transform: uppercase; color: ${aspire.blue};">
                <tr>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #E2E8F0;">${t('data_upload.audit.variable')}</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 1px solid #E2E8F0;">${t('data_upload.audit.csv_row')}(s)</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 1px solid #E2E8F0;">${t('data_upload.audit.found_vals')}(s)</th>
                </tr>
              </thead>
              <tbody>
                ${catalogWithErrors.map(c => `
                  <tr>
                    <td style="padding: 14px 12px; font-weight: 800; color: ${aspire.black}; border-bottom: 1px solid #F1F5F9;">${c.variable}</td>
                    <td style="padding: 14px 12px; text-align: center; color: ${aspire.gray}; border-bottom: 1px solid #F1F5F9;">
                        ${c.wrong_lines.slice(0, 5).join(', ')}${c.wrong_lines.length > 5 ? '...' : ''}
                    </td>
                    <td style="padding: 14px 12px; text-align: right; color: ${aspire.errorRed}; font-weight: 900; background: #FFF1F2; border-bottom: 1px solid #F1F5F9;">
                        ${c.wrong_values.slice(0, 3).join(', ')}${c.wrong_values.length > 3 ? '...' : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${naWithErrors.length > 0 ? `
        <div style="margin-bottom: 10px;">
          <h4 style="font-size: 0.75rem; font-weight: 900; text-transform: uppercase; color: ${aspire.blue}; letter-spacing: 1px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; background: ${aspire.blue}; border-radius: 2px;"></span>
            ${t('data_upload.audit.nulls')}
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px;">
            ${naWithErrors.map(n => `
              <div style="background: white; padding: 8px 12px; border-radius: 10px; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.7rem; font-weight: 700; color: ${aspire.gray};">${n.label}</span>
                <span style="font-size: 0.75rem; font-weight: 900; color: ${aspire.blue}; font-family: monospace;">${n.na_count.toLocaleString()}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

    </div>
    `,
      width: '750px',
      confirmButtonColor: aspire.black,
      confirmButtonText: `<span style="text-transform: uppercase; font-weight: 900; letter-spacing: 1px; font-size: 0.75rem;">${t('data_upload.audit.close')}</span>`,
      customClass: {
        popup: 'rounded-[2rem] p-8',
        confirmButton: 'rounded-xl px-12 py-3 shadow-lg'
      }
    });
  };

  const handleReset = () => {
    Swal.fire({
      title: t('data_upload.reset.title'),
      text: t('data_upload.reset.text'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: aspire.errorRed,
      confirmButtonText: t('data_upload.reset.confirm'),
      cancelButtonColor: aspire.blue,
      cancelButtonText: t('data_upload.reset.cancel'),
      customClass: { popup: 'rounded-[2rem]' }
    }).then((result) => {
      if (result.isConfirmed) {
        setIsCompleted(false);
        setHasError(false);
        setValidationResults([]);
        setCurrentStep(-1);
        setStepTimers(Array(4).fill(0));
        setFiles([]);
        localStorage.removeItem(`aspire_running_${projectId}`);
      }
    });
  };

  const viewRawLog = async (processName) => {
    const logFiles = {
      "upload": "mapping_input_files.log",
      "syntax": "checking_data_syntax.log",
      "rules": "checking_data_compliance.log",
      "dqa": "data_quality_assesment.log"
    };

    try {
      const res = await fetch(`/api/get-raw-log/${projectId}?file=${logFiles[processName]}`);
      const text = await res.text();

      const pre = document.createElement('pre');
      pre.style.textAlign = 'left';
      pre.style.background = '#1D1D1B';
      pre.style.color = 'white';
      pre.style.padding = '20px';
      pre.style.borderRadius = '15px';
      pre.style.fontSize = '11px';
      pre.style.maxHeight = '500px';
      pre.style.overflowY = 'auto';
      pre.style.fontFamily = 'monospace';
      pre.style.lineHeight = '1.5';
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.wordBreak = 'break-all';

      pre.textContent = text || t('data_upload.logs.no_logs');

      Swal.fire({
        title: `<div style="text-align:left; font-family: monospace; font-size: 14px; color: ${aspire.blue}">/logs/${logFiles[processName]}</div>`,
        html: pre,
        width: '900px',
        confirmButtonColor: aspire.black,
        confirmButtonText: t('data_upload.logs.close'),
        customClass: { popup: 'rounded-[2rem]' }
      });
    } catch (err) {
      Swal.fire(t('data_upload.logs.error_title'), t('data_upload.logs.error'), "error");
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 text-left">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3 italic font-black uppercase tracking-widest text-[#3C64A3] text-xs">
          <span>{t('data_upload.title_section')}</span>
          <div className="h-px flex-1 bg-slate-300"></div>
        </div>
        <h2 className="text-4xl font-black text-[#1D1D1B] tracking-tighter italic uppercase">{t('data_upload.title')}</h2>
      </header>

      <div className="flex flex-col gap-6 lg:col-span-4 max-w-6xl">

        {/* BLOQUE 1: INFO (Instrucciones Generales) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
          {/* Acento Azul para Información */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#3C64A3]" />

          <div className="flex items-start gap-6 pl-8 pr-8 py-6">
            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 text-[#3C64A3] shrink-0">
              <HiInformationCircle className="w-6 h-6" />
            </div>

            <div className="flex-1 space-y-2">
              <h2 className="text-slate-950 font-black text-sm uppercase tracking-widest">
                {t('data_upload.title_section')}
              </h2>
              <p className="text-slate-600 text-[15px] leading-relaxed font-medium">
                {t('data_upload.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* BLOQUE 2: WARNING (Protocolo de Borrado y Carga) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100/50 flex flex-col overflow-hidden relative animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Acento Ámbar para Advertencia de Borrado */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-400" />

          <div className="flex items-start gap-6 pl-8 pr-8 py-8">
            {/* Icono de Alerta */}
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 text-amber-600 shrink-0">
              <HiExclamationCircle className="w-7 h-7" />
            </div>

            <div className="flex-1 space-y-5">
              <span className="text-slate-900 font-black uppercase text-[10px] tracking-[0.25em] block opacity-50">
                {t('data_upload.protocol_label')}
              </span>

              {/* Texto de Borrado (Resaltado) */}
              <p className="text-slate-800 text-[15px] leading-[1.6] font-semibold text-justify">
                {t('data_upload.rule_cleanup')}
              </p>

              <div className="h-px bg-slate-100 w-full" />

              {/* Consejo Técnico */}
              <p className="text-slate-600 text-[14px] leading-[1.6] font-medium italic">
                <span className="text-emerald-700 font-bold not-italic">
                  {t('data_upload.advice_label')}
                </span>{' '}
                {t('data_upload.rule_segments')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[3rem] p-12 shadow-xl border border-slate-300/50 flex flex-col relative overflow-hidden group min-h-[450px]">
          <HiCube className="absolute -right-4 -top-4 w-40 h-40 opacity-5 text-[#3C64A3] group-hover:scale-110 transition-transform duration-700" />
          <label className="text-[11px] font-black uppercase tracking-[0.2em] text-[#3C64A3] mb-8 flex items-center gap-2">
            <HiDatabase className="w-5 h-5" /> {t('data_upload.context.title')}
          </label>
          <div className="mb-10">
            <h3 className="text-4xl font-black italic text-slate-800 uppercase tracking-tighter leading-tight">
              {projectName || t('data_upload.context.no_project')}
            </h3>
          </div>
          <div className="mt-auto pt-8 border-t border-slate-200/60 space-y-5">
            {/* Título de sección más sutil y elegante */}
            <div className="flex items-center gap-3">
              <div className="w-1 h-4 bg-[#3C64A3]/40 rounded-full" />
              <span className="text-[13px] font-black uppercase text-slate-400 tracking-[0.2em]">
                {t('data_upload.context.required_tables')}
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {entities.map(ent => (
                <div
                  key={ent}
                  className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 text-slate-600 rounded-lg border border-slate-200/50 transition-colors"
                >
                  {/* El "Bullet" visual que indica que es un elemento de lista */}
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3C64A3]/30" />

                  <span className="text-[12px] font-mono font-bold uppercase tracking-wider">
                    {ent}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`bg-white rounded-[3rem] p-10 shadow-xl border border-slate-300/50 transition-all ${isRunning ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
          <label className="text-xs font-black uppercase tracking-widest text-[#3C64A3] mb-6 flex items-center gap-2"><HiCloudUpload /> {t('data_upload.dropzone.title')}</label>
          <p className='mb-4'>{t('data_upload.subtitle_files')}</p>
          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-4 border-dashed rounded-[2.5rem] min-h-[280px] flex flex-col items-center justify-center cursor-pointer transition-all text-center px-4 group
              ${isDragging ? 'border-[#3C64A3] bg-[#3C64A3]/5 scale-[1.02]' : 'border-slate-300/50 hover:bg-slate-50'}`}
          >
            <HiCloudUpload className={`w-12 h-12 mb-2 transition-colors ${isDragging ? 'text-[#3C64A3]' : 'text-slate-300 group-hover:text-[#3C64A3]'}`} />
            <input type="file" multiple accept=".csv" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files))} />
            <span className={`text-[15px] font-bold italic transition-colors ${isDragging ? 'text-[#3C64A3]' : 'text-slate-500'}`}>
              {isDragging ? t('data_upload.dropzone.dragging') : t('data_upload.dropzone.idle')}
            </span>
          </label>
          {files.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-xs font-mono font-black text-[#3C64A3] bg-[#3C64A3]/5 p-3 rounded-2xl animate-in zoom-in-95">
              <div className="flex items-center gap-2"><HiCheckCircle /> {files.length} {t('data_upload.dropzone.ready')}</div>
              <button onClick={() => setFiles([])} className="text-red-500 hover:scale-110"><HiOutlineXCircle className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 mt-4 pb-4">
        {/* BOTÓN PRINCIPAL: EJECUTAR (Ahora estilizado) */}
        <button
          onClick={runFullPipeline}
          disabled={isRunning || files.length === 0}
          className={`group relative flex items-center justify-center gap-4 px-10 py-3.5 rounded-full font-black uppercase tracking-[0.2em] text-[13px] transition-all transform active:scale-95 shadow-lg border-b-2
      ${hasError
              ? 'bg-[#E11D48] text-white border-[#B9183A] shadow-red-200'
              : isRunning
                ? 'bg-[#FED56D] text-[#3C64A3] border-[#E5C062] animate-pulse cursor-wait'
                : 'bg-[#3C64A3] text-white border-[#2A4A7A] hover:bg-[#4571B8] hover:-translate-y-0.5 shadow-blue-100'
            } disabled:opacity-30 disabled:grayscale disabled:translate-y-0`}
        >
          {hasError ? (
            <>
              <span>{t('data_upload.pipeline.btn_failed')}</span>
              <HiXCircle className="w-5 h-5 text-white" />
            </>
          ) : isRunning ? (
            <>
              <span>{t('data_upload.pipeline.btn_running')}</span>
              <HiRefresh className="w-5 h-5 animate-spin text-[#3C64A3]" />
            </>
          ) : (
            <>
              <span>{t('data_upload.pipeline.btn_execute')}</span>
              <div className="bg-white/20 p-1 rounded-full group-hover:bg-[#FED56D] transition-colors">
                <HiPlay className="text-white group-hover:text-[#3C64A3] w-3.5 h-3.5" />
              </div>
            </>
          )}
        </button>

        {/* BOTÓN RESET: Sólido pero contenido y elegante */}
        {(isCompleted || hasError || validationResults.length > 0) && !isRunning && (
          <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
            <div className="h-px w-12 bg-slate-200" /> {/* Separador minimalista */}

            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-3 px-8 py-2.5 
                   bg-[#E11D48] text-white border-b-2 border-[#B9183A] rounded-full 
                   text-[11px] font-black uppercase tracking-[0.15em] 
                   hover:bg-[#F43F5E] hover:-translate-y-0.5 
                   shadow-md shadow-red-100 transition-all active:scale-95 group"
            >
              <HiTrash className="w-3.5 h-3.5 transition-transform group-hover:rotate-12" />
              <span>{t('data_upload.pipeline.btn_reset')}</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[3.0rem] border border-slate-300 shadow-xl flex flex-col h-[650px] overflow-hidden">
        <div className="px-10 py-5 bg-slate-50 border-b border-slate-300/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HiTerminal className={`w-5 h-5 ${isRunning ? 'text-blue-500 animate-pulse' : hasError ? 'text-red-500' : 'text-slate-700'}`} />
            <span className="text-slate-700 text-xs font-bold uppercase tracking-[0.3em]">{t('data_upload.terminal.title')}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 bg-slate-50/30 font-mono text-[15px] leading-relaxed custom-scrollbar-light relative text-left">
          <div className="space-y-4">
            {VALIDATION_STEPS.map((step, idx) => {
              const isPast = currentStep > idx || isCompleted;
              const isCurrent = currentStep === idx;
              const stepFailed = failedSteps.includes(idx);

              if (!isPast && !isCurrent && !stepFailed) return null;

              return (
                <div key={idx} className="flex gap-4 animate-in slide-in-from-left-2 duration-300">
                  <span className="text-slate-300 w-4 shrink-0 text-right italic font-bold">{idx + 1}</span>
                  <div className="flex-1 flex items-center gap-3">
                    {stepFailed ? (
                      <HiXCircle className="text-red-500 w-5 h-5 animate-in zoom-in" />
                    ) : isPast ? (
                      <HiCheckCircle className="text-emerald-500 w-5 h-5" />
                    ) : (
                      <HiRefresh className={`text-blue-500 w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
                    )}

                    <span className={`
          ${stepFailed ? 'text-red-600 font-black italic' :
                        isPast ? 'text-slate-700 font-medium' :
                          'text-slate-700 font-bold italic'}
        `}>
                      {step}{stepFailed ? ` - ${t('data_upload.terminal.failed')}` : isPast ? '' : '...'}
                    </span>

                    <span className={`ml-auto text-base font-bold px-3 py-1 rounded-full 
          ${stepFailed ? 'bg-red-50 text-red-600' :
                        isPast ? 'bg-slate-100 text-slate-700' :
                          'bg-blue-50 text-blue-600'}`}
                    >
                      {stepTimers[idx]}s
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {isCompleted && !hasError && (
            <div className="mt-8 p-6 bg-white border border-slate-300 rounded-2xl shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-700">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-slate-900 font-bold text-base uppercase tracking-[0.15em]">
                    {t('data_upload.pipeline.success_msg')}
                  </span>
                </div>
                <div className="pl-4 border-l border-slate-300/50">
                  <p className="text-slate-600 text-base leading-relaxed text-justify">
                    {t('data_upload.pipeline.human_notice')}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                    {t('data_upload.pipeline.action_check')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {hasError && (
            <div className="mt-8 p-5 bg-red-50 border border-red-100 rounded-2xl animate-in shake duration-500">
              <span className="text-red-700 font-bold text-[14px] uppercase tracking-tight flex items-center gap-2">
                <HiXCircle className="w-5 h-5" /> {t('data_upload.pipeline.halted_msg')}
              </span>
            </div>
          )}

          <div ref={terminalEndRef}></div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4 mt-6">
        {["upload", "syntax", "rules", "dqa"].map((proc) => (
          <button
            key={proc}
            onClick={() => viewRawLog(proc)} // Mantiene la mayúscula para la función
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:border-[#3C64A3] hover:text-[#3C64A3] hover:shadow-lg transition-all active:scale-95 shadow-sm"
          >
            <HiSearchCircle className="w-4 h-4" />
            {/* Construimos la llave dinámicamente: inspect_upload, inspect_syntax, etc. */}
            {t(`data_upload.logs.inspect_${proc}`)}
          </button>
        ))}
      </div>

      {(isCompleted || hasError || validationResults.length > 0) && (
        <div className="mt-12 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Cabecera de sección minimalista */}
          <div className="flex items-center gap-3 px-4 mb-6">
            <div className="w-1.5 h-6 bg-[#3C64A3] rounded-full" />
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
              {t('data_upload.audit.results_title')}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {validationResults.map((res) => {
              const isFatal = res.status === 'fatal';
              const isMissing = res.status === 'missing';
              const hasIssues = (res.ruleFails > 0 || res.catalogFails > 0 || res.naCount > 0);

              return (
                <details key={res.entity} className="group bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-[#3C64A3]/30 transition-all overflow-hidden">
                  {/* RESUMEN DE FILA (Siempre visible) */}
                  <summary className="flex items-center justify-between p-5 cursor-pointer list-none select-none">
                    <div className="flex items-center gap-6 flex-1">
                      {/* Estado Visual Rápido */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isFatal ? 'bg-red-50 text-[#E11D48]' :
                        isMissing ? 'bg-slate-100 text-slate-400' :
                          hasIssues ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'
                        }`}>
                        {isFatal ? <HiXCircle className="w-6 h-6" /> :
                          isMissing ? <HiCube className="w-6 h-6" /> :
                            hasIssues ? <HiExclamationCircle className="w-6 h-6" /> : <HiCheckCircle className="w-6 h-6" />}
                      </div>

                      {/* Info Principal */}
                      <div className="flex flex-col">
                        <span className="text-[15px] font-black uppercase text-slate-800 tracking-tight italic">
                          {res.entity}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                          {res.totalRecords?.toLocaleString()} {t('data_upload.audit.records')}
                        </span>
                      </div>

                      {/* Mini Badges de Errores */}
                      <div className="hidden md:flex gap-3 ml-4">
                        {res.ruleFails > 0 && <span className="px-2 py-0.5 rounded-md bg-red-50 text-[#E11D48] text-[10px] font-black border border-red-100 italic">RULE: {res.ruleFails}</span>}
                        {res.catalogFails > 0 && <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-black border border-amber-100 italic">MAP: {res.catalogFails}</span>}
                        {res.naCount > 0 && <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#3C64A3] text-[10px] font-black border border-blue-100 italic">NULL: {res.naCount}</span>}
                      </div>
                    </div>

                    {/* SECCIÓN DE INTERACCIÓN (CORREGIDA) */}
                    <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-transparent group-hover:border-slate-200 transition-all">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                        {isFatal ? t('data_upload.audit.view_fatal') : t('data_upload.audit.details_label')}
                      </span>
                      <HiRefresh className="w-4 h-4 text-[#3C64A3] transition-transform duration-500 group-open:rotate-180" />
                    </div>
                  </summary>

                  {/* CONTENIDO DESPLEGABLE */}
                  <div className="px-20 pb-8 pt-2 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-slate-100 pt-6">

                      {/* Aviso Fatal / Incumplimiento */}
                      {isFatal && (
                        <div className="lg:col-span-2 p-4 bg-[#E11D48] rounded-2xl text-white shadow-lg flex items-center gap-4">
                          <HiOutlineXCircle className="w-10 h-10 opacity-50" />
                          <p className="text-[13px] font-bold leading-snug">
                            {t('data_upload.audit.fatal_notice')}
                          </p>
                        </div>
                      )}

                      {/* Métricas internas */}
                      <div className="space-y-4">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          {t('data_upload.audit.summary_title')}
                        </h4>
                        <MetricBar label={t('data_upload.audit.rules')} value={res.ruleFails} color="bg-red-500" />
                        <MetricBar label={t('data_upload.audit.catalog')} value={res.catalogFails} color="bg-amber-500" />
                        <MetricBar label={t('data_upload.audit.nulls')} value={res.naCount} color="bg-blue-400" />
                      </div>

                      {/* Nota sobre Logs */}
                      <div className="bg-slate-50 rounded-2xl p-6 flex flex-col justify-center border border-slate-100">
                        <p className="text-[15px] text-slate-700 font-medium italic leading-relaxed">
                          {t('data_upload.audit.log_notice')}
                        </p>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


function MetricBar({ label, value, color }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-[11px] font-bold text-slate-600 w-32 truncate uppercase">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} ${value > 0 ? 'opacity-100' : 'opacity-10'}`} style={{ width: value > 0 ? '100%' : '0%' }} />
      </div>
      <span className={`text-[12px] font-mono font-black ${value > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{value}</span>
    </div>
  );
}
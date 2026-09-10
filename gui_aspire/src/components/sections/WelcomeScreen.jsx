import React, { useState } from 'react';
import { HiPlay, HiDocumentReport, HiDatabase, HiArrowDown, HiRefresh } from 'react-icons/hi';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';

export default function WelcomeScreen({ project, selectedProjectId }) {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!selectedProjectId) return;

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
      title: t('welcome.download.toast_title')
    });

    try {
      window.location.href = `/api/datamodel/${selectedProjectId}`;
      setTimeout(() => setIsDownloading(false), 2000);
    } catch (error) {
      setIsDownloading(false);
      Swal.fire(
        t('welcome.download.error_title'), 
        t('welcome.download.error_text'), 
        'error'
      );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] text-[#1D1D1B] px-4">
      {/* 1. TÍTULO ASPIRE */}
      <div className="text-center mb-10">
        <h1 className="text-6xl font-black tracking-tighter text-[#3C64A3] mb-2 italic">
          ASPIRE
        </h1>
        <p className="text-[#333333]/60 text-[15px] font-bold uppercase tracking-[0.3em] max-w-2xl mx-auto leading-relaxed">
          {t('welcome.subtitle')} <br />
          <span className="text-[#008C96]">{t('welcome.reproducible')}</span>
        </p>
      </div>

      {/* 2. LOGO DEL PROYECTO */}
      <div className="w-full max-w-2xl mb-6">
        <div className="aspect-video rounded-[2.5rem] bg-white border border-slate-300 shadow-xl flex items-center justify-center overflow-hidden p-6">
          <img
            src="/main_logo.png"
            alt="Project Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="mt-4 text-center">
          <p className="text-3xl font-bold text-[#333333] tracking-tight">
            {t('welcome.project_label')} <span className="text-[#3C64A3]">{project}</span>
          </p>
        </div>
      </div>

      {/* 4. TARJETAS DE PASOS */}
      <div className="grid grid-cols-3 gap-6 max-w-5xl mx-auto">
        <StepCard
          icon={HiDatabase}
          title={t('welcome.steps.step1.title')}
          desc={t('welcome.steps.step1.desc')}
          color="text-[#3C64A3]"
          bgColor="bg-[#3C64A3]/10"
        />
        <StepCard
          icon={HiPlay}
          title={t('welcome.steps.step2.title')}
          desc={t('welcome.steps.step2.desc')}
          color="text-[#008C96]"
          bgColor="bg-[#008C96]/10"
        />
        <StepCard
          icon={HiDocumentReport}
          title={t('welcome.steps.step3.title')}
          desc={t('welcome.steps.step3.desc')}
          color="text-[#EEB141]"
          bgColor="bg-[#FED56D]/20"
        />
      </div>

      {/* 5. BOTÓN CTA */}
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className={`mt-10 flex items-center gap-3 px-10 py-4 rounded-xl font-black uppercase tracking-widest text-base transition-all shadow-lg active:scale-95 ${
          isDownloading ? 'bg-slate-400 cursor-wait' : 'bg-[#3C64A3] hover:bg-[#008C96] text-white'
        }`}
      >
        {isDownloading ? (
          <>
            {t('welcome.download.processing')} <HiRefresh className="w-4 h-4 animate-spin" />
          </>
        ) : (
          <>
            {t('welcome.download.button')} <HiArrowDown className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
}

function StepCard({ icon: Icon, title, desc, color, bgColor }) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-300/50 shadow-md flex flex-col items-start hover:border-slate-300 transition-all text-left">
      <div className={`w-10 h-10 ${bgColor} ${color} rounded-xl flex items-center justify-center mb-4`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-lg font-black text-[#3C64A3] mb-2">{title}</h3>
      <p className="text-[#333333]/70 text-base leading-snug font-medium italic">
        {desc}
      </p>
    </div>
  );
}
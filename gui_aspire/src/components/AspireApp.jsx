import React, { useState, useEffect, useRef } from 'react';
import {
  HiCog,
  HiDatabase,
  HiPlay,
  HiDocumentReport
} from 'react-icons/hi';

// Componentes
import Sidebar from './Sidebar';
import WelcomeScreen from './sections/WelcomeScreen';
import DataUpload from './sections/DataUpload';
import AnalysisPanel from './sections/AnalysisPanel';
import ResultsViewer from './sections/ResultsViewer';
// i18n
import { useTranslation } from 'react-i18next';
import '../i18n';

// Definimos los pasos. Nota: Las propiedades 'name' y 'desc' aquí 
// sirven como fallback, pero se traducirán dinámicamente en el render.
const PIPELINE_STEPS = [
  { id: 'welcome', name: 'Home', icon: HiCog, desc: 'Project Introduction' },
  { id: 'data', name: 'Map your data', icon: HiDatabase, desc: 'Step 1: Map Data' },
  { id: 'analysis', name: 'Run analysis', icon: HiPlay, desc: 'Step 2: Run Analysis' },
  { id: 'results', name: 'Outputs', icon: HiDocumentReport, desc: 'Step 3: Retrieve Results' },
];

export default function AspireApp() {
  const { t } = useTranslation();
  const [activeStepId, setActiveStepId] = useState('welcome');

  // ESTADOS DE LA API
  const [projects, setProjects] = useState([]); // Lista completa de la API
  const [selectedProjectId, setSelectedProjectId] = useState(''); // El ID seleccionado
  const [loading, setLoading] = useState(true);
  const [dbRefreshSignal, setDbRefreshSignal] = useState(0);
  const [resultsRefreshSignal, setResultsRefreshSignal] = useState(0);

  const triggerDbRefresh = () => setDbRefreshSignal(prev => prev + 1);
  const triggerResultsRefresh = () => setResultsRefreshSignal(prev => prev + 1);
  const scrollContainerRef = useRef(null);

  // 1. CARGA INICIAL DE PROYECTOS
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        setProjects(data);
        if (data.length > 0) {
          setSelectedProjectId(data[0].id);
        }
      } catch (error) {
        console.error("Error cargando proyectos:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // Buscamos el objeto completo del proyecto seleccionado
  const currentProject = projects.find(p => p.id === selectedProjectId);

  // 2. LÓGICA DE SCROLL
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-40% 0px -40% 0px',
      threshold: 0,
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveStepId(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    PIPELINE_STEPS.forEach((step) => {
      const element = document.getElementById(step.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [loading]);

  // Mapeamos los pasos para que los nombres e iconos fluyan traducidos al Sidebar
  const translatedSteps = PIPELINE_STEPS.map(step => ({
    ...step,
    name: t(`steps.${step.id}.name`, { defaultValue: step.name }),
    desc: t(`steps.${step.id}.desc`, { defaultValue: step.desc })
  }));

  if (loading) return (
    <div className="h-screen bg-[#F8FAFC] flex items-center justify-center font-black text-slate-700 tracking-[0.5em] animate-pulse">
      {t('app.loading')}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#1D1D1B] font-sans overflow-hidden">

      <Sidebar
        steps={translatedSteps}
        activeStepId={activeStepId}
        onStepClick={scrollToSection}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
      />

      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar bg-slate-50/30"
      >
        <div className="max-w-7xl mx-auto px-12 pb-32">

          {/* SECCIÓN 0: BIENVENIDA / INFO DEL PROYECTO */}
          <section id="welcome" className="min-h-screen py-20 flex flex-col justify-center border-b border-slate-300/60">
            <WelcomeScreen
              project={currentProject?.name}
              selectedProjectId={selectedProjectId}
            />
          </section>

          {/* SECCIÓN 1: DATA INGESTION */}
          <section id="data" className="min-h-screen py-24 border-b border-slate-300/60">
            <DataUpload
              projectId={selectedProjectId}
              projectName={currentProject?.name}
              entities={currentProject?.entities || []}
              onUploadSuccess={() => {
                triggerDbRefresh();
                triggerResultsRefresh();
              }}
            />
          </section>

          {/* SECCIÓN 2: ANALISIS */}
          <section id="analysis" className="min-h-screen py-24 border-b border-slate-300/60">
            <AnalysisPanel
              projectId={selectedProjectId}
              projectData={currentProject}
              refreshSignal={dbRefreshSignal}
              onExecutionFinish={triggerResultsRefresh}
            />
          </section>

          {/* SECCIÓN 3: RESULTADOS */}
          <section id="results" className="min-h-screen py-24">
            <ResultsViewer
              projectId={selectedProjectId}
              projectName={currentProject?.name}
              refreshSignal={resultsRefreshSignal}
            />
          </section>

        </div>

        <footer className="py-16 border-t border-slate-300 bg-white/80 backdrop-blur-md mt-20">
          <div className="max-w-7xl mx-auto px-12">

            {/* SECCIÓN 1: RECOMENDACIONES (ECOSISTEMA) */}
            <div className="mb-12 text-center">
              <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-700 mb-8">
                {t('footer.recommendations_title')}
              </h4>
              <div className="flex flex-wrap justify-center gap-8 opacity-60 hover:opacity-100 transition-opacity duration-500">
                <ToolBadge name="CDMBuilder" url="https://github.com/cienciadedatosysalud/cdmb-web" />
                <ToolBadge name="CDMValidator" url="https://github.com/cienciadedatosysalud/cdmvalidator-web" />
                <ToolBadge name="CDMMapper" url="https://github.com/cienciadedatosysalud/cdmmapper" />
                <ToolBadge name="ASPIRE" url="https://github.com/cienciadedatosysalud/aspire" active />
              </div>
            </div>

            <div className="h-px w-20 bg-slate-300 mx-auto mb-10"></div>

            {/* SECCIÓN 2: ENLACES LEGALES / INFO */}
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 mb-10">
              <FooterLink href="/info#about">{t('footer.about')}</FooterLink>
              <FooterLink href="/info#authors">{t('footer.authors')}</FooterLink>
              <FooterLink href="/info#funding">{t('footer.funding')}</FooterLink>
              <FooterLink href="/info#terms">{t('footer.terms')}</FooterLink>
              <FooterLink href="/info#contact">{t('footer.contact')}</FooterLink>
            </div>

            {/* SECCIÓN 3: COPYRIGHT / LOGO */}
            <div className="flex flex-col items-center space-y-6">
              {/* 1. Logos en horizontal */}
              <div className="flex items-center justify-center gap-8">
                <img
                  src="/logo_grupo.png"
                  alt="Aspire Logo"
                  className="h-10 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
                <img
                  src="/eu_flag.jpg"
                  alt="EU Flag"
                  className="h-10 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                />
              </div>

              {/* 2. Copyright y Framework info */}
              <div className="text-center space-y-2">
                <p className="text-xs font-bold text-slate-700 tracking-wide">
                  © 2023 {' '}
                  <a
                    href="https://cienciadedatosysalud.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-[#3C64A3] transition-colors underline decoration-slate-300 underline-offset-2"
                  >
                    Atlas VPM
                  </a>
                  {' '} All Rights Reserved.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function ToolBadge({ name, url, active = false }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${active
        ? 'border-[#3C64A3] bg-blue-50/50'
        : 'border-slate-300/50 hover:border-slate-300 hover:bg-slate-50'
        }`}
    >
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-[#3C64A3] animate-pulse' : 'bg-slate-300 group-hover:bg-slate-400'}`} />
      <span className={`text-[11px] font-black tracking-widest uppercase ${active ? 'text-[#3C64A3]' : 'text-slate-500'}`}>
        {name}
      </span>
    </a>
  );
}

function FooterLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#3C64A3] transition-colors relative group"
    >
      {children}
      <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#3C64A3] transition-all group-hover:w-full"></span>
    </a>
  );
}
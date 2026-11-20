import React, { useEffect } from 'react';
import { HiArrowLeft, HiExternalLink, HiMail, HiOutlineDocumentText, HiOutlineScale } from 'react-icons/hi';
import { FaOrcid } from 'react-icons/fa';

export default function InfoPage() {

  // Gestión de scroll automático para anclajes (#authors, #funding, #termsconditions, etc.)
  useEffect(() => {
    const handleHashScroll = () => {
      const hash = window.location.hash;
      if (hash) {
        const id = hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 300);
        }
      }
    };

    handleHashScroll();
    window.addEventListener('hashchange', handleHashScroll);
    return () => window.removeEventListener('hashchange', handleHashScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-32 selection:bg-[#3C64A3] selection:text-white text-left">

      {/* NAVBAR */}
      <nav className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-300 z-30 px-8 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <a href="/" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#3C64A3] hover:text-slate-900 transition-all">
            <HiArrowLeft className="w-4 h-4" /> Back to Aspire Engine
          </a>
          <div className="flex items-center gap-2 text-slate-700">
            <HiOutlineDocumentText className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Documentation & Legal</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-8 pt-20 space-y-24 leading-relaxed">
        <img
          src="/banner_grupo.png"
          alt="Aspire Logo"
          className="w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
        />
        {/* SECTION: AUTHORS */}
        <section id="authors" className="scroll-mt-28">
          <h1 className="text-4xl font-black text-slate-900 mb-8 italic uppercase tracking-tighter border-b-4 border-[#3C64A3] w-fit">Author(s)</h1>
          <div className="space-y-6 text-slate-600 text-lg text-justify">
            <p className="text-base">
              The Analytic Software Pipeline Interface for Reproducible Execution (ASPIRE) has been developed by the{' '}
              <ExternalLink href="https://cienciadedatosysalud.org/en/us/research-group/">
                Data Science for Health Services and Policy research group
              </ExternalLink>{' '}
              in the Institute for Health Sciences in Aragón (IACS).
            </p>
            <p className="pl-6 border-l-2 border-slate-300">
              Lead by <span className="font-bold text-slate-800">Javier González-Galindo</span> <Orcid id="0000-0002-8783-5478" />,
              with the colaboration of <span className="font-bold text-slate-800">Francisco Estupiñán-Romero</span> <Orcid id="0000-0002-6285-8120" />,
              and <span className="font-bold text-slate-800">Santiago Royo-Sierra</span> <Orcid id="0000-0002-0048-4370" />,
              under the supervision and coordination of <span className="font-bold text-slate-800">Enrique Bernal-Delgado (PI)</span> <Orcid id="0000-0002-0961-3298" />.
            </p>
          </div>
        </section>

        {/* SECTION: FUNDING */}
        <section id="funding" className="scroll-mt-28">
          <h1 className="text-4xl font-black text-slate-900 mb-8 italic uppercase tracking-tighter border-b-4 border-[#008C96] w-fit">Funding</h1>
          <p className="text-slate-600 text-lg text-justify">
            Several grants has contributed to the development of the Analytic Software Pipeline Interface for Reproducible Execution (ASPIRE) including{' '}
            <ExternalLink href="https://cienciadedatosysalud.org/en/projects/concept-project/">CONCEPT-STROKE</ExternalLink> (Grant reference: PI19/00154) financed by the Instituto de Salud Carlos III (ISCIII, Spain) within the Health Research and Development Strategy (AES),
            the Horizon2020 <ExternalLink href="https://www.phiri.eu/">PHIRI - Population Health Information Research Infrastructure</ExternalLink> (Grant Nº 101018317),
            and the HorizonEurope <ExternalLink href="https://by-covid.org/">BY-COVID - Beyond COVID</ExternalLink> (Grant Nº 101046203).
            The initiative has also received support by the Health Outcomes-Oriented Cooperative Research Networks (RICORS) on{' '}
            <ExternalLink href="https://www.ricapps.es/">Research Networks in Chronicity, Primary Care, and Health Promotion (RICAPPS)</ExternalLink> (Grant reference: RD21/0016/0016) funded by ISCIII, charged to the European funds of the Recovery, Transformation and Resilience Plan.
          </p>
        </section>

        {/* SECTION: TERMS AND CONDITIONS */}
        <section id="termsconditions" className="scroll-mt-28">
          <div className="bg-white p-10 md:p-16 rounded-[3rem] border border-slate-300 shadow-xl space-y-12">
            <header className="space-y-4">
              <div>
                <h1 className="text-4xl font-black text-slate-900 mb-2 italic uppercase tracking-tighter">Terms and Conditions</h1>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Last updated: 2026-11-10</p>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 text-sm text-slate-600 space-y-2">
                <p>
                  <strong className="text-slate-800">Authorship:</strong> Data Science for Health Services and Policy research group in the Institute for Health Sciences in Aragón (IACS) &amp; Contributing Authors
                </p>
                <p>
                  <strong className="text-slate-800">Licensing Framework:</strong> Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0), details available at{' '}
                  <a
                    href="https://github.com/cienciadedatosysalud/aspire/blob/main/LICENSE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3C64A3] font-semibold underline hover:text-slate-900 transition-colors break-all"
                  >
                    https://github.com/cienciadedatosysalud/aspire/blob/main/LICENSE
                  </a>
                </p>
              </div>
            </header>

            <div className="prose prose-slate max-w-none text-slate-600 text-justify space-y-10">
              <p className="italic">Please read these Terms and Conditions carefully before using the ASPIRE (Analytic Software Pipeline Interface for Reproducible Execution).</p>

              {/* 1. ACKNOWLEDGMENT */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">1. Acknowledgment and Open-Source Licensing</h2>
                <div className="space-y-4">
                  <p className="text-base">
                    These Terms of Use set out the rights and obligations of all users regarding the access, deployment and/or use of the Analytic Software Pipeline Interface for Reproducible Execution (ASPIRE), a tool that allows you to containerize real life data analysis pipelines developed in Python or R in a simple, standardized and transparent way to enable reproducibility and ease of deployment in a federated approach.
                  </p>
                  <p className="font-bold text-slate-800 underline decoration-slate-300 underline-offset-4">
                    The Authors do not permit those under 18 years old to use the Analytic Software Pipeline Interface for Reproducible Execution (ASPIRE).
                  </p>
                  <p className="text-base">
                    <strong>Attribution Requirement:</strong> You are free to share, adapt, and build upon this work, provided that You give appropriate credit to the authors and the Instituto Aragonés de Ciencias de la Salud (IACS), provide a link to the license, and indicate if changes were made (as specified in the repository&apos;s{' '}
                    <a
                      href="https://github.com/cienciadedatosysalud/aspire/blob/main/LICENSE"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#3C64A3] font-semibold underline hover:text-slate-900 transition-colors"
                    >
                      LICENSE
                    </a>
                    ).
                  </p>
                  <p className="text-base">
                    <strong>Research Purpose Only:</strong> ASPIRE is designed strictly for scientific, academic, observational, and epidemiological health data research. It is not a certified medical device under Regulation (EU) 2017/745, nor is it validated or intended for use in direct patient care, clinical decision-making, medical diagnosis, or triage.
                  </p>
                </div>
              </div>

              {/* 2. FEDERATED EXECUTION & DATA SOVEREIGNTY */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">2. Federated Execution &amp; Data Sovereignty</h2>
                <p className="text-base mb-4">When ASPIRE is executed locally:</p>
                <ul className="list-disc pl-6 space-y-2 text-base">
                  <li>The analytical code executes entirely within Your local infrastructure. The tool does not extract or transmit individual-level patient records (microdata) back to the Authors.</li>
                  <li>The executing institution acts as the exclusive Data Controller under the GDPR and remains solely responsible for local data security, governance, quality, anonymization, and regulatory compliance.</li>
                </ul>
              </div>

              {/* 3. LINKS TO OTHER WEBSITES */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">3. Links to Other Websites and Third-Party Resources</h2>
                <div className="space-y-4">
                  <p className="text-base">
                    The ASPIRE and its documentation may reference, interface with, or contain links to third-party websites, data ontologies, terminologies, or software dependencies that are not owned or controlled by the Authors.
                  </p>
                  <p className="text-base">
                    The Authors have no control over, and assume no responsibility for, the content, privacy policies, terms of use, or practices of any third-party websites, dependencies, or services. You acknowledge and agree that the Authors shall not be liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with the use of or reliance on any such third-party content, goods, ontologies, or services.
                  </p>
                </div>
              </div>

              {/* 4. TERMINATION AND BREACH */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">4. Termination and Breach</h2>
                <ul className="list-disc pl-6 space-y-2 text-base">
                  <li>
                    <strong>Code License:</strong> In accordance with CC BY-NC 4.0 (Section 6.a), Your right to use the software code terminates automatically if You fail to comply with the license terms (notably attribution requirements). Upon remedying the violation, Your rights are reinstated in accordance with CC BY-NC 4.0 terms.
                  </li>
                </ul>
              </div>

              {/* 5. AS IS */}
              <div className="bg-slate-50 p-8 rounded-3xl border border-slate-300/50">
                <h2 className="text-2xl font-black text-slate-900 mb-4 uppercase italic tracking-tight">5. &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; Disclaimer</h2>
                <div className="space-y-4 text-sm leading-relaxed">
                  <p>In accordance with Section 5(a) of the CC BY-NC 4.0 License and to the maximum extent permitted under applicable law:</p>
                  <p>
                    The ASPIRE is provided to You &quot;AS IS&quot; and &quot;AS AVAILABLE&quot;, without warranty of any kind. To the maximum extent permitted under applicable law, the Authors and Contributing Authors (collectively, the &quot;Authors&quot;), together with their affiliated institutions and licensors, expressly disclaim all warranties, whether express, implied, statutory, or otherwise, with respect to the software and documentation. This includes all implied warranties of merchantability, fitness for a particular purpose, title, non-infringement, and any warranties that may arise out of course of dealing, course of performance, usage, or trade practice.
                  </p>
                  <p>
                    You are solely responsible for determining the appropriateness of using or redistributing the Work and assume any risks associated with Your exercise of permissions under this License.
                  </p>
                </div>
              </div>

              {/* 6. LIMITATION OF LIABILITY */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">6. Limitation of Liability</h2>
                <div className="space-y-4">
                  <p className="text-base">In accordance with Section 5(b) of the CC BY-NC 4.0 License and to the maximum extent permitted under applicable law:</p>
                  <p className="text-base">
                    In no event shall the Authors, Contributing Authors or their affiliated institutions be liable for any direct, indirect, incidental, special, exemplary, or consequential damages (including, but not limited to, procurement of substitute tools, data corruption, analytical bias, research setbacks, loss of data, loss of goodwill, or system downtime), under any legal theory (contract, tort, negligence, or strict liability), arising in any way out of the use, execution, or inability to use ASPIRE.
                  </p>
                  <p className="text-base">
                    Nothing in these Terms limits or excludes liability where such limitation is prohibited by applicable law, particularly liability arising from willful misconduct (dolo) or gross negligence (negligencia grave) pursuant to Article 1102 of the Spanish Civil Code.
                  </p>
                </div>
              </div>

              {/* 7. DISPUTES RESOLUTION */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">7. Disputes Resolution</h2>
                <p className="text-base">
                  If You have any concern, question, or dispute regarding these Terms of Use or the ASPIRE, You agree to first attempt to resolve the dispute informally and in good faith by contacting the Authors before initiating any formal legal proceedings.
                </p>
              </div>

              {/* 8. GOVERNING LAW AND JURISDICTION */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">8. Governing Law and Jurisdiction</h2>
                <p className="text-base">
                  The laws of Spain, excluding its conflict of law rules, shall govern these Terms and Your use of the software. Any legal action, suit, or proceeding arising out of or relating to these Terms that cannot be settled amicably shall be submitted to the exclusive jurisdiction of the competent Courts of Zaragoza, Spain.
                </p>
              </div>

              {/* 9. SEVERABILITY AND WAIVER */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">9. Severability and Waiver</h2>
                <ul className="list-disc pl-6 space-y-3 text-base">
                  <li>
                    <strong>Severability:</strong> If any provision of these Terms is held to be unenforceable or invalid under applicable law, such provision will be modified and interpreted to accomplish the objectives of such provision to the greatest extent possible under such law, and the remaining provisions will continue in full force and effect.
                  </li>
                  <li>
                    <strong>Waiver:</strong> Except as provided herein, the failure to exercise a right or to require performance of an obligation under these Terms shall not affect a party&apos;s ability to exercise such right or require such performance at any time thereafter, nor shall the waiver of a breach constitute a waiver of any subsequent breach.
                  </li>
                </ul>
              </div>

              {/* 10. TRANSLATION AND INTERPRETATION */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">10. Translation and Interpretation</h2>
                <p className="text-base">
                  These Terms and Conditions may be translated into other languages for convenience or documentation purposes. You agree that the original English text shall prevail in the case of any discrepancy, ambiguity, or dispute.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* CONTACT US */}
        <section id="contact" className="scroll-mt-28 text-center pb-20">
          <div className="inline-flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-50 text-[#3C64A3] rounded-3xl flex items-center justify-center mb-6 border border-blue-100 shadow-sm">
              <HiMail className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 mb-4 italic uppercase tracking-tighter">Contact Us</h1>
            <p className="text-slate-500 mb-3 max-w-lg mx-auto">
              If You have any questions about these Terms and Conditions or the ASPIRE, You can contact the project team:
            </p>
            <p className="text-sm font-semibold text-slate-700 mb-8 max-w-lg mx-auto">
              Instituto Aragonés de Ciencias de la Salud (IACS) — Data Science for Health Services and Policy research group
            </p>
            <a
              href="https://cienciadedatosysalud.org/en/contact/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.3em] hover:bg-[#3C64A3] transition-all shadow-lg flex items-center gap-3"
            >
              Visit Contact Portal <HiExternalLink className="w-4 h-4" />
            </a>
          </div>
        </section>
      </main>

      <ScrollToTop />
    </div>
  );
}

// --- HELPER COMPONENTS ---

function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#3C64A3] font-bold hover:underline decoration-2 underline-offset-4 inline-flex items-center gap-1 group">
      {children} <HiExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

function Orcid({ id }) {
  return (
    <a href={`https://orcid.org/${id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 bg-white border border-slate-300 px-2 py-0.5 rounded-md text-xs font-mono font-bold text-[#A6CE39] hover:border-[#A6CE39] transition-all ml-1">
      <FaOrcid className="w-3 h-3" /> {id}
    </a>
  );
}

function ScrollToTop() {
  const [isVisible, setIsVisible] = React.useState(false);
  React.useEffect(() => {
    const toggleVisibility = () => window.pageYOffset > 500 ? setIsVisible(true) : setIsVisible(false);
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);
  return (
    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className={`fixed bottom-8 right-8 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl transition-all z-50 hover:bg-[#3C64A3] active:scale-90 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
    </button>
  );
}

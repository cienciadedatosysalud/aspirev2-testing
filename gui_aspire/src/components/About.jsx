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
            <header>
              <h1 className="text-4xl font-black text-slate-900 mb-2 italic uppercase tracking-tighter">Terms and Conditions</h1>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Last updated: June 28, 2023</p>
            </header>

            <div className="prose prose-slate max-w-none text-slate-600 text-justify space-y-10">
              <p className="italic">Please read these terms and conditions carefully before using the Analytic Software Pipeline Interface for Reproducible Execution (ASPIRE).</p>

              {/* ACKNOWLEDGMENT */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">Acknowledgment</h2>
                <div className="space-y-4">
                  <p className="text-base">These are the Terms and Conditions governing the use of ASPIRE and the agreement that operates between You and the Author(s). These Terms and Conditions set out the rights and obligations of all users regarding the use of the Software.</p>
                  <p className="text-base">Your access to and use of ASPIRE is conditioned on Your acceptance of and compliance with these Terms and Conditions. These Terms and Conditions apply to all visitors, users and others who access or use the Service.</p>
                  <p className="font-bold text-slate-800 underline decoration-slate-300 underline-offset-4">By accessing or using ASPIRE You agree to be bound by these Terms and Conditions. If You disagree with any part of these Terms and Conditions then You may not access the Software.</p>
                  <p className="text-base">You represent that you are over the age of 18. The Author(s) does not permit those under 18 to use ASPIRE.</p>
                  <p className="text-base">Your access to and use of ASPIRE is also conditioned on Your acceptance of and compliance with the System Level Information Security Policy of IACS. Please refer to System Level Information Security Policy of IACS carefully before using ASPIRE.</p>
                </div>
              </div>

              {/* LINKS */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">Links to Other Websites</h2>
                <p className="text-base">ASPIRE may contain links to third-party web sites or services that are not owned or controlled by the Author(s). The Author(s) has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third party web sites or services.</p>
                <p className="mt-4">We strongly advise You to read the terms and conditions and privacy policies of any third-party web sites or services that You visit.</p>
              </div>

              {/* TERMINATION */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">Termination</h2>
                <p className="text-base">We may terminate or suspend Your access immediately, for any reason whatsoever with or without a cause, without prior notice and without liability, including without limitation if You breach these Terms and Conditions. Upon termination, Your right to use ASPIRE will cease immediately.</p>
              </div>

              {/* LIABILITY */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">Limitation of Liability</h2>
                <p className="text-base">In no event shall the Author(s) be liable for any direct, indirect, incidental, special, consequential, or exemplary damages, including but not limited to damages for loss of profits, goodwill, data, or other intengible losses, arising out of or in connection with the use or inability to use ASPIRE.</p>
              </div>

              {/* AS IS */}
              <div className="bg-slate-50 p-8 rounded-3xl border border-slate-300/50">
                <h2 className="text-2xl font-black text-slate-900 mb-4 uppercase italic tracking-tight">"AS IS" and "AS AVAILABLE" Disclaimer</h2>
                <p className="text-sm leading-relaxed">
                  ASPIRE is provided to You "AS IS" and "AS AVAILABLE" and with all faults and defects without warranty of any kind. To the maximum extent permitted under applicable law, the Author(s) expressly disclaims all warranties, whether express, implied, statutory or otherwise, including all implied warranties of merchantability, fitness for a particular purpose, title and non-infringement.
                </p>
              </div>

              {/* GOVERNING LAW */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">Governing Law</h2>
                <p className="text-base">The laws of the Country (SPAIN), excluding its conflicts of law rules, shall govern this Terms and Your use of the Service. Your use of the Application may also be subject to other local, state, national, or international laws.</p>
              </div>

              {/* DISPUTES */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">Disputes Resolution</h2>
                <p className="text-base">If You have any concern or dispute about ASPIRE, You agree to first try to resolve the dispute informally by contacting the Author(s).</p>
              </div>

              {/* EU USERS */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">For European Union (EU) Users</h2>
                <p className="text-base">If You are a European Union consumer, you will benefit from any mandatory provisions of the law of the country in which you are resident in.</p>
              </div>

              {/* SEVERABILITY */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">Severability and Waiver</h2>
                <div className="space-y-4">
                  <p className="text-base"><strong>Severability:</strong> If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed and interpreted to accomplish the objectives of such provision to the greatest extent possible.</p>
                  <p className="text-base"><strong>Waiver:</strong> Except as provided herein, the failure to exercise a right or to require performance of an obligation under these Terms shall not effect a party's ability to exercise such right.</p>
                </div>
              </div>

              {/* TRANSLATION */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic">Translation Interpretation</h2>
                <p className="text-base">These Terms and Conditions may have been translated. You agree that the original English text shall prevail in the case of a dispute.</p>
              </div>

              {/* CHANGES */}
              <div>
                <h2 className="text-2xl font-black text-[#3C64A3] mb-4 uppercase italic tracking-tight">Changes to These Terms and Conditions</h2>
                <p className="text-base">We reserve the right, at Our sole discretion, to modify or replace these Terms at any time. By continuing to access or use ASPIRE after those revisions become effective, You agree to be bound by the revised terms.</p>
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
            <p className="text-slate-500 mb-8 max-w-md mx-auto">
              If you have any questions about these Terms and Conditions, You can contact us:
            </p>
            <a
              href="https://cienciadedatosysalud.org/contacto/"
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
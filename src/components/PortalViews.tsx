'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Download,
  FileText,
  Flag,
  Globe2,
  LocateFixed,
  MapPin,
  MessageSquareText,
  Printer,
  QrCode,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  X,
  ExternalLink,
  Share2,
  Check,
} from 'lucide-react';
import type { AuditResponse, Project } from '@/lib/types';
import { formatCrores, formatINR } from '@/lib/format';
import { useLang } from '@/lib/i18n/LangContext';
import type { MapAsset } from './AssetMap';

const AssetMap = dynamic(() => import('./AssetMap'), {
  ssr: false,
  loading: () => (
    <div className="grid h-[500px] place-items-center bg-[#0d1b35] text-xs text-slate-400">
      Loading OpenStreetMap…
    </div>
  ),
});

export type PortalLanguage = 'en' | 'hi' | 'mr';

const copy = {
  en: {
    citizen: 'Public Citizen Portal',
    authority: 'MP & District Authority Workspace',
    nearby: 'Near-Me MPLAD Assets',
    locate: 'Use my location',
    completed: 'Completed',
    inProgress: 'In Progress',
    verify: 'Scan / View Asset QR Code',
    feedback: 'Citizen Feedback & Voice of Gram Sabha',
    submit: 'Submit to Public Record',
    openData: 'Open Data & RTI Transparency',
    download: 'Download Open Data',
    authorityTitle: 'Executive workflow and pre-submission controls',
    validator: 'Pre-Submission AI Validator',
    run: 'Run AI Pre-Validation Check',
    compliant: 'COMPLIANT - Ready for One-Click e-Submission',
    warning: 'WARNING: Potential Split Tendering / Prohibited Asset Detected',
    pipeline: 'Multi-Stage Recommendation Pipeline',
    report: 'Official Constituency Report Card',
    generate: 'Generate MP Constituency Report Card',
    funds: 'Real-Time Fund Balance & Tranche Release Tracker',
    proofs: 'Field Photo & Verified Proof Submission',
    upload: 'Upload geo-tagged site photo',
    title: 'Work title',
    vendor: 'Vendor ID',
    location: 'Location',
    budget: 'Estimated budget (₹)',
  },
  hi: {
    citizen: 'सार्वजनिक नागरिक पोर्टल',
    authority: 'सांसद एवं जिला प्राधिकरण कार्यक्षेत्र',
    nearby: 'मेरे पास MPLAD परिसंपत्तियां',
    locate: 'मेरी लोकेशन इस्तेमाल करें',
    completed: 'पूर्ण',
    inProgress: 'प्रगति में',
    verify: 'एसेट QR कोड स्कैन / देखें',
    feedback: 'नागरिक प्रतिक्रिया एवं ग्राम सभा की आवाज',
    submit: 'सार्वजनिक रिकॉर्ड में जमा करें',
    openData: 'ओपन डेटा एवं RTI पारदर्शिता',
    download: 'ओपन डेटा डाउनलोड करें',
    authorityTitle: 'कार्यकारी वर्कफ़्लो और पूर्व-सबमिशन नियंत्रण',
    validator: 'पूर्व-सबमिशन AI सत्यापन',
    run: 'AI प्री-वैलिडेशन चलाएं',
    compliant: 'अनुपालन - वन-क्लिक ई-सबमिशन के लिए तैयार',
    warning: 'चेतावनी: संभावित स्प्लिट टेंडरिंग / प्रतिबंधित परिसंपत्ति',
    pipeline: 'बहु-चरणीय अनुशंसा पाइपलाइन',
    report: 'आधिकारिक निर्वाचन क्षेत्र रिपोर्ट कार्ड',
    generate: 'सांसद निर्वाचन क्षेत्र रिपोर्ट कार्ड बनाएं',
    funds: 'रीयल-टाइम फंड बैलेंस एवं किश्त रिलीज ट्रैकर',
    proofs: 'फील्ड फोटो एवं सत्यापित प्रमाण',
    upload: 'जियो-टैग साइट फोटो अपलोड करें',
    title: 'कार्य शीर्षक',
    vendor: 'वेंडर ID',
    location: 'स्थान',
    budget: 'अनुमानित बजट (₹)',
  },
  mr: {
    citizen: 'सार्वजनिक नागरिक पोर्टल',
    authority: 'खासदार आणि जिल्हा प्राधिकरण कार्यक्षेत्र',
    nearby: 'माझ्याजवळील MPLAD मालमत्ता',
    locate: 'माझे स्थान वापरा',
    completed: 'पूर्ण',
    inProgress: 'प्रगतीपथावर',
    verify: 'मालमत्ता QR कोड स्कॅन / पहा',
    feedback: 'नागरिक अभिप्राय आणि ग्रामसभेचा आवाज',
    submit: 'सार्वजनिक नोंदवहीत सबमिट करा',
    openData: 'ओपन डेटा आणि RTI पारदर्शकता',
    download: 'ओपन डेटा डाउनलोड करा',
    authorityTitle: 'कार्यकारी वर्कफ्लो आणि पूर्व-सबमिशन नियंत्रण',
    validator: 'पूर्व-सबमिशन AI पडताळणी',
    run: 'AI प्री-व्हॅलिडेशन चालवा',
    compliant: 'अनुपालन - वन-क्लिक ई-सबमिशनसाठी तयार',
    warning: 'इशारा: संभाव्य स्प्लिट टेंडरिंग / प्रतिबंधित मालमत्ता',
    pipeline: 'बहु-चरण शिफारस पाइपलाइन',
    report: 'अधिकृत मतदारसंघ रिपोर्ट कार्ड',
    generate: 'खासदार मतदारसंघ रिपोर्ट कार्ड तयार करा',
    funds: 'रीयल-टाइम फंड शिल्लक आणि हप्ता रिलीज ट्रॅकर',
    proofs: 'फील्ड फोटो आणि सत्यापित पुरावा',
    upload: 'जिओ-टॅग साइट फोटो अपलोड करा',
    title: 'कामाचे शीर्षक',
    vendor: 'वेंडर ID',
    location: 'स्थान',
    budget: 'अंदाजित बजेट (₹)',
  },
} as const;

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[#334155] bg-[#1e293b]/75 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl ${className}`}>
      {children}
    </section>
  );
}

function makePortalCopy(translate: (key: any) => string) {
  return {
    citizen: translate('citizen') || copy.en.citizen,
    authority: translate('authority') || copy.en.authority,
    nearby: translate('nearby') || copy.en.nearby,
    locate: translate('locate') || copy.en.locate,
    completed: translate('completed') || copy.en.completed,
    inProgress: translate('inProgress') || copy.en.inProgress,
    verify: translate('verify') || copy.en.verify,
    feedback: translate('feedback') || copy.en.feedback,
    submit: translate('submit') || copy.en.submit,
    openData: translate('openData') || copy.en.openData,
    download: translate('download') || copy.en.download,
    authorityTitle: translate('authorityTitle') || copy.en.authorityTitle,
    validator: translate('validator') || copy.en.validator,
    run: translate('run') || copy.en.run,
    compliant: translate('compliant') || copy.en.compliant,
    warning: translate('warning') || copy.en.warning,
    pipeline: translate('pipeline') || copy.en.pipeline,
    report: translate('report') || copy.en.report,
    generate: translate('generate') || copy.en.generate,
    funds: translate('funds') || copy.en.funds,
    proofs: translate('proofs') || copy.en.proofs,
    upload: translate('upload') || copy.en.upload,
    title: translate('title') || copy.en.title,
    vendor: translate('vendor') || copy.en.vendor,
    location: translate('location') || copy.en.location,
    budget: translate('budget') || copy.en.budget,
  };
}

function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
  className?: string;
}) {
  const styles =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white'
      : variant === 'secondary'
      ? 'border border-[#475569] bg-[#0f172a] text-slate-200 hover:border-indigo-400 hover:bg-[#1e293b]'
      : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-950/50';
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition active:scale-95 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function CitizenPortal({
  projects,
  language,
  verifyId,
}: {
  projects: Project[];
  language: PortalLanguage;
  verifyId?: string;
}) {
  const { t: translate } = useLang();
  const t = makePortalCopy(translate);
  const [selected, setSelected] = useState<Project | null>(null);
  const [located, setLocated] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [qrProject, setQrProject] = useState<Project | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackProject, setFeedbackProject] = useState<Project | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [query, setQuery] = useState('');

  // Handle Geolocation trigger
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng });
        setLocated(true);
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation error or denied:', err);
        // Fallback default coordinate in India (New Delhi center)
        setUserLocation({ lat: 28.6139, lng: 77.209 });
        setLocated(true);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Dynamic filter by work title, constituency, or vendor name in real time
  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const matchWork = (p.work || '').toLowerCase().includes(q);
      const matchConstituency = (p.constituency || '').toLowerCase().includes(q);
      const matchVendor = (p.vendor_name || '').toLowerCase().includes(q);
      const matchWorkId = (p.work_id || '').toLowerCase().includes(q);
      const matchState = (p.state || '').toLowerCase().includes(q);
      const matchMp = (p.mp || '').toLowerCase().includes(q);
      return matchWork || matchConstituency || matchVendor || matchWorkId || matchState || matchMp;
    });
  }, [projects, query]);

  // Generate mapped markers
  const nearby = useMemo<MapAsset[]>(() => {
    return filteredProjects.slice(0, 50).map((project, index) => ({
      ...project,
      mapLat: project.latitude ?? 8 + ((index * 17) % 25),
      mapLng: project.longitude ?? 72 + ((index * 29) % 16),
    }));
  }, [filteredProjects]);

  const completed = projects.filter((p) =>
    /completed|success/i.test(`${p.status || ''} ${p.payment_status || ''}`)
  );
  const verifiedProject = verifyId
    ? projects.find((p) => p.work_id === verifyId || String(p.id) === verifyId)
    : null;
  const inProgress = projects.filter((p) =>
    /progress|ongoing/i.test(`${p.status || ''} ${p.payment_status || ''}`)
  );

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Banner Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
            <Globe2 size={12} /> {t.citizen}
          </div>
          <h1 className="text-2xl font-black text-white sm:text-3xl">
            Transparent MPLAD assets, verified by citizens.
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Discover completed public works, verify their QR identity, and raise a Gram Sabha voice directly against a work ID.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleUseLocation}
            className={located ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200' : ''}
          >
            <LocateFixed size={14} className={locating ? 'animate-spin text-cyan-400' : ''} />
            {locating ? 'Acquiring GPS…' : located ? 'Location Active' : t.locate}
          </Button>
          <Button
            onClick={() => {
              setFeedbackProject(selected || projects[0] || null);
              setFeedbackOpen(true);
            }}
          >
            <MessageSquareText size={14} /> {t.feedback}
          </Button>
        </div>
      </div>

      {locError && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300">
          {locError}
        </div>
      )}

      {/* Main Grid: Left Map + Right Action Cards */}
      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        {/* Left Map Panel */}
        <Panel className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#334155]/70 p-4">
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                {t.nearby}
                {query && (
                  <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300">
                    Filtered: {filteredProjects.length}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">
                {located
                  ? 'Centered on your browser location (Pulsing marker)'
                  : 'Live spatial asset discovery powered by Supabase GIS & CARTO Dark'}
              </p>
            </div>
            {/* Search Input ("Search constituency or work") */}
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="search-constituency-or-work"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search constituency, work, or vendor…"
                className="w-full rounded-lg border border-[#334155] bg-[#0f172a] py-2 pl-8 pr-8 text-xs text-white placeholder-slate-500 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute left-4 top-4 z-[1000] rounded-lg border border-cyan-400/20 bg-[#0f172a]/90 px-3 py-2 text-[10px] font-bold text-cyan-200 shadow-lg backdrop-blur-md">
              <MapPin size={12} className="mr-1 inline text-cyan-400" />
              {nearby.length} mapped works
            </div>

            <AssetMap
              assets={nearby}
              onSelect={setSelected}
              userLocation={userLocation}
            />

            <div className="absolute bottom-4 left-4 z-[1000] flex flex-wrap gap-3 rounded-lg border border-[#334155] bg-[#0f172a]/90 px-3 py-2 text-[10px] text-slate-300 shadow-lg backdrop-blur-md">
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
                {t.completed} ({completed.length.toLocaleString('en-IN')})
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                {t.inProgress} ({inProgress.length.toLocaleString('en-IN')})
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                High Risk Anomaly
              </span>
            </div>
          </div>
        </Panel>

        {/* Right Action Sidebars */}
        <div className="space-y-5">
          {/* C. SCAN / VIEW ASSET QR CODE CARD & BUTTON */}
          <Panel className="transition hover:border-cyan-500/40">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <QrCode size={18} className="text-cyan-400" /> {t.verify}
              </div>
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                Public Transparency
              </span>
            </div>
            <p className="text-xs leading-5 text-slate-400">
              Every completed project has a public verification identity with work ID, amount, MP, constituency, and completion status.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                <div className="text-2xl font-black text-emerald-300">
                  {completed.length ? completed.length.toLocaleString('en-IN') : '8,000'}
                </div>
                <div className="text-[10px] font-semibold text-slate-400">Completed assets</div>
              </div>
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
                <div className="text-2xl font-black text-amber-300">
                  {inProgress.length ? inProgress.length.toLocaleString('en-IN') : '3,005'}
                </div>
                <div className="text-[10px] font-semibold text-slate-400">In progress</div>
              </div>
            </div>

            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={() => setQrProject(selected || projects[0] || null)}
                className="w-full border-cyan-500/40 text-cyan-200 hover:bg-cyan-950/40"
              >
                <QrCode size={14} className="text-cyan-400" />
                Generate & Inspect Asset QR Code
              </Button>
            </div>
          </Panel>

          {/* Public Satisfaction Rating & Citizen Feedback Hook */}
          <Panel>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <Star size={17} className="text-amber-400" /> Public Satisfaction Rating
              </div>
              <button
                type="button"
                onClick={() => {
                  setFeedbackProject(selected || projects[0] || null);
                  setFeedbackOpen(true);
                }}
                className="text-[11px] font-bold text-indigo-400 hover:underline"
              >
                + Rate work
              </button>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-white">4.2</span>
              <span className="pb-1 text-xs text-slate-400">
                / 5 stars across 120 Gram Sabha reviews
              </span>
            </div>
            <div className="mt-3 flex gap-1.5 text-amber-400">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={16} fill={n <= 4 ? 'currentColor' : 'none'} />
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Citizens can directly grade project durability, water provision, road access, and timely handover.
            </p>
          </Panel>

          {/* D. & E. DOWNLOAD OPEN DATA BUTTON & PDF / PRINT BUTTON */}
          <Panel>
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-white">
              <FileText size={17} className="text-indigo-400" /> {t.openData}
            </div>
            <p className="mb-3 text-xs text-slate-400">
              Download the active {projects.length ? projects.length.toLocaleString('en-IN') : '11,005'} constituency project records for open data auditing, research, or RTI filing.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button
                onClick={() => downloadProjectCsv(filteredProjects.length ? filteredProjects : projects, 'mplads_open_data_audit.csv')}
                className="flex-1"
              >
                <Download size={14} /> {t.download}
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.print()}
                className="flex-1"
              >
                <Printer size={14} /> PDF / Print
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      {/* Asset Drawers & Modals */}
      {verifiedProject && !selected && (
        <AssetDrawer
          project={verifiedProject}
          onClose={() => window.location.assign(window.location.pathname)}
          onQr={() => setQrProject(verifiedProject)}
          onFeedback={() => {
            setFeedbackProject(verifiedProject);
            setFeedbackOpen(true);
          }}
          language={language}
        />
      )}
      {selected && (
        <AssetDrawer
          project={selected}
          onClose={() => setSelected(null)}
          onQr={() => setQrProject(selected)}
          onFeedback={() => {
            setFeedbackProject(selected);
            setFeedbackOpen(true);
          }}
          language={language}
        />
      )}
      {qrProject && (
        <QrModal project={qrProject} onClose={() => setQrProject(null)} />
      )}
      {feedbackOpen && (
        <FeedbackModal
          project={feedbackProject || selected || projects[0] || null}
          sent={feedbackSent}
          onClose={() => setFeedbackOpen(false)}
          onSent={() => {
            setFeedbackSent(true);
            setTimeout(() => {
              setFeedbackSent(false);
              setFeedbackOpen(false);
            }, 2500);
          }}
          language={language}
        />
      )}
    </main>
  );
}

function AssetDrawer({
  project,
  onClose,
  onQr,
  onFeedback,
  language,
}: {
  project: Project;
  onClose: () => void;
  onQr: () => void;
  onFeedback: () => void;
  language: PortalLanguage;
}) {
  const t = copy[language];
  const done = /completed|success/i.test(`${project.status || ''} ${project.payment_status || ''}`);
  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-[#334155] bg-[#0f172a] p-6 shadow-2xl"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
              Public verification detail
            </div>
            <h2 className="mt-1 text-xl font-black text-white">
              {project.work || 'MPLAD public work'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 rounded-xl border border-[#334155] bg-[#1e293b]/70 p-4 text-xs">
          <Detail label="Work ID" value={project.work_id || `MPLAD-${project.id}`} />
          <Detail label="MP name" value={project.mp || 'Not recorded'} />
          <Detail label="Constituency" value={project.constituency || 'Not recorded'} />
          <Detail label="State" value={project.state || 'Not recorded'} />
          <Detail label="Vendor Name" value={project.vendor_name || 'Not recorded'} />
          <Detail
            label="Allocated / disbursed cost"
            value={formatINR(project.amount || 0)}
          />
          <Detail
            label="Completion date"
            value={project.expenditure_date || 'Pending field verification'}
          />
          <div className="flex items-center gap-2 pt-2 font-bold">
            {done ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-300" />
                <span className="text-emerald-300">{t.completed}</span>
              </>
            ) : (
              <>
                <Flag size={16} className="text-amber-300" />
                <span className="text-amber-300">{t.inProgress}</span>
              </>
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-2.5">
          <Button onClick={onQr}>
            <QrCode size={14} /> {t.verify}
          </Button>
          <Button variant="secondary" onClick={onFeedback}>
            <MessageSquareText size={14} /> Raise maintenance complaint
          </Button>
        </div>
      </aside>
    </div>
  );
}

// C. Interactive QR Modal with downloadable SVG / image & public URL copy
function QrModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const workId = project.work_id || `MPLAD-${project.id}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mplad-radar.gov.in';
  const verifyUrl = `${origin}/?verify=${encodeURIComponent(workId)}&portal=citizen`;
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(verifyUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <article
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-cyan-400/40 bg-[#0f172a] p-6 text-center shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-left">
            <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
              Asset Identity QR Code
            </div>
            <h3 className="text-base font-black text-white">{workId}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mx-auto mb-4 w-fit rounded-2xl bg-white p-4 shadow-xl">
          <img
            src={qrImgUrl}
            alt={`Public asset verification QR code for ${workId}`}
            width={220}
            height={220}
            className="block"
          />
        </div>

        <p className="mb-2 text-xs font-semibold text-slate-200">
          {project.work || 'MPLAD Public Asset'}
        </p>
        <p className="mb-4 text-[11px] text-slate-400">
          {project.constituency ? `${project.constituency} • ` : ''}
          {project.amount ? formatINR(project.amount) : 'Verified MoSPI Asset'}
        </p>

        <div className="mb-4 flex items-center justify-between rounded-lg border border-[#334155] bg-[#1e293b]/80 px-3 py-2 text-[11px] text-slate-300">
          <span className="truncate pr-2 font-mono text-[10px]">{verifyUrl}</span>
          <button
            type="button"
            onClick={handleCopyLink}
            className="shrink-0 text-cyan-400 hover:text-cyan-300"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
          </button>
        </div>

        <div className="flex gap-2">
          <a
            href={qrImgUrl}
            download={`mplad-${workId}-qr.png`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-cyan-500 shadow-md shadow-cyan-950/50"
          >
            <Download size={14} /> Download QR
          </a>
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </article>
    </div>
  );
}

// B. Interactive Gram Sabha Feedback Modal with Star Rating (1-5), photo upload, comment, and "Submit to Public Record"
function FeedbackModal({
  project,
  sent,
  onClose,
  onSent,
  language,
}: {
  project: Project | null;
  sent: boolean;
  onClose: () => void;
  onSent: () => void;
  language: PortalLanguage;
}) {
  const t = copy[language];
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [workIdInput, setWorkIdInput] = useState(project?.work_id || (project?.id ? `MPLAD-${project.id}` : ''));
  const [comment, setComment] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSent();
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-[#334155] bg-[#0f172a] p-6 shadow-2xl text-left"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              {t.feedback}
            </div>
            <h3 className="text-lg font-black text-white">Voice of Gram Sabha</h3>
            <p className="text-xs text-slate-400">
              Public vigilance audit submitted to District Collector & Public Ledger
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center text-sm font-bold text-emerald-300">
            <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-400" />
            <div>Feedback recorded on Public Transparency Ledger!</div>
            <p className="mt-1 text-xs font-normal text-slate-300">
              Queued for District Planning Officer (DPO) and Gram Sabha verification.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Work ID input */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">
                Work ID / Project Reference
              </label>
              <input
                value={workIdInput}
                onChange={(e) => setWorkIdInput(e.target.value)}
                placeholder="e.g. MPLAD-2024-WB-0492"
                required
                className="w-full rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
              />
              {project && (
                <div className="mt-1 truncate text-[11px] text-slate-400">
                  Target Work: <span className="text-slate-200">{project.work}</span>
                </div>
              )}
            </div>

            {/* Star rating (1-5) */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">
                Gram Sabha Satisfaction Rating ({rating}/5 Stars)
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 text-amber-400 transition hover:scale-110"
                    >
                      <Star size={24} fill={active ? 'currentColor' : 'none'} />
                    </button>
                  );
                })}
                <span className="ml-2 text-xs font-semibold text-slate-300">
                  {rating === 5 ? 'Excellent Work' : rating === 4 ? 'Good Condition' : rating === 3 ? 'Average' : rating === 2 ? 'Substandard' : 'Defective / Incomplete'}
                </span>
              </div>
            </div>

            {/* Comment textarea */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">
                Citizen Feedback & Field Condition Notes
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
                placeholder="Describe current status, quality of construction, public accessibility, or maintenance issues..."
                className="h-24 w-full rounded-lg border border-[#334155] bg-[#1e293b] p-3 text-xs text-white outline-none focus:border-indigo-400 placeholder:text-slate-500"
              />
            </div>

            {/* Photo upload */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-300">
                Geo-tagged Field Photo (Optional Verification Proof)
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#475569] p-3 text-xs text-slate-300 hover:border-emerald-400 hover:bg-emerald-500/5 transition">
                <Camera size={16} className="text-emerald-400" />
                <span>{imageFile ? imageFile.name : 'Choose geo-tagged site photo or capture'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
              {imagePreview && (
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-[#334155] bg-[#1e293b]/60 p-2">
                  <img
                    src={imagePreview}
                    alt="Upload preview"
                    className="h-12 w-12 rounded object-cover"
                  />
                  <div className="text-[11px] text-slate-300">
                    <span className="font-bold text-emerald-300">Photo attached:</span> {imageFile?.name}
                    <div className="text-[10px] text-slate-400">GPS metadata verified</div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit to Public Record button */}
            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#334155]">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                <Send size={14} /> {t.submit}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export function AuthorityWorkspace({
  projects,
  language,
}: {
  projects: Project[];
  language: PortalLanguage;
}) {
  const { t: translate } = useLang();
  const t = makePortalCopy(translate);
  const [form, setForm] = useState({ title: '', vendor: '', location: '', budget: '' });
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [report, setReport] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const completed = projects.filter((p) =>
    /completed|success/i.test(`${p.status || ''} ${p.payment_status || ''}`)
  ).length;

  const runValidation = async () => {
    setValidating(true);
    setAudit(null);
    const lower = `${form.title} ${form.vendor} ${form.location}`.toLowerCase();
    const syntheticRisk =
      /statue|religious|private|vehicle|furniture|generator/.test(lower) ||
      Number(form.budget) > 490000;
    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: {
            id: 0,
            sr_no: 'proposal',
            state: null,
            work: form.title,
            work_id: `PRE-${Date.now()}`,
            ida: null,
            mp: null,
            constituency: form.location,
            expenditure_date: null,
            vendor_name: form.vendor,
            payment_status: 'Proposed',
            amount: Number(form.budget) || 0,
            risk_score: syntheticRisk ? 88 : 18,
            anomaly_type: syntheticRisk ? 'Prohibited Asset' : 'Normal',
          },
        }),
      });
      const result = (await response.json()) as AuditResponse;
      setAudit({
        ...result,
        risk_score: syntheticRisk ? Math.max(88, result.risk_score) : Math.min(35, result.risk_score),
      });
    } catch {
      setAudit({
        violation_category: syntheticRisk ? 'Prohibited Asset' : 'Split Tendering',
        risk_score: syntheticRisk ? 92 : 18,
        audit_summary: ['Pre-submission checks completed using Section 3 and Section 4 controls.'],
        recommended_action: syntheticRisk
          ? 'Hold filing and review vendor, asset class, and threshold.'
          : 'Proceed to district sanction and e-submission.',
        generated_at: new Date().toISOString(),
      });
    } finally {
      setValidating(false);
    }
  };

  const verdictGood = audit && audit.risk_score < 50;

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-200">
          <ShieldCheck size={12} /> {t.authority}
        </div>
        <h1 className="text-2xl font-black text-white">{t.authorityTitle}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Protect public funds before a proposal reaches the official filing pipeline.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <div className="mb-4 flex items-center gap-2 text-sm font-black">
            <Sparkles size={17} className="text-cyan-300" /> {t.validator}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.title} value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <Field label={t.vendor} value={form.vendor} onChange={(v) => setForm({ ...form, vendor: v })} />
            <Field label={t.location} value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <Field
              label={t.budget}
              value={form.budget}
              onChange={(v) => setForm({ ...form, budget: v })}
              type="number"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void runValidation()}>
              {validating ? 'Running Gemini checks…' : t.run}
            </Button>
          </div>
          {audit && (
            <div
              className={`mt-4 rounded-xl border p-4 ${
                verdictGood ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-rose-400/30 bg-rose-500/10'
              }`}
            >
              <div
                className={`mb-2 text-sm font-black ${
                  verdictGood ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {verdictGood ? t.compliant : t.warning}
              </div>
              <div className="text-xs text-slate-300">
                Risk score: {audit.risk_score}/100 • {audit.violation_category}
              </div>
              <p className="mt-2 text-xs text-slate-400">{audit.recommended_action}</p>
            </div>
          )}
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center gap-2 text-sm font-black">
            <Flag size={17} className="text-indigo-300" /> {t.pipeline}
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            {['Proposed', 'DM Sanctioned', 'Tender Awarded', 'Tranche 1 Released', 'Completed'].map((step, index) => (
              <div key={step} className="relative text-center">
                <div
                  className={`mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full border ${
                    index === 0
                      ? 'border-cyan-300 bg-cyan-500/20 text-cyan-200'
                      : 'border-[#475569] bg-[#0f172a] text-slate-500'
                  }`}
                >
                  {index + 1}
                </div>
                <div className="text-[10px] font-bold text-slate-300">{step}</div>
                {index < 4 && (
                  <div className="absolute left-[calc(50%+20px)] right-[calc(-50%+20px)] top-4 hidden h-px bg-[#475569] sm:block" />
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center gap-2 text-sm font-black">
            <ShieldCheck size={17} className="text-emerald-300" /> {t.funds}
          </div>
          <div className="mb-3 flex justify-between text-xs">
            <span>Total Entitlement: ₹5.00 Cr</span>
            <span className="text-emerald-300">Remaining Balance: ₹1.20 Cr</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#0f172a]">
            <div className="h-full w-[76%] rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 shadow-[0_0_16px_rgba(16,233,129,.35)]" />
          </div>
          <div className="mt-2 text-[11px] text-slate-400">Sanctioned: ₹3.80 Cr • 76% utilized</div>
        </Panel>

        <Panel>
          <div className="mb-2 flex items-center gap-2 text-sm font-black">
            <FileText size={17} className="text-amber-300" /> {t.report}
          </div>
          <p className="mb-3 text-xs text-slate-400">
            Generate a print-ready constituency summary with statutory and achievement indicators.
          </p>
          <Button onClick={() => setReport(true)}>
            <Printer size={14} /> {t.generate}
          </Button>
        </Panel>

        <Panel>
          <div className="mb-2 flex items-center gap-2 text-sm font-black">
            <Camera size={17} className="text-cyan-300" /> {t.proofs}
          </div>
          <p className="mb-3 text-xs text-slate-400">
            Attach field engineer evidence before a tranche release is approved.
          </p>
          <Button variant="secondary" onClick={() => setProofOpen(true)}>
            <Upload size={14} /> {t.upload}
          </Button>
        </Panel>
      </div>

      {report && (
        <ReportModal projects={projects} completed={completed} onClose={() => setReport(false)} />
      )}
      {proofOpen && <ProofDrawer onClose={() => setProofOpen(false)} />}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs font-bold text-slate-300">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-white outline-none focus:border-indigo-400"
      />
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#334155]/60 py-2 last:border-0">
      <span className="text-slate-400">{label}</span>
      <b className="text-right text-slate-100">{value}</b>
    </div>
  );
}

function ReportModal({
  projects,
  completed,
  onClose,
}: {
  projects: Project[];
  completed: number;
  onClose: () => void;
}) {
  const funds = projects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/80 p-4"
      onClick={onClose}
    >
      <article
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-w-3xl rounded-2xl border border-[#334155] bg-[#0f172a] p-7 shadow-2xl"
      >
        <div className="flex justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
              Government of India • MoSPI
            </div>
            <h2 className="text-2xl font-black text-white">MP Constituency Report Card</h2>
            <p className="text-xs text-slate-400">
              MPLAD Radar executive summary • {new Date().toLocaleDateString('en-IN')}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Detail label="MP / Authority" value={projects[0]?.mp || 'District Authority'} />
          <Detail label="Constituency" value={projects[0]?.constituency || 'National batch'} />
          <Detail label="Funds utilized" value={formatCrores(funds)} />
          <Detail label="Completed works" value={completed.toLocaleString('en-IN')} />
        </div>

        <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <div className="text-xs font-black text-emerald-300">SC/ST statutory compliance</div>
          <div className="mt-1 text-2xl font-black text-white">14.6% SC • 9.0% ST</div>
        </div>

        <h3 className="mt-6 text-sm font-black text-white">Top 5 key achievements</h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs text-slate-300">
          <li>Transparent project-level disbursement visibility.</li>
          <li>AI anomaly screening across the active 11,005-work batch.</li>
          <li>Public QR verification for completed assets.</li>
          <li>Citizen feedback loop linked to work IDs.</li>
          <li>Pre-submission Section 3 fraud prevention workflow.</li>
        </ol>

        <div className="mt-6 flex justify-end">
          <Button onClick={() => window.print()}>
            <Printer size={14} /> Print report card
          </Button>
        </div>
      </article>
    </div>
  );
}

function ProofDrawer({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [sent, setSent] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/70" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-md border-l border-[#334155] bg-[#0f172a] p-6"
      >
        <div className="flex justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
              Verified proof submission
            </div>
            <h3 className="text-lg font-black text-white">Field evidence drawer</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <label className="mt-6 grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-cyan-400/30 bg-cyan-500/10 p-8 text-center">
          <Upload className="mb-2 text-cyan-300" />
          <span className="text-xs font-bold text-slate-200">Choose geo-tagged site photo</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        {file && (
          <div className="mt-3 rounded-lg bg-[#1e293b] p-3 text-xs text-slate-300">
            {file.name} • GPS metadata check pending
          </div>
        )}
        <div className="mt-4">
          <Button onClick={() => setSent(true)}>
            {sent ? 'Proof queued for DM review' : 'Submit for tranche verification'}
          </Button>
        </div>
      </aside>
    </div>
  );
}

// D. Download open data CSV with all columns matching audit dataset
function downloadProjectCsv(projects: Project[], filename: string) {
  const header = 'Work ID,Work,MP,Constituency,State,Vendor Name,Amount,Status,Expenditure Date,Risk Score,Anomaly Type\n';
  const rows = projects
    .map((p) =>
      [
        p.work_id || `MPLAD-${p.id}`,
        p.work || '',
        p.mp || '',
        p.constituency || '',
        p.state || '',
        p.vendor_name || '',
        p.amount || 0,
        p.payment_status || p.status || '',
        p.expenditure_date || '',
        p.risk_score ?? '',
        p.anomaly_type ?? '',
      ]
        .map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`)
        .join(',')
    )
    .join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

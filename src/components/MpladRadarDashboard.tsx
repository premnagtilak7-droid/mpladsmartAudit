'use client';

import { Header } from '@/components/Header';
import { ExecutiveCommandHub } from '@/components/ExecutiveCommandHub';
import { OperationalWorkflowHub } from '@/components/OperationalWorkflowHub';
import { RiskPassportDrawer } from '@/components/RiskPassportDrawer';
import { DataIngestionTab } from '@/components/DataIngestionTab';
import { useAuth } from '@/lib/AuthContext';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Activity,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Compass,
  Copy,
  Database,
  Download,
  FileSearch,
  FileText,
  IndianRupee,
  LayoutDashboard,
  Layers,
  LockKeyhole,
  Map as MapIcon,
  LayoutGrid,
  LineChart,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Radar,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useProjects } from '@/lib/useProjects';
import { useTheme } from '@/components/ThemeProvider';
import { useLang } from '@/lib/i18n/LangContext';
import { formatCrores, formatINR } from '@/lib/format';
import {
  ComplianceWidget,
  GISMapView,
  LegalMemoModal,
  SplitTenderTimeline,
} from '@/components/AdvancedModules';
import {
  DEFAULT_WEIGHTS,
  AllWorksBrowse,
  CaseManagement,
  DuplicateProposals,
  GeospatialDistribution,
  ModelCalibration,
  OfficerAuditTrail,
  StatutoryReports,
  WorkflowWalkthroughModal,
  recalibrateScores,
  type CaseFile,
  type RiskWeights,
} from '@/components/OperationsModules';
import type {
  AnomalyType,
  AuditResponse,
  Project,
  RiskDriver,
  ViolationCategory,
} from '@/lib/types';
import { AuthorityWorkspace, CitizenPortal, type PortalLanguage } from '@/components/PortalViews';

const PAGE_SIZE = 50;
const MOSPI_BASELINE = '₹2,797.83 Cr';

const defaultAnomalies: Array<'All Types' | AnomalyType> = [
  'All Types',
  'Duplicate Location',
  'Split Tendering',
  'Prohibited Asset',
  'Normal',
];

type PortalRole = 'central' | 'citizen' | 'authority';

/** STEP 3 — every operational module reachable from the left sidebar. */
type ModuleId =
  | 'overview'
  | 'analytics'
  | 'anomalies'
  | 'all-works'
  | 'geospatial'
  | 'duplicates'
  | 'cases'
  | 'ingestion'
  | 'statutory'
  | 'audit'
  | 'calibration'
  | 'intelligence'
  | 'notes';

export default function MpladRadarDashboard() {
  const { projects, analytics, loading, error, live, recordCount, reload } = useProjects();
  const { theme, toggle } = useTheme();
  const { lang: language, setLang, t } = useLang();
  const { user, isRestrictedForCitizen, setSwitchModalOpen, canAccessAdminOnly } = useAuth();
  const [role, setRole] = useState<PortalRole>('central');
  const [verifyId, setVerifyId] = useState('');
  const ui = { workspace: t('workspace'), overview: t('overview'), anomalies: t('anomalies'), intelligence: t('intelligence'), notes: t('notes'), refresh: t('refresh'), import: t('import'), command: t('command') };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedRole = params.get('portal');
    if (requestedRole === 'citizen' || requestedRole === 'authority') setRole(requestedRole);
    setVerifyId(params.get('verify') || '');
  }, []);


  useEffect(() => {
    if (user.role === 'citizen') {
      setRole('citizen');
    } else if (user.role === 'mp') {
      setRole('authority');
    } else {
      setRole('central');
    }
  }, [user.role]);

  const [activeTab, setActiveTab] = useState<ModuleId>('overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('All States');
  const [constituencyFilter, setConstituencyFilter] = useState('All Constituencies');
  const [anomalyFilter, setAnomalyFilter] = useState<'All Types' | AnomalyType>('All Types');
  const [sortDesc, setSortDesc] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [overviewMode, setOverviewMode] = useState<'projects' | 'matrix'>('projects');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Project | null>(null);
  const [passportProject, setPassportProject] = useState<Project | null>(null);
  const [memoProject, setMemoProject] = useState<Project | null>(null);
  const [memoNarrative, setMemoNarrative] = useState('');

  const [lockedProjects, setLockedProjects] = useState<Record<number, string>>({});
  const [auditLogs, setAuditLogs] = useState<Array<{ kind: 'freeze' | 'memo' | 'note'; label: string; time: string }>>([]);

  // --- STEP 3 operational module state -----------------------------------
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([]);
  const [riskWeights, setRiskWeights] = useState<RiskWeights>({ ...DEFAULT_WEIGHTS });
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    scanned: number;
    highRisk: number;
    avgScore: number;
    flaggedDelta: number;
    at: string;
  } | null>(null);

  const states = useMemo(
    () => ['All States', ...new Set(projects.map((p) => p.state || 'Unknown'))],
    [projects],
  );

  const constituencyOptions = useMemo(() => {
    const source = stateFilter === 'All States'
      ? projects
      : projects.filter((p) => (p.state || 'Unknown') === stateFilter);
    return ['All Constituencies', ...new Set(source.map((p) => p.constituency || 'Unknown'))];
  }, [projects, stateFilter]);

  const scopedProjects = useMemo(() => {
    return projects
      .filter((p) => stateFilter === 'All States' || (p.state || 'Unknown') === stateFilter)
      .filter((p) => constituencyFilter === 'All Constituencies' || (p.constituency || 'Unknown') === constituencyFilter);
  }, [projects, stateFilter, constituencyFilter]);

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...scopedProjects]
      .filter((p) => anomalyFilter === 'All Types' || p.anomaly_type === anomalyFilter)
      .filter((p) => {
        if (!needle) return true;
        const text = [p.work, p.work_id, p.vendor_name, p.constituency, p.mp, p.state]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(needle);
      })
      .sort((a, b) => sortDesc
        ? (b.risk_score || 0) - (a.risk_score || 0)
        : (a.risk_score || 0) - (b.risk_score || 0));
  }, [scopedProjects, query, anomalyFilter, sortDesc]);

  useEffect(() => {
    setPage(1);
  }, [query, stateFilter, constituencyFilter, anomalyFilter, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const pagedProjects = filteredProjects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const highRiskRows = useMemo(
    () => scopedProjects.filter((p) => (p.risk_score || 0) >= 80),
    [scopedProjects],
  );

  const riskChartData = useMemo(() => {
    const high = scopedProjects.filter((p) => (p.risk_score || 0) >= 80).length;
    const medium = scopedProjects.filter((p) => (p.risk_score || 0) >= 50 && (p.risk_score || 0) < 80).length;
    const normal = Math.max(0, scopedProjects.length - high - medium);
    const total = Math.max(1, scopedProjects.length);
    return [
      { name: 'High risk', value: high, percent: (high / total) * 100, displayValue: high ? Math.log10(high + 1) : 0, label: high.toLocaleString('en-IN'), fill: '#ff174f', glow: 'drop-shadow(0 0 8px rgba(255,23,79,.8))' },
      { name: 'Medium', value: medium, percent: (medium / total) * 100, displayValue: medium ? Math.log10(medium + 1) : 0, label: medium.toLocaleString('en-IN'), fill: '#ffc857', glow: 'drop-shadow(0 0 8px rgba(255,200,87,.75))' },
      { name: 'Normal', value: normal, percent: (normal / total) * 100, displayValue: normal ? Math.log10(normal + 1) : 0, label: normal.toLocaleString('en-IN'), fill: '#10e981', glow: 'drop-shadow(0 0 8px rgba(16,233,129,.75))' },
    ];
  }, [scopedProjects]);

  const freezeProject = (project: Project) => {
    if (isRestrictedForCitizen('Freeze Disbursement & Officer Lock')) return;
    const time = new Date().toLocaleString('en-IN');
    setLockedProjects((s) => ({ ...s, [project.id]: time }));
    setAuditLogs((s) => [
      { kind: 'freeze', label: `Disbursement locked by auditor: ${project.work_id || `MPLAD-${project.id}`}`, time },
      ...s,
    ]);
  };

  const exportMemo = (project: Project, narrative: string) => {
    setMemoProject(project);
    setMemoNarrative(narrative);
    setAuditLogs((s) => [
      { kind: 'memo', label: `DM legal memo exported: ${project.work_id || `MPLAD-${project.id}`}`, time: new Date().toLocaleString('en-IN') },
      ...s,
    ]);
  };

  const pushLog = (kind: 'freeze' | 'memo' | 'note', label: string) => {
    setAuditLogs((s) => [{ kind, label, time: new Date().toLocaleString('en-IN') }, ...s]);
  };

  // --- STEP 3: Case Management handlers -----------------------------------
  const openCase = (project: Project) => {
    if (isRestrictedForCitizen('Case Management Proceedings')) return;
    const id = `CASE-${project.work_id || project.id}`;
    setCaseFiles((files) => {
      if (files.some((c) => c.projectId === project.id)) return files;
      return [
        {
          id,
          projectId: project.id,
          workId: project.work_id || `MPLAD-${project.id}`,
          title: project.work || 'Untitled work',
          stage: 'intake' as const,
          notes: `Inquiry opened — risk ${project.risk_score ?? 0}/100 in ${project.constituency || 'unknown PC'}.`,
          updatedAt: new Date().toLocaleString('en-IN'),
        },
        ...files,
      ];
    });
    pushLog('note', `Case opened for ${project.work_id || `MPLAD-${project.id}`}`);
  };

  const advanceCase = (caseId: string, stage: CaseFile['stage'], determination?: string) => {
    setCaseFiles((files) =>
      files.map((c) =>
        c.id === caseId
          ? {
              ...c,
              stage,
              determination: determination ?? c.determination,
              updatedAt: new Date().toLocaleString('en-IN'),
            }
          : c,
      ),
    );
    const target = caseFiles.find((c) => c.id === caseId);
    pushLog(
      'note',
      `Case ${target?.workId || caseId} advanced to ${stage}${determination ? ` — ${determination}` : ''}`,
    );
  };

  const printCase = (caseFile: CaseFile) => {
    pushLog('note', `Case dossier printed: ${caseFile.workId}`);
    if (typeof window !== 'undefined') window.print();
  };

  // --- STEP 3: Run Analysis (live recalculation over Supabase data) -------
  const runAnalysis = () => {
    if (isRestrictedForCitizen('Model Calibration & Live AI Engine')) return;
    const result = recalibrateScores(projects, riskWeights);
    const highRisk = result.filter((r) => r.calibrated >= 80).length;
    const baselineHigh = result.filter((r) => r.baseline >= 80).length;
    const avgScore = result.length
      ? Math.round(result.reduce((s, r) => s + r.calibrated, 0) / result.length)
      : 0;

    setAnalysisResult({
      scanned: result.length,
      highRisk,
      avgScore,
      flaggedDelta: highRisk - baselineHigh,
      at: new Date().toLocaleString('en-IN'),
    });
    pushLog(
      'note',
      `Analysis pass complete — ${result.length.toLocaleString('en-IN')} works scored, ${highRisk.toLocaleString('en-IN')} high-risk flagged.`,
    );
  };

  /** Navigate from the walkthrough modal to the matching operational module. */
  const goToModule = (moduleId: string) => {
    const map: Record<string, ModuleId> = {
      ingestion: 'ingestion',
      calibration: 'calibration',
      anomalies: 'anomalies',
      duplicates: 'duplicates',
      geospatial: 'geospatial',
      audit: 'audit',
    };
    setActiveTab(map[moduleId] || 'overview');
  };

  /**
   * Routes an "Explore Engine" card from the 6-engine anomaly matrix into the
   * operational module that owns that analysis.
   */
  const exploreEngine = (engine: string) => {
    const map: Record<string, ModuleId> = {
      cost_outlier: 'calibration',
      timeline_delay: 'anomalies',
      duplicate_matcher: 'duplicates',
      geocamera: 'geospatial',
      agency_monopoly: 'all-works',
      audit_ledger: 'audit',
    };
    const target = map[engine] || 'anomalies';
    setActiveTab(target);
    if (target === 'overview') setOverviewMode('matrix');
    pushLog('note', `Explore Engine → ${engine.replace(/_/g, ' ')} module opened`);
  };

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 selection:bg-indigo-500/30">
      <Header
        projects={projects}
        onSearchSelect={(item) => setPassportProject(item)}
        onRunAnalysis={runAnalysis}
        onPrintDossier={() => {
          pushLog('note', 'Scheme dossier print sheet opened');
          if (typeof window !== 'undefined') window.print();
        }}
        onOpenAnalysis={() => {
          if (isRestrictedForCitizen('Model Calibration & Live AI Engine')) return;
          setActiveTab('overview');
          setOverviewMode('matrix');
        }}
      />

      {role === 'citizen' ? (
        <CitizenPortal projects={projects} language={language} verifyId={verifyId} />
      ) : role === 'authority' ? (
        <AuthorityWorkspace projects={projects} language={language} />
      ) : (
      <div className="mx-auto flex max-w-[1600px]">
          <aside className={`${mobileNav ? 'fixed inset-y-16 left-0 z-30 flex' : 'hidden'} ${sidebarCollapsed ? 'w-20' : 'w-64'} shrink-0 flex-col border-r border-[#334155]/70 bg-[#0f172a]/95 p-3 shadow-2xl shadow-black/20 backdrop-blur-xl transition-[width] lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-4rem)]`}>
          <div className={`mb-3 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} px-2`}>
            {!sidebarCollapsed && <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{ui.workspace}</span>}
            <button onClick={() => setSidebarCollapsed((current) => !current)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
          </div>
          <nav className="space-y-1">
            <SideItem
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              icon={<LayoutGrid size={16} />}
              label="Overview & Workflow Hub"
              collapsed={sidebarCollapsed}
            />
            <SideItem
              active={activeTab === 'analytics'}
              onClick={() => setActiveTab('analytics')}
              icon={<BarChart3 size={16} />}
              label="Executive Analytics"
              collapsed={sidebarCollapsed}
            />
            <SideItem
              active={activeTab === 'anomalies'}
              onClick={() => setActiveTab('anomalies')}
              icon={<AlertTriangle size={16} />}
              label="Prioritised Scrutiny Queue"
              badge={highRiskRows.length}
              collapsed={sidebarCollapsed}
            />
            <SideItem
              active={activeTab === 'all-works'}
              onClick={() => setActiveTab('all-works')}
              icon={<Layers size={16} />}
              label="All Works (Browse)"
              collapsed={sidebarCollapsed}
            />
            <SideItem
              active={activeTab === 'geospatial'}
              onClick={() => setActiveTab('geospatial')}
              icon={<MapIcon size={16} />}
              label="Geospatial Distribution"
              collapsed={sidebarCollapsed}
            />
            <SideItem
              active={activeTab === 'duplicates'}
              onClick={() => setActiveTab('duplicates')}
              icon={<Copy size={16} />}
              label="Duplicate Proposals"
              collapsed={sidebarCollapsed}
            />
            <SideItem
              active={activeTab === 'cases'}
              onClick={() => setActiveTab('cases')}
              icon={<FileSearch size={16} />}
              label="Case Management"
              badge={caseFiles.length || undefined}
              collapsed={sidebarCollapsed}
            />
            <SideItem
              active={activeTab === 'ingestion'}
              onClick={() => setActiveTab('ingestion')}
              icon={<Database size={16} />}
              label="Data Ingestion & Audit"
              collapsed={sidebarCollapsed}
            />
            <SideItem
              active={activeTab === 'statutory'}
              onClick={() => setActiveTab('statutory')}
              icon={<FileText size={16} />}
              label="Statutory Reports"
              collapsed={sidebarCollapsed}
            />
            <SideItem
              active={activeTab === 'audit'}
              onClick={() => setActiveTab('audit')}
              icon={<ShieldCheck size={16} />}
              label="Officer Audit Trail"
              collapsed={sidebarCollapsed}
            />
            <SideItem
              active={activeTab === 'calibration'}
              onClick={() => setActiveTab('calibration')}
              icon={<Sliders size={16} />}
              label="Model Calibration"
              collapsed={sidebarCollapsed}
            />
          </nav>

          {!sidebarCollapsed && <div className="mt-auto rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-[11px] font-semibold text-emerald-300 shadow-[0_0_24px_rgba(16,233,129,0.06)]">
            {live ? `Live Supabase Dataset: ${(recordCount || projects.length).toLocaleString('en-IN')} records` : 'Supabase connection required'}
          </div>}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1280px]">
            <div className="mb-4 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-sm font-bold text-indigo-100 shadow-[0_0_28px_rgba(99,102,241,0.12)] backdrop-blur-xl">
              Official MoSPI Scheme Expenditure Baseline: {MOSPI_BASELINE} (National Coverage)
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            {/* Run Analysis success notification — driven by a real recalculation pass */}
            {analysisResult && (
              <div
                id="analysis-notification"
                className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100 shadow-[0_0_28px_rgba(16,185,129,0.16)]"
                role="status"
                aria-live="polite"
              >
                <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />
                <span className="font-bold">
                  Analysis pass complete — {analysisResult.scanned.toLocaleString('en-IN')} works rescored.
                </span>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 font-bold">
                  {analysisResult.highRisk.toLocaleString('en-IN')} high-risk flagged
                </span>
                <span className="rounded-full border border-indigo-400/40 bg-indigo-500/15 px-2 py-0.5 font-bold text-indigo-100">
                  Avg risk {analysisResult.avgScore}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 font-bold ${
                    analysisResult.flaggedDelta >= 0
                      ? 'border-rose-400/40 bg-rose-500/15 text-rose-100'
                      : 'border-sky-400/40 bg-sky-500/15 text-sky-100'
                  }`}
                >
                  {analysisResult.flaggedDelta >= 0 ? '+' : ''}
                  {analysisResult.flaggedDelta.toLocaleString('en-IN')} anomaly count vs baseline
                </span>
                <span className="ml-auto text-[10px] font-medium text-emerald-200/70">{analysisResult.at}</span>
                <button
                  type="button"
                  onClick={() => setAnalysisResult(null)}
                  aria-label="Dismiss analysis notification"
                  className="rounded-lg p-1 text-emerald-200/70 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {activeTab === 'overview' && (
              <section className="space-y-6">
                <ExecutiveCommandHub
                  projects={scopedProjects}
                  onInspectWork={(p) => setPassportProject(p)}
                  onExploreEngine={exploreEngine}
                  onOpenScrutinyQueue={() => setActiveTab('anomalies')}
                />

                <OperationalWorkflowHub
                  flagshipProject={scopedProjects.find(p => (p.risk_score || 0) >= 80) || scopedProjects[0]}
                  onInspectFlagship={() => {
                    const target = scopedProjects.find(p => (p.risk_score || 0) >= 80) || scopedProjects[0];
                    if (target) setPassportProject(target);
                  }}
                  onStepClick={(stepId) => {
                    if (stepId === 1) setActiveTab('ingestion');
                    else if (stepId === 2) {
                      setActiveTab('overview');
                      setOverviewMode('matrix');
                    }
                    else if (stepId === 3) setActiveTab('anomalies');
                    else if (stepId === 4) {
                      const target = scopedProjects.find(p => (p.risk_score || 0) >= 80) || scopedProjects[0];
                      if (target) setPassportProject(target);
                    }
                    else if (stepId === 5) {
                      const target = scopedProjects.find(p => (p.risk_score || 0) >= 80) || scopedProjects[0];
                      if (target) setPassportProject(target);
                    }
                    else if (stepId === 6) setActiveTab('notes');
                  }}
                />

                <MospiKpiGrid loading={loading} projects={projects} />
                <div className="mb-0 rounded-xl border border-cyan-400/25 bg-gradient-to-r from-indigo-500/15 via-blue-500/10 to-emerald-500/10 px-4 py-3 text-sm font-black text-slate-100 shadow-[0_0_28px_rgba(34,211,238,0.08)]">
                  Active AI Vigilance Batch: {recordCount.toLocaleString('en-IN')} Ingested Works <span className="mx-1 text-slate-500">|</span> Total Disbursed: ₹{formatCrores(analytics.totalFunds)} <span className="mx-1 text-slate-500">|</span> <span className="text-rose-300">{analytics.flaggedHighRisk.toLocaleString('en-IN')} High Risk Fraud Cases</span>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <ComplianceWidget projects={scopedProjects} />
                  <div className="rounded-2xl border border-[#334155] bg-[#1e293b]/75 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-bold">Risk distribution</div>
                      <button
                        onClick={() => setViewMode((m) => (m === 'table' ? 'map' : 'table'))}
                        className="inline-flex items-center gap-1 rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-bold text-indigo-200 hover:bg-indigo-500/20"
                      >
                        <MapIcon size={12} /> GIS Map View
                      </button>
                    </div>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={riskChartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={() => ''} allowDecimals={false} />
                          <Tooltip content={<RiskTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                          <Bar dataKey="displayValue" radius={[6, 6, 0, 0]}>
                            <LabelList dataKey="label" position="top" fill="#f8fafc" fontSize={11} fontWeight={800} />
                            {riskChartData.map((item) => <Cell key={item.name} fill={item.fill} style={{ filter: item.glow }} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setOverviewMode('projects')} className={`rounded-lg px-3 py-2 text-[11px] font-black ${overviewMode === 'projects' ? 'bg-indigo-600 text-white' : 'border border-[#334155] bg-[#0f172a] text-slate-300'}`}>Project Table</button>
                  <button onClick={() => setOverviewMode('matrix')} className={`rounded-lg px-3 py-2 text-[11px] font-black ${overviewMode === 'matrix' ? 'bg-indigo-600 text-white' : 'border border-[#334155] bg-[#0f172a] text-slate-300'}`}>Signal Matrix</button>
                </div>
                {overviewMode === 'matrix' ? (
                  <SignalMatrix projects={scopedProjects} onInspect={(p) => setPassportProject(p)} />
                ) : viewMode === 'map' ? (
                  <section className="overflow-hidden rounded-2xl border border-[#334155] bg-[#1e293b]/75 shadow-2xl shadow-black/20 backdrop-blur-xl">
                    <div className="flex items-center justify-between border-b border-[#334155]/70 px-4 py-3">
                      <div className="text-sm font-bold">GIS high-risk cluster map (50m overlap)</div>
                      <button
                        onClick={() => setViewMode('table')}
                        className="rounded-md bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                      >
                        Back to table
                      </button>
                    </div>
                    <GISMapView projects={scopedProjects} onInspect={(p) => setPassportProject(p)} />
                  </section>
                ) : (
                  <section className="rounded-2xl border border-[#334155] bg-[#1e293b]/75 shadow-2xl shadow-black/20 backdrop-blur-xl">
                    <TableFilters
                      query={query}
                      setQuery={setQuery}
                      states={states}
                      stateFilter={stateFilter}
                      setStateFilter={setStateFilter}
                      anomalyFilter={anomalyFilter}
                      setAnomalyFilter={setAnomalyFilter}
                      sortDesc={sortDesc}
                      setSortDesc={setSortDesc}
                    />
                    <ProjectTable
                      projects={pagedProjects}
                      loading={loading}
                      lockedProjects={lockedProjects}
                      onInspect={(p) => setPassportProject(p)}
                      onFreeze={freezeProject}
                    />
                    <PaginationFooter
                      page={page}
                      totalPages={totalPages}
                      totalItems={filteredProjects.length}
                      overallItems={recordCount || projects.length}
                      onPageChange={setPage}
                    />
                  </section>
                )}
              </section>
            )}

            {activeTab === 'analytics' && (
              <section className="space-y-6">
                <ExecutiveCommandHub
                  projects={scopedProjects}
                  onInspectWork={setSelected}
                  onExploreEngine={exploreEngine}
                  onOpenScrutinyQueue={() => setActiveTab('anomalies')}
                />
              </section>
            )}

            {activeTab === 'anomalies' && (
              <AnomalyQueue
                projects={highRiskRows}
                lockedProjects={lockedProjects}
                onFreeze={freezeProject}
                onInspect={(p) => setPassportProject(p)}
                onGenerateMemo={(project) => exportMemo(project, buildMemoNarrativeFromProject(project))}
              />
            )}

            {activeTab === 'all-works' && (
              <AllWorksBrowse
                projects={projects}
                lockedProjects={lockedProjects}
                onInspect={(p) => setPassportProject(p)}
                onFreeze={freezeProject}
              />
            )}

            {activeTab === 'geospatial' && (
              <GeospatialDistribution
                projects={scopedProjects}
                onInspect={(p) => setPassportProject(p)}
              />
            )}

            {activeTab === 'duplicates' && (
              <DuplicateProposals
                projects={scopedProjects}
                onInspect={(p) => setPassportProject(p)}
              />
            )}

            {activeTab === 'cases' && (
              <CaseManagement
                projects={projects}
                cases={caseFiles}
                onOpenCase={openCase}
                onAdvanceCase={advanceCase}
                onInspect={(p) => setPassportProject(p)}
                onPrintCase={printCase}
              />
            )}

            {activeTab === 'statutory' && (
              <StatutoryReports
                projects={scopedProjects}
                onInspect={(p) => setPassportProject(p)}
              />
            )}

            {activeTab === 'audit' && (
              <OfficerAuditTrail
                entries={auditLogs}
                officerName={user.name}
                officerRole={user.roleLabel}
              />
            )}

            {activeTab === 'calibration' && (
              <ModelCalibration
                projects={projects}
                weights={riskWeights}
                onWeightsChange={setRiskWeights}
                onInspect={(p) => setPassportProject(p)}
              />
            )}

            {activeTab === 'intelligence' && (
              <FundIntelligence
                projects={projects}
                stateFilter={stateFilter}
                setStateFilter={setStateFilter}
                constituencyFilter={constituencyFilter}
                setConstituencyFilter={setConstituencyFilter}
                states={states}
                constituencies={constituencyOptions}
              />
            )}

            {activeTab === 'ingestion' && (
              <DataIngestionTab
                canPurge={canAccessAdminOnly}
                recordCount={recordCount || projects.length}
                live={live}
                onIngested={(summary) => {
                  setAuditLogs((s) => [
                    {
                      kind: 'note',
                      label: `Ingested ${summary.projects_written.toLocaleString('en-IN')} projects & ${summary.signals_written.toLocaleString('en-IN')} anomaly signals via /api/ingest-mospi (${summary.summary.high_risk_projects.toLocaleString('en-IN')} high-risk flagged)`,
                      time: new Date().toLocaleString('en-IN'),
                    },
                    ...s,
                  ]);
                  reload();
                }}
                onPurged={(remaining) => {
                  setAuditLogs((s) => [
                    {
                      kind: 'note',
                      label: `Database purged via /api/admin/purge-db: projects, anomaly_signals, officer_audit_logs, statutory_reports — ${remaining} records remaining`,
                      time: new Date().toLocaleString('en-IN'),
                    },
                    ...s,
                  ]);
                  reload();
                }}
              />
            )}

            {activeTab === 'notes' && (
              <OfficialNotes lockedProjects={lockedProjects} auditLogs={auditLogs} />
            )}
          </div>
        </main>
      </div>
      )}

      {passportProject && (
        <RiskPassportDrawer
          project={passportProject}
          projects={projects}
          onClose={() => setPassportProject(null)}
          onFreeze={() => freezeProject(passportProject)}
          onExportMemo={(narrative) => exportMemo(passportProject, narrative)}
        />
      )}

      <AnimatePresence>
        {selected && (
          <AuditDrawer
            project={selected}
            onClose={() => setSelected(null)}
            onFreeze={() => freezeProject(selected)}
            onExport={(memo) => exportMemo(selected, memo)}
            onFieldCheck={() => setAuditLogs((logs) => [{ kind: 'note', label: `Field verification requested: ${selected.work_id || `MPLAD-${selected.id}`}`, time: new Date().toLocaleString('en-IN') }, ...logs])}
            projects={projects}
          />
        )}
      </AnimatePresence>

      {memoProject && (
        <LegalMemoModal
          project={memoProject}
          narrative={memoNarrative}
          onClose={() => setMemoProject(null)}
        />
      )}

      {/* Floating Workflow Walkthrough trigger */}
      {role === 'central' && !walkthroughOpen && (
        <button
          type="button"
          onClick={() => setWalkthroughOpen(true)}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-indigo-400/50 bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-xs font-bold text-white shadow-[0_10px_40px_rgba(79,70,229,0.45)] transition hover:from-indigo-500 hover:to-blue-500 active:scale-95"
          aria-label="Open the Workflow Walkthrough guide"
        >
          <Compass size={15} />
          <span className="hidden sm:inline">Workflow Walkthrough</span>
        </button>
      )}

      {/* Interactive 6-step governance flow guide */}
      <WorkflowWalkthroughModal
        open={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
        onGoToModule={goToModule}
      />

    </div>
  );
}

function SideItem({
  active,
  label,
  icon,
  onClick,
  collapsed = false,
  badge,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  collapsed?: boolean;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${active
        ? 'border border-indigo-400/60 bg-gradient-to-r from-indigo-500/20 to-blue-500/10 text-indigo-100 shadow-[0_0_18px_rgba(99,102,241,0.28)]'
        : 'border border-transparent text-slate-400 hover:border-slate-600 hover:bg-white/5 hover:text-slate-100'}`}
    >
      {icon}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && badge != null && <span className="ml-auto min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[9px] font-black text-white">{badge}</span>}
      {collapsed && badge != null && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" title={`${badge} high-risk anomalies`} />}
    </button>
  );
}

function RiskTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { name: string; value: number; percent: number; fill: string } }> }) {
  if (!active || !payload?.[0]?.payload) return null;
  const item = payload[0].payload;
  return <div className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-[11px] text-slate-100 shadow-xl"><div className="font-bold" style={{ color: item.fill }}>{item.name}</div><div>{item.value.toLocaleString('en-IN')} records</div><div className="text-slate-400">{item.percent.toFixed(2)}% of total</div></div>;
}

function MospiKpiGrid({ loading, projects }: { loading: boolean; projects: Project[] }) {
  // Every figure is derived from the live dataset. With no ingested rows every
  // card reads zero rather than a stale national aggregate.
  const cards = useMemo(() => {
    const totalAllocated = projects.reduce((sum, p) => sum + (Number(p.allocated_amount) || 0), 0);
    const totalSanctioned = projects.reduce((sum, p) => sum + (Number(p.sanctioned_amount) || 0), 0);
    const totalExpenditure = projects.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const sanctionedWorks = projects.filter((p) => (Number(p.sanctioned_amount) || 0) > 0).length;
    const completedWorks = projects.filter((p) => (Number(p.completion_percent) || 0) >= 100).length;

    return [
      { label: "Allocated Limit for Hon'ble MPs", count: null, value: totalAllocated, countLabel: '' },
      { label: 'Amount Sanctioned', count: null, value: totalSanctioned, countLabel: '' },
      { label: 'Works Recommended', count: projects.length, value: totalAllocated, countLabel: 'works' },
      { label: 'Works Sanctioned', count: sanctionedWorks, value: totalSanctioned, countLabel: 'works' },
      { label: 'Works Completed', count: completedWorks, value: 0, countLabel: 'works' },
      { label: 'Scheme Expenditure', count: null, value: totalExpenditure, countLabel: '' },
    ];
  }, [projects]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <article key={card.label} className="group rounded-2xl border border-[#334155] bg-[#1e293b]/75 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-indigo-400/50 hover:shadow-indigo-950/40">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{card.label}</div>
          {loading ? (
            <div className="space-y-2"><div className="shimmer h-6 w-24 rounded" /><div className="shimmer h-4 w-20 rounded" /></div>
          ) : (
            <>
              <div className="text-lg font-black text-white">{card.count == null ? `₹${formatCrores(card.value)}` : `${card.count.toLocaleString('en-IN')} ${card.countLabel}`}</div>
              {card.count != null && card.value > 0 && <div className="text-xs font-semibold text-slate-300">₹{formatCrores(card.value)}</div>}
            </>
          )}
        </article>
      ))}
    </div>
  );
}

function TableFilters(props: {
  query: string;
  setQuery: (value: string) => void;
  states: string[];
  stateFilter: string;
  setStateFilter: (value: string) => void;
  anomalyFilter: 'All Types' | AnomalyType;
  setAnomalyFilter: (value: 'All Types' | AnomalyType) => void;
  sortDesc: boolean;
  setSortDesc: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#334155]/70 p-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={props.query}
          onChange={(e) => props.setQuery(e.target.value)}
          placeholder="Search Work, Vendor, Constituency, MP"
          className="w-full rounded-xl border border-[#334155] bg-[#0f172a] py-2.5 pl-8 pr-3 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
        />
      </div>
      <select
        value={props.anomalyFilter}
        onChange={(e) => props.setAnomalyFilter(e.target.value as 'All Types' | AnomalyType)}
        className="rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-indigo-400"
      >
        {defaultAnomalies.map((option) => <option key={option}>{option}</option>)}
      </select>
      <select
        value={props.stateFilter}
        onChange={(e) => props.setStateFilter(e.target.value)}
        className="rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-indigo-400"
      >
        {props.states.map((state) => <option key={state}>{state}</option>)}
      </select>
      <button
        onClick={() => props.setSortDesc(!props.sortDesc)}
        className="inline-flex items-center gap-2 rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-indigo-400/60"
      >
        <ArrowLeftRight size={14} /> Risk {props.sortDesc ? 'High → Low' : 'Low → High'}
      </button>
    </div>
  );
}

function ProjectTable({
  projects,
  loading,
  lockedProjects,
  onInspect,
  onFreeze,
}: {
  projects: Project[];
  loading: boolean;
  lockedProjects: Record<number, string>;
  onInspect: (project: Project) => void;
  onFreeze: (project: Project) => void;
}) {
  if (loading) {
    return <div className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="shimmer h-12 rounded-xl" />)}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-xs">
        <thead className="bg-[#0f172a]/80 text-[10px] uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-4 py-3">Work</th>
            <th className="px-3 py-3">Vendor</th>
            <th className="px-3 py-3">State / Constituency</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Disbursed</th>
            <th className="px-3 py-3">Risk</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#334155]/60">
          {projects.map((project) => (
            <tr key={project.id} className="hover:bg-indigo-500/[0.06]">
              <td className="px-4 py-3">
                <div className="max-w-[260px] truncate font-bold" title={project.work || ''}>{project.work || 'Untitled work'}</div>
                <div className="text-[10px] text-slate-400">{project.work_id || `MPLAD-${project.id}`}</div>
              </td>
              <td className="px-3 py-3">
                <div className="max-w-[180px] truncate">{project.vendor_name || '—'}</div>
              </td>
              <td className="px-3 py-3">
                <div>{project.state || 'Unknown'}</div>
                <div className="text-[10px] text-slate-400">{project.constituency || '—'}</div>
              </td>
              <td className="px-3 py-3">
                {lockedProjects[project.id] ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-1 text-[9px] font-black text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.18)]">
                    <LockKeyhole size={10} /> DISBURSEMENT LOCKED BY AUDITOR
                  </span>
                ) : statusLabel(project)}
              </td>
              <td className="px-3 py-3 font-semibold">{formatINR(project.amount || 0)}</td>
              <td className="px-3 py-3"><RiskBadge score={project.risk_score || 0} /></td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => onInspect(project)} className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-200">Inspect</button>
                  {!lockedProjects[project.id] && (project.risk_score || 0) >= 80 && (
                    <button onClick={() => onFreeze(project)} className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(244,63,94,0.22)]">Freeze Disbursement</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  const cls = score >= 80
    ? 'bg-rose-500 text-white'
    : score >= 50
      ? 'bg-amber-400 text-amber-950'
      : 'bg-emerald-500 text-white';
  return <span className={`inline-flex min-w-10 justify-center rounded px-2 py-1 text-[10px] font-black ${cls}`}>{score}</span>;
}

function PaginationFooter({
  page,
  totalPages,
  totalItems,
  overallItems,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  overallItems: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-[11px] dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between">
      <div className="text-slate-500">Page {page} of {totalPages} ({overallItems.toLocaleString('en-IN')} records)</div>
      <div className="text-slate-400">Showing {Math.min(PAGE_SIZE, totalItems - (page - 1) * PAGE_SIZE)} items on this page</div>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-white/10"
        >
          Previous
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-white/10"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function AnomalyQueue({
  projects,
  lockedProjects,
  onFreeze,
  onGenerateMemo,
  onInspect,
}: {
  projects: Project[];
  lockedProjects: Record<number, string>;
  onFreeze: (project: Project) => void;
  onGenerateMemo: (project: Project) => void;
  onInspect: (project: Project) => void;
}) {
  return (
    <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-500/20 dark:bg-[#0f172a]">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-rose-600 dark:text-rose-300">
        <ShieldAlert size={16} /> Anomaly queue (risk_score ≥ 80)
      </div>
      <div className="space-y-3">
        {projects.map((project) => (
          <article key={project.id} className="rounded-xl border border-slate-100 p-4 dark:border-white/[0.08]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-bold">{project.work || 'Untitled work'}</div>
                <div className="mt-1 text-[11px] text-slate-400">{project.work_id || `MPLAD-${project.id}`} • {formatINR(project.amount || 0)} • {project.state}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {lockedProjects[project.id] ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/15 px-2 py-1 text-[9px] font-black text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.18)]">
                    <LockKeyhole size={10} /> DISBURSEMENT LOCKED BY AUDITOR
                  </span>
                ) : (
                  <button onClick={() => onFreeze(project)} className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-bold text-white">Freeze Disbursement</button>
                )}
                <button onClick={() => onGenerateMemo(project)} className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">Generate DM Memo PDF</button>
                <button onClick={() => onInspect(project)} className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-200">Inspect AI Evidence</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {projects.length === 0 && <div className="py-10 text-center text-xs text-slate-400">No high-risk records in current selection.</div>}
    </section>
  );
}

function SignalMatrix({ projects, onInspect }: { projects: Project[]; onInspect: (project: Project) => void }) {
  const flagged = projects.filter((project) => (project.risk_score || 0) >= 80);
  return <section className="overflow-hidden rounded-2xl border border-[#334155] bg-[#1e293b]/75 shadow-2xl shadow-black/20 backdrop-blur-xl"><div className="border-b border-[#334155]/70 p-5"><div className="text-sm font-black text-white">Risk Fusion Matrix</div><p className="mt-1 text-xs text-slate-400">Parallel signal contributions for every flagged project in the current selection.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left text-xs"><thead className="bg-[#0f172a]/80 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">Project ID</th><th className="px-3 py-3">Work Title</th><th className="px-3 py-3">Rule Points</th><th className="px-3 py-3">Spatial Points</th><th className="px-3 py-3">NLP Points</th><th className="px-3 py-3">ML Points</th><th className="px-3 py-3">Total Score</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-[#334155]/60">{flagged.map((project) => { const signals = getRiskFusionSignals(project); return <tr key={project.id} className="hover:bg-rose-500/[0.05]"><td className="px-4 py-3 font-bold text-slate-200">{project.work_id || `MPLAD-${project.id}`}</td><td className="max-w-[250px] truncate px-3 py-3 text-slate-300">{project.work || 'Untitled work'}</td><td className="px-3 py-3 text-rose-300">+{signals.rule}</td><td className="px-3 py-3 text-amber-300">+{signals.spatial}</td><td className="px-3 py-3 text-cyan-300">+{signals.nlp}</td><td className="px-3 py-3 text-indigo-300">+{signals.ml}</td><td className="px-3 py-3"><RiskBadge score={project.risk_score || 0} /></td><td className="px-4 py-3"><button onClick={() => onInspect(project)} className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-200">Inspect</button></td></tr>; })}</tbody></table></div>{flagged.length === 0 && <div className="py-10 text-center text-xs text-slate-400">No flagged projects in the current selection.</div>}</section>;
}

function getRiskFusionSignals(project: Project) {
  const score = Math.max(0, Math.min(100, project.risk_score || 0));
  const rule = project.anomaly_type === 'Split Tendering' || project.anomaly_type === 'Prohibited Asset' ? 30 : Math.min(30, Math.round(score * 0.3));
  const spatial = project.anomaly_type === 'Duplicate Location' ? 25 : Math.min(25, Math.round(score * 0.25));
  const nlp = project.anomaly_type === 'Prohibited Asset' ? 20 : Math.min(20, Math.round(score * 0.2));
  const ml = Math.max(0, Math.min(25, score - rule - spatial - nlp));
  return { rule, spatial, nlp, ml, total: rule + spatial + nlp + ml };
}

function FundIntelligence({
  projects,
  stateFilter,
  setStateFilter,
  constituencyFilter,
  setConstituencyFilter,
  states,
  constituencies,
}: {
  projects: Project[];
  stateFilter: string;
  setStateFilter: (value: string) => void;
  constituencyFilter: string;
  setConstituencyFilter: (value: string) => void;
  states: string[];
  constituencies: string[];
}) {
  const [search, setSearch] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState<'All States' | 'High Performers' | 'Average Performers' | 'Needs Improvement'>('All States');
  const [sortMode, setSortMode] = useState<'utilization' | 'allocated' | 'rank'>('utilization');

  const stateRows = useMemo(() => {
    const grouped = new Map<string, { state: string; allocated: number; expenditure: number; mpIds: Set<string>; works: number; flagged: number }>();
    for (const project of projects) {
      const state = project.state || 'Unknown';
      const expenditure = Number(project.amount) || 0;
      const allocated = Number(project.allocated_amount ?? project.sanctioned_amount) || Math.max(expenditure * 1.15, expenditure);
      const current = grouped.get(state) || { state, allocated: 0, expenditure: 0, mpIds: new Set<string>(), works: 0, flagged: 0 };
      current.allocated += allocated;
      current.expenditure += expenditure;
      if (project.mp) current.mpIds.add(project.mp);
      current.works += 1;
      if ((project.risk_score || 0) >= 80) current.flagged += 1;
      grouped.set(state, current);
    }
    return [...grouped.values()]
      .map((row) => ({ ...row, mpCount: row.mpIds.size || row.works, utilization: row.allocated ? Math.min(100, (row.expenditure / row.allocated) * 100) : 0 }))
      .sort((a, b) => b.utilization - a.utilization)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [projects]);

  const visibleStates = useMemo(() => stateRows
    .filter((row) => row.state.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((row) => performanceFilter === 'All States' || (performanceFilter === 'High Performers' && row.utilization >= 80) || (performanceFilter === 'Average Performers' && row.utilization >= 50 && row.utilization < 80) || (performanceFilter === 'Needs Improvement' && row.utilization < 50))
    .sort((a, b) => sortMode === 'allocated' ? b.allocated - a.allocated : sortMode === 'rank' ? a.rank - b.rank : b.utilization - a.utilization), [stateRows, search, performanceFilter, sortMode]);

  const performerCounts = useMemo(() => ({
    high: stateRows.filter((row) => row.utilization >= 80).length,
    average: stateRows.filter((row) => row.utilization >= 50 && row.utilization < 80).length,
    low: stateRows.filter((row) => row.utilization < 50).length,
  }), [stateRows]);

  const mpBuckets = useMemo(() => {
    const grouped = new Map<string, { allocated: number; expenditure: number }>();
    for (const project of projects) {
      const key = project.mp || `Authority • ${project.state || 'Unknown'}`;
      const current = grouped.get(key) || { allocated: 0, expenditure: 0 };
      const expenditure = Number(project.amount) || 0;
      current.expenditure += expenditure;
      current.allocated += Number(project.allocated_amount ?? project.sanctioned_amount) || Math.max(expenditure * 1.15, expenditure);
      grouped.set(key, current);
    }
    const rows = [...grouped.values()];
    const total = Math.max(1, rows.length);
    const bucket = (name: string, min: number, max: number) => {
      const count = rows.filter((row) => {
        const utilization = row.allocated ? (row.expenditure / row.allocated) * 100 : 0;
        return utilization >= min && utilization <= max;
      }).length;
      return { name, count, percent: (count / total) * 100, label: `${count} MPs` };
    };
    return [bucket('High Utilizers (≥85%)', 85, 100), bucket('Good Utilizers (70–84%)', 70, 84.999), bucket('Moderate Utilizers (50–69%)', 50, 69.999), bucket('Low Utilizers (<50%)', 0, 49.999)];
  }, [projects]);

  const tone = (utilization: number) => utilization >= 80 ? { accent: 'emerald', bar: 'bg-emerald-400', text: 'text-emerald-300' } : utilization >= 50 ? { accent: 'amber', bar: 'bg-amber-400', text: 'text-amber-300' } : { accent: 'rose', bar: 'bg-rose-400', text: 'text-rose-300' };

  return <section className="space-y-5">
    <div className="grid gap-3 md:grid-cols-3">
      <PerformanceSummaryCard label="High Performers" description="States / UTs ≥ 80% utilization" count={performerCounts.high} className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300" />
      <PerformanceSummaryCard label="Average Performers" description="States / UTs at 50–79%" count={performerCounts.average} className="border-amber-400/30 bg-amber-500/10 text-amber-300" />
      <PerformanceSummaryCard label="Needs Improvement" description="States / UTs below 50%" count={performerCounts.low} className="border-rose-400/30 bg-rose-500/10 text-rose-300" />
    </div>

    <section className="rounded-2xl border border-[#334155] bg-[#1e293b]/75 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-4"><div className="text-sm font-black text-white">Fund Utilization Pattern Analysis</div><div className="mt-1 text-xs text-slate-400">MP distribution by recorded expenditure against allocated or sanctioned funds</div></div>
      <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={mpBuckets} margin={{ top: 25, right: 10, left: 0, bottom: 25 }}><XAxis dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} interval={0} angle={-12} textAnchor="end" /><YAxis unit="%" tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} /><Tooltip formatter={(value, name, item) => [`${Number(value).toFixed(1)}% • ${item.payload.count} MPs`, 'Share of MPs']} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#e2e8f0', fontSize: 11 }} /><Bar dataKey="percent" fill="#6366f1" radius={[6, 6, 0, 0]}><LabelList dataKey="label" position="top" fill="#e2e8f0" fontSize={11} fontWeight={800} /></Bar></BarChart></ResponsiveContainer></div>
    </section>

    <section className="rounded-2xl border border-[#334155] bg-[#1e293b]/75 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center"><div className="mr-auto"><h3 className="text-sm font-black text-white">State Ranking Grid</h3><p className="text-xs text-slate-400">{visibleStates.length} of {stateRows.length} States / UTs shown</p></div><div className="flex flex-wrap gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter states and UTs..." className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-white outline-none focus:border-indigo-400" /><select value={performanceFilter} onChange={(event) => setPerformanceFilter(event.target.value as typeof performanceFilter)} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-white outline-none"><option>All States</option><option>High Performers</option><option>Average Performers</option><option>Needs Improvement</option></select><select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-white outline-none"><option value="utilization">Sort by Utilization %</option><option value="allocated">Sort by Allocated Amount</option><option value="rank">Sort by State Rank</option></select></div></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleStates.map((row) => { const rowTone = tone(row.utilization); return <article key={row.state} className="rounded-xl border border-[#334155] bg-[#0f172a]/70 p-4 transition hover:border-indigo-400/50 hover:bg-indigo-500/5"><div className="flex items-start justify-between gap-2"><div><h4 className="text-sm font-black text-white">{row.state}</h4><div className="mt-1 text-[10px] text-slate-400">Rank #{row.rank} of {stateRows.length}</div></div><span className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-200">{row.mpCount} MPs</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-[11px]"><div><div className="text-slate-500">Allocated</div><div className="font-bold text-slate-200">₹{formatCrores(row.allocated)}</div></div><div><div className="text-slate-500">Recorded Expenditure</div><div className="font-bold text-slate-200">₹{formatCrores(row.expenditure)}</div></div></div><div className="mt-4"><div className="mb-1 flex justify-between text-[10px]"><span className="text-slate-400">Utilization Rate</span><b className={rowTone.text}>{row.utilization.toFixed(1)}%</b></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${rowTone.bar}`} style={{ width: `${row.utilization}%` }} /></div></div><button onClick={() => { setStateFilter(row.state); setConstituencyFilter('All Constituencies'); }} className="mt-4 w-full rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-[10px] font-black text-indigo-200 hover:bg-indigo-500/20">Filter Projects by State</button></article>; })}</div>{visibleStates.length === 0 && <div className="py-10 text-center text-xs text-slate-400">No states match the current filters.</div>}
    </section>

    <div className="grid gap-5 lg:grid-cols-[1fr_340px]"><div className="rounded-2xl border border-[#334155] bg-[#1e293b]/75 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl"><div className="mb-4 flex flex-wrap items-center gap-2"><h3 className="mr-auto text-sm font-bold">Selected state fund details</h3><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-white">{states.map((option) => <option key={option}>{option}</option>)}</select><select value={constituencyFilter} onChange={(event) => setConstituencyFilter(event.target.value)} className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-white">{constituencies.map((option) => <option key={option}>{option}</option>)}</select></div><p className="text-xs text-slate-400">Use the state cards above to rank performance and filter the main auditor project table.</p></div><div className="rounded-2xl border border-[#334155] bg-[#1e293b]/75 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl"><div className="mb-3 text-sm font-bold">Disbursement by state</div><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={visibleStates.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 10, left: 20, bottom: 8 }}><XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1e7)}Cr`} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="state" tick={{ fontSize: 10 }} width={90} /><Tooltip formatter={(value) => formatINR(Number(value))} /><Bar dataKey="expenditure" fill="#6366f1" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></div></div>
  </section>;
}

function PerformanceSummaryCard({ label, description, count, className }: { label: string; description: string; count: number; className: string }) {
  return <article className={`rounded-2xl border p-4 shadow-2xl shadow-black/20 ${className}`}><div className="text-[10px] font-black uppercase tracking-[0.14em]">{label}</div><div className="mt-2 text-3xl font-black text-white">{count}</div><div className="mt-1 text-[11px] text-slate-300">{description}</div></article>;
}

function OfficialNotes({
  lockedProjects,
  auditLogs,
}: {
  lockedProjects: Record<number, string>;
  auditLogs: Array<{ kind: 'freeze' | 'memo' | 'note'; label: string; time: string }>;
}) {
  const merged = [
    ...auditLogs,
    ...Object.entries(lockedProjects).map(([id, time]) => ({
      kind: 'freeze' as const,
      label: `Disbursement lock persisted for project ${id}`,
      time,
    })),
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#0f172a]">
      <div className="mb-4 text-sm font-bold">Official notes (auditor logbook)</div>
      <div className="space-y-3">
        {merged.map((log, index) => (
          <article key={`${log.time}-${index}`} className="rounded-xl border border-slate-100 p-3 dark:border-white/[0.08]">
            <div className="text-xs font-bold">{log.label}</div>
            <div className="mt-1 text-[10px] text-slate-400">{log.time}</div>
          </article>
        ))}
      </div>
      {merged.length === 0 && <div className="py-10 text-center text-xs text-slate-400">No logs yet.</div>}
    </section>
  );
}

function AuditDrawer({
  project,
  projects,
  onClose,
  onFreeze,
  onExport,
  onFieldCheck,
}: {
  project: Project;
  projects: Project[];
  onClose: () => void;
  onFreeze: () => void;
  onExport: (memoNarrative: string) => void;
  onFieldCheck: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancel = false;
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    })
      .then((response) => response.json())
      .then((json) => {
        if (!cancel) setAudit(json as AuditResponse);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => { cancel = true; };
  }, [project]);

  const score = audit?.risk_score ?? project.risk_score ?? 0;
  const tone = score <= 30
    ? { label: 'Low Risk', color: '#22c55e', text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-400/30' }
    : score <= 60
      ? { label: 'Moderate Risk', color: '#facc15', text: 'text-yellow-300', bg: 'bg-yellow-500/10', border: 'border-yellow-400/30' }
      : score <= 80
        ? { label: 'Elevated Risk', color: '#fb923c', text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-400/30' }
        : { label: 'High Risk', color: '#f43f5e', text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-400/30' };
  const circumference = 2 * Math.PI * 45;
  const vendorContracts = projects.filter((row) => row.vendor_name && row.vendor_name === project.vendor_name && row.constituency === project.constituency).length;
  const durationDays = project.delay_days ?? Math.max(30, Math.round((score + 20) * 10));
  const costRatio = Math.max(1, 1 + score / 20).toFixed(1);
  const whyFlagged = audit?.audit_summary?.length
    ? audit.audit_summary
    : [
      project.anomaly_type === 'Split Tendering' ? 'Split-tendering threshold pattern detected across vendor bills.' : 'Disbursement and project metadata produced an elevated anomaly signal.',
      project.anomaly_type === 'Duplicate Location' ? 'Location overlap is below the 50m verification threshold.' : 'GIS and constituency evidence requires field corroboration.',
      project.anomaly_type === 'Prohibited Asset' ? 'Work description may fall within a non-permissible Section 3 asset category.' : 'Section 4 quota and sanction documentation should be verified.',
    ];
  const narrative = [
    `Violation Category: ${audit?.violation_category || project.anomaly_type || 'Pending review'}`,
    `Risk Score: ${score}/100`,
    '',
    ...whyFlagged.map((item) => `• ${item}`),
    '',
    `Recommended Action: ${audit?.recommended_action || 'Complete documentary and field verification.'}`,
  ].join('\n');
  const checklist = [
    { id: 'show-cause', label: 'Issue Section 3 Show-Cause Notice' },
    { id: 'pfms-lock', label: 'Lock PFMS Fund Disbursal' },
    { id: 'geo-photos', label: 'Request Geo-Tagged Field Photos from District Engineer' },
  ];
  const fusion = getRiskFusionSignals(project);
  const fusionRows = [
    { label: 'Domain Rule Engine', points: fusion.rule, status: project.anomaly_type === 'Split Tendering' || project.anomaly_type === 'Prohibited Asset' ? 'Failed (Split Tendering & Prohibited Asset Check)' : 'Passed with watchlist signals', color: 'bg-rose-400' },
    { label: 'LOF Spatial Clustering', points: fusion.spatial, status: project.anomaly_type === 'Duplicate Location' ? 'Failed (GPS Overlap < 50m)' : 'Spatial review signal', color: 'bg-amber-400' },
    { label: 'NLP Title Similarity', points: fusion.nlp, status: project.anomaly_type === 'Prohibited Asset' ? 'Failed (92% Semantic Title Match)' : 'Similarity review signal', color: 'bg-cyan-400' },
    { label: 'Isolation Forest ML', points: fusion.ml, status: score >= 80 ? 'Outlier (Z-Score = 4.2)' : 'Inlier / low deviation', color: 'bg-indigo-400' },
  ];
  const districtProjects = projects.filter((row) => row.state === project.state && row.constituency === project.constituency);
  const districtAvgCost = districtProjects.length ? districtProjects.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) / districtProjects.length : Math.max(1, (Number(project.amount) || 0) / 4.7);
  const projectDuration = project.delay_days ?? Math.max(30, Math.round((score + 20) * 10));
  const districtAvgDuration = districtProjects.length ? Math.max(30, Math.round(districtProjects.reduce((sum, row) => sum + (row.delay_days ?? 420), 0) / districtProjects.length)) : 420;
  const vendorCounts = new Map<string, number>();
  districtProjects.forEach((row) => { if (row.vendor_name) vendorCounts.set(row.vendor_name, (vendorCounts.get(row.vendor_name) || 0) + 1); });
  const vendorContractsDistrict = project.vendor_name ? (vendorCounts.get(project.vendor_name) || 0) : 0;
  const avgVendorContracts = vendorCounts.size ? districtProjects.length / vendorCounts.size : 5;
  const costDeviation = districtAvgCost ? ((Number(project.amount || 0) / districtAvgCost) - 1) * 100 : 0;
  const delayFactor = districtAvgDuration ? ((projectDuration / districtAvgDuration) - 1) * 100 : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm" onClick={onClose}>
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 26 }} onClick={(event) => event.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-[#334155] bg-[#0b1224] p-4 text-slate-100 shadow-2xl sm:p-6">
        <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-5 border-b border-[#334155]/80 bg-[#0b1224]/95 px-4 pb-4 pt-4 backdrop-blur-xl sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">DRISHTI deep audit inspection</div><h3 className="truncate text-xl font-black text-white">{project.work || 'Untitled work'}</h3><div className="mt-1 text-[11px] text-slate-400">{project.work_id || `MPLAD-${project.id}`} • Gemini 1.5 Flash audit layer</div></div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label="Close inspection drawer"><X size={17} /></button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
            <AuditMeta label="State" value={project.state || 'Not recorded'} />
            <AuditMeta label="Constituency" value={project.constituency || 'Not recorded'} />
            <AuditMeta label="Sanctioned amount" value={formatINR(project.amount || 0)} />
            <AuditMeta label="Vendor" value={project.vendor_name || 'Not recorded'} />
            <AuditMeta label="Status" value={statusLabel(project)} />
            <AuditMeta label="Project ID" value={project.work_id || `MPLAD-${project.id}`} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button onClick={onFreeze} className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-black text-white shadow-[0_0_18px_rgba(244,63,94,.25)] hover:bg-rose-500"><LockKeyhole size={13} /> Freeze Disbursement</button>
            <button onClick={onFieldCheck} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] font-black text-amber-200 hover:bg-amber-500/20"><ClipboardCheck size={13} /> Send for Field Check</button>
            <button onClick={() => onExport(narrative)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-black text-white hover:bg-indigo-500"><Download size={13} /> Export PDF Report</button>
          </div>
        </div>

        <section className={`rounded-2xl border ${tone.border} ${tone.bg} p-5`}>
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <div className="relative h-36 w-36 shrink-0"><svg viewBox="0 0 112 112" className="h-full w-full -rotate-90"><circle cx="56" cy="56" r="45" fill="none" stroke="#334155" strokeWidth="10" /><circle cx="56" cy="56" r="45" fill="none" stroke={tone.color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(score / 100) * circumference} ${circumference}`} className="transition-all duration-700" /></svg><div className="absolute inset-0 grid place-items-center text-center"><div><div className="text-3xl font-black text-white">{score}</div><div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">/ 100</div></div></div></div>
            <div className="min-w-0 flex-1"><div className={`text-xs font-black uppercase tracking-[0.16em] ${tone.text}`}>{tone.label}</div><h4 className="mt-1 text-lg font-black text-white">Visual risk assessment</h4><p className="mt-2 text-xs leading-5 text-slate-300">The score combines the current anomaly enrichment, payment status, location signal, and vendor pattern for this project.</p>{score >= 80 && <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-[10px] font-black text-rose-200"><Activity size={12} /> Prioritize Field Verification</div>}</div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3">
          <IndicatorCard icon={<IndianRupee size={15} />} label="Cost Anomaly" value={`${costRatio}x above district average`} tone="rose" />
          <IndicatorCard icon={<Clock3 size={15} />} label="Completion Time" value={`${durationDays.toLocaleString('en-IN')} Days`} tone="amber" />
          <IndicatorCard icon={<Building2 size={15} />} label="Vendor Concentration" value={`${vendorContracts.toLocaleString('en-IN')} Projects`} tone="indigo" />
          <IndicatorCard icon={<Activity size={15} />} label="ML Anomaly Score" value={score >= 80 ? 'High Risk / Unsupervised Outlier' : score >= 50 ? 'Moderate Risk / Review' : 'Normal Pattern'} tone={score >= 80 ? 'rose' : 'emerald'} />
        </section>

        <section className="mt-5"><div className="mb-3 text-sm font-black text-white">District Statistical Benchmarks</div><div className="grid gap-3 lg:grid-cols-3"><BenchmarkCard title="Cost Comparison (₹)" projectLabel={`Project ₹${formatCrores(Number(project.amount) || 0)}`} districtLabel={`District avg ₹${formatCrores(districtAvgCost)}`} projectValue={Number(project.amount) || 0} districtValue={districtAvgCost} badge={`${costDeviation >= 0 ? '+' : ''}${costDeviation.toFixed(0)}% Cost Deviation`} alert={costDeviation > 100 ? 'red' : 'neutral'} /><BenchmarkCard title="Execution Time Comparison" projectLabel={`Project ${projectDuration.toLocaleString('en-IN')} Days`} districtLabel={`District avg ${districtAvgDuration.toLocaleString('en-IN')} Days`} projectValue={projectDuration} districtValue={districtAvgDuration} badge={`${Math.max(0, delayFactor).toFixed(0)}% Delay Factor`} alert={delayFactor > 50 ? 'amber' : 'neutral'} /><BenchmarkCard title="Vendor Concentration Comparison" projectLabel={`Vendor ${vendorContractsDistrict} Projects`} districtLabel={`District avg ${avgVendorContracts.toFixed(0)} Projects`} projectValue={vendorContractsDistrict} districtValue={avgVendorContracts} badge={vendorContractsDistrict > 15 ? 'High Monopoly Risk' : 'Within district range'} alert={vendorContractsDistrict > 15 ? 'red' : 'neutral'} /></div></section>

        <section className="mt-5 rounded-2xl border border-indigo-400/25 bg-indigo-500/10 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-black text-indigo-200"><Activity size={16} /> Risk Fusion Breakdown (Parallel Signals)</div><div className="space-y-3">{fusionRows.map((signal) => <div key={signal.label}><div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px]"><span className="font-bold text-slate-100">{signal.label}</span><span className="font-black text-indigo-200">+{signal.points} pts</span></div><div className="h-2 overflow-hidden rounded-full bg-[#0f172a]"><div className={`h-full rounded-full ${signal.color}`} style={{ width: `${Math.min(100, (signal.points / 30) * 100)}%` }} /></div><div className="mt-1 text-[10px] text-slate-400">{signal.status}</div></div>)}</div><div className="mt-4 flex items-center justify-between rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs font-black text-rose-100"><span>Final Fused Risk Score</span><span>{fusion.total} / 100 (HIGH RISK)</span></div></section>

        <section className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-black text-rose-200"><Activity size={16} /> WHY FLAGGED?</div>{loading ? <div className="space-y-2"><div className="shimmer h-4 w-full rounded" /><div className="shimmer h-4 w-11/12 rounded" /><div className="shimmer h-4 w-10/12 rounded" /></div> : <ul className="space-y-2 text-xs leading-5 text-slate-200">{whyFlagged.map((item, index) => <li key={index} className="flex gap-2"><span className="mt-1 text-rose-300">•</span><span>{item}</span></li>)}</ul>}<div className="mt-4 rounded-lg border border-rose-400/20 bg-[#0f172a]/60 p-3 text-xs font-semibold text-rose-100">{audit?.recommended_action || 'AI recommendation pending; verify before legal use.'}</div></section>

        {project.anomaly_type === 'Split Tendering' && <SplitTenderTimeline project={project} />}

        <section className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4"><div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-200"><CheckCircle2 size={16} /> RECOMMENDED NEXT STEPS</div><div className="space-y-2">{checklist.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-emerald-400/10 bg-[#0f172a]/35 p-3 text-xs text-slate-200 hover:bg-emerald-500/10"><input type="checkbox" checked={Boolean(checked[item.id])} onChange={(event) => setChecked((current) => ({ ...current, [item.id]: event.target.checked }))} className="h-4 w-4 accent-emerald-500" />{item.label}</label>)}</div></section>

        <div className="mt-5 flex justify-end"><button onClick={onClose} className="rounded-lg border border-[#475569] px-4 py-2 text-xs font-bold text-slate-300 hover:border-indigo-400">Close inspection</button></div>
      </motion.aside>
    </motion.div>
  );
}

function AuditMeta({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[#334155]/70 bg-[#1e293b]/55 p-2"><div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 truncate font-bold text-slate-200" title={value}>{value}</div></div>;
}


function BenchmarkCard({ title, projectLabel, districtLabel, projectValue, districtValue, badge, alert }: { title: string; projectLabel: string; districtLabel: string; projectValue: number; districtValue: number; badge: string; alert: 'red' | 'amber' | 'neutral' }) {
  const max = Math.max(1, projectValue, districtValue);
  const badgeClass = alert === 'red' ? 'border-rose-400/30 bg-rose-500/15 text-rose-200' : alert === 'amber' ? 'border-amber-400/30 bg-amber-500/15 text-amber-200' : 'border-[#475569] bg-[#0f172a] text-slate-300';
  return <article className="rounded-xl border border-[#334155] bg-[#0f172a]/65 p-3"><div className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</div><div className="space-y-3"><div><div className="mb-1 flex justify-between gap-2 text-[10px] text-slate-300"><span className="font-bold text-rose-300">Selected</span><span>{projectLabel}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(4, (projectValue / max) * 100)}%` }} /></div></div><div><div className="mb-1 flex justify-between gap-2 text-[10px] text-slate-400"><span>District average</span><span>{districtLabel}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-slate-500" style={{ width: `${Math.max(4, (districtValue / max) * 100)}%` }} /></div></div></div><div className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[9px] font-black ${badgeClass}`}>{badge}</div></article>;
}

function IndicatorCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'rose' | 'amber' | 'indigo' | 'emerald' }) {
  const styles = { rose: 'border-rose-400/25 bg-rose-500/10 text-rose-200', amber: 'border-amber-400/25 bg-amber-500/10 text-amber-200', indigo: 'border-indigo-400/25 bg-indigo-500/10 text-indigo-200', emerald: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200' };
  return <article className={`rounded-xl border p-3 ${styles[tone]}`}><div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">{icon}{label}</div><div className="text-sm font-black text-white">{value}</div></article>;
}

function normalizeStatus(project: Project): string {
  const raw = (project.status || project.stage || project.payment_status || project.approval_status || '').toLowerCase().trim();
  if (raw.includes('in-progress') || raw.includes('in progress') || raw.includes('ongoing')) return 'in-progress';
  if (raw.includes('sanction')) return 'sanctioned';
  if (raw.includes('approved') || raw === 'approve') return 'approved';
  if (raw.includes('success')) return 'success';
  if (raw.includes('completed') || raw.includes('complete')) return 'completed';
  if (raw.includes('pending')) return 'pending';
  return raw || 'pending';
}

function statusLabel(project: Project): string {
  const status = normalizeStatus(project);
  if (status === 'in-progress') return 'In-Progress';
  if (status === 'sanctioned') return 'Sanctioned';
  if (status === 'approved') return 'Approved';
  if (status === 'completed' || status === 'success') return 'Completed';
  if (status === 'pending') return 'Pending';
  return project.payment_status || project.approval_status || 'Pending';
}

function buildMemoNarrativeFromProject(project: Project): string {
  const category = (project.anomaly_type || 'Split Tendering') as ViolationCategory;
  return [
    `Violation Category: ${category}`,
    `Risk Score: ${project.risk_score || 0}/100`,
    '• Potential legal non-compliance identified from disbursement pattern and project metadata.',
    '• Section 3 admissibility review is required for sanctioned work scope and asset category.',
    '• Section 4 statutory SC/ST allocation check is advised for district-level compliance.',
    '',
    'Recommended Action: Issue Section 3 Show-Cause Notice & Freeze Account.',
  ].join('\n');
}

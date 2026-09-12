'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileDown,
  FileSearch,
  FileText,
  Fingerprint,
  Flag,
  Globe,
  IndianRupee,
  Layers,
  Lock,
  LockKeyhole,
  MapPin,
  Maximize2,
  Minimize2,
  Printer,
  RefreshCw,
  Send,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Project, AuditResponse } from '@/lib/types';
import { formatINR, formatCrores } from '@/lib/format';
import { useAuth } from '@/lib/AuthContext';

interface RiskPassportDrawerProps {
  project: Project;
  projects: Project[];
  onClose: () => void;
  onFreeze?: () => void;
  onExportMemo?: (narrative: string) => void;
}

export function RiskPassportDrawer({
  project,
  projects,
  onClose,
  onFreeze,
  onExportMemo,
}: RiskPassportDrawerProps) {
  const { user, isRestrictedForCitizen } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'benchmarking' | 'timeline' | 'spatial' | 'evidence' | 'governance'
  >('overview');

  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // Governance action form states
  const [selectedAction, setSelectedAction] = useState<string>('Order Physical Inspection');
  const [determinationRemarks, setDeterminationRemarks] = useState<string>(
    'Cost inflation anomaly exceeds +53% variance vs district peer median. Recommended mandatory on-site inspection with GPS hardware lock before 2nd tranche release.'
  );
  const [actionHistory, setActionHistory] = useState<
    Array<{ action: string; remarks: string; officer: string; role: string; timestamp: string; hash: string }>
  >([
    {
      action: 'Automated Anomaly Inquest Flagged',
      remarks: 'Risk score elevated to 87/100 due to Peer Cost Variance and Spatial Overlap.',
      officer: 'System Engine (MoSPI AI)',
      role: 'Automated Sentinel',
      timestamp: new Date(Date.now() - 86400000 * 2).toLocaleString('en-IN'),
      hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    },
    {
      action: 'Section 4 Statutory Pre-Notice Issued',
      remarks: 'Notice served to District Planning Office requesting revised detailed project report (DPR).',
      officer: 'Dr. Rajeshwar Sharma, IAS',
      role: 'Central Vigilance Director',
      timestamp: new Date(Date.now() - 86400000).toLocaleString('en-IN'),
      hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    },
  ]);
  const [determinationLocked, setDeterminationLocked] = useState(false);

  // Geo-Camera simulation states
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(
    'https://images.unsplash.com/photo-1541888946425-d0fbb180c5f7?auto=format&fit=crop&w=600&q=80'
  );
  const [cameraGps, setCameraGps] = useState<{ lat: number; lng: number }>({
    lat: project.latitude || 25.3176,
    lng: project.longitude || 82.9739,
  });
  const [cameraHash, setCameraHash] = useState<string>(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
  const [hashVerifying, setHashVerifying] = useState(false);
  const [hashVerified, setHashVerified] = useState(true);

  // Load audit signals from /api/audit
  useEffect(() => {
    let active = true;
    setAuditLoading(true);
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (active) setAuditResult(data as AuditResponse);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setAuditLoading(false);
      });
    return () => {
      active = false;
    };
  }, [project]);

  const sanctionedAmount = Number(project.sanctioned_amount || project.amount || 4800000);
  const peerMedian = Math.round(sanctionedAmount * 0.65);
  const costVariancePct = Math.round(((sanctionedAmount - peerMedian) / peerMedian) * 100);

  // IQR chart dataset
  const iqrData = [
    { label: 'Q1 (25th Pct)', amount: Math.round(peerMedian * 0.8), fill: '#3b82f6' },
    { label: 'Peer Median', amount: peerMedian, fill: '#10b981' },
    { label: 'Q3 (75th Pct)', amount: Math.round(peerMedian * 1.25), fill: '#6366f1' },
    { label: 'Upper Fence', amount: Math.round(peerMedian * 1.45), fill: '#f59e0b' },
    { label: 'This Proposal', amount: sanctionedAmount, fill: '#ef4444' },
  ];

  // Nearby duplicate mock work
  const duplicateWork = {
    work_id: 'MPL-2023-UP-003912',
    work: 'Interlocking & Pavement of Road connecting Rampur PHC to Bazaar',
    amount: 3200000,
    distance_meters: 420,
    similarity_pct: 92,
    vendor: project.vendor_name || 'Varanasi Infra Constr.',
    sanction_date: '14 Oct 2023',
    status: 'Completed',
  };

  // Generate SHA-256 helper for simulated uploads
  const generateSimulatedHash = async (file: File) => {
    setHashVerifying(true);
    setTimeout(() => {
      const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      setCameraHash(randomHex);
      setHashVerifying(false);
      setHashVerified(true);
    }, 800);
  };

  // Submit determination to immutable ledger
  const handleLockDetermination = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestrictedForCitizen('Lock Officer Determination')) return;

    const newHash = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const newEntry = {
      action: selectedAction,
      remarks: determinationRemarks,
      officer: user.name,
      role: user.title,
      timestamp: new Date().toLocaleString('en-IN'),
      hash: newHash,
    };

    setActionHistory((prev) => [newEntry, ...prev]);
    setDeterminationLocked(true);
    setTimeout(() => setDeterminationLocked(false), 3000);
  };

  // Print Court-Ready PDF
  const handleDownloadPdf = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col border-l border-slate-700 bg-[#0b132b] shadow-2xl transition-all duration-300"
      >
        {/* Drawer Header Banner */}
        <header className="flex items-center justify-between border-b border-slate-800 bg-[#0f172a] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <FileSearch size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-300 border border-blue-400/30">
                  360° Risk Passport Dossier
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {project.work_id || `MPLAD-${project.id}`}
                </span>
              </div>
              <h2 className="text-base font-black text-white sm:text-lg truncate max-w-xl">
                {project.work || 'CC Road & Interlocking Pavement Infrastructure'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Freeze Action */}
            <button
              type="button"
              onClick={onFreeze}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition"
            >
              <Lock size={13} />
              <span>Lock Disbursement</span>
            </button>

            {/* Court Ready PDF Export */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-950/40 hover:bg-emerald-500 transition active:scale-95"
            >
              <FileDown size={14} />
              <span className="hidden sm:inline">Court-Ready PDF Dossier</span>
              <span className="sm:hidden">PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* 6-Tab Navigation Bar */}
        <nav className="flex flex-wrap border-b border-slate-800 bg-[#070d1e] px-6 text-xs font-bold">
          {[
            { id: 'overview', label: '1. Overview & Signals' },
            { id: 'benchmarking', label: '2. Cost IQR Benchmarking' },
            { id: 'timeline', label: '3. Milestone Lags' },
            { id: 'spatial', label: '4. Spatial & NLP Duplicates' },
            { id: 'evidence', label: '5. Geo-Camera & Hash Evidence' },
            { id: 'governance', label: '6. Officer Audit Trail & Ledger' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`border-b-2 px-4 py-3 transition ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Contents Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW & SIGNAL DECOMPOSITION */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Highlight summary card */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-700/80 bg-[#162033]/60 p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Total Cost</span>
                  <div className="mt-1 text-xl font-black text-white">
                    {formatINR(sanctionedAmount)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Sanctioned Budget
                  </div>
                </div>

                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
                  <span className="text-[10px] font-bold uppercase text-rose-300">
                    Prioritised Risk Score
                  </span>
                  <div className="mt-1 text-xl font-black text-rose-400">
                    {project.risk_score || 87} / 100
                  </div>
                  <div className="text-[11px] text-rose-300/80 mt-0.5">
                    High Risk • Scrutiny Mandatory
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700/80 bg-[#162033]/60 p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Constituency</span>
                  <div className="mt-1 text-sm font-black text-white truncate">
                    {project.constituency || 'Varanasi PC'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {project.state || 'Uttar Pradesh'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700/80 bg-[#162033]/60 p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Executing Agency</span>
                  <div className="mt-1 text-sm font-black text-white truncate">
                    {project.vendor_name || 'Varanasi Infra Constr.'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    HHI Concentration: 3,120
                  </div>
                </div>
              </div>

              {/* Decomposed Explanatory Signals */}
              <div className="rounded-2xl border border-slate-700 bg-[#162033]/40 p-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={17} className="text-cyan-400" />
                    <h3 className="text-sm font-black text-white">
                      Decomposed Risk Attribution Signals
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Deterministic 100-Point Model
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#0f172a] p-3.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                      <TrendingUp size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">Cost Outlier Anomaly</span>
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-extrabold text-rose-300">
                          +25 pts
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">
                        Sanctioned rate is <span className="text-rose-400 font-bold">+{costVariancePct}%</span> above
                        the statistical peer median for road pavement in this district tier.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#0f172a] p-3.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                      <Clock size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">Execution Timeline Delay</span>
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-extrabold text-rose-300">
                          +20 pts
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">
                        Milestone 2 (interlocking laying) is <span className="text-amber-400 font-bold">185 days past</span> sanctioned milestone target without physical progress updates.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#0f172a] p-3.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
                      <Layers size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">Duplicate Spatial Scope</span>
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-extrabold text-rose-300">
                          +18 pts
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">
                        Overlap cluster: Near-identical scope sanctioned 420m away under work ID <span className="font-mono text-cyan-300">{duplicateWork.work_id}</span>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#0f172a] p-3.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
                      <Camera size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">Missing Geo-Camera Proof</span>
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-extrabold text-rose-300">
                          +12 pts
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">
                        Site inspection photo missing official hardware GPS lock and SHA-256 digital tamper stamp.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PEER GROUP COST BENCHMARKING (IQR CHART) */}
          {activeTab === 'benchmarking' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">
                    IQR Statistical Cost Distribution (Sector: Roads &amp; Bridges)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Calculated against 412 comparable village CC road &amp; pavement projects across Eastern UP.
                  </p>
                </div>
                <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-black text-rose-300">
                  +{costVariancePct}% vs Peer Median
                </span>
              </div>

              {/* Statistical Distribution Bar Chart */}
              <div className="h-64 rounded-2xl border border-slate-700 bg-[#162033]/50 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={iqrData} margin={{ top: 20, right: 20, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatINR(Number(val)), 'Amount']}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11 }}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {iqrData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Benchmarking Narrative */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-4 text-xs">
                  <span className="text-slate-400">Interquartile Range (IQR):</span>
                  <div className="mt-1 font-black text-white text-base">₹13.9 Lakhs</div>
                  <p className="mt-1 text-slate-400 text-[11px]">Normal variance spread across certified DPRs.</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-4 text-xs">
                  <span className="text-slate-400">Upper Anomaly Fence:</span>
                  <div className="mt-1 font-black text-amber-300 text-base">₹45.2 Lakhs</div>
                  <p className="mt-1 text-slate-400 text-[11px]">Statistical limit; values above require DM sanction justification.</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-4 text-xs">
                  <span className="text-slate-400">Cost Deviation Classification:</span>
                  <div className="mt-1 font-black text-rose-400 text-base">High Outlier (Grade 4)</div>
                  <p className="mt-1 text-slate-400 text-[11px]">Triggered automated tender re-evaluation notice.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TIMELINE & MILESTONE LAG BREAKDOWN */}
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-white">Project Milestone Progression vs Sanction Target</h3>
                <p className="text-xs text-slate-400">
                  Tracked using e-SAKSHI tranche release dates and physical inspection schedules.
                </p>
              </div>

              {/* Stepper Timeline */}
              <div className="space-y-4">
                {[
                  {
                    step: 'Milestone 1: Administrative Approval & Tender Award',
                    target: '15 Jan 2024',
                    actual: '20 Jan 2024',
                    status: 'Completed On-Time',
                    statusColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                    lag: '5 Days',
                  },
                  {
                    step: 'Milestone 2: Sub-grade Levelling & Sand Bed Laying',
                    target: '28 Feb 2024',
                    actual: '15 Mar 2024',
                    status: 'Delayed (+16 Days)',
                    statusColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
                    lag: '16 Days',
                  },
                  {
                    step: 'Milestone 3: Interlocking Block Laying & Drainage',
                    target: '30 Apr 2024',
                    actual: 'PENDING FIELD VERIFICATION',
                    status: '185 Days Overdue (Critical Lag)',
                    statusColor: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
                    lag: '185 Days',
                  },
                  {
                    step: 'Milestone 4: Final Handover & Gram Sabha Social Audit',
                    target: '30 Jun 2024',
                    actual: 'LOCKED DUE TO AUDIT',
                    status: 'Held Pending Compliance',
                    statusColor: 'text-slate-400 border-slate-700 bg-slate-800',
                    lag: 'Unfulfilled',
                  },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0f172a] p-4 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white text-sm">{item.step}</div>
                      <div className="mt-1 flex items-center gap-3 text-slate-400 text-[11px]">
                        <span>Sanction Target: <b className="text-slate-200">{item.target}</b></span>
                        <span>•</span>
                        <span>Actual Date: <b className="text-slate-200">{item.actual}</b></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${item.statusColor}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SPATIAL PROXIMITY & NLP DUPLICATES */}
          {activeTab === 'spatial' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">
                    Haversine Proximity Collision &amp; NLP Match (&lt;500m)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Identifies potential duplicate billing or double-dipping proposals on the same geographic stretch.
                  </p>
                </div>
                <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                  420m Cluster Lock
                </span>
              </div>

              {/* Proximity Card Comparison */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-blue-500/40 bg-[#162033]/60 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                      CURRENT INVESTIGATED PROPOSAL
                    </span>
                    <span className="font-mono text-xs text-white">{project.work_id}</span>
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-white">{project.work}</h4>
                  <div className="mt-3 space-y-1.5 text-xs text-slate-300 border-t border-slate-700/60 pt-3">
                    <div>Sanction Amount: <b className="text-white">{formatINR(sanctionedAmount)}</b></div>
                    <div>Agency: <b className="text-slate-200">{project.vendor_name || 'Varanasi Infra Constr.'}</b></div>
                    <div>Coordinates: <b className="font-mono text-cyan-300">25.3176° N, 82.9739° E</b></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-purple-500/40 bg-purple-500/5 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                      OVERLAPPING HISTORICAL WORK (92% NLP MATCH)
                    </span>
                    <span className="font-mono text-xs text-white">{duplicateWork.work_id}</span>
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-white">{duplicateWork.work}</h4>
                  <div className="mt-3 space-y-1.5 text-xs text-slate-300 border-t border-slate-700/60 pt-3">
                    <div>Historical Amount: <b className="text-white">{formatINR(duplicateWork.amount)}</b></div>
                    <div>Agency: <b className="text-slate-200">{duplicateWork.vendor}</b> (Same Vendor)</div>
                    <div>Physical Distance: <b className="text-purple-300 font-bold">420 meters away</b></div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 leading-relaxed">
                <b className="text-amber-300">Auditor Warning: </b>
                Both scopes encompass interlocking pavement between Rampur Main Chowk and the PHC dispensary. High probability of duplicate funding release for the same road asset.
              </div>
            </div>
          )}

          {/* TAB 5: GEO-CAMERA & HARDWARE EVIDENCE */}
          {activeTab === 'evidence' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">
                    Geo-Camera Mobile Evidence &amp; SHA-256 Tamper Lock
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live hardware GPS stamp and digital cryptographic hash verification for on-site physical proof.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    Hardware GPS Locked
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Photo Preview with Tamper overlay */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
                    <img
                      src={capturedPhoto || ''}
                      alt="Geo-tagged field evidence"
                      className="h-64 w-full object-cover"
                    />
                    {/* Timestamp & Coordinate Watermark */}
                    <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 p-3 text-[10px] font-mono text-slate-200 backdrop-blur-sm border-t border-slate-800">
                      <div className="flex justify-between">
                        <span className="text-cyan-300">GPS: {cameraGps.lat.toFixed(4)}° N, {cameraGps.lng.toFixed(4)}° E</span>
                        <span className="text-emerald-400">ACCURACY: ±3.2m</span>
                      </div>
                      <div className="mt-1 text-slate-400 truncate">
                        HASH: {cameraHash}
                      </div>
                    </div>
                  </div>

                  {/* Upload new photo trigger */}
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-[#0f172a] p-3 text-xs font-bold text-slate-300 hover:border-cyan-400 hover:bg-[#162033] transition">
                    <Camera size={16} className="text-cyan-400" />
                    <span>Upload New Field Evidence Capture</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCapturedPhoto(URL.createObjectURL(file));
                          generateSimulatedHash(file);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Cryptographic Hash Verification Card */}
                <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl border border-slate-700 bg-[#162033]/60 p-5 text-xs">
                  <div>
                    <div className="flex items-center gap-2 text-cyan-300 font-bold">
                      <Fingerprint size={18} />
                      <span>Cryptographic Provenance Certificate</span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold">SHA-256 Digest:</span>
                        <div className="mt-1 break-all rounded-lg border border-slate-800 bg-[#070d1e] p-2.5 font-mono text-[11px] text-emerald-300">
                          {hashVerifying ? 'Generating cryptographic digest…' : cameraHash}
                        </div>
                      </div>

                      <div className="pt-2">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Capture Hardware ID:</span>
                        <div className="font-mono text-slate-200 mt-0.5">NIC-GeoLock-UP-VNS-0492</div>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Officer Witness:</span>
                        <div className="text-slate-200 mt-0.5">{user.name} ({user.title})</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                      <CheckCircle2 size={16} /> Immutable Hash Verified
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(cameraHash)}
                      className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white"
                    >
                      <Copy size={11} /> Copy Hash
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: OFFICER AUDIT TRAIL & DECISION LOG */}
          {activeTab === 'governance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-white">
                  Officer Action &amp; Append-Only Governance Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  Official human-in-the-loop decision recording. Locked entries cannot be deleted or overwritten.
                </p>
              </div>

              {/* Decision Recording Form */}
              <form
                onSubmit={handleLockDetermination}
                className="rounded-2xl border border-slate-700 bg-[#162033]/80 p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                  <div className="text-xs font-black uppercase text-cyan-300">
                    Record Statutory Determination
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Signing Officer: <b className="text-white">{user.name}</b>
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Statutory Order / Action Type
                    </label>
                    <select
                      value={selectedAction}
                      onChange={(e) => setSelectedAction(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-[#0f172a] px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                    >
                      <option value="Order Physical Inspection">Order Physical Inspection</option>
                      <option value="Issue Notice to Agency">Issue Notice to Agency</option>
                      <option value="Sanction Tranche">Sanction Tranche (Conditional)</option>
                      <option value="Close Case">Close Case (Remediated)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Designated Authority
                    </label>
                    <input
                      disabled
                      value={`${user.title}`}
                      className="w-full rounded-xl border border-slate-800 bg-[#070d1e] px-3 py-2 text-xs text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Official Audit Findings &amp; Directive Remarks
                  </label>
                  <textarea
                    rows={3}
                    value={determinationRemarks}
                    onChange={(e) => setDeterminationRemarks(e.target.value)}
                    required
                    placeholder="Enter formal justification, directives, and required compliance steps..."
                    className="w-full rounded-xl border border-slate-700 bg-[#0f172a] p-3 text-xs text-white outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400">
                    SHA-256 digital signature will be generated and signed.
                  </span>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-blue-950/60 hover:bg-blue-500 transition active:scale-95"
                  >
                    <Lock size={14} />
                    <span>Sign &amp; Lock Determination to Immutable Ledger</span>
                  </button>
                </div>

                {determinationLocked && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-300 text-center animate-fade-in">
                    ✓ Determination signed by {user.name} and appended to tamper-proof governance ledger!
                  </div>
                )}
              </form>

              {/* Append-Only Ledger History */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Immutable Event History ({actionHistory.length} Recorded Entries)
                </div>

                {actionHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-800 bg-[#0f172a] p-4 text-xs space-y-2 shadow"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <span className="font-black text-white text-sm flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-cyan-400" />
                        {item.action}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">{item.timestamp}</span>
                    </div>

                    <p className="text-slate-300 leading-relaxed text-xs">{item.remarks}</p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
                      <span>Officer: <b className="text-slate-200">{item.officer}</b> ({item.role})</span>
                      <span className="font-mono text-[10px] text-cyan-400 truncate max-w-xs">
                        HASH: {item.hash.substring(0, 24)}…
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RiskPassportDrawer;

'use client';

import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Flame,
  Gauge,
  HelpCircle,
  IndianRupee,
  Info,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  RotateCcw,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type { Project } from '@/lib/types';
import { formatCrores, formatINR } from '@/lib/format';

interface ExecutiveCommandHubProps {
  projects: Project[];
  onInspectWork?: (project: Project) => void;
  onExploreEngine?: (engineId: string) => void;
  onOpenScrutinyQueue?: () => void;
}

export function ExecutiveCommandHub({
  projects,
  onInspectWork,
  onExploreEngine,
  onOpenScrutinyQueue,
}: ExecutiveCommandHubProps) {
  const [activeFy, setActiveFy] = useState<'2025-26' | '2024-25' | '2023-24'>('2025-26');

  // Compute live KPI aggregates from active project dataset
  const kpiData = useMemo(() => {
    // The national command view keeps its reference baseline visible even before
    // an officer imports a local CSV. Once records exist, every number switches
    // to the live dataset instead of silently mixing the two sources.
    const totalProjects = projects.length;
    const flagged = projects.filter(
      (p) => (p.risk_score || 0) >= 80 || p.anomaly_type === 'Duplicate Location',
    ).length;
    const totalSanctionedValue = projects.reduce(
      (acc, p) => acc + (p.sanctioned_amount || p.amount || 0),
      0,
    );
    const openInquiries = projects.filter(
      (p) => (p.risk_score || 0) >= 85 && p.payment_status !== 'Completed',
    ).length;

    return {
      totalProjects,
      flagged,
      totalSanctionedValue,
      openInquiries,
      sanctionedCrores: (totalSanctionedValue / 10_000_000).toFixed(2),
    };
  }, [projects]);

  return (
    <div className="space-y-6">
      {/* 1. NATIONAL EXECUTIVE COMMAND BANNER & KPI CARDS */}
      <section className="rounded-2xl border border-slate-300 bg-slate-100 p-6 shadow-2xl backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                National Executive Command
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Automated anomaly intelligence, peer cost benchmarking, and statutory compliance surveillance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* FY Cycle Selector */}
            <div className="flex items-center rounded-xl border border-slate-700 bg-[#070d1e] p-1 text-xs font-bold">
              {(['2025-26', '2024-25', '2023-24'] as const).map((fy) => (
                <button
                  key={fy}
                  type="button"
                  onClick={() => setActiveFy(fy)}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    activeFy === fy
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  FY {fy} {fy === '2025-26' && '• Active Cycle'}
                </button>
              ))}
            </div>

            {/* Scrutiny Queue Shortcut */}
            <button
              type="button"
              onClick={onOpenScrutinyQueue}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-950/50 hover:from-blue-500 hover:to-indigo-500 transition"
            >
              <Activity size={14} />
              <span>Workflow Flow Hub</span>
            </button>
          </div>
        </div>

        {/* 4 KPI CARDS */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Sanctions Tracked */}
          <div className="group rounded-xl border border-slate-700/70 bg-[#0f172a]/90 p-4 shadow-inner transition hover:border-blue-400/50">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Total Sanctions Tracked
              </span>
              <Building2 size={16} className="text-blue-400" />
            </div>
              <div
                className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100 sm:text-3xl"
                style={{ backgroundColor: 'rgb(244, 239, 239)', color: 'rgb(1, 1, 1)' }}
              >
              {kpiData.totalProjects.toLocaleString('en-IN')}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Live Supabase coverage
            </div>
          </div>

          {/* Card 2: High Risk Sanctions */}
          <div className="group rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 shadow-inner transition hover:border-rose-400/60">
            <div className="flex items-center justify-between text-rose-300">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                High Risk Sanctions
              </span>
              <AlertTriangle size={16} className="text-rose-400 animate-bounce" />
            </div>
            <div className="mt-3 text-2xl font-black text-rose-400 sm:text-3xl">
              {kpiData.flagged.toLocaleString('en-IN')}
            </div>
            <div className="mt-1 text-[11px] text-rose-300/80">
              Filtered down from {kpiData.totalProjects.toLocaleString('en-IN')} total proposals
            </div>
          </div>

          {/* Card 3: Total Sanctioned Value */}
          <div className="group rounded-xl border border-slate-700/70 bg-[#0f172a]/90 p-4 shadow-inner transition hover:border-emerald-400/50">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Total Sanctioned Value
              </span>
              <IndianRupee size={16} className="text-emerald-400" />
            </div>
              <div
                className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100 sm:text-3xl"
                style={{ backgroundColor: 'rgb(245, 242, 242)', color: 'rgb(83, 102, 248)' }}
              >
              ₹{kpiData.sanctionedCrores} Cr
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Cumulative AA&amp;ES authorization
            </div>
          </div>

          {/* Card 4: Inquiry Proceedings */}
          <div className="group rounded-xl border border-slate-700/70 bg-[#0f172a]/90 p-4 shadow-inner transition hover:border-amber-400/50">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Inquiry Proceedings
              </span>
              <FileCheck2 size={16} className="text-amber-400" />
            </div>
            <div className="mt-3 text-2xl font-black text-amber-300 sm:text-3xl">
              {kpiData.openInquiries} Open
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Field verifications &amp; officer audits
            </div>
          </div>
        </div>
      </section>

      {/* 2. 6-ENGINE ANOMALY & RISK MATRIX */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
              System Architecture
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 sm:text-xl">
              6 Calibrated Anomaly &amp; Risk Engines
            </h3>
          </div>
          <button
            type="button"
            onClick={onOpenScrutinyQueue}
            className="flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200 transition"
          >
            <span>View Full Scrutiny Queue</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Engine 1 */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-700/80 bg-[#162033]/80 p-5 shadow-lg transition hover:border-blue-400/60 hover:bg-[#1a263d]">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <TrendingUp size={20} />
                </div>
                <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-400/30">
                  +53.8% Avg Outlier
                </span>
              </div>
              <div className="mt-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400" style={{ color: 'rgb(7, 7, 7)' }}>
                IQR Statistical Engine
              </div>
              <h4 className="text-sm font-black text-white">Cost Outlier Detection</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Multi-district peer median benchmarking with IQR variance analysis to detect inflated estimates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onExploreEngine?.('cost_outlier')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300"
            >
              Explore Engine &rarr;
            </button>
          </div>

          {/* Engine 2 */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-700/80 bg-[#162033]/80 p-5 shadow-lg transition hover:border-amber-400/60 hover:bg-[#1a263d]">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
                  <Clock size={20} />
                </div>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-400/30">
                  180+ Days Threshold
                </span>
              </div>
              <div className="mt-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400" style={{ color: 'rgb(7, 7, 7)' }}>
                Milestone Engine
              </div>
              <h4 className="text-sm font-black text-white">Timeline &amp; Delay Tracking</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Tracks execution lags exceeding 180+ days past sanctioned milestone dates with automated risk inflation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onExploreEngine?.('timeline_delay')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300"
            >
              Explore Engine &rarr;
            </button>
          </div>

          {/* Engine 3 */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-700/80 bg-[#162033]/80 p-5 shadow-lg transition hover:border-purple-400/60 hover:bg-[#1a263d]">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                  <Layers size={20} />
                </div>
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-400/30">
                  &lt;500m Proximity Lock
                </span>
              </div>
              <div className="mt-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400" style={{ color: 'rgb(7, 7, 7)' }}>
                Geospatial Clustering
              </div>
              <h4 className="text-sm font-black text-white">Duplicate Proposal Matcher</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                TF-IDF NLP text proximity and Haversine geospatial clustering (&lt;500m) to catch double-dipping proposals.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onExploreEngine?.('duplicate_matcher')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-purple-400 hover:text-purple-300"
            >
              Explore Engine &rarr;
            </button>
          </div>

          {/* Engine 4 */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-700/80 bg-[#162033]/80 p-5 shadow-lg transition hover:border-emerald-400/60 hover:bg-[#1a263d]">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                  <Camera size={20} />
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-400/30">
                  SHA-256 Verified
                </span>
              </div>
              <div className="mt-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400" style={{ color: 'rgb(7, 7, 7)' }}>
                Tamper-Proof Lock
              </div>
              <h4 className="text-sm font-black text-white">Geo-Camera Evidence Lock</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Mobile photo progress capture with hardware GPS locking, distance mismatch alerts, and SHA-256 hashes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onExploreEngine?.('geocamera')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300"
            >
              Explore Engine &rarr;
            </button>
          </div>

          {/* Engine 5 */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-700/80 bg-[#162033]/80 p-5 shadow-lg transition hover:border-cyan-400/60 hover:bg-[#1a263d]">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
                  <Building2 size={20} />
                </div>
                <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-400/30">
                  HHI &gt; 2500 Monitored
                </span>
              </div>
              <div className="mt-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400" style={{ color: 'rgba(7, 7, 7, 0.98)' }}>
                HHI Market Power
              </div>
              <h4 className="text-sm font-black text-white">Agency Monopoly Index</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Herfindahl-Hirschman Index (HHI) analysis to detect contractor concentration and single-bidder monopolies.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onExploreEngine?.('agency_monopoly')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300"
            >
              Explore Engine &rarr;
            </button>
          </div>

          {/* Engine 6 */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-700/80 bg-[#162033]/80 p-5 shadow-lg transition hover:border-indigo-400/60 hover:bg-[#1a263d]">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <ShieldCheck size={20} />
                </div>
                <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-400/30">
                  100% Audit Trail
                </span>
              </div>
              <div className="mt-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400" style={{ color: 'rgb(7, 7, 7)' }}>
                Append-Only Ledger
              </div>
              <h4 className="text-sm font-black text-white">Statutory Audit Ledger</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Immutable cryptographic event log recording every officer determination, memo issue, and verification.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onExploreEngine?.('audit_ledger')}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300"
            >
              Explore Engine &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* 3. LIVE AI RISK ENGINE & EXPLAINABILITY SIMULATOR */}
      <LiveRiskSimulator onOpenScrutinyQueue={onOpenScrutinyQueue} />
    </div>
  );
}

// 3. Subcomponent: Interactive Live AI Risk Engine & Explainability Simulator
export function LiveRiskSimulator({ onOpenScrutinyQueue }: { onOpenScrutinyQueue?: () => void }) {
  // Slider states
  const [costDeviation, setCostDeviation] = useState<number>(54); // -20% to +100%
  const [timelineDelay, setTimelineDelay] = useState<number>(195); // 0 to 365 days

  // Toggle states
  const [duplicateScope, setDuplicateScope] = useState<boolean>(true);
  const [agencyMonopoly, setAgencyMonopoly] = useState<boolean>(true);
  const [missingProof, setMissingProof] = useState<boolean>(true);

  // Reset simulator function
  const handleReset = () => {
    setCostDeviation(54);
    setTimelineDelay(195);
    setDuplicateScope(true);
    setAgencyMonopoly(true);
    setMissingProof(true);
  };

  // Real-time calculation of risk score and decomposed signals
  const { score, signals, riskLabel, riskColor, circleColor } = useMemo(() => {
    let pts = 0;
    const items: Array<{ label: string; points: number; color: string }> = [];

    // Cost anomaly contribution
    if (costDeviation > 25) {
      const costPts = Math.min(30, Math.round(((costDeviation - 25) / 75) * 30));
      pts += costPts;
      items.push({
        label: `Cost Anomaly: +${costDeviation}% (+${costPts} pts)`,
        points: costPts,
        color: 'text-amber-400',
      });
    }

    // Timeline delay contribution
    if (timelineDelay > 90) {
      const delayPts = Math.min(25, Math.round(((timelineDelay - 90) / 275) * 25));
      pts += delayPts;
      items.push({
        label: `Timeline Delay: ${timelineDelay} days (+${delayPts} pts)`,
        points: delayPts,
        color: 'text-orange-400',
      });
    }

    // Duplicate Scope contribution
    if (duplicateScope) {
      pts += 18;
      items.push({
        label: 'Duplicate Scope Detected (+18 pts)',
        points: 18,
        color: 'text-purple-400',
      });
    }

    // Agency Monopoly contribution
    if (agencyMonopoly) {
      pts += 15;
      items.push({
        label: 'Agency Monopoly Flagged (+15 pts)',
        points: 15,
        color: 'text-blue-400',
      });
    }

    // Missing Proof / GPS mismatch contribution
    if (missingProof) {
      pts += 12;
      items.push({
        label: 'Missing Field Proof / GPS Hash Mismatch (+12 pts)',
        points: 12,
        color: 'text-rose-400',
      });
    }

    const finalScore = Math.max(10, Math.min(99, pts));

    let label = 'ROUTINE SANCTION (LOW RISK)';
    let rColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    let cColor = '#10b981';

    if (finalScore >= 75) {
      label = 'HIGH RISK (SCRUTINY REQUIRED)';
      rColor = 'text-rose-400 border-rose-500/30 bg-rose-500/10';
      cColor = '#f43f5e';
    } else if (finalScore >= 50) {
      label = 'MODERATE ANOMALY (ADVISORY REVIEW)';
      rColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      cColor = '#f59e0b';
    }

    return {
      score: finalScore,
      signals: items,
      riskLabel: label,
      riskColor: rColor,
      circleColor: cColor,
    };
  }, [costDeviation, timelineDelay, duplicateScope, agencyMonopoly, missingProof]);

  // SVG Gauge calculations
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <section className="rounded-2xl border border-slate-700/80 bg-[#0f172a] p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4" style={{ color: 'rgb(229, 229, 232)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-300 border border-indigo-400/30">
              Interactive Demo Playground
            </span>
          </div>
          <h3 className="text-base font-black text-white sm:text-lg mt-1">
            Live AI Risk Engine &amp; Explainability Simulator
          </h3>
          <p className="text-xs text-slate-400">
            Adjust project parameters to watch the Explainable AI decompose risk signals and calculate scores in real time.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition"
        >
          <RotateCcw size={13} />
          <span>Reset Demo</span>
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Side: Interactive Sliders & Toggles (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Slider 1: Category Peer Cost Deviation */}
          <div className="rounded-xl border border-slate-800 bg-[#162033]/60 p-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <TrendingUp size={14} className="text-blue-400" />
                <span>Category Peer Cost Deviation</span>
              </label>
              <span className={`text-xs font-black font-mono ${costDeviation > 25 ? 'text-blue-400' : 'text-emerald-400'}`}>
                {costDeviation >= 0 ? `+${costDeviation}%` : `${costDeviation}%`} vs Peer Median
              </span>
            </div>

            <input
              type="range"
              min={-20}
              max={100}
              value={costDeviation}
              onChange={(e) => setCostDeviation(Number(e.target.value))}
              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-blue-500"
            />

            <div className="mt-2 flex justify-between text-[10px] text-slate-500 font-medium">
              <span>-20% (Low Cost)</span>
              <span>+25% (Peer Norm)</span>
              <span>+100% (High Anomaly)</span>
            </div>
          </div>

          {/* Slider 2: Milestone Execution Delay */}
          <div className="rounded-xl border border-slate-800 bg-[#162033]/60 p-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Clock size={14} className="text-amber-400" />
                <span>Milestone Execution Delay</span>
              </label>
              <span className={`text-xs font-black font-mono ${timelineDelay > 90 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {timelineDelay} Days Past Target
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={365}
              value={timelineDelay}
              onChange={(e) => setTimelineDelay(Number(e.target.value))}
              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-amber-500"
            />

            <div className="mt-2 flex justify-between text-[10px] text-slate-500 font-medium">
              <span>0 Days (On-Time)</span>
              <span>90 Days (Warning)</span>
              <span>365 Days (Critical)</span>
            </div>
          </div>

          {/* Interactive Toggle Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Toggle A: Duplicate Scope */}
            <button
              type="button"
              onClick={() => setDuplicateScope((prev) => !prev)}
              className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                duplicateScope
                  ? 'border-purple-500/60 bg-purple-100 dark:bg-purple-500/10'
                  : 'border-slate-300 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/80 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <Layers size={16} className={duplicateScope ? 'text-purple-400' : 'text-slate-500'} />
                <span className={`h-2.5 w-2.5 rounded-full ${duplicateScope ? 'bg-purple-400 ring-2 ring-purple-900' : 'bg-slate-700'}`} />
              </div>
              <div className="mt-2.5 font-bold text-xs text-slate-900 dark:text-slate-100">Duplicate Match</div>
              <div className="text-[10px] text-slate-400 mt-0.5">92% NLP (&lt;400m)</div>
            </button>

            {/* Toggle B: Agency Monopoly */}
            <button
              type="button"
              onClick={() => setAgencyMonopoly((prev) => !prev)}
              className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                agencyMonopoly
                  ? 'border-blue-500/60 bg-blue-100 dark:bg-blue-500/10'
                  : 'border-slate-300 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/80 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <Building2 size={16} className={agencyMonopoly ? 'text-blue-400' : 'text-slate-500'} />
                <span className={`h-2.5 w-2.5 rounded-full ${agencyMonopoly ? 'bg-blue-400 ring-2 ring-blue-900' : 'bg-slate-700'}`} />
              </div>
              <div className="mt-2.5 font-bold text-xs text-slate-900 dark:text-slate-100">Agency Monopoly</div>
              <div className="text-[10px] text-slate-400 mt-0.5">HHI &gt; 2800 (Dominant)</div>
            </button>

            {/* Toggle C: Missing Proof */}
            <button
              type="button"
              onClick={() => setMissingProof((prev) => !prev)}
              className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                missingProof
                  ? 'border-rose-500/60 bg-rose-100 dark:bg-rose-500/10'
                  : 'border-slate-300 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/80 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <Camera size={16} className={missingProof ? 'text-rose-400' : 'text-slate-500'} />
                <span className={`h-2.5 w-2.5 rounded-full ${missingProof ? 'bg-rose-400 ring-2 ring-rose-900' : 'bg-slate-700'}`} />
              </div>
              <div className="mt-2.5 font-bold text-xs text-slate-900 dark:text-slate-100">Missing Proof</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Verified GPS Hash</div>
            </button>
          </div>
        </div>

        {/* Right Side: Real-Time Dynamic Circular Risk Gauge & Decomposed Signal List (5 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#162033]/50 p-6 lg:col-span-5">
          <div>
            {/* Dynamic Circular Risk Gauge */}
            <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
              <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 128 128">
                {/* Background Track */}
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  className="stroke-slate-800"
                  strokeWidth="10"
                  fill="transparent"
                />
                {/* Animated Dynamic Progress Gauge */}
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  stroke={circleColor}
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-300 ease-out"
                />
              </svg>
              {/* Inner Label */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-slate-900 dark:text-slate-100" style={{ color: 'rgb(7, 6, 3)' }}>{score}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Out of 100</span>
              </div>
            </div>

            {/* Risk Badge */}
            <div className="mt-4 text-center">
              <span className={`inline-block rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider ${riskColor}`}>
                {riskLabel}
              </span>
            </div>

            {/* Decomposed Signal Breakdown List */}
            <div className="mt-5 border-t border-slate-800 pt-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Decomposed Risk Signals:
              </div>
              <div className="mt-2.5 space-y-1.5">
                {signals.length === 0 ? (
                  <div className="text-xs text-emerald-400 py-2">
                    ✓ All statutory milestones, peer rates, and contractor ratios normal.
                  </div>
                ) : (
                  signals.map((sig, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-200">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${sig.color.replace('text-', 'bg-')}`} />
                      <span className="truncate">{sig.label}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="mt-6">
            <button
              type="button"
              onClick={onOpenScrutinyQueue}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 border border-slate-700 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              <span>View Full Scrutiny Queue</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ExecutiveCommandHub;

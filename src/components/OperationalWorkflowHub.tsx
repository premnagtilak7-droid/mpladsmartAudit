'use client';

import React from 'react';
import {
  Database,
  Cpu,
  AlertTriangle,
  FileSearch,
  Camera,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  MapPin,
  Building2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { Project } from '@/lib/types';
import { formatINR } from '@/lib/format';

interface OperationalWorkflowHubProps {
  onStepClick: (stepId: number) => void;
  onInspectFlagship: () => void;
  flagshipProject?: Project | null;
  totalRecords?: number;
  highRiskRecords?: number;
}

export function OperationalWorkflowHub({
  onStepClick,
  onInspectFlagship,
  flagshipProject,
  totalRecords = 3013,
  highRiskRecords = 294,
}: OperationalWorkflowHubProps) {
  const steps = [
    {
      id: 1,
      stepNumber: 'STEP 01',
      title: 'Data Ingestion & Quality Audit',
      badge: `${totalRecords.toLocaleString('en-IN')} Records Loaded`,
      badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
      description:
        'Zero-loss CSV/API schema mapping with automated completeness scorecard across coordinates & sanction records.',
      btnText: 'Open Ingestion Center',
      btnColor: 'bg-emerald-600 hover:bg-emerald-500 text-white',
      icon: Database,
      iconBg: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      activeDot: true,
    },
    {
      id: 2,
      stepNumber: 'STEP 02',
      title: 'AI Multi-Signal Scoring Engine',
      badge: '6 Analytical Engines',
      badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
      description:
        'Transparent 100-pt decomposition: Cost IQR outliers, milestone delays, TF-IDF duplicate matcher & agency concentration.',
      btnText: 'Calibrate Risk Weights',
      btnColor: 'bg-blue-600 hover:bg-blue-500 text-white',
      icon: Cpu,
      iconBg: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    },
    {
      id: 3,
      stepNumber: 'STEP 03',
      title: 'Prioritised Scrutiny Queue',
      badge: `${highRiskRecords.toLocaleString('en-IN')} High-Risk Flags`,
      badgeColor: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
      description:
        'Explainable triage queue sorted by risk score. Multi-filter by district, category, execution lag, and overlapping proposals.',
      btnText: 'Inspect Scrutiny Queue',
      btnColor: 'bg-rose-600 hover:bg-rose-500 text-white',
      icon: AlertTriangle,
      iconBg: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
    },
    {
      id: 4,
      stepNumber: 'STEP 04',
      title: '360° Risk Passport Dossier',
      badge: '6-Tab Case Inquest',
      badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      description:
        'Deep investigative dossier: Peer group cost benchmarking, delay breakdown, nearby duplicates, and compliance gaps.',
      btnText: 'View Flagship Dossier',
      btnColor: 'bg-amber-600 hover:bg-amber-500 text-white',
      icon: FileSearch,
      iconBg: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    },
    {
      id: 5,
      stepNumber: 'STEP 05',
      title: 'Geo-Verified Evidence Capture',
      badge: 'Mobile Camera + GPS Lock',
      badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
      description:
        'Field physical verification via live mobile camera, tamper-evident SHA-256 hash & Haversine distance mismatch detection.',
      btnText: 'Launch Live Camera',
      btnColor: 'bg-purple-600 hover:bg-purple-500 text-white',
      icon: Camera,
      iconBg: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    },
    {
      id: 6,
      stepNumber: 'STEP 06',
      title: 'Officer Action & Governance Ledger',
      badge: 'Append-Only Audit Trail',
      badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
      description:
        'Human-in-the-loop decision recording: Field visit orders, compliance sign-offs, statutory notes & printable PDF dossiers.',
      btnText: 'Open Case Management',
      btnColor: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      icon: ShieldCheck,
      iconBg: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 6-Card Step Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {steps.map((st) => {
          const Icon = st.icon;
          return (
            <div
              key={st.id}
              className="relative flex flex-col justify-between rounded-2xl border border-slate-700/80 bg-[#0f172a]/90 p-5 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:border-slate-500 hover:bg-[#162033]"
            >
              {st.activeDot && (
                <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              )}

              <div>
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${st.iconBg}`}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black tracking-widest text-slate-400">
                      {st.stepNumber}
                    </span>
                    <h3 className="text-sm font-black text-white leading-snug">{st.title}</h3>
                  </div>
                </div>

                <div className="mt-3">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${st.badgeColor}`}
                  >
                    {st.badge}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-slate-300">
                  {st.description}
                </p>
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => {
                    if (st.id === 4) onInspectFlagship();
                    else onStepClick(st.id);
                  }}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition shadow-md active:scale-95 ${st.btnColor}`}
                >
                  <span>{st.btnText}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Flagship Case Spotlight Banner */}
      <section className="rounded-2xl border border-slate-700/80 bg-gradient-to-r from-[#111e38] via-[#0f172a] to-[#162033] p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-amber-300">
              <span className="rounded bg-amber-500/20 px-2 py-0.5 border border-amber-400/30">
                CASE SPOTLIGHT
              </span>
              <span>•</span>
              <span className="font-mono text-slate-300">
                {flagshipProject?.work_id || 'MPL-2024-UP-004821'}
              </span>
              <span>•</span>
              <span className="text-slate-400">
                {flagshipProject?.constituency || 'Varanasi'} • Roads &amp; Bridges
              </span>
            </div>

            <h3 className="mt-2 text-base font-black text-white sm:text-lg">
              {flagshipProject?.work ||
                'Construction of CC Road and Interlocking Pavement from Main Chowk to Primary Health Center, Village Rampur'}
            </h3>

            <div className="mt-2 rounded-xl border border-slate-800 bg-[#070d1e]/80 p-3 text-xs text-slate-300 leading-relaxed">
              <span className="font-bold text-amber-300">Administrative Anomaly Finding: </span>
              Sanctioned at <span className="font-black text-white">₹48.00 Lakh</span> compared to
              sector peer median <span className="font-semibold text-slate-200">₹31.20 Lakh</span> (+53.8%
              outlier) • Near-identical proposal detected 420m away • Statutory completion certificate
              is missing on file.
            </div>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onInspectFlagship}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-xl shadow-blue-950/60 hover:bg-blue-500 transition active:scale-95"
            >
              <FileSearch size={16} />
              <span>Inspect Risk Passport Dossier &rarr;</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default OperationalWorkflowHub;

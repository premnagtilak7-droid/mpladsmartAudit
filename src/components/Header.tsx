'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Command,
  Sun,
  Moon,
  Shield,
  UserCheck,
  ChevronDown,
  LogOut,
  Sparkles,
  Play,
  X,
  ExternalLink,
  ShieldAlert,
  Building2,
  Users,
  Check,
  KeyRound,
  Filter,
  Printer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth, PRESET_ACCOUNTS, type UserRole } from '@/lib/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import { playIfEnabled } from '@/lib/soundFX';
import type { Project } from '@/lib/types';

interface HeaderProps {
  onSearchSelect?: (project: Project) => void;
  onOpenAnalysis?: () => void;
  /** Fired by the "Run Analysis" CTA — performs a live recalculation pass. */
  onRunAnalysis?: () => void;
  /** Fired by the "Print Scheme Dossier" CTA — opens the browser print sheet. */
  onPrintDossier?: () => void;
  projects?: Project[];
}

export function Header({
  onSearchSelect,
  onOpenAnalysis,
  onRunAnalysis,
  onPrintDossier,
  projects = [],
}: HeaderProps) {
  const { user, loginAs, logoutToCitizen, switchModalOpen, setSwitchModalOpen, restrictedAlert, setRestrictedAlert } = useAuth();
  const { theme, toggle, isMuted, toggleMute } = useTheme();

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut listener: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSearchModalOpen(false);
        setProfileDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside listener for profile dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter projects for global search modal
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return projects.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return projects
      .filter((p) => {
        return (
          (p.work || '').toLowerCase().includes(q) ||
          (p.work_id || '').toLowerCase().includes(q) ||
          (p.constituency || '').toLowerCase().includes(q) ||
          (p.vendor_name || '').toLowerCase().includes(q) ||
          (p.state || '').toLowerCase().includes(q) ||
          (p.mp || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [projects, searchQuery]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#1e293b] bg-[#070d1e]/95 backdrop-blur-md text-white transition-colors">
        <div className="mx-auto flex h-16 max-w-full items-center justify-between gap-3 px-4 sm:px-6">
          {/* Left Side: Official Emblem & Logo */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 shadow-inner">
              <Shield className="h-5 w-5 text-cyan-300" strokeWidth={2.2} />
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#070d1e]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white font-sans sm:text-lg">
                  MPLADS <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-sky-400">RAKSHAK</span>
                </span>
                <span className="rounded bg-blue-600/30 border border-blue-400/40 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-300">
                  MoSPI
                </span>
              </div>
              <p className="hidden text-[10px] font-medium text-slate-400 sm:block">
                National Risk &amp; Anomaly Intelligence Layer • Government of India
              </p>
            </div>
          </div>

          {/* Center Status Pill: e-SAKSHI Active Feed */}
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-[#0f172a] px-3.5 py-1.5 text-xs shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-semibold text-slate-200">
              e-SAKSHI Active Feed
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-[11px] font-medium text-emerald-400">
              Live Sync
            </span>
          </div>

          {/* Center-Right Search Trigger Bar (`Cmd/Ctrl + K`) */}
          <div className="flex flex-1 max-w-xs mx-2">
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-[#0b132b]/90 px-3.5 py-1.5 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
            >
              <div className="flex items-center gap-2 truncate">
                <Search size={14} className="text-slate-400 shrink-0" />
                <span className="truncate">Search works, vendors, ID…</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                <Command size={10} />K
              </kbd>
            </button>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Run Analysis CTA Button — live recalculation pass */}
            <motion.button
              type="button"
              onClick={() => {
                playIfEnabled(isMuted, 'playClick');
                (onRunAnalysis || onOpenAnalysis)?.();
              }}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.97 }}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500 shadow-md shadow-emerald-950/40 active:scale-95"
            >
              <Play size={13} fill="currentColor" />
              <span>Run Analysis</span>
            </motion.button>

            {/* Print Scheme Dossier CTA — opens the browser print sheet */}
            <button
              type="button"
              onClick={() => {
                if (onPrintDossier) {
                  onPrintDossier();
                  return;
                }
                if (typeof window !== 'undefined') window.print();
              }}
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-slate-600/70 bg-[#0f172a] px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:border-cyan-400/60 hover:text-white active:scale-95"
            >
              <Printer size={13} />
              <span>Print Scheme Dossier</span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/70 bg-[#0f172a] text-slate-300 hover:text-white hover:border-slate-500 transition"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              type="button"
              onClick={() => {
                toggleMute();
                if (isMuted) playIfEnabled(false, 'playClick');
              }}
              aria-label={`UI Sound Effects: ${isMuted ? 'OFF' : 'ON'}`}
              title={`UI Sound Effects: ${isMuted ? 'OFF' : 'ON'}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/70 bg-[#0f172a] text-slate-300 transition hover:border-cyan-400/60 hover:text-white"
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            {/* User Profile Dropdown & Switch Role */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-[#0f172a] px-3 py-1.5 text-left transition hover:border-cyan-400/60"
              >
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-white leading-tight">
                    {user.title}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {user.district ? `${user.district}, ${user.state}` : user.department}
                  </span>
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  <UserCheck size={14} />
                </div>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl shadow-black/80 z-50">
                  {/* Officer Header Card */}
                  <div className="border-b border-slate-800 bg-[#162033] p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                        Active Session Credentials
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${user.badgeColor}`}>
                        {user.badge}
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-black text-white">{user.name}</div>
                    <div className="text-xs text-slate-300">{user.title}</div>
                    <div className="mt-1 font-mono text-[10px] text-slate-400">{user.email}</div>
                  </div>

                  {/* Switch Role Quick Action */}
                  <div className="p-2 border-b border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setSwitchModalOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/10 transition"
                    >
                      <KeyRound size={15} />
                      <span>Switch Officer Role / Re-authenticate</span>
                    </button>
                  </div>

                  {/* Preset Quick Swappers */}
                  <div className="p-2 space-y-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Quick Demo Swapper
                    </div>
                    {Object.entries(PRESET_ACCOUNTS).map(([key, acc]) => {
                      const isCurrent = acc.id === user.id;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            loginAs(key as keyof typeof PRESET_ACCOUNTS);
                            setProfileDropdownOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition ${
                            isCurrent
                              ? 'bg-indigo-600/20 text-indigo-300 font-bold'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className="truncate">{acc.title}</div>
                            <div className="text-[10px] text-slate-400">{acc.roleLabel}</div>
                          </div>
                          {isCurrent && <Check size={14} className="text-cyan-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer Logout */}
                  <div className="border-t border-slate-800 p-2">
                    <button
                      type="button"
                      onClick={() => {
                        logoutToCitizen();
                        setProfileDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <LogOut size={14} />
                      <span>Sign Out (Switch to Public Citizen)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Global Shortcut Search Modal (`Cmd/Ctrl + K`) */}
      {searchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 pt-20 backdrop-blur-sm"
          onClick={() => setSearchModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl"
          >
            {/* Modal Input */}
            <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across Work ID, Title, Constituency, Vendor, MP..."
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
              <kbd className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <div className="max-h-96 overflow-y-auto p-2">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {searchQuery ? `Matching Results (${searchResults.length})` : 'Recent Plotted Works (e-SAKSHI Active)'}
              </div>
              {searchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No matching projects or works found for &quot;{searchQuery}&quot;
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSearchSelect?.(item);
                      setSearchModalOpen(false);
                    }}
                    className="flex w-full items-start justify-between rounded-xl p-3 text-left transition hover:bg-[#1e293b]"
                  >
                    <div className="max-w-[78%]">
                      <div className="font-bold text-xs text-white truncate">
                        {item.work || 'MPLAD Public Asset'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {item.work_id || `MPLAD-${item.id}`} • {item.constituency || 'Constituency'} • {item.state || 'State'}
                      </div>
                      {item.vendor_name && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Vendor: {item.vendor_name}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-cyan-300">
                        ₹{item.amount ? (item.amount / 100000).toFixed(1) : 0} L
                      </div>
                      <div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        (item.risk_score || 0) >= 80 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {(item.risk_score || 0) >= 80 ? 'High Risk' : 'Sanctioned'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1. Sign In / Switch Role Modal */}
      {switchModalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setSwitchModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl border border-slate-700 bg-[#0f172a] p-6 shadow-2xl text-left"
          >
            <div className="mb-5 flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                  Role-Based Authentication &amp; RBAC Access
                </div>
                <h3 className="text-lg font-black text-white">
                  Select Officer Identity / Public Role
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSwitchModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-4 text-xs text-slate-300">
              Select one of the verified government officer tiers below to simulate role-based administrative capabilities, district filters, and decision logs:
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* MoSPI HQ Admin */}
              <button
                type="button"
                onClick={() => loginAs('mospi_hq')}
                className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                  user.role === 'central_admin'
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : 'border-slate-800 bg-[#1e293b]/50 hover:border-emerald-400/50 hover:bg-[#1e293b]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[9px] font-extrabold text-emerald-300">
                      Tier 1: Central Admin
                    </span>
                    {user.role === 'central_admin' && <Check size={16} className="text-emerald-400" />}
                  </div>
                  <h4 className="mt-2 font-black text-sm text-white group-hover:text-emerald-300 transition">
                    Central Vigilance Officer
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    MoSPI HQ • Full system authority, Model calibration, national batch ingestion, officer override.
                  </p>
                </div>
                <div className="mt-3 text-[10px] font-mono text-emerald-400">
                  Login as MoSPI HQ Admin &rarr;
                </div>
              </button>

              {/* DPO Varanasi */}
              <button
                type="button"
                onClick={() => loginAs('dpo_varanasi')}
                className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                  user.id === 'usr_dpo_vns'
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-slate-800 bg-[#1e293b]/50 hover:border-cyan-400/50 hover:bg-[#1e293b]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[9px] font-extrabold text-cyan-300">
                      Tier 2: District Officer
                    </span>
                    {user.id === 'usr_dpo_vns' && <Check size={16} className="text-cyan-400" />}
                  </div>
                  <h4 className="mt-2 font-black text-sm text-white group-hover:text-cyan-300 transition">
                    DPO Varanasi (U.P.)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    District Planning Officer • Review flagged proposals, field geo-camera verification, sign audit memos.
                  </p>
                </div>
                <div className="mt-3 text-[10px] font-mono text-cyan-300">
                  Login as DPO Varanasi &rarr;
                </div>
              </button>

              {/* MP Office */}
              <button
                type="button"
                onClick={() => loginAs('mp_varanasi')}
                className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                  user.role === 'mp'
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-slate-800 bg-[#1e293b]/50 hover:border-amber-400/50 hover:bg-[#1e293b]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[9px] font-extrabold text-amber-300">
                      Tier 3: Parliamentary
                    </span>
                    {user.role === 'mp' && <Check size={16} className="text-amber-400" />}
                  </div>
                  <h4 className="mt-2 font-black text-sm text-white group-hover:text-amber-300 transition">
                    Member of Parliament
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Constituency Workspace • Pre-submission AI validator, fund balance tracker, official report card.
                  </p>
                </div>
                <div className="mt-3 text-[10px] font-mono text-amber-300">
                  Login as MP Office &rarr;
                </div>
              </button>

              {/* Public Citizen */}
              <button
                type="button"
                onClick={() => loginAs('public_citizen')}
                className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                  user.role === 'citizen'
                    ? 'border-slate-400 bg-slate-500/10'
                    : 'border-slate-800 bg-[#1e293b]/50 hover:border-slate-400/50 hover:bg-[#1e293b]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-slate-500/20 px-2 py-0.5 text-[9px] font-extrabold text-slate-300">
                      Tier 4: Citizen Portal
                    </span>
                    {user.role === 'citizen' && <Check size={16} className="text-slate-200" />}
                  </div>
                  <h4 className="mt-2 font-black text-sm text-white group-hover:text-slate-300 transition">
                    Public Citizen
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Public Transparency • Near-Me map discovery, QR verification, Gram Sabha feedback submission.
                  </p>
                </div>
                <div className="mt-3 text-[10px] font-mono text-slate-300">
                  Continue as Citizen &rarr;
                </div>
              </button>
            </div>

            <div className="mt-5 flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSwitchModalOpen(false)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Restricted Access Guard Notice for Public Citizen */}
      {restrictedAlert && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setRestrictedAlert(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-rose-500/50 bg-[#0f172a] p-6 text-center shadow-2xl"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert size={26} />
            </div>
            <h3 className="text-base font-black text-white">
              Access Restricted: Officer Credentials Required
            </h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {restrictedAlert}
            </p>
            <div className="mt-5 flex justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setRestrictedAlert(null);
                  setSwitchModalOpen(true);
                }}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 transition"
              >
                Authenticate as Officer
              </button>
              <button
                type="button"
                onClick={() => setRestrictedAlert(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Header;

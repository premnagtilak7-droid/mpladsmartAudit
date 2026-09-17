'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserRole =
  | 'central_admin'  // Central Vigilance Officer (MoSPI HQ - Full Admin Access)
  | 'dpo'            // District Planning Officer (District-Restricted Access)
  | 'mp'             // Member of Parliament (Constituency & Proposal Access)
  | 'citizen';       // Public Citizen (Read-Only Public Transparency View)

export interface UserProfile {
  id: string;
  name: string;
  title: string;
  role: UserRole;
  roleLabel: string;
  district?: string;
  state?: string;
  constituency?: string;
  email: string;
  avatarUrl?: string;
  department: string;
  badge: string;
  badgeColor: string;
  token?: string;
}

export const PRESET_ACCOUNTS: Record<string, UserProfile> = {
  mospi_hq: {
    id: 'usr_hq_001',
    name: 'Dr. Rajeshwar Sharma, IAS',
    title: 'Central Vigilance Director (MoSPI HQ)',
    role: 'central_admin',
    roleLabel: 'Central Vigilance Officer',
    department: 'MoSPI Vigilance & Scheme Audit Directorate',
    badge: 'MoSPI HQ • Full Admin Access',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    email: 'cvo.director@mospi.gov.in',
  },
  dpo_varanasi: {
    id: 'usr_dpo_vns',
    name: 'Shri Anand K. Verma, PCS',
    title: 'District Planning Officer (Varanasi)',
    role: 'dpo',
    roleLabel: 'District Planning Officer (DPO)',
    district: 'Varanasi',
    state: 'Uttar Pradesh',
    department: 'District Planning Office, Collectorate Compound',
    badge: 'DPO Varanasi • District Tier',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    email: 'dpo.varanasi@up.gov.in',
  },
  dpo_pune: {
    id: 'usr_dpo_pune',
    name: 'Smt. Priya Deshmukh, IAS',
    title: 'District Planning Officer (Pune)',
    role: 'dpo',
    roleLabel: 'District Planning Officer (DPO)',
    district: 'Pune',
    state: 'Maharashtra',
    department: 'District Collectorate Office, Pune',
    badge: 'DPO Pune • District Tier',
    badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    email: 'dpo.pune@maharashtra.gov.in',
  },
  mp_varanasi: {
    id: 'usr_mp_vns',
    name: 'Parliamentary Representative Office',
    title: 'Member of Parliament (Varanasi PC)',
    role: 'mp',
    roleLabel: 'Member of Parliament (MP Office)',
    district: 'Varanasi',
    constituency: 'Varanasi',
    state: 'Uttar Pradesh',
    department: 'Sansad Sewa Kendra & Parliamentary Secretariat',
    badge: 'MP Office • Varanasi',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    email: 'mp.varanasi@sansad.nic.in',
  },
  public_citizen: {
    id: 'usr_citizen_guest',
    name: 'Verified Citizen Auditor',
    title: 'Public Citizen (Transparency View)',
    role: 'citizen',
    roleLabel: 'Public Citizen',
    department: 'Gram Sabha & Public Vigilance',
    badge: 'Citizen • Read-Only Public Audit',
    badgeColor: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
    email: 'citizen.auditor@public.nic.in',
  },
};

interface AuthContextType {
  user: UserProfile;
  isAuthenticated: boolean;
  loginAs: (presetKey: keyof typeof PRESET_ACCOUNTS) => void;
  setUserDirect: (profile: UserProfile) => void;
  logoutToCitizen: () => void;
  canAccessOfficerModules: boolean;
  canAccessAdminOnly: boolean;
  isRestrictedForCitizen: (featureName: string) => boolean;
  switchModalOpen: boolean;
  setSwitchModalOpen: (open: boolean) => void;
  restrictedAlert: string | null;
  setRestrictedAlert: (msg: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'mplad_rakshak_auth_profile';
const SESSION_TOKEN_KEY = 'mplad_rakshak_session_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Start unauthenticated. Officers explicitly select a role from /login.
  const [user, setUser] = useState<UserProfile>(PRESET_ACCOUNTS.public_citizen);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [restrictedAlert, setRestrictedAlert] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      const savedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role) {
          setUser({ ...parsed, token: savedToken || parsed.token });
        }
      }
    } catch (e) {
      console.error('Error loading auth from sessionStorage', e);
    }
  }, []);

  const loginAs = (presetKey: keyof typeof PRESET_ACCOUNTS) => {
    const selected = PRESET_ACCOUNTS[presetKey];
    if (selected) {
      const sessionProfile = { ...selected, token: selected.token || `demo-session-${selected.id}` };
      setUser(sessionProfile);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionProfile));
        sessionStorage.setItem(SESSION_TOKEN_KEY, sessionProfile.token || '');
      } catch (e) {
        console.error(e);
      }
      setSwitchModalOpen(false);
      setRestrictedAlert(null);
    }
  };

  const setUserDirect = (profile: UserProfile) => {
    const sessionProfile = { ...profile, token: profile.token || `demo-session-${profile.id}` };
    setUser(sessionProfile);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionProfile));
      sessionStorage.setItem(SESSION_TOKEN_KEY, sessionProfile.token || '');
    } catch (e) {
      console.error(e);
    }
  };

  const logoutToCitizen = () => {
    setUser(PRESET_ACCOUNTS.public_citizen);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    } catch (e) {
      console.error('Error clearing auth session', e);
    }
  };

  const isAuthenticated = user.role !== 'citizen';
  const canAccessOfficerModules = user.role === 'central_admin' || user.role === 'dpo';
  const canAccessAdminOnly = user.role === 'central_admin';

  const isRestrictedForCitizen = (featureName: string) => {
    if (user.role === 'citizen') {
      setRestrictedAlert(`Access Restricted: Officer Credentials Required to view "${featureName}". Please login as DPO or Central Vigilance Officer.`);
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loginAs,
        setUserDirect,
        logoutToCitizen,
        canAccessOfficerModules,
        canAccessAdminOnly,
        isRestrictedForCitizen,
        switchModalOpen,
        setSwitchModalOpen,
        restrictedAlert,
        setRestrictedAlert,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

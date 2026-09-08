'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { buildMockProjects, computeAnalytics } from './mockData';
import type { Analytics, Project } from './types';

export interface ProjectsState {
  projects: Project[];
  analytics: Analytics;
  loading: boolean;
  error: string | null;
  live: boolean;
  reload: () => void;
}

/**
 * Loads projects from Supabase when configured, otherwise falls back to the
 * bundled mock dataset so the UI is fully functional in the sandbox preview.
 */
export function useProjects(): ProjectsState {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(isSupabaseConfigured);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        // Mock fallback (preview / no env vars).
        await new Promise((r) => setTimeout(r, 600));
        if (cancelled) return;
        setProjects(buildMockProjects());
        setLoading(false);
        setLive(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('projects')
          .select('*')
          .order('risk_score', { ascending: false, nullsFirst: false });

        if (err) throw err;

        if (cancelled) return;
        const rows = (data ?? []) as Project[];
        if (rows.length > 0) {
          setProjects(rows);
        } else {
          // Empty real table → show mock so UI isn't blank.
          setProjects(buildMockProjects());
          setLive(false);
        }
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Failed to load projects';
        setProjects(buildMockProjects());
        setError(msg);
        setLoading(false);
        setLive(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const analytics = useMemo(() => computeAnalytics(projects), [projects]);

  return { projects, analytics, loading, error, live, reload };
}

/** Summary count used by the live status badge. */
export function useRecordCount(projects: Project[]): number {
  return projects.length;
}

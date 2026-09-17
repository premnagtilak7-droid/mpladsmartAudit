'use client';

/**
 * Compatibility entry point for the application auth contract.
 * The implementation lives in lib/AuthContext so existing dashboard imports
 * remain stable while new pages can import from the conventional context path.
 */
export {
  AuthProvider,
  PRESET_ACCOUNTS,
  useAuth,
  type UserProfile,
  type UserRole,
} from '@/lib/AuthContext';

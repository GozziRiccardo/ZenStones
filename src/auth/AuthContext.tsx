import * as React from 'react';
import type { User } from 'firebase/auth';
import { logout as signOut } from '../lib/auth';

type AuthContextValue = {
  user: User;
  nickname: string;
  logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({
  user,
  nickname,
  children,
}: {
  user: User;
  nickname: string;
  children: React.ReactNode;
}) {
  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      nickname,
      logout: () => signOut(),
    }),
    [user, nickname],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

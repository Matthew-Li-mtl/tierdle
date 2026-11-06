// Shares "who is signed in" with every component in the app.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, SessionUser } from '../shared/types.js';
import { api, refreshSession, setAccessToken } from './api.js';

interface Auth {
  user: SessionUser | null;
  signIn: (session: Session) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  return useContext(AuthContext)!;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  // When the page opens, use the refresh cookie (if there is one) to restore the session.
  useEffect(() => {
    refreshSession()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  function signIn(session: Session) {
    setAccessToken(session.accessToken);
    setUser(session.user);
  }

  async function signOut() {
    await api('/auth/signout', 'POST');
    setAccessToken(null);
    setUser(null);
  }

  // Wait until we know who the user is, so pages never load as a guest by mistake.
  if (!ready) return <p className="page">Loading...</p>;

  return <AuthContext.Provider value={{ user, signIn, signOut }}>{children}</AuthContext.Provider>;
}

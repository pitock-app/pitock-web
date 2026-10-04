"use client";

import { useEffect, useState } from "react";
import { getAuthProvider, type AuthSession } from "@/lib/auth";

export type SessionState =
  | { status: "loading"; session: null }
  | { status: "authenticated"; session: AuthSession }
  | { status: "unauthenticated"; session: null };

function toState(session: AuthSession | null): SessionState {
  return session
    ? { status: "authenticated", session }
    : { status: "unauthenticated", session: null };
}

/** Sessione corrente, aggiornata a ogni login o logout. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading", session: null });

  useEffect(() => {
    const auth = getAuthProvider();
    let active = true;
    auth.getSession().then((session) => active && setState(toState(session)));
    const unsubscribe = auth.onSessionChange((session) => setState(toState(session)));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}

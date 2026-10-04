"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAuthProvider } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/auth/routes";

/** Logout: chiude la sessione, svuota la cache dei dati e torna al login. */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await getAuthProvider().signOut();
    } finally {
      queryClient.clear();
      router.replace(LOGIN_PATH);
      router.refresh();
    }
  }

  return { signOut, pending };
}

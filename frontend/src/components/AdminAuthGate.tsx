import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiPost, getAdminToken, setAdminToken, clearAdminToken } from "../lib/api";
import { Button } from "./ui/button";

interface Props {
  children: React.ReactNode;
}

type AuthState = "checking" | "unlocked" | "locked";

async function testCredentials(password: string): Promise<boolean> {
  // Set token temporarily, try the refresh endpoint, then revert if failed
  const prev = sessionStorage.getItem("admin_token");
  setAdminToken(password);
  try {
    await apiPost<{ status: string }>("/api/simple/refresh");
    return true;
  } catch (e: unknown) {
    // If no password set on server (200 with no auth) — also passes
    // 401 = invalid, any other error we treat as "server open, pass through"
    const msg = String(e);
    if (msg.includes("401")) {
      if (prev === null) sessionStorage.removeItem("admin_token");
      else sessionStorage.setItem("admin_token", prev);
      return false;
    }
    // Server responded but with non-401 error — credentials are valid or server is open
    return true;
  }
}

export function AdminAuthGate({ children }: Props) {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getAdminToken();
    if (token) {
      setAuthState("unlocked");
    } else {
      // Check if server requires auth by probing without credentials
      fetch("/api/simple/refresh", { method: "POST" })
        .then((res) => {
          if (res.status === 401) {
            setAuthState("locked");
          } else {
            // No password configured — open access
            setAuthState("unlocked");
          }
        })
        .catch(() => setAuthState("locked"));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    const ok = await testCredentials(password.trim());
    setLoading(false);
    if (ok) {
      setAdminToken(password.trim());
      setAuthState("unlocked");
    } else {
      setError("Invalid password. Please try again.");
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setAuthState("locked");
    setPassword("");
  };

  if (authState === "checking") {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (authState === "locked") {
    return (
      <motion.div
        className="flex min-h-[60vh] items-center justify-center px-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="w-full max-w-sm">
          <motion.div
            className="rounded-2xl border border-border bg-card/40 p-8"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="flex justify-center mb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            </div>
            <div className="text-center text-lg font-semibold">Admin access</div>
            <div className="mt-1 text-center text-sm text-muted-foreground">Enter your admin password to continue.</div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                className="w-full h-10 rounded-lg border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />

              <AnimatePresence>
                {error ? (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-destructive"
                  >
                    {error}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button type="submit" disabled={loading || !password} className="w-full">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verifying…
                    </span>
                  ) : "Sign in"}
                </Button>
              </motion.div>
            </form>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // Unlocked — show children + logout button
  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={handleLogout}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
      {children}
    </>
  );
}

"use client";

export type PlanTier = "public" | "pilot" | "program" | "enterprise";

export interface AccessState {
  loggedIn: boolean;
  plan: PlanTier;
  name?: string;
  company?: string;
  email?: string;
}

const ACCESS_KEY = "planttrace:access";

export function getAccessState(): AccessState {
  if (typeof window === "undefined") {
    return { loggedIn: false, plan: "public" };
  }

  try {
    const raw = window.localStorage.getItem(ACCESS_KEY);
    if (!raw) return { loggedIn: false, plan: "public" };
    const parsed = JSON.parse(raw) as AccessState;
    if (!parsed.plan) return { loggedIn: false, plan: "public" };
    return parsed;
  } catch {
    return { loggedIn: false, plan: "public" };
  }
}

export function setAccessState(next: AccessState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, JSON.stringify(next));
}

export function clearAccessState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
}


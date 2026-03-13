"use client";

export type PlanTier = "public" | "pilot" | "program" | "enterprise";

export interface AccessState {
  loggedIn: boolean;
  plan: PlanTier;
  name?: string;
  company?: string;
  email?: string;
}

export interface OnboardingState {
  completed: boolean;
  company?: string;
  industry?: string;
  objective?: "mission_map" | "industry_tracker";
  privacyMode?: "private_by_default" | "shared_demo";
}

const ACCESS_KEY = "planttrace:access";
const ONBOARDING_KEY = "baseload:onboarding";

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

export function getOnboardingState(): OnboardingState {
  if (typeof window === "undefined") {
    return { completed: false };
  }

  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return { completed: false };
    const parsed = JSON.parse(raw) as OnboardingState;
    return parsed?.completed ? parsed : { completed: false };
  } catch {
    return { completed: false };
  }
}

export function setOnboardingState(next: OnboardingState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(next));
}

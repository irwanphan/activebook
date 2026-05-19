import { useSyncExternalStore } from "react";

const STORAGE_KEY = "activebook_admin_key";
const AUTH_EVENT = "activebook-admin-auth";

function subscribe(listener: () => void) {
  window.addEventListener(AUTH_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(AUTH_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): string | null {
  return window.sessionStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot(): null {
  return null;
}

/** Admin API key from sessionStorage; null on server and until client hydrates. */
export function useAdminSession(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setAdminSession(key: string | null) {
  if (key) {
    window.sessionStorage.setItem(STORAGE_KEY, key);
  } else {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

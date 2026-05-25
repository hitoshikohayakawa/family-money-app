export const ELEMENTARY_MODE_STORAGE_KEY = "family-money:elementary-mode";
export const ELEMENTARY_MODE_UPDATED_EVENT = "elementary-mode-updated";

export function readElementaryModePreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(ELEMENTARY_MODE_STORAGE_KEY) === "true";
}

export function writeElementaryModePreference(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ELEMENTARY_MODE_STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(
    new CustomEvent(ELEMENTARY_MODE_UPDATED_EVENT, {
      detail: { enabled },
    })
  );
}

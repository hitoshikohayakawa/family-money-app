"use client";

import { useEffect, useState } from "react";
import {
  ELEMENTARY_MODE_UPDATED_EVENT,
  readElementaryModePreference,
  writeElementaryModePreference,
} from "@/lib/elementary-mode";

export default function useElementaryMode() {
  const [elementaryMode, setElementaryModeState] = useState(false);

  useEffect(() => {
    const syncElementaryMode = () => {
      setElementaryModeState(readElementaryModePreference());
    };

    syncElementaryMode();
    window.addEventListener(ELEMENTARY_MODE_UPDATED_EVENT, syncElementaryMode);
    window.addEventListener("storage", syncElementaryMode);

    return () => {
      window.removeEventListener(ELEMENTARY_MODE_UPDATED_EVENT, syncElementaryMode);
      window.removeEventListener("storage", syncElementaryMode);
    };
  }, []);

  return {
    elementaryMode,
    setElementaryMode: (enabled: boolean) => {
      setElementaryModeState(enabled);
      writeElementaryModePreference(enabled);
    },
  };
}

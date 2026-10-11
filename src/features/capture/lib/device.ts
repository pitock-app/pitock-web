import { useSyncExternalStore } from "react";

const COARSE_POINTER = "(pointer: coarse)";

function subscribePointer(onChange: () => void) {
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** true su dispositivi touch: lì si usa la fotocamera di sistema. */
export function useIsTouchDevice() {
  return useSyncExternalStore(
    subscribePointer,
    () => window.matchMedia(COARSE_POINTER).matches,
    () => false,
  );
}

export function hasWebcamApi() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

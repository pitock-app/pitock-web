/**
 * File "caricati" in modalità mock: restano in memoria nella pagina, così gli handler MSW
 * possono restituire un `fileUrl` (blob:) per il viewer e le miniature. Spariscono al reload.
 */
const files = new Map<string, Blob>();
const urls = new Map<string, string>();

export function rememberMockFile(path: string, file: Blob) {
  const previous = urls.get(path);
  if (previous) URL.revokeObjectURL(previous);
  urls.delete(path);
  files.set(path, file);
}

/** Vero se il file è stato "caricato" (come l'esistenza dell'oggetto su Storage). */
export function hasMockFile(path: string): boolean {
  return files.has(path);
}

/** URL blob: del file caricato in modalità mock, se esiste. */
export function mockFileUrl(path: string): string | undefined {
  const file = files.get(path);
  if (!file) return undefined;
  let url = urls.get(path);
  if (!url) {
    url = URL.createObjectURL(file);
    urls.set(path, url);
  }
  return url;
}

export function forgetMockFile(path: string) {
  const url = urls.get(path);
  if (url) URL.revokeObjectURL(url);
  urls.delete(path);
  files.delete(path);
}

export function resetMockFiles() {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
  files.clear();
}

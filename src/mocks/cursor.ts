/** Cursore opaco delle liste paginate: ultimo elemento della pagina (createdAt, id). */
export type Cursor = { createdAt: string; id: string };

export function encodeCursor(cursor: Cursor): string {
  return btoa(JSON.stringify(cursor));
}

export function decodeCursor(value: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(atob(value));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Cursor).createdAt === "string" &&
      typeof (parsed as Cursor).id === "string"
    ) {
      return parsed as Cursor;
    }
  } catch {
    // Cursore non valido.
  }
  return null;
}

/** Ruota un'immagine di 90° in senso orario e la restituisce come JPEG. */
export async function rotateImage90(file: Blob, quality = 0.92): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.height;
    canvas.height = bitmap.width;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D non disponibile");
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
    context.drawImage(bitmap, 0, 0);
    return await canvasToJpeg(canvas, quality);
  } finally {
    bitmap.close();
  }
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Conversione non riuscita"))),
      "image/jpeg",
      quality,
    );
  });
}

/** Fotogramma corrente della webcam come JPEG. */
export function captureVideoFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("Canvas 2D non disponibile"));
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvasToJpeg(canvas);
}

/** Nome del file di uno scatto, es. "foto-2026-10-04-123000.jpg". */
export function photoFileName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `foto-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.jpg`;
}

type Size = { width: number; height: number };

/** Larghezza massima dell'immagine unita: basta per leggere lo scontrino, il resto pesa e basta. */
export const STITCH_MAX_WIDTH = 2000;
/** Limite di pixel del canvas dei browser (iOS: circa 16,7 milioni). */
const STITCH_MAX_PIXELS = 16_000_000;
/** Fascia grigia tra un pezzo e l'altro: aiuta il modello a vedere dove si toccano. */
export const STITCH_GAP = 16;

/**
 * Posizione dei pezzi nell'immagine unita, dall'alto in basso: tutti alla stessa larghezza
 * (quella del pezzo più stretto, al massimo `STITCH_MAX_WIDTH`), ridotti ancora se l'immagine
 * supererebbe i limiti del canvas.
 */
export function stitchLayout(sizes: Size[]) {
  const ratios = sizes.map((size) => size.height / size.width);
  const gaps = STITCH_GAP * (sizes.length - 1);
  let width = Math.min(STITCH_MAX_WIDTH, ...sizes.map((size) => size.width));
  const heightAt = (w: number) => ratios.reduce((sum, ratio) => sum + Math.round(w * ratio), gaps);
  while (width > 1 && width * heightAt(width) > STITCH_MAX_PIXELS) {
    width = Math.floor(width * 0.95);
  }
  let y = 0;
  const pieces = ratios.map((ratio) => {
    const piece = { y, height: Math.round(width * ratio) };
    y += piece.height + STITCH_GAP;
    return piece;
  });
  return { width, height: heightAt(width), pieces };
}

/** Unisce le foto di uno scontrino lungo in un'unica immagine verticale (JPEG). */
export async function stitchVertical(files: Blob[], quality = 0.9): Promise<Blob> {
  const bitmaps = await Promise.all(files.map((file) => createImageBitmap(file)));
  try {
    const layout = stitchLayout(bitmaps);
    const canvas = document.createElement("canvas");
    canvas.width = layout.width;
    canvas.height = layout.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D non disponibile");
    context.fillStyle = "#9ca3af";
    context.fillRect(0, 0, canvas.width, canvas.height);
    bitmaps.forEach((bitmap, index) => {
      const { y, height } = layout.pieces[index];
      context.drawImage(bitmap, 0, y, layout.width, height);
    });
    return await canvasToJpeg(canvas, quality);
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

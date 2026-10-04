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

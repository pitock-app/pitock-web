"use client";

import { Camera, ImageUp, VideoOff } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { it } from "@/lib/i18n/it";
import { hasWebcamApi, useIsTouchDevice } from "./lib/device";
import { isPdf } from "./lib/file-types";
import { PhotoReview, PRIMARY_CLASS } from "./PhotoReview";
import { PiecesStrip } from "./PiecesStrip";
import { validateFiles } from "./lib/validate-files";
import { captureVideoFrame, photoFileName, rotateImage90, stitchVertical } from "./lib/image-tools";
import { useUploadQueue } from "./store/upload-queue.store";

const t = it.capture.camera;

type Photo = { file: File; url: string; capturedAt?: string };
type WebcamState = "idle" | "starting" | "live" | "unavailable";

/** Tab Foto: fotocamera posteriore su mobile, webcam su desktop, file come ripiego. */
export function CameraCapture() {
  const isTouch = useIsTouchDevice();
  const add = useUploadQueue((state) => state.add);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [rotating, setRotating] = useState(false);
  // Pezzi già scattati di uno scontrino lungo, dall'alto in basso.
  const [pieces, setPieces] = useState<Photo[]>([]);
  const [stitching, setStitching] = useState(false);
  const [webcam, setWebcam] = useState<WebcamState>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Pulsante principale della vista corrente: riceve il focus quando la vista cambia.
  const primaryRef = useRef<HTMLButtonElement>(null);
  const view = photo ? "review" : webcam === "live" ? "live" : "start";
  const previousView = useRef(view);
  useEffect(() => {
    if (previousView.current === view) return;
    previousView.current = view;
    primaryRef.current?.focus();
  }, [view]);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setWebcam((state) => (state === "unavailable" ? state : "idle"));
  }, []);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo]);
  const piecesRef = useRef(pieces);
  useEffect(() => {
    piecesRef.current = pieces;
  }, [pieces]);
  useEffect(() => () => piecesRef.current.forEach((piece) => URL.revokeObjectURL(piece.url)), []);

  // Collega lo stream al <video> ogni volta che l'elemento viene montato.
  const videoRef = useCallback(
    (video: HTMLVideoElement | null) => {
      if (video && streamRef.current && webcam === "live") {
        video.srcObject = streamRef.current;
        void video.play().catch(() => undefined);
      }
    },
    [webcam],
  );
  const videoElement = useRef<HTMLVideoElement | null>(null);

  async function startWebcam() {
    if (!hasWebcamApi()) {
      setWebcam("unavailable");
      return;
    }
    setWebcam("starting");
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setWebcam("live");
    } catch {
      setWebcam("unavailable");
    }
  }

  function showPhoto(file: File, capturedAt?: string) {
    setPhoto({ file, url: URL.createObjectURL(file), capturedAt });
  }

  async function shoot() {
    const video = videoElement.current;
    if (!video || !video.videoWidth) return;
    try {
      const blob = await captureVideoFrame(video);
      const now = new Date();
      showPhoto(new File([blob], photoFileName(now), { type: "image/jpeg" }), now.toISOString());
    } catch {
      toast.error(t.webcamUnavailable);
    }
  }

  function onPickFile(event: ChangeEvent<HTMLInputElement>, fromCamera: boolean) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const { rejected } = validateFiles([file]);
    const reason = isPdf(file) ? it.capture.dropzone.invalidType : rejected[0]?.reason;
    if (reason) {
      toast.error(`${file.name}: ${reason}`);
      return;
    }
    showPhoto(file, fromCamera ? new Date().toISOString() : undefined);
  }

  async function rotate() {
    if (!photo) return;
    setRotating(true);
    try {
      const blob = await rotateImage90(photo.file);
      const name = photo.file.name.replace(/\.[^.]+$/, "") + ".jpg";
      showPhoto(new File([blob], name, { type: "image/jpeg" }), photo.capturedAt);
    } catch {
      toast.error(t.rotateFailed);
    } finally {
      setRotating(false);
    }
  }

  function discardPieces() {
    pieces.forEach((piece) => URL.revokeObjectURL(piece.url));
    setPieces([]);
  }

  /** Il pezzo in anteprima entra tra quelli dello scontrino; si torna a scattare. */
  function addPiece() {
    if (!photo) return;
    setPieces((current) => [...current, { ...photo, url: URL.createObjectURL(photo.file) }]);
    setPhoto(null);
  }

  /** Mette in coda la foto, oppure l'unione dei pezzi (più quello in anteprima). */
  async function confirm() {
    const all = [...pieces, ...(photo ? [photo] : [])];
    if (all.length === 0) return;
    let file = all[0].file;
    if (all.length > 1) {
      setStitching(true);
      try {
        const blob = await stitchVertical(all.map((piece) => piece.file));
        file = new File([blob], photoFileName(new Date()), { type: "image/jpeg" });
      } catch {
        toast.error(t.stitchFailed);
        return;
      } finally {
        setStitching(false);
      }
    }
    add([{ file, source: "camera", capturedAt: all[0].capturedAt }]);
    toast.success(t.added);
    setPhoto(null);
    discardPieces();
  }

  const piecesStrip = (
    <PiecesStrip
      pieces={pieces}
      showActions={!photo}
      stitching={stitching}
      onConfirm={() => void confirm()}
      onDiscard={discardPieces}
    />
  );

  const fileFallback = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label={t.uploadInstead}
        onChange={(event) => onPickFile(event, false)}
      />
      <Button
        type="button"
        variant="outline"
        className="h-11"
        onClick={() => fileInputRef.current?.click()}
      >
        <ImageUp aria-hidden />
        {t.uploadInstead}
      </Button>
    </>
  );

  if (photo) {
    return (
      <PhotoReview
        url={photo.url}
        piecesStrip={piecesStrip}
        piecesCount={pieces.length}
        rotating={rotating}
        stitching={stitching}
        primaryRef={primaryRef}
        onRotate={() => void rotate()}
        onRetake={() => setPhoto(null)}
        onAddPiece={addPiece}
        onConfirm={() => void confirm()}
      />
    );
  }

  if (isTouch) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        {piecesStrip}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-label={t.takePhoto}
          onChange={(event) => onPickFile(event, true)}
        />
        <Button
          ref={primaryRef}
          type="button"
          className={`h-16 w-full max-w-xs gap-2 rounded-2xl text-lg ${PRIMARY_CLASS}`}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="size-6" aria-hidden />
          {t.takePhoto}
        </Button>
        <p className="text-muted-foreground text-sm">{t.takePhotoHint}</p>
        <p className="text-muted-foreground text-sm">{t.orUpload}</p>
        {fileFallback}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      {piecesStrip}
      {webcam === "live" ? (
        <>
          <video
            ref={(element) => {
              videoElement.current = element;
              videoRef(element);
            }}
            aria-label={t.webcamPreview}
            playsInline
            muted
            className="bg-muted aspect-video w-full max-w-2xl rounded-xl border object-cover"
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              ref={primaryRef}
              type="button"
              className={`h-11 px-6 ${PRIMARY_CLASS}`}
              onClick={shoot}
            >
              <Camera aria-hidden />
              {t.shoot}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={stopWebcam}>
              <VideoOff aria-hidden />
              {t.stopWebcam}
            </Button>
          </div>
        </>
      ) : (
        <>
          {webcam === "unavailable" ? (
            <p role="status" className="text-muted-foreground max-w-md text-sm">
              {t.webcamUnavailable}
            </p>
          ) : (
            <>
              <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
                <Camera className="size-6" aria-hidden />
              </span>
              <p className="text-muted-foreground max-w-md text-sm">{t.webcamHint}</p>
              <Button
                ref={primaryRef}
                type="button"
                className={`h-11 px-5 ${PRIMARY_CLASS}`}
                onClick={startWebcam}
                disabled={webcam === "starting"}
              >
                <Camera aria-hidden />
                {webcam === "starting" ? t.startingWebcam : t.startWebcam}
              </Button>
              <p className="text-muted-foreground text-sm">{t.orUpload}</p>
            </>
          )}
          {fileFallback}
        </>
      )}
    </div>
  );
}

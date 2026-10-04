"use client";

import { Camera, Check, ImageUp, RefreshCw, RotateCw, VideoOff } from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { it } from "@/lib/i18n/it";
import { isPdf } from "./lib/file-types";
import { validateFiles } from "./lib/validate-files";
import { captureVideoFrame, photoFileName, rotateImage90 } from "./lib/image-tools";
import { useUploadQueue } from "./store/upload-queue.store";

const t = it.capture.camera;

type Photo = { file: File; url: string; capturedAt?: string };
type WebcamState = "idle" | "starting" | "live" | "unavailable";

const COARSE_POINTER = "(pointer: coarse)";

function subscribePointer(onChange: () => void) {
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** true su dispositivi touch: lì si usa la fotocamera di sistema. */
function useIsTouchDevice() {
  return useSyncExternalStore(
    subscribePointer,
    () => window.matchMedia(COARSE_POINTER).matches,
    () => false,
  );
}

function hasWebcamApi() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

const primaryClass = "bg-brand text-brand-foreground hover:bg-brand/90";

/** Tab Foto: fotocamera posteriore su mobile, webcam su desktop, file come ripiego. */
export function CameraCapture() {
  const isTouch = useIsTouchDevice();
  const add = useUploadQueue((state) => state.add);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [rotating, setRotating] = useState(false);
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

  function confirmPhoto() {
    if (!photo) return;
    add([{ file: photo.file, source: "camera", capturedAt: photo.capturedAt }]);
    toast.success(t.added);
    setPhoto(null);
  }

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
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale (blob:) */}
        <img
          src={photo.url}
          alt={t.preview}
          className="bg-muted max-h-[60vh] w-auto max-w-full rounded-xl border object-contain"
        />
        <div className="flex w-full flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={rotate}
            disabled={rotating}
          >
            <RotateCw aria-hidden />
            {t.rotate}
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => setPhoto(null)}>
            <RefreshCw aria-hidden />
            {t.retake}
          </Button>
          <Button
            ref={primaryRef}
            type="button"
            className={`h-11 px-5 ${primaryClass}`}
            onClick={confirmPhoto}
            disabled={rotating}
          >
            <Check aria-hidden />
            {t.use}
          </Button>
        </div>
      </div>
    );
  }

  if (isTouch) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
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
          className={`h-16 w-full max-w-xs gap-2 rounded-2xl text-lg ${primaryClass}`}
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
              className={`h-11 px-6 ${primaryClass}`}
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
                className={`h-11 px-5 ${primaryClass}`}
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

"use client";

import { Camera, FileUp, PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { it } from "@/lib/i18n/it";
import { CameraCapture } from "./CameraCapture";
import { FileDropzone } from "./FileDropzone";
import { UploadQueue } from "./UploadQueue";

const t = it.capture;

type AddReceiptTabsProps = {
  /** Contenuto del tab Manuale (il form arriva dalla feature manual-entry). */
  manual: ReactNode;
};

const triggerClass = "min-h-11 gap-1.5 px-2 text-sm sm:gap-2 sm:px-3";

/** Pagina /add: tab Foto · File · Manuale, con la coda sotto Foto e File. */
export function AddReceiptTabs({ manual }: AddReceiptTabsProps) {
  return (
    <Tabs defaultValue="camera" className="gap-6">
      <TabsList aria-label={t.tabsLabel} className="h-13! w-full sm:w-fit">
        <TabsTrigger value="camera" className={triggerClass}>
          <Camera aria-hidden />
          {t.tabs.camera}
        </TabsTrigger>
        <TabsTrigger value="file" className={triggerClass}>
          <FileUp aria-hidden />
          {t.tabs.file}
        </TabsTrigger>
        <TabsTrigger value="manual" className={triggerClass}>
          <PencilLine aria-hidden />
          {t.tabs.manual}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="camera" className="flex flex-col gap-8">
        <CameraCapture />
        <UploadQueue />
      </TabsContent>
      <TabsContent value="file" className="flex flex-col gap-8">
        <FileDropzone />
        <UploadQueue />
      </TabsContent>
      <TabsContent value="manual">{manual}</TabsContent>
    </Tabs>
  );
}

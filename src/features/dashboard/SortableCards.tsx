"use client";

import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { applyOrder, useDashboardLayout } from "./lib/layout";

const t = it.dashboard.layout;

/** Comandi della card dentro una griglia ordinabile: maniglia di trascinamento e apertura. */
export type CardControls = {
  /** Maniglia già collegata al trascinamento. */
  handle: ReactNode;
  collapsed: boolean;
  toggle(): void;
  dragging: boolean;
};

/** Pulsante quadrato dell'header della card: 44px al tocco, 36px con il mouse. */
export const CARD_CONTROL =
  "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-11 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-[3px] sm:size-9";

const CardControlsContext = createContext<CardControls | null>(null);

/** Null fuori da una griglia ordinabile: la card resta fissa e sempre aperta. */
export function useCardControls() {
  return useContext(CardControlsContext);
}

/**
 * La card va dove sta il dito o il puntatore; fuori da ogni card (negli spazi della griglia)
 * vale la più vicina. Con il solo centro della card, una card alta su mobile andrebbe
 * trascinata ben oltre la destinazione.
 */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCenter(args);
};

function SortableCard({ id, wide, children }: { id: string; wide?: boolean; children: ReactNode }) {
  const { layout, toggleCollapsed } = useDashboardLayout();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const collapsed = layout.collapsed.includes(id);
  return (
    <div
      ref={setNodeRef}
      data-card-id={id}
      className={cn(
        "min-w-0 [&>section]:h-full",
        wide && "lg:col-span-2",
        // Chiusa non si allunga all'altezza della card accanto.
        collapsed && "self-start",
        isDragging && "relative z-10",
      )}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <CardControlsContext
        value={{
          handle: (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              // Il nome è "Sposta" seguito dal titolo della card.
              aria-labelledby={`${id}-move ${id}-title`}
              className={cn(
                CARD_CONTROL,
                "-my-2 -ml-2 touch-none sm:-my-1",
                isDragging ? "cursor-grabbing" : "cursor-grab",
              )}
            >
              <span id={`${id}-move`} hidden>
                {t.move}
              </span>
              <GripVertical className="size-4" aria-hidden />
            </button>
          ),
          collapsed,
          toggle: () => toggleCollapsed(id),
          dragging: isDragging,
        }}
      >
        {children}
      </CardControlsContext>
    </div>
  );
}

type SortableCardsProps = {
  /** Sezione della dashboard: l'ordine si salva per sezione. */
  section: string;
  /** Card nell'ordine di default; `id` è lo stesso della ChartCard. */
  cards: { id: string; node: ReactNode; /** Occupa tutta la riga su desktop. */ wide?: boolean }[];
  className?: string;
};

/**
 * Griglia di card che si possono riordinare trascinando la maniglia (mouse, touch o tastiera:
 * spazio per prendere, frecce per spostare) e chiudere. La disposizione resta salvata nel
 * browser.
 */
export function SortableCards({ section, cards, className }: SortableCardsProps) {
  const { layout, setOrder } = useDashboardLayout();
  const ids = applyOrder(
    cards.map((card) => card.id),
    layout.order[section],
  );
  const byId = new Map(cards.map((card) => [card.id, card]));
  const sensors = useSensors(
    // La maniglia ha touch-action: none, quindi lo stesso sensore vale anche al tocco.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const titleOf = (id: string | number) =>
    document.getElementById(`${id}-title`)?.textContent ?? String(id);
  const position = (id: string | number) => ids.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t.picked(titleOf(active.id), position(active.id), ids.length),
    onDragOver: ({ active, over }) =>
      over ? t.moved(titleOf(active.id), position(over.id), ids.length) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? t.dropped(titleOf(active.id), position(over.id), ids.length) : undefined,
    onDragCancel: ({ active }) => t.cancelled(titleOf(active.id)),
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setOrder(section, arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t.instructions } }}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
          {ids.map((id) => (
            <SortableCard key={id} id={id} wide={byId.get(id)?.wide}>
              {byId.get(id)?.node}
            </SortableCard>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

"use client";

import { useState } from "react";
import { Layer, ResponsiveContainer, Sankey, Tooltip } from "recharts";
import type { LinkProps, NodeProps } from "recharts/types/chart/Sankey";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { ChartCard, DataTable, NoData, tooltipStyle } from "./ChartCard";
import { categoryColor } from "./lib/colors";
import type { CategoryLine } from "./lib/dataset";
import { spendingFlow, type FlowData } from "./lib/insights";

const t = it.dashboard;

type FlowNode = FlowData["nodes"][number];

const nodeKey = (node: FlowNode) => `${node.kind}:${node.name}`;

/** Etichetta che sta nel margine del grafico; il nome intero resta nella tabella. */
const shortName = (name: string) => (name.length > 18 ? `${name.slice(0, 17)}…` : name);

function nodeName(node: FlowNode) {
  return node.kind === "category" && node.category ? it.categories[node.category] : node.name;
}

type SpendingFlowProps = {
  lines: CategoryLine[];
  colorOf: (store: string | null) => string;
};

/**
 * Flusso della spesa (Sankey): a sinistra i negozi, a destra le categorie, ogni nastro largo
 * quanto la spesa che li collega. Passando sopra un nodo si evidenziano solo i suoi nastri.
 */
export function SpendingFlow({ lines, colorOf }: SpendingFlowProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const flow = spendingFlow(lines, { otherStores: t.flow.otherStores, noStore: t.flow.noStore });
  const storeCount = flow.nodes.filter((node) => node.kind === "store").length;
  const colorOfNode = (node: FlowNode) =>
    node.kind === "category" && node.category
      ? categoryColor(node.category)
      : colorOf(
          node.store === t.flow.otherStores || node.store === t.flow.noStore
            ? null
            : (node.store ?? null),
        );
  const height = Math.max(
    260,
    Math.min(520, Math.max(storeCount, flow.nodes.length - storeCount) * 48),
  );

  function FlowNodeShape({ x, y, width, height, payload }: NodeProps) {
    // Recharts copia i nodi dei dati aggiungendo le coordinate: i campi originali restano.
    const node = payload as unknown as FlowNode & { value: number };
    const left = node.kind === "store";
    const dim = hovered !== null && hovered !== nodeKey(node);
    return (
      <Layer>
        <rect
          x={x}
          y={y}
          width={width}
          height={Math.max(height, 2)}
          rx={3}
          fill={colorOfNode(node)}
          opacity={dim ? 0.35 : 1}
          onMouseEnter={() => setHovered(nodeKey(node))}
          onMouseLeave={() => setHovered(null)}
        />
        <text
          x={left ? x - 8 : x + width + 8}
          y={y + height / 2}
          textAnchor={left ? "end" : "start"}
          dominantBaseline="middle"
          fontSize={12}
          fill="var(--foreground)"
          opacity={dim ? 0.4 : 1}
        >
          <tspan fontWeight={600}>{shortName(nodeName(node))}</tspan>
          <tspan dx={6} fill="var(--muted-foreground)">
            {formatCompactCurrency(Number(node.value))}
          </tspan>
        </text>
      </Layer>
    );
  }

  function FlowLinkShape(props: LinkProps) {
    const {
      sourceX,
      targetX,
      sourceY,
      targetY,
      sourceControlX,
      targetControlX,
      linkWidth,
      index,
      payload,
    } = props;
    const source = payload.source as unknown as FlowNode;
    const target = payload.target as unknown as FlowNode;
    const id = `flow-link-${index}`;
    const active = hovered === null || hovered === nodeKey(source) || hovered === nodeKey(target);
    return (
      <Layer>
        <defs>
          <linearGradient
            id={id}
            // In coordinate del grafico: un nastro dritto ha il riquadro alto zero e con
            // objectBoundingBox il gradiente (e quindi il nastro) non si disegnerebbe.
            gradientUnits="userSpaceOnUse"
            x1={sourceX}
            y1={0}
            x2={targetX}
            y2={0}
          >
            <stop offset="0%" stopColor={colorOfNode(source)} />
            <stop offset="100%" stopColor={colorOfNode(target)} />
          </linearGradient>
        </defs>
        <path
          d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={Math.max(linkWidth, 1)}
          strokeOpacity={active ? 0.45 : 0.08}
          className="transition-[stroke-opacity] duration-200"
        >
          <title>{`${nodeName(source)} → ${nodeName(target)}: ${formatCurrency(Number(payload.value))}`}</title>
        </path>
      </Layer>
    );
  }

  return (
    <ChartCard
      id="flow"
      title={t.flow.title}
      description={t.flow.description}
      table={
        flow.links.length > 0 && (
          <DataTable
            caption={t.flow.title}
            headers={[t.flow.from, t.flow.to, t.amount]}
            rows={[...flow.links]
              .sort((a, b) => b.value - a.value)
              .map((link) => ({
                key: `${link.source}-${link.target}`,
                cells: [
                  nodeName(flow.nodes[link.source]),
                  nodeName(flow.nodes[link.target]),
                  formatCurrency(link.value),
                ],
              }))}
          />
        )
      }
    >
      {storeCount === 0 || flow.links.length === 0 ? (
        <NoData>{t.flow.tooFew}</NoData>
      ) : (
        // Grafico nascosto ai lettori di schermo (c'è la tabella): fuori anche dal Tab.
        <div className="w-full overflow-x-auto" aria-hidden tabIndex={-1}>
          <div className="min-w-[36rem]" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={flow}
                accessibilityLayer={false}
                nodePadding={14}
                nodeWidth={10}
                linkCurvature={0.5}
                iterations={64}
                margin={{ top: 8, right: 170, bottom: 8, left: 170 }}
                node={FlowNodeShape}
                link={FlowLinkShape}
              >
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => formatCurrency(Number(value))}
                />
              </Sankey>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// Genera src/lib/api/enums.ts dagli enum del contratto OpenAPI.
// I tipi arrivano da schema.d.ts; qui servono i valori a runtime (select, validazione).
import { readFileSync, writeFileSync } from "node:fs";

const ENUMS = {
  categories: "Category",
  paymentMethods: "PaymentMethod",
  mimeTypes: "MimeType",
  receiptSources: "ReceiptSource",
  receiptStatuses: "ReceiptStatus",
  aiProviders: "Provider",
  aiModes: "AiMode",
  // Enum dentro una proprietà: [schema, proprietà].
};

const spec = JSON.parse(readFileSync("openapi/openapi.json", "utf8"));
const schemas = spec.components?.schemas ?? {};

let out = `// File generato da scripts/api-enums.mjs (pnpm api:types): non modificarlo a mano.
import type { components } from "./schema";

type Schemas = components["schemas"];
/** Errore di compilazione se l'array non contiene esattamente i valori dell'enum. */
type Exact<T, U> = [T] extends [U] ? ([U] extends [T] ? true : never) : never;
`;

for (const [name, source] of Object.entries(ENUMS)) {
  const [schemaName, property] = Array.isArray(source) ? source : [source];
  const schema = property ? schemas[schemaName]?.properties?.[property] : schemas[schemaName];
  const values = schema?.enum;
  const label = property ? `${schemaName}.${property}` : schemaName;
  if (!Array.isArray(values)) throw new Error(`Enum ${label} non trovato nel contratto`);
  const type = property
    ? `NonNullable<Schemas["${schemaName}"]["${property}"]>`
    : `Schemas["${schemaName}"]`;
  out += `
export const ${name} = ${JSON.stringify(values)} as const;
export const ${name}Exact: Exact<(typeof ${name})[number], ${type}> = true;
`;
}

writeFileSync("src/lib/api/enums.ts", out);

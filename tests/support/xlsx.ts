// Pembangkit XLSX sintetis minimal untuk tes (file .xlsx tidak di-commit, lihat .gitignore).
import { strToU8, zipSync } from "fflate";

export type XlsxCell =
  string | number | boolean | null | { formula: string; cached?: number } | { error: string };

export interface XlsxSheet {
  name: string;
  rows: XlsxCell[][];
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const REL_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
const DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT = "application/vnd.openxmlformats-officedocument.spreadsheetml";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function column(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function cellXml(value: XlsxCell, ref: string, strings: string[]): string {
  if (value === null) return "";
  if (typeof value === "string") {
    strings.push(value);
    return `<c r="${ref}" t="s"><v>${strings.length - 1}</v></c>`;
  }
  if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  if ("error" in value) return `<c r="${ref}" t="e"><v>${esc(value.error)}</v></c>`;
  const cached = value.cached === undefined ? "" : `<v>${value.cached}</v>`;
  return `<c r="${ref}"><f>${esc(value.formula)}</f>${cached}</c>`;
}

function sheetXml(rows: XlsxCell[][], strings: string[]): string {
  const body = rows
    .map((row, r) => {
      const cells = row.map((v, c) => cellXml(v, `${column(c)}${r + 1}`, strings)).join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet ${NS}><sheetData>${body}</sheetData></worksheet>`;
}

export function buildXlsx(sheets: XlsxSheet[], extra: Record<string, string> = {}): Uint8Array {
  const strings: string[] = [];
  const files: Record<string, Uint8Array> = {};
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows, strings));
  });
  const overrides = sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${CT}.worksheet+xml"/>`,
    )
    .join("");
  files["[Content_Types].xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="${CT}.sheet.main+xml"/>` +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="${CT}.sharedStrings+xml"/>${overrides}</Types>`,
  );
  files["_rels/.rels"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PKG}">` +
      `<Relationship Id="rId1" Type="${DOC}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  const sheetRefs = sheets
    .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");
  files["xl/workbook.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><workbook ${NS} ${REL_NS}><sheets>${sheetRefs}</sheets></workbook>`,
  );
  const rels = sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="${DOC}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("");
  files["xl/_rels/workbook.xml.rels"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PKG}">${rels}` +
      `<Relationship Id="rIdS" Type="${DOC}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
  );
  files["xl/sharedStrings.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><sst ${NS}>${strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`,
  );
  for (const [name, content] of Object.entries(extra)) files[name] = strToU8(content);
  return zipSync(files);
}

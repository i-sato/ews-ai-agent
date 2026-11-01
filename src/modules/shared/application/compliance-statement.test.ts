import { describe, expect, it } from "vitest";
import { currentComplianceStatement } from "./compliance-statement";

describe("currentComplianceStatement", () => {
  it("menyajikan versi, tanggal berlaku Indonesia, dan status draf", () => {
    const view = currentComplianceStatement();
    expect(view).toMatchObject({ version: "0.1", effectiveDateLabel: "31 Oktober 2026" });
    expect(view.isDraft).toBe(true);
    expect(view.text).toContain("UU No. 27 Tahun 2022");
  });
});

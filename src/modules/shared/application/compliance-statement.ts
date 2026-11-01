import { COMPLIANCE_STATEMENT, formatIndonesianDate } from "../domain/compliance-statement";

export type ComplianceStatementView = {
  version: string;
  effectiveDateLabel: string;
  isDraft: boolean;
  text: string;
};

/** Pernyataan kepatuhan yang berlaku, siap ditampilkan (login, halaman kepatuhan, laporan). */
export function currentComplianceStatement(): ComplianceStatementView {
  const { version, effectiveDate, status, text } = COMPLIANCE_STATEMENT;
  return {
    version,
    effectiveDateLabel: formatIndonesianDate(effectiveDate),
    isDraft: status === "draft",
    text,
  };
}

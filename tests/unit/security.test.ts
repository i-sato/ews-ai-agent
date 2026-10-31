import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "@/lib/security/csv";
import { isAllowedUrl } from "@/lib/security/url-allowlist";

describe("escapeCsvCell (SH-INPUT-04)", () => {
  it.each([
    ["=SUM(A1)", "'=SUM(A1)"],
    ["+62812", "'+62812"],
    ["-1", "'-1"],
    ["@cmd", "'@cmd"],
    ["Instansi, Contoh", '"Instansi, Contoh"'],
    ['Kata "kutip"', '"Kata ""kutip"""'],
    ["biasa", "biasa"],
  ])("%s → %s", (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected);
  });
});

describe("isAllowedUrl (SH-API-02)", () => {
  it.each([
    ["https://sheets.googleapis.com/v4/spreadsheets/x", true],
    ["https://digitalent.komdigi.go.id/pelatihan/13109", true],
    ["http://sheets.googleapis.com/", false],
    ["https://sheets.googleapis.com:8443/", false],
    ["https://169.254.169.254/latest/meta-data", false],
    ["https://evil.test/?u=https://docs.google.com", false],
    ["file:///etc/passwd", false],
    ["bukan url", false],
  ])("%s → %s", (url, expected) => {
    expect(isAllowedUrl(url)).toBe(expected);
  });
});

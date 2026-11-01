import { describe, expect, it } from "vitest";
import { parseSpreadsheetUrl } from "./spreadsheet-url";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abc";

describe("parseSpreadsheetUrl", () => {
  it("mengambil ID spreadsheet dan gid", () => {
    expect(
      parseSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=12345`),
    ).toEqual({
      spreadsheetId: ID,
      gid: "12345",
    });
    expect(parseSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit?gid=7`)).toEqual({
      spreadsheetId: ID,
      gid: "7",
    });
  });

  it("gid kosong bila tidak disebut", () => {
    expect(parseSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${ID}`)).toEqual({
      spreadsheetId: ID,
      gid: null,
    });
  });

  it.each([
    ["host lain", `https://docs.google.evil.test/spreadsheets/d/${ID}/edit`],
    ["http", `http://docs.google.com/spreadsheets/d/${ID}/edit`],
    ["port", `https://docs.google.com:8443/spreadsheets/d/${ID}/edit`],
    ["bukan spreadsheet", `https://docs.google.com/document/d/${ID}/edit`],
    ["ID terlalu pendek", "https://docs.google.com/spreadsheets/d/abc/edit"],
    ["bukan URL", "spreadsheet saya"],
  ])("menolak %s", (_, raw) => {
    expect(parseSpreadsheetUrl(raw)).toBeNull();
  });
});

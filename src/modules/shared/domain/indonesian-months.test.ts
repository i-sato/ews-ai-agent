import { describe, expect, it } from "vitest";
import { monthName, parseMonth } from "./indonesian-months";

describe("bulan Indonesia", () => {
  it.each([
    ["Sept", 9],
    ["AGUSTUS", 8],
    ["Okt.", 10],
    ["Mei", 5],
    ["Desember", 12],
    ["Xyz", null],
    ["Ok", null],
  ])("parseMonth(%s) = %s", (token, expected) => {
    expect(parseMonth(token)).toBe(expected);
  });

  it("monthName", () => {
    expect(monthName(10)).toBe("Oktober");
    expect(() => monthName(0)).toThrow(RangeError);
  });
});

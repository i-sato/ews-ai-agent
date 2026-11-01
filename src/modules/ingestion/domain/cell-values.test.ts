import { describe, expect, it } from "vitest";
import { parseCount, parsePercentage } from "./cell-values";

describe("parsePercentage", () => {
  it.each([
    ["41", 41],
    [" 41 ", 41],
    ["41%", 41],
    ["41,5", 41.5],
    ["41.5", 41.5],
    ["0", 0],
    ["100", 100],
  ])("%s → %d", (raw, value) => {
    expect(parsePercentage(raw)).toEqual({ kind: "value", value });
  });

  it("kosong tidak dianggap 0%", () => {
    expect(parsePercentage("")).toEqual({ kind: "empty" });
    expect(parsePercentage("   ")).toEqual({ kind: "empty" });
  });

  it("galat formula tidak diolah sebagai angka", () => {
    expect(parsePercentage("#REF!")).toEqual({ kind: "formula_error" });
    expect(parsePercentage("#DIV/0!")).toEqual({ kind: "formula_error" });
  });

  it.each(["101", "-1", "abc", "4 1", "41%%", "1.234,5"])("tidak valid: %s", (raw) => {
    expect(parsePercentage(raw)).toEqual({ kind: "invalid" });
  });
});

describe("parseCount", () => {
  it.each([
    ["41", 41],
    [" 0 ", 0],
    ["1.234", 1234],
    ["78.319", 78319],
  ])("%s → %d", (raw, value) => {
    expect(parseCount(raw)).toBe(value);
  });

  it.each(["", "#REF!", "4,5", "-3", "abc", "12.34"])("bukan jumlah: %s", (raw) => {
    expect(parseCount(raw)).toBeNull();
  });
});

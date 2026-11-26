import { describe, expect, it } from "vitest";
import { parsePagination, parseSearch, toPage } from "./pagination";

describe("pagination", () => {
  it("reads desde and limite with defaults", () => {
    expect(parsePagination({})).toEqual({ desde: 0, limite: 10 });
    expect(parsePagination({}, 30)).toEqual({ desde: 0, limite: 30 });
    expect(parsePagination({ desde: "20", limite: "5" })).toEqual({ desde: 20, limite: 5 });
  });

  it("corrects invalid values instead of failing", () => {
    expect(parsePagination({ desde: "-3", limite: "0" })).toEqual({ desde: 0, limite: 1 });
    expect(parsePagination({ desde: "abc", limite: "x" })).toEqual({ desde: 0, limite: 10 });
    expect(parsePagination({ desde: ["4", "8"], limite: "2.9" })).toEqual({ desde: 4, limite: 2 });
    expect(parsePagination({ limite: "5000" })).toEqual({ desde: 0, limite: 100 });
  });

  it("builds { items, total }", () => {
    expect(toPage([1, 2], 40)).toEqual({ items: [1, 2], total: 40 });
    expect(toPage([1, 2, 3])).toEqual({ items: [1, 2, 3], total: 3 });
    expect(toPage(undefined)).toEqual({ items: [], total: 0 });
  });

  it("reads the search text", () => {
    expect(parseSearch("  ana ")).toBe("ana");
    expect(parseSearch("")).toBeUndefined();
    expect(parseSearch(undefined)).toBeUndefined();
  });
});

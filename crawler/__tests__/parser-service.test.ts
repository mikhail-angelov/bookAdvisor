import * as iconv from "iconv-lite";
import { decodeStoredHtml } from "../parser-service";

describe("decodeStoredHtml", () => {
  it("decodes raw latin1-stored windows-1251 HTML before parsing", () => {
    const html = iconv.encode(
      '<html><head><meta charset="windows-1251"></head><body>Бегин Евг - Новый каменный век</body></html>',
      "windows-1251",
    ).toString("latin1");

    const decoded = decodeStoredHtml(html, "raw-latin1");

    expect(decoded).toContain("Бегин Евг - Новый каменный век");
    expect(decoded).not.toContain("\u0011");
  });

  it("does not corrupt an already decoded Cyrillic HTML string", () => {
    const html = '<html><body>Бегин Евг - Новый каменный век</body></html>';

    const decoded = decodeStoredHtml(html, "crawler-raw");

    expect(decoded).toBe(html);
  });
});

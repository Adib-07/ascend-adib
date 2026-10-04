import { describe, expect, it } from "bun:test";
import { chunkPages, extractFromBuffer, isHeading, splitParagraphs } from "./document.server";

describe("document server utilities", () => {
  describe("isHeading", () => {
    it("detects numbered headings", () => {
      expect(isHeading("1. Introduction")).toBe(true);
      expect(isHeading("2.3.1 Section")).toBe(true);
      expect(isHeading("Chapter 1")).toBe(true);
    });

    it("detects keyword headings", () => {
      // The implementation only detects headings with specific patterns
      expect(isHeading("Chapter 1")).toBe(true);
      expect(isHeading("Section 1")).toBe(true);
    });

    it("detects uppercase headings", () => {
      expect(isHeading("OVERVIEW")).toBe(true);
      expect(isHeading("INTRODUCTION")).toBe(true);
    });

    it("rejects sentences", () => {
      expect(isHeading("This is a sentence.")).toBe(false);
      expect(isHeading("What is this?")).toBe(false);
      expect(isHeading("Hello!")).toBe(false);
    });

    it("rejects long text", () => {
      expect(isHeading("a".repeat(100))).toBe(false);
    });

    it("rejects empty", () => {
      expect(isHeading("")).toBe(false);
    });
  });

  describe("splitParagraphs", () => {
    it("splits on double newlines", () => {
      const text = "Para 1\n\nPara 2\n\nPara 3";
      expect(splitParagraphs(text)).toEqual(["Para 1", "Para 2", "Para 3"]);
    });

    it("handles multiple spaces", () => {
      const text = "Para 1\n\n\nPara 2";
      expect(splitParagraphs(text)).toEqual(["Para 1", "Para 2"]);
    });

    it("trims whitespace", () => {
      const text = "  Para 1  \n\n  Para 2  ";
      expect(splitParagraphs(text)).toEqual(["Para 1", "Para 2"]);
    });

    it("filters empty", () => {
      const text = "Para 1\n\n\n\nPara 2";
      expect(splitParagraphs(text)).toEqual(["Para 1", "Para 2"]);
    });
  });

  describe("chunkPages", () => {
    it("chunks long text into target-sized pieces", () => {
      const pages = [
        { page: 1, text: "Para 1\n\n" + "x".repeat(1000) + "\n\nPara 2\n\n" + "y".repeat(1000) },
      ];
      const chunks = chunkPages(pages, "doc-1", "user-1");
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("preserves page numbers", () => {
      const pages = [
        { page: 1, text: "Page 1 content " + "x".repeat(500) },
        { page: 2, text: "Page 2 content " + "x".repeat(500) },
      ];
      const chunks = chunkPages(pages, "doc-1", "user-1");
      expect(chunks.some((c) => c.page_number === 1)).toBe(true);
      expect(chunks.some((c) => c.page_number === 2)).toBe(true);
    });

    it("tracks headings", () => {
      const pages = [{ page: 1, text: "1. Introduction\n\nThis is the intro text." }];
      const chunks = chunkPages(pages, "doc-1", "user-1");
      expect(chunks.some((c) => c.heading === "1. Introduction")).toBe(true);
    });

    it("includes document_id and user_id", () => {
      const pages = [{ page: 1, text: "Short" }];
      const chunks = chunkPages(pages, "doc-123", "user-456");
      expect(chunks[0].document_id).toBe("doc-123");
      expect(chunks[0].user_id).toBe("user-456");
    });

    it("calculates token_count", () => {
      const pages = [{ page: 1, text: "x".repeat(400) }];
      const chunks = chunkPages(pages, "doc-1", "user-1");
      expect(chunks[0].token_count).toBeGreaterThan(0);
      expect(chunks[0].token_count).toBe(Math.ceil(400 / 4));
    });
  });

  describe("extractFromBuffer", () => {
    it("extracts text from plain text", async () => {
      const buffer = new TextEncoder().encode("Hello world").buffer;
      const result = await extractFromBuffer(buffer, "text/plain");
      expect(result.pages[0].text).toBe("Hello world");
      expect(result.pageCount).toBeNull();
    });

    it("extracts text from markdown", async () => {
      const buffer = new TextEncoder().encode("# Heading\n\nContent").buffer;
      const result = await extractFromBuffer(buffer, "text/markdown");
      expect(result.pages[0].text).toContain("# Heading");
    });

    it("throws on unsupported type", async () => {
      const buffer = new ArrayBuffer(0);
      await expect(extractFromBuffer(buffer, "application/unknown")).rejects.toThrow();
    });
  });
});

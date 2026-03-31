import { describe, it, expect } from "vitest";
import { htmlToMarkdown } from "../src/ingest/html-to-markdown.js";

describe("htmlToMarkdown", () => {
  it("converts headings", () => {
    const md = htmlToMarkdown("<html><body><h1>Title</h1><h2>Section</h2></body></html>");
    expect(md).toContain("# Title");
    expect(md).toContain("## Section");
  });

  it("converts unordered lists", () => {
    const md = htmlToMarkdown("<html><body><ul><li>Flour</li><li>Sugar</li></ul></body></html>");
    expect(md).toContain("- Flour");
    expect(md).toContain("- Sugar");
  });

  it("converts ordered lists", () => {
    const md = htmlToMarkdown("<html><body><ol><li>Mix.</li><li>Bake.</li></ol></body></html>");
    expect(md).toContain("1. Mix.");
    expect(md).toContain("2. Bake.");
  });

  it("converts bold and italic", () => {
    const md = htmlToMarkdown("<html><body><p><strong>Bold</strong> and <em>italic</em></p></body></html>");
    expect(md).toContain("**Bold**");
    expect(md).toContain("*italic*");
  });

  it("strips nav, header, footer, scripts", () => {
    const html = `
      <html><body>
        <nav>Navigation</nav>
        <header>Site Header</header>
        <script>alert('hi')</script>
        <h1>Recipe</h1>
        <p>The good stuff.</p>
        <footer>Copyright</footer>
      </body></html>
    `;
    const md = htmlToMarkdown(html);
    expect(md).toContain("# Recipe");
    expect(md).toContain("The good stuff.");
    expect(md).not.toContain("Navigation");
    expect(md).not.toContain("Site Header");
    expect(md).not.toContain("Copyright");
    expect(md).not.toContain("alert");
  });

  it("prefers a recipe container if found", () => {
    const html = `
      <html><body>
        <div class="sidebar">Sidebar junk</div>
        <div class="recipe">
          <h1>My Recipe</h1>
          <ul><li>Ingredient</li></ul>
        </div>
        <div class="comments">Comment noise</div>
      </body></html>
    `;
    const md = htmlToMarkdown(html);
    expect(md).toContain("# My Recipe");
    expect(md).toContain("- Ingredient");
    expect(md).not.toContain("Sidebar junk");
    expect(md).not.toContain("Comment noise");
  });

  it("converts images", () => {
    const md = htmlToMarkdown('<html><body><img src="cake.jpg" alt="Cake"></body></html>');
    expect(md).toContain("![Cake](cake.jpg)");
  });
});

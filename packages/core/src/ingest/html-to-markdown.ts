import { parseHTML } from "linkedom";

/**
 * Convert recipe-relevant HTML to markdown for our parser.
 * Strips nav, ads, sidebars, and other noise to get a clean
 * reader-mode view of the recipe content.
 */
export function htmlToMarkdown(html: string): string {
  const { document } = parseHTML(html);

  // Remove noise elements
  const noiseSelectors = [
    "script", "style", "noscript", "iframe", "svg",
    "nav", "header", "footer",
    "aside", ".sidebar", ".ad", ".advertisement",
    ".social-share", ".comments", ".related-posts",
    ".newsletter", ".popup", ".modal",
    "[role='navigation']", "[role='banner']", "[role='contentinfo']",
  ];
  for (const selector of noiseSelectors) {
    for (const el of document.querySelectorAll(selector)) {
      el.remove();
    }
  }

  // Try to find the main recipe content
  const recipeContainer = findRecipeContainer(document);
  const root = recipeContainer || document.body || document.documentElement;

  return nodeToMarkdown(root).trim() + "\n";
}

function findRecipeContainer(document: Document): Element | null {
  // Look for common recipe container patterns
  const selectors = [
    "[itemtype*='schema.org/Recipe']",
    ".recipe", ".recipe-content", ".recipe-card",
    ".wprm-recipe", ".tasty-recipe", // WordPress recipe plugins
    "article",
    "[role='main']", "main",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === 3 /* TEXT */) {
    return (node.textContent || "").replace(/\s+/g, " ");
  }

  if (node.nodeType !== 1 /* ELEMENT */) return "";

  const el = node as Element;
  const tag = el.tagName?.toLowerCase() || "";

  // Skip hidden elements
  if (el.getAttribute("hidden") != null) return "";
  const style = el.getAttribute("style") || "";
  if (/display\s*:\s*none/i.test(style)) return "";

  const childText = () => {
    let result = "";
    for (const child of Array.from(node.childNodes)) {
      result += nodeToMarkdown(child);
    }
    return result;
  };

  switch (tag) {
    case "h1":
      return `\n\n# ${childText().trim()}\n\n`;
    case "h2":
      return `\n\n## ${childText().trim()}\n\n`;
    case "h3":
      return `\n\n### ${childText().trim()}\n\n`;
    case "h4":
    case "h5":
    case "h6":
      return `\n\n**${childText().trim()}**\n\n`;
    case "p":
      return `\n\n${childText().trim()}\n\n`;
    case "br":
      return "\n";
    case "strong":
    case "b":
      return `**${childText().trim()}**`;
    case "em":
    case "i":
      return `*${childText().trim()}*`;
    case "a": {
      const text = childText().trim();
      const href = el.getAttribute("href");
      if (href && text) return `[${text}](${href})`;
      return text;
    }
    case "img": {
      const alt = el.getAttribute("alt") || "";
      const src = el.getAttribute("src") || "";
      if (src) return `![${alt}](${src})`;
      return "";
    }
    case "ul": {
      let result = "\n\n";
      for (const child of Array.from(el.children)) {
        if (child.tagName?.toLowerCase() === "li") {
          result += `- ${nodeToMarkdown(child).trim()}\n`;
        }
      }
      return result + "\n";
    }
    case "ol": {
      let result = "\n\n";
      let num = 1;
      for (const child of Array.from(el.children)) {
        if (child.tagName?.toLowerCase() === "li") {
          result += `${num}. ${nodeToMarkdown(child).trim()}\n`;
          num++;
        }
      }
      return result + "\n";
    }
    case "li":
      return childText();
    case "div":
    case "section":
    case "article":
    case "main":
    case "span":
    case "figure":
    case "figcaption":
      return childText();
    case "table":
    case "form":
    case "button":
    case "input":
    case "select":
    case "textarea":
      return "";
    default:
      return childText();
  }
}

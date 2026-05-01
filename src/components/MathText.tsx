import { Fragment, useMemo } from "react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

interface MathTextProps {
  children: string;
  className?: string;
  block?: boolean;
}

/**
 * Renders text containing LaTeX delimited by $...$ (inline) or $$...$$ (block).
 * Also auto-detects bare LaTeX commands (\bullet, \triangle, \alpha, ...) and
 * common math fragments outside delimiters, then renders them with KaTeX.
 */
export function MathText({ children, className, block: forceBlock }: MathTextProps) {
  const parts = useMemo(() => parseMath(sanitize(children ?? "")), [children]);

  return (
    <span className={className} style={{ whiteSpace: "pre-wrap" }}>
      {parts.map((p, i) => {
        if (p.type === "text") return <Fragment key={i}>{p.value}</Fragment>;
        const tex = normalizeTex(p.value);
        if (p.type === "block" || forceBlock) {
          try {
            return <BlockMath key={i} math={tex} />;
          } catch {
            return <code key={i}>{tex}</code>;
          }
        }
        try {
          return <InlineMath key={i} math={tex} />;
        } catch {
          return <code key={i}>{tex}</code>;
        }
      })}
    </span>
  );
}

type Part = { type: "text" | "inline" | "block"; value: string };

/** Fix common LaTeX issues that break KaTeX. */
function normalizeTex(tex: string): string {
  return tex
    // KaTeX doesn't support \mbox; map to \text
    .replace(/\\mbox\s*\{/g, "\\text{")
    // \mbox without braces e.g. "\mbox ker" → "\text{ker}"
    .replace(/\\mbox\s+([A-Za-z]+)/g, "\\text{$1}")
    .trim();
}

/**
 * Wrap bare LaTeX fragments outside $...$ delimiters in inline math, so
 * AI-generated content like "(G, \bullet)" renders properly even without
 * surrounding $ signs.
 */
function sanitize(input: string): string {
  // Quick exit if no backslash commands at all
  if (!/\\[A-Za-z]+/.test(input) && !/[\^_]\{/.test(input)) return input;

  const out: string[] = [];
  let i = 0;
  let inMath = false;
  let mathDelim: "$" | "$$" | "\\(" | "\\[" | null = null;

  while (i < input.length) {
    const rest = input.slice(i);
    if (!inMath) {
      // open delimiters
      if (rest.startsWith("$$")) { inMath = true; mathDelim = "$$"; out.push("$$"); i += 2; continue; }
      if (rest.startsWith("\\(")) { inMath = true; mathDelim = "\\("; out.push("\\("); i += 2; continue; }
      if (rest.startsWith("\\[")) { inMath = true; mathDelim = "\\["; out.push("\\["); i += 2; continue; }
      if (rest[0] === "$") { inMath = true; mathDelim = "$"; out.push("$"); i += 1; continue; }

      // Detect bare LaTeX command: \name (optionally followed by {...})
      const cmd = rest.match(/^\\[A-Za-z]+(\{[^{}]*\})?/);
      if (cmd) {
        out.push("$" + cmd[0] + "$");
        i += cmd[0].length;
        continue;
      }
      out.push(input[i]);
      i++;
    } else {
      // close delimiters
      if (mathDelim === "$$" && rest.startsWith("$$")) { inMath = false; mathDelim = null; out.push("$$"); i += 2; continue; }
      if (mathDelim === "\\(" && rest.startsWith("\\)")) { inMath = false; mathDelim = null; out.push("\\)"); i += 2; continue; }
      if (mathDelim === "\\[" && rest.startsWith("\\]")) { inMath = false; mathDelim = null; out.push("\\]"); i += 2; continue; }
      if (mathDelim === "$" && rest[0] === "$") { inMath = false; mathDelim = null; out.push("$"); i += 1; continue; }
      out.push(input[i]);
      i++;
    }
  }
  return out.join("");
}

function parseMath(input: string): Part[] {
  const parts: Part[] = [];
  let i = 0;
  let buf = "";

  const flush = () => {
    if (buf) {
      parts.push({ type: "text", value: buf });
      buf = "";
    }
  };

  while (i < input.length) {
    const ch = input[i];
    // $$...$$
    if (ch === "$" && input[i + 1] === "$") {
      const end = input.indexOf("$$", i + 2);
      if (end !== -1) {
        flush();
        parts.push({ type: "block", value: input.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    // $...$
    if (ch === "$") {
      const end = input.indexOf("$", i + 1);
      if (end !== -1 && end !== i + 1) {
        flush();
        parts.push({ type: "inline", value: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // \( ... \)
    if (ch === "\\" && input[i + 1] === "(") {
      const end = input.indexOf("\\)", i + 2);
      if (end !== -1) {
        flush();
        parts.push({ type: "inline", value: input.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    // \[ ... \]
    if (ch === "\\" && input[i + 1] === "[") {
      const end = input.indexOf("\\]", i + 2);
      if (end !== -1) {
        flush();
        parts.push({ type: "block", value: input.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return parts;
}

export default MathText;

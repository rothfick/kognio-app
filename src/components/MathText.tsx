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
 * Falls back to plain text outside delimiters. Preserves line breaks.
 */
export function MathText({ children, className, block: forceBlock }: MathTextProps) {
  const parts = useMemo(() => parseMath(children ?? ""), [children]);

  return (
    <span className={className} style={{ whiteSpace: "pre-wrap" }}>
      {parts.map((p, i) => {
        if (p.type === "text") return <Fragment key={i}>{p.value}</Fragment>;
        if (p.type === "block" || forceBlock) {
          try {
            return <BlockMath key={i} math={p.value} />;
          } catch {
            return <code key={i}>{p.value}</code>;
          }
        }
        try {
          return <InlineMath key={i} math={p.value} />;
        } catch {
          return <code key={i}>{p.value}</code>;
        }
      })}
    </span>
  );
}

type Part = { type: "text" | "inline" | "block"; value: string };

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

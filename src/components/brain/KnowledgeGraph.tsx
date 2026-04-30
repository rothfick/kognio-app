import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Report = {
  id: string;
  summary: string | null;
  strengths: string | null;
  weaknesses: string | null;
  flashcards: any;
  created_at: string;
};

type Node = {
  id: string;
  label: string;
  weight: number;
  kind: "strength" | "weakness" | "topic";
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type Edge = { a: string; b: string; weight: number };

// Bardzo prosta ekstrakcja "tematów": rozbij tekst na tokeny, odfiltruj stop-words PL/EN,
// zlicz częstość, weź najczęstsze hasła > 3 znaki.
const STOP = new Set([
  "i","oraz","lub","a","ale","że","to","jest","są","się","na","do","od","po","za","w","we","z","ze","o","u",
  "the","a","an","and","or","but","is","are","of","to","in","on","for","with","at","by","as","this","that",
  "był","była","było","bardzo","mocno","bardzo","już","jeszcze","tylko","także","także","jak","gdy","czy",
  "nie","tak","może","można","trzeba","trochę","mało","dużo","kilka","wiele","każdy","jaki","która","który",
  "uczeń","student","lekcja","sesja","temat","lesson","session","topic","podczas","podczas","podstaw",
]);

const tokenize = (text: string): string[] => {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !STOP.has(w));
  return cleaned;
};

const extractTopics = (text: string, max = 5): string[] => {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  tokens.forEach((t) => freq.set(t, (freq.get(t) || 0) + 1));
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
};

export const KnowledgeGraph = ({ reports }: { reports: Report[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverNode, setHoverNode] = useState<Node | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const animRef = useRef<number | null>(null);

  // Build graph data
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const edgeMap = new Map<string, Edge>();

    const addNode = (label: string, kind: Node["kind"]) => {
      const id = `${kind}:${label}`;
      const existing = nodeMap.get(id);
      if (existing) {
        existing.weight += 1;
        return existing;
      }
      const node: Node = {
        id,
        label,
        weight: 1,
        kind,
        x: 200 + Math.random() * 200,
        y: 150 + Math.random() * 200,
        vx: 0,
        vy: 0,
      };
      nodeMap.set(id, node);
      return node;
    };

    const addEdge = (a: string, b: string) => {
      if (a === b) return;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const existing = edgeMap.get(key);
      if (existing) existing.weight += 1;
      else edgeMap.set(key, { a, b, weight: 1 });
    };

    reports.forEach((r) => {
      const reportNodes: string[] = [];
      const strengthsTopics = r.strengths ? extractTopics(r.strengths, 3) : [];
      const weakTopics = r.weaknesses ? extractTopics(r.weaknesses, 3) : [];
      const summaryTopics = r.summary ? extractTopics(r.summary, 4) : [];
      const flashFronts = Array.isArray(r.flashcards)
        ? r.flashcards.flatMap((f: any) => (f?.front ? extractTopics(String(f.front), 2) : []))
        : [];

      strengthsTopics.forEach((t) => reportNodes.push(addNode(t, "strength").id));
      weakTopics.forEach((t) => reportNodes.push(addNode(t, "weakness").id));
      [...summaryTopics, ...flashFronts].forEach((t) => reportNodes.push(addNode(t, "topic").id));

      // Co-occurrence edges within the same report
      for (let i = 0; i < reportNodes.length; i++) {
        for (let j = i + 1; j < reportNodes.length; j++) {
          addEdge(reportNodes[i], reportNodes[j]);
        }
      }
    });

    return { nodes: Array.from(nodeMap.values()), edges: Array.from(edgeMap.values()) };
  }, [reports]);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // Force-directed simulation + render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const colorFor = (kind: Node["kind"]) => {
      // semantic tokens via CSS vars
      const styles = getComputedStyle(document.documentElement);
      const accent = `hsl(${styles.getPropertyValue("--accent").trim()})`;
      const primary = `hsl(${styles.getPropertyValue("--primary").trim()})`;
      const destructive = `hsl(${styles.getPropertyValue("--destructive").trim()})`;
      if (kind === "strength") return accent;
      if (kind === "weakness") return destructive;
      return primary;
    };

    const step = () => {
      const ns = nodesRef.current;
      const es = edgesRef.current;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      // Repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i], b = ns[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist2 = dx * dx + dy * dy + 0.01;
          const force = 1200 / dist2;
          const dist = Math.sqrt(dist2);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }

      // Spring (edges)
      es.forEach((e) => {
        const a = ns.find((n) => n.id === e.a);
        const b = ns.find((n) => n.id === e.b);
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const target = 90;
        const k = 0.02 * Math.min(e.weight, 4);
        const force = (dist - target) * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      });

      // Center gravity + damping
      ns.forEach((n) => {
        n.vx += (cx - n.x) * 0.002;
        n.vy += (cy - n.y) * 0.002;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
      });

      // Draw
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.lineCap = "round";
      es.forEach((e) => {
        const a = ns.find((n) => n.id === e.a);
        const b = ns.find((n) => n.id === e.b);
        if (!a || !b) return;
        ctx.strokeStyle = `hsl(var(--border))`;
        ctx.globalAlpha = Math.min(0.15 + e.weight * 0.15, 0.7);
        ctx.lineWidth = Math.min(1 + e.weight * 0.6, 3);
        // resolve CSS var manually (canvas can't read var())
        const styles = getComputedStyle(document.documentElement);
        ctx.strokeStyle = `hsl(${styles.getPropertyValue("--muted-foreground").trim()})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      ns.forEach((n) => {
        const r = 6 + Math.min(n.weight, 6) * 2;
        ctx.fillStyle = colorFor(n.kind);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();

        const styles = getComputedStyle(document.documentElement);
        ctx.fillStyle = `hsl(${styles.getPropertyValue("--foreground").trim()})`;
        ctx.font = "11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(n.label, n.x, n.y + r + 2);
      });

      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);

    const onMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      let found: Node | null = null;
      for (const n of nodesRef.current) {
        const r = 6 + Math.min(n.weight, 6) * 2 + 4;
        const dx = mx - n.x, dy = my - n.y;
        if (dx * dx + dy * dy <= r * r) { found = n; break; }
      }
      setHoverNode(found);
      canvas.style.cursor = found ? "pointer" : "default";
    };
    canvas.addEventListener("mousemove", onMove);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
    };
  }, []);

  if (nodes.length === 0) {
    return (
      <Card className="p-8 bg-card-soft text-center">
        <p className="text-muted-foreground">
          Graf wiedzy jest pusty. Wygeneruj raporty po sesjach, a tematy pojawią się tutaj automatycznie.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-card-soft">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Badge variant="outline" className="border-accent text-accent">● Mocne strony</Badge>
        <Badge variant="outline" className="border-destructive text-destructive">● Do pracy</Badge>
        <Badge variant="outline" className="border-primary text-primary">● Tematy</Badge>
        <span className="text-xs text-muted-foreground ml-auto">
          {nodes.length} węzłów · {edges.length} powiązań
        </span>
      </div>
      <div className="relative w-full h-[500px] rounded-lg bg-background overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
        {hoverNode && (
          <div className="absolute top-3 left-3 px-3 py-2 rounded-md bg-card border shadow-soft text-xs">
            <p className="font-semibold">{hoverNode.label}</p>
            <p className="text-muted-foreground">
              {hoverNode.kind === "strength" ? "Mocna strona" : hoverNode.kind === "weakness" ? "Do pracy" : "Temat"}
              {" · "}występuje {hoverNode.weight}×
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

import React, { useCallback, useEffect, useRef } from "react";

const POPULAR_PACKAGES = [
  "requests", "numpy", "pandas", "flask", "django", "fastapi",
  "sqlalchemy", "pydantic", "click", "pytest", "httpx", "aiohttp",
  "celery", "redis", "pillow", "boto3", "cryptography", "pyarrow",
  "scipy", "matplotlib", "uvicorn", "starlette", "alembic", "psycopg2",
  "marshmallow", "attrs", "pyyaml", "toml", "black", "mypy",
  "rich", "typer", "loguru", "orjson", "msgpack", "websockets",
  "paramiko", "fabric", "ansible", "kubernetes", "docker", "grpcio",
  "openai", "langchain", "transformers", "torch", "tensorflow",
];

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  name: string;
  radius: number;
  baseRadius: number;
  pulsePhase: number;
  highlighted: boolean;
  pinned: boolean; // keeps drifting back to home position
  homeX: number;
  homeY: number;
}

interface Props {
  query: string;
  cachedPackages?: string[];
  className?: string;
}

function getThemeColors(): {
  primary: string;
  node: string;
  line: string;
  text: string;
  highlight: string;
  highlightLine: string;
  bg: string;
} {
  const isDark = document.documentElement.classList.contains("dark");
  if (isDark) {
    return {
      primary: "103 92% 68%", // hsl approx of indigo in dark
      node: "rgba(255,255,255,0.12)",
      line: "rgba(255,255,255,0.06)",
      text: "rgba(255,255,255,0.45)",
      highlight: "rgba(129,108,255,0.9)",
      highlightLine: "rgba(129,108,255,0.3)",
      bg: "transparent",
    };
  }
  return {
    primary: "243 75% 59%",
    node: "rgba(0,0,0,0.07)",
    line: "rgba(0,0,0,0.04)",
    text: "rgba(0,0,0,0.35)",
    highlight: "rgba(79,70,229,0.85)",
    highlightLine: "rgba(79,70,229,0.25)",
    bg: "transparent",
  };
}

export function PackageConstellation({ query, cachedPackages, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const rafRef = useRef<number>(0);
  const queryRef = useRef(query);
  const clickRippleRef = useRef<{ x: number; y: number; r: number; alpha: number } | null>(null);

  queryRef.current = query;

  const initNodes = useCallback((width: number, height: number, names: string[]) => {
    const count = Math.min(names.length, Math.floor(width / 28));
    const nodes: Node[] = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = 3 + Math.random() * 2.5;
      nodes.push({
        x, y,
        homeX: x, homeY: y,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        name: names[i],
        radius: r,
        baseRadius: r,
        pulsePhase: Math.random() * Math.PI * 2,
        highlighted: false,
        pinned: false,
      });
    }
    nodesRef.current = nodes;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const names = cachedPackages && cachedPackages.length >= 20
      ? [...cachedPackages, ...POPULAR_PACKAGES].filter((v, i, a) => a.indexOf(v) === i).slice(0, 60)
      : POPULAR_PACKAGES;

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      initNodes(canvas.width, canvas.height, names);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    let t = 0;

    const draw = () => {
      t += 0.016;
      rafRef.current = requestAnimationFrame(draw);
      const W = canvas.width;
      const H = canvas.height;
      const q = queryRef.current.trim().toLowerCase();
      const colors = getThemeColors();
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, W, H);

      // update nodes
      for (const n of nodesRef.current) {
        n.highlighted = q.length > 0 && n.name.toLowerCase().includes(q);

        // mouse interaction
        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (mouse.active && dist < 140) {
          const force = (140 - dist) / 140;
          // repel
          n.vx -= (dx / dist) * force * 0.6;
          n.vy -= (dy / dist) * force * 0.6;
        }

        // gentle drift back toward home
        n.vx += (n.homeX - n.x) * 0.0004;
        n.vy += (n.homeY - n.y) * 0.0004;

        // organic drift
        n.vx += Math.sin(t * 0.4 + n.pulsePhase) * 0.008;
        n.vy += Math.cos(t * 0.3 + n.pulsePhase * 1.3) * 0.008;

        // friction
        n.vx *= 0.96;
        n.vy *= 0.96;

        // clamp speed
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > 2.5) { n.vx = (n.vx / speed) * 2.5; n.vy = (n.vy / speed) * 2.5; }

        n.x += n.vx;
        n.y += n.vy;

        // soft wall bounce
        if (n.x < 10) { n.vx += 0.3; }
        if (n.x > W - 10) { n.vx -= 0.3; }
        if (n.y < 10) { n.vy += 0.3; }
        if (n.y > H - 10) { n.vy -= 0.3; }

        // pulse radius when highlighted
        if (n.highlighted) {
          n.radius = n.baseRadius + Math.sin(t * 4 + n.pulsePhase) * 2.5 + 2;
        } else {
          n.radius = n.baseRadius + Math.sin(t * 0.8 + n.pulsePhase) * 0.5;
        }
      }

      // draw edges
      const nodes = nodesRef.current;
      const EDGE_DIST = 110;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > EDGE_DIST) continue;
          const alpha = (1 - d / EDGE_DIST) * 0.7;
          const isHighlit = a.highlighted || b.highlighted;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          if (isHighlit) {
            ctx.strokeStyle = colors.highlightLine.replace("0.25", String(alpha * 0.7));
            ctx.lineWidth = 1.2;
          } else {
            ctx.strokeStyle = colors.line.replace("0.06", String(alpha * 0.35));
            ctx.lineWidth = 0.8;
          }
          ctx.stroke();
        }
      }

      // draw nodes + labels
      ctx.font = "10px system-ui, sans-serif";
      for (const n of nodes) {
        const isDark = document.documentElement.classList.contains("dark");

        if (n.highlighted) {
          // glow ring
          const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius * 4);
          grd.addColorStop(0, isDark ? "rgba(129,108,255,0.35)" : "rgba(79,70,229,0.25)");
          grd.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius * 4, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();

          // node fill
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          ctx.fillStyle = colors.highlight;
          ctx.fill();

          // label — always visible when highlighted
          ctx.fillStyle = isDark ? "rgba(255,255,255,0.9)" : "rgba(50,40,180,0.95)";
          ctx.fillText(n.name, n.x + n.radius + 4, n.y + 3.5);
        } else {
          // normal node
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          ctx.fillStyle = colors.node;
          ctx.fill();

          // label — only near mouse
          const dx = mouse.x - n.x, dy = mouse.y - n.y;
          const md = Math.sqrt(dx * dx + dy * dy);
          if (mouse.active && md < 90) {
            const a = (1 - md / 90) * 0.9;
            ctx.fillStyle = isDark ? `rgba(255,255,255,${a})` : `rgba(30,20,100,${a})`;
            ctx.fillText(n.name, n.x + n.radius + 3, n.y + 3.5);
          }
        }
      }

      // click ripple
      if (clickRippleRef.current) {
        const rip = clickRippleRef.current;
        rip.r += 3;
        rip.alpha -= 0.025;
        if (rip.alpha <= 0) {
          clickRippleRef.current = null;
        } else {
          ctx.beginPath();
          ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
          const isDark = document.documentElement.classList.contains("dark");
          ctx.strokeStyle = isDark
            ? `rgba(129,108,255,${rip.alpha})`
            : `rgba(79,70,229,${rip.alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [cachedPackages, initNodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -9999, y: -9999, active: false };
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    clickRippleRef.current = { x, y, r: 8, alpha: 0.7 };

    // blast nodes away from click
    for (const n of nodesRef.current) {
      const dx = n.x - x, dy = n.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 120) {
        const force = (120 - d) / 120 * 3;
        n.vx += (dx / (d || 1)) * force;
        n.vy += (dy / (d || 1)) * force;
      }
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{ cursor: "crosshair" }}
    />
  );
}

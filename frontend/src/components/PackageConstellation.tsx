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
  pinned: boolean;
  homeX: number;
  homeY: number;
  // Grid cell index for spatial partitioning
  cellX: number;
  cellY: number;
}

interface Props {
  query: string;
  cachedPackages?: string[];
  className?: string;
}

// Spatial grid for O(n) edge detection instead of O(n²)
const CELL_SIZE = 120;

function getThemeColors() {
  const isDark = document.documentElement.classList.contains("dark");
  if (isDark) {
    return {
      node: "rgba(255,255,255,0.12)",
      line: "rgba(255,255,255,0.06)",
      text: "rgba(255,255,255,0.45)",
      highlight: "rgba(129,108,255,0.9)",
      highlightLine: "rgba(129,108,255,0.3)",
      glowA: "rgba(129,108,255,0.35)",
      textHighlight: "rgba(255,255,255,0.9)",
      textNear: "rgba(255,255,255,",
      ripple: "rgba(129,108,255,",
    };
  }
  return {
    node: "rgba(0,0,0,0.07)",
    line: "rgba(0,0,0,0.04)",
    text: "rgba(0,0,0,0.35)",
    highlight: "rgba(79,70,229,0.85)",
    highlightLine: "rgba(79,70,229,0.25)",
    glowA: "rgba(79,70,229,0.25)",
    textHighlight: "rgba(50,40,180,0.95)",
    textNear: "rgba(30,20,100,",
    ripple: "rgba(79,70,229,",
  };
}

export function PackageConstellation({ query, cachedPackages, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const rafRef = useRef<number>(0);
  const queryRef = useRef(query);
  const clickRippleRef = useRef<{ x: number; y: number; r: number; alpha: number } | null>(null);
  const lastFrameRef = useRef(0);
  // Cache theme colors — only update every 60 frames
  const colorsRef = useRef(getThemeColors());
  const frameCountRef = useRef(0);

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
        cellX: Math.floor(x / CELL_SIZE),
        cellY: Math.floor(y / CELL_SIZE),
      });
    }
    nodesRef.current = nodes;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const names = cachedPackages && cachedPackages.length >= 20
      ? [...cachedPackages, ...POPULAR_PACKAGES].filter((v, i, a) => a.indexOf(v) === i).slice(0, 60)
      : POPULAR_PACKAGES;

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
      initNodes(rect.width, rect.height, names);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    let t = 0;
    // Target ~30fps instead of 60fps for better performance
    const FRAME_INTERVAL = prefersReducedMotion ? 50 : 33; // ms

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);

      // Throttle to target FPS
      const elapsed = now - lastFrameRef.current;
      if (elapsed < FRAME_INTERVAL) return;
      lastFrameRef.current = now - (elapsed % FRAME_INTERVAL);

      t += 0.016;
      frameCountRef.current++;

      // Refresh theme colors periodically
      if (frameCountRef.current % 60 === 0) {
        colorsRef.current = getThemeColors();
      }

      const rect = canvas.parentElement!.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      const q = queryRef.current.trim().toLowerCase();
      const colors = colorsRef.current;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, W, H);

      // Build spatial grid
      const gridW = Math.ceil(W / CELL_SIZE) + 1;
      const gridH = Math.ceil(H / CELL_SIZE) + 1;
      const grid: Node[][][] = Array.from({ length: gridW }, () =>
        Array.from({ length: gridH }, () => [])
      );

      const nodes = nodesRef.current;

      // Update nodes & assign to grid
      for (const n of nodes) {
        n.highlighted = q.length > 0 && n.name.toLowerCase().includes(q);

        // Mouse repulsion
        if (mouse.active) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 19600) { // 140²
            const dist = Math.sqrt(distSq);
            const force = (140 - dist) / 140;
            n.vx -= (dx / dist) * force * 0.6;
            n.vy -= (dy / dist) * force * 0.6;
          }
        }

        // Drift home + organic motion
        n.vx += (n.homeX - n.x) * 0.0004;
        n.vy += (n.homeY - n.y) * 0.0004;
        n.vx += Math.sin(t * 0.4 + n.pulsePhase) * 0.008;
        n.vy += Math.cos(t * 0.3 + n.pulsePhase * 1.3) * 0.008;

        // Friction & speed clamp
        n.vx *= 0.96;
        n.vy *= 0.96;
        const speedSq = n.vx * n.vx + n.vy * n.vy;
        if (speedSq > 6.25) { // 2.5²
          const speed = Math.sqrt(speedSq);
          n.vx = (n.vx / speed) * 2.5;
          n.vy = (n.vy / speed) * 2.5;
        }

        n.x += n.vx;
        n.y += n.vy;

        // Soft walls
        if (n.x < 10) n.vx += 0.3;
        if (n.x > W - 10) n.vx -= 0.3;
        if (n.y < 10) n.vy += 0.3;
        if (n.y > H - 10) n.vy -= 0.3;

        // Pulse
        n.radius = n.highlighted
          ? n.baseRadius + Math.sin(t * 4 + n.pulsePhase) * 2.5 + 2
          : n.baseRadius + Math.sin(t * 0.8 + n.pulsePhase) * 0.5;

        // Grid assignment
        n.cellX = Math.max(0, Math.min(gridW - 1, Math.floor(n.x / CELL_SIZE)));
        n.cellY = Math.max(0, Math.min(gridH - 1, Math.floor(n.y / CELL_SIZE)));
        grid[n.cellX][n.cellY].push(n);
      }

      // Draw edges using spatial grid (only check neighboring cells)
      const EDGE_DIST = 110;
      const EDGE_DIST_SQ = EDGE_DIST * EDGE_DIST;
      const drawnEdges = new Set<string>();

      for (let gx = 0; gx < gridW; gx++) {
        for (let gy = 0; gy < gridH; gy++) {
          const cell = grid[gx][gy];
          if (cell.length === 0) continue;

          // Check this cell and neighbors
          for (let nx = gx; nx <= Math.min(gx + 1, gridW - 1); nx++) {
            for (let ny = (nx === gx ? gy : gy - 1); ny <= Math.min(gy + 1, gridH - 1); ny++) {
              if (ny < 0) continue;
              const neighbor = grid[nx][ny];
              if (neighbor.length === 0) continue;

              const isSame = nx === gx && ny === gy;
              for (let i = 0; i < cell.length; i++) {
                const a = cell[i];
                const jStart = isSame ? i + 1 : 0;
                for (let j = jStart; j < neighbor.length; j++) {
                  const b = neighbor[j];
                  const dx = a.x - b.x;
                  const dy = a.y - b.y;
                  const dSq = dx * dx + dy * dy;
                  if (dSq > EDGE_DIST_SQ) continue;

                  const d = Math.sqrt(dSq);
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
            }
          }
        }
      }

      // Draw nodes + labels
      ctx.font = "10px system-ui, sans-serif";
      for (const n of nodes) {
        if (n.highlighted) {
          // Glow ring
          const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius * 4);
          grd.addColorStop(0, colors.glowA);
          grd.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius * 4, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          ctx.fillStyle = colors.highlight;
          ctx.fill();

          ctx.fillStyle = colors.textHighlight;
          ctx.fillText(n.name, n.x + n.radius + 4, n.y + 3.5);
        } else {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          ctx.fillStyle = colors.node;
          ctx.fill();

          // Label near mouse
          if (mouse.active) {
            const dx = mouse.x - n.x;
            const dy = mouse.y - n.y;
            const mdSq = dx * dx + dy * dy;
            if (mdSq < 8100) { // 90²
              const md = Math.sqrt(mdSq);
              const a = (1 - md / 90) * 0.9;
              ctx.fillStyle = `${colors.textNear}${a})`;
              ctx.fillText(n.name, n.x + n.radius + 3, n.y + 3.5);
            }
          }
        }
      }

      // Click ripple
      if (clickRippleRef.current) {
        const rip = clickRippleRef.current;
        rip.r += 3;
        rip.alpha -= 0.025;
        if (rip.alpha <= 0) {
          clickRippleRef.current = null;
        } else {
          ctx.beginPath();
          ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
          ctx.strokeStyle = `${colors.ripple}${rip.alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    };

    rafRef.current = requestAnimationFrame(draw);

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

    for (const n of nodesRef.current) {
      const dx = n.x - x, dy = n.y - y;
      const dSq = dx * dx + dy * dy;
      if (dSq < 14400) { // 120²
        const d = Math.sqrt(dSq);
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

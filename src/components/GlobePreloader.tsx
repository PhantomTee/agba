"use client";
import { useEffect, useRef, useState } from "react";

const D = Math.PI / 180;
const AFRICA_TARGET = 15 * D; // 15°E faces viewer when Africa is centred

// Land dots [latRad, lonRad] — seeded deterministic generation
const LAND_DOTS: [number, number][] = (() => {
  const regions: [number, number, number, number, number][] = [
    // Africa — highest density
    [27, 36, -14, -2, 14], [18, 37, -9, 9, 22], [30, 37, 8, 11, 6],
    [20, 33, 10, 25, 16],  [22, 32, 25, 36, 12], [10, 22, 22, 38, 20],
    [10, 24, 14, 24, 14],  [12, 24, 3, 15, 16],  [10, 25, -12, 4, 16],
    [15, 27, -17, -5, 10], [8, 16, -17, -11, 8], [4, 14, 3, 15, 18],
    [2, 13, 8, 16, 12],    [3, 15, 33, 48, 14],  [0, 12, 41, 52, 10],
    [-5, 5, 30, 42, 14],   [-12, 0, 29, 40, 12], [-13, 5, 12, 31, 18],
    [-18, -5, 12, 24, 12], [-18, -8, 22, 34, 10],[-22, -16, 26, 33, 8],
    [-26, -11, 32, 40, 10],[-35, -22, 17, 33, 16],[-29, -17, 12, 20, 8],
    [-26, -12, 43, 50, 8], [-3, 5, -8, 2, 8],
    // Europe
    [36, 44, -9, 3, 12],  [42, 51, -5, 8, 14], [50, 59, -10, 2, 10],
    [47, 55, 3, 15, 14],  [56, 71, 4, 30, 14], [37, 47, 7, 18, 12],
    [35, 47, 13, 29, 12], [54, 58, 14, 27, 8], [44, 54, 22, 40, 14],
    [50, 70, 30, 60, 16],
    // Asia
    [36, 42, 26, 45, 12], [15, 37, 35, 60, 16], [25, 40, 44, 63, 14],
    [37, 54, 55, 80, 14], [8, 35, 68, 97, 22],  [0, 25, 97, 120, 18],
    [20, 50, 75, 135, 24],[30, 45, 128, 145, 10],[50, 72, 60, 170, 20],
    // North America
    [48, 70, -140, -60, 20],[25, 50, -124, -67, 22],[14, 32, -117, -87, 12],
    [8, 20, -92, -77, 8],   [60, 83, -60, -15, 10],
    // South America
    [0, 12, -75, -60, 10],  [-33, 5, -75, -35, 22],
    [-22, 0, -80, -62, 12], [-55, -22, -75, -53, 12],
    // Australia & Oceania
    [-39, -10, 114, 154, 18],[-47, -34, 166, 178, 6],[-10, 0, 131, 151, 6],
    // Iceland / Greenland
    [63, 66, -24, -13, 4],
  ];

  let s = 98765;
  const rng = () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 4294967296; };

  return regions.flatMap(([la, lb, lo, lob, n]) =>
    Array.from({ length: n }, () => [
      (la + rng() * (lb - la)) * D,
      (lo + rng() * (lob - lo)) * D,
    ] as [number, number])
  );
})();

// Is this dot on Africa?
function onAfrica(lat: number, lon: number) {
  const la = lat / D, lo = lon / D;
  return la >= -37 && la <= 38 && lo >= -18 && lo <= 52;
}

const dots = LAND_DOTS.map(([lat, lon]) => ({ lat, lon, af: onAfrica(lat, lon) }));

type Phase = "spin" | "ease" | "zoom" | "flash" | "done";

export function GlobePreloader({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cssScale, setCssScale] = useState(1);
  const [flashAlpha, setFlashAlpha] = useState(0);
  const [phase, setPhase] = useState<Phase>("spin");
  const [label, setLabel] = useState("SCANNING AFRICA...");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.min(window.innerWidth * 0.72, window.innerHeight * 0.72, 520);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d")!;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const R = cx * 0.9;
    const dotR = Math.max(2, R / 100) * dpr;

    let rotation = 0;
    let easeStart = 0;
    let easeFrom = 0;
    let easeDelta = 0;
    let zoomStart = 0;
    let flashStart = 0;
    let currentPhase: Phase = "spin";
    let raf = 0;

    const SPIN_SPEED = 0.013;
    const SPIN_DURATION = 2400;
    const EASE_DURATION = 1500;
    const ZOOM_DURATION = 900;
    const FLASH_DURATION = 500;

    const start = performance.now();

    function frame(now: number) {
      const elapsed = now - start;

      // Phase transitions
      if (currentPhase === "spin" && elapsed > SPIN_DURATION) {
        currentPhase = "ease";
        easeStart = now;
        easeFrom = rotation;
        // Shortest path to Africa target (always spin forward)
        let current = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        let delta = AFRICA_TARGET - current;
        if (delta < 0) delta += 2 * Math.PI;
        if (delta < 0.4) delta += 2 * Math.PI; // ensure visible motion
        easeDelta = delta;
        setPhase("ease");
        setLabel("FOCUSING ON AFRICA...");
      } else if (currentPhase === "ease" && now - easeStart > EASE_DURATION) {
        currentPhase = "zoom";
        zoomStart = now;
        rotation = easeFrom + easeDelta;
        setPhase("zoom");
        setLabel("");
      } else if (currentPhase === "zoom" && now - zoomStart > ZOOM_DURATION) {
        currentPhase = "flash";
        flashStart = now;
        setPhase("flash");
      } else if (currentPhase === "flash" && now - flashStart > FLASH_DURATION) {
        currentPhase = "done";
        setPhase("done");
        onComplete();
        return;
      }

      // Update rotation
      if (currentPhase === "spin") {
        rotation += SPIN_SPEED;
      } else if (currentPhase === "ease") {
        const t = Math.min(1, (now - easeStart) / EASE_DURATION);
        const eased = 1 - Math.pow(1 - t, 4);
        rotation = easeFrom + easeDelta * eased;
      }

      // CSS zoom
      let scale = 1;
      let fa = 0;
      if (currentPhase === "zoom") {
        const t = Math.min(1, (now - zoomStart) / ZOOM_DURATION);
        const eased = t * t * (3 - 2 * t); // smoothstep
        scale = 1 + eased * 9;
        fa = eased * 0.15;
      } else if (currentPhase === "flash") {
        scale = 10;
        const t = Math.min(1, (now - flashStart) / FLASH_DURATION);
        fa = Math.min(1, t * 2.5);
      }
      setCssScale(scale);
      setFlashAlpha(fa);

      // Render globe on canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Globe edge
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1.2 * dpr;
      ctx.stroke();

      // Dots
      const isAfricaPhase = currentPhase === "ease" || currentPhase === "zoom" || currentPhase === "flash";
      for (const { lat, lon, af } of dots) {
        const sinLon = Math.sin(lon - rotation);
        const cosLon = Math.cos(lon - rotation);
        const cosLat = Math.cos(lat);
        const sinLat = Math.sin(lat);

        const z = cosLat * cosLon;
        if (z < 0.02) continue; // backface

        const px = cx + cosLat * sinLon * R;
        const py = cy - sinLat * R;
        const brightness = 0.35 + z * 0.65;

        ctx.beginPath();
        const dr = af && isAfricaPhase ? dotR * 1.4 : dotR;
        ctx.arc(px, py, dr, 0, 2 * Math.PI);

        if (af && isAfricaPhase) {
          ctx.fillStyle = `rgba(245,166,35,${brightness})`;
        } else if (af) {
          ctx.fillStyle = `rgba(245,166,35,${brightness * 0.55})`;
        } else {
          ctx.fillStyle = `rgba(255,255,255,${brightness * 0.55})`;
        }
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [onComplete]);

  if (phase === "done") return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0a0a]">
      {/* Globe with CSS zoom */}
      <div
        style={{
          transform: `scale(${cssScale})`,
          transformOrigin: "50% 46%",
          willChange: "transform",
        }}
      >
        <canvas ref={canvasRef} />
      </div>

      {/* Label */}
      {label && (
        <div
          className="absolute bottom-10 text-center"
          style={{ opacity: phase === "zoom" ? 0 : 1, transition: "opacity 0.3s" }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/35">
            {label}
          </p>
        </div>
      )}

      {/* Wordmark */}
      <div
        className="absolute top-10 text-center"
        style={{ opacity: phase === "zoom" || phase === "flash" ? 0 : 1, transition: "opacity 0.4s" }}
      >
        <p className="font-display text-2xl font-black tracking-widest text-[#f5a623]">ÀGBÀ</p>
      </div>

      {/* Orange flash overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-[101]"
        style={{ backgroundColor: "#f5a623", opacity: flashAlpha, transition: "opacity 0.05s" }}
      />
    </div>
  );
}

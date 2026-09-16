import { useEffect, useRef } from 'react';
import { blochFromAngles, type BlochVector } from '../quantum/bloch';

/**
 * Canvas cannot read CSS custom properties while painting, so each theme gets an explicit
 * palette. The accent strokes (equator, axes, state vector) are shared — they carry their
 * own contrast on both backgrounds — while surfaces and text swap with the theme.
 */
interface BlochPalette {
  sphereGradientInner: string;
  sphereGradientOuter: string;
  outline: string;
  meridian: string;
  ghost: string;
  poleLabel: string;
  centerDot: string;
  caption: string;
  tipHalo: string;
  equator: string;
  axisX: string;
  axisY: string;
  axisZ: string;
}

const DARK_PALETTE: BlochPalette = {
  sphereGradientInner: 'rgba(124, 92, 255, 0.16)',
  sphereGradientOuter: 'rgba(10, 14, 28, 0.5)',
  outline: 'rgba(154, 164, 199, 0.4)',
  meridian: 'rgba(154, 164, 199, 0.22)',
  ghost: 'rgba(154, 164, 199, 0.35)',
  poleLabel: 'rgba(232, 235, 247, 0.9)',
  centerDot: 'rgba(232, 235, 247, 0.8)',
  caption: 'rgba(152, 161, 192, 0.95)',
  tipHalo: 'rgba(255, 255, 255, 0.85)',
  equator: 'rgba(0, 209, 209, 0.55)',
  axisX: 'rgba(255, 138, 61, 0.85)',
  axisY: 'rgba(124, 92, 255, 0.85)',
  axisZ: 'rgba(47, 211, 165, 0.9)',
};

const LIGHT_PALETTE: BlochPalette = {
  sphereGradientInner: 'rgba(106, 72, 255, 0.12)',
  sphereGradientOuter: 'rgba(255, 255, 255, 0.65)',
  outline: 'rgba(90, 100, 132, 0.5)',
  meridian: 'rgba(90, 100, 132, 0.28)',
  ghost: 'rgba(90, 100, 132, 0.4)',
  poleLabel: 'rgba(28, 35, 64, 0.92)',
  centerDot: 'rgba(28, 35, 64, 0.8)',
  caption: 'rgba(90, 100, 132, 0.95)',
  tipHalo: 'rgba(255, 255, 255, 0.95)',
  equator: 'rgba(0, 146, 168, 0.6)',
  axisX: 'rgba(200, 110, 30, 0.9)',
  axisY: 'rgba(106, 72, 255, 0.85)',
  axisZ: 'rgba(15, 157, 118, 0.9)',
};

/** The theme is written on <html data-theme> (state/theme.ts); read it at draw time. */
function paletteFor(resolvedTheme: string | undefined): BlochPalette {
  return resolvedTheme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
}

/**
 * Bloch sphere visualisation.
 *
 * Drawn on a 2D canvas with a real orthographic projection of the unit sphere, so the
 * pole/equator/axes all move correctly when the learner rotates the view by dragging.
 * When the state changes the vector animates from its previous direction to the new one,
 * which makes single-gate effects (H moving |0⟩ to the equator, Z walking around it)
 * readable at a glance.
 *
 * `size` caps the width; the height follows from the square aspect ratio, because `draw()`
 * assumes a square canvas. Setting a fixed height instead would stretch the sphere into an
 * ellipse whenever the container is narrower than `size`.
 */
export function BlochSphere({
  vector,
  caption,
  size = 330,
  showGhost = true,
}: {
  vector: BlochVector;
  caption?: string;
  size?: number;
  showGhost?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef({ yaw: -0.7, pitch: 0.32 });
  const stateRef = useRef({
    theta: vector.theta,
    phi: vector.phi,
    magnitude: vector.magnitude,
    ghost: null as null | { theta: number; phi: number; magnitude: number },
  });
  const animationRef = useRef<{
    from: { theta: number; phi: number; magnitude: number };
    to: { theta: number; phi: number; magnitude: number };
    start: number;
    duration: number;
  } | null>(null);
  const frameRef = useRef<number | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssSize = canvas.clientWidth || size;
    if (canvas.width !== Math.round(cssSize * dpr)) {
      canvas.width = Math.round(cssSize * dpr);
      canvas.height = Math.round(cssSize * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssSize, cssSize);

    const cx = cssSize / 2;
    const cy = cssSize / 2;
    const R = cssSize * 0.33;
    const { yaw, pitch } = viewRef.current;
    const palette = paletteFor(document.documentElement.dataset.theme);

    const project = (x: number, y: number, z: number) => {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const x1 = x * cosY - y * sinY;
      const y1 = x * sinY + y * cosY;
      const y2 = y1 * cosP - z * sinP;
      const z2 = y1 * sinP + z * cosP;
      return { sx: cx + x1 * R, sy: cy - z2 * R, depth: y2 };
    };

    // Sphere outline
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
    gradient.addColorStop(0, palette.sphereGradientInner);
    gradient.addColorStop(1, palette.sphereGradientOuter);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const circlePath = (points: { x: number; y: number; z: number }[], style: string, dashed = false) => {
      ctx.beginPath();
      points.forEach((point, index) => {
        const p = project(point.x, point.y, point.z);
        if (index === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      });
      ctx.closePath();
      ctx.setLineDash(dashed ? [4, 5] : []);
      ctx.strokeStyle = style;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const samples = 72;
    // Equator
    circlePath(
      Array.from({ length: samples }, (_, i) => {
        const a = (i / samples) * Math.PI * 2;
        return { x: Math.cos(a), y: Math.sin(a), z: 0 };
      }),
      palette.equator,
    );
    // Meridians
    [0, Math.PI / 2].forEach(phi => {
      circlePath(
        Array.from({ length: samples }, (_, i) => {
          const a = (i / samples) * Math.PI * 2;
          return { x: Math.sin(a) * Math.cos(phi), y: Math.sin(a) * Math.sin(phi), z: Math.cos(a) };
        }),
        palette.meridian,
      );
    });

    // Axes
    const axes: { label?: string; to: [number, number, number]; color: string }[] = [
      { label: 'X', to: [1.25, 0, 0], color: palette.axisX },
      { label: 'Y', to: [0, 1.25, 0], color: palette.axisY },
      { to: [0, 0, 1.25], color: palette.axisZ },
    ];
    axes.forEach(axis => {
      const start = project(-axis.to[0], -axis.to[1], -axis.to[2]);
      const end = project(axis.to[0], axis.to[1], axis.to[2]);
      ctx.beginPath();
      ctx.moveTo(start.sx, start.sy);
      ctx.lineTo(end.sx, end.sy);
      ctx.strokeStyle = axis.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (axis.label) {
        ctx.fillStyle = axis.color;
        ctx.font = '600 11px ui-monospace, monospace';
        ctx.fillText(axis.label, end.sx + 4, end.sy - 2);
      }
    });

    // Pole labels
    const north = project(0, 0, 1);
    const south = project(0, 0, -1);
    ctx.fillStyle = palette.poleLabel;
    ctx.font = '600 12px ui-monospace, monospace';
    ctx.fillText('|0⟩', north.sx - 8, north.sy - 6);
    ctx.fillText('|1⟩', south.sx - 8, south.sy + 14);

    const toCartesian = (state: { theta: number; phi: number; magnitude: number }) => {
      const cart = blochFromAngles(state.theta, state.phi, state.magnitude);
      return { x: cart.x, y: cart.y, z: cart.z };
    };

    const vectorPoint = (state: { theta: number; phi: number; magnitude: number }) => {
      const cart = toCartesian(state);
      return project(cart.x, cart.y, cart.z);
    };

    // Ghost of the previous direction
    const ghost = stateRef.current.ghost;
    if (showGhost && ghost && animationRef.current) {
      const ghostPoint = vectorPoint(ghost);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ghostPoint.sx, ghostPoint.sy);
      ctx.strokeStyle = palette.ghost;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // State vector
    const tip = vectorPoint(stateRef.current);
    const stroke = ctx.createLinearGradient(cx, cy, tip.sx, tip.sy);
    stroke.addColorStop(0, 'rgba(124, 92, 255, 0.5)');
    stroke.addColorStop(1, '#ff5f7a');
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tip.sx, tip.sy);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(tip.sx, tip.sy, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5f7a';
    ctx.fill();
    ctx.strokeStyle = palette.tipHalo;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = palette.centerDot;
    ctx.fill();

    if (caption) {
      ctx.fillStyle = palette.caption;
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(caption, 8, cssSize - 8);
    }
  };

  const startLoop = () => {
    if (frameRef.current !== null) return;
    const tick = () => {
      const animation = animationRef.current;
      const state = stateRef.current;
      if (!animation) {
        frameRef.current = null;
        draw();
        return;
      }
      const elapsed = performance.now() - animation.start;
      const rawT = Math.min(1, elapsed / animation.duration);
      const t = 1 - Math.pow(1 - rawT, 3);
      const shortestPhi = ((animation.to.phi - animation.from.phi + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      state.theta = animation.from.theta + (animation.to.theta - animation.from.theta) * t;
      state.phi = animation.from.phi + shortestPhi * t;
      state.magnitude = animation.from.magnitude + (animation.to.magnitude - animation.from.magnitude) * t;
      draw();
      if (rawT >= 1) {
        animationRef.current = null;
        frameRef.current = null;
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  };

  // Animate whenever the target state changes.
  useEffect(() => {
    const state = stateRef.current;
    const to = { theta: vector.theta, phi: vector.phi, magnitude: vector.magnitude };
    const from = { theta: state.theta, phi: state.phi, magnitude: state.magnitude };
    const changed = Math.abs(from.theta - to.theta) > 1e-4 || Math.abs(from.magnitude - to.magnitude) > 1e-4;
    state.ghost = changed ? from : null;
    animationRef.current = { from, to, start: performance.now(), duration: changed ? 700 : 0 };
    startLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vector.theta, vector.phi, vector.magnitude]);

  // Redraw on mount, resize, rotation — and whenever the theme attribute flips, since the
  // canvas cannot inherit the new palette through CSS.
  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    const observer = new MutationObserver(() => draw());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    viewRef.current.yaw += dx * 0.012;
    viewRef.current.pitch = Math.max(-1.35, Math.min(1.35, viewRef.current.pitch + dy * 0.012));
    draw();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="bloch-wrap">
      <canvas
        ref={canvasRef}
        className="bloch-canvas"
        style={{ maxWidth: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => {
          viewRef.current = { yaw: -0.7, pitch: 0.32 };
          draw();
        }}
        title="Drag to rotate the view, double click to reset it"
      />
      <div className="bloch-legend">
        <span>drag to rotate</span>
        <span>·</span>
        <span>red tip = state vector</span>
        {showGhost && <span>· dashed = previous state</span>}
      </div>
    </div>
  );
}

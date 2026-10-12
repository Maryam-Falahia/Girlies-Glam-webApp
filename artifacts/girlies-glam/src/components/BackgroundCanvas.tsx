import React, { useEffect, useRef } from 'react';

const COLORS = ['rgba(239,109,160,', 'rgba(178,125,190,', 'rgba(232,176,75,'];

export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const cx = c.getContext('2d');
    if (!cx) return;

    let animationFrameId: number;

    const resize = () => {
      c.width = window.innerWidth;
      c.height = Math.max(window.innerHeight, document.body.scrollHeight);
    };
    resize();
    window.addEventListener('resize', resize);

    const sparkles: { x: number; y: number; vy: number; r: number; a: number; color: string; rot: number }[] = [];
    for (let i = 0; i < 52; i++) {
      sparkles.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        vy: Math.random() * 0.28 + 0.08,
        r: Math.random() * 5.5 + 3.5,
        a: Math.random() * Math.PI * 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: Math.random() * Math.PI,
      });
    }

    function drawSpark(x: number, y: number, r: number, rot: number, color: string, alpha: number) {
      cx!.save();
      cx!.translate(x, y);
      cx!.rotate(rot);
      cx!.beginPath();
      cx!.moveTo(0, -r);
      cx!.quadraticCurveTo(r * 0.25, -r * 0.25, r, 0);
      cx!.quadraticCurveTo(r * 0.25, r * 0.25, 0, r);
      cx!.quadraticCurveTo(-r * 0.25, r * 0.25, -r, 0);
      cx!.quadraticCurveTo(-r * 0.25, -r * 0.25, 0, -r);
      cx!.closePath();
      cx!.fillStyle = color + alpha + ')';
      cx!.fill();
      cx!.restore();
    }

    const frame = () => {
      cx.clearRect(0, 0, c.width, c.height);
      sparkles.forEach(p => {
        p.y -= p.vy;
        p.a += 0.035;
        if (p.y < -10) { p.y = c.height + 10; p.x = Math.random() * c.width; }
        const alpha = 0.35 + Math.sin(p.a) * 0.3;
        drawSpark(p.x, p.y, p.r, p.rot + p.a * 0.1, p.color, Math.max(alpha, 0.05));
      });
      animationFrameId = requestAnimationFrame(frame);
    };

    frame();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas id="bg-canvas" ref={canvasRef}></canvas>;
}

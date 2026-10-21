"use client";
import { useEffect, useRef } from "react";

// Plasma behind the whole site: soft blue light rolling through black, drawn on the graphics card.
// It is the old text-mode "plasma" effect (sine waves running in different directions, added
// together, so the light swells and fades as they agree and cancel), shown as smooth light rather
// than characters. It's drawn small and stretched to the window, which costs nothing because it is
// all soft gradients, at about 24 frames a second. Colours come from the site's own tokens, so it
// follows the accent.
//
// It never gets in the way: with reduced motion it draws one still frame, it stops while the tab is
// hidden, and if the browser can't do WebGL the static glow in globals.css (body::before) shows instead.

const VERTEX = `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_base;
uniform vec3 u_accent;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// The classic plasma: a few sine waves running in different directions, plus rings spreading from a
// point that wanders, all added together. Where the waves agree the light is bright and where they
// cancel it is dark, and because each one moves at its own speed the pattern never repeats.
float plasma(vec2 p, float t) {
  float v = sin(p.x * 1.7 + t);
  v += sin(p.y * 1.3 - t * 0.8);
  v += sin((p.x + p.y) * 1.1 + t * 1.2);
  vec2 c = p + vec2(sin(t * 0.6), cos(t * 0.8)) * 0.9;
  v += sin(length(c) * 2.2 - t * 1.1);
  return v * 0.25;   // -1 to 1
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float aspect = u_res.x / u_res.y;
  // Height is -1 to 1 and width follows. On a tall, narrow screen (a phone) zoom out, so it sees as
  // much of the pattern as a wide screen does.
  float zoom = max(1.0, 1.25 / aspect);
  vec2 reach = vec2(aspect, 1.0) * zoom;   // how far the screen reaches from its centre
  vec2 p = (frag / u_res - 0.5) * 2.0 * reach;
  float t = u_time * 0.55;

  // A gentle sine bend, so the waves curve instead of running dead straight.
  vec2 w = p + 0.32 * vec2(sin(p.y * 1.2 + t * 0.9), cos(p.x * 1.0 - t * 0.7));

  // Two plasmas, one broad and slow, one smaller, added into a single field of light.
  float a = 0.5 + 0.5 * plasma(w, t);
  float b = 0.5 + 0.5 * plasma(w * 0.55 + 3.0, t * 0.6);
  float field = a * 0.6 + b * 0.4;
  field = smoothstep(0.25, 0.74, field);      // stretch the middle of the range so there is real black and real light
  float glow = smoothstep(0.30, 1.0, field);

  // Black, then deep navy, then the accent, then a pale blue edge on the brightest cores.
  vec3 col = mix(u_base, u_accent * 0.16, smoothstep(0.05, 0.5, field));
  col = mix(col, u_accent * 0.82, pow(glow, 1.4));
  col += vec3(0.10, 0.20, 0.42) * pow(glow, 4.0);

  col += (hash(frag) - 0.5) / 255.0;   // a little grain, so the dark gradients don't band
  gl_FragColor = vec4(col, 1.0);
}`;

function cssColor(name: string): [number, number, number] | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(raw);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const parts = raw.split(",").map(Number);   // "11, 92, 255"
  return parts.length === 3 && parts.every(Number.isFinite) ? [parts[0] / 255, parts[1] / 255, parts[2] / 255] : null;
}

export function Flow() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = host.current;
    if (!box) return;

    // A fresh canvas for every mount, so a remount never inherits a lost context.
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power" });
    if (!gl) return;   // no WebGL: the static glow stays

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("Background shader didn't compile:", gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, "a");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Background shader didn't link:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // One triangle that covers the whole window.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");
    gl.uniform3fv(gl.getUniformLocation(program, "u_base"), cssColor("--bg") ?? [0.02, 0.03, 0.05]);
    gl.uniform3fv(gl.getUniformLocation(program, "u_accent"), cssColor("--accent-rgb") ?? [0.04, 0.36, 1]);

    const resize = () => {
      const scale = window.innerWidth < 700 ? 0.36 : 0.44;
      const w = Math.max(160, Math.min(900, Math.round(window.innerWidth * scale)));
      const h = Math.max(90, Math.round((w * window.innerHeight) / Math.max(window.innerWidth, 1)));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
    };
    const draw = (seconds: number) => {
      gl.uniform1f(uTime, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last = 0;
    let t = 20;   // starts part-way through, so the first frame is already a good one
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 40) return;   // about 24 frames a second is plenty for something this slow
      t += Math.min((now - last) / 1000, 0.1);
      last = now;
      draw(t);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      resize();
      if (calm.matches) draw(t);   // reduced motion: one still frame
      else raf = requestAnimationFrame(loop);
    };
    const onResize = () => { resize(); if (calm.matches) draw(t); };
    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      canvas.classList.remove("on");
      document.documentElement.classList.remove("has-flow");
    };

    box.appendChild(canvas);
    document.documentElement.classList.add("has-flow");
    start();
    requestAnimationFrame(() => canvas.classList.add("on"));
    window.addEventListener("resize", onResize);
    calm.addEventListener("change", start);
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      calm.removeEventListener("change", start);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.remove();
      document.documentElement.classList.remove("has-flow");
    };
  }, []);

  return <div className="flow" ref={host} aria-hidden="true" />;
}

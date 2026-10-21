"use client";
import { useEffect, useRef } from "react";

// The light behind the whole site: one huge arch of blue over a dark dome, drawn on the graphics card.
// It is shaped like the glow in the reference design: a sharp-ish outer edge of pale sky blue that
// deepens through azure and cobalt into the dark, a little thinner and bluer toward the sides of the
// screen. It hardly moves: the rim drifts and breathes by a few pixels so it feels alive without
// pulling the eye. It is drawn small and stretched to the window (it is all soft gradient, so nothing
// is lost) and the colours come from the site's own tokens.
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

// The colour of the light as it goes from the bright rim (u = 0) down into the dark dome (u = 1).
vec3 ramp(float u) {
  vec3 pale = vec3(0.66, 0.89, 0.98);
  vec3 cyan = vec3(0.20, 0.64, 0.94);
  vec3 azure = u_accent * vec3(0.62, 0.95, 1.0);
  vec3 cobalt = u_accent * vec3(0.20, 0.36, 0.62);
  vec3 navy = u_accent * vec3(0.08, 0.12, 0.30);
  vec3 c = mix(pale, cyan, smoothstep(0.00, 0.20, u));
  c = mix(c, azure, smoothstep(0.14, 0.38, u));
  c = mix(c, cobalt, smoothstep(0.32, 0.64, u));
  c = mix(c, navy, smoothstep(0.58, 0.88, u));
  c = mix(c, u_base, smoothstep(0.80, 1.00, u));
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float aspect = u_res.x / u_res.y;
  vec2 p = (frag - 0.5 * u_res) / (0.5 * u_res.y);   // height is -1 to 1, width follows
  float t = u_time;

  // The arch: a huge circle whose brightest line peaks about a quarter of the way down the screen and
  // meets the sides of the screen around the middle, so it is always a big dome of light.
  float ax = max(aspect, 0.4);
  float crestY = 0.48;
  float edgeY = crestY - 0.35 * ax;
  float cy = (ax * ax + edgeY * edgeY - crestY * crestY) / (2.0 * (edgeY - crestY));
  float radius = crestY - cy;
  vec2 d = p - vec2(0.0, cy);
  float dist = length(d);
  float ang = atan(d.x, d.y);   // 0 at the top of the arch, positive to the right
  float across = cos(ang);      // 1 at the top, smaller toward the sides

  // Almost no movement: the rim drifts and breathes by a few pixels, very slowly.
  float drift = 0.007 * sin(ang * 5.0 - t * 0.16) + 0.004 * sin(ang * 9.0 + t * 0.22);
  float x = dist - (radius + drift + 0.005 * sin(t * 0.13));   // below zero inside the dome, above outside

  // How deep into the dome we are, scaled so the glow is thick at the top and thinner and bluer at the sides.
  float thick = 0.75 * (0.74 + 0.26 * across);
  float u = clamp(-x / thick + 0.05 * (1.0 - across) + 0.012 * sin(ang * 6.0 - t * 0.18), 0.0, 1.0);

  float outer = exp(-max(x, 0.0) * 14.0);   // the outer edge falls to black quickly
  vec3 col = u_base + (ramp(u) - u_base) * outer;
  col = u_base + (col - u_base) * (0.78 + 0.22 * across);   // a little dimmer toward the sides

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
    gl.uniform3fv(gl.getUniformLocation(program, "u_base"), cssColor("--bg") ?? [0.012, 0.035, 0.08]);
    gl.uniform3fv(gl.getUniformLocation(program, "u_accent"), cssColor("--accent-rgb") ?? [0.17, 0.56, 0.85]);

    const resize = () => {
      const scale = window.innerWidth < 700 ? 0.4 : 0.5;
      const w = Math.max(160, Math.min(1000, Math.round(window.innerWidth * scale)));
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
      if (now - last < 50) return;   // 20 frames a second is plenty for something that barely moves
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

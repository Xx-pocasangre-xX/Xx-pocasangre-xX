#!/usr/bin/env node
// Genera resources/activity.svg: calendario de contribuciones de GitHub con tema "matrix"
// (cuadritos en verde y cian sobre fondo oscuro). No depende de servicios externos: lee los
// datos de la API GraphQL de GitHub y dibuja el SVG; el workflow lo ejecuta cada día.
//
//   GITHUB_TOKEN=... node scripts/build-activity.mjs --user Xx-pocasangre-xX
//   node scripts/build-activity.mjs --placeholder      (tarjeta "pendiente de actualizar")
//   node scripts/build-activity.mjs --sample --out /tmp/vista.svg   (solo para ver el diseño)
//
// Requiere Node 18+ (usa fetch). Sin dependencias.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);

const USER = option('user', 'Xx-pocasangre-xX');
const OUT = option('out', path.join(import.meta.dirname, '..', 'resources', 'activity.svg'));

// ── Diseño ───────────────────────────────────────────────────────────────────
const CELL = 12, GAP = 3, STEP = CELL + GAP;
const PAD = 24, LEFT = 34, TOP = 64;
const BG = '#0d1117', BORDER = '#30363d', TEXT = '#c9d1d9', DIM = '#6e7681', PINK = '#ff79c6';
const LEVELS = ['#111b17', '#0e5a3a', '#12a36a', '#25d6a4', '#6cf5ec']; // vacío → verde → cian
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAYS = { 1: 'Lun', 3: 'Mié', 5: 'Vie' };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ── Datos ────────────────────────────────────────────────────────────────────
async function fetchCalendar(user, token) {
  const query = `query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount weekday } }
        }
      }
    }
  }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'activity-svg' },
    body: JSON.stringify({ query, variables: { login: user } }),
  });
  if (!res.ok) throw new Error(`La API de GitHub respondió ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const calendar = json.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) throw new Error(`Respuesta inesperada de la API: ${JSON.stringify(json).slice(0, 300)}`);
  return calendar;
}

// Datos sintéticos SOLO para revisar el diseño (el SVG lleva una marca que lo indica)
function sampleCalendar() {
  const weeks = [];
  let total = 0;
  const start = new Date(Date.UTC(2025, 9, 5));
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * 86400000);
      const n = Math.max(0, Math.round(Math.sin(w / 4 + d) * 3 + (w % 11 === 0 ? 8 : 0) + ((w * 7 + d) % 5)) - 2);
      total += n;
      days.push({ date: date.toISOString().slice(0, 10), contributionCount: n, weekday: d });
    }
    weeks.push({ contributionDays: days });
  }
  return { totalContributions: total, weeks };
}

// ── Dibujo ───────────────────────────────────────────────────────────────────
// Niveles por cuartiles de los días con actividad (como GitHub): un día excepcional no apaga al resto
function levelThresholds(weeks) {
  const counts = weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)).filter((n) => n > 0).sort((x, y) => x - y);
  const at = (q) => counts[Math.min(counts.length - 1, Math.floor(counts.length * q))] ?? 1;
  return [at(0.25), at(0.5), at(0.75)];
}

function level(count, [q1, q2, q3]) {
  if (count <= 0) return 0;
  if (count <= q1) return 1;
  if (count <= q2) return 2;
  if (count <= q3) return 3;
  return 4;
}

function render(calendar, { sample = false } = {}) {
  const weeks = calendar.weeks;
  const thresholds = levelThresholds(weeks);
  const width = PAD * 2 + LEFT + weeks.length * STEP - GAP;
  const height = TOP + 7 * STEP - GAP + 54;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t d">`);
  out.push(`<title id="t">Actividad en GitHub de ${esc(USER)}</title>`);
  out.push(`<desc id="d">Calendario con ${calendar.totalContributions} contribuciones en el último año, un cuadro por día; más cian significa más actividad.</desc>`);
  // Animación: las columnas se llenan de izquierda a derecha, se mantienen y se borran en bucle.
  out.push('<style>',
    '.w{animation:llenar 11s linear infinite both}',
    '@keyframes llenar{0%{opacity:0}2%,80%{opacity:1}86%,100%{opacity:0}}',
    '</style>');
  out.push(`<rect width="${width}" height="${height}" rx="10" fill="${BG}" stroke="${BORDER}"/>`);
  out.push(`<text x="${PAD}" y="34" font-family="${MONO}" font-size="15" font-weight="700" fill="${PINK}">Actividad en GitHub</text>`);
  out.push(`<text x="${width - PAD}" y="34" text-anchor="end" font-family="${MONO}" font-size="13" fill="${TEXT}"><tspan fill="${LEVELS[3]}" font-weight="700">${calendar.totalContributions}</tspan> contribuciones en el último año</text>`);
  if (sample) {
    out.push(`<text x="${width / 2}" y="${height / 2 + 4}" text-anchor="middle" font-family="${MONO}" font-size="30" font-weight="700" fill="#ff5f56" fill-opacity=".55" transform="rotate(-6 ${width / 2} ${height / 2})">DATOS DE EJEMPLO</text>`);
  }

  // Etiquetas de día
  for (const [row, label] of Object.entries(DAYS)) {
    out.push(`<text x="${PAD}" y="${TOP + row * STEP + CELL - 2}" font-family="${MONO}" font-size="10" fill="${DIM}">${label}</text>`);
  }

  // Cuadros y etiquetas de mes
  out.push('<g shape-rendering="crispEdges">');
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const x = PAD + LEFT + i * STEP;
    const month = new Date(`${week.contributionDays[0].date}T00:00:00Z`).getUTCMonth();
    if (month !== lastMonth && i < weeks.length - 2) {
      out.push(`<text x="${x}" y="${TOP - 10}" font-family="${MONO}" font-size="10" fill="${DIM}">${MONTHS[month]}</text>`);
      lastMonth = month;
    }
    out.push(`<g class="w" style="animation-delay:${(i * 0.08).toFixed(2)}s">`);
    for (const day of week.contributionDays) {
      const y = TOP + day.weekday * STEP;
      out.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${LEVELS[level(day.contributionCount, thresholds)]}"><title>${day.contributionCount} contribuciones el ${day.date}</title></rect>`);
    }
    out.push('</g>');
  });
  out.push('</g>');

  // Leyenda
  const ly = TOP + 7 * STEP + 14;
  const lx = width - PAD - (LEVELS.length * STEP + 78);
  out.push(`<text x="${lx}" y="${ly + 10}" font-family="${MONO}" font-size="10" fill="${DIM}">Menos</text>`);
  LEVELS.forEach((c, i) => out.push(`<rect x="${lx + 40 + i * STEP}" y="${ly}" width="${CELL}" height="${CELL}" rx="2" fill="${c}"/>`));
  out.push(`<text x="${lx + 44 + LEVELS.length * STEP}" y="${ly + 10}" font-family="${MONO}" font-size="10" fill="${DIM}">Más</text>`);
  out.push('</svg>');
  return out.join('\n');
}

// Tarjeta provisional: se reemplaza sola cuando el workflow genera el calendario real
function placeholder() {
  const width = 905, height = 190;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t">`,
    `<title id="t">Calendario de actividad de GitHub: pendiente de actualizar</title>`,
    `<rect width="${width}" height="${height}" rx="10" fill="${BG}" stroke="${BORDER}"/>`,
    `<text x="${PAD}" y="34" font-family="${MONO}" font-size="15" font-weight="700" fill="${PINK}">Actividad en GitHub</text>`,
    `<text x="${width / 2}" y="${height / 2 + 4}" text-anchor="middle" font-family="${MONO}" font-size="13" fill="${DIM}">Generando el calendario de contribuciones… se actualiza automáticamente.</text>`,
    '</svg>',
  ].join('\n');
}

// ── Principal ────────────────────────────────────────────────────────────────
let svg;
if (flag('placeholder')) {
  svg = placeholder();
} else if (flag('sample')) {
  svg = render(sampleCalendar(), { sample: true });
} else {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Falta GITHUB_TOKEN en el entorno');
  svg = render(await fetchCalendar(USER, token));
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, svg + '\n');
console.log(`SVG escrito en ${OUT} (${(svg.length / 1024).toFixed(1)} KB)`);

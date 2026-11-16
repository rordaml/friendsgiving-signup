/* Friendsgiving Signup: the turkeys.
 *
 * - They start normal and get stranger the longer the page is open.
 * - Clicking one roasts it. The roast is as strange as the turkey was, and keeps getting stranger.
 * - Clicking the cornucopia turns everything back into normal turkeys.
 * - "Lauren mode" swaps them all for fall decorations that stay pretty.
 */
(() => {
'use strict';

// Turkeys look normal for GRACE seconds, then reach full horror after GRACE + RAMP seconds.
const GRACE = 15, RAMP = 225;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;
const FEATHERS = ['var(--persimmon)', 'var(--mustard)', 'var(--cobalt)', 'var(--mustard)'];
const EYE_POS = {
  1: [[3, -3]],
  3: [[-5, -5], [5, -6], [0, 3]],
  5: [[-7, -4], [0, -9], [7, -4], [-4, 5], [5, 5]]
};
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp01 = x => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const f1 = n => Math.round(n * 10) / 10;
const tri = x => 2 / Math.PI * Math.asin(Math.sin(x));

/* ---------- shared drawing kit: bounds, eyes, tentacles, mouths ---------- */
function makeKit(p, start) {
  const B = start || { x0: -36, x1: 46, y0: -40 };
  const pt = (x, y, r = 0) => { B.x0 = Math.min(B.x0, x - r); B.x1 = Math.max(B.x1, x + r); B.y0 = Math.min(B.y0, y - r); };
  const R = k => rng(p.seed * 131 + k);
  const anim = (deg, x, y, r) => RM ? '' :
    `<animateTransform attributeName="transform" type="rotate" values="${-deg} ${f1(x)} ${f1(y)};${deg} ${f1(x)} ${f1(y)};${-deg} ${f1(x)} ${f1(y)}" dur="${f1(2.2 + r() * 2.5)}s" begin="-${f1(r() * 4)}s" repeatCount="indefinite"/>`;
  const eye = (x, y, r) => {
    pt(x, y, r);
    const inner = p.horror
      ? `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * .66)}" fill="var(--mustard)"/><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r * .2)}" ry="${f1(r * .58)}" fill="var(--pupil)"/>`
      : `<circle cx="${f1(x + r * .25)}" cy="${f1(y)}" r="${f1(r * .47)}" fill="var(--pupil)"/>`;
    return `<g class="eye"><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="var(--eye)"/>${inner}</g>`;
  };
  // the little paper crown on a drumstick
  const frill = (x, y, r) => {
    pt(x, y, r);
    let d = '';
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU, rr = i % 2 ? r * .55 : r;
      d += `${i ? 'L' : 'M'}${f1(x + Math.cos(a) * rr)} ${f1(y + Math.sin(a) * rr)}`;
    }
    return `<path d="${d}Z" fill="var(--eye)" stroke="var(--ink-soft)" stroke-width=".8" stroke-linejoin="round"/>`;
  };
  const tentacle = (bx, by, theta, len, w0, color, r, deg, tip) => {
    const n = 14, waves = 1 + r() * 1.5, amp = 4 + r() * 6, ph = r() * 6.28, curl = (r() < .5 ? -1 : 1) * (6 + r() * 10);
    const dx = Math.sin(theta), dy = -Math.cos(theta), px = Math.cos(theta), py = Math.sin(theta);
    const L = [], Rt = [], C = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, along = t * len, side = Math.sin(t * Math.PI * waves + ph) * amp * t + curl * t * t * t;
      const cx = bx + along * dx + side * px, cy = by + along * dy + side * py, w = (w0 * (1 - t) + .9) / 2;
      L.push(`${f1(cx + px * w)} ${f1(cy + py * w)}`); Rt.push(`${f1(cx - px * w)} ${f1(cy - py * w)}`);
      C.push([cx, cy, w]); pt(cx, cy, w);
    }
    let g = `<path d="M${L.join('L')}L${Rt.reverse().join('L')}Z" fill="${color}"/>`;
    for (let i = 3; i < n - 1; i += 2) {
      const [cx, cy, w] = C[i];
      g += `<circle cx="${f1(cx + px * w * .45)}" cy="${f1(cy + py * w * .45)}" r="${f1(w * .32)}" fill="var(--eye)" opacity=".55"/>`;
    }
    const [tx, ty] = C[n];
    if (tip === 'eye') g += eye(tx, ty, 4.2);
    if (tip === 'frill') g += frill(tx, ty, 5);
    return `<g>${anim(deg, bx, by, r)}${g}</g>`;
  };
  // eyes scattered inside an ellipse, stable as the count grows
  const scatter = (n, cx, cy, rx, ry, rMin, rMax, avoid, key) => {
    if (!n) return '';
    const rr = R(key), placed = [];
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < 40; t++) {
        const x = cx + (rr() * 2 - 1) * rx, y = cy + (rr() * 2 - 1) * ry, r = rMin + rr() * (rMax - rMin);
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
        if (avoid && avoid(x, y)) continue;
        if (placed.some(([a, b, c]) => Math.hypot(a - x, b - y) < c + r + 1)) continue;
        placed.push([x, y, r]); break;
      }
    }
    return placed.map(([x, y, r]) => eye(x, y, r)).join('');
  };
  const maw = (mx, my, mrx, mry) => {
    let g = `<ellipse cx="${f1(mx)}" cy="${f1(my)}" rx="${f1(mrx)}" ry="${f1(mry)}" fill="var(--pupil)"/>`;
    for (let i = 0; i < 7; i++) {
      const tx = mx - mrx * .8 + (mrx * 1.6) * i / 6, e = Math.sqrt(Math.max(0, 1 - ((tx - mx) / mrx) ** 2)), tw = mrx * .11;
      g += `<path d="M${f1(tx - tw)} ${f1(my - mry * e)}L${f1(tx)} ${f1(my - mry * e + mry * .55)}L${f1(tx + tw)} ${f1(my - mry * e)}Z" fill="var(--eye)"/>`;
      if (i < 6) {
        const bx = tx + mrx * .8 / 6, eb = Math.sqrt(Math.max(0, 1 - ((bx - mx) / mrx) ** 2));
        g += `<path d="M${f1(bx - tw)} ${f1(my + mry * eb)}L${f1(bx)} ${f1(my + mry * eb - mry * .5)}L${f1(bx + tw)} ${f1(my + mry * eb)}Z" fill="var(--eye)"/>`;
      }
    }
    return g;
  };
  return { B, pt, R, anim, eye, frill, tentacle, scatter, maw };
}
function svgOf({ g, B }, scale) {
  const x0 = B.x0 - 4, y0 = B.y0 - 4, w = B.x1 + 4 - x0, h = 7 - y0;
  const style = scale ? ` style="width:calc(${f1(w * scale)}px * var(--pscale))"` : '';
  return `<svg viewBox="${f1(x0)} ${f1(y0)} ${f1(w)} ${f1(h)}"${style} aria-hidden="true">${g}</svg>`;
}

/* ---------- live turkeys ---------- */
// How weird a turkey is at madness m (0..1). Each trait goes strange early; everything else follows.
function params(trait, seed, m) {
  const s = (a, b) => ss(a, b, m);
  const p = { seed, m, horror: m > .5 };
  p.legs = 34 * (1 + (trait === 'stilts' ? 2.6 : .5) * s(.05, .4));
  p.neck = 20 * (1 + (trait === 'neck' ? 3.4 : .7) * s(.08, .45));
  p.headEyes = trait === 'eyes' ? (m > .3 ? 5 : m > .1 ? 3 : 1) : (m > .55 ? 5 : m > .35 ? 3 : 1);
  p.cutlery = trait === 'cutlery' && m > .1;
  p.feathers = 7 + 2 * Math.round(3 * s(.15, .6));
  p.tailLen = 50 * (1 + (trait === 'tail' ? .9 : .3) * s(.1, .5));
  p.featherEyes = m > .4;
  p.tailTent = !p.cutlery && m > .62;
  p.hatDepth = trait === 'totem' ? (m > .3 ? 2 : m > .1 ? 1 : 0)
    : ((trait === 'hat' && m > .1) || (seed % 3 === 0 && m > .5)) ? 1 : 0;
  p.tentLegs = m > .55 ? 3 + Math.round(5 * s(.55, .9)) : 0;
  p.bodyEyes = Math.round(14 * s(.48, .95));
  p.heads = Math.round(3 * s(.62, .95));
  p.maw = s(.72, .92);
  p.openBeak = m > .68;
  p.stalks = Math.round(6 * s(.8, 1));
  p.swell = 1 + .35 * s(.6, 1);
  p.wattle = 1 + 1.6 * s(.5, 1);
  return p;
}

function drawTurkey(p) {
  const K = makeKit(p), { pt, R, anim, eye, tentacle } = K;
  const head = (hx, hy, hr, nEyes) => {
    pt(hx, hy, hr); pt(hx + hr + 11, hy);
    let g = `<circle cx="${f1(hx)}" cy="${f1(hy)}" r="${f1(hr)}" fill="var(--brown-2)"/>`;
    const bx = hx + hr - 2;
    if (p.openBeak) {
      g += `<path d="M${f1(bx)} ${f1(hy)}L${f1(bx + 11)} ${f1(hy - 6)}L${f1(bx + 11)} ${f1(hy + 9)}Z" fill="var(--pupil)"/>`;
      g += `<path d="M${f1(bx)} ${f1(hy - 3)}L${f1(bx + 12)} ${f1(hy - 7)}L${f1(bx)} ${f1(hy + 1)}Z" fill="var(--mustard)"/>`;
      g += `<path d="M${f1(bx)} ${f1(hy + 3)}L${f1(bx + 11)} ${f1(hy + 10)}L${f1(bx)} ${f1(hy + 6)}Z" fill="var(--mustard)"/>`;
      for (let i = 0; i < 3; i++) g += `<path d="M${f1(bx + 3 + i * 3)} ${f1(hy - 1.5 - i)}l1.4 3l1.4 -3.4Z" fill="var(--eye)"/>`;
    } else {
      g += `<path d="M${f1(bx)} ${f1(hy - 2)}L${f1(bx + 12)} ${f1(hy + 1)}L${f1(bx)} ${f1(hy + 5)}Z" fill="var(--mustard)"/>`;
    }
    const wl = 17 * p.wattle;
    g += `<path d="M${f1(bx + 1)} ${f1(hy + 5)}q7 ${f1(wl * .6)} 0 ${f1(wl)}q-6 ${f1(-wl * .4)} 0 ${f1(-wl)}Z" fill="var(--persimmon)"/>`;
    pt(bx + 6, hy + 5 + wl);
    for (const [ex, ey] of EYE_POS[nEyes]) g += eye(hx + ex, hy + ey, nEyes > 1 ? 3.4 : 3.6);
    return g;
  };

  const sw = p.swell, rx = 30 * sw, ry = 26 * sw;
  const cy = -p.legs - ry + 2, pv = cy - 6 * sw;
  let s = '';

  // tail
  const rT = R(1);
  for (let i = 0; i < p.feathers; i++) {
    const a = -75 + 150 * i / (p.feathers - 1), ar = a * Math.PI / 180, len = p.tailLen;
    const tipX = Math.sin(ar) * len, tipY = pv - Math.cos(ar) * len;
    if (p.tailTent) {
      s += tentacle(0, pv, ar, len * 1.3, 11, FEATHERS[i % 4], rT, 7, p.featherEyes ? 'eye' : null);
    } else if (p.cutlery) {
      const k = len - 14;
      const hd = i % 2
        ? `<ellipse cx="0" cy="${f1(-len + 6)}" rx="6" ry="8.5" fill="var(--ink-soft)"/>`
        : `<path d="M-6 ${f1(-k)}H6M-6 ${f1(-k)}V${f1(-len)}M0 ${f1(-k)}V${f1(-len)}M6 ${f1(-k)}V${f1(-len)}" stroke="var(--ink-soft)" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
      s += `<g transform="translate(0 ${f1(pv)}) rotate(${f1(a)})"><path d="M0 0V${f1(-k)}" stroke="var(--ink-soft)" stroke-width="3.4" stroke-linecap="round" fill="none"/>${hd}</g>`;
      pt(tipX, tipY, 8);
    } else {
      s += `<ellipse cx="0" cy="${f1(-len / 2)}" rx="9.5" ry="${f1(len / 2)}" fill="${FEATHERS[i % 4]}" transform="translate(0 ${f1(pv)}) rotate(${f1(a)})"/>`;
      pt(tipX, tipY, 10);
      if (p.featherEyes) s += eye(Math.sin(ar) * (len - 9), pv - Math.cos(ar) * (len - 9), 4);
    }
  }

  // legs, or what replaces them
  if (p.tentLegs) {
    const rL = R(2), k = p.tentLegs;
    for (let j = 0; j < k; j++) {
      const u = k === 1 ? 0 : j / (k - 1) * 2 - 1, th = Math.PI + u * .55;
      const bx = u * rx * .65, by = cy + ry * .55;
      s += tentacle(bx, by, th, (-by) / Math.cos(u * .55) * 1.02, 8 * sw, 'var(--brown)', rL, 3, null);
    }
  } else {
    const hip = cy + 18;
    const leg = (x, dx, c) => `<path class="leg ${c}" d="M${x} ${f1(hip)}L${x + dx} 0l-7 2M${x + dx} 0l0 3.5M${x + dx} 0l7 2" stroke="var(--mustard)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    s += leg(-9, -2, 'leg-a') + leg(9, 2, 'leg-b');
  }

  // extra heads, behind the main one
  const slots = [[-30, -1.0], [-52, -.7], [0, -1.35]];
  for (let k = 0; k < p.heads; k++) {
    const nb = [-8 - k * 6, cy - ry * .6];
    const hx = slots[k][0] * sw, hy = cy - ry * .5 + slots[k][1] * (30 + p.neck);
    s += `<path d="M${f1(nb[0])} ${f1(nb[1])}Q${f1(hx - 14)} ${f1((nb[1] + hy) / 2)} ${f1(hx)} ${f1(hy)}" stroke="var(--brown)" stroke-width="8" stroke-linecap="round" fill="none"/>`;
    s += head(hx, hy, 15, 3);
  }

  // body
  s += `<ellipse cx="0" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="var(--brown)"/>`;
  s += `<ellipse cx="${f1(-5 * sw)}" cy="${f1(cy + 3)}" rx="${f1(17 * sw)}" ry="${f1(12 * sw)}" fill="var(--pupil)" opacity=".18" transform="rotate(-14 ${f1(-5 * sw)} ${f1(cy + 3)})"/>`;
  pt(-rx, cy, 0); pt(rx, cy, 0);

  // eyes that grow on the body, and a mouth where no mouth should be
  const mx = 8 * sw, my = cy + 9 * sw;
  s += K.scatter(p.bodyEyes, 0, cy, rx * .8, ry * .75, 2.6 * sw, 6.2 * sw,
    (x, y) => ((x - mx) / (19 * sw)) ** 2 + ((y - my) / (13 * sw)) ** 2 < 1.2, 3);
  if (p.maw > 0) s += K.maw(mx, my, 16 * sw * p.maw, 9 * sw * p.maw);

  // eye stalks
  const rS = R(4);
  for (let i = 0; i < p.stalks; i++) {
    const ang = -1.1 + 2.2 * (i + .5) / 6;
    const bx = Math.sin(ang) * rx * .6, by = cy - Math.cos(ang) * ry * .8;
    const ex = Math.sin(ang) * (rx + 16 + (i % 2) * 10), ey = cy - Math.cos(ang) * (ry + 26 + (i % 2) * 14);
    s += `<g>${anim(8, bx, by, rS)}<path d="M${f1(bx)} ${f1(by)}Q${f1((bx + ex) / 2 + 8)} ${f1((by + ey) / 2)} ${f1(ex)} ${f1(ey)}" stroke="var(--brown-2)" stroke-width="2.6" stroke-linecap="round" fill="none"/>${eye(ex, ey, 4.6)}</g>`;
  }

  // main neck and head
  const hr = 11 + (p.headEyes - 1) * 2, hx = 22 * sw, hy = cy - 18 * sw - p.neck;
  s += `<path d="M${f1(12 * sw)} ${f1(cy - 12 * sw)}Q${f1(30 * sw + p.neck * .15)} ${f1(cy - 16 * sw - p.neck / 2)} ${f1(hx)} ${f1(hy)}" stroke="var(--brown)" stroke-width="10" stroke-linecap="round" fill="none"/>`;
  s += head(hx, hy, hr, p.headEyes);

  // something standing on its head
  if (p.hatDepth > 0) {
    const sub = params('none', p.seed + 11, p.m * .85);
    sub.hatDepth = p.hatDepth - 1;
    const d = drawTurkey(sub), sc = p.hatDepth > 1 || sub.hatDepth ? .5 : .4, ty = hy - hr + 2;
    s += `<g transform="translate(${f1(hx)} ${f1(ty)}) scale(${sc})">${d.g}</g>`;
    pt(hx + d.B.x0 * sc, ty); pt(hx + d.B.x1 * sc, ty); pt(hx, ty + d.B.y0 * sc);
  }
  return { g: s, B: K.B };
}

/* ---------- roasted turkeys ---------- */
// A roast made at madness m. Each turkey's trait carries over into its roast.
function roastParams(trait, seed, m) {
  const s = (a, b) => ss(a, b, m);
  const eyesy = trait === 'eyes';
  return {
    seed, m, horror: m > .5,
    legs: (trait === 'stilts' ? 80 : 24) * s(.2, .5),
    drums: 2 + 2 * Math.round(2 * s(.12, .5)),
    drumLen: 26 * (1 + (trait === 'neck' ? 2.2 : 1) * s(.25, .7)),
    garnish: 5 + Math.round(6 * s(.1, .6)),
    bigEye: m > (eyesy ? .1 : .32),
    bodyEyes: Math.round((eyesy ? 14 : 10) * s(eyesy ? .2 : .5, .95)),
    maw: s(.68, .88),
    apple: m > .76,
    tents: m > .58 ? 2 + Math.round(4 * s(.58, .9)) : 0,
    steam: trait === 'tail' ? 5 : 3,
    steamLen: 22 * (1 + (trait === 'tail' ? 1.5 : .4) * s(.15, .6)),
    steamEyes: m > .42,
    halo: Math.round(9 * s(.82, 1)),
    swell: 1 + .3 * s(.6, 1),
    cutlery: trait === 'cutlery' && m > .12,
    hatDepth: trait === 'totem' ? (m > .3 ? 2 : m > .12 ? 1 : 0) : (trait === 'hat' && m > .12 ? 1 : 0)
  };
}

function drawRoast(p) {
  const K = makeKit(p), { pt, R, anim, eye, frill, tentacle } = K;
  const sw = p.swell, platY = -p.legs - 6;
  const rx = 40 * sw, ry = 24 * sw, cy = platY - ry + 5;
  let s = '';
  const drum = (bx, by, th, len, r) => {
    const dx = Math.sin(th), dy = -Math.cos(th);
    const mx = bx + dx * len * .62, my = by + dy * len * .62, ex = bx + dx * len, ey = by + dy * len;
    pt(bx, by, 8); pt(mx, my, 8); pt(ex, ey, 7);
    return `<g>${p.horror ? anim(6, bx, by, r) : ''}` +
      `<path d="M${f1(bx)} ${f1(by)}L${f1(mx)} ${f1(my)}" stroke="var(--brown-2)" stroke-width="${f1(13 * sw)}" stroke-linecap="round" fill="none"/>` +
      `<path d="M${f1(bx)} ${f1(by)}L${f1(mx)} ${f1(my)}" stroke="var(--brown)" stroke-width="${f1(5 * sw)}" stroke-linecap="round" fill="none" opacity=".35"/>` +
      `<path d="M${f1(mx)} ${f1(my)}L${f1(ex)} ${f1(ey)}" stroke="var(--eye)" stroke-width="4" stroke-linecap="round" fill="none"/>` +
      `${frill(ex, ey, 6)}</g>`;
  };

  // a halo of drumsticks, for the end times
  if (p.halo) {
    const rH = R(5);
    for (let i = 0; i < p.halo; i++) {
      const a = (-80 + 160 * i / (p.halo - 1 || 1)) * Math.PI / 180;
      s += drum(Math.sin(a) * rx * .3, cy - Math.cos(a) * ry * .3, a, rx + 34, rH);
    }
  }

  // the platter grows legs
  if (p.legs > 1) {
    const leg = (x, dx, c) => `<path class="leg ${c}" d="M${x} ${f1(platY + 4)}L${x + dx} 0l-7 2M${x + dx} 0l0 3.5M${x + dx} 0l7 2" stroke="var(--mustard)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    s += leg(-26, -4, 'leg-a') + leg(26, 4, 'leg-b');
  }

  // platter and garnish
  const prx = 58 * sw;
  s += `<ellipse cx="0" cy="${f1(platY)}" rx="${f1(prx)}" ry="10" fill="var(--eye)" stroke="var(--ink-soft)" stroke-width="1.5"/>`;
  s += `<ellipse cx="0" cy="${f1(platY - 1)}" rx="${f1(prx * .8)}" ry="6.5" fill="none" stroke="var(--line)" stroke-width="1.2"/>`;
  pt(-prx, platY, 10); pt(prx, platY, 10);
  for (let i = 0; i < p.garnish; i++) {
    const a = (i + .5) / p.garnish * TAU, gx = Math.cos(a) * prx * .82, gy = platY + Math.sin(a) * 6;
    s += i % 2
      ? `<circle cx="${f1(gx)}" cy="${f1(gy - 2)}" r="3.2" fill="var(--persimmon)"/><circle cx="${f1(gx + 4)}" cy="${f1(gy - 1)}" r="2.6" fill="var(--persimmon)"/>`
      : `<circle cx="${f1(gx)}" cy="${f1(gy - 3)}" r="5" fill="var(--mustard)"/><circle cx="${f1(gx)}" cy="${f1(gy - 3)}" r="3.4" fill="none" stroke="var(--eye)" stroke-width=".8" opacity=".8"/>`;
  }

  // tentacles draped over the platter
  if (p.tents) {
    const rT = R(6), k = p.tents;
    for (let j = 0; j < k; j++) {
      const u = k === 1 ? 0 : j / (k - 1) * 2 - 1;
      s += tentacle(u * rx * .75, cy + ry * .45, Math.PI - u * .35 * Math.PI, 34 + rT() * 16, 8 * sw, 'var(--brown-2)', rT, 4, 'frill');
    }
  }

  // the roast itself
  s += `<ellipse cx="0" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="var(--brown-2)"/>`;
  s += `<ellipse cx="0" cy="${f1(cy + ry * .38)}" rx="${f1(rx * .94)}" ry="${f1(ry * .55)}" fill="var(--brown)" opacity=".55"/>`;
  for (let i = 0; i < 3; i++) {
    const x = -rx * .45 + i * rx * .38;
    s += `<path d="M${f1(x)} ${f1(cy - ry * .78)}q${f1(rx * .12)} ${f1(ry * .5)} 0 ${f1(ry * 1.05)}" stroke="var(--brown)" stroke-width="2" fill="none" opacity=".45" stroke-linecap="round"/>`;
  }
  s += `<ellipse cx="${f1(-rx * .28)}" cy="${f1(cy - ry * .5)}" rx="${f1(rx * .32)}" ry="${f1(ry * .16)}" fill="var(--eye)" opacity=".4" transform="rotate(-8 ${f1(-rx * .28)} ${f1(cy - ry * .5)})"/>`;
  pt(-rx, cy, 0); pt(rx, cy, 0); pt(0, cy - ry, 0);

  // it should not be looking at you
  const mx = -rx * .12, my = cy + ry * .35, ex = rx * .38, ey = cy - ry * .15;
  s += K.scatter(p.bodyEyes, 0, cy, rx * .8, ry * .72, 2.4 * sw, 5.5 * sw,
    (x, y) => ((x - mx) / (20 * sw)) ** 2 + ((y - my) / (12 * sw)) ** 2 < 1.2 || Math.hypot(x - ex, y - ey) < 12 * sw, 3);
  if (p.bigEye) s += eye(ex, ey, 7.5 * sw);
  if (p.maw > 0) {
    s += K.maw(mx, my, 17 * sw * p.maw, 9 * sw * p.maw);
    if (p.apple) {
      const ar = 6.5 * sw * p.maw;
      s += `<circle cx="${f1(mx)}" cy="${f1(my)}" r="${f1(ar)}" fill="var(--persimmon)"/><path d="M${f1(mx)} ${f1(my - ar)}l1.5 -4" stroke="var(--brown)" stroke-width="1.6" stroke-linecap="round" fill="none"/>`;
    }
  }

  // a fork and knife left standing in it
  if (p.cutlery) {
    const fx = -rx * .38, fy = cy - ry * .55, kx = rx * .05, ky = cy - ry * .75;
    s += `<g transform="rotate(-18 ${f1(fx)} ${f1(fy)})"><path d="M${f1(fx)} ${f1(fy)}V${f1(fy - 30)}M${f1(fx - 5)} ${f1(fy - 30)}H${f1(fx + 5)}M${f1(fx - 5)} ${f1(fy - 30)}V${f1(fy - 42)}M${f1(fx)} ${f1(fy - 30)}V${f1(fy - 42)}M${f1(fx + 5)} ${f1(fy - 30)}V${f1(fy - 42)}" stroke="var(--ink-soft)" stroke-width="2.6" stroke-linecap="round" fill="none"/></g>`;
    s += `<g transform="rotate(14 ${f1(kx)} ${f1(ky)})"><path d="M${f1(kx)} ${f1(ky)}V${f1(ky - 18)}" stroke="var(--ink-soft)" stroke-width="3.4" stroke-linecap="round" fill="none"/><path d="M${f1(kx - 2.5)} ${f1(ky - 18)}L${f1(kx - 2.5)} ${f1(ky - 44)}Q${f1(kx + 5)} ${f1(ky - 36)} ${f1(kx + 3)} ${f1(ky - 18)}Z" fill="var(--line)" stroke="var(--ink-soft)" stroke-width="1"/></g>`;
    pt(fx - 16, fy - 44); pt(kx + 14, ky - 46);
    if (p.horror) s += eye(kx + 1, ky - 32, 2.6);
  }

  // drumsticks, multiplying
  const rD = R(7);
  for (let k = 0; k < p.drums; k++) {
    const side = k % 2 ? 1 : -1, tier = Math.floor(k / 2);
    const bx = side * rx * (.62 - tier * .16), by = cy + ry * (.15 - tier * .3), th = side * (.3 + tier * .12) * Math.PI;
    s += drum(bx, by, th, p.drumLen, rD);
  }

  // steam, which eventually looks back
  for (let i = 0; i < p.steam; i++) {
    const x = -rx * .4 + rx * .8 * (p.steam === 1 ? .5 : i / (p.steam - 1));
    const y0 = cy - ry - 4, L = p.steamLen * (i % 2 ? 1 : .8);
    pt(x, y0 - L, 6);
    s += `<g class="steam" style="animation-delay:-${f1(i * .7)}s"><path d="M${f1(x)} ${f1(y0)}q-6 ${f1(-L * .25)} 0 ${f1(-L * .5)}q6 ${f1(-L * .25)} 0 ${f1(-L * .5)}" stroke="var(--ink-soft)" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".5"/>${p.steamEyes ? eye(x, y0 - L - 3, 3.4) : ''}</g>`;
  }

  // a smaller roast on top of the roast
  if (p.hatDepth > 0) {
    const sub = roastParams('none', p.seed + 11, p.m * .85);
    sub.hatDepth = p.hatDepth - 1;
    const d = drawRoast(sub), sc = .42, ty = cy - ry + 3;
    s += `<g transform="translate(0 ${f1(ty)}) scale(${sc})">${d.g}</g>`;
    pt(d.B.x0 * sc, ty); pt(d.B.x1 * sc, ty); pt(0, ty + d.B.y0 * sc);
  }
  return { g: s, B: K.B };
}

/* ---------- Lauren mode: fall decorations that stay pretty ---------- */
function maple(K, cx, cy, size, color) {
  const P = [];
  for (let i = 0; i < 180; i++) {
    const th = i / 180 * TAU;
    let r = size * (.38 + .62 * Math.pow(Math.abs(Math.cos(2.5 * th)), .7));
    r *= 1 - .25 * (1 - Math.cos(th)) / 2;
    r *= 1 + .05 * tri(th * 24);
    const x = cx + Math.sin(th) * r, y = cy - Math.cos(th) * r;
    P.push(`${f1(x)} ${f1(y)}`); K.pt(x, y);
  }
  let g = `<path d="M${P.join('L')}Z" fill="${color}"/>`;
  for (const a of [0, 72, -72, 144, -144]) {
    const ar = a * Math.PI / 180, rr = size * (a === 0 ? .85 : Math.abs(a) > 100 ? .5 : .75);
    g += `<path d="M${f1(cx)} ${f1(cy + size * .15)}L${f1(cx + Math.sin(ar) * rr)} ${f1(cy - Math.cos(ar) * rr)}" stroke="var(--brown)" stroke-width="${f1(Math.max(.8, size * .035))}" opacity=".45" stroke-linecap="round" fill="none"/>`;
  }
  return g;
}
function oak(K, cx, cy, size, color, tilt) {
  const c = Math.cos(tilt), sn = Math.sin(tilt);
  const rot = (x, y) => [cx + x * c - y * sn, cy + x * sn + y * c];
  const P = [];
  for (let i = 0; i < 160; i++) {
    const th = i / 160 * TAU, lob = .82 + .22 * Math.pow(Math.abs(Math.cos(4.5 * th)), .5);
    const [x, y] = rot(Math.sin(th) * size * .42 * lob, -Math.cos(th) * size * lob);
    P.push(`${f1(x)} ${f1(y)}`); K.pt(x, y);
  }
  const [ax, ay] = rot(0, size * 1.25), [bx, by] = rot(0, -size * .85);
  K.pt(ax, ay);
  let g = `<path d="M${P.join('L')}Z" fill="${color}"/>`;
  g += `<path d="M${f1(ax)} ${f1(ay)}L${f1(bx)} ${f1(by)}" stroke="var(--brown)" stroke-width="1.6" opacity=".5" stroke-linecap="round" fill="none"/>`;
  for (let i = -2; i <= 2; i++) {
    const [s1x, s1y] = rot(0, i * size * .3), [l1x, l1y] = rot(-size * .28, i * size * .3 - size * .18), [r1x, r1y] = rot(size * .28, i * size * .3 - size * .18);
    g += `<path d="M${f1(l1x)} ${f1(l1y)}L${f1(s1x)} ${f1(s1y)}L${f1(r1x)} ${f1(r1y)}" stroke="var(--brown)" stroke-width="1.1" opacity=".35" fill="none" stroke-linecap="round"/>`;
  }
  return g;
}
function acorn(K, x, sc) {
  const capY = -26 * sc;
  K.pt(x - 13 * sc, capY - 14 * sc); K.pt(x + 13 * sc, 0);
  let g = `<ellipse cx="${f1(x)}" cy="${f1(-14 * sc)}" rx="${f1(11 * sc)}" ry="${f1(15 * sc)}" fill="var(--brown-2)"/>`;
  g += `<ellipse cx="${f1(x - 4 * sc)}" cy="${f1(-14 * sc)}" rx="${f1(3 * sc)}" ry="${f1(7 * sc)}" fill="var(--eye)" opacity=".25"/>`;
  g += `<path d="M${f1(x + 1 * sc)} ${f1(capY - 6 * sc)}l${f1(3 * sc)} ${f1(-7 * sc)}" stroke="var(--brown)" stroke-width="${f1(3 * sc)}" stroke-linecap="round" fill="none"/>`;
  g += `<path d="M${f1(x - 13 * sc)} ${f1(capY)}Q${f1(x)} ${f1(capY - 17 * sc)} ${f1(x + 13 * sc)} ${f1(capY)}Q${f1(x)} ${f1(capY + 5 * sc)} ${f1(x - 13 * sc)} ${f1(capY)}Z" fill="var(--brown)"/>`;
  for (let i = 0; i < 5; i++) g += `<circle cx="${f1(x - 8 * sc + i * 4 * sc)}" cy="${f1(capY - 4 * sc - (i % 2) * 2 * sc)}" r="${f1(1.1 * sc)}" fill="var(--pupil)" opacity=".25"/>`;
  return g;
}
function drawPretty(kind) {
  const K = makeKit({ seed: 1, m: 0, horror: false }, { x0: 0, x1: 0, y0: 0 });
  let s = '';
  if (kind === 'maple') {
    s += maple(K, 0, -58, 46, 'var(--persimmon)');
    s += `<path d="M0 -50Q2 -24 5 0" stroke="var(--brown)" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
  } else if (kind === 'oak') {
    s += oak(K, 0, -50, 40, 'var(--mustard)', .35);
  } else if (kind === 'sweater') {
    s += `<path d="M-13 -76L-32 -72L-54 -54L-61 -24L-47 -20L-31 -50L-31 0L31 0L31 -50L47 -20L61 -24L54 -54L32 -72L13 -76Q0 -66 -13 -76Z" fill="var(--cobalt)"/>`;
    s += `<path d="M-32 -72L-54 -54L-61 -24L-47 -20L-31 -50Z" fill="var(--pupil)" opacity=".12"/><path d="M32 -72L54 -54L61 -24L47 -20L31 -50Z" fill="var(--pupil)" opacity=".12"/>`;
    s += `<rect x="-31" y="-8" width="62" height="8" fill="var(--pupil)" opacity=".18"/>`;
    for (let x = -28; x <= 28; x += 4) s += `<path d="M${x} -8V0" stroke="var(--pupil)" stroke-width="1" opacity=".2"/>`;
    s += `<path d="M-60 -27L-47 -23M60 -27L47 -23" stroke="var(--mustard)" stroke-width="6" stroke-linecap="butt" fill="none"/>`;
    s += `<path d="M-13 -76Q0 -66 13 -76" stroke="var(--mustard)" stroke-width="5" stroke-linecap="round" fill="none"/>`;
    let z = '';
    for (let i = 0; i <= 12; i++) z += `${i ? 'L' : 'M'}${-30 + i * 5} ${i % 2 ? -34 : -40}`;
    s += `<path d="${z}" stroke="var(--mustard)" stroke-width="2.4" stroke-linejoin="round" fill="none"/>`;
    s += `<path d="${z.replace(/-34/g, '-16').replace(/-40/g, '-22')}" stroke="var(--mustard)" stroke-width="2.4" stroke-linejoin="round" fill="none"/>`;
    for (let x = -27; x <= 27; x += 6.75) s += `<circle cx="${f1(x)}" cy="-28" r="1.7" fill="var(--persimmon)"/>`;
    s += maple(K, 0, -54, 8, 'var(--persimmon)');
    K.pt(-61, -76); K.pt(61, 0);
  } else if (kind === 'pumpkin') {
    const lobe = (cx, cy, rx, ry, dark) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="var(--persimmon)" stroke="var(--brown)" stroke-width="1.2" stroke-opacity=".35"/>` +
      (dark ? `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="var(--brown)" opacity="${dark}"/>` : '');
    s += lobe(-33, -26, 14, 26, .25) + lobe(33, -26, 14, 26, .25) + lobe(-20, -29, 22, 29, .12) + lobe(20, -29, 22, 29, .12) + lobe(0, -30, 20, 30, 0);
    s += `<ellipse cx="-9" cy="-42" rx="5" ry="10" fill="var(--eye)" opacity=".25"/>`;
    s += `<path d="M-3 -57C-2 -65 2 -71 7 -75L12 -72C8 -68 5 -63 5 -56Z" fill="var(--brown)"/>`;
    s += `<path d="M5 -62c10 -4 18 2 14 9c-3 5 -10 2 -7 -2" stroke="var(--brown-2)" stroke-width="2" stroke-linecap="round" fill="none"/>`;
    s += maple(K, -16, -66, 9, 'var(--mustard)');
    K.pt(-47, -76); K.pt(47, 0);
  } else if (kind === 'mug') {
    for (const [x, d] of [[-8, 0], [8, 1.1]]) s += `<g class="steam" style="animation-delay:-${d}s"><path d="M${x} -64q-5 -6 0 -12q5 -6 0 -12" stroke="var(--ink-soft)" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".45"/></g>`;
    s += `<rect x="-4" y="-84" width="7" height="34" rx="2" fill="var(--brown)" transform="rotate(18 0 -56)"/>`;
    s += `<path d="M24 -44c18 0 18 30 0 30" stroke="var(--cobalt)" stroke-width="7" stroke-linecap="round" fill="none"/>`;
    s += `<rect x="-24" y="-56" width="48" height="56" rx="7" fill="var(--cobalt)"/>`;
    s += `<rect x="-24" y="-32" width="48" height="6" fill="var(--mustard)"/>`;
    s += `<ellipse cx="0" cy="-56" rx="24" ry="5" fill="var(--brown-2)" stroke="var(--cobalt)" stroke-width="2"/>`;
    s += `<circle cx="-15" cy="-58" r="6" fill="var(--mustard)"/><circle cx="-15" cy="-58" r="4.2" fill="none" stroke="var(--eye)" stroke-width=".9" opacity=".8"/>`;
    s += maple(K, 0, -14, 8, 'var(--persimmon)');
    K.pt(-24, -90); K.pt(44, 0);
  } else if (kind === 'acorns') {
    s += oak(K, 8, -44, 30, 'var(--mustard)', .6);
    s += acorn(K, -14, 1.1) + acorn(K, 15, .9);
  }
  return { g: s, B: K.B };
}

/* ---------- the cornucopia ---------- */
function drawCornucopia() {
  const P = [[182, 90], [120, 146], [36, 128], [40, 64]];
  const bz = (t, i) => (1 - t) ** 3 * P[0][i] + 3 * (1 - t) ** 2 * t * P[1][i] + 3 * (1 - t) * t * t * P[2][i] + t ** 3 * P[3][i];
  const dz = (t, i) => 3 * (1 - t) ** 2 * (P[1][i] - P[0][i]) + 6 * (1 - t) * t * (P[2][i] - P[1][i]) + 3 * t * t * (P[3][i] - P[2][i]);
  const rings = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    rings.push([bz(t, 0), bz(t, 1), Math.atan2(dz(t, 1), dz(t, 0)), 44 - 34 * Math.pow(t, .8)]);
  }
  const C = [[40, 64], [38, 34], [64, 36]];
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    const x = (1 - t) ** 2 * C[0][0] + 2 * (1 - t) * t * C[1][0] + t * t * C[2][0];
    const y = (1 - t) ** 2 * C[0][1] + 2 * (1 - t) * t * C[1][1] + t * t * C[2][1];
    const dx = 2 * (1 - t) * (C[1][0] - C[0][0]) + 2 * t * (C[2][0] - C[1][0]);
    const dy = 2 * (1 - t) * (C[1][1] - C[0][1]) + 2 * t * (C[2][1] - C[1][1]);
    rings.push([x, y, Math.atan2(dy, dx), 9 - 5 * t]);
  }
  let s = `<ellipse cx="140" cy="152" rx="104" ry="6" fill="var(--ink)" opacity=".12"/>`;
  for (let k = 0; k < 4; k++) {
    const ex = 196 + k * 13, ey = 26 + k * 7;
    s += `<path d="M182 88Q${190 + k * 8} ${60 - k * 4} ${ex} ${ey}" stroke="var(--mustard)" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    for (let j = 0; j < 4; j++) s += `<ellipse cx="${ex - 2 - j * 2.2}" cy="${ey + 3 + j * 5}" rx="2.2" ry="4" fill="var(--mustard)" transform="rotate(25 ${ex - 2 - j * 2.2} ${ey + 3 + j * 5})"/>`;
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const [x, y, a, r] = rings[i];
    s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r * .42)}" ry="${f1(r)}" transform="rotate(${f1(a * 180 / Math.PI)} ${f1(x)} ${f1(y)})" fill="${i % 2 ? 'var(--mustard)' : 'var(--brown-2)'}" stroke="var(--brown)" stroke-width="1.2"/>`;
  }
  const a0 = rings[0][2] * 180 / Math.PI;
  s += `<ellipse cx="186" cy="86" rx="13" ry="37" transform="rotate(${f1(a0)} 186 86)" fill="var(--pupil)"/>`;
  s += `<g class="cc-eye"><circle cx="186" cy="86" r="11" fill="var(--eye)"/><circle cx="186" cy="86" r="7.2" fill="var(--mustard)"/><ellipse cx="186" cy="86" rx="2.2" ry="6.4" fill="var(--pupil)"/></g>`;
  // grapes
  for (const [x, y] of [[198, 50], [208, 52], [203, 60], [213, 61], [193, 59], [208, 69], [198, 68]]) {
    s += `<circle cx="${x}" cy="${y}" r="6" fill="var(--cobalt)"/><circle cx="${x - 2}" cy="${y - 2}" r="1.6" fill="var(--eye)" opacity=".45"/>`;
  }
  // gourd
  s += `<ellipse cx="228" cy="88" rx="22" ry="12" transform="rotate(-18 228 88)" fill="var(--mustard)"/><ellipse cx="212" cy="96" rx="11" ry="10" fill="var(--mustard)"/><path d="M248 80l7 -5" stroke="var(--brown)" stroke-width="3" stroke-linecap="round"/>`;
  // pumpkin
  s += `<ellipse cx="192" cy="128" rx="12" ry="18" fill="var(--persimmon)"/><ellipse cx="228" cy="128" rx="12" ry="18" fill="var(--persimmon)"/><ellipse cx="192" cy="128" rx="12" ry="18" fill="var(--brown)" opacity=".2"/><ellipse cx="228" cy="128" rx="12" ry="18" fill="var(--brown)" opacity=".2"/>`;
  s += `<ellipse cx="210" cy="128" rx="17" ry="20" fill="var(--persimmon)" stroke="var(--brown)" stroke-opacity=".35" stroke-width="1.2"/><path d="M208 109c0 -5 2 -8 5 -10l3 2c-2 2 -3 5 -3 8z" fill="var(--brown)"/>`;
  // apple
  s += `<circle cx="250" cy="138" r="11" fill="var(--persimmon)"/><path d="M250 127l2 -6" stroke="var(--brown)" stroke-width="2" stroke-linecap="round"/><ellipse cx="256" cy="122" rx="5" ry="2.4" transform="rotate(-25 256 122)" fill="var(--mustard)"/>`;
  return `<svg viewBox="0 0 270 162" aria-hidden="true">${s}</svg>`;
}

/* ---------- sprites: the parade and the section-heading turkeys ---------- */
// d = head start before a turkey turns (higher = later). pretty = what it is in Lauren mode.
const PARADE = [
  { trait: 'stilts', seed: 4, s: .8, x: 4, dur: 70, d: .02, pretty: 'sweater' },
  { trait: 'cutlery', seed: 7, s: .92, x: 22, dur: 58, d: .14, pretty: 'maple' },
  { trait: 'neck', seed: 9, s: .85, x: 38, dur: 64, d: .06, pretty: 'pumpkin' },
  { trait: 'eyes', seed: 12, s: .92, x: 55, dur: 52, d: .22, pretty: 'mug' },
  { trait: 'hat', seed: 15, s: .92, x: 72, dur: 60, d: .1, pretty: 'oak' },
  { trait: 'tail', seed: 21, s: .8, x: 88, dur: 74, d: .18, pretty: 'acorns' }
];
const PRETTY = {
  sweater: { scale: 1.35, lift: 60, float: true },
  maple: { scale: 1.2, lift: 110, float: true },
  pumpkin: { scale: 1.55, lift: 0 },
  mug: { scale: 1.4, lift: 0 },
  oak: { scale: 1.35, lift: 40, float: true },
  acorns: { scale: 1.55, lift: 0 }
};
const ART = [
  ['art-host', 'hat', 30, .12, 'pumpkin'],
  ['art-sides', 'neck', 33, .2, 'maple'],
  ['art-more', 'cutlery', 36, .26, 'mug'],
  ['art-roster', 'totem', 39, .3, 'sweater']
];

const sprites = [];
const parade = document.getElementById('parade');
PARADE.forEach(t => {
  const box = document.createElement('div');
  box.className = 'walker';
  box.style.cssText = `left:${t.x}%;--dur:${t.dur}s;--delay:${-(t.x + 10) / 110 * t.dur}s`;
  const el = document.createElement('div');
  el.className = 'sprite';
  box.appendChild(el);
  parade.appendChild(box);
  sprites.push({ box, el, trait: t.trait, seed: t.seed, d: t.d, scale: t.s, pretty: t.pretty, walker: true, q: -1, roast: false });
});
ART.forEach(([id, trait, seed, d, pretty]) => {
  const box = document.getElementById(id);
  if (!box) return;
  const el = document.createElement('span');
  el.className = 'sprite';
  box.appendChild(el);
  sprites.push({ box, el, trait, seed, d, scale: 0, pretty, walker: false, q: -1, roast: false });
});

let mode = 'landon';
try { if (localStorage.getItem('dd-mode') === 'lauren') mode = 'lauren'; } catch (e) {}
let t0 = performance.now();
const elapsed = () => (performance.now() - t0) / 1000;
const madness = () => clamp01((elapsed() - GRACE) / RAMP);
const qFor = sp => Math.round(clamp01(madness() * 1.3 - sp.d) * 60) / 60;

function render(sp) {
  if (mode === 'lauren') {
    const pr = PRETTY[sp.pretty];
    sp.el.innerHTML = svgOf(drawPretty(sp.pretty), sp.scale * pr.scale);
    if (sp.walker) {
      sp.box.classList.toggle('floaty', !!pr.float);
      sp.box.style.bottom = `calc(${pr.lift}px * var(--pscale))`;
    }
    sp.q = -1;
    return;
  }
  if (sp.walker) { sp.box.classList.remove('floaty'); sp.box.style.bottom = ''; }
  const q = qFor(sp);
  sp.q = q;
  const d = sp.roast ? drawRoast(roastParams(sp.trait, sp.seed, q)) : drawTurkey(params(sp.trait, sp.seed, q));
  sp.el.innerHTML = svgOf(d, sp.scale);
}
function flash(el, cls, ms) {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  clearTimeout(el['_t' + cls]);
  el['_t' + cls] = setTimeout(() => el.classList.remove(cls), ms);
}
function puff(box, pretty, n = 10) {
  if (RM) return;
  const colors = pretty ? ['var(--persimmon)', 'var(--mustard)', 'var(--brown-2)'] : ['var(--eye)', 'var(--eye)', 'var(--mustard)', 'var(--persimmon)'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span');
    const a = Math.random() * TAU, dist = 30 + Math.random() * 40;
    p.className = pretty ? 'puff leafy' : 'puff';
    p.style.cssText = `--x:${f1(35 + Math.random() * 30)}%;--y:${f1(20 + Math.random() * 40)}%;--s:${f1(8 + Math.random() * 12)}px;` +
      `--dx:${f1(Math.cos(a) * dist)}px;--dy:${f1(Math.sin(a) * dist - 20)}px;--c:${colors[i % colors.length]}`;
    box.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}
function morph(sp, roast) {
  if (sp.busy) return;
  sp.busy = true;
  puff(sp.box, false);
  const swap = () => { sp.roast = roast; render(sp); flash(sp.el, 'pop', 650); sp.busy = false; };
  if (RM) { swap(); return; }
  sp.el.classList.add('poof');
  setTimeout(() => { sp.el.classList.remove('poof'); swap(); }, 280);
}
sprites.forEach(sp => {
  sp.box.addEventListener('click', () => {
    if (mode === 'lauren') { flash(sp.el, 'jiggle', 520); puff(sp.box, true, 6); return; }
    if (sp.roast) { flash(sp.el, 'jiggle', 520); return; }
    morph(sp, true);
  });
});

// The cornucopia puts everything back to normal turkeys.
const cc = document.getElementById('cornucopia');
if (cc) {
  cc.innerHTML = drawCornucopia();
  cc.addEventListener('click', () => {
    t0 = performance.now();
    flash(cc, 'shake', 650);
    sprites.forEach((sp, i) => {
      if (mode === 'lauren') { sp.roast = false; return; }
      if (!sp.roast && sp.q === 0) return;
      setTimeout(() => morph(sp, false), RM ? 0 : i * 70);
    });
    tick();
  });
}

// Lauren mode / Landon mode
const modeBtn = document.getElementById('modeBtn');
function applyMode() {
  document.documentElement.classList.toggle('lauren', mode === 'lauren');
  if (modeBtn) modeBtn.textContent = mode === 'lauren' ? 'Landon mode' : 'Lauren mode';
  sprites.forEach(render);
  tick();
}
if (modeBtn) {
  modeBtn.addEventListener('click', () => {
    mode = mode === 'lauren' ? 'landon' : 'lauren';
    try { localStorage.setItem('dd-mode', mode); } catch (e) {}
    applyMode();
  });
}

// Mockup-only "Turkey time" slider (only present while the page has no Sheet connected).
const slider = document.getElementById('turkeyTime');
const sliderOut = document.getElementById('turkeyTimeOut');
let dragging = false;
if (slider) {
  slider.addEventListener('input', () => {
    dragging = true;
    t0 = performance.now() - (GRACE + RAMP * slider.value / 100) * 1000;
    tick();
  });
  slider.addEventListener('change', () => { dragging = false; });
}

function tick() {
  if (mode !== 'lauren') {
    for (const sp of sprites) {
      if (sp.busy) continue;
      if (qFor(sp) !== sp.q) render(sp);
    }
  }
  if (cc) cc.classList.toggle('watching', mode !== 'lauren' && madness() > .6);
  if (sliderOut) {
    const e = Math.floor(elapsed());
    sliderOut.textContent = `${Math.floor(e / 60)}:${String(e % 60).padStart(2, '0')}`;
    if (!dragging) slider.value = Math.round(madness() * 100);
  }
}
applyMode();
setInterval(tick, 1000);
})();

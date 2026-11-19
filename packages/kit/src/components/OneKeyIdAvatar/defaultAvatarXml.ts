// The default OneKey ID avatar: a gumdrop character wearing one accessory,
// drawn as SVG markup from the OneKey user ID. Each pick below is part of how
// a user recognizes themselves, so palettes, accessories and pick slots are
// append-only: reordering them changes avatars people already have.

type IAccessory =
  | 'cap'
  | 'beanie'
  | 'headphones'
  | 'crown'
  | 'party'
  | 'sunglasses'
  | 'sprout'
  | 'bow';
type IEyes = 'round' | 'sparkle' | 'happy' | 'wink' | 'calm';
type IMouth = 'smile' | 'grin' | 'oh' | 'cat';

interface IPalette {
  name: string;
  bg: string;
  body: string;
  // Warm blush turns khaki on green and teal bodies, so those go without.
  cheek: string | null;
  accents: [string, string];
  avoid?: IAccessory[];
  dark?: boolean;
}

interface IMetal {
  base: string;
  hi: string;
  lo: string;
  deep: string;
}

interface IParts {
  flair?: string;
  onBody: string;
  onBodyTop?: string;
  front: string;
}

export interface IOneKeyIdDefaultAvatarLook {
  palette: string;
  accessory: IAccessory;
  eyes: IEyes;
  mouth: IMouth;
}

const INK = '#1B1E2C';
const GOLD: IMetal = {
  base: '#F5C142',
  hi: '#FFEDA8',
  lo: '#D9921F',
  deep: '#A9650F',
};
const SILVER: IMetal = {
  base: '#D3D9E2',
  hi: '#FAFBFD',
  lo: '#9EA7B5',
  deep: '#6F7887',
};
const LEAF = { base: '#43BE5B', hi: '#A6E879', lo: '#22843C' };
const LIME_LEAF = { base: '#7CCB3C', hi: '#C4EE7E', lo: '#4E9A23' };

const PALETTES: IPalette[] = [
  {
    name: 'blue',
    bg: '#D7E3FF',
    body: '#4F7CFF',
    cheek: '#FF8DC6',
    accents: ['#FF7A45', '#FFC53D'],
  },
  {
    name: 'pink',
    bg: '#FFDEEA',
    body: '#FF79AA',
    cheek: '#FF4C84',
    accents: ['#3D6CFF', '#16B3A3'],
  },
  {
    name: 'orange',
    bg: '#FFE2CB',
    body: '#FF8A3C',
    cheek: '#FF4D6B',
    accents: ['#3A63EE', '#7B5CF0'],
  },
  {
    name: 'green',
    bg: '#D2F0DC',
    body: '#35C16E',
    cheek: null,
    accents: ['#FF5C8F', '#7B5CF0'],
    avoid: ['sprout'],
  },
  {
    name: 'purple',
    bg: '#E4DCFF',
    body: '#8A68F2',
    cheek: '#FF92CB',
    accents: ['#FFC23A', '#FF7A45'],
  },
  {
    name: 'yellow',
    bg: '#FFEFBF',
    body: '#FFC738',
    cheek: '#FF7A6A',
    accents: ['#7A55F0', '#FF5C6C'],
  },
  {
    name: 'teal',
    bg: '#CEEEEA',
    body: '#14B3AA',
    cheek: null,
    accents: ['#FF6F61', '#FFC53D'],
  },
  {
    name: 'night',
    bg: '#2A3158',
    body: '#FFB992',
    cheek: '#FF6A8C',
    accents: ['#3FD1A3', '#FFD24A'],
    dark: true,
  },
];
const ACCESSORIES: IAccessory[] = [
  'cap',
  'beanie',
  'headphones',
  'crown',
  'party',
  'sunglasses',
  'sprout',
  'bow',
];
const EYES: IEyes[] = ['round', 'sparkle', 'happy', 'wink', 'calm'];
const MOUTHS: IMouth[] = ['smile', 'grin', 'oh', 'cat'];
const TILTS = [-7, -3.5, 0, 3.5, 7];
const GAZES = [-1.3, 0, 1.3];

const BODY = 'M8 124 C8 66 24 38 50 38 C76 38 92 66 92 124 Z';

// FNV-1a with a murmur3 finalizer: FNV alone leaves the low bits tied to the
// last character, so IDs a few apart would share a look.
function hash(text: string): number {
  let h = 0x81_1c_9d_c5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01_00_01_93);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85_eb_ca_6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2_b2_ae_35);
  h ^= h >>> 16;
  return h >>> 0;
}
const pick = (seed: string, slot: number, n: number) =>
  hash(`${seed}:${slot}`) % n;
const f = (v: number) => (Math.round(v * 100) / 100).toString();

// ---- OKLCH: highlights lean warm, shadows lean violet ----
type ITriple = [number, number, number];
const toLinear = (c: number) =>
  c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toGamma = (c: number) =>
  c <= 0.003_130_8 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function hexToLab(hex: string): ITriple {
  const n = parseInt(hex.slice(1), 16);
  const r = toLinear(((n >> 16) & 255) / 255);
  const g = toLinear(((n >> 8) & 255) / 255);
  const b = toLinear((n & 255) / 255);
  const l = Math.cbrt(
    0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b,
  );
  const m = Math.cbrt(
    0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b,
  );
  const s = Math.cbrt(
    0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b,
  );
  return [
    0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
    1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
    0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
  ];
}

function labToLinear([L, a, b]: ITriple): ITriple {
  const l = (L + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
  const m = (L - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
  const s = (L - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
  return [
    4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
    -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  ];
}

// Out-of-gamut colors give up chroma, never lightness or hue.
function lchToHex(L: number, C: number, H: number): string {
  const h = (H * Math.PI) / 180;
  let rgb: ITriple = [0, 0, 0];
  for (let c = C; c >= -0.001; c -= 0.004) {
    const chroma = Math.max(0, c);
    rgb = labToLinear([L, chroma * Math.cos(h), chroma * Math.sin(h)]);
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) {
      break;
    }
  }
  return `#${rgb
    .map((v) =>
      Math.round(toGamma(Math.min(1, Math.max(0, v))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function hexToLch(hex: string): ITriple {
  const [L, a, b] = hexToLab(hex);
  return [
    L,
    Math.hypot(a, b),
    ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
  ];
}

function towardHue(h: number, target: number, deg: number) {
  const d = ((target - h + 540) % 360) - 180;
  return (h + Math.sign(d) * Math.min(Math.abs(d), deg) + 360) % 360;
}

function tone(
  hex: string,
  dL: number,
  cMul: number,
  target: number,
  deg: number,
) {
  const [L, C, H] = hexToLch(hex);
  return lchToHex(
    Math.min(0.985, Math.max(0.08, L + dL)),
    C * cMul,
    towardHue(H, target, deg),
  );
}
const lift = (hex: string, k = 1) =>
  tone(hex, 0.075 * k, 1 - 0.07 * k, 95, 7 * k);
const sink = (hex: string, k = 1) =>
  tone(hex, -0.115 * k, 1 + 0.05 * k, 285, 11 * k);

function mix(a: string, b: string, t: number) {
  const A = hexToLab(a);
  const B = hexToLab(b);
  const L = A[0] + (B[0] - A[0]) * t;
  const x = A[1] + (B[1] - A[1]) * t;
  const y = A[2] + (B[2] - A[2]) * t;
  return lchToHex(
    L,
    Math.hypot(x, y),
    ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
  );
}
const lightness = (hex: string) => hexToLab(hex)[0];

// ---- shape helpers ----
// A yarn ball: round scallops between shallow cusps, a little uneven.
function pompomPath(cx: number, cy: number, r: number, seed: number, k = 12) {
  const rnd = (i: number) => {
    const x = Math.sin(seed * 12.9898 + i * 78.233) * 43_758.5453;
    return x - Math.floor(x);
  };
  const angles = Array.from(
    { length: k },
    (_, i) => ((i + (rnd(i) - 0.5) * 0.4) / k) * Math.PI * 2,
  );
  let d = '';
  for (let i = 0; i < k; i += 1) {
    const a0 = angles[i];
    const a1 = i + 1 === k ? angles[0] + Math.PI * 2 : angles[i + 1];
    const am = (a0 + a1) / 2;
    const rc = r * 0.95;
    const rb = r * (1.1 + rnd(i + 20) * 0.06);
    if (i === 0) {
      d += `M${f(cx + rc * Math.cos(a0))} ${f(cy + rc * Math.sin(a0))}`;
    }
    d += ` Q${f(cx + rb * Math.cos(am))} ${f(cy + rb * Math.sin(am))} ${f(
      cx + rc * Math.cos(a1),
    )} ${f(cy + rc * Math.sin(a1))}`;
  }
  return `${d} Z`;
}

// Short fibres poking across the rim, so the outline reads as fuzz.
function fibrePaths(cx: number, cy: number, r: number, seed: number, n = 30) {
  let lit = '';
  let dark = '';
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + Math.sin(seed + i * 2.1) * 0.09;
    const r0 = r * 0.84;
    const r1 = r * (1.07 + 0.05 * Math.sin(seed * 3 + i * 1.7));
    const b = a + 0.1 * Math.sin(seed + i);
    const seg = `M${f(cx + r0 * Math.cos(a))} ${f(cy + r0 * Math.sin(a))} L${f(
      cx + r1 * Math.cos(b),
    )} ${f(cy + r1 * Math.sin(b))}`;
    if (Math.cos(a - Math.PI * 1.25) > 0.15) {
      lit += seg;
    } else {
      dark += seg;
    }
  }
  return { lit, dark };
}

const star4 = (cx: number, cy: number, r: number, k = 0.16) =>
  `M${f(cx)} ${f(cy - r)} Q${f(cx + r * k)} ${f(cy - r * k)} ${f(cx + r)} ${f(
    cy,
  )} Q${f(cx + r * k)} ${f(cy + r * k)} ${f(cx)} ${f(cy + r)} Q${f(
    cx - r * k,
  )} ${f(cy + r * k)} ${f(cx - r)} ${f(cy)} Q${f(cx - r * k)} ${f(
    cy - r * k,
  )} ${f(cx)} ${f(cy - r)} Z`;

function describe(seed: string) {
  const pal = PALETTES[pick(seed, 0, PALETTES.length)];
  let acc = ACCESSORIES[pick(seed, 4, ACCESSORIES.length)];
  if (pal.avoid?.includes(acc)) {
    acc = ACCESSORIES[(ACCESSORIES.indexOf(acc) + 3) % ACCESSORIES.length];
  }
  const accentIndex = pick(seed, 9, 2);
  return {
    pal,
    acc,
    accent: pal.accents[accentIndex],
    accent2: pal.accents[1 - accentIndex],
    eyes: EYES[pick(seed, 1, EYES.length)],
    mouth: MOUTHS[pick(seed, 2, MOUTHS.length)],
    blush: Boolean(pal.cheek) && pick(seed, 3, 4) !== 0,
    tilt: TILTS[pick(seed, 5, TILTS.length)],
    gaze: GAZES[pick(seed, 6, GAZES.length)],
    variant: pick(seed, 7, 4),
  };
}

export function describeOneKeyIdDefaultAvatar(
  seed: string,
): IOneKeyIdDefaultAvatarLook {
  const d = describe(seed);
  return {
    palette: d.pal.name,
    accessory: d.acc,
    eyes: d.eyes,
    mouth: d.mouth,
  };
}

/**
 * SVG markup (viewBox 0 0 100 100) for the avatar of `seed`. `small` drops
 * details that turn to noise at header sizes and thickens the face strokes.
 * `idPrefix` keeps gradient and filter IDs unique when several avatars share
 * one web document.
 */
export function buildOneKeyIdDefaultAvatarXml(
  seed: string,
  { small, idPrefix }: { small: boolean; idPrefix: string },
): string {
  const d = describe(seed);
  const { pal, accent, accent2 } = d;
  const defs: string[] = [];
  let count = 0;
  const def = (markup: string) => {
    count += 1;
    const name = `${idPrefix}_${count}`;
    defs.push(markup.replace('$ID', name));
    return `url(#${name})`;
  };
  const st = (o: number, c: string, a = 1) =>
    `<stop offset="${o}" stop-color="${c}"${
      a === 1 ? '' : ` stop-opacity="${a}"`
    }/>`;
  const lin = (x1: number, y1: number, x2: number, y2: number, stops: string) =>
    def(
      `<linearGradient id="$ID" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`,
    );
  const linBox = (stops: string) =>
    def(
      `<linearGradient id="$ID" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`,
    );
  const rad = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rot: number,
    stops: string,
  ) =>
    def(
      `<radialGradient id="$ID" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${f(
        cx,
      )} ${f(cy)}) rotate(${rot}) scale(${f(rx)} ${f(
        ry,
      )})">${stops}</radialGradient>`,
    );
  const clip = (path: string) =>
    def(`<clipPath id="$ID"><path d="${path}"/></clipPath>`);
  const soft = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: string,
    a: number,
  ) =>
    `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(
      ry,
    )}" fill="${rad(cx, cy, rx, ry, 0, st(0, color, a) + st(1, color, 0))}"/>`;
  const blurs = new Map<number, string>();
  const blur = (sd: number) => {
    let ref = blurs.get(sd);
    if (!ref) {
      ref = def(
        `<filter id="$ID" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${sd}"/></filter>`,
      );
      blurs.set(sd, ref);
    }
    return ref;
  };

  const bodyHi = lift(pal.body);
  const bodyLo = sink(pal.body);
  const bodyDeep = sink(pal.body, 1.9);
  // A soft shadow in the shape of whatever casts it, nudged down and right.
  const cast = (
    path: string,
    dx: number,
    dy: number,
    sd: number,
    a: number,
    tf = '',
  ) =>
    `<path d="${path}" transform="${tf} translate(${dx} ${dy})" fill="${bodyDeep}" fill-opacity="${a}" filter="${blur(
      sd,
    )}"/>`;
  const sw = small ? 1.3 : 1;
  const detail = (markup: string) => (small ? '' : markup);

  function cap(): IParts {
    const c = accent;
    const cHi = lift(c);
    const cLo = sink(c);
    const cDeep = sink(c, 1.8);
    const dome =
      'M22.6 50.2 C22 36 34 27 50 27 C66 27 78 36 77.4 50.2 Q50 55.8 22.6 50.2 Z';
    const brim =
      'M68.6 46.2 C76 43.2 87.6 43.2 93 46.4 C95.4 47.9 95.2 50.8 92.4 51.8 C86 53.8 76.6 53.6 68.6 52.6 Z';
    const under =
      'M69.4 52.2 C77 53.3 86.4 53.6 92.4 51.8 C91.8 54.3 86.8 56 80.2 56 C75.2 56 71.6 54.9 69.6 53.6 Z';
    const seam = (p: string) =>
      `<path d="${p}" fill="none" stroke="${cDeep}" stroke-opacity=".5" stroke-width=".8"/>${detail(
        `<path d="${p}" fill="none" stroke="${cHi}" stroke-opacity=".6" stroke-width=".45" stroke-dasharray="1.1 .9" transform="translate(1.1 0)"/>`,
      )}`;
    return {
      onBody: cast(dome, 0.4, 2.4, 1.5, 0.55) + cast(brim, 0.8, 3, 1.4, 0.45),
      front: `<path d="${under}" fill="${cDeep}"/>
<path d="${brim}" fill="${lin(0, 45, 0, 54, st(0, cHi) + st(1, c))}"/>
${detail(
  `<path d="M72.4 47.4 C79.4 45.2 87.6 45.2 91.4 47.6" fill="none" stroke="${cDeep}" stroke-opacity=".35" stroke-width=".45" stroke-dasharray="1.1 .9"/><path d="M71.6 45.4 C78.6 43.7 87.4 43.8 91.8 46" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".7" stroke-linecap="round"/>`,
)}
<path d="${dome}" fill="${lin(
        30,
        28,
        70,
        54,
        st(0, cHi) + st(0.55, c) + st(1, cLo),
      )}"/>
<g clip-path="${clip(dome)}">
<rect x="18" y="24" width="64" height="34" fill="${rad(
        38,
        34,
        13,
        7.5,
        -24,
        st(0, '#fff', 0.5) + st(1, '#fff', 0),
      )}"/>
${seam('M50 27.6 C42.6 30.4 37 40 36.2 54')}
${seam('M50 27.6 C57.4 30.4 63 40 63.8 54')}
<path d="M22.6 50.2 Q50 55.8 77.4 50.2" fill="none" stroke="${cDeep}" stroke-opacity=".55" stroke-width="2.6"/>
${detail(
  `<circle cx="41.4" cy="34.4" r=".75" fill="${cDeep}" fill-opacity=".6"/><circle cx="58.6" cy="34.4" r=".75" fill="${cDeep}" fill-opacity=".6"/>`,
)}
</g>
<circle cx="50" cy="27.6" r="2.3" fill="${rad(
        49.2,
        26.8,
        2.8,
        2.8,
        0,
        st(0, cHi) + st(1, cLo),
      )}"/>`,
    };
  }

  function beanie(): IParts {
    const c = accent;
    const cHi = lift(c);
    const cLo = sink(c);
    const cDeep = sink(c, 1.8);
    const hat = 'M24.8 47.4 C24 31 35 21 50 21 C65 21 76 31 75.2 47.4 Z';
    const cuff =
      'M22.4 44.6 Q50 49.4 77.6 44.6 Q78.7 44.5 78.7 45.6 L79 51.7 Q79 52.8 77.9 52.9 Q50 58.4 22.1 52.9 Q21 52.8 21 51.7 L21.3 45.6 Q21.3 44.5 22.4 44.6 Z';
    // Half-width of the hat at height y, sampled from its outline, so the
    // ribs run along the dome like meridians.
    const outline: [number, number][] = [];
    for (let i = 0; i <= 40; i += 1) {
      const t = i / 40;
      const u = 1 - t;
      outline.push([
        u * u * u * 47.4 +
          3 * u * u * t * 31 +
          3 * u * t * t * 21 +
          t * t * t * 21,
        50 -
          (u * u * u * 24.8 +
            3 * u * u * t * 24 +
            3 * u * t * t * 35 +
            t * t * t * 50),
      ]);
    }
    const halfWidth = (y: number) => {
      for (let i = 0; i < outline.length - 1; i += 1) {
        const [y0, w0] = outline[i];
        const [y1, w1] = outline[i + 1];
        if (y <= y0 && y >= y1) {
          return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0 || 1);
        }
      }
      return 0;
    };
    let knit = '';
    let knitHi = '';
    if (!small) {
      for (let j = -7; j <= 7; j += 1) {
        const th = j * 0.19;
        const line = (dx: number) =>
          Array.from({ length: 12 }, (_, k) => {
            const y = 23.4 + k * 2.1;
            return `${k ? 'L' : 'M'}${f(
              50 + halfWidth(y) * Math.sin(th) * 0.97 + dx * Math.cos(th),
            )} ${f(y)}`;
          }).join('');
        knit += line(0);
        knitHi += line(0.8);
      }
    }
    let ribs = '';
    let ribsHi = '';
    for (let i = -10; i <= 10; i += 1) {
      const th = (i / 10) * 1.32;
      const x = 50 + 28 * Math.sin(th);
      const t1 = (x - 22.4) / 55.2;
      const t2 = (x - 22.1) / 55.8;
      const y1 = 44.6 + 9.6 * t1 * (1 - t1) + 0.9;
      const y2 = 52.9 + 11 * t2 * (1 - t2) - 0.9;
      ribs += `M${f(x)} ${f(y1)} L${f(x)} ${f(y2)}`;
      const xh = x + 0.95 * Math.cos(th);
      ribsHi += `M${f(xh)} ${f(y1)} L${f(xh)} ${f(y2)}`;
    }
    const pomC = mix(accent2, '#ffffff', 0.12);
    const pom = pompomPath(50, 19.2, 6.4, 1.7, 14);
    const fib = fibrePaths(50, 19.2, 6.4, 1.7);
    return {
      onBody: cast(cuff, 0.4, 2.4, 1.6, 0.55),
      front: `<path d="${hat}" fill="${lin(
        30,
        22,
        72,
        48,
        st(0, cHi) + st(0.5, c) + st(1, cLo),
      )}"/>
<g clip-path="${clip(hat)}">
<rect x="20" y="18" width="60" height="32" fill="${rad(
        48,
        33,
        31,
        25,
        0,
        st(0.62, cDeep, 0) + st(1, cDeep, 0.5),
      )}"/>
<rect x="20" y="18" width="60" height="32" fill="${rad(
        38,
        29,
        12,
        8,
        -28,
        st(0, '#fff', 0.36) + st(1, '#fff', 0),
      )}"/>
${detail(
  `<path d="${knit}" fill="none" stroke="${cDeep}" stroke-opacity=".26" stroke-width=".75" stroke-linejoin="round"/><path d="${knitHi}" fill="none" stroke="${cHi}" stroke-opacity=".35" stroke-width=".45" stroke-linejoin="round"/>`,
)}
${soft(51, 25.6, 7.5, 2.6, cDeep, 0.45)}
</g>
<path d="${cuff}" fill="${lin(
        0,
        44,
        0,
        57,
        st(0, lift(c, 0.7)) + st(0.55, c) + st(1, cLo),
      )}"/>
<g clip-path="${clip(cuff)}">
<path d="${ribs}" stroke="${cDeep}" stroke-opacity=".38" stroke-width=".95" stroke-linecap="round"/>
${detail(
  `<path d="${ribsHi}" stroke="${cHi}" stroke-opacity=".5" stroke-width=".55" stroke-linecap="round"/>`,
)}
<rect x="18" y="40" width="64" height="20" fill="${lin(
        22,
        0,
        78,
        0,
        st(0, cDeep, 0.35) +
          st(0.25, cDeep, 0) +
          st(0.75, cDeep, 0) +
          st(1, cDeep, 0.45),
      )}"/>
</g>
<path d="M22.6 44.9 Q50 49.7 77.4 44.9" fill="none" stroke="${cHi}" stroke-opacity=".7" stroke-width=".8" stroke-linecap="round"/>
<path d="${pom}" fill="${rad(
        47.4,
        16.6,
        9,
        9,
        0,
        st(0, lift(pomC, 1.1)) + st(0.55, pomC) + st(1, sink(pomC, 0.9)),
      )}"/>
${detail(
  `<g fill="none" stroke-width=".42" stroke-linecap="round"><path d="${
    fib.dark
  }" stroke="${sink(pomC, 0.6)}"/><path d="${fib.lit}" stroke="${lift(
    pomC,
    0.9,
  )}"/></g>`,
)}`,
    };
  }

  function headphones(): IParts {
    // Dark headphones vanish on the night backdrop, light ones on pale bodies.
    const shell =
      !pal.dark && lightness(pal.body) > 0.8 ? '#2F3241' : '#F4EFE7';
    const sHi = lift(shell, 0.8);
    const sLo = sink(shell, 0.9);
    const sDeep = sink(shell, 1.6);
    const cushion = lightness(shell) > 0.5 ? '#3A3C47' : '#17181F';
    const band =
      'M18.8 56 C17.4 38.4 31 31.4 50 31.4 C69 31.4 82.6 38.4 81.2 56';
    const cup = (cx: number, side: number) => `<rect x="${f(
      cx + side * 2.4 - 5,
    )}" y="54.6" width="10" height="17.6" rx="5" fill="${cushion}"/>
<rect x="${f(cx - 6.2)}" y="53.6" width="12.4" height="19" rx="6.2" fill="${rad(
      cx - 2.6,
      58,
      11,
      15,
      0,
      st(0, lift(accent, 0.9)) + st(0.55, accent) + st(1, sink(accent, 0.9)),
    )}"/>
<rect x="${f(
      cx - 6.2,
    )}" y="53.6" width="12.4" height="19" rx="6.2" fill="none" stroke="${sink(
      accent,
      1.4,
    )}" stroke-opacity=".45" stroke-width=".7"/>
<rect x="${f(cx - 3.7)}" y="56.8" width="7.4" height="12.6" rx="3.7" fill="${lin(
      0,
      56.8,
      0,
      69.4,
      st(0, sink(accent, 0.7)) + st(1, lift(accent, 0.5)),
    )}"/>
<path d="M${f(cx - 4.4)} 60 Q${f(cx - 4.2)} 56.4 ${f(
      cx - 1.2,
    )} 55.6" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".8" stroke-linecap="round"/>`;
    const noteColor = pal.dark ? lift(accent, 0.6) : mix(accent, pal.bg, 0.3);
    const note = (x: number, y: number, s: number) =>
      `<g transform="translate(${x} ${y}) scale(${s})" fill="${noteColor}"><ellipse cx="0" cy="0" rx="2.1" ry="1.55" transform="rotate(-22)"/><rect x="1.35" y="-8.2" width=".85" height="8"/><path d="M2.2 -8.2 q3.2 1.4 2.6 4.8 q-.7 -2.3 -2.6 -2.5 Z"/></g>`;
    return {
      flair: note(84, 30, 1) + note(77.5, 22.5, 0.72),
      onBody: `<path d="${band}" transform="translate(.6 2)" fill="none" stroke="${bodyDeep}" stroke-opacity=".3" stroke-width="5" filter="${blur(
        1.4,
      )}"/>${cast(
        'M10.2 63 a6.2 9.5 0 1 0 12.4 0 a6.2 9.5 0 1 0 -12.4 0 Z',
        2.2,
        1.6,
        1.6,
        0.55,
      )}${cast(
        'M77.4 63 a6.2 9.5 0 1 0 12.4 0 a6.2 9.5 0 1 0 -12.4 0 Z',
        -1.4,
        1,
        1.6,
        0.4,
      )}`,
      front: `<path d="${band}" fill="none" stroke="${sDeep}" stroke-opacity=".22" stroke-width="6.5"/>
<path d="${band}" fill="none" stroke="${lin(
        0,
        29,
        0,
        56,
        st(0, sHi) + st(0.5, shell) + st(1, sLo),
      )}" stroke-width="5.6"/>
<path d="M21.9 55.4 C21 41.8 33 36.1 50 36.1 C67 36.1 79 41.8 78.1 55.4" fill="none" stroke="${cushion}" stroke-opacity=".85" stroke-width="1.7"/>
<path d="M29.5 34.6 C35 31.6 42 30.4 50 30.3" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width=".9" stroke-linecap="round"/>
<rect x="16.9" y="51.6" width="3.8" height="4.8" rx="1.1" fill="${lin(
        16.9,
        0,
        20.7,
        0,
        st(0, SILVER.hi) + st(0.5, SILVER.base) + st(1, SILVER.lo),
      )}"/>
<rect x="79.3" y="51.6" width="3.8" height="4.8" rx="1.1" fill="${lin(
        79.3,
        0,
        83.1,
        0,
        st(0, SILVER.hi) + st(0.5, SILVER.base) + st(1, SILVER.lo),
      )}"/>
${cup(16.4, 1)}
${cup(83.6, -1)}`,
    };
  }

  function crown(): IParts {
    // Gold disappears into a yellow body.
    const m = pal.name === 'yellow' ? SILVER : GOLD;
    const tilt = [-9, -5, 5, 9][d.variant];
    const body =
      'M31.6 49.4 L29.8 34.2 L39.8 41 L50 29.2 L60.2 41 L70.2 34.2 L68.4 49.4 Q50 52.8 31.6 49.4 Z';
    const band =
      'M31.1 45.2 Q50 48.8 68.9 45.2 L68.4 49.4 Q50 52.8 31.6 49.4 Z';
    const gem = (cx: number, cy: number, rx: number, ry: number, c: string) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${rad(
        cx - rx * 0.3,
        cy - ry * 0.35,
        rx * 1.5,
        ry * 1.5,
        0,
        st(0, lift(c, 1.4)) + st(0.5, c) + st(1, sink(c, 1.2)),
      )}" stroke="${m.deep}" stroke-opacity=".55" stroke-width=".5"/><ellipse cx="${f(
        cx - rx * 0.36,
      )}" cy="${f(cy - ry * 0.38)}" rx="${f(rx * 0.32)}" ry="${f(
        ry * 0.24,
      )}" fill="#fff" fill-opacity=".85"/>`;
    const ball = (cx: number, cy: number) =>
      `<circle cx="${cx}" cy="${cy}" r="2.15" fill="${rad(
        cx - 0.7,
        cy - 0.8,
        3,
        3,
        0,
        st(0, '#ffffff') + st(0.3, m.hi) + st(0.7, m.base) + st(1, m.lo),
      )}"/>`;
    return {
      flair: `<path d="${star4(
        22.5,
        27.5,
        3.4,
      )}" fill="#fff" fill-opacity=".95"/><path d="${star4(
        78.5,
        22.5,
        2.3,
      )}" fill="${
        pal.dark ? '#fff' : m.hi
      }"/><circle cx="74" cy="30" r=".8" fill="#fff" fill-opacity=".9"/>`,
      onBody: cast(body, 0.6, 2.2, 1.5, 0.55, `rotate(${tilt} 50 49)`),
      front: `<g transform="rotate(${tilt} 50 49)">
<path d="M31.5 41.2 Q50 34.6 68.5 41.2 L68.4 44.2 Q50 37.8 31.6 44.2 Z" fill="${lin(
        0,
        36,
        0,
        44,
        st(0, m.lo) + st(1, m.deep),
      )}"/>
<path d="${body}" fill="${lin(
        30,
        0,
        70,
        0,
        st(0, m.hi) +
          st(0.2, m.base) +
          st(0.44, m.hi) +
          st(0.64, m.lo) +
          st(0.84, m.base) +
          st(1, m.lo),
      )}"/>
<g clip-path="${clip(body)}">
<rect x="26" y="26" width="48" height="28" fill="${lin(
        0,
        29,
        0,
        52,
        st(0, '#fff', 0.28) + st(0.55, '#fff', 0) + st(1, m.deep, 0.35),
      )}"/>
<path d="${band}" fill="${m.lo}" fill-opacity=".55"/>
<path d="M31.2 45.4 Q50 49 68.8 45.4" fill="none" stroke="${m.hi}" stroke-width=".8"/>
<path d="M30.4 35.6 L31.6 44.8 M48.6 31.4 L45.6 42 M68.6 35.4 L67.6 44.6" stroke="#fff" stroke-opacity=".55" stroke-width=".7" stroke-linecap="round"/>
</g>
${ball(29.9, 33.6)}${ball(50, 28.6)}${ball(70.1, 33.6)}
${gem(50, 47.4, 3.1, 2.5, accent)}${gem(40, 46.7, 1.7, 1.55, accent2)}${gem(
        60,
        46.7,
        1.7,
        1.55,
        accent2,
      )}
</g>`,
    };
  }

  function party(): IParts {
    const c = accent;
    const cLo = sink(c);
    const cDeep = sink(c, 1.7);
    const rot = [10, 14, -10, -14][d.variant];
    const dx = rot > 0 ? 4 : -4;
    const cone = 'M50 10.6 L37 43.4 Q50 48 63 43.4 Z';
    let pattern = '';
    if (d.variant % 2 === 1) {
      const rows: [number, number[]][] = [
        [18.5, [-0.7, 0.7]],
        [26, [-1.15, 0, 1.15]],
        [33.5, [-0.7, 0.7]],
        [41, [-1.15, 0, 1.15]],
      ];
      rows.forEach(([y, phis]) => {
        const t = (y - 10.6) / 32.8;
        const hw = 13 * t;
        const r = 0.75 + 0.95 * t;
        phis.forEach((p) => {
          pattern += `<circle cx="${f(50 + hw * Math.sin(p) * 0.92)}" cy="${f(
            y + 1.6 * t * Math.cos(p),
          )}" r="${f(
            r * (0.55 + 0.45 * Math.cos(p)),
          )}" fill="#fff" fill-opacity=".92"/>`;
        });
      });
    } else {
      let stripes = '';
      for (let k = 0; k < 5; k += 1) {
        const y0 = 14.6 + k * 6.4;
        const y1 = y0 + 3.1;
        // Stripes curve more toward the base, where the cone is widest.
        const c0 = 2.3 * ((y0 - 10.6) / 32.8);
        const c1 = 2.3 * ((y1 - 10.6) / 32.8);
        stripes += `M28 ${f(y0)} Q50 ${f(y0 + 2 * c0)} 72 ${f(y0)} L72 ${f(
          y1,
        )} Q50 ${f(y1 + 2 * c1)} 28 ${f(y1)} Z`;
      }
      pattern = `<path d="${stripes}" fill="#fff" fill-opacity=".92"/>`;
    }
    const hue = hexToLch(c)[2];
    // A gold pompom is lost on a yellow cone.
    const pomC =
      pal.name === 'yellow' || (hue > 65 && hue < 115) ? '#ffffff' : GOLD.base;
    const side = rot > 0 ? -1 : 1;
    const fib = fibrePaths(50, 10.4, 4.3, 0.9, 16);
    return {
      flair: `<rect x="-1.4" y="-.65" width="2.8" height="1.3" rx=".4" fill="${accent2}" transform="translate(${
        50 + side * 30
      } 22) rotate(32)"/><circle cx="${
        50 + side * 23
      }" cy="13" r="1.05" fill="${lift(
        accent,
        0.6,
      )}"/><rect x="-1.2" y="-.6" width="2.4" height="1.2" rx=".4" fill="${
        pal.dark ? '#ffffff' : sink(pal.bg, 1.4)
      }" transform="translate(${50 - side * 31} 30) rotate(-24)"/><path d="M${
        50 + side * 35
      } 33 q1.2 -1.6 2.4 0 t2.4 0" fill="none" stroke="${accent2}" stroke-width=".9" stroke-linecap="round"/>`,
      onBody: cast(
        cone,
        1.2,
        2.2,
        1.6,
        0.55,
        `translate(${dx} 0) rotate(${rot} 50 44)`,
      ),
      front: `<g transform="translate(${dx} 0) rotate(${rot} 50 44)">
<path d="${cone}" fill="${lin(
        37,
        0,
        63,
        0,
        st(0, lift(c, 0.6)) + st(0.45, c) + st(1, cLo),
      )}"/>
<g clip-path="${clip(cone)}">
${pattern}
<rect x="34" y="8" width="32" height="42" fill="${lin(
        37,
        0,
        63,
        0,
        st(0, '#fff', 0.3) +
          st(0.36, '#fff', 0) +
          st(0.62, cDeep, 0) +
          st(1, cDeep, 0.5),
      )}"/>
<path d="M37 43.4 Q50 48 63 43.4" fill="none" stroke="${cDeep}" stroke-opacity=".45" stroke-width="1.6"/>
</g>
${detail(
  '<path d="M48.4 15.6 L40.6 40" stroke="#fff" stroke-opacity=".5" stroke-width="1.1" stroke-linecap="round"/>',
)}
<path d="${pompomPath(50, 10.4, 4.3, 0.9, 10)}" fill="${rad(
        48.5,
        8.8,
        6.2,
        6.2,
        0,
        st(0, lift(pomC, 1.2)) + st(0.55, pomC) + st(1, sink(pomC, 0.9)),
      )}"/>
${detail(
  `<g fill="none" stroke-width=".45" stroke-linecap="round"><path d="${
    fib.dark
  }" stroke="${sink(
    pomC,
    1.1,
  )}" stroke-opacity=".4"/><path d="${fib.lit}" stroke="#fff" stroke-opacity=".6"/></g>`,
)}
</g>`,
    };
  }

  function sunglasses(): IParts {
    const frame = d.variant < 2 ? INK : sink(accent, 0.4);
    const frameHi = lift(frame, frame === INK ? 3 : 1);
    const tint = [mix(pal.body, INK, 0.55), '#4B3C78', '#2C4E7A', '#6A3550'][
      d.variant
    ];
    const lens = (cx: number) =>
      `M${f(cx - 7.6)} 57.2 H${f(cx + 7.6)} Q${f(cx + 8.4)} 57.2 ${f(
        cx + 8.2,
      )} 58.4 L${f(cx + 7.4)} 63.6 Q${f(cx + 6.6)} 67.6 ${f(cx + 2.6)} 67.6 H${f(
        cx - 2.6,
      )} Q${f(cx - 6.6)} 67.6 ${f(cx - 7.4)} 63.6 L${f(cx - 8.2)} 58.4 Q${f(
        cx - 8.4,
      )} 57.2 ${f(cx - 7.6)} 57.2 Z`;
    const one = (cx: number) => {
      const p = lens(cx);
      return `<path d="${p}" fill="${lin(
        0,
        57,
        0,
        68,
        st(0, '#12131F') + st(0.55, mix('#12131F', tint, 0.6)) + st(1, tint),
      )}"/>
<g clip-path="${clip(p)}">
<path d="M${f(cx - 4.4)} 56 L${f(cx - 1.4)} 56 L${f(cx - 6)} 69 L${f(
        cx - 9,
      )} 69 Z" fill="#fff" fill-opacity=".3"/>
<path d="M${f(cx - 0.2)} 56 L${f(cx + 1)} 56 L${f(cx - 3.6)} 69 L${f(
        cx - 4.8,
      )} 69 Z" fill="#fff" fill-opacity=".18"/>
</g>
<path d="${p}" fill="none" stroke="${frame}" stroke-width="${f(
        1.7 * (small ? 1.15 : 1),
      )}" stroke-linejoin="round"/>`;
    };
    return {
      onBody:
        cast(lens(39.5), 0.8, 2.4, 1.3, 0.4) +
        cast(lens(60.5), 0.8, 2.4, 1.3, 0.4),
      // The arms run back along the head, so they are clipped to it.
      onBodyTop: `<path d="M31.2 58.4 L12 56.2 M68.8 58.4 L88 56.2" stroke="${frame}" stroke-width="1.7" stroke-linecap="round"/>`,
      front: `${one(39.5)}${one(60.5)}
<path d="M47.6 59.2 Q50 57.4 52.4 59.2" fill="none" stroke="${frame}" stroke-width="1.8" stroke-linecap="round"/>
<path d="M31.3 56.6 H47.7 M52.3 56.6 H68.7" stroke="${frame}" stroke-width="2.4" stroke-linecap="round"/>
${detail(
  `<path d="M32.4 56.1 H44 M53.4 56.1 H65" stroke="${frameHi}" stroke-opacity=".7" stroke-width=".55" stroke-linecap="round"/><path d="${star4(
    65.6,
    59.4,
    1.9,
  )}" fill="#fff" fill-opacity=".95"/>`,
)}`,
    };
  }

  function sprout(): IParts {
    // Leaf green blends into teal; a lime leaf stays apart.
    const L = pal.name === 'teal' ? LIME_LEAF : LEAF;
    const left =
      'M50.3 26.9 C46 22 40.4 20.8 36 22.7 C38.4 28.2 45.6 29.8 50.3 26.9 Z';
    const right =
      'M50.7 25.4 C54 18.4 60.9 16.1 66.6 17.1 C64.6 23.9 57 27.5 50.7 25.4 Z';
    const leaf = (p: string, rib: string, lit: string) =>
      `<path d="${p}" fill="${lin(
        0,
        16,
        0,
        30,
        st(0, L.hi) + st(0.55, L.base) + st(1, L.lo),
      )}"/><g clip-path="${clip(
        p,
      )}"><path d="${lit}" fill="#fff" fill-opacity=".22"/></g><path d="${rib}" fill="none" stroke="${
        L.lo
      }" stroke-opacity=".75" stroke-width=".65" stroke-linecap="round"/>`;
    return {
      onBody: soft(50.4, 39.6, 4.2, 1.5, bodyDeep, 0.55),
      front: `<path d="M49.1 39.6 C49.3 33.6 49.8 29.4 50.3 25.4 L51.4 25.6 C51.1 29.6 50.9 33.8 51.3 39.6 Z" fill="${lin(
        0,
        25,
        0,
        40,
        st(0, L.base) + st(1, L.lo),
      )}"/>
${leaf(
  left,
  'M49.8 26.7 Q43 24.2 37.4 22.9',
  'M36 22.7 C40.4 20.8 46 22 50.3 26.9 Q43 24.6 36 22.7 Z',
)}
${leaf(
  right,
  'M51.1 25.1 Q57.4 20.2 65.4 17.4',
  'M50.7 25.4 C54 18.4 60.9 16.1 66.6 17.1 Q58 20.4 50.7 25.4 Z',
)}
${detail(
  `<ellipse cx="60.6" cy="20.2" rx="1.25" ry="1.35" fill="${rad(
    60.3,
    19.8,
    1.6,
    1.6,
    0,
    st(0, '#ffffff') + st(0.6, '#DFF6FF', 0.85) + st(1, '#A9DDF2', 0.9),
  )}"/><circle cx="60.2" cy="19.7" r=".38" fill="#fff"/>`,
)}`,
    };
  }

  function bow(): IParts {
    const c = accent;
    const cHi = lift(c);
    const cLo = sink(c);
    const cDeep = sink(c, 1.7);
    const rot = [14, 20, -14, -20][d.variant];
    const x = rot > 0 ? 63 : 37;
    const loopL =
      'M0 0 C-3.2 -6.4 -11.6 -9.6 -14.6 -5.6 C-16.2 -3.2 -15.6 2.8 -12.6 4.8 C-9.4 6.8 -4.2 4.4 0 0 Z';
    const loopR =
      'M0 0 C3.2 -6.4 11.6 -9.6 14.6 -5.6 C16.2 -3.2 15.6 2.8 12.6 4.8 C9.4 6.8 4.2 4.4 0 0 Z';
    const dotted = d.variant % 2 === 0 && !small;
    const dots = (s: number) =>
      [
        [-11, -3],
        [-7.2, -5.6],
        [-9.4, 1.6],
        [-12.8, 1.2],
      ]
        .map(([px, py]) => `<circle cx="${f(px * s)}" cy="${f(py)}" r=".95"/>`)
        .join('');
    const loop = (p: string, s: number) =>
      `<path d="${p}" fill="${lin(
        0,
        -9,
        0,
        6,
        st(0, cHi) + st(0.5, c) + st(1, cLo),
      )}"/>
<g clip-path="${clip(p)}">
${dotted ? `<g fill="#fff" fill-opacity=".9">${dots(s)}</g>` : ''}
<path d="M0 0 C${f(-2.8 * s)} -2.4 ${f(-7.4 * s)} -3.6 ${f(-9.6 * s)} -2 C${f(
        -8 * s,
      )} .4 ${f(-4 * s)} 1.4 0 0 Z" fill="${cDeep}" fill-opacity=".55"/>
<rect x="-16" y="-10" width="32" height="18" fill="${rad(
        0,
        0,
        16,
        10,
        0,
        st(0.55, cDeep, 0) + st(1, cDeep, 0.4),
      )}"/>
</g>
${detail(
  `<path d="M${f(-2.6 * s)} -4.3 C${f(-5.6 * s)} -7.5 ${f(-10.6 * s)} -8.7 ${f(
    -13 * s,
  )} -5.9" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1" stroke-linecap="round"/>`,
)}`;
    return {
      onBody: cast(
        `${loopL} ${loopR}`,
        0.8,
        2.4,
        1.5,
        0.5,
        `translate(${x} 40.6) rotate(${rot})`,
      ),
      front: `<g transform="translate(${x} 40.6) rotate(${rot})">
<path d="M-1.6 1.4 C-3.4 5 -5.2 8.4 -7.8 11.2 L-5.6 10.6 L-4.8 13.2 C-2.8 10 -.6 6 1 2.6 Z" fill="${cLo}"/>
<path d="M1.6 1.4 C3 5.2 4.6 8.8 6.8 12 L4.9 11.1 L3.7 13.6 C2.4 10.2 .6 6.4 -.6 2.8 Z" fill="${cDeep}"/>
${loop(loopL, 1)}${loop(loopR, -1)}
<rect x="-3.4" y="-3.6" width="6.8" height="7.2" rx="2" fill="${lin(
        0,
        -3.6,
        0,
        3.6,
        st(0, cHi) + st(1, cLo),
      )}"/>
<path d="M-1.4 -3 Q-.5 0 -1.4 3 M1.5 -3 Q.8 0 1.5 3" fill="none" stroke="${cDeep}" stroke-opacity=".45" stroke-width=".55"/>
</g>`,
    };
  }

  const builders: Record<IAccessory, () => IParts> = {
    cap,
    beanie,
    headphones,
    crown,
    party,
    sunglasses,
    sprout,
    bow,
  };
  const parts = builders[d.acc]();

  // ---- face ----
  const EY = 62;
  const EX = 10.5;
  const es = small ? 1.08 : 1;
  const eyeFill = linBox(st(0, '#0C0E1B') + st(1, '#3C4468'));
  const roundEye = (x: number, sparkle: boolean) =>
    `<ellipse cx="${f(x)}" cy="${EY}" rx="${f(4.3 * es)}" ry="${f(
      5.5 * es,
    )}" fill="${eyeFill}"/>${detail(
      `<g clip-path="${clip(
        `M${f(x - 4.3)} ${EY} a4.3 5.5 0 1 0 8.6 0 a4.3 5.5 0 1 0 -8.6 0 Z`,
      )}"><ellipse cx="${f(x + 0.4)}" cy="${f(
        EY + 5.2,
      )}" rx="3.6" ry="2.2" fill="${bodyHi}" fill-opacity=".3" filter="${blur(
        0.6,
      )}"/></g>`,
    )}${
      sparkle
        ? `<path d="${star4(
            x - 1.2 * es,
            EY - 1.8 * es,
            2.5 * es,
            0.2,
          )}" fill="#fff"/>`
        : `<ellipse cx="${f(x - 1.3 * es)}" cy="${f(EY - 2.1 * es)}" rx="${f(
            1.6 * es,
          )}" ry="${f(1.8 * es)}" fill="#fff"/>`
    }<circle cx="${f(x + 1.55 * es)}" cy="${f(EY + 2.3 * es)}" r="${f(
      0.72 * es,
    )}" fill="#fff" fill-opacity=".85"/>`;
  const arcEye = (x: number, up: boolean) => {
    const path = up
      ? `M${f(x - 4)} ${EY + 1.6} Q${f(x)} ${EY - 4.4} ${f(x + 4)} ${EY + 1.6}`
      : `M${f(x - 4)} ${EY - 0.8} Q${f(x)} ${EY + 3.8} ${f(x + 4)} ${EY - 0.8}`;
    return `<path d="${path}" fill="none" stroke="${INK}" stroke-width="${f(
      2.6 * sw,
    )}" stroke-linecap="round"/>`;
  };
  const left = 50 - EX + d.gaze;
  const right = 50 + EX + d.gaze;
  const eyeMarkup: Record<IEyes, () => string> = {
    round: () => roundEye(left, false) + roundEye(right, false),
    sparkle: () => roundEye(left, true) + roundEye(right, true),
    happy: () => arcEye(50 - EX, true) + arcEye(50 + EX, true),
    wink: () => roundEye(left, false) + arcEye(50 + EX, true),
    calm: () => arcEye(50 - EX, false) + arcEye(50 + EX, false),
  };
  const eyes = d.acc === 'sunglasses' ? '' : eyeMarkup[d.eyes]();

  const MY = 71.2;
  const mouthFill = linBox(st(0, '#2A1121') + st(1, '#5C2238'));
  const openMouth = (p: string, tongue: string) =>
    `<path d="${p}" fill="${mouthFill}"/><g clip-path="${clip(
      p,
    )}">${tongue}</g>`;
  const mouthMarkup: Record<IMouth, () => string> = {
    smile: () =>
      `<path d="M45.2 ${MY - 0.6} Q50 ${MY + 3.8} 54.8 ${
        MY - 0.6
      }" fill="none" stroke="${INK}" stroke-width="${f(
        2.3 * sw,
      )}" stroke-linecap="round"/>`,
    grin: () =>
      openMouth(
        `M44.6 ${MY - 1.2} Q50 ${MY + 0.2} 55.4 ${MY - 1.2} Q55 ${
          MY + 5.6
        } 50 ${MY + 5.6} Q45 ${MY + 5.6} 44.6 ${MY - 1.2} Z`,
        `<ellipse cx="50.6" cy="${MY + 5.6}" rx="3.8" ry="2.5" fill="#FF7D95"/>`,
      ),
    oh: () =>
      openMouth(
        `M50 ${MY - 1.6} C52.2 ${MY - 1.6} 52.6 ${MY + 0.4} 52.6 ${
          MY + 1.4
        } C52.6 ${MY + 3} 51.4 ${MY + 4} 50 ${MY + 4} C48.6 ${MY + 4} 47.4 ${
          MY + 3
        } 47.4 ${MY + 1.4} C47.4 ${MY + 0.4} 47.8 ${MY - 1.6} 50 ${MY - 1.6} Z`,
        `<ellipse cx="50" cy="${MY + 4}" rx="2.2" ry="1.4" fill="#FF7D95"/>`,
      ),
    cat: () =>
      `<path d="M44.8 ${MY - 0.4} Q47.4 ${MY + 2.8} 50 ${MY} Q52.6 ${
        MY + 2.8
      } 55.2 ${MY - 0.4}" fill="none" stroke="${INK}" stroke-width="${f(
        2.1 * sw,
      )}" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  const mouth = mouthMarkup[d.mouth]();
  const cheeks =
    d.blush && pal.cheek
      ? `${soft(30.5, 69.4, 5.8, 3.7, pal.cheek, 0.6)}${soft(
          69.5,
          69.4,
          5.8,
          3.7,
          pal.cheek,
          0.6,
        )}`
      : '';

  // ---- body ----
  const rimColor = pal.dark ? lift(pal.body, 1.1) : mix(pal.bg, '#ffffff', 0.4);
  const bodyLayer = `<path d="${BODY}" transform="translate(3.4 2.6)" fill="${
    pal.dark ? '#000000' : sink(pal.bg, 1.6)
  }" fill-opacity="${pal.dark ? 0.35 : 0.28}" filter="${blur(2.8)}"/>
<path d="${BODY}" fill="${lin(
    0,
    38,
    0,
    100,
    st(0, bodyHi) + st(0.45, pal.body) + st(1, bodyLo),
  )}"/>
<g clip-path="${clip(BODY)}">
<rect x="0" y="30" width="100" height="94" fill="${rad(
    36,
    52,
    60,
    60,
    0,
    st(0.5, bodyDeep, 0) + st(1, bodyDeep, 0.5),
  )}"/>
<rect x="0" y="30" width="100" height="94" fill="${rad(
    34,
    55,
    17,
    11,
    -32,
    st(0, '#fff', 0.42) + st(1, '#fff', 0),
  )}"/>
<path d="${BODY}" fill="none" stroke="${lin(
    58,
    50,
    92,
    98,
    st(0, rimColor, 0) + st(1, rimColor, 1),
  )}" stroke-width="7" stroke-opacity=".75" filter="${blur(2.2)}"/>
${parts.onBody}
${parts.onBodyTop ?? ''}
</g>`;

  const backdrop = rad(
    50,
    40,
    64,
    64,
    0,
    st(0, tone(pal.bg, 0.035, 0.9, 95, 4)) +
      st(1, tone(pal.bg, -0.05, 1.12, 285, 6)),
  );
  // Bare heads sit a little higher so the face stays centred.
  const headOffset = d.acc === 'sunglasses' ? -3.5 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs.join(
    '',
  )}</defs>
<rect width="100" height="100" fill="${backdrop}"/>
${detail(parts.flair ?? '')}
<g transform="translate(0 ${headOffset}) rotate(${d.tilt} 50 80)">
${bodyLayer}
${cheeks}
${eyes}
${mouth}
${parts.front}
</g>
</svg>`;
}

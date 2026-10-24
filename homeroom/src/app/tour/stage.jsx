// The opening shot of Move-In Day: a bare dorm room at night, lit only by the moon, with one moving box on the floor.
// Drawn as one SVG "stage" in two compositions (wide for laptops and phones on their side, tall for phones held upright),
// so the box and every prop stay in frame on any screen. It is decoration only (aria-hidden): the subtitles say everything.
// Colours come from the .st-* classes in cinema.css (tokens only). Props are drawn where they END UP; the CSS flies them
// out of the box to there with transform and opacity only (--dx / --dy are the way back to the box).
import { CorkboardG, BookshelfG, LampG, PlantG } from "../room/art.jsx";

// the pieces, in the order they come out of the box
export const PROPS = Object.freeze(["lights", "corkboard", "bookshelf", "lamp", "plant"]);

// Two compositions. `mouth` is where the pieces come out (the open top of the box); everything else is where it ends up.
export const LAYOUTS = Object.freeze({
  wide: {
    vb: [960, 540, 0, -48], floor: 318, box: { x: 340, y: 238, s: 1 }, mouth: [480, 338],
    window: { x: 392, y: 96, w: 176, h: 156 }, strand: { w: 960, segs: 6, y: 62 },
    corkboard: { c: [150, 190], size: 132 }, bookshelf: { c: [736, 172], size: 128 },
    lamp: { c: [862, 268], size: 84, table: { x: 810, y: 310, w: 104, drop: 62 } }, plant: { c: [92, 392], size: 100 },
    shaft: "408,254 552,254 690,440 270,440",
  },
  tall: {
    vb: [540, 800, 0, 0], floor: 470, box: { x: 130, y: 548, s: 1 }, mouth: [270, 648],
    window: { x: 190, y: 128, w: 160, h: 150 }, strand: { w: 540, segs: 4, y: 92 },
    corkboard: { c: [130, 372], size: 140 }, bookshelf: { c: [410, 336], size: 130 },
    lamp: { c: [408, 430], size: 76, table: { x: 368, y: 460, w: 82, drop: 62 } }, plant: { c: [88, 548], size: 92 },
    shaft: "206,284 334,284 450,560 90,560",
  },
});

const Glyph = ({ c, size, children }) => <svg x={c[0] - size / 2} y={c[1] - size / 2} width={size} height={size} viewBox="0 0 64 64" overflow="visible">{children}</svg>;

// a prop that is drawn in its final place and flies there from the box
function Prop({ name, i, layout, children }) {
  const dx = layout.mouth[0] - layout[name].c[0], dy = layout.mouth[1] - layout[name].c[1];
  return <g className="prop" data-prop={name} style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--i": i }}>{children}</g>;
}

// swags of string lights: a quadratic curve per segment, with bulbs a quarter, half and three quarters of the way along
function strandGeometry({ w, segs, y }) {
  const sw = w / segs, h = 26, d = [`M-10 ${y}`], bulbs = [];
  for (let s = 0; s < segs; s++) {
    const x0 = s * sw, x1 = x0 + sw;
    d.push(`Q${x0 + sw / 2} ${y + 2 * h} ${x1} ${y}`);
    [0.25, 0.5, 0.75].forEach((t, k) => bulbs.push({ x: x0 + t * sw, y: y + 4 * h * t * (1 - t) + 4, a: (s + k) % 2 === 0 }));
  }
  return { d: d.join(" "), bulbs };
}

function Lights({ layout }) {
  const { d, bulbs } = strandGeometry(layout.strand);
  return (
    <g className="prop prop-strand" data-prop="lights" style={{ "--i": 0 }}>
      <path d={d} className="st-wire" fill="none" />
      <g className="st-halos">{bulbs.map((b, k) => <circle key={k} cx={b.x} cy={b.y} r="13" className="st-halo" />)}</g>
      {bulbs.map((b, k) => <circle key={k} cx={b.x} cy={b.y} r="4.6" className={b.a ? "a-bulb" : "a-bulb-b"} />)}
    </g>
  );
}

// the moving box, in its own 280 x 240 space: taped shut, flaps that swing out, a bloom of warm light
function BoxArt() {
  return (
    <g className="st-box">
      <ellipse cx="140" cy="226" rx="132" ry="11" className="a-shade" />
      <g className="box-light">
        <polygon points="70,102 210,102 330,-300 -50,-300" className="st-beam" />
        <ellipse cx="140" cy="98" rx="170" ry="96" className="st-bloom" />
      </g>
      <rect x="46" y="100" width="188" height="16" rx="3" className="a-kraft3" />
      <rect x="44" y="112" width="192" height="106" rx="5" className="a-kraft" />
      <rect x="206" y="112" width="30" height="106" className="a-kraft2" />
      <rect x="44" y="204" width="192" height="14" rx="5" className="a-kraft2" />
      <rect x="104" y="190" width="72" height="9" rx="4.5" className="a-kraft3" />
      <rect x="64" y="132" width="152" height="62" rx="3" className="a-paper" />
      <text x="140" y="160" textAnchor="middle" className="box-label">HOMEROOM</text>
      <text x="140" y="175" textAnchor="middle" className="box-sub">From: Nathaniel Visaya</text>
      <text x="140" y="187" textAnchor="middle" className="box-sub">this side up</text>
      <g className="flap flap-l"><path d="M44 112 L142 112 L142 96 L52 94 Z" className="a-kraft2" /><path d="M44 112 L142 112 L142 106 L44 106 Z" className="a-kraft3" opacity="0.5" /></g>
      <g className="flap flap-r"><path d="M236 112 L138 112 L138 96 L228 94 Z" className="a-kraft2" /><path d="M236 112 L138 112 L138 106 L236 106 Z" className="a-kraft3" opacity="0.5" /></g>
      <g className="tape-wrap"><rect x="122" y="88" width="36" height="28" rx="2" className="a-tape tape" /><rect x="127" y="116" width="26" height="14" className="a-tape tape tape-tail" /></g>
    </g>
  );
}

export function Stage({ layout: name }) {
  const L = LAYOUTS[name];
  const [W, H, VX, VY] = L.vb, f = L.floor, win = L.window, lamp = L.lamp, t = lamp.table;
  const id = (s) => `${s}-${name}`;
  const stars = [[0.12, 0.2], [0.35, 0.12], [0.62, 0.3], [0.8, 0.15], [0.22, 0.6], [0.7, 0.62], [0.5, 0.78], [0.88, 0.5]];
  return (
    <svg className={`stage stage-${name}`} viewBox={`${VX} ${VY} ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id("shaft")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--cine-moon)" }} stopOpacity="0.5" /><stop offset="1" style={{ stopColor: "var(--cine-moon)" }} stopOpacity="0" /></linearGradient>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--cine-0)" }} /><stop offset="1" style={{ stopColor: "var(--cine-sky)" }} /></linearGradient>
        <radialGradient id={id("lamp")} cx="50%" cy="50%" r="50%"><stop offset="0" style={{ stopColor: "var(--cine-warm)" }} stopOpacity="0.8" /><stop offset="1" style={{ stopColor: "var(--cine-warm)" }} stopOpacity="0" /></radialGradient>
        <radialGradient id="boxLight" cx="50%" cy="50%" r="50%"><stop offset="0" style={{ stopColor: "var(--cine-warm-2)" }} stopOpacity="0.95" /><stop offset="0.45" style={{ stopColor: "var(--cine-warm)" }} stopOpacity="0.5" /><stop offset="1" style={{ stopColor: "var(--cine-warm)" }} stopOpacity="0" /></radialGradient>
        <linearGradient id="boxBeam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style={{ stopColor: "var(--cine-warm)" }} stopOpacity="0.55" /><stop offset="1" style={{ stopColor: "var(--cine-warm)" }} stopOpacity="0" /></linearGradient>
      </defs>

      {/* the bare room: wall, floor, baseboard (drawn well past the frame so a wide or tall screen never shows an edge) */}
      <rect x={-W} y={-H * 2} width={W * 3} height={f + H * 2} className="st-wall" />
      <rect x={-W} y={f} width={W * 3} height={H * 2} className="st-floor" />
      <rect x={-W} y={f - 8} width={W * 3} height="9" className="st-base" />
      {[18, 48, 92, 150].map((o, k) => <rect key={k} x={-W} y={f + o} width={W * 3} height="2" className="st-plank" />)}

      {/* the window and its moonlight */}
      <g className="st-window">
        <rect x={win.x - 10} y={win.y - 10} width={win.w + 20} height={win.h + 20} rx="5" className="a-wood" />
        <rect x={win.x} y={win.y} width={win.w} height={win.h} fill={`url(#${id("sky")})`} />
        {stars.map(([a, b], k) => <circle key={k} cx={win.x + a * win.w} cy={win.y + b * win.h} r={k % 3 ? 1.3 : 1.9} className="st-star" />)}
        <circle cx={win.x + win.w * 0.72} cy={win.y + win.h * 0.26} r={win.w * 0.1} className="st-moon" />
        <rect x={win.x + win.w / 2 - 3} y={win.y} width="6" height={win.h} className="a-wood" /><rect x={win.x} y={win.y + win.h * 0.55} width={win.w} height="6" className="a-wood" />
        <rect x={win.x - 18} y={win.y + win.h + 8} width={win.w + 36} height="10" rx="3" className="a-wood2" />
      </g>
      <polygon points={L.shaft} fill={`url(#${id("shaft")})`} className="st-shaft" />

      {/* the nightstand that came with the room, waiting for a lamp */}
      <g className="st-table"><rect x={t.x} y={t.y} width={t.w} height="10" rx="2" className="a-wood" /><rect x={t.x + 8} y={t.y + 10} width="8" height={t.drop} className="a-wood" /><rect x={t.x + t.w - 16} y={t.y + 10} width="8" height={t.drop} className="a-wood" /></g>

      {/* the box, on the floor */}
      <g transform={`translate(${L.box.x} ${L.box.y}) scale(${L.box.s})`}><BoxArt /></g>

      {/* what comes out of it, in the order it is unpacked */}
      <Lights layout={L} />
      <Prop name="corkboard" i={1} layout={L}><Glyph c={L.corkboard.c} size={L.corkboard.size}><CorkboardG /></Glyph></Prop>
      <Prop name="bookshelf" i={2} layout={L}><Glyph c={L.bookshelf.c} size={L.bookshelf.size}><BookshelfG /></Glyph></Prop>
      <Prop name="lamp" i={3} layout={L}>
        <ellipse cx={lamp.c[0]} cy={lamp.c[1] - 8} rx={lamp.size * 2.4} ry={lamp.size * 1.9} fill={`url(#${id("lamp")})`} className="st-lamplight" />
        <Glyph c={lamp.c} size={lamp.size}><LampG /></Glyph>
      </Prop>
      <Prop name="plant" i={4} layout={L}><Glyph c={L.plant.c} size={L.plant.size}><PlantG /></Glyph></Prop>
    </svg>
  );
}

// a few specks of dust drifting through the moonbeam; CSS moves them (transform and opacity only)
export const MOTES = Array.from({ length: 10 }, (_, k) => ({ k, x: 14 + ((k * 37) % 62), y: 8 + ((k * 53) % 78), d: 7 + (k % 5) * 1.7, s: 2 + (k % 3) }));

// The moving box and the pieces unpacked from it. Decoration only (aria-hidden): the words beside it say everything.
// Colours come from the .a-* classes (design tokens); the box opens with transform transitions, and the pieces rise out with
// the shared `unpack` animation, one after another.
import { CorkboardG, BookshelfG, LampG, PlantG, Corkboard, Bookshelf, Lamp } from "../room/art.jsx";

const Glyph = ({ x, y, size = 56, children }) => <svg x={x} y={y} width={size} height={size} viewBox="0 0 64 64" overflow="visible">{children}</svg>;

export const BooksG = () => (
  <>
    <rect x="9" y="45" width="46" height="10" rx="2" className="a-accent book" style={{ "--i": 0 }} />
    <rect x="14" y="35" width="38" height="10" rx="2" className="a-sage book" style={{ "--i": 1 }} />
    <rect x="11" y="25" width="41" height="10" rx="2" className="a-n1 book" style={{ "--i": 2 }} />
    <rect x="16" y="15" width="34" height="10" rx="2" className="a-wood2 book" style={{ "--i": 3 }} />
    <rect x="13" y="49" width="14" height="2" className="a-paper" /><rect x="19" y="39" width="12" height="2" className="a-paper" />
  </>
);
export const LightsG = () => (
  <>
    <path d="M2 16 Q32 46 62 16" className="a-wireline" fill="none" />
    {[[8, 24], [20, 33], [32, 36], [44, 33], [56, 24]].map(([x, y], i) => <circle key={i} cx={x} cy={y + 3} r="4.2" className={i % 2 ? "a-bulb-b" : "a-bulb"} />)}
  </>
);
export const BooksArt = () => <svg viewBox="0 0 64 64" className="art" aria-hidden="true" focusable="false"><BooksG /></svg>;
export const ITEM_ART = { corkboard: Corkboard, bookshelf: Bookshelf, lamp: Lamp, books: BooksArt };

// The box. closed: taped shut. open: the flaps swing out, a warm light spills up, and the pieces rise out one by one.
export function Box({ open }) {
  return (
    <svg viewBox="0 0 280 240" className={`box-art${open ? " is-open" : ""}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="boxLight" cx="50%" cy="60%" r="55%">
          <stop offset="0" style={{ stopColor: "var(--bulb-b)" }} stopOpacity="0.95" />
          <stop offset="1" style={{ stopColor: "var(--bulb-a)" }} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="140" cy="226" rx="108" ry="9" className="a-shade" />
      <g className="box-glow"><ellipse cx="140" cy="96" rx="104" ry="64" className="a-light" /></g>
      <rect x="46" y="100" width="188" height="16" rx="3" className="a-kraft3" />
      <g className="box-items">
        <g className="box-item" style={{ "--i": 0 }}><Glyph x="76" y="-22" size="128"><LightsG /></Glyph></g>
        <g className="box-item" style={{ "--i": 1 }}><Glyph x="42" y="22" size="60"><PlantG /></Glyph></g>
        <g className="box-item" style={{ "--i": 2 }}><Glyph x="92" y="2" size="66"><LampG /></Glyph></g>
        <g className="box-item" style={{ "--i": 3 }}><Glyph x="146" y="20" size="62"><BooksG /></Glyph></g>
        <g className="box-item" style={{ "--i": 4 }}><Glyph x="188" y="30" size="56"><CorkboardG /></Glyph></g>
      </g>
      <rect x="44" y="112" width="192" height="106" rx="5" className="a-kraft" />
      <rect x="206" y="112" width="30" height="106" className="a-kraft2" />
      <rect x="44" y="204" width="192" height="14" rx="5" className="a-kraft2" />
      <rect x="64" y="136" width="152" height="66" rx="3" className="a-paper" />
      <text x="140" y="166" textAnchor="middle" className="box-label">HOMEROOM</text>
      <text x="140" y="182" textAnchor="middle" className="box-sub">From: Nathaniel Visaya</text>
      <text x="140" y="195" textAnchor="middle" className="box-sub">this side up</text>
      <g className="flap flap-l"><path d="M44 112 L142 112 L142 96 L52 94 Z" className="a-kraft2" /><path d="M44 112 L142 112 L142 106 L44 106 Z" className="a-kraft3" opacity="0.5" /></g>
      <g className="flap flap-r"><path d="M236 112 L138 112 L138 96 L228 94 Z" className="a-kraft2" /><path d="M236 112 L138 112 L138 106 L236 106 Z" className="a-kraft3" opacity="0.5" /></g>
      <rect x="122" y="90" width="36" height="26" rx="2" className="a-tape tape" />
    </svg>
  );
}

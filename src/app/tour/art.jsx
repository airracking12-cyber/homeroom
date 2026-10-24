// The pieces unpacked from the box, as small glyphs for the step cards (the box and the bare room are in stage.jsx).
// Decoration only (aria-hidden): the words beside them say everything. Colours come from the .a-* classes (design tokens).
import { Corkboard, Bookshelf, Lamp } from "../room/art.jsx";

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

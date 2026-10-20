// The room's furniture, drawn as small inline SVGs. Colours come from the .a-* classes in room.css (design tokens only).
// All of it is decoration: aria-hidden, and the words next to it say everything.
const Svg = ({ children }) => <svg viewBox="0 0 64 64" className="art" aria-hidden="true" focusable="false">{children}</svg>;

export const Corkboard = () => (
  <Svg>
    <rect x="5" y="9" width="54" height="44" rx="5" className="a-wood" />
    <rect x="10" y="14" width="44" height="34" rx="2" className="a-cork" />
    <rect x="14" y="18" width="17" height="15" className="a-n1" transform="rotate(-4 22 25)" />
    <rect x="34" y="24" width="16" height="15" className="a-n2" transform="rotate(5 42 31)" />
    <rect x="18" y="35" width="13" height="10" className="a-n3" transform="rotate(3 24 40)" />
    <circle cx="22" cy="19" r="2.2" className="a-pin" /><circle cx="42" cy="25" r="2.2" className="a-pin" />
  </Svg>
);
export const Bookshelf = () => (
  <Svg>
    <rect x="6" y="50" width="52" height="6" rx="2" className="a-wood" />
    <rect x="10" y="20" width="9" height="30" rx="1.5" className="a-accent" />
    <rect x="21" y="14" width="8" height="36" rx="1.5" className="a-sage" />
    <rect x="31" y="24" width="10" height="26" rx="1.5" className="a-n1" />
    <rect x="43" y="18" width="8" height="32" rx="1.5" className="a-wood2" />
    <rect x="12" y="26" width="5" height="2" className="a-paper" /><rect x="33" y="30" width="6" height="2" className="a-ink" />
  </Svg>
);
export const Calendar = () => (
  <Svg>
    <rect x="9" y="10" width="46" height="44" rx="5" className="a-paper" />
    <path d="M9 15a5 5 0 0 1 5-5h36a5 5 0 0 1 5 5v8H9z" className="a-accent" />
    <rect x="19" y="6" width="4" height="9" rx="2" className="a-wood" /><rect x="41" y="6" width="4" height="9" rx="2" className="a-wood" />
    {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={15 + c * 10} y={29 + r * 8} width="6" height="5" rx="1" className={r === 1 && c === 2 ? "a-accent" : "a-wood2"} />))}
  </Svg>
);
export const Door = () => (
  <Svg>
    <rect x="14" y="6" width="36" height="52" rx="3" className="a-wood" />
    <rect x="19" y="11" width="26" height="42" rx="2" className="a-wood2" />
    <circle cx="40" cy="34" r="2.6" className="a-bulb" />
    <rect x="24" y="17" width="16" height="9" rx="1.5" className="a-paper" />
  </Svg>
);
export const Dresser = () => (
  <Svg>
    <rect x="8" y="16" width="48" height="38" rx="3" className="a-wood" />
    {[0, 1, 2].map((i) => <g key={i}><rect x="12" y={20 + i * 11} width="40" height="9" rx="1.5" className="a-wood2" /><circle cx="32" cy={24.5 + i * 11} r="1.8" className="a-bulb" /></g>)}
    <rect x="12" y="54" width="5" height="5" className="a-wood" /><rect x="47" y="54" width="5" height="5" className="a-wood" />
  </Svg>
);
export const Lamp = () => (
  <Svg>
    <ellipse cx="32" cy="55" rx="14" ry="4" className="a-wood" />
    <rect x="30" y="30" width="4" height="25" className="a-wood2" />
    <path d="M16 31 26 10h12l10 21z" className="a-n1" />
    <path d="M16 31 26 10h6l-4 21z" className="a-bulb" opacity="0.5" />
  </Svg>
);
export const Roommate = () => (
  <Svg>
    <path d="M10 14a6 6 0 0 1 6-6h32a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H28l-10 10v-10h-2a6 6 0 0 1-6-6z" className="a-sage" />
    <circle cx="23" cy="25" r="3" className="a-paper" /><circle cx="32" cy="25" r="3" className="a-paper" /><circle cx="41" cy="25" r="3" className="a-paper" />
  </Svg>
);
export const Plant = () => (
  <svg viewBox="0 0 64 72" className="plant" aria-hidden="true" focusable="false">
    <path d="M32 46C30 30 20 24 10 26c2 12 10 20 22 20z" className="leaf" />
    <path d="M32 46C34 26 44 18 56 20c-2 14-12 26-24 26z" className="leaf-dark" />
    <path d="M32 46C31 34 30 22 34 10c6 10 4 26-2 36z" className="leaf" />
    <path d="M18 46h28l-3 22H21z" className="pot" />
  </svg>
);

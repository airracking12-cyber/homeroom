// Navigation, from scratch around the three jobs. Pure data and functions so tests can check it (tests/nav.test.mjs).
//   Track   = the class's shared tasks            Review  = get ready for what is coming (and the class's notes)
//   Prepare = the whole next grade or an exam     Class   = classmates, groups, the assistant   Settings = you and the class
export const DESTINATIONS = [
  { id: "track", label: "Track", title: "Track", key: "t", blurb: "Homework, deadlines and tasks, shared with your class" },
  { id: "review", label: "Review", title: "Review", key: "r", blurb: "Get ready for a quiz or test" },
  { id: "prepare", label: "Prepare", title: "Prepare", key: "p", blurb: "Plan for the next grade or an entrance exam" },
  { id: "class", label: "Class", title: "Class", key: "c", blurb: "Your classmates, groups and the assistant" },
  { id: "settings", label: "Settings", title: "Settings", key: "s", blurb: "You, your class and how Homeroom looks" },
];
// "Your room" is the home screen: the default landing, reached from the wordmark and "g h". It is not a sixth tab.
export const ROOM = { id: "room", label: "Room", title: "Your room", key: "h", blurb: "Your room: every part of Homeroom, one tap away" };
export const DEFAULT_DEST = "room";
export const ids = () => DESTINATIONS.map((d) => d.id);
export const routeIds = () => [ROOM.id, ...ids()];

// Routes live in the hash ("#/review/notes") so Back works and a link can be shared. A hash that does not start with
// "#/" (the sign-in links from email use it too) is not a route.
export function parseRoute(hash) {
  const h = String(hash || "");
  if (!h.startsWith("#/")) return { dest: DEFAULT_DEST, parts: [] };
  const parts = h.slice(2).split("?")[0].split("/").filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  const known = routeIds().includes(parts[0]);
  return { dest: known ? parts[0] : DEFAULT_DEST, parts: known ? parts.slice(1) : [] };
}
export const hashFor = (dest, ...parts) => "#/" + [dest, ...parts].filter(Boolean).map(encodeURIComponent).join("/");

// "g" then a letter jumps to a destination (kept from v33, letters now follow the new names)
export const shortcutDest = (k) => [ROOM, ...DESTINATIONS].find((d) => d.key === String(k).toLowerCase())?.id || null;

// Where every feature from the v33 inventory lives now. tests/nav.test.mjs checks that nothing is missing.
export const FEATURE_HOME = {
  "Tasks list, calendar, board": "track", "Done tasks": "track", "Add / edit / delete task": "track", "Task comments": "track",
  "Groups": "class", "Subjects and colours": "settings", "Quarters and class settings": "settings",
  "Plan my evening": "track", "Focus timer": "track", "Streak and weekly progress": "track", "Admin announcement": "track",
  "Search": "global", "Ask the assistant": "global", "Keyboard shortcuts": "global",
  "Study techniques": "review", "Weekly plan": "review", "Reviewers": "review", "Weekly reviewer": "review", "Notes and reviewer uploads": "review",
  "Long term plans": "prepare", "Teach me this lessons": "prepare",
  "Seat map and presence": "class", "Temporary chat": "class",
  "Appearance, sound, music": "settings", "Replay Move-In Day": "settings", "Night mode lamp": "global", "Your room home": "room", "Change class": "settings", "Send feedback": "settings",
  "Download my data": "settings", "Sign out": "settings", "Delete account": "settings", "About / credit": "settings",
  "Admin: suggestions, classes, Minecraft": "admin",
};

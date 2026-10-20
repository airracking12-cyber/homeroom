// Minecraft server access. See /minecraft/README.md.
// Off unless the build variable VITE_MC_ON is "true". Turn it on only after the database file and the plugin are set up.
// The server address also comes from build variables (VITE_MC_IPV6, VITE_MC_HOST), so it is not stored in the code.
// While it is off the build leaves out the settings panel and the admin tab entirely: the two files that load them
// (Settings.jsx, Admin.jsx) test import.meta.env.VITE_MC_ON themselves, because the bundler only removes a branch it can see.
const env = import.meta.env || {};
const ON = env.VITE_MC_ON === "true";
export const MC_ON = ON;
export const MINECRAFT = {
  on: ON,
  version: "Java Edition 26.1.2",
  ipv6: ON ? env.VITE_MC_IPV6 || "" : "", // try this one first
  host: ON ? env.VITE_MC_HOST || "" : "", // if the first one doesn't work
  dns: { main: "8.8.8.8", alt: "8.8.4.4" }, // if neither works: change your IPv4 DNS to these
};

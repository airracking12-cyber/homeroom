// Minecraft server access. See /minecraft/README.md.
// `on: false` keeps all of it hidden. Turn it on only after the database file and the plugin are set up.
// The server address comes from build variables (VITE_MC_IPV6, VITE_MC_HOST), so it is not stored in the code
// and is not shipped to every visitor while the feature is off.
const ON = false;
const env = import.meta.env;
export const MINECRAFT = {
  on: ON,
  version: "Java Edition 26.1.2",
  ipv6: ON ? env.VITE_MC_IPV6 || "" : "", // try this one first
  host: ON ? env.VITE_MC_HOST || "" : "", // if the first one doesn't work
  dns: { main: "8.8.8.8", alt: "8.8.4.4" }, // if neither works: change your IPv4 DNS to these
};

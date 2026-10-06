// Minecraft server access. See /minecraft/README.md.
// `on: false` keeps all of it hidden. Turn it on only after the database file and the plugin are set up.
export const MINECRAFT = {
  on: false,
  version: "Java Edition 26.1.2",
  ipv6: "[2001:4451:877a:5c00:aeda:30d4:1189:4303]:25565", // try this one first
  host: "wills-cheque.tun.ply.gg",                        // if the first one doesn't work
  dns: { main: "8.8.8.8", alt: "8.8.4.4" },               // if neither works: change your IPv4 DNS to these
};

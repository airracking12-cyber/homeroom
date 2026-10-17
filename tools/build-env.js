// The build needs the two Supabase settings. Without them the app's first file throws when it loads, so the bundler throws the whole
// app away and still reports "built", leaving a blank site. This turns that silent blank build into a clear failure.
export const REQUIRED_BUILD_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

export const missingBuildEnv = (env) => REQUIRED_BUILD_ENV.filter((k) => !String((env && env[k]) || "").trim());

export function buildEnvMessage(missing) {
  return [
    `The build stopped: ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not set.`,
    "Without them the site would build but show a blank page.",
    "Locally, put them in a .env.local file. On Cloudflare, add them under Build variables. The README shows both (Put it online, step 3).",
  ].join("\n");
}

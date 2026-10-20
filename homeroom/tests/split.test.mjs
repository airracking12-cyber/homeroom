import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MC_ON } from "../src/minecraft.config.js";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("Admin is loaded on demand, not imported at the top of App.jsx", () => {
  const app = read("src/App.jsx");
  assert.doesNotMatch(app, /^import Admin /m);
  assert.match(app, /lazy\(\(\) => import\("\.\/app\/admin\/Admin\.jsx"\)\)/);
  assert.match(app, /<Suspense fallback=\{<Splash \/>\}><Admin /);
});

test("the Minecraft screens are only reachable through MC_ON and a dynamic import", () => {
  for (const [f, mod] of [["src/app/settings/Settings.jsx", "MinecraftPanel"], ["src/app/admin/Admin.jsx", "MinecraftTab"]]) {
    const src = read(f);
    assert.doesNotMatch(src, new RegExp(`^import .* from "\\./${mod}\\.jsx"`, "m"), `${f} does not import ${mod} up front`);
    assert.match(src, new RegExp(`import\\.meta\\.env\\.VITE_MC_ON === "true" \\? lazy\\(\\(\\) => import\\("\\./${mod}\\.jsx"\\)\\)`));
    assert.doesNotMatch(src, /MINECRAFT\.on/, "nothing depends on a property the build cannot see through");
  }
  assert.match(read("src/minecraft.config.js"), /const ON = env\.VITE_MC_ON === "true";/);
});

test("Minecraft is off unless the build variable says otherwise", () => {
  assert.equal(MC_ON, false);
});

# Homeroom x Minecraft

**Status: built, switched off.** Nothing here changes the app until you turn it on (step 4).

**The rule:** a student can join the server only while **every task in their class's current quarter is marked done**.
Someone adds a new task? Everyone who had finished loses access until they tick it off. Nothing to manage by hand.

## How it works (the simple version)

```
Student finishes every task  ->  pop-up asks for their Minecraft username  ->  saved (one name per student)
Student tries to join        ->  the server asks Homeroom "is <name> allowed in?"  ->  yes / no
```

- There is **no whitelist** to keep in sync. The server asks at the moment someone joins, so a new task takes effect immediately.
- While someone is playing, the plugin re-checks every 10 minutes (changeable) and moves anyone who lost access out.
- The plugin only uses the standard Paper API, no server internals, so Minecraft/Paper updates rarely break it.

## What's in this folder

| Path | What it is |
|---|---|
| `supabase-minecraft.sql` | The database part (links table, the "is this name allowed" check). Run once. |
| `plugin/` | The Paper plugin (`HomeroomGate`). Build it into a `.jar`. |
| `../src/minecraft.config.js` | The pop-up on/off switch and the server addresses students see. |

## Turn it on (when the UI is ready)

1. **Database.** Open `supabase-minecraft.sql`, change `CHANGE-ME-to-a-long-random-text` to your own long random text (this is the shared secret), then paste the whole file into Supabase > SQL Editor > Run. Do this *after* `supabase/schema.sql`.
2. **Plugin.** You need **JDK 25** (Paper 26.1.x requires Java 25). In the `plugin/` folder run `./gradlew build` (or `gradle build` if you have Gradle installed). The jar appears in `plugin/build/libs/HomeroomGate-1.0.0.jar`. Drop it in the server's `plugins/` folder and start the server once.
3. **Plugin config.** Edit `plugins/HomeroomGate/config.yml`: your Supabase URL, the anon key (the same public one the website uses), and the same secret as in step 1. Then run `/homeroomgate reload`.
4. **App.** In `src/minecraft.config.js` change `on: false` to `on: true` and redeploy the site.

Test it: `/homeroomgate check SomeName` in the server console tells you what the server would answer for that name (`allowed`, `not_linked`, `tasks_pending`).

## What students see

When someone's tasks are all done they get: *"Congratulations on completing every task! Enter your username to be able to join the Minecraft server."* After they save their name the pop-up shows the Java address, the backup address, and the DNS tip. The same pop-up is under **Account > Minecraft server** (only when it's on). If a new task is added, it tells them how many are left.

To change the addresses or the version text later, edit only `src/minecraft.config.js`.

## Good to know

- **Keep `online-mode=true`** in `server.properties`. Names are only trustworthy when Mojang verifies them. On an offline-mode server, anyone could type a classmate's linked name.
- One Minecraft name per student, and one student per Minecraft name. If someone claims a name that isn't theirs, an admin can unlink it (Admin > Minecraft).
- Server operators are never blocked (`bypass-ops`). Add anyone else under `bypass-names`.
- If Homeroom can't be reached the plugin keeps people **out** by default (`fail-open: false`) and never kicks someone already playing because of a hiccup. Flip `fail-open: true` if you'd rather let people in during an outage.
- "Current quarter" is the quarter an admin sets for the class (Admin > Classes). Tasks from other quarters don't count. A class with no tasks gives nobody access.
- The addresses in the pop-up are visible to anyone who is signed in to Homeroom. A home IPv6 address can change when your router restarts; if it does, update `minecraft.config.js`.
- This was written for Paper **26.1.2**. Its Java was compile-checked against stand-in copies of the Paper/Bukkit classes it uses, but it has not been built against the real Paper API or run on a live server. If Gradle can't find that exact Paper build, check https://papermc.io/downloads for the current one and change `paperApi` in `plugin/gradle.properties`. If the server complains about `api-version`, change `"26.1"` to `"26.1.2"` in `plugin.yml`.

## When Minecraft updates

Change `paperApi` (and `javaVersion` if Paper asks for a newer Java) in `plugin/gradle.properties`, rebuild, replace the jar. That's all.

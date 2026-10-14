package dev.homeroom.gate;

import io.papermc.paper.threadedregions.scheduler.ScheduledTask;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Homeroom Gate: a student can join only while all their Homeroom tasks are done.
 * The whole idea is one question asked at join time ("is this name allowed in?"), so there is no whitelist to keep in sync.
 */
public final class HomeroomGate extends JavaPlugin implements Listener {

    private static final MiniMessage MM = MiniMessage.miniMessage();

    private HomeroomApi api;
    private ScheduledTask recheck;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        load();
        Bukkit.getPluginManager().registerEvents(this, this);
    }

    @Override
    public void onDisable() {
        if (recheck != null) recheck.cancel();
    }

    private void load() {
        reloadConfig();
        if (recheck != null) { recheck.cancel(); recheck = null; }
        String url = getConfig().getString("supabase-url", "");
        String key = getConfig().getString("supabase-anon-key", "");
        String secret = getConfig().getString("secret", "");
        if (url.contains("YOUR-PROJECT") || key.startsWith("PASTE") || secret.startsWith("CHANGE-ME")) {
            getLogger().warning("config.yml isn't filled in yet (supabase-url, supabase-anon-key, secret). Until it is, joining will be blocked unless enabled: false.");
        }
        api = new HomeroomApi(url, key, secret);
        int mins = getConfig().getInt("recheck-minutes", 10);
        if (mins > 0) {
            recheck = Bukkit.getAsyncScheduler().runAtFixedRate(this, task -> recheckPlayers(), mins, mins, TimeUnit.MINUTES);
        }
    }

    // ---------- the gate ----------

    @EventHandler(priority = EventPriority.HIGH)
    public void onPreLogin(AsyncPlayerPreLoginEvent e) {
        if (!getConfig().getBoolean("enabled", true)) return;
        if (isBypassed(e.getUniqueId(), e.getName())) return;
        HomeroomApi.Answer a = api.check(e.getName());
        if (a.allowed()) return;
        if (a.reason() == HomeroomApi.Reason.UNREACHABLE && getConfig().getBoolean("fail-open", false)) return;
        e.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, message(a, false));
    }

    /** Runs every few minutes: someone who was allowed in but has since lost access (a new task was added) gets sent out. */
    private void recheckPlayers() {
        if (!getConfig().getBoolean("enabled", true)) return;
        for (Player p : Bukkit.getOnlinePlayers()) {
            if (isBypassed(p.getUniqueId(), p.getName())) continue;
            HomeroomApi.Answer a = api.check(p.getName());
            if (a.allowed() || a.reason() == HomeroomApi.Reason.UNREACHABLE) continue; // never kick because Homeroom had a hiccup
            Component why = message(a, true);
            p.getScheduler().run(this, t -> p.kick(why), null);
        }
    }

    private boolean isBypassed(java.util.UUID id, String name) {
        List<String> names = getConfig().getStringList("bypass-names");
        for (String n : names) if (n.equalsIgnoreCase(name)) return true;
        if (!getConfig().getBoolean("bypass-ops", true)) return false;
        OfflinePlayer op = Bukkit.getOfflinePlayer(id);
        return op.isOp();
    }

    /** @param alreadyPlaying true when the person is being removed from a running game (a new task was added) */
    private Component message(HomeroomApi.Answer a, boolean alreadyPlaying) {
        String key = switch (a.reason()) {
            case NOT_LINKED -> "not-linked";
            case TASKS_PENDING -> alreadyPlaying ? "lost-access" : "tasks-pending";
            default -> "unreachable";
        };
        String text = getConfig().getString("messages." + key, "Homeroom says no.")
                .replace("{done}", String.valueOf(a.done()))
                .replace("{total}", String.valueOf(a.total()));
        return MM.deserialize(text);
    }

    // ---------- /homeroomgate ----------

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (args.length >= 1 && args[0].equalsIgnoreCase("reload")) {
            load();
            sender.sendMessage("Homeroom Gate reloaded.");
            return true;
        }
        if (args.length >= 2 && args[0].equalsIgnoreCase("check")) {
            String name = args[1];
            Bukkit.getAsyncScheduler().runNow(this, t -> {
                HomeroomApi.Answer a = api.check(name);
                sender.sendMessage(name + ": " + a.reason().name().toLowerCase(Locale.ROOT)
                        + (a.total() > 0 ? " (" + a.done() + " of " + a.total() + " tasks done)" : ""));
            });
            return true;
        }
        sender.sendMessage("Usage: /" + label + " reload | check <name>");
        return true;
    }
}

package dev.homeroom.gate;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Asks Homeroom (Supabase) whether a Minecraft name may be on the server. No libraries needed: plain JDK HTTP. */
final class HomeroomApi {

    enum Reason { ALLOWED, NOT_LINKED, TASKS_PENDING, UNREACHABLE }

    record Answer(Reason reason, int done, int total) {
        boolean allowed() { return reason == Reason.ALLOWED; }
    }

    private static final Pattern OK = Pattern.compile("\"ok\"\\s*:\\s*true");
    private static final Pattern WHY = Pattern.compile("\"reason\"\\s*:\\s*\"([a-z_]+)\"");
    private static final Pattern DONE = Pattern.compile("\"done\"\\s*:\\s*(\\d+)");
    private static final Pattern TOTAL = Pattern.compile("\"total\"\\s*:\\s*(\\d+)");
    private static final Pattern SAFE_NAME = Pattern.compile("[A-Za-z0-9_]{1,16}");

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final String url;
    private final String anonKey;
    private final String secret;

    HomeroomApi(String supabaseUrl, String anonKey, String secret) {
        this.url = supabaseUrl.replaceAll("/+$", "") + "/rest/v1/rpc/mc_check";
        this.anonKey = anonKey;
        this.secret = secret;
    }

    /** Blocking call. Run it off the main thread (the join event and the scheduler below already are). */
    Answer check(String name) {
        if (name == null || !SAFE_NAME.matcher(name).matches()) return new Answer(Reason.NOT_LINKED, 0, 0);
        try {
            String body = "{\"p_secret\":\"" + escape(secret) + "\",\"p_name\":\"" + name + "\"}";
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("Content-Type", "application/json")
                    .header("apikey", anonKey)
                    .header("Authorization", "Bearer " + anonKey)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) return new Answer(Reason.UNREACHABLE, 0, 0);
            String json = res.body();
            int done = number(DONE, json), total = number(TOTAL, json);
            if (OK.matcher(json).find()) return new Answer(Reason.ALLOWED, done, total);
            Matcher why = WHY.matcher(json);
            String r = why.find() ? why.group(1) : "";
            if (r.equals("not_linked")) return new Answer(Reason.NOT_LINKED, 0, 0);
            if (r.equals("tasks_pending")) return new Answer(Reason.TASKS_PENDING, done, total);
            return new Answer(Reason.UNREACHABLE, 0, 0); // includes "bad_secret": a setup mistake, never silently let people in
        } catch (Exception e) {
            return new Answer(Reason.UNREACHABLE, 0, 0);
        }
    }

    private static int number(Pattern p, String s) {
        Matcher m = p.matcher(s);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}

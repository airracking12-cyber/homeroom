// Sign-in, account, profile and class screens. Same sign-in logic as v33 (messages, email links, class codes); new screens.
import { useEffect, useState } from "react";
import { Check, Lock, Plus, ListChecks, BookOpen, Telescope } from "lucide-react";
import { supabase, store, loadProfile } from "../lib/services.js";
import { EMAIL_RE, APP_NAME } from "../lib/constants.js";
import { LINK_NOTICE } from "../lib/helpers.js";
import { Sound } from "../lib/sound.js";
import { Button, Field, Banner, Chip, Dots, cx } from "./ui.jsx";

export const joinCode = { value: "" };
export const codeError = (m) => (/wrong class code/i.test(m || "") ? "That class code isn't right. Ask your teacher or a classmate for it." : null);

export const Wordmark = ({ className }) => <span className={cx("wordmark", className)} aria-label={APP_NAME}>{APP_NAME}<i aria-hidden="true" /></span>;
export const MadeBy = () => <p className="caption made-by">Made by Nathaniel Visaya</p>;

// The frame for every signed-out screen: a calm cream page, the pitch on wide screens, the form in a card.
export function AuthFrame({ children, pitch = true }) {
  return (
    <main className="auth" id="main">
      {pitch && (
        <section className="auth-pitch" aria-label="About Homeroom">
          <Wordmark />
          <h1 className="auth-big">Track it. Review it. Prepare for what&rsquo;s next.</h1>
          <ul className="plain pitch-list">
            <li><ListChecks size={20} aria-hidden="true" /><span><b>Track</b> homework and deadlines with your whole class, in one place.</span></li>
            <li><BookOpen size={20} aria-hidden="true" /><span><b>Review</b> for the quiz or test that&rsquo;s coming up.</span></li>
            <li><Telescope size={20} aria-hidden="true" /><span><b>Prepare</b> for next grade or an entrance exam, week by week.</span></li>
          </ul>
          <MadeBy />
        </section>
      )}
      <section className="auth-card card card-large">{children}</section>
    </main>
  );
}

export function Auth({ onAuthed, onNeedProfile }) {
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [mail, setMail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(LINK_NOTICE.err || "");
  const [info, setInfo] = useState(() => { try { const m = sessionStorage.getItem("hr:notice"); sessionStorage.removeItem("hr:notice"); return m || LINK_NOTICE.info || ""; } catch { return LINK_NOTICE.info || ""; } });
  const [busy, setBusy] = useState(false);
  const switchMode = (m) => { setMode(m); setErr(""); setInfo(""); };
  const submit = async (e) => {
    e?.preventDefault();
    if (busy) return;
    setErr(""); setInfo("");
    const email = mail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return setErr("That doesn't look like an email address. Check it and try again.");
    if (mode === "forgot") {
      setBusy(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) { setErr("We couldn't send that email: " + error.message + " Try again in a minute."); Sound.play("err"); return; }
        setInfo("If that email has an account, a reset link is on its way. Check your spam folder too.");
      } finally { setBusy(false); }
      return;
    }
    if (pw.length < 6) return setErr("Use a password with at least 6 characters.");
    setBusy(true);
    try {
      if (mode === "signup") {
        // Only an email and password. A database trigger creates an empty profile; username and class come next.
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin } });
        if (error) {
          setErr(/registered|exists/i.test(error.message) ? "That email already has an account. Sign in instead." : "We couldn't create the account: " + error.message + " Try again in a minute.");
          Sound.play("err"); return;
        }
        if (!data.session) { setInfo("Check your email and click the link to confirm your account, then come back and sign in."); return; }
        const prof = await loadProfile(data.user.id);
        if (!prof) { await supabase.auth.signOut(); setErr("We couldn't finish setting up the account. Try creating it again."); Sound.play("err"); return; }
        if (!prof.username) { onNeedProfile(); return; }
        await onAuthed(prof.username, prof.class_id || null, false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) { setErr(/confirm/i.test(error.message) ? "Confirm your email first. The link is in your inbox." : "That email and password don't match. Try again, or reset your password."); Sound.play("err"); return; }
        const prof = await loadProfile(data.user.id);
        if (!prof) { await supabase.auth.signOut(); setErr("This account isn't set up yet. Create a new one to get started."); Sound.play("err"); return; }
        if (!prof.username && !prof.is_admin) { onNeedProfile(); return; }
        await onAuthed(prof.username, prof.class_id || null, !!prof.is_admin);
      }
    } finally { setBusy(false); }
  };
  const titles = { signin: "Welcome back", signup: "Create your account", forgot: "Reset your password" };
  const subs = { signin: "Sign in to see what\u2019s due.", signup: "Just an email and a password. You\u2019ll pick your name and class next.", forgot: "We\u2019ll email you a link to choose a new password." };
  return (
    <AuthFrame>
      <form onSubmit={submit} noValidate>
        <h2 className="auth-h">{titles[mode]}</h2>
        <p className="muted auth-sub">{subs[mode]}</p>
        <Field label="Email" htmlFor="auth-email">
          <input id="auth-email" className="input" type="email" inputMode="email" value={mail} onChange={(e) => setMail(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="email" aria-invalid={!!err && !EMAIL_RE.test(mail.trim().toLowerCase())} />
        </Field>
        {mode !== "forgot" && (
          <Field label="Password" htmlFor="auth-pw" help={mode === "signup" ? "At least 6 characters. Use one you don't use anywhere else." : undefined}>
            <input id="auth-pw" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </Field>
        )}
        {err && <div className="field-gap"><Banner tone="bad">{err}</Banner></div>}
        {info && <div className="field-gap"><Banner tone="ok">{info}</Banner></div>}
        <Button variant="primary" size="lg" block className="field-gap" type="submit" disabled={busy || !mail || (mode !== "forgot" && !pw)}>
          {busy ? <>One moment<Dots /></> : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
        </Button>
      </form>
      <div className="auth-links">
        {mode === "signin" && <Button variant="ghost" size="sm" onClick={() => switchMode("forgot")}>Forgot your password?</Button>}
        <Button variant="ghost" size="sm" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "New here? Create an account" : mode === "signup" ? "I already have an account" : "Back to sign in"}
        </Button>
      </div>
      <p className="caption">You stay signed in on this device. Homeroom is shared with your class, so pick a password only you know.</p>
      <div className="auth-credit"><MadeBy /></div>
    </AuthFrame>
  );
}

export function ResetPassword({ onDone }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setErr("");
    if (pw.length < 6) return setErr("Use a password with at least 6 characters.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) { setErr("We couldn't change it: " + error.message + " Ask for a new reset link and try again."); Sound.play("err"); return; }
      onDone();
    } finally { setBusy(false); }
  };
  return (
    <AuthFrame pitch={false}>
      <form onSubmit={save}>
        <Wordmark className="auth-mark" />
        <h1 className="auth-h">Choose a new password</h1>
        <p className="muted auth-sub">You&rsquo;ll stay signed in after this.</p>
        <Field label="New password" htmlFor="np" error={err}><input id="np" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <Button variant="primary" size="lg" block className="field-gap" type="submit" disabled={busy || !pw}>{busy ? <>One moment<Dots /></> : "Save password"}</Button>
      </form>
    </AuthFrame>
  );
}

// Shown after the person follows the "confirm your email" link.
export function Registered({ onGo }) {
  useEffect(() => { supabase.auth.signOut().catch(() => {}); }, []);
  return (
    <AuthFrame pitch={false}>
      <div className="center-col">
        <span className="glyph-ok"><Check size={26} strokeWidth={3} aria-hidden="true" /></span>
        <h1 className="auth-h">Your account is ready</h1>
        <p className="muted">Sign in with the email and password you just chose.</p>
        <Button variant="primary" size="lg" block onClick={onGo}>Go to sign in</Button>
      </div>
    </AuthFrame>
  );
}

// Pick a class (or add one). A class that asks for a code shows the code field.
export function ClassPicker({ classes, value, onPick, onCreated }) {
  const [adding, setAdding] = useState(false);
  const [year, setYear] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const create = async () => {
    const y = year.trim(), n = name.trim();
    const id = `${y}-${n}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!y || !n || !id) return setErr("Add both a year and a class, like 8 and 16.");
    await store.classes.add({ id, year: y, name: n, label: `${y}-${n}` });
    const next = await store.classes.list();
    onCreated(next); onPick(id); Sound.play("add");
    setAdding(false); setYear(""); setName(""); setErr("");
  };
  const sorted = [...classes].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const locked = classes.find((c) => c.id === value)?.locked;
  return (
    <div className="stack">
      <Field label="Your class">
        <div className="chips">
          {sorted.map((c) => <Chip key={c.id} on={value === c.id} onClick={() => { if (c.id !== value) joinCode.value = ""; onPick(c.id); }}>{c.label}{c.locked && <Lock size={12} aria-label="needs a class code" />}</Chip>)}
          <Chip on={adding} onClick={() => setAdding(!adding)}><Plus size={14} aria-hidden="true" />{classes.length ? "My class isn't here" : "Add your class"}</Chip>
        </div>
      </Field>
      {adding && (
        <div className="stack card card-ink">
          <div className="inline-fields">
            <Field label="Year" htmlFor="c-year"><input id="c-year" className="input" placeholder="like 8" value={year} onChange={(e) => setYear(e.target.value)} /></Field>
            <Field label="Class" htmlFor="c-name"><input id="c-name" className="input" placeholder="like 16" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          </div>
          {err && <p className="error" role="alert">{err}</p>}
          <Button size="sm" onClick={create}>Add class</Button>
        </div>
      )}
      {locked && (
        <Field label="Class code" htmlFor="cls-code" help="Ask your teacher or a classmate for it.">
          <input key={value} id="cls-code" className="input" autoComplete="off" autoCapitalize="off" defaultValue={joinCode.value} onChange={(e) => { joinCode.value = e.target.value; }} />
        </Field>
      )}
      <p className="caption">Everything you add or upload is shared only with people in your class.</p>
    </div>
  );
}

export function ClassGate({ classes, setClasses, onChoose }) {
  const [cls, setCls] = useState(null);
  const [err, setErr] = useState("");
  return (
    <AuthFrame pitch={false}>
      <Wordmark className="auth-mark" />
      <h1 className="auth-h">Pick your class</h1>
      <p className="muted auth-sub">Tasks and notes are shared only with the people in your class.</p>
      <ClassPicker classes={classes} value={cls} onPick={setCls} onCreated={setClasses} />
      {err && <div className="field-gap"><Banner tone="bad">{err}</Banner></div>}
      <Button variant="primary" size="lg" block className="field-gap" disabled={!cls} onClick={async () => { setErr(""); const m = await onChoose(cls); if (m) setErr(m); }}>Continue</Button>
    </AuthFrame>
  );
}

// First sign-in: choose the name your class sees, and your class. 
export function ProfileSetup({ classes, setClasses, onSubmit, onSignOut }) {
  const [uname, setUname] = useState("");
  const [cls, setCls] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const u = uname.trim().toLowerCase();
  const okName = /^[a-z0-9_.]{3,20}$/.test(u);
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (!okName) return setErr("Use 3 to 20 letters, numbers, dots or underscores for your name.");
    if (!cls) return setErr("Pick your class first.");
    setBusy(true);
    try { const m = await onSubmit(u, cls); if (m) { setErr(m); Sound.play("err"); } } finally { setBusy(false); }
  };
  return (
    <AuthFrame pitch={false}>
      <form onSubmit={submit} noValidate>
        <Wordmark className="auth-mark" />
        <h1 className="auth-h">Set up your profile</h1>
        <p className="muted auth-sub">Two quick things, and you&rsquo;re in.</p>
        <Field label="Your name in Homeroom" htmlFor="pf-name" help="This is what your classmates see. Lowercase letters, numbers, dots and underscores, 3 to 20 characters.">
          <input id="pf-name" className="input" value={uname} maxLength={20} autoCapitalize="none" autoCorrect="off" autoComplete="username" spellCheck={false} onChange={(e) => setUname(e.target.value)} aria-invalid={!!uname && !okName} />
        </Field>
        <div className="field-gap"><ClassPicker classes={classes} value={cls} onPick={setCls} onCreated={setClasses} /></div>
        {err && <div className="field-gap"><Banner tone="bad">{err}</Banner></div>}
        <Button variant="primary" size="lg" block className="field-gap" type="submit" disabled={busy || !uname || !cls}>{busy ? <>One moment<Dots /></> : "Continue"}</Button>
        <div className="auth-links"><Button variant="ghost" size="sm" onClick={onSignOut}>Sign out</Button></div>
      </form>
    </AuthFrame>
  );
}

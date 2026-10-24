// Homeroom, rebuilt. This file only decides which screen you are on: signing in, setting up, the Move-In Day tour, or the app itself.
// Data lives in app/data.jsx, the screens in app/*, the rules (study, plans, notes) in lib/*. Nothing here is styled.
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { supabase, store, notes, loadProfile } from "./lib/services.js";
import { CONFIRMED } from "./lib/helpers.js";
import { Sound } from "./lib/sound.js";
import { readOnboardingFlag, writeOnboardingFlag, readTourOffered, writeTourOffered } from "./onboarding/flag.js";
import { tourNeeded, offerNeeded, offerDismissedHere, dismissOfferHere } from "./app/tour/machine.js";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { ToastProvider, useToast, Dots } from "./app/ui.jsx";
import { useAppearance } from "./app/prefs.js";
import { useRoute } from "./app/router.js";
import { DataProvider } from "./app/data.jsx";
import { Auth, ResetPassword, Registered, ClassGate, ProfileSetup, Wordmark, joinCode, codeError } from "./app/auth.jsx";
import Shell from "./app/shell.jsx";
import Track from "./app/track/Track.jsx";
import Review from "./app/review/Review.jsx";
import Prepare from "./app/prepare/Prepare.jsx";
import ClassScreen from "./app/class/Class.jsx";
import Settings from "./app/settings/Settings.jsx";
import Room from "./app/room/Room.jsx";
import { clearDraft } from "./app/track/parts.jsx";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/motion.css";
import "./styles/room.css";
import "./styles/cinema.css";
import "./styles/screens-auth.css";
import "./styles/screens-track.css";
import "./styles/screens-review.css";
import "./styles/screens-prepare.css";
import "./styles/screens-class.css";
import "./styles/screens-settings.css";

// Only the admin ever opens this, so it is its own download.
const Admin = lazy(() => import("./app/admin/Admin.jsx"));

const Splash = () => (
  <main className="auth" id="main" aria-busy="true"><div className="center-col"><Wordmark /><p className="muted" role="status">Opening Homeroom<Dots /></p></div></main>
);

// The signed-in app: the shell around one destination at a time. The Move-In Day tour runs on top of the real app.
function Signed({ appearance, tourOpen, setTourOpen, offerOpen, setOfferOpen, onSignOut, onChangeClass, onDeleted, user }) {
  const { route, go, back } = useRoute();
  // finishing or skipping only records that the tour is over: it never changes anything the student saved
  const closeTour = useCallback(async () => { setTourOpen(false); setOfferOpen(false); dismissOfferHere(user); await Promise.all([writeOnboardingFlag(supabase, true), writeTourOffered(supabase)]); }, [setTourOpen, setOfferOpen, user]);
  const dismissOffer = useCallback(async () => { setOfferOpen(false); dismissOfferHere(user); await writeTourOffered(supabase); }, [setOfferOpen, user]);
  const takeOffer = useCallback(() => { setOfferOpen(false); setTourOpen(true); }, [setOfferOpen, setTourOpen]);
  const screens = {
    room: <Room />,
    track: <Track />, review: <Review />, prepare: <Prepare />, class: <ClassScreen />,
    settings: <Settings appearance={appearance} onSignOut={onSignOut} onChangeClass={onChangeClass} onReplayTour={() => setTourOpen(true)} onDeleted={onDeleted} />,
  };
  return (
    <Shell route={route} go={go} back={back} appearance={appearance} tour={{ open: tourOpen, onClose: closeTour }} offer={{ open: offerOpen && !tourOpen, take: takeOffer, dismiss: dismissOffer }}>
      <ErrorBoundary inline resetKey={route.dest}>{screens[route.dest]}</ErrorBoundary>
    </Shell>
  );
}

function Root() {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [registered, setRegistered] = useState(CONFIRMED);
  const [recovering, setRecovering] = useState(() => /type=recovery/.test(window.location.hash));
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [classId, setClassId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [needProfile, setNeedProfile] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const appearance = useAppearance(ready && !!user);
  const tourChecked = useRef(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setRecovering(true); });
    return () => data?.subscription?.unsubscribe?.();
  }, []);

  // opening the app: pick up an existing session
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const prof = session && !CONFIRMED ? await loadProfile(session.user.id) : null;
        if (!prof) { setReady(true); return; }
        if (!prof.username && !prof.is_admin) { setClasses(await store.classes.list()); setNeedProfile(true); setReady(true); return; }
        setUser(prof.username); setIsAdmin(!!prof.is_admin); setClassId(prof.class_id || null);
        if (!prof.class_id) setClasses(await store.classes.list());
      } catch (err) { console.warn("[Homeroom] start-up failed:", err); }
      setReady(true);
    })();
  }, []);

  // someone who started the Move-In Day tour but never finished it is sent back into it, on any device. Older accounts have no flag and are left alone.
  useEffect(() => {
    if (!user || !classId || isAdmin || tourChecked.current) return;
    tourChecked.current = true;
    (async () => {
      const flag = await readOnboardingFlag(supabase);
      if (tourNeeded(flag)) { setTourOpen(true); return; }
      // everyone else is only OFFERED the tour, once, and can dismiss it; saying no never changes anything
      const offered = await readTourOffered(supabase);
      if (offerNeeded({ flag, offered, dismissedHere: offerDismissedHere(user) })) setOfferOpen(true);
    })();
  }, [user, classId, isAdmin]);

  const onAuthed = async (u, cid, admin) => {
    setUser(u); setIsAdmin(!!admin); setClassId(cid || null);
    if (!cid && !admin) setClasses(await store.classes.list());
  };
  const submitProfile = async (u, cid) => {
    const { error } = await supabase.rpc("complete_profile", { uname: u, cls: cid, code: joinCode.value || null });
    if (error) {
      if (codeError(error.message)) return codeError(error.message);
      if (/duplicate|unique/i.test(error.message)) return "Someone already has that name. Try another.";
      if (/already set up/i.test(error.message)) return "This account is already set up. Sign out and sign back in.";
      return "We couldn't save your profile: " + error.message + " Try again in a moment.";
    }
    joinCode.value = "";
    await writeOnboardingFlag(supabase, false); // "in the tour" from this moment, until it is finished
    tourChecked.current = true;
    setNeedProfile(false); setTourOpen(true);
    await onAuthed(u, cid, false);
    return null;
  };
  const chooseClass = async (cid) => {
    const { error } = await supabase.rpc("choose_class", { cls: cid, code: joinCode.value || null });
    if (error) { const m = codeError(error.message) || "We couldn't join that class just now. Try again in a moment."; toast(m); return m; }
    joinCode.value = "";
    store.del(`cache:${user}`);
    notes.clear();
    setClassId(cid);
    return null;
  };
  const signOut = async () => {
    clearDraft();
    await supabase.auth.signOut();
    Sound.stopMusic(); notes.clear();
    setUser(null); setIsAdmin(false); setClassId(null); setTourOpen(false); setOfferOpen(false); tourChecked.current = false;
  };
  const afterDelete = () => {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("hr:") && k.includes(`:${user}`)).forEach((k) => localStorage.removeItem(k));
      sessionStorage.setItem("hr:notice", "Your account has been deleted.");
    } catch (err) { console.warn("[Homeroom] non-fatal:", err); }
    supabase.auth.signOut().catch(() => {});
    notes.clear(); Sound.stopMusic();
    setUser(null); setIsAdmin(false); setClassId(null); setTourOpen(false); setOfferOpen(false); tourChecked.current = false;
  };

  if (registered) return <Registered onGo={() => { window.history.replaceState(null, "", window.location.pathname); setRegistered(false); }} />;
  if (!ready) return <Splash />;
  if (recovering) return <ResetPassword onDone={() => { window.history.replaceState(null, "", window.location.pathname); setRecovering(false); }} />;
  if (needProfile) return <ProfileSetup classes={classes} setClasses={setClasses} onSubmit={submitProfile} onSignOut={async () => { await supabase.auth.signOut(); setNeedProfile(false); }} />;
  if (!user) return <Auth onAuthed={onAuthed} onNeedProfile={async () => { setClasses(await store.classes.list()); setNeedProfile(true); }} />;
  if (isAdmin) return <Suspense fallback={<Splash />}><Admin theme={appearance.theme} setTheme={appearance.setTheme} onSignOut={signOut} /></Suspense>;
  if (!classId) return <ClassGate classes={classes} setClasses={setClasses} onChoose={chooseClass} />;
  return (
    <DataProvider key={`${user}:${classId}`} user={user} classId={classId} setClassId={setClassId} classes={classes} setClasses={setClasses} isAdmin={isAdmin}>
      <Signed user={user} appearance={appearance} tourOpen={tourOpen} setTourOpen={setTourOpen} offerOpen={offerOpen} setOfferOpen={setOfferOpen} onSignOut={signOut} onChangeClass={() => setClassId(null)} onDeleted={afterDelete} />
    </DataProvider>
  );
}

export default function App() {
  return <ToastProvider><Root /></ToastProvider>;
}

// The component primitives every screen is built from. Written fresh for the new design: no class names or markup from v33.
import { useEffect, useId, useRef, useState, createContext, useContext, useCallback } from "react";
import { X, Check, CircleAlert, Info, TriangleAlert, CircleCheck } from "lucide-react";

export const cx = (...a) => a.filter(Boolean).join(" ");

export function Button({ variant = "secondary", size, block, icon, className, children, ...rest }) {
  return <button type="button" className={cx("btn", `btn-${variant}`, size && `btn-${size}`, block && "btn-block", icon && "btn-icon", className)} {...rest}>{children}</button>;
}
export function LinkButton({ className, ...rest }) { return <button type="button" className={cx("link", className)} {...rest} />; }

export function Chip({ on, children, ...rest }) {
  return <button type="button" className="chip" aria-pressed={!!on} {...rest}>{children}</button>;
}

// A set of mutually exclusive choices. Real radio inputs underneath, so arrow keys and screen readers behave.
export function Segmented({ value, options, onChange, label, full }) {
  const name = useId();
  return (
    <div className={cx("seg", full && "seg-full")} role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <label key={v}><input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} /><span>{l}</span></label>
      ))}
    </div>
  );
}

export function Field({ label, optional, help, error, children, htmlFor }) {
  return (
    <div className="field">
      {label && <label className="label" htmlFor={htmlFor}>{label}{optional && <span className="opt"> (optional)</span>}</label>}
      {children}
      {help && !error && <p className="help" id={htmlFor ? `${htmlFor}-help` : undefined}>{help}</p>}
      {error && <p className="error" role="alert" id={htmlFor ? `${htmlFor}-err` : undefined}><CircleAlert size={16} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />{error}</p>}
    </div>
  );
}

export function Banner({ tone, icon, children, action, onClose, role }) {
  const Icon = icon || { warn: TriangleAlert, bad: CircleAlert, ok: CircleCheck }[tone] || Info;
  return (
    <div className={cx("banner", tone && `banner-${tone}`)} role={role || (tone === "bad" ? "alert" : "status")}>
      <Icon size={18} aria-hidden="true" />
      <div className="grow">{children}</div>
      {action}
      {onClose && <Button variant="ghost" size="sm" icon onClick={onClose} aria-label="Dismiss"><X size={16} /></Button>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && <span className="glyph"><Icon size={22} aria-hidden="true" /></span>}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ rows = 4, h = 52 }) {
  return <div className="stack" aria-hidden="true" style={{ gap: 12 }}>{Array.from({ length: rows }, (_, i) => <div key={i} className="skel" style={{ height: h, opacity: 1 - i * 0.15 }} />)}</div>;
}

export function Bar({ value, label }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return <div className="bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}><i style={{ transform: `scaleX(${v / 100})` }} /></div>;
}

export function Ring({ pct, size = 72, stroke = 7, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, pct));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(v * 100)} percent`}>
      <svg width={size} height={size} aria-hidden="true"><circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} /><circle className="arc" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} /></svg>
      <span>{children ?? `${Math.round(v * 100)}%`}</span>
    </div>
  );
}

export const Dots = () => <span className="dots" aria-hidden="true" />;
export const Spinner = ({ size = 16 }) => <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" /></svg>;

// A sheet is a native <dialog>: focus is trapped inside, Esc closes it, the page behind is inert, and focus goes back to
// the button that opened it. It is a bottom sheet on phones and a side panel from 768px.
export function Sheet({ open, onClose, title, children, wide, modal, footer }) {
  const ref = useRef(null);
  const tid = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      try { d.showModal(); } catch { d.setAttribute("open", ""); }
      // Focus goes to the field that wants it (marked data-autofocus), otherwise the title, so a screen reader hears where it is
      // and nobody gets a focus ring on the Close button. Fields are not auto-focused on a phone unless they are marked.
      requestAnimationFrame(() => (d.querySelector("[data-autofocus]") || d.querySelector("h2"))?.focus({ preventScroll: true }));
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={cx("sheet", wide && "sheet-wide", modal && "modal")} aria-labelledby={tid}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && (
        <>
          <div className="sheet-head"><h2 id={tid} tabIndex={-1}>{title}</h2><Button variant="ghost" icon onClick={onClose} aria-label="Close"><X size={20} /></Button></div>
          <div className="sheet-body" tabIndex={0} role="region" aria-labelledby={tid}>{children}</div>
          {footer}
        </>
      )}
    </dialog>
  );
}

/* ── toasts ── */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef(null);
  const show = useCallback((msg, opts = {}) => {
    clearTimeout(timer.current);
    const ms = opts.ms || (opts.undo ? 6000 : 3600);
    setT({ msg, undo: opts.undo, label: opts.label || "Undo", id: Math.random() });
    timer.current = setTimeout(() => setT(null), ms);
  }, []);
  const hold = () => clearTimeout(timer.current);
  const release = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setT(null), 2500); };
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="true">
        {t && (
          <div className="toast" key={t.id} onMouseEnter={hold} onMouseLeave={release} onFocus={hold} onBlur={release}>
            <span>{t.msg}</span>
            {t.undo && <button type="button" onClick={() => { const u = t.undo; setT(null); u(); }}>{t.label}</button>}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export function Check24({ done }) { return done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null; }

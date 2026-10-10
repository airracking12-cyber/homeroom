// The v30 layer: the central tabs rebuilt. It comes last in STYLES (see App.jsx), uses only the app's own tokens
// (so the theme, the accent colour and dark mode all carry through), and every class here starts with "v3-"
// or is scoped under the page it belongs to. Delete this import to see v29's look again.
//
// Direction: fewer things on screen at once. One idea per block, plenty of air, one clear action per card.
//  - pages open with a small label, a serif title and one line of help
//  - choices live behind a single bar (Study) or inside a card (Data) instead of rows of chips
//  - lists are quiet rows with an icon tile; the shape of a row is the same everywhere
//  - reviewers read like a printed study sheet: serif headings, terms in bold, one idea per line
export const V30_CSS = `
/* ── page header, section headings, small shared bits ── */
.v3-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:6px 0 20px}
.v3-head>div{min-width:0}
.v3-eyebrow{display:block;font-size:12.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:10px 0 2px}
.v3-head .h1{margin:2px 0 0}
.v3-lede{margin:8px 0 0;color:var(--muted);line-height:1.55;max-width:56ch;font-size:15.5px}
.v3-headBtn{flex:none;display:inline-flex;align-items:center;gap:7px;padding:10px 16px}
@media (max-width:520px){.v3-headBtn{padding:10px 13px}}
.v3-h{display:flex;align-items:baseline;gap:9px;font-weight:400;font-size:21px;letter-spacing:-.012em;margin:34px 0 12px;font-family:"Fraunces",Georgia,serif}
.v3-h small{font-family:"Inter",system-ui,sans-serif;font-size:13px;color:var(--faint);font-weight:500}
.v3-field{margin-bottom:18px}
.v3-field>label{display:block;font-size:13px;font-weight:600;color:var(--ink);margin-bottom:8px}
.v3-opt{font-weight:400;color:var(--faint);margin-left:6px}
.v3-hint{font-size:13px;color:var(--muted);margin:10px 4px 0}
.v3-tags{display:flex;flex-wrap:wrap;gap:6px}
.v3-tag{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;background:var(--wash);color:var(--muted);font-size:12.5px;font-weight:500}
.v3-tag .dot{margin:0}
.v3-tag[data-warn="1"]{background:var(--errbg);color:var(--danger)}
.hr .v3-link{border:0;color:var(--accent);background:none;padding:6px 4px;font-size:13.5px;font-weight:600;border-radius:8px}
.v3-link+.v3-link{margin-left:8px}
@media (hover:hover){.v3-link:hover{text-decoration:underline;text-underline-offset:3px}}
.v3-sheetFoot{position:sticky;bottom:-8px;display:flex;align-items:center;justify-content:space-between;gap:14px;margin:22px -22px -10px;padding:14px 22px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,transparent,var(--bg) 28%);}
.v3-spin{width:18px;height:18px;border-radius:50%;border:2px solid var(--accent-line);border-top-color:var(--accent);animation:spin .8s linear infinite;display:block}

/* ── lists: one row shape everywhere ── */
.v3-list{display:flex;flex-direction:column;gap:8px}
.v3-note{display:flex;align-items:center;gap:13px;width:100%;text-align:left;padding:12px 14px;border:1px solid color-mix(in srgb,var(--line) 78%,transparent);background:var(--paper);border-radius:var(--r-md);box-shadow:var(--shadow-sm);transition:border-color .25s var(--ease),box-shadow .3s var(--ease),transform .3s var(--spring)}
@media (hover:hover){.v3-note:hover{border-color:var(--accent-line);box-shadow:var(--shadow);transform:translateY(-1px)}}
.v3-note:active{transform:scale(.99)}
.v3-noteIcon{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--wash);color:var(--muted)}
.v3-noteIcon[data-kind="ai"]{background:var(--accent-soft);color:var(--accent)}
.v3-noteIcon[data-kind="reviewer"]{background:color-mix(in srgb,var(--ok) 14%,transparent);color:var(--ok)}
.v3-noteMain{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.v3-noteMain>b{font-weight:550;font-size:15.5px;letter-spacing:-.005em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.v3-noteMeta{display:flex;flex-wrap:wrap;gap:2px 10px;font-size:12.5px;color:var(--muted)}
.v3-noteMeta>span{display:inline-flex;align-items:center;white-space:nowrap}
.v3-noteMeta .dot{margin-right:5px}
.v3-noteState{flex:none;font-size:12px;font-weight:600;color:var(--faint);background:var(--wash);border-radius:999px;padding:3px 10px;white-space:nowrap}
.v3-noteState[data-ready="1"]{color:var(--ok);background:color-mix(in srgb,var(--ok) 12%,transparent)}
.v3-noteGo{flex:none;color:var(--faint);transition:transform .25s var(--ease)}
.v3-snip{margin:6px 6px 0;font-size:13px;color:var(--muted);line-height:1.5}
@media (max-width:420px){.v3-noteState{display:none}}

/* ── Study ── */
.v3-hero{position:relative;overflow:hidden;padding:22px 22px 20px;border-radius:var(--r-xl);border:1px solid color-mix(in srgb,var(--accent) 16%,var(--line));background:linear-gradient(155deg,color-mix(in srgb,var(--accent) 11%,var(--paper)),var(--paper) 72%);box-shadow:var(--shadow-sm)}
.v3-hero::before{content:"";position:absolute;right:-60px;top:-80px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,var(--accent-soft),transparent 70%);pointer-events:none}
.v3-hero>*{position:relative}
.v3-hero[data-tone="empty"]{background:linear-gradient(155deg,color-mix(in srgb,var(--mist) 70%,var(--paper)),var(--paper) 72%);border-color:var(--line)}
.v3-kicker{display:block;font-size:12.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--accent)}
.v3-hero h2{font-size:clamp(24px,4.6vw,30px);line-height:1.14;font-weight:400;margin:8px 0 6px;text-wrap:balance}
.v3-hero p{margin:0;color:var(--muted);line-height:1.5;max-width:46ch}
.v3-heroStats{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:12px;font-size:13px;color:var(--muted)}
.v3-heroStats b{color:var(--ink);font-weight:600}
.v3-heroActs{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.v3-heroActs .btn{display:inline-flex;align-items:center;gap:8px}

.v3-scope{display:flex;align-items:center;gap:13px;width:100%;margin-top:14px;padding:12px 14px;text-align:left;border:1px solid color-mix(in srgb,var(--line) 80%,transparent);background:var(--paper);border-radius:var(--r-lg);box-shadow:var(--shadow-sm);transition:border-color .25s var(--ease),box-shadow .3s var(--ease),transform .3s var(--spring)}
@media (hover:hover){.v3-scope:hover{border-color:var(--accent-line);box-shadow:var(--shadow)}}
.v3-scope:active{transform:scale(.99)}
.v3-scopeIcon{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)}
.v3-scopeText{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.v3-scopeText small{font-size:12px;color:var(--faint);font-weight:500}
.v3-scopeText b{font-weight:600;font-size:15.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.v3-scopeCount{flex:none;font-size:12.5px;color:var(--muted);text-align:right;max-width:34%}
.v3-scopeGo{flex:none;color:var(--faint)}
@media (max-width:420px){.v3-scopeCount{display:none}}

.v3-techs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.v3-tech{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;min-height:94px;padding:14px 6px 12px;text-align:center;border:1px solid color-mix(in srgb,var(--line) 80%,transparent);background:var(--paper);border-radius:var(--r-md);box-shadow:var(--shadow-sm);transition:border-color .25s var(--ease),background .25s var(--ease),box-shadow .3s var(--ease),transform .3s var(--spring)}
.v3-tech>b{font-size:13.5px;font-weight:550;line-height:1.2;letter-spacing:-.005em}
.v3-techIcon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--wash);color:var(--muted);transition:background .25s var(--ease),color .25s,transform .35s var(--spring)}
@media (hover:hover){.v3-tech:hover{border-color:var(--accent-line)}}
.v3-tech:active{transform:scale(.96)}
.v3-tech[data-on="1"]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 6%,var(--paper));box-shadow:0 0 0 1px var(--accent) inset,var(--shadow-sm)}
.v3-tech[data-on="1"] .v3-techIcon{background:var(--accent);color:#fff;transform:scale(1.06)}
.v3-techRec{position:absolute;top:9px;right:9px;width:7px;height:7px;border-radius:50%;background:var(--accent)}
.v3-tech:disabled{opacity:.6}
@media (min-width:640px){.v3-tech{flex-direction:row;justify-content:flex-start;gap:12px;min-height:66px;padding:12px 16px;text-align:left}.v3-tech>b{font-size:14.5px}}

.v3-go{display:flex;align-items:center;gap:16px;margin-top:12px;padding:16px 16px 16px 18px;border-radius:var(--r-lg);background:var(--ink);color:var(--bg)}
.v3-goText{flex:1;min-width:0}
.v3-goHead{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px}
.v3-goHead b{font-size:19px;font-weight:400}
.v3-goHead span{font-size:12.5px;opacity:.65}
.v3-goHead em{font-style:normal;font-size:11.5px;font-weight:600;letter-spacing:.03em;padding:2px 9px;border-radius:999px;background:color-mix(in srgb,var(--bg) 16%,transparent)}
.v3-go p{margin:5px 0 0;font-size:13.5px;line-height:1.45;opacity:.82}
.v3-goBtn{flex:none;display:inline-flex;align-items:center;gap:8px;padding:13px 20px}
/* the page, not the scroller, reserves room for the tab bar, so the Start bar's sticky offset means the same thing in every browser */
.scroll:has(.v3-study){padding-bottom:0}
.v3-study{padding-bottom:130px}
@media (min-width:760px){.v3-study{padding-bottom:60px}}
.v3-go{position:sticky;bottom:calc(96px + env(safe-area-inset-bottom));z-index:3;box-shadow:var(--shadow-lg)}
@media (min-width:760px){.v3-go{bottom:18px}}
@media (max-width:420px){.v3-go{gap:12px;padding:14px}.v3-go p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px}.v3-goHead b{font-size:18px}}

.v3-up{display:flex;flex-direction:column;border:1px solid color-mix(in srgb,var(--line) 78%,transparent);border-radius:var(--r-lg);background:var(--paper);overflow:hidden;box-shadow:var(--shadow-sm)}
.v3-upRow{display:flex;align-items:center;gap:13px;padding:14px 16px;text-align:left;background:none;border:0;transition:background .2s}
.v3-upRow+.v3-upRow{border-top:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
@media (hover:hover){.v3-upRow:hover{background:var(--wash)}}
.v3-upRow .dot{margin:0;flex:none}
.v3-upMain{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.v3-upMain b{font-weight:550;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.v3-upMain small{font-size:12.5px;color:var(--muted)}
.v3-upDue{flex:none;font-size:12.5px;font-weight:600;color:var(--muted);background:var(--wash);border-radius:999px;padding:3px 10px}
.v3-upDue.soon{background:var(--accent-soft);color:var(--accent)}

/* ── Reviewers ── */
.v3-revTop{display:grid;grid-template-columns:1fr;gap:10px}
@media (min-width:640px){.v3-revTop{grid-template-columns:1fr 1fr}}
.v3-card{display:flex;align-items:center;gap:14px;padding:16px;text-align:left;border:1px solid color-mix(in srgb,var(--line) 80%,transparent);background:var(--paper);border-radius:var(--r-lg);box-shadow:var(--shadow-sm);transition:border-color .25s var(--ease),box-shadow .3s var(--ease),transform .3s var(--spring)}
@media (hover:hover){.v3-card:hover{border-color:var(--accent-line);box-shadow:var(--shadow)}}
.v3-card:active{transform:scale(.99)}
.v3-card>svg{flex:none;color:var(--faint)}
.v3-cardIcon{flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--wash);color:var(--muted)}
.v3-card[data-accent="1"]{background:linear-gradient(155deg,color-mix(in srgb,var(--accent) 9%,var(--paper)),var(--paper) 75%);border-color:color-mix(in srgb,var(--accent) 22%,var(--line))}
.v3-card[data-accent="1"] .v3-cardIcon{background:var(--accent);color:#fff}
.v3-cardText{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.v3-cardText b{font-weight:600;font-size:15.5px}
.v3-cardText small{font-size:13px;color:var(--muted);line-height:1.4}

.v3-reader{padding-bottom:20px}
.v3-readActs{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 22px}
.v3-readActs .btn{display:inline-flex;align-items:center;gap:7px}

/* a reviewer, set like a study sheet */
.v3-doc{display:flex;flex-direction:column;gap:12px}
.v3-docTitle{font-size:clamp(23px,4vw,28px);font-weight:400;line-height:1.2;margin:4px 0 6px}
.v3-docSec{padding:18px 20px 14px;border:1px solid color-mix(in srgb,var(--line) 78%,transparent);background:var(--paper);border-radius:var(--r-lg);box-shadow:var(--shadow-sm)}
.v3-docH{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-family:"Fraunces",Georgia,serif;font-weight:400;font-size:20px;letter-spacing:-.012em;line-height:1.25}
.v3-docH::before{content:"";flex:none;width:4px;height:20px;border-radius:2px;background:var(--accent)}
.v3-term{display:grid;grid-template-columns:minmax(0,1fr);gap:2px;padding:10px 0;border-top:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
.v3-docH+.v3-term{border-top:0;padding-top:2px}
.v3-term b{font-weight:600;font-size:15px;color:var(--ink)}
.v3-term span{font-size:15px;line-height:1.55;color:var(--body)}
@media (min-width:640px){.v3-term{grid-template-columns:minmax(120px,30%) minmax(0,1fr);gap:18px}.v3-term b{padding-top:1px}}
.v3-point{position:relative;margin:0;padding:7px 0 7px 18px;font-size:15px;line-height:1.55;color:var(--body)}
.v3-point::before{content:"";position:absolute;left:3px;top:15px;width:6px;height:6px;border-radius:50%;background:var(--accent-line)}
.v3-para{margin:0;padding:6px 0;font-size:15.5px;line-height:1.65;color:var(--body)}
.v3-doc[data-live="1"] .v3-docSec:last-child{animation:lift .5s var(--ease) both}

/* ── Data ── */
.v3-stats{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid color-mix(in srgb,var(--line) 78%,transparent);background:var(--paper);border-radius:var(--r-lg);box-shadow:var(--shadow-sm)}
.v3-stats>div{display:flex;flex-direction:column;align-items:center;gap:1px;padding:15px 4px 13px}
.v3-stats>div+div{border-left:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
.v3-stats b{font-family:"Fraunces",Georgia,serif;font-weight:400;font-size:28px;letter-spacing:-.02em;line-height:1.1}
.v3-stats span{font-size:12px;color:var(--muted)}

.v3-add{display:flex;align-items:center;gap:15px;margin-top:12px;padding:16px;border:1.5px dashed var(--accent-line);border-radius:var(--r-lg);background:color-mix(in srgb,var(--accent) 5%,var(--paper));transition:background .25s var(--ease),border-color .25s,transform .3s var(--spring)}
.v3-add[data-over="1"]{background:color-mix(in srgb,var(--accent) 14%,var(--paper));border-color:var(--accent);transform:scale(1.01)}
.v3-addIcon{flex:none;width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:var(--accent);color:#fff;box-shadow:0 8px 18px -8px color-mix(in srgb,var(--accent) 80%,transparent)}
.v3-add>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.v3-add b{font-weight:600;font-size:15.5px}
.v3-add span{font-size:13px;color:var(--muted);line-height:1.45}
@media (max-width:520px){.v3-add{flex-wrap:wrap}.v3-add>.btn{width:100%}}

.v3-tools{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:18px 0 6px}
.v3-search{flex:1;min-width:220px;display:flex;align-items:center;gap:9px;padding:0 6px 0 14px;height:46px;border:1px solid var(--line);background:var(--paper);border-radius:var(--r-md);color:var(--faint);transition:border-color .2s,box-shadow .25s var(--ease)}
.v3-search:focus-within{border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
.v3-search input{flex:1;min-width:0;border:0;background:none;outline:0;font-size:15px;height:100%}
.v3-nudge{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:12px 0 0;padding:12px 14px;border-radius:var(--r-md);background:color-mix(in srgb,var(--accent) 8%,var(--paper));border:1px solid color-mix(in srgb,var(--accent) 18%,var(--line));font-size:13.5px;line-height:1.45;color:var(--body)}
.v3-nudge b{color:var(--accent)}
.v3-crumb{display:flex;align-items:center;gap:12px;margin:10px 0 2px;font-size:13px;color:var(--muted)}

.v3-subjGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (min-width:600px){.v3-subjGrid{grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}}
.v3-subj{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-height:138px;padding:16px 16px 14px;text-align:left;border:1px solid color-mix(in srgb,var(--c) 22%,var(--line));border-radius:var(--r-lg);background:linear-gradient(160deg,color-mix(in srgb,var(--c) 11%,var(--paper)),var(--paper) 70%);box-shadow:var(--shadow-sm);transition:border-color .25s var(--ease),box-shadow .3s var(--ease),transform .35s var(--spring)}
@media (hover:hover){.v3-subj:hover{border-color:var(--c);box-shadow:var(--shadow);transform:translateY(-2px)}}
.v3-subj:active{transform:scale(.98)}
.v3-subjBar{width:30px;height:5px;border-radius:3px;background:var(--c);margin-bottom:4px}
.v3-subj>b{font-size:20px;font-weight:400;line-height:1.15;letter-spacing:-.012em;padding-right:22px;overflow-wrap:anywhere}
.v3-subjMeta{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--ink);font-weight:500}
.v3-subjMeta i{width:3px;height:3px;border-radius:50%;background:var(--faint)}
.v3-subjTopics{font-size:12.5px;color:var(--muted);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.v3-subjGo{position:absolute;top:16px;right:14px;color:var(--faint);transition:transform .25s var(--ease),color .2s}
@media (hover:hover){.v3-subj:hover .v3-subjGo{transform:translateX(3px);color:var(--c)}}

.v3-subjHead{display:flex;align-items:center;gap:14px;margin:6px 0 14px}
.v3-subjHead h2{font-size:clamp(26px,5vw,34px);font-weight:400;margin:0;line-height:1.1;letter-spacing:-.02em}
.v3-subjDot{flex:none;width:12px;align-self:stretch;min-height:44px;border-radius:6px;background:var(--c)}
.v3-subjActs{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:6px}
.v3-subjActs .btn{display:inline-flex;align-items:center;gap:7px}
.v3-topic{margin-top:26px}
.v3-topicHead{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px}
.v3-topicHead h3{display:flex;align-items:baseline;gap:9px;margin:0;font-family:"Fraunces",Georgia,serif;font-weight:400;font-size:19px;letter-spacing:-.01em}
.v3-topicHead h3 small{font-family:"Inter",system-ui,sans-serif;font-size:13px;color:var(--faint)}
.v3-topicActs{flex:none}
.v3-empty{padding:40px 8px}

/* the note sheet and the upload sheet */
.v3-nsheet{padding-bottom:6px}
.v3-nacts{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.v3-nacts .btn{display:inline-flex;align-items:center;gap:7px}
.v3-fileBtn{display:flex;align-items:center;gap:12px;width:100%;margin-top:6px;padding:12px 14px;text-align:left;border:1px solid var(--line);background:var(--paper);border-radius:var(--r-md);color:var(--ink)}
.v3-fileBtn>svg{flex:none;color:var(--accent)}
.v3-fileBtn span{display:flex;flex-direction:column;min-width:0}
.v3-fileBtn b{font-weight:600;font-size:14.5px}
.v3-fileBtn em{font-style:normal;font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.v3-drop{display:flex;align-items:center;gap:14px;width:100%;margin-bottom:14px;padding:16px;text-align:left;border:1.5px dashed var(--accent-line);border-radius:var(--r-lg);background:color-mix(in srgb,var(--accent) 5%,var(--paper));transition:background .25s var(--ease),border-color .25s}
.v3-drop[data-over="1"]{background:color-mix(in srgb,var(--accent) 14%,var(--paper));border-color:var(--accent)}
.v3-drop:disabled{cursor:default}
.v3-dropIcon{flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)}
.v3-dropText{display:flex;flex-direction:column;gap:2px;min-width:0}
.v3-dropText b{font-weight:600;font-size:15px}
.v3-dropText span{font-size:12.5px;color:var(--muted);line-height:1.45}
.v3-files{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:-4px 0 16px}
.v3-file{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:5px 11px;border-radius:999px;background:color-mix(in srgb,var(--ok) 12%,transparent);color:var(--ok);font-size:12.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.v3-file em{font-style:normal;opacity:.75}
.v3-fileNote{font-size:12.5px;color:var(--muted)}

/* a task's review page */
.v3-detailStats{display:grid;grid-template-columns:repeat(3,1fr);margin:18px 0;border:1px solid color-mix(in srgb,var(--line) 78%,transparent);background:var(--paper);border-radius:var(--r-lg)}
.v3-detailStats>div{display:flex;flex-direction:column;align-items:center;padding:13px 4px 11px}
.v3-detailStats>div+div{border-left:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
.v3-detailStats b{font-family:"Fraunces",Georgia,serif;font-weight:400;font-size:26px;line-height:1.1}
.v3-detailStats span{font-size:12px;color:var(--muted)}
.v3-matCard{border-radius:var(--r-md)}
.v3-matCard[data-open="1"]>.v3-note{border-bottom-left-radius:0;border-bottom-right-radius:0}
.v3-matBody{padding:16px;border:1px solid color-mix(in srgb,var(--line) 78%,transparent);border-top:0;border-radius:0 0 var(--r-md) var(--r-md);background:var(--paper)}
.v3-matBody .matBody{padding:0}
.v3-matBody .v3-doc .v3-docSec{box-shadow:none;background:color-mix(in srgb,var(--wash) 50%,transparent)}

/* ── phones: a little tighter so the technique and Start are in reach without scrolling ── */
@media (max-width:520px){
  .v3-head{margin:2px 0 14px}
  .v3-lede{font-size:14.5px;margin-top:6px}
  .v3-hero{padding:18px 18px 16px;border-radius:var(--r-lg)}
  .v3-hero h2{font-size:23px}
  .v3-heroActs{margin-top:14px}
  .v3-h{margin:26px 0 10px;font-size:19px}
  .v3-tech{min-height:84px;padding:12px 4px 10px;gap:7px}
  .v3-techIcon{width:34px;height:34px}
  .v3-scope{margin-top:10px}
}

@media (max-width:520px){.v3-headBtn{display:none}}

/* the floating tab bar steps aside while a sheet is open, so it never sits on top of one */
.hr .tabs,.hr .fab{transition:opacity .25s var(--ease),transform .3s var(--ease)}
.hr:has(.overlay[data-show="1"]) .tabs{opacity:0;pointer-events:none;transform:translateY(24px)}
.hr:has(.overlay[data-show="1"]) .fab{opacity:0;pointer-events:none;transform:scale(.8)}

/* ══════ the other central tabs: Tasks, Done, Ask ══════
   Same direction as Review and Data: a calmer top, one toolbar, quieter rows, more of the list in view. */

/* top bar (desktop): the class chip and New task never wrap */
.hr .classChip,.hr .newBtn,.hr .searchPill{white-space:nowrap}
.hr .classChip{flex:none}
.hr .headL{flex:none}
.hr .hdrRight{min-width:0;flex:0 1 460px}
.hr .searchPill{min-width:0;flex:1 1 140px;overflow:hidden}
.hr .searchPill>span{overflow:hidden;text-overflow:ellipsis}
.hr .newBtn{gap:6px;flex:none}

/* Tasks: the greeting card */
.hr .heroCard.spot{padding-top:6px}
.hr .heroDate{font-size:12.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.hr .heroCard .h1{margin-top:2px}
.hr .heroCard .sub{margin-top:6px;line-height:1.5}
.hr .heroChips{margin-top:12px}
.hr .quickRow{margin:2px 0 18px -2px;gap:8px}
.hr .quickRow .btn{display:inline-flex;align-items:center;gap:7px;background:var(--paper);border:1px solid color-mix(in srgb,var(--line) 80%,transparent);color:var(--ink);padding:8px 14px;border-radius:999px;box-shadow:var(--shadow-sm);font-weight:500}
@media (hover:hover){.hr .quickRow .btn:hover{border-color:var(--accent-line);background:var(--paper);color:var(--ink)}}

/* Tasks: the list. Day headings are quiet labels; rows are lighter so more fit on screen */
.hr .group{margin-top:26px}
.hr .group>h2,.hr .group>.gh,.hr .group>.ghead{font-size:19px;margin-bottom:10px}
.hr .row{border-radius:var(--r-md);border-color:color-mix(in srgb,var(--line) 75%,transparent);box-shadow:var(--shadow-sm)}
.hr .rowTitle{font-weight:550;letter-spacing:-.006em}
.hr .rowMeta{font-size:12.5px;color:var(--muted)}
@media (max-width:520px){
  .hr .quickRow{-webkit-mask-image:linear-gradient(90deg,#000 90%,transparent);mask-image:linear-gradient(90deg,#000 90%,transparent);padding-right:24px}
  .hr .row{padding-top:11px;padding-bottom:11px}
  .hr .rowTitle{font-size:15.5px;line-height:1.3}
  .hr .group{margin-top:20px}
  .hr .heroCard .h1{font-size:28px}
  .hr .quickRow{margin-bottom:14px}
}

/* Done */
.hr .doneHero{border-radius:var(--r-xl);box-shadow:var(--shadow-sm)}

/* Ask: suggestions read as one quiet list, the composer is the focus */
.hr .suggest{display:flex;flex-direction:column;align-items:stretch;gap:0;margin-top:22px;border:1px solid color-mix(in srgb,var(--line) 78%,transparent);border-radius:var(--r-lg);background:var(--paper);overflow:hidden;box-shadow:var(--shadow-sm)}
.hr .suggest>button,.hr .suggest>.chip{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;border:0;border-radius:0;background:none;box-shadow:none;padding:14px 16px;font-size:15px;font-weight:450}
.hr .suggest>*+*{border-top:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
.hr .suggest>button::after,.hr .suggest>.chip::after{content:"\\2192";flex:none;color:var(--faint);transition:transform .25s var(--ease),color .2s}
@media (hover:hover){.hr .suggest>button:hover,.hr .suggest>.chip:hover{background:var(--wash)}.hr .suggest>button:hover::after,.hr .suggest>.chip:hover::after{transform:translateX(3px);color:var(--accent)}}

/* the open note: a little air under its tags */
.v3-nsheet .v3-tags{margin-bottom:10px}
`;

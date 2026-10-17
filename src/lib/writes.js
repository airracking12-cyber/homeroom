// A list of saves that did not go through, so the app can say so and send them again.
// Each entry is { id, run, reapply? }. run() sends the write and answers true or false. reapply(classId) puts the change
// back on screen after a refresh has loaded the server's copy (which does not have it yet).
// An id is reused for "the latest value wins" saves (one task's status, your study data), so a newer save replaces the old one.
// A save that works removes only its own entry: one write succeeding must never hide another that failed.

export function createWriteQueue(onChange) {
  let failed = [];
  let retrying = false;
  const emit = () => { if (onChange) onChange(failed.length); };

  function settle(entry, ok) {
    const i = failed.findIndex((e) => e.id === entry.id);
    if (ok) { if (i >= 0) failed.splice(i, 1); } else if (i >= 0) failed[i] = entry; else failed.push(entry);
    emit();
  }

  async function attempt(entry) {
    entry.busy = true;
    let ok = false;
    try { ok = !!(await entry.run()); } catch { ok = false; }
    entry.busy = false;
    settle(entry, ok);
    return ok;
  }

  return {
    attempt,
    // for saves that ran somewhere else and only report how they went
    record(id, ok, run) { settle({ id, run }, ok); },
    // send every failed write again, oldest first, one at a time
    async retryAll() {
      if (retrying) return false;
      retrying = true;
      try { for (const e of failed.slice()) await attempt(e); } finally { retrying = false; }
      return failed.length === 0;
    },
    // put failed changes back on screen; a write that is being sent right now is skipped (it would be applied twice)
    reapply(classId) { failed.forEach((e) => { if (!e.busy && e.reapply) e.reapply(classId); }); },
    count: () => failed.length,
    ids: () => failed.map((e) => e.id),
  };
}

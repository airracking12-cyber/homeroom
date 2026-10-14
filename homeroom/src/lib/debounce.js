// A debounced saver with an escape hatch. schedule(value) waits `delay` ms and saves only the latest value; flush() saves a
// pending value right now (used when the page is being hidden or closed, so the last change isn't left waiting on a timer).

export function createDebouncedSaver(save, delay = 700) {
  let timer = null;
  let pending;
  let has = false;

  const run = () => {
    timer = null;
    if (!has) return undefined;
    const value = pending;
    has = false;
    pending = undefined;
    return save(value);
  };

  return {
    schedule(value) {
      pending = value;
      has = true;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(run, delay);
    },
    flush() {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      return run();
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      has = false;
      pending = undefined;
    },
    pending: () => has,
  };
}

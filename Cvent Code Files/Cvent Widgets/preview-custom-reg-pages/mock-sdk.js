// mock-sdk.js — fakes the three Cvent SDK calls the agenda widget uses,
// backed by a real dump captured from the sandbox (data/agenda-dump.json).
//
//   getSessionGenerator(sort, pageSize) -> async iterable of session pages
//   getEventInfo()                      -> event metadata (timezone, locales, …)
//   getSpeakers(ids)                    -> Promise<{ [id]: fullSpeaker }>

export function createMockSdk(dump, opts = {}) {
  const sessions = Array.isArray(dump.sessions) ? dump.sessions : [];
  const speakers = dump.speakers && typeof dump.speakers === "object" ? dump.speakers : {};
  const eventInfo = { ...(dump.eventInfo || {}), ...(opts.eventInfoOverride || {}) };
  const latency = Number.isFinite(opts.latencyMs) ? opts.latencyMs : 150;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const sortSessions = (list, sort) => {
    const byStart = (a, b) => new Date(a.startDateTime) - new Date(b.startDateTime);
    const out = [...list].sort(byStart);
    return sort === "dateTimeDesc" ? out.reverse() : out;
  };

  // Registration subjects (observe/read). The preview fills in a test person.
  let person = { FIRSTNAME: "Test", EMAIL_ADDRESS: "test.registrant@example.com", ...(opts.person || {}) };
  const listeners = new Set();

  return {
    observe(subjects, listener) {
      const pick = () => Object.fromEntries(subjects.map((k) => [k, person[k]]));
      const l = () => listener(pick());
      listeners.add(l);
      return { value: pick(), unobserve: () => listeners.delete(l) };
    },
    read(subjects) { return { value: Object.fromEntries(subjects.map((k) => [k, person[k]])) }; },
    __setPerson(p) { person = { ...person, ...p }; listeners.forEach((l) => l()); },

    async getSessionGenerator(sort = "dateTimeAsc", pageSize = 100) {
      const ordered = sortSessions(sessions, sort);
      const size = Math.max(1, pageSize | 0);
      return (async function* () {
        for (let i = 0; i < ordered.length; i += size) {
          await wait(latency);
          yield ordered.slice(i, i + size);
        }
      })();
    },

    async getEventInfo() {
      await wait(latency / 3);
      return eventInfo;
    },

    async getSpeakers(ids = []) {
      await wait(latency);
      const out = {};
      ids.forEach((id) => {
        const key = String(id);
        out[key] = speakers[key] || { failureReason: "NOT_FOUND_IN_DUMP" };
      });
      return out;
    },
  };
}

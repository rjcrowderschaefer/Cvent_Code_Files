// mock-fetch.js — serves bloomberg.com's WordPress REST API from the captured
// dump (data/insights-dump.json), so the widget and editor run offline and
// deterministically. Installed on BOTH windows (harness = editor, frame = widget).
//
// Modes (toolbar "data" selector):
//   dump  — answer API calls from the dump (default)
//   live  — pass through to the real API (CORS is open, so localhost works)
//   error — every API call fails (tests the fallback link)
//   empty — every posts call returns []
//
// Only URLs under API_BASE are intercepted; everything else hits the network.

const API_BASE = "https://www.bloomberg.com/professional/wp-json/wp/v2/";

export function installMockFetch(win, getDump, getMode, { latencyMs = 250 } = {}) {
  const realFetch = win.fetch.bind(win);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const json = (body, status = 200, headers = {}) =>
    new win.Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

  // Mirrors WP's _fields (top-level + one level of dotted nesting).
  const pickFields = (obj, fields) => {
    if (!fields) return obj;
    const out = {};
    fields.split(",").forEach((f) => {
      const [a, b] = f.split(".");
      if (!(a in obj)) return;
      if (!b) out[a] = obj[a];
      else if (obj[a] && b in obj[a]) out[a] = { ...(out[a] || {}), [b]: obj[a][b] };
    });
    return out;
  };

  win.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const mode = getMode();
    if (!url.startsWith(API_BASE) || mode === "live") return realFetch(input, init);
    await wait(latencyMs);
    if (mode === "error") throw new TypeError("Failed to fetch (simulated)");

    const u = new URL(url);
    const route = u.pathname.split("/wp/v2/")[1] || "";
    const q = u.searchParams;
    const dump = getDump() || {};
    const fields = q.get("_fields");
    const perPage = Math.max(1, Math.min(100, Number(q.get("per_page")) || 10));
    const page = Math.max(1, Number(q.get("page")) || 1);

    const typeSlug = Object.fromEntries((dump.types || []).map((t) => [String(t.id), t.slug]));
    const typeOf = (p) => ((p.class_list || []).find((c) => c.startsWith("type-") && c !== "type-post") || "").slice(5);
    const idsParam = (k) => (q.get(k) ? q.get(k).split(",").map(String) : null);

    if (route === "posts") {
      if (mode === "empty") return json([], 200, { "X-WP-Total": "0" });
      let posts = [...(dump.posts || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      // Same semantics as WP: comma = any of; different params = all of.
      const cats = idsParam("categories"), types = idsParam("type"), series = idsParam("series");
      if (cats) posts = posts.filter((p) => (p.categories || []).map(String).some((c) => cats.includes(c)));
      if (types) posts = posts.filter((p) => types.some((t) => typeSlug[t] === typeOf(p)));
      if (series) posts = posts.filter((p) => (p.series || []).map(String).some((x) => series.includes(x)));
      if (q.get("slug")) { const s = q.get("slug").split(","); posts = posts.filter((p) => s.includes(p.slug)); }
      if (q.get("include")) { const ids = q.get("include").split(",").map(Number); posts = posts.filter((p) => ids.includes(p.id)); }
      const total = posts.length;
      const start = (page - 1) * perPage;
      if (page > 1 && start >= total) return json({ code: "rest_post_invalid_page_number" }, 400);
      return json(posts.slice(start, start + perPage).map((p) => pickFields(p, fields)), 200, { "X-WP-Total": String(total) });
    }
    // Term lists (categories = Topic, type = Type), with counts from the dump.
    if (route === "categories" || route === "type") {
      const posts = dump.posts || [];
      let terms = (route === "categories" ? dump.categories : dump.types || []).map((t) => ({
        ...t,
        count: posts.filter((p) => (route === "categories" ? (p.categories || []).includes(t.id) : typeOf(p) === t.slug)).length,
      }));
      if (q.get("include")) { const ids = q.get("include").split(",").map(Number); terms = terms.filter((c) => ids.includes(c.id)); }
      if (q.get("slug")) { const sl = q.get("slug").split(","); terms = terms.filter((c) => sl.includes(c.slug)); }
      return json(terms.map((c) => pickFields(c, fields)));
    }
    return json({ code: "rest_no_route", message: `mock-fetch: no mock for ${route}` }, 404);
  };
}

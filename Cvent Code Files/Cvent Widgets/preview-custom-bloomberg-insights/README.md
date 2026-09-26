# Local preview: Bloomberg Insights widget

Same harness as `preview/` (editor on the left, widget in a device-sized iframe
on the right), with one difference. This widget gets its data from
bloomberg.com's WordPress API, not the Cvent SDK. So `mock-fetch.js` intercepts
`fetch()` calls to `https://www.bloomberg.com/professional/wp-json/wp/v2/` in
both windows and answers them from `data/insights-dump.json`. The mock SDK only
supplies `getEventInfo()` (for the language fallback).

## Run

```bash
python3 -m http.server 8765 --directory "Cvent Code Files/Cvent Widgets"
```

Open <http://localhost:8765/preview-custom-bloomberg-insights/>.

## Toolbar: data

| Mode | What it does |
|---|---|
| dump (offline) | Answers from `data/insights-dump.json`. Deterministic. The default. |
| live bloomberg.com | Real API calls from localhost (CORS is open). Shows today's posts and real images. |
| simulate error | Every API call fails. Checks the fallback message and link. |
| simulate empty | The series returns no posts. |

Changing mode reloads the page and clears the widget's 10-minute cache.
Container queries mean the breakpoint selector re-lays the grid without a
re-render. The language selector sets `<html lang>` inside the frame, which the
widget watches, just like Cvent's language switcher.

## The dump

`data/insights-dump.json` (captured 24 Sep 2026) holds:
- the 16 posts tagged to series **3931** (Global Markets & Banking Summit)
- two untagged posts from that series page's carousel, for hand-picked mode
- 11 case studies, reports, Q&As and Asia Centric / Pricing Insights posts, so
  the Topic / Type / Series filters have something to match

It also has the topic and type lists. The mock applies the same filter logic
as WordPress: comma-separated values match any, different params must all
match. In dump mode the editor's Topic list only shows topics that have a post
in the dump. Live mode shows them all.

It uses the same shape as the live API: `title.rendered`, `class_list`,
`yoast_head_json.og_image`, and so on. Images are real `assets.bbhub.io`
links, so they load whenever you're online.

To refresh it, switch to **live** mode. If you need a new offline copy, run
this in the console on any page and save the output as
`data/insights-dump.json`, keeping the `eventInfo` block:

```js
const B = "https://www.bloomberg.com/professional/wp-json/wp/v2/";
const F = "id,date,slug,link,title,excerpt,categories,series,class_list,yoast_head_json.og_image";
const posts = await fetch(`${B}posts?series=3931&per_page=100&_fields=${F}`).then(r => r.json());
const ids = [...new Set(posts.flatMap(p => p.categories))].join(",");
const categories = await fetch(`${B}categories?include=${ids}&per_page=100&_fields=id,name,slug`).then(r => r.json());
copy(JSON.stringify({ posts, categories }, null, 1));
```

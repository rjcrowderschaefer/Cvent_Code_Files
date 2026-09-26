# custom-bloomberg-insights

Shows Bloomberg Professional **Insights** (articles, videos, podcasts, reports,
case studies, Q&As) as cards on a Cvent Flex page. Each card links out to the
article on bloomberg.com. Content is picked in one of two ways:

- **Filter Insights**: the same Topic / Type / Series facets as
  <https://www.bloomberg.com/professional/insights/>. Tick them in the editor,
  or paste a filtered Insights link (for example
  `…/insights/?topic=markets&type=case-study&series=asia-centric` or
  `…/insights/series/global-markets-banking-summit/`) and click **Apply**.
- **Hand-picked**: paste article links, shown in your order.

## Why it isn't an iframe

bloomberg.com sends `X-Frame-Options: SAMEORIGIN`, so the series page renders
blank inside a Cvent iframe. Only the bloomberg.com web team can change that.
The widget reads the site's public WordPress REST API instead and draws its own
cards in the Live design system (`page-kit.js` + `type-scale.js`).

Checked 24 Sep 2026 from a non-Bloomberg origin: GET requests are CORS-open,
~0.6–1.3 s per call, no auth.

| Call | When |
|---|---|
| `wp-json/wp/v2/posts?categories=<ids>&type=<ids>&series=<ids>&_fields=…` | Filter mode |
| `wp-json/wp/v2/posts?slug=a,b,c` / `?include=<ids>` | Hand-picked mode |
| `wp-json/wp/v2/categories?include=…` | Only when "Topic tags" is on |
| `wp-json/wp/v2/categories`, `wp-json/wp/v2/type` | Editor only: refreshes the Topic and Type lists |

**Filter logic matches the Insights page.** Several ticks in one list = any
of them (`type=3766,3767` → Q&As *or* reports). Ticks in different lists must
all match (topic AND type AND series). Nothing ticked in a list = any. The
filtering happens on Bloomberg's side, so the widget downloads only the
posts it shows. The example link above returns 0 posts, on bloomberg.com as
well, because there are no Markets case studies in Asia Centric.

| Facet | URL param on bloomberg.com | API param | Where the list comes from |
|---|---|---|---|
| Topic | `topic=<slug>` | `categories=<ids>` | `/wp/v2/categories` (live), built-in fallback |
| Type | `type=<slug>` | `type=<ids>` | `/wp/v2/type` (live), built-in fallback |
| Series | `series=<slug>` | `series=<ids>` | Built-in list copied from the Insights page's own filter; a pasted link adds new ones |

Slugs and IDs were copied from the Insights page's inline `filterCategories` /
`filterTypes` / `filterSeries` on 24 Sep 2026. The "View all" link is built
back into an Insights page URL. bloomberg.com only filters on one value per
facet, so it uses the first of each.

Responses are cached for 10 minutes in `sessionStorage` (and in memory for
the page load), so an attendee clicking around the site makes one request.

**This is an undocumented, internal API.** Bloomberg's web team can change
or rate-limit it without notice. Get their sign-off before this goes to prod.
If a request fails or times out (8 s), the widget shows "Insights can't be
loaded right now" plus a link to the matching Insights page, never a blank box.

## Things that are not obvious

- **Series have no API list.** The `/wp/v2/series` route belongs to the
  *webinar* taxonomy. The posts' taxonomy (`post_series`) uses the same
  `series` query param but has no lookup route. So the nine current series are
  built in, and a pasted link with an unknown series slug is resolved by
  scanning the latest 500 posts' `class_list` for `post_series-<slug>`.
  Global Markets & Banking Summit = **3931**.
- **Old configs migrate.** The first version saved `seriesId` plus
  content-type slugs (`types: ["video", …]`). `mergeInsightsConfig()` turns
  those into `seriesIds` / `typeIds`. If all four old types were ticked, that
  becomes "any type".
- **The series page is partly hand-curated.** Its top carousel includes
  articles that are *not* tagged to the series (for example "Three forces
  reshaping bank liquidity…"), and the lower feed is site-wide. Filtering by
  series shows only the tagged posts (16 for GMBS as of Sep 2026). To mirror the
  curated set, use **Hand-picked** mode and paste the article links.
- **Images** come from Yoast's `og_image` (on every post, including videos
  with no featured image) and are hot-linked from `assets.bbhub.io`. A dead
  image falls back to the grey placeholder.
- **Content type label** (Article / Case Study / Q&A…) comes from the
  `type-*` class in `class_list`. The `type` field on the post is WordPress's
  own post type and is always `"post"`.
- **Titles and excerpts** arrive HTML-entity-encoded (`&#8217;`). They're
  decoded to text and escaped again before rendering.
- **Layout follows the widget's column, not the viewport.** It uses
  `@container` queries: 3 or 4 columns, then 2 below 1024px of *column*
  width, then 1 below 600px. A half-width Cvent column gets the 2-up layout
  even on a desktop screen.
- **Language.** The widget's own fixed strings (Read / Watch / Listen, content
  types, states) come in en/es/pt. The planner's heading text has es/pt
  translation fields in the editor. Article titles and summaries stay in
  English, because that's what bloomberg.com serves.

## Files

| File | |
|---|---|
| `config.json` | `dev-custom-bloomberg-insights`, Website purpose |
| `widget.js` | Fetch, normalise, render. Exports helpers the editor reuses |
| `editor.js` | Content / Heading / Layout / Translations groups, live **Check** button |
| `page-kit.js`, `type-scale.js` | Identical copies of the canonical files in `Widget Playbook & Boilerplate/` |

Upload all five together (Playbook §4). Local preview:
`/preview-custom-bloomberg-insights/` (see that folder's README).

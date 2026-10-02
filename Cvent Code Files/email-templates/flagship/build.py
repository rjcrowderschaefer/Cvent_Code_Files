"""Build Cvent-ready HTML for the six Flagship (AIF NY) emails from shared blocks.

History: built 2026-09-29 (AIF NY email mockups chat), data tags verified in
Cvent's Insert Data Tags picker; every event detail comes from a data tag.
2026-10-02: status bars read "Status: Registration …" ("Under review" removed).

Run:  python3 build.py   -> writes out/*.html
Paste each file into its Cvent email: Design email > Switch to Custom HTML code.
Anything in [[ ]] is filled in by hand.
"""
import pathlib

OUT = pathlib.Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

FONT = "'AvenirNextPForBBG','Avenir Next',Avenir,'Helvetica Neue',Helvetica,Arial,sans-serif"
MONO = "Menlo,Monaco,'Courier New',monospace"
INK, MUTED, FAINT, HAIR, TINT = "#141416", "#5C5C5A", "#6F6F6D", "#E4E4E0", "#F5F5F3"
AMBER_INK, AMBER_DARK = "#9C5F00", "#F7A325"

HEADER_DESKTOP = "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/dff2792695224c1a80b861125c436348.png"
# Swap for a 750x300 mobile crop once it exists; until then the desktop banner is reused.
HEADER_MOBILE = HEADER_DESKTOP

# Cvent data tags. Anything in [[ ]] must be filled in by hand.
T = {
    "first": "{[C-FIRST NAME]}",
    "last": "{[C-LAST NAME]}",
    "event": "{[E-TITLE]}",
    # Verified 2026-09-29 in the live AIF Registration Confirmation and Cvent's Insert Data Tags picker.
    "date": "{[E-START DATE:0MMSD1C4]}",   # renders "October 15, 2026"
    "start": "{[E-START TIME:UA]}",        # renders "1:00 PM"
    "end": "{[E-END TIME:UA]}",
    "conf": "{[C-CONFIRMATION NUM]}",
    "modify": "{[E-MODIFY REG URL]}",
    "unreg": "{[E-UNREGISTER URL]}",
    "site": "{[E-HOMEPAGE URL]}",
    "agenda": "{[E-CUSTOM URL:agenda]}",
    "ical": "{[E-CALENDAR URL:ICAL]}",
    "apple": "{[E-CALENDAR URL:ICS]}",
    "google": "{[E-CALENDAR URL:GOOGLE]}",
    "outlook": "{[E-CALENDAR URL:OUTLOOK]}",
    "contact": "{[P-EMAIL]}",
    "venue": "{[E-LOCATION]}",
    "addr1": "{[E-ADDRESS-1]}",
    "city": "{[E-CITY]}",
    "state": "{[E-STATE CODE]}",
    "zip": "{[E-ZIP/POSTAL CODE]}",
    "tz": "{[E-TIME ZONE]}",
}
MAPS = "https://maps.google.com/?q={[E-ADDRESS-1]}, {[E-CITY]}, {[E-STATE CODE]} {[E-ZIP/POSTAL CODE]}"

CSS = f"""
body{{margin:0!important;padding:0!important;width:100%!important;background:#E9E9E6}}
table{{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}}
img{{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;display:block}}
a{{color:{INK}}}
.mob-only{{display:none;max-height:0;overflow:hidden;mso-hide:all}}
@media only screen and (max-width:620px){{
  .wrap{{width:100%!important;max-width:100%!important}}
  .outer-pad{{padding:0!important}}
  .px{{padding-left:20px!important;padding-right:20px!important}}
  .body-pad{{padding-top:28px!important;padding-bottom:32px!important}}
  .h1{{font-size:24px!important;line-height:1.2!important}}
  .p{{font-size:15px!important}}
  .stack{{display:block!important;width:100%!important;box-sizing:border-box}}
  .stack-gap{{padding:0 0 10px 0!important}}
  .btn-full{{width:100%!important}}
  .btn-full a{{display:block!important;text-align:center!important}}
  .lbl{{display:block!important;width:100%!important;padding:0 0 3px 0!important}}
  .val{{display:block!important;width:100%!important;padding:0 0 14px 0!important}}
  .cal-half{{display:block!important;width:100%!important;padding:0 0 8px 0!important}}
  .step{{display:block!important;width:100%!important;padding:0 0 14px 0!important}}
  .time-cell{{display:block!important;width:100%!important;box-sizing:border-box;border-right:0!important;border-bottom:1px solid rgba(255,255,255,.16)!important}}
  .big{{font-size:32px!important}}
  .desk-only{{display:none!important;max-height:0!important;overflow:hidden!important}}
  .mob-only{{display:block!important;max-height:none!important;overflow:visible!important}}
}}
"""


def doc(title, preheader, band, body):
    bg, fg, label = band
    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{title}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style type="text/css">{CSS}</style>
</head>
<body style="margin:0;padding:0;background:#E9E9E6;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#E9E9E6;">{preheader}&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E9E9E6;">
<tr><td align="center" class="outer-pad" style="padding:24px 0;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;">
{header()}
<tr><td class="px" style="padding:13px 40px;background:{bg};border-bottom:1px solid {HAIR};font-family:{FONT};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:{fg};">
<span style="color:{fg};font-size:13px;">&#9679;</span>&nbsp; {label}
</td></tr>
<tr><td class="px body-pad" style="padding:40px 40px 44px 40px;font-family:{FONT};color:{INK};">
{body}
</td></tr>
{footer()}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
"""


def header():
    alt = f"{T['event']}, {T['date']}, {T['city']}"
    return f"""<tr><td style="padding:0;background:#1A1B1E;">
<a href="{T['site']}" style="text-decoration:none;">
<img class="desk-only" src="{HEADER_DESKTOP}" width="600" alt="{alt}" style="width:100%;max-width:600px;height:auto;display:block;">
<!--[if !mso]><!--><div class="mob-only"><img src="{HEADER_MOBILE}" width="375" alt="{alt}" style="width:100%;height:auto;display:block;"></div><!--<![endif]-->
</a>
</td></tr>"""


def footer():
    link = f"color:{INK};font-weight:600;text-decoration:underline;"
    return f"""<tr><td class="px" style="padding:32px 40px;background:{TINT};border-top:1px solid {HAIR};font-family:{FONT};color:{INK};">
<p style="margin:0 0 16px 0;font-size:16px;line-height:20px;font-weight:700;">Bloomberg</p>
<p style="margin:0 0 16px 0;font-size:13.5px;line-height:21px;color:{MUTED};">Questions about the event? Contact the events team at <a href="mailto:{T['contact']}" style="{link}">{T['contact']}</a>.</p>
<p style="margin:0 0 18px 0;font-size:13px;line-height:24px;">
<a href="{T['site']}" style="{link}">Event Website</a>&nbsp;&nbsp;&nbsp;&nbsp;
<a href="{T['agenda']}" style="{link}">Agenda</a>&nbsp;&nbsp;&nbsp;&nbsp;
<a href="https://www.bloomberg.com/notices/privacy/" style="{link}">Privacy Policy</a></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid {HAIR};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>
<p style="margin:16px 0 0 0;font-size:11px;line-height:18px;color:{FAINT};">&copy; 2026 Bloomberg Finance L.P. All rights reserved.<br>View the <a href="https://www.bloomberg.com/notices/privacy/" style="color:{FAINT};">Privacy Policy</a>. &copy; 2026 Bloomberg L.P. All rights reserved.</p>
</td></tr>"""


# ---------- body blocks ----------
def h1(text):
    return f'<h1 class="h1" style="margin:0 0 22px 0;font-family:{FONT};font-size:28px;line-height:32px;font-weight:700;letter-spacing:-0.4px;color:{INK};">{text}</h1>'


def p(text, muted=False, mb=18):
    c = MUTED if muted else INK
    size = "14.5px" if muted else "15.5px"
    return f'<p class="p" style="margin:0 0 {mb}px 0;font-family:{FONT};font-size:{size};line-height:1.6;color:{c};">{text}</p>'


def h2(text):
    return f'<h2 style="margin:0 0 12px 0;font-family:{FONT};font-size:18px;line-height:24px;font-weight:700;color:{INK};">{text}</h2>'


def spacer(h=22):
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:{h}px;font-size:0;line-height:0;">&nbsp;</td></tr></table>'


def rule():
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:4px 0 26px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid {HAIR};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table></td></tr></table>'


def eyebrow(text, color=MUTED, mb=10):
    return f'<p style="margin:0 0 {mb}px 0;font-family:{FONT};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:{color};">{text}</p>'


def button(label, href, primary=True):
    """Square bulletproof button (VML-free; padding lives on the link)."""
    if primary:
        cell = f"background:{INK};border:2px solid {INK};"
        link = "color:#FFFFFF;"
    else:
        cell = f"background:#FFFFFF;border:2px solid {INK};"
        link = f"color:{INK};"
    return (f'<table role="presentation" class="btn-full" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">'
            f'<tr><td align="center" style="{cell}border-radius:0;">'
            f'<a href="{href}" target="_blank" style="display:inline-block;padding:12px 26px;font-family:{FONT};font-size:15px;line-height:20px;font-weight:600;{link}text-decoration:none;border-radius:0;">{label}</a>'
            f'</td></tr></table>')


def buttons(*btns):
    """One or two buttons side by side on desktop; stacked full-width on mobile."""
    if len(btns) == 1:
        return button(*btns[0]) + spacer()
    cells = []
    for i, b in enumerate(btns):
        pad = "padding:0 12px 0 0;" if i < len(btns) - 1 else "padding:0;"
        cells.append(f'<td class="stack stack-gap" valign="top" style="{pad}">{button(*b)}</td>')
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn-full"><tr>{"".join(cells)}</tr></table>'
            + spacer())


def details(rows, header_label=None, label_w=110):
    """Label/value card. Labels sit beside values on desktop, above them on mobile."""
    trs = []
    for i, (lab, val) in enumerate(rows):
        last = i == len(rows) - 1
        pb = "0" if last else "12px"
        trs.append(
            f'<tr><td class="lbl" valign="top" width="{label_w}" style="width:{label_w}px;padding:3px 16px {pb} 0;font-family:{FONT};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:{FAINT};">{lab}</td>'
            f'<td class="val" valign="top" style="padding:0 0 {pb} 0;font-family:{FONT};font-size:14.5px;line-height:22px;color:{INK};">{val}</td></tr>')
    head = ""
    if header_label:
        head = (f'<tr><td style="padding:12px 24px;background:{INK};font-family:{FONT};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#FFFFFF;">{header_label}</td></tr>')
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid {HAIR};">{head}'
            f'<tr><td class="px" style="padding:22px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{"".join(trs)}</table></td></tr></table>'
            + spacer())


def numbered(items):
    trs = "".join(
        f'<tr><td valign="top" width="28" style="width:28px;padding:0 0 10px 0;font-family:{FONT};font-size:14.5px;line-height:23px;font-weight:700;color:{AMBER_INK};">{i:02d}</td>'
        f'<td valign="top" style="padding:0 0 10px 0;font-family:{FONT};font-size:14.5px;line-height:23px;color:{INK};">{t}</td></tr>'
        for i, t in enumerate(items, 1))
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{trs}</table>' + spacer(12)


def calendar():
    def cbtn(label, href):
        return (f'<td width="50%" style="width:50%;padding:0 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
                f'<td align="center" style="background:{INK};"><a href="{href}" target="_blank" style="display:block;padding:12px 0;font-family:{FONT};font-size:13px;line-height:18px;font-weight:600;color:#FFFFFF;text-decoration:none;">{label}</a></td></tr></table></td>')
    half1 = f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>{cbtn("iCal", T["ical"])}{cbtn("Apple", T["apple"])}</tr></table>'
    half2 = f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>{cbtn("Google", T["google"])}{cbtn("Outlook", T["outlook"])}</tr></table>'
    return (eyebrow("Add to calendar")
            + f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
              f'<td class="cal-half" width="50%" valign="top" style="width:50%;">{half1}</td>'
              f'<td class="cal-half" width="50%" valign="top" style="width:50%;">{half2}</td></tr></table>'
            + spacer())


def signoff(line):
    return p(f"{line}<br>The Bloomberg Team", mb=0)


VENUE_1 = f"{T['venue']}<br>{T['addr1']}, {T['city']}, {T['state']} {T['zip']}"
VENUE_3 = f"{T['venue']}<br>{T['addr1']}<br>{T['city']}, {T['state']} {T['zip']}"
CONF = f'<span style="font-family:{MONO};font-size:14px;">{T["conf"]}</span>'

# Status bars (2026-10-02): "Status: Registration …" for every registration
# email; the reminders keep their time-based bar.
STATUS_PENDING = (TINT, AMBER_INK, "Status: Registration Pending")
STATUS_CONFIRMED = ("#F0FFF4", "#00603D", "Status: Registration Confirmed")
STATUS_DECLINED = (TINT, MUTED, "Status: Registration Declined")
STATUS_CANCELLED = (TINT, MUTED, "Status: Registration Cancelled")

# ---------- 01 Pending ----------
def steps():
    def step(n, label, text, bar, color):
        return (f'<td class="step" valign="top" width="33%" style="width:33%;padding:0 8px 0 0;">'
                f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
                f'<tr><td style="height:4px;background:{bar};font-size:0;line-height:0;">&nbsp;</td></tr>'
                f'<tr><td style="padding:8px 0 4px 0;font-family:{FONT};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:{color};">{n} &middot; {label}</td></tr>'
                f'<tr><td style="font-family:{FONT};font-size:13px;line-height:19px;color:{MUTED};">{text}</td></tr></table></td>')
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
            + step(1, "Received", "Your request is in.", INK, INK)
            + step(2, "Pending", "We&rsquo;re confirming places now.", AMBER_INK, AMBER_INK)
            + step(3, "Confirmation", "We&rsquo;ll email you shortly.", HAIR, FAINT)
            + '</tr></table>' + spacer(26))

pending = doc(
    "Registration request received",
    "Your registration is pending. We&rsquo;ll be in touch soon.",
    STATUS_PENDING,
    h1(f"Thanks for your interest in {T['event']}")
    + p(f"Hi {T['first']},")
    + p(f"We&rsquo;ve received your registration request for {T['event']} in {T['city']}. Places are limited, so our team confirms each request personally.")
    + p("You&rsquo;ll receive a separate email once your registration is confirmed. There&rsquo;s nothing more you need to do in the meantime.", mb=26)
    + steps()
    + details([("Event", f"<strong>{T['event']}</strong>"), ("Date", T["date"]), ("Location", VENUE_1)], label_w=96)
    + buttons(("Preview the Agenda", T["agenda"], False))
    + signoff("Kind regards,"),
)

# ---------- 02 Approved ----------
approved = doc(
    "You're confirmed",
    f"Your place on {T['date']} in {T['city']} is confirmed. Here&rsquo;s everything you need.",
    STATUS_CONFIRMED,
    h1(f"You&rsquo;re confirmed for {T['event']}")
    + p(f"Hi {T['first']},")
    + p(f"Good news: your registration for {T['event']} has been approved. We look forward to welcoming you in {T['city']}.", mb=22)
    + details([
        ("Date", f"<strong>{T['date']}</strong>"),
        ("Time", f"{T['start']} &ndash; {T['end']} {T['tz']}"),
        ("Venue", VENUE_3),
        ("Attendee", f"{T['first']} {T['last']}"),
        ("Confirmation", CONF),
    ], header_label="When &amp; where")
    + buttons(("View the Agenda", T["agenda"], True), ("Manage Registration", T["modify"], False))
    + calendar()
    + rule()
    + h2("Before you arrive")
    + numbered([
        "Bring a government-issued photo ID. It&rsquo;s required for building security.",
        "Check-in opens at [[CHECK-IN TIME]]. Allow extra time for security screening.",
        "Keep this email handy. Your confirmation number speeds up badge pickup.",
    ])
    + p("Plans changed? You can update or cancel your registration any time using Manage Registration above.", muted=True, mb=22)
    + signoff(f"See you in {T['city']},"),
)

# ---------- 03 Denied ----------
denied = doc(
    "An update on your registration",
    f"Thank you for your interest in {T['event']}.",
    STATUS_DECLINED,
    h1("An update on your registration request")
    + p(f"Hi {T['first']},")
    + p(f"Thank you for your interest in {T['event']}. Due to limited capacity, we&rsquo;re unable to confirm your registration for this event.")
    + p("We appreciate your understanding, and we hope to welcome you at a future Bloomberg event.", mb=22)
    + p(f"If you have questions about your request, contact us at {T['contact']}.", muted=True, mb=22)
    + signoff("Kind regards,"),
)

# ---------- 04 Cancelled ----------
cancelled = doc(
    "Registration cancelled",
    "We&rsquo;ve cancelled your registration. We&rsquo;re sorry you can&rsquo;t join us.",
    STATUS_CANCELLED,
    h1("Your registration has been cancelled")
    + p(f"Hi {T['first']},")
    + p(f"This confirms that your registration for {T['event']} has been cancelled. We&rsquo;re sorry you can&rsquo;t join us, and there&rsquo;s nothing further you need to do.", mb=22)
    + details([
        ("Event", f"<strong>{T['event']}</strong>"),
        ("Date", T["date"]),
        ("Confirmation", CONF),
        ("Status", f'<strong style="color:{MUTED};">Cancelled</strong>'),
    ])
    + h2("Changed your mind?")
    + p("If space allows, you&rsquo;re welcome to register again from the event website.", mb=16)
    + buttons(("Register Again", T["site"], False))
    + p(f"Didn&rsquo;t cancel? Contact us right away at {T['contact']}.", muted=True, mb=22)
    + signoff("Kind regards,"),
)

# ---------- 05 24-hour reminder ----------
def time_strip():
    def cell(label, value, sub, last=False):
        br = "" if last else "border-right:1px solid rgba(255,255,255,.16);"
        return (f'<td class="time-cell" valign="top" width="33%" style="width:33%;padding:20px;{br}">'
                f'<p style="margin:0 0 6px 0;font-family:{FONT};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:{AMBER_DARK};">{label}</p>'
                f'<p style="margin:0 0 4px 0;font-family:{FONT};font-size:20px;line-height:26px;font-weight:700;color:#FFFFFF;">{value}</p>'
                f'<p style="margin:0;font-family:{FONT};font-size:12.5px;line-height:18px;color:#BDBDBD;">{sub}</p></td>')
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{INK};"><tr>'
            + cell("Check-in", "[[CHECK-IN TIME]]", "Badge pickup opens")
            + cell("Program", T["start"], "Opening remarks")
            + cell("Close", T["end"], f"All times {T['tz']}", last=True)
            + '</tr></table>' + spacer())

reminder24 = doc(
    "See you tomorrow",
    f"Everything you need for tomorrow at {T['venue']}.",
    ("#FFFBF0", AMBER_INK, f"Tomorrow &middot; {T['date']}"),
    h1(f"See you tomorrow at {T['event']}")
    + p(f"Hi {T['first']},")
    + p("We&rsquo;re looking forward to seeing you tomorrow. Here&rsquo;s everything you need for a smooth arrival.", mb=22)
    + time_strip()
    + details([
        ("Venue", f"<strong>{T['venue']}</strong><br>{T['addr1']}, {T['city']}, {T['state']} {T['zip']}"),
        ("Entrance", "[[ENTRANCE DETAILS]]"),
        ("Confirmation", CONF),
    ])
    + buttons(("View the Agenda", T["agenda"], True), ("Get Directions", MAPS, False))
    + rule()
    + h2("Before you leave")
    + numbered([
        "Bring a government-issued photo ID for building security.",
        "Arrive 15&ndash;20 minutes early to allow time for security screening.",
        "Have this email ready at check-in. Your confirmation number speeds up badge pickup.",
        "[[OPTIONAL: Wi-Fi, coat check, dress code or accessibility note &mdash; delete if unused]]",
    ])
    + calendar()
    + p(f'Can&rsquo;t make it? Please <a href="{T["unreg"]}" style="color:{INK};">cancel your registration</a> so we can offer your seat to someone on the waitlist.', muted=True, mb=22)
    + signoff("See you tomorrow,"),
)

# ---------- 06 1-hour reminder ----------
def countdown():
    row = lambda lab, val: (
        f'<tr><td class="lbl" valign="top" width="96" style="width:96px;padding:3px 16px 10px 0;font-family:{FONT};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#A8A8A8;">{lab}</td>'
        f'<td class="val" valign="top" style="padding:0 0 10px 0;font-family:{FONT};font-size:14.5px;line-height:22px;color:#FFFFFF;">{val}</td></tr>')
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{INK};">'
            f'<tr><td class="px" style="padding:28px 28px 20px 28px;">'
            f'<p style="margin:0 0 8px 0;font-family:{FONT};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:{AMBER_DARK};">Program begins</p>'
            f'<p class="big" style="margin:0 0 6px 0;font-family:{FONT};font-size:40px;line-height:1.05;font-weight:700;letter-spacing:-0.6px;color:#FFFFFF;">{T["start"]}</p>'
            f'<p style="margin:0 0 20px 0;font-family:{FONT};font-size:13px;line-height:18px;color:#BDBDBD;">{T["tz"]}</p>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #3A3A3D;font-size:0;line-height:0;height:1px;padding:0 0 18px 0;">&nbsp;</td></tr></table>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
            + row("Where", f"{T['venue']}, {T['addr1']}")
            + row("Entrance", "[[ENTRANCE DETAILS]]")
            + row("Bring", "Government-issued photo ID and this email")
            + '</table></td></tr></table>' + spacer())

reminder1 = doc(
    "Starting in one hour",
    f"Check-in is open at {T['venue']}. Bring your photo ID.",
    ("#FFFBF0", AMBER_INK, "Starting in 1 hour"),
    h1("We&rsquo;re starting in one hour")
    + p(f"Hi {T['first']}, check-in is open and we&rsquo;re getting ready to welcome you.", mb=22)
    + countdown()
    + buttons(("Get Directions", MAPS, True), ("View the Agenda", T["agenda"], False))
    + signoff("See you shortly,"),
)

FILES = {
    "01-approval-pending-notification.html": pending,
    "02-registration-confirmation-approved.html": approved,
    "03-approval-denied-notification.html": denied,
    "04-cancellation-confirmation.html": cancelled,
    "05-event-reminder-24-hours.html": reminder24,
    "06-event-reminder-1-hour.html": reminder1,
}
if __name__ == "__main__":
    for name, html in FILES.items():
        (OUT / name).write_text(html, encoding="utf-8")
        print(name, len(html))

# Websites for businesses

Load this for a marketing, venue, local business or studio site read mostly on phones. It comes from a study of five galleries on 2026-11-07, written in our own words, and covers what [verticals.md](verticals.md) and [interaction.md](interaction.md) leave open.

## Choosing a style

- Start from the business. Before opening a gallery, write its look as one line of a material, a light and one accent, taken from its sign, room, printed menu or awning, and search with that. Category searches fail: "cocktail bar" returned software companies named after bars.
- Colors come from the business's own objects. A reference gives structure only: how many accents, canvas against ink, a radius per element (nav, button, image and card can differ), how photographs are treated, and how many faces with which roles.
- Write imagery as a paragraph in `DESIGN.md`: what is photographed, the crop, whether people appear, and what stands in when there are no photos. The strongest venue styles show the room more than the plate.
- Few color tokens, one job each. A rule such as "the accent fills actions and links and never a section" does most of the work.
- Check every value a gallery gives. Extracted style docs carry icon fonts in their font lists, a line height of 27, and color roles assigned by a model: one paired body text with its ground at 1.5 to 1. Recompute every contrast pair and confirm sizes on the live site.
- Gallery heroes run 75 to 195 px with line heights of 0.75 to 0.9. Scale them with `clamp()` to about 44 to 56 px at 390 wide, and give anything that can wrap a line height of 1.0 or more.
- Named faces are usually commercial, and listed substitutes fall back to Inter, which drops the character. Pick a licensed face near the business's own lettering. SF Pro is licensed for Apple platforms only and never ships as a web font; a `system-ui` stack is fine.

## Navigation

Count destinations, leaving the action out.

| Destinations | Phone pattern |
| --- | --- |
| Up to four | No toggle: a visible row under the name, or a bottom dock |
| Five to eight | A toggle opening a full-screen sheet in large type |
| More than eight | A sheet with labeled groups, or disclosures built from `details` and `summary` |

- A venue's nav is Menu, Hours or Tonight, Location, and Events where there is programming, plus the action. Private events and gift cards go in the footer. A studio's is Work, About and Contact plus the action, with no mega menu.
- Today's hours show without a tap, in the bar ("Open until 2 am") or atop the sheet. Dancerobot (dancerobotphl.com) leads a visible nav with booking and splits hours into brunch, dinner and late night tabs.
- Food and drink menus are HTML, never PDFs, with section tabs that stick under the bar and mark the active one.
- Mark the current page with `aria-current="page"` and a mark beyond color, such as a weight change with a short bar. On a one-page site, an IntersectionObserver sets `aria-current="true"` on the section tab in view. Four of 60 open menus in the gallery marked the current page at all.
- The sticky bar is one row of 64 px or less; a utility row stacked above one took 16 percent of a phone screen.
- Targets in the bar and sheet are at least 44 by 44, padding the hit area and leaving the type size alone. Measured toggles ran as small as 24 by 28.
- The toggle is a `button` with a name, `aria-expanded` and `aria-controls`. Opening it moves focus to the first link and makes the page behind inert; Escape closes it and returns focus. Of 11 toggles checked live, none moved focus.
- The open sheet keeps the action in the bar, beside the close button.
- At night the sheet is dark, never a white flash. It opens in under 300 ms, and its slide has a reduced-motion path.

A bottom dock holds destinations only, as Apple's tab bar does. Reserve or Tickets gets its own filled button beside the dock or in the top bar, never a slot in it. Pad the dock by `env(safe-area-inset-bottom)` with `viewport-fit=cover`; one studio's sat 8 px from the edge, under the home indicator.

## The one action

Pick it from how the business sells.

| Sells by | Action | Opens |
| --- | --- | --- |
| Ticketed nights | Get tickets | Tonight's event page |
| Booked tables | Book a table | The reservation flow, tonight selected |
| Walk-ins | Directions | The maps app, closing time printed beside the button |
| A conversation | Book a 20-minute call, or Email us | The booking page or a mail link, the address also printed as text |

- One label, word for word, in the bar, after the hero, in the closing band and in the footer. The label names the thing and, where it helps, the night: "Tickets for Friday".
- The other routes appear as plain text links in the header row and footer, never as rival filled buttons. One filled action per view; a secondary is outlined or plain, and a working pair differs in commitment, such as a call beside the work.
- Sticky on phones, one sticky element only. Kronborg (kronborg.dk) holds the menu button, today's hours with a disclosure for the week, and the ticket link in one header row at least 44 px tall. A bottom bar may replace that header: full width inside 16 px gutters, 48 to 56 px tall, safe-area padded, shown once the hero's button scrolls away and hidden over the closing band.
- Beside the button, a line that removes a doubt: a reply time, a timeline, a sold-out state, which delivery app takes the order. Some businesses show a starting price and some deliberately do not, and the site follows the business. What is true sits next to the button, never only on the next page.
- At night the action is a filled accent on a dark ground, label at 4.5 to 1. Hairline outlines vanish at low brightness and over photographs.
- No newsletter or discount pop-up on arrival, and urgency only when it is real.

## Footers

People scroll to the footer to learn whether the place is open and how to get there. Across 780 phone captures the median footer filled 0.97 of a screen, and most stacked desktop columns in source order, so a newsletter came first and the hours landed mid-way.

A place with a door holds, in this order:

1. Hours by day with closed days stated, and late hours written plainly ("Fri and Sat, 10 pm to 4 am"). Of 12 venues sampled, 3 printed hours.
2. The address in an `<address>` element, linked to a map.
3. A `tel:` link.
4. The one action.
5. For a club, the door policy, age limit and event list; access details such as step-free entry.
6. Instagram, private events, gift cards, a newsletter field asking for email only.
7. The legal line.

Mark up hours and address with schema.org `openingHoursSpecification` so maps agree with the page. Each location gets its own block.

- Near one screen at 375 wide, with long columns folded into disclosures. Links 44 px tall, text 16 px, legal text at least 11 pt and 4.5 to 1.
- Bottom safe-area padding keeps the last line clear of the home indicator.

The full-width wordmark closed about a third of the phone captures. It works when the name fits whole at 375 px with the facts above it. It fails when a long name is cropped, which reads as a rendering fault, and when it replaces the facts, as on one club footer with no hours and no tickets. Draw it in a font already loaded or as a labeled inline SVG, and space letters with `letter-spacing`, since separate characters are read aloud one at a time.

Repeat the action always. Repeat the menu only when the header scrolls away; under a sticky header a repeated four-link menu is dead weight. Never repeat the h1. Assembly Movement (assemblymovement.ca) opens its footer with its hero's booking action, then its studios with map links.

## Scroll and motion

None of the 142 previews in the scroll gallery was filmed on a phone and none mentioned reduced motion, so judge each technique by its mechanism.

| Technique | Phone cost | Under reduced motion |
| --- | --- | --- |
| Clip played once, frozen on its last frame | Low: one hardware-decoded video of 6 to 10 s | The poster, set to the final frame |
| Pinned stage whose text steps (a clock, a lineup) | Low, with sticky positioning and CSS scroll-driven animation off the main thread | Each step as a block in normal flow |
| Parallax at small offsets | Low; large offsets trigger vestibular symptoms | One flat composite |
| Film scrubbed from a frame sequence | High: 240 frames at 1280 by 720 decode to about 885 MB, past iOS Safari's canvas limit. Phones need a portrait set near 90 frames at 720 wide, decoded a few ahead and released behind | One still per chapter, its text beside it |
| Video scrubbed by scroll | High: every frame must be a keyframe or seeking stutters | As the film |
| Live WebGL or shader | High: Three.js is about 150 KB gzipped, a shader at 3x shades about 3 million pixels a frame (cap pixel ratio at 1.5 for a quarter), and it drains more battery than a clip | One frame, then stop |
| Cursor effects | Lost on touch, and dragging the page fights scroll | Off |

- The hero headline enters by transform alone. Starting it at zero opacity ships the Largest Contentful Paint element invisible.
- A play-once clip is muted, `playsinline`, under 1.5 MB, its poster the final frame, so Low Power Mode, which blocks autoplay, still shows the finished hero. Skip autoplay under Save-Data.
- Pin a scrubbed stage in `svh`; with `dvh`, Safari's collapsing toolbar resizes it mid-scrub.
- Scroll stays native and is read as input. Smooth-scroll libraries and root `scroll-behavior: smooth` turn off under reduced motion, which changes what is shown per the table.
- Hours, address and the action are DOM text from first paint. No film holds copy back.
- Drag zones sit inset from the screen edge, clear of Safari's back gesture; touch versions use `touch-action: pan-y` or a tap that plays once.
- Looping media waits for an IntersectionObserver with about a 200 px margin, uses `preload="none"`, and pauses offscreen.

A venue site leaves out cursor effects, shader backgrounds, generated stand-ins for the place, and 3D objects unless the client launches one product. What earns a place is one clip of the real room, a pinned rail stepping through the week's lineup, tap-to-play audio for a club, and a true black ground. A studio can afford one showpiece of its client work, shown in a phone recording beside the desktop one.

## Checklist

Run at 375 by 812, then keyboard alone, VoiceOver, and reduced motion.

- [ ] The action, and a venue's hours today, show on the first screen.
- [ ] One label for the action everywhere, and the only filled button in view.
- [ ] Sticky bar one row, 64 px or less; any bottom bar clears the safe area.
- [ ] Every target in bar, sheet, tabs and footer at least 44 by 44.
- [ ] The toggle has a name and state, focus enters the sheet, Escape closes it and focus returns.
- [ ] Current page or section marked with `aria-current` and a visible mark.
- [ ] Menus are HTML.
- [ ] Footer leads with hours, a map-linked address and `tel:`, and runs about a screen.
- [ ] The wordmark fits whole at 375 px.
- [ ] Every color pair from a reference recomputed at 4.5 to 1.
- [ ] No content starts at zero opacity.
- [ ] Each technique shows its still form under reduced motion.
- [ ] Venue page under 1 MB before a clip under 1.5 MB, with no WebGL.
- [ ] Nothing covers the action or the open menu, and zoom is allowed.

## Sources

Check any entry on its live site before citing it, since screenshots age and links die. The screenshots belong to the sites shown, and nothing from any gallery is copied into a client site: no text, code, images or layouts, and no brand's palette or fonts.

- styles.refero.design: about 1,342 style pages, each a site broken into roled colors, type, radius per element and an imagery paragraph. Good for structure and for what a full style write-up holds. Hexes and sizes are measured; roles, taglines and substitutes are a model's reading. Its robots.txt blocks Claude's crawlers site-wide, and its terms forbid scraping, systematic extraction, republishing and use to train or evaluate models. Its terms allow design research and client work. Look styles up by hand or through the paid Refero connector, never by script.
- navbar.gallery: about 491 entries with desktop and phone screenshots, the phone menu usually open. Good for phone menu patterns; type tags are loose. No terms page.
- footer.design: 781 entries with phone captures. Good for footer structure and length; a third are self-submitted and some links are dead. No terms page.
- cta.gallery: 523 crops of single action bands. Good for closing bands and labels; crops hide sticky behavior and states, there is no bar or restaurant tag, and its tips push manufactured urgency, which we ignore. No terms page.
- scrolltide.co: about 320 paid build prompts, components and shaders, previewed only as desktop recordings. Good for naming a scroll mechanism; its counts and testimonials cannot be checked. Its terms count copying a prompt or making an account as acceptance, so we do neither, and we never install its MCP server or paste its prompts into client work.

# Apple interface writing, reconciled with the writing rules

How Apple's Human Interface Guidelines say to write text inside an app, paraphrased and cited page by page, then where that guidance meets studio's `writing-guard/RULES.md`. Paraphrased from the HIG as read on 2026-09-15. Every URL is `https://developer.apple.com/design/human-interface-guidelines/<slug>`.

Load this file for any text a person reads inside an app: labels, menus, buttons, alerts, notifications, permission purpose strings in `Info.plist`, placeholders, tooltips, empty and error states, chart captions and accessibility labels.

Precedence, in order:

1. The project's own copy guide, if it has one.
2. RULES.md.
3. Apple's guidance below.

## 1. Voice, tone and audience

- Decide the app's voice from who reads it and how they should feel, then keep a list of common terms so one thing always carries one name. https://developer.apple.com/design/human-interface-guidelines/writing
- Keep the voice fixed and let the tone shift with the situation. Apple contrasts a direct message after a hard fall with a lighter one for a record activity streak. https://developer.apple.com/design/human-interface-guidelines/writing
- Write for everyone with plain words, no jargon and no gendered terms, keeping screen readers and translation in mind. https://developer.apple.com/design/human-interface-guidelines/writing
- Read the tone from other people's point of view. An academic register tells readers the product expects advanced education; aim for a direct tone that respects the reader. https://developer.apple.com/design/human-interface-guidelines/inclusion
- Address the reader as you and your. Calling them the user or the player feels distant. https://developer.apple.com/design/human-interface-guidelines/inclusion
- Define a specialized term before using it and make the definition easy to find. Even when readers know the term, the plain word reads and translates better. https://developer.apple.com/design/human-interface-guidelines/inclusion
- Swap idioms for plain language. They translate badly, and some have exclusionary origins. https://developer.apple.com/design/human-interface-guidelines/inclusion
- Be careful with humor. It translates poorly and lands differently from one reader to the next. https://developer.apple.com/design/human-interface-guidelines/inclusion
- Use exactly the words a concept or control needs. https://developer.apple.com/design/human-interface-guidelines/design-principles
- Describe gestures correctly for the device: tap on iPhone and iPad, click on a Mac. Small screens and TVs both need short text. https://developer.apple.com/design/human-interface-guidelines/writing

## 2. Clarity and structure

- Check that every word needs to be there, use fewer words when you can, and read the text aloud when unsure. https://developer.apple.com/design/human-interface-guidelines/writing
- Put the most important information first on each screen. When a screen carries more than one idea, consider splitting it and plan the order across screens. https://developer.apple.com/design/human-interface-guidelines/writing
- Use active voice. https://developer.apple.com/design/human-interface-guidelines/writing
- Build language patterns and reuse them, which makes the app feel consistent and the next string easier to write. https://developer.apple.com/design/human-interface-guidelines/writing
- Use possessive pronouns sparingly. Favorites says what Your Favorites says. If you do use them, keep one perspective throughout. https://developer.apple.com/design/human-interface-guidelines/writing
- Avoid we, since readers cannot tell who it means. Apple's replacement for a we-sentence about a loading problem is "Unable to load content". https://developer.apple.com/design/human-interface-guidelines/writing
- Call every window a window in user-facing text; scene is an implementation word. https://developer.apple.com/design/human-interface-guidelines/windows
- In help text, refer to a panel by its title, and name the task or control where you might have written the word popover. https://developer.apple.com/design/human-interface-guidelines/panels and https://developer.apple.com/design/human-interface-guidelines/popovers
- Refer to Apple's health app as Apple Health or the Apple Health app, two words with capital A and H, and never use HealthKit in user-facing text. https://developer.apple.com/design/human-interface-guidelines/healthkit

## 3. Capitalization styles and where each applies

Title style puts a capital on each major word and on the final word, and leaves articles, short prepositions and joining words like and lowercase (https://developer.apple.com/design/human-interface-guidelines/menus). Sentence style capitalizes the first word and proper nouns only. Apple treats title case as more formal and sentence case as more casual, and asks you to pick one style per element type and apply it everywhere (https://developer.apple.com/design/human-interface-guidelines/writing).

<div style="overflow-x:auto">

| Element | Apple's style | Ending punctuation | Page |
|---|---|---|---|
| Button text label | title style, ideally verb first | none | buttons |
| Alert button | sentence style | none | alerts |
| Alert title written as a full sentence | sentence style | yes | alerts |
| Alert title written as a fragment | title style | none | alerts |
| Alert informative text | sentence style, complete sentences | yes | alerts |
| Menu item | title style, articles removed | ellipsis when more input follows | menus |
| Menu bar menu title | one word where possible, title style when longer | none | the-menu-bar |
| Toolbar or window title | a word or short phrase under 15 characters, never the app name | none | toolbars |
| Tab bar label | single word where possible | none | tab-bars |
| Tab view label, segment label, table or outline column heading | title-style noun or noun phrase | none | tab-views, segmented-controls, lists-and-tables, outline-views |
| Panel title | title-style noun | none | panels |
| Box title | sentence style | none, or a colon inside a settings pane | boxes |
| Slider label | sentence style | colon | sliders |
| Combo box label | title style | colon | combo-boxes |
| Tooltip | sentence case, verb first, 60 to 75 characters at most | none unless the app's style needs it | offering-help |
| Notification title | title style | none | notifications |
| Notification body | sentence case, complete sentences | yes | notifications |
| Notification hidden-preview text | sentence style | not stated | notifications |
| Notification action | short title case | none | notifications |
| Permission purpose string | sentence case, one complete active sentence | a period | privacy |
| Widget gallery description | sentence style, opens with an action verb | not stated | widgets |
| Action button label (iPhone, Watch) | title case, verb first, three words at most | none | action-button |

</div>

Apple disagrees with itself on one row: the buttons page asks for title style on text buttons, and the alerts page asks for sentence style on alert buttons. See section 15.

## 4. Buttons, links and flow labels

- Write a few words that say what the button does, starting with a verb where you can. https://developer.apple.com/design/human-interface-guidelines/buttons
- Pick clarity over cleverness. Apple's example prefers "Send" to a playful label. https://developer.apple.com/design/human-interface-guidelines/writing
- Link text says what the link leads to. Click here tells a screen reader user nothing. https://developer.apple.com/design/human-interface-guidelines/writing
- In a multi-step flow, choose a starting label such as Get Started, an advancing label such as Continue or Next (or one that names the next step), and Done at the end, then use the same set everywhere. https://developer.apple.com/design/human-interface-guidelines/writing
- On a Mac, a push button that opens another window, view or app gets a trailing ellipsis. https://developer.apple.com/design/human-interface-guidelines/buttons
- A button whose action takes time can switch to a present-participle label with an ellipsis while an activity indicator shows. https://developer.apple.com/design/human-interface-guidelines/buttons
- A sign-in button names its method, as in Sign In with Face ID, and the word passcode stays out of account sign-in. https://developer.apple.com/design/human-interface-guidelines/managing-accounts
- Sheets use the standard titles Cancel, Done and Back, and never show all three at once. https://developer.apple.com/design/human-interface-guidelines/sheets
- In a Mac open panel, the Open button can be retitled for the task, for example Insert. https://developer.apple.com/design/human-interface-guidelines/file-management
- Toolbars use the standard Back and Close symbols and standard wording for system actions. https://developer.apple.com/design/human-interface-guidelines/toolbars

## 5. Menus

- A menu item label says what the item does. Action items start with a verb such as View, Close or Select, and the tone follows the app's voice. https://developer.apple.com/design/human-interface-guidelines/menus
- Use title style and remove a, an and the. https://developer.apple.com/design/human-interface-guidelines/menus
- Add the ellipsis character when the command needs more input before it completes. https://developer.apple.com/design/human-interface-guidelines/menus
- An item that changes state can carry one label that flips, as in Show Map and Hide Map. When such a label could read as a state, add a verb, as in Turn HDR On. https://developer.apple.com/design/human-interface-guidelines/menus
- When a term repeats across more than two items in a group, move it into a submenu and keep the repeated words in the parent label, such as Sort By. https://developer.apple.com/design/human-interface-guidelines/menus
- Undo and Redo name what they reverse, such as Undo Typing. https://developer.apple.com/design/human-interface-guidelines/undo-and-redo and https://developer.apple.com/design/human-interface-guidelines/the-menu-bar
- The command that removes content without the clipboard is Delete. Apple does not call it Erase or Clear. https://developer.apple.com/design/human-interface-guidelines/the-menu-bar
- About, Hide and Quit share one short app name of 16 characters or fewer, and About carries no version number. https://developer.apple.com/design/human-interface-guidelines/the-menu-bar
- Open Recent lists document names people recognize, never file paths. https://developer.apple.com/design/human-interface-guidelines/the-menu-bar
- View menu show and hide items reflect the current state, so a hidden toolbar shows Show Toolbar. https://developer.apple.com/design/human-interface-guidelines/the-menu-bar
- Context menu items get short labels that say what happens. A context menu title appears only when it changes the meaning, such as a count of selected items. https://developer.apple.com/design/human-interface-guidelines/context-menus
- Dock menu items are short and also exist somewhere else in the app. https://developer.apple.com/design/human-interface-guidelines/dock-menus

## 6. Alerts and their titles

- Alert copy is direct, with a neutral and approachable tone. It is never oblique or accusatory and never hides how serious the problem is. https://developer.apple.com/design/human-interface-guidelines/alerts
- The title says what happened, in what context and why, completely and specifically, in no more than two lines. A bare Error or an error number tells people nothing. https://developer.apple.com/design/human-interface-guidelines/alerts
- Add informative text only when it adds something, in short complete sentences. https://developer.apple.com/design/human-interface-guidelines/alerts
- Do not explain the buttons. If guidance cannot be avoided, use the word choose and the exact button title without quotation marks. https://developer.apple.com/design/human-interface-guidelines/alerts
- Button titles are one or two words describing the result, preferably verbs tied to the alert text, such as View All, Reply or Ignore. OK belongs only in purely informational alerts. Yes and No are avoided. A cancel button is always titled Cancel. Specific verbs such as Delete, Erase or Convert beat OK on a confirmation. A lone default button is Done. https://developer.apple.com/design/human-interface-guidelines/alerts
- Use alerts sparingly. Skip them for information with no action, at app start, and for common actions people can undo. Keep them for uncommon destructive actions that cannot be undone. https://developer.apple.com/design/human-interface-guidelines/alerts
- An action sheet title fits on one line, with a message only when needed. https://developer.apple.com/design/human-interface-guidelines/action-sheets
- An error message belongs in an alert and never in a notification. https://developer.apple.com/design/human-interface-guidelines/notifications
- A warning never goes in a popover. https://developer.apple.com/design/human-interface-guidelines/popovers

## 7. Errors and feedback

- Help people avoid the error first. When a message is needed, place it next to the problem, leave blame out and say how to fix it. Apple rewrites a complaint that a password is too short into an instruction that names the minimum length. https://developer.apple.com/design/human-interface-guidelines/writing
- Leave out interjections like oops or uh-oh, which sound insincere. https://developer.apple.com/design/human-interface-guidelines/writing
- If wording alone cannot fix an error that many people hit, change the interaction. https://developer.apple.com/design/human-interface-guidelines/writing
- A field error sits beside the field and tells people what to enter. A message like Invalid name gives no help. https://developer.apple.com/design/human-interface-guidelines/writing
- When a command cannot run, say that it cannot and why. https://developer.apple.com/design/human-interface-guidelines/feedback
- Confirm success only for significant actions. People expect things to work and need to hear when they do not. https://developer.apple.com/design/human-interface-guidelines/feedback
- Put status next to the thing it describes, and deliver important feedback through more than one channel (text plus color, sound or haptics). https://developer.apple.com/design/human-interface-guidelines/feedback
- When a problem appears at startup, show cached or placeholder content with a quiet label that names the problem. https://developer.apple.com/design/human-interface-guidelines/alerts
- When a generative feature fails, describe what happened in plain language and offer a next step. https://developer.apple.com/design/human-interface-guidelines/generative-ai
- When data is missing, say what was not measured, why, and what was still recorded. https://developer.apple.com/design/human-interface-guidelines/workouts

## 8. Empty states, loading and progress

- An empty screen gives a clear next step, with a button or link to take it where possible. It can welcome and teach, and it never holds information people need later, because empty states go away. https://developer.apple.com/design/human-interface-guidelines/writing
- A section with nothing in it stays visible and explains why its content is unavailable. https://developer.apple.com/design/human-interface-guidelines/tab-bars
- Show something as soon as possible, since a blank screen reads as a broken app. https://developer.apple.com/design/human-interface-guidelines/loading
- Tell people content is on its way and roughly how long the wait will be, with a determinate indicator when the length is known. https://developer.apple.com/design/human-interface-guidelines/loading
- A progress description is accurate and short. Vague words like loading or authenticating add little. https://developer.apple.com/design/human-interface-guidelines/progress-indicators
- During a generative wait, say what is happening. Apple's example describes summarizing themes from notes where a generic processing message would say nothing. https://developer.apple.com/design/human-interface-guidelines/generative-ai
- A refresh control title, if any, gives useful information such as when content last updated, and never explains how to refresh. https://developer.apple.com/design/human-interface-guidelines/progress-indicators

## 9. Onboarding, launch and permission explanations

- Onboarding happens after launch. Ideally people learn the app by using it; when a flow is needed, keep it quick and optional. https://developer.apple.com/design/human-interface-guidelines/onboarding
- Teach by letting people do the action, and put instructions next to the part of the interface they describe. https://developer.apple.com/design/human-interface-guidelines/onboarding
- A required flow is brief and asks people to memorize very little. https://developer.apple.com/design/human-interface-guidelines/onboarding
- A tutorial people skipped does not reappear on later launches and stays findable in help or settings. https://developer.apple.com/design/human-interface-guidelines/onboarding
- Onboarding teaches the app and leaves the device and operating system alone. https://developer.apple.com/design/human-interface-guidelines/onboarding
- Keep licensing details out of onboarding. https://developer.apple.com/design/human-interface-guidelines/onboarding
- On iOS, iPadOS and tvOS a launch screen carries no text, because its static content is never localized. macOS has no launch screen, so a Mac app's first wait view is outside this rule. https://developer.apple.com/design/human-interface-guidelines/launching
- Ask for permission during onboarding only when the app cannot work without the data, and use that moment to explain why and what people get. Otherwise ask when people first use the feature that needs it. https://developer.apple.com/design/human-interface-guidelines/onboarding and https://developer.apple.com/design/human-interface-guidelines/privacy
- A purpose string is one brief, complete, specific sentence in sentence case and active voice, ending with a period, saying how and why the app uses the data. Apple marks a vague appeal to a better experience as wrong, and a bare instruction to turn access on as wrong. https://developer.apple.com/design/human-interface-guidelines/privacy
- Ask at the moment the feature needs the access. An example that fits the rule: the app records your voice when you press the mic and turns it into text on this Mac. https://developer.apple.com/design/human-interface-guidelines/privacy
- A screen shown before the system prompt has exactly one button, titled like Continue or Next, and nothing that reads like Allow. It offers no incentives, no picture of the system alert and no arrows pointing at a choice. https://developer.apple.com/design/human-interface-guidelines/privacy
- Explain every permission request and say what data is collected and how it is used. https://developer.apple.com/design/human-interface-guidelines/design-principles
- If an account is required, explain briefly why and what it gives people. https://developer.apple.com/design/human-interface-guidelines/managing-accounts
- Make clear when and where AI is used, ask before using personal data in a model, and say that generated content can contain errors. https://developer.apple.com/design/human-interface-guidelines/generative-ai

## 10. Placeholders, fields, settings and help text

- Label every field. Placeholder text shows the expected format with an example such as "name@example.com" or describes the content. https://developer.apple.com/design/human-interface-guidelines/writing
- Placeholder text disappears as people type, so keep a separate visible label. https://developer.apple.com/design/human-interface-guidelines/text-fields
- Make required fields obvious, and enable Next or Continue only after they are filled. https://developer.apple.com/design/human-interface-guidelines/entering-data
- Validate at the right moment: an email address when people move to the next field, a user name or password before they leave it. https://developer.apple.com/design/human-interface-guidelines/text-fields
- Search placeholder text says what can be searched or which scope is active. https://developer.apple.com/design/human-interface-guidelines/search-fields and https://developer.apple.com/design/human-interface-guidelines/searching
- Settings labels are practical. When a label needs help, describe what the setting does when it is on and let people infer the off state. https://developer.apple.com/design/human-interface-guidelines/writing
- To send someone to a setting, give a direct link or button. A description of where the setting lives is harder to follow. https://developer.apple.com/design/human-interface-guidelines/writing
- A Mac settings window is titled with the visible pane, or App Name Settings when there is only one pane. https://developer.apple.com/design/human-interface-guidelines/settings
- A tooltip describes only the control under the pointer, often starts with a verb, skips the control's own name, stays within 60 to 75 characters, may be a fragment without articles, and uses sentence case. https://developer.apple.com/design/human-interface-guidelines/offering-help
- A tip is one or two direct sentences about one feature and is never promotional. https://developer.apple.com/design/human-interface-guidelines/offering-help
- Make useful text selectable and copyable, such as error messages and addresses. https://developer.apple.com/design/human-interface-guidelines/text-views and https://developer.apple.com/design/human-interface-guidelines/labels

## 11. Notifications

- Keep notifications short and informative, and send one per event even when people have not responded. https://developer.apple.com/design/human-interface-guidelines/notifications
- Do not use a notification to tell people to go do something in the app. https://developer.apple.com/design/human-interface-guidelines/notifications
- Leave sensitive, personal or confidential information out, since others may see the screen. For a personal archive this covers message text, names and health values. https://developer.apple.com/design/human-interface-guidelines/notifications
- A title gives context at a glance, like a headline or event name. If the only title available is generic, let the system show the app name. https://developer.apple.com/design/human-interface-guidelines/notifications
- The body uses complete sentences and is never shortened by hand; the system truncates. https://developer.apple.com/design/human-interface-guidelines/notifications
- Hidden-preview text describes the kind of notification without details, in the manner of New comment. https://developer.apple.com/design/human-interface-guidelines/notifications
- Leave the app name and icon out of the notification text and action labels. https://developer.apple.com/design/human-interface-guidelines/notifications
- An action label is short and describes the result. An action that only opens the app is clutter. https://developer.apple.com/design/human-interface-guidelines/notifications
- A badge counts unread notifications and nothing else. https://developer.apple.com/design/human-interface-guidelines/notifications
- A completion notice suits important tasks people switched away from; routine tasks get none. https://developer.apple.com/design/human-interface-guidelines/multitasking

## 12. Accessibility labels

- Give every key element a label that describes what it does, replace generic default labels, label every custom element and update labels when content changes. https://developer.apple.com/design/human-interface-guidelines/voiceover
- Label elements with words people would say aloud, because Voice Control depends on those labels. https://developer.apple.com/design/human-interface-guidelines/accessibility
- Describe an image only for what it adds beyond its caption, and hide purely decorative images from VoiceOver. https://developer.apple.com/design/human-interface-guidelines/voiceover
- Give each page a unique, short title that says what it holds, and use accurate section headings. https://developer.apple.com/design/human-interface-guidelines/voiceover
- Never carry meaning with color alone, and never name a color in a label; describe what a series or state means. https://developer.apple.com/design/human-interface-guidelines/accessibility and https://developer.apple.com/design/human-interface-guidelines/charts
- Chart titles say what the chart is for, and a short text summary states the main finding. https://developer.apple.com/design/human-interface-guidelines/charts and https://developer.apple.com/design/human-interface-guidelines/charting-data
- Chart accessibility labels pair each value with its context, such as a date or place, without repeating the overview. They use actual values and avoid interpretive words like rapidly, gradually or almost. They mention axes in the same order across the app, and visible tick text is hidden from assistive technology. https://developer.apple.com/design/human-interface-guidelines/charts
- Without Audio Graphs, give a chart an overview that names its type, what each axis measures and the axis bounds. https://developer.apple.com/design/human-interface-guidelines/charts
- Every custom interface icon and symbol needs an accessibility label. https://developer.apple.com/design/human-interface-guidelines/icons and https://developer.apple.com/design/human-interface-guidelines/sf-symbols

## 13. Numbers, dates and units

- Write dates and units in unambiguous forms: June 6 over 6/6, and 60 minutes or 60 meters over 60m. https://developer.apple.com/design/human-interface-guidelines/charts
- When a chart is short on space, move the unit into the title. https://developer.apple.com/design/human-interface-guidelines/charts
- Format numbers with a number formatter and never assume one presentation, because locale changes decimals, percentages and currency. https://developer.apple.com/design/human-interface-guidelines/text-fields and https://developer.apple.com/design/human-interface-guidelines/entering-data
- Support other regions' formats for date, time and money. https://developer.apple.com/design/human-interface-guidelines/inclusion
- Present a model's confidence in plain language, keep raw percentages for domains where people already read numbers, and hold back results below a confidence threshold. https://developer.apple.com/design/human-interface-guidelines/machine-learning
- An explanation of why something was surfaced states facts about behavior. It never claims to know what someone loves or feels. https://developer.apple.com/design/human-interface-guidelines/machine-learning
- Make clear which value a stepper changes, since the stepper shows no value itself. https://developer.apple.com/design/human-interface-guidelines/steppers

## 14. Inclusive language

- Drop unnecessary gender references. Apple rewrites a his-or-her sentence with a gender-neutral plural noun, which also localizes better. https://developer.apple.com/design/human-interface-guidelines/inclusion
- Write about disability people-first, learn how a person or community describes itself, and never use a disability as a metaphor for something bad. https://developer.apple.com/design/human-interface-guidelines/inclusion
- Avoid narrow definitions, such as a fixed shape of family, and identity questions that assume experiences many people never had. https://developer.apple.com/design/human-interface-guidelines/inclusion
- Plain language, no idioms and careful humor also belong here (section 1). https://developer.apple.com/design/human-interface-guidelines/inclusion

## 15. Where Apple disagrees with itself

- Button capitalization. The buttons page asks for title style on text buttons; the alerts page asks for sentence style on alert buttons. Pick one per element type and write it down.
- The word we. The writing page, updated 2025-12-16, says to avoid we entirely. The older inclusion page says to reserve we and our for the software or company. The newer page is the safer reading, and RULES.md does not ask for we anywhere, so avoid it.

---

## 16. Where RULES.md is stricter

- No em dashes anywhere. Apple's own pages use them, and nothing in the HIG forbids them. Use commas, periods or a spaced hyphen.
- Banned words. Several of Apple's pages use words from the banned list as ordinary verbs for moving through an app or trimming an interface. Write go to, open, move between or switch, and name the actual change.
- No runs of three built for rhythm. Write as many items as the content has.
- No antithesis. Apple's guidance compares this with that; the shipped string keeps only the affirmative clause.
- No reassurance and no welcome blurbs. State what is happening, or name what is missing and offer the one action.
- Errors stay plain and specific, with no personality and no blame.
- No middle-dot separators and at most one hedge. Apple says nothing on these.

Everything else above agrees with RULES.md: fewer words, plain words, specific errors, verb labels, numbers as they are, and progress text that names the real operation.

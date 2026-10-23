# Scene review rubric

You are reviewing short motion-design scenes with no knowledge of how they were made. Judge only what the images show and what the brief says.

Each scene is one contact sheet: 8 evenly spaced frames in reading order (left to right, top to bottom) from a single scene. Score each scene from 1 to 10.

Judge these five things:

1. Hierarchy. One thing is clearly first, then second. The eye knows where to start.
2. Space. Margins are deliberate, nothing floats without a reason, and the layout does not leave one half of the frame empty unless the empty half is doing work.
3. Brand fit. Type, color and marks match the brand pack named in the brief. No stock gradients, no centered all-caps slogans, no decoration that carries no information.
4. Motion across the 8 frames. The frames should show things arriving, settling and hand-off, not a static layout with one small change. Frames that look identical are a problem.
5. Legibility. Text is large enough to read at phone size, contrast is sufficient, and nothing overlaps by accident.

Two more image sets come with the brief, and they carry evidence the spread-out sheet cannot:

- Cut strips: 5 frames before and 5 after each cut. A clean cut hands one thing to the next (an element that leaves as another arrives, a shared position, a held color). A hard flash, a frame with two layouts overlapping, or a half-empty frame at the cut is a defect. Blame the scene that starts at the cut.
- Peak-motion strips: 10 consecutive frames at a scene's fastest moment. Look for motion that jumps (a gap between positions that is larger than the object), objects that pop in at full size, and text that moves too fast to read.

Color discipline: the one thing the viewer should follow gets the accent color, and each color keeps one meaning for the whole film. An accent used on three unrelated things, or a second accent that competes with the first, is a defect.

## Attention checks (reviewer only)

These are judged from the sheets and strips, the same as the five above. They are not a checklist for the person making the film: the film either holds attention or it does not, and no form the maker fills in can prove that.

6. Hook legibility in the first frames. The first thing on screen reads at a glance, at phone size, before anything else moves. If the opening needs a second look to parse, it has already lost the viewer.
7. One clear first read. Each scene has one thing to follow first. Two competing headlines, or a headline fighting a moving screenshot, is a defect even if both are legible on their own.
8. Change frequency. A film that never changes shot or state goes flat, and a film that changes every beat gives the eye nowhere to land. Flag any single unbroken shot that runs long with nothing new arriving: the mechanical score reports the longest shot and the longest static run, and a shot past about 10 seconds with no new information is a defect unless the shot itself is the point.
9. Caption readability at phone size. Captions must read on a phone held at arm's length: large enough, high enough contrast, and never colliding with the thing they describe. A caption that duplicates the headline word for word is fluff, not help.
10. Loop and rehook. Around 60 to 70 percent of the film, something fresh must arrive: a new question, a turn, a contrast. A film that only restates its opening for the second half has no reason to be watched to the end, and a film that ends without restating its point has no reason to be remembered.
11. Fluff. Frames that repeat information already given, with nothing new added, are a defect. Every scene must earn its beats with something the viewer did not already have.

Sound, judged from the brief's sound list against the sheets: one sound per visual event that matters, placed where the visual lands. A sound with no visual event behind it, or a visual event the film leans on arriving in silence, is a note. Sounds on every word or every frame are noise, not emphasis.

Score guide:

- 9 to 10: could ship as is.
- 8: good, small polish left.
- 6 to 7: clear weakness in one of the five.
- 4 to 5: several weaknesses.
- 1 to 3: broken.

Be specific. A note names the frame number and the defect ("frame 3: headline collides with the logo row"), not a mood. Give one concrete fix per note. If a scene is already good, say so in a few words and score it 8 or above. Do not invent problems to look thorough.

Reply with a single JSON object and nothing else. Keys are scene numbers as strings:

{"0": {"score": 9, "notes": "..."}, "1": {"score": 6, "notes": "frame 4: ..."}}

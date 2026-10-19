# Scene review rubric

You are reviewing short motion-design scenes with no knowledge of how they were made. Judge only what the images show and what the brief says.

Each scene is one contact sheet: 8 evenly spaced frames in reading order (left to right, top to bottom) from a single scene. Score each scene from 1 to 10.

Judge these five things:

1. Hierarchy. One thing is clearly first, then second. The eye knows where to start.
2. Space. Margins are deliberate, nothing floats without a reason, and the layout does not leave one half of the frame empty unless the empty half is doing work.
3. Brand fit. Type, color and marks match the brand pack named in the brief. No stock gradients, no centered all-caps slogans, no decoration that carries no information.
4. Motion across the 8 frames. The frames should show things arriving, settling and hand-off, not a static layout with one small change. Frames that look identical are a problem.
5. Legibility. Text is large enough to read at phone size, contrast is sufficient, and nothing overlaps by accident.

Score guide:

- 9 to 10: could ship as is.
- 8: good, small polish left.
- 6 to 7: clear weakness in one of the five.
- 4 to 5: several weaknesses.
- 1 to 3: broken.

Be specific. A note names the frame number and the defect ("frame 3: headline collides with the logo row"), not a mood. Give one concrete fix per note. If a scene is already good, say so in a few words and score it 8 or above. Do not invent problems to look thorough.

Reply with a single JSON object and nothing else. Keys are scene numbers as strings:

{"0": {"score": 9, "notes": "..."}, "1": {"score": 6, "notes": "frame 4: ..."}}

# Stageshow pass

`scripts/stageshow_pass.py` runs a whole site through Stageshow's playground and its film gate. The site describes itself in a `stageshow.json`. Nothing in the site changes: the stage marker is added only to pages fetched with `?stageshow=`, and only by this server.

```bash
python3 ~/studio/scripts/stageshow_pass.py serve --config stageshow.json   # the site on http://127.0.0.1:4817
python3 ~/studio/scripts/stageshow_pass.py link  --config stageshow.json   # its pages, scenes and stills as playground examples
python3 ~/studio/scripts/stageshow_pass.py gate  --config stageshow.json --out /tmp/pass
```

`gate` serves the site itself unless `--port` names a server already running. For every width it films each figure the project names with `film.mjs --gate`. At the first width it also films each moving figure's states and each scene's reduced-motion still. A film that gets no answer beside another Chrome is filmed again alone. It ends with one line per film and the count of gates not passed, and exits 1 when any did not pass.

`link` writes `examples/<prefix>-*/` into `skills/stageshow` and adds that pattern to this repository's `.git/info/exclude`, so a private site's examples never enter studio's history. Run `npm run dev` in `skills/stageshow` beside `serve` to see them.

## stageshow.json

```json
{
  "root": "site",
  "prefix": "mysite",
  "widths": [1440, 820, 390],
  "picks": "figure, #panel",
  "pages": {"home": "/", "about": "/about"},
  "films": {"home": [["hero", "#hero", "film"], ["team", "#team figure", "still"]]},
  "scenes": {
    "dir": "scenes",
    "names": ["hero", "search"],
    "cuts": {"search": "270,210,520,520"},
    "phone": {"search": "600x460"},
    "hash": "",
    "column": {"page": "/", "figure": "figure.scene", "key": "scene", "inner": ".scene-stage", "default": "hero"}
  },
  "stills": "shots",
  "background": "#FFFFFF"
}
```

- `root` is the folder served, beside this file.
- `picks` is what a page marks as stages when it has no films of its own.
- `films` lists, per page, each part as name, selector and `film` or `still`. A page with none is filmed as its `main`, still.
- `scenes` are pages that play over time. `cuts` crop a scene the way the page shows it, as top, bottom, left and right. `phone` lays a scene out for a phone at widths of 600 and under. `hash` is added to every scene's `#format=…`, and `--hash` on the command line adds more.
- `column` measures the width a page draws each scene at, from `figure`'s `data-<key>`, so the gate films a scene at the size a visitor sees. A scene the page does not show takes `default`'s width.
- `stills` is a folder whose images `link` lays out in one example.

## What a scene provides

A scene is filmed through its own clock. It sets `window.__seek(seconds)` and `window.__poster`, the second it rests on, and may set `__start`, `__reset`, `__dur`, `__format` (`{name, w, h}`) and a `T` object of named beats, which the stage reports as `data-mark`. Studio's video engine seeks by frame, so a film from it is passed through its own `film.mjs`, not as a scene here.

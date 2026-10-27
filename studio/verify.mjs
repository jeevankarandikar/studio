// Measures a finished render and writes out/<tag>/manifest.json: what went in, what came out, which checks were
// measured and which were not. A report that says "checked" must be able to show the number.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from './project.mjs';

const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });

function probe(mp4) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate', '-show_entries', 'format=duration', '-of', 'json', mp4]);
  if (r.status !== 0) throw new Error(`ffprobe failed: ${r.stderr.split('\n')[0]}`);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  const [n, d] = (v?.r_frame_rate ?? '0/1').split('/').map(Number);
  return { duration: Number(j.format.duration), width: v?.width, height: v?.height, fps: d ? n / d : 0, hasAudio: !!a, videoCodec: v?.codec_name, audioCodec: a?.codec_name };
}

// Integrated loudness (LUFS) and true peak (dBFS) from EBU R128.
function loudness(mp4) {
  const r = run('ffmpeg', ['-nostats', '-hide_banner', '-i', mp4, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  // ebur128 prints "-inf" for silence; that must read as a very low number, not as "not found".
  const all = (re) => [...r.stderr.matchAll(re)].map((m) => (/inf/i.test(m[1]) ? -Infinity : Number(m[1])));
  const I = all(/\bI:\s+(-?inf|-?[\d.]+) LUFS/gi).pop();
  const TP = all(/\bPeak:\s+(-?inf|-?[\d.]+) dBFS/gi).pop();
  return { lufs: I ?? null, truePeakDb: TP ?? null };
}

// Mean luma (0-255) of the first frame, and of the last frame that actually decodes.
function lumaFirst(mp4) {
  const r = run('ffmpeg', ['-nostats', '-hide_banner', '-i', mp4, '-frames:v', '1', '-vf', 'signalstats,metadata=print:file=-', '-f', 'null', '-']);
  const m = r.stdout.match(/YAVG=([\d.]+)/);
  return m ? Number(m[1]) : null;
}
function lumaLast(mp4) {
  // Decode the final half second and take the last frame reported, so a truncated file shows up.
  const r = run('ffmpeg', ['-nostats', '-hide_banner', '-sseof', '-0.5', '-i', mp4, '-vf', 'signalstats,metadata=print:file=-', '-f', 'null', '-']);
  const all = [...r.stdout.matchAll(/YAVG=([\d.]+)/g)];
  return all.length ? { luma: Number(all[all.length - 1][1]), frames: all.length } : null;
}

function hashTree(dir, filter) {
  const out = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).sort()) if (filter(f)) out[f] = sha(readFileSync(join(dir, f)));
  return out;
}

export function verify(project, { sfxPlaced = [], hasReview = false } = {}) {
  const mp4 = join(project.out, `${project.tag}.mp4`);
  const p = probe(mp4);
  const l = loudness(mp4);
  const first = lumaFirst(mp4);
  const last = lumaLast(mp4);

  const checks = [];
  const couldNot = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });
  add('duration matches the beat grid', Math.abs(p.duration - project.seconds) < 0.1, `${p.duration.toFixed(2)}s, expected ${project.seconds.toFixed(2)}s`);
  add('size and frame rate', p.width === project.width && p.height === project.height && Math.abs(p.fps - project.fps) < 0.01, `${p.width}x${p.height} at ${p.fps}`);
  add('has an audio track', p.hasAudio, p.audioCodec ?? 'none');
  if (l.lufs !== null) add('loudness within 2 of -16 LUFS', Number.isFinite(l.lufs) && Math.abs(l.lufs + 16) <= 2, `${l.lufs} LUFS`);
  else couldNot.push('integrated loudness (ffmpeg printed no reading)');
  // loudnorm is set to a -1.5 dB ceiling; 0.1 dB of room is left for the AAC encoder
  if (l.truePeakDb !== null) add('true peak at or under -1.5 dBFS', l.truePeakDb <= -1.4, `${l.truePeakDb} dBFS`);
  else couldNot.push('true peak (ffmpeg printed no reading)');
  if (first !== null) add('first frame is not black', first > 8, `mean luma ${first}`);
  else couldNot.push('first frame brightness');
  if (last !== null) {
    const wanted = Math.round(0.5 * project.fps) - 2;
    add('final half second decodes to the end', last.frames >= wanted, `${last.frames} frames decoded, expected about ${Math.round(0.5 * project.fps)}; last frame mean luma ${last.luma}`);
  } else couldNot.push('final half second (nothing decoded)');

  const ff = run('ffmpeg', ['-version']).stdout.split('\n')[0];
  let browser = null;
  try { browser = JSON.parse(readFileSync(join(project.framesDir, 'browser.json'), 'utf8')).browser; } catch { /* not recorded */ }
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const brandDir = join(project.dir, 'brand');

  const manifest = {
    tool: { name: pkg.name, version: pkg.version, node: process.version, ffmpeg: ff, browser },
    project: project.name,
    format: project.format,
    size: [project.width, project.height],
    fps: project.fps, bpm: project.bpm, seconds: project.seconds,
    inputs: {
      projectJson: sha(readFileSync(join(project.dir, 'project.json'))),
      scenes: Object.fromEntries(project.scenes.map((s) => [relative(project.dir, s.file), sha(readFileSync(s.file))])),
      brand: {
        colors: existsSync(join(brandDir, 'colors.json')) ? sha(readFileSync(join(brandDir, 'colors.json'))) : null,
        fonts: hashTree(join(brandDir, 'fonts'), (f) => /\.(woff2?|ttf|otf)$/i.test(f)),
        shots: hashTree(join(brandDir, 'shots'), (f) => /\.(png|jpe?g)$/i.test(f)),
        refs: hashTree(join(brandDir, 'refs'), (f) => /\.(png|jpe?g)$/i.test(f)),
      },
    },
    audio: {
      source: 'synthesized: score, sound effects and any voiceover are generated or supplied by the project; no stock audio',
      voiceover: project.voiceover ? 'supplied by the project' : null,
      sfx: sfxPlaced,
    },
    output: { file: relative(project.dir, mp4), bytes: existsSync(mp4) ? readFileSync(mp4).length : 0, ...p, loudness: l, firstFrameLuma: first, lastFrameLuma: last?.luma ?? null },
    measured: checks,
    notMeasured: [
      ...couldNot.map((c) => `${c}: could not be measured`),
      'whether the motion looks good (the mechanical score counts dead frames, density, beat alignment and lint only)',
      'whether sound effects line up with what the viewer sees (events are placed from scene constants, not detected in the audio)',
      ...(hasReview ? [] : ['visual review by a fresh reviewer (not run for this render)']),
    ],
    at: new Date().toISOString(),
  };
  writeFileSync(join(project.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

// A review counts only when the reviewer has scored every scene of the current render.
export function hasFullReview(project) {
  const f = join(project.out, 'review.json');
  if (!existsSync(f)) return false;
  try {
    const r = JSON.parse(readFileSync(f, 'utf8'));
    return project.scenes.every((s) => typeof r[s.index]?.score === 'number');
  } catch { return false; }
}

export function summary(m) {
  const lines = [];
  for (const c of m.measured) lines.push(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}: ${c.detail}`);
  for (const n of m.notMeasured) lines.push(`not measured: ${n}`);
  return lines.join('\n');
}

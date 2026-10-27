import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

function ff(args) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed');
}

// Frames plus the score into an MP4. A voiceover, when the project has one, is mixed over a ducked score.
export function stitch(project, wav) {
  mkdirSync(project.out, { recursive: true });
  const out = join(project.out, `${project.tag}.mp4`);
  const vo = project.voiceover && existsSync(project.voiceover) ? project.voiceover : null;
  // Final loudness is levelled to -16 LUFS with a -1.5 dB true-peak ceiling (the usual level for web video).
  const LEVEL = 'loudnorm=I=-16:TP=-1.5:LRA=11';
  const audio = vo
    ? ['-i', wav, '-i', vo, '-filter_complex', `[1:a]volume=0.35[m];[2:a]volume=1.0[v];[m][v]amix=inputs=2:duration=first:normalize=0,${LEVEL}[a]`, '-map', '0:v', '-map', '[a]']
    : ['-i', wav, '-af', LEVEL];
  ff([
    '-framerate', String(project.fps), '-start_number', '1', '-i', join(project.framesDir, '%05d.png'),
    ...audio,
    '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out,
  ]);
  return out;
}

// Web and app delivery: a small MP4, a WebM, a poster frame and a looping GIF.
export function exportWeb(project, src, { gifWidth = 720, gifFps = 15 } = {}) {
  const dir = join(project.out, 'web');
  mkdirSync(dir, { recursive: true });
  const base = join(dir, project.tag);
  ff(['-i', src, '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', `${base}.mp4`]);
  ff(['-i', src, '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1', '-c:a', 'libopus', '-b:a', '96k', `${base}.webm`]);
  ff(['-i', src, '-vf', 'select=eq(n\\,15)', '-frames:v', '1', '-q:v', '3', `${base}-poster.jpg`]);
  const vf = `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos`;
  ff(['-i', src, '-an', '-vf', `${vf},split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, `${base}.gif`]);
  return dir;
}

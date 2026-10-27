// studio doctor: finds out why a render will not work before a render fails halfway.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './project.mjs';
import { launch } from './capture.mjs';

const ok = (m) => console.log(`ok    ${m}`);
const bad = (m, fix) => { console.log(`FAIL  ${m}${fix ? `\n      fix: ${fix}` : ''}`); process.exitCode = 1; };

export async function doctor() {
  const major = Number(process.versions.node.split('.')[0]);
  major >= 22 ? ok(`node ${process.versions.node}`) : bad(`node ${process.versions.node} (need 22 or newer)`, 'nvm install 22');

  const v = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  if (v.status !== 0) bad('ffmpeg not found', 'brew install ffmpeg');
  else {
    const enc = v.stdout;
    for (const e of ['libx264', 'aac', 'libvpx-vp9', 'libopus']) enc.includes(e) ? ok(`ffmpeg encoder ${e}`) : bad(`ffmpeg lacks ${e}`, 'brew reinstall ffmpeg');
  }

  existsSync(join(ROOT, 'node_modules/playwright')) ? ok('playwright installed') : bad('playwright missing', 'npm install');

  const bundled = join(ROOT, 'node_modules/playwright-core/.local-browsers');
  if (process.env.PLAYWRIGHT_BROWSERS_PATH !== '0') console.log('note  PLAYWRIGHT_BROWSERS_PATH is not 0; the bundled browser is looked for in the global cache, not in node_modules');
  existsSync(bundled) ? ok('bundled browser present') : console.log('note  no bundled browser; will use Chrome if it can start (npx playwright install chromium-headless-shell)');

  try {
    const b = await launch();
    const page = await b.newPage();
    await page.setContent('<p>ok</p>');
    await page.screenshot({ type: 'png' });
    await b.close();
    ok('browser starts and takes a screenshot');
  } catch (e) {
    const msg = String(e.cause?.message ?? e.message);
    if (/bootstrap_check_in|Permission denied \(1100\)|MachPortRendezvous|crashpad/i.test(msg)) {
      bad('browser blocked by the macOS sandbox (Mach services denied)',
        'run renders in a normal terminal, or add "sandbox": {"excludedCommands": ["node studio/cli.mjs", "node studio/critique/loop.mjs"]} to ~/.claude/settings.json');
    } else if (/Executable doesn't exist/i.test(msg)) {
      bad('no browser installed', 'PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium-headless-shell');
    } else bad(`browser failed to start: ${msg.split('\n')[0]}`);
  }
}

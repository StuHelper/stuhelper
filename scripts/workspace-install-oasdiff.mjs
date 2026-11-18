import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readYaml, root } from './architecture.mjs';

const { version, sha256 } = readYaml(path.join(root, 'architecture/toolchains.yaml')).oasdiff;
const platform = { 'linux-x64': 'linux_amd64', 'linux-arm64': 'linux_arm64',
  'darwin-x64': 'darwin_all', 'darwin-arm64': 'darwin_all' }[`${process.platform}-${process.arch}`];
if (!platform || !sha256[platform]) throw new Error('No pinned oasdiff archive for this platform');
const archive = `oasdiff_${version}_${platform}.tar.gz`;
const destination = path.join(root, '.tools/bin');
fs.mkdirSync(destination, { recursive: true });
const temp = fs.mkdtempSync(path.join(destination, 'install-'));
try {
  const file = path.join(temp, archive);
  execFileSync('curl', ['--fail', '--location', '--silent', '--show-error', '--max-time', '120',
    '--output', file, `https://github.com/oasdiff/oasdiff/releases/download/v${version}/${archive}`],
    { stdio: 'inherit', timeout: 125_000 });
  const digest = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (digest !== sha256[platform]) throw new Error(`Checksum mismatch: ${archive}`);
  execFileSync('tar', ['-xzf', file, '-C', temp, 'oasdiff'], { timeout: 30_000 });
  fs.renameSync(path.join(temp, 'oasdiff'), path.join(destination, 'oasdiff'));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

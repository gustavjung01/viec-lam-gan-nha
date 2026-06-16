import { execFileSync } from 'node:child_process';

const frontendRelevantPatterns = [
  /^src\//,
  /^public\//,
  /^index\.html$/,
  /^package(-lock)?\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^bun\.lockb?$/,
  /^vite\.config\.[cm]?[jt]s$/,
  /^tsconfig(?:\.[^/]+)?\.json$/,
  /^tailwind\.config\.[cm]?[jt]s$/,
  /^postcss\.config\.[cm]?[jt]s$/,
  /^vercel\.json$/,
  /^scripts\/(verify-frontend-env|generate-build-info|vercel-ignore-build)\.mjs$/,
];

function getChangedFiles() {
  try {
    const output = execFileSync('git', ['diff', '--name-only', 'HEAD^', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return output
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    console.log('[vercel-ignore] Could not compare with the previous commit. Continuing build.');
    process.exit(1);
  }
}

const changedFiles = getChangedFiles();
const frontendRelevantFiles = changedFiles.filter((file) =>
  frontendRelevantPatterns.some((pattern) => pattern.test(file)),
);

if (frontendRelevantFiles.length === 0) {
  console.log('[vercel-ignore] No frontend-relevant changes detected. Skipping Vercel build.');
  if (changedFiles.length > 0) {
    console.log(`[vercel-ignore] Changed files: ${changedFiles.join(', ')}`);
  }
  process.exit(0);
}

console.log('[vercel-ignore] Frontend-relevant changes detected. Continuing Vercel build.');
console.log(`[vercel-ignore] Relevant files: ${frontendRelevantFiles.join(', ')}`);
process.exit(1);

/*
  Quick scan for potential encoding issues and replacement characters in text files.
  Usage: node scripts/check-encoding.js
*/
const fs = require('fs');
const path = require('path');

const roots = [
  'src',
  'extension',
  'dev',
  'build',
  'injected'
].filter((p) => fs.existsSync(p));

const textExts = new Set(['.js', '.ts', '.json', '.html', '.css', '.md']);
const suspicious = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (textExts.has(ext)) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('\uFFFD') || content.includes('�')) {
            suspicious.push(full);
          }
        } catch {}
      }
    }
  }
}

for (const root of roots) walk(root);

if (suspicious.length) {
  console.log('Found files with potential encoding issues (replacement character):');
  suspicious.forEach((f) => console.log(' -', f));
  process.exitCode = 1;
} else {
  console.log('No obvious encoding issues found.');
}


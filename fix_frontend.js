const fs = require('fs');
const path = require('path');

const rootDir = 'c:/developments/PRINTING_STORE/apps/web/src';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir(rootDir, (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    if (filePath.includes('\\api\\') || filePath.includes('/api/')) return; // Skip API routes for now

    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    const patterns = [
      /const ([a-zA-Z0-9_]+) = await res\.json\(\)/g,
      /const ([a-zA-Z0-9_]+) = await request\.json\(\)/g
    ];

    patterns.forEach(regex => {
      content = content.replace(regex, (match, p1) => {
        changed = true;
        return `const ${p1} = await ${match.includes('res') ? 'res' : 'request'}.json() as any`;
      });
    });

    if (content.match(/\.then\(\s*([a-zA-Z0-9_]+)\s*=>\s*\{/)) {
        content = content.replace(/\.then\(\s*([a-zA-Z0-9_]+)\s*=>\s*\{/g, ".then(($1: any) => {");
        changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log('Fixed UI types in:', filePath);
    }
  }
});

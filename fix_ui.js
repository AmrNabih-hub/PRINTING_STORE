const fs = require('fs');
const path = require('path');

const rootDir = 'c:/developments/PRINTING_STORE/apps/web/src';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) walkDir(dirPath, callback);
    else callback(dirPath);
  });
}

walkDir(rootDir, (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // We skip /api/ because those were fixed with Zod. We just want UI and __tests__
    if (!filePath.includes('\\api\\') && !filePath.includes('/api/')) {
        const patterns = [
            /const ([a-zA-Z0-9_]+) = await res\.json\(\);/g,
            /const ([a-zA-Z0-9_]+) = await request\.json\(\);/g,
            /const ([a-zA-Z0-9_]+) = await response\.json\(\);/g
        ];
        patterns.forEach(regex => {
            content = content.replace(regex, (match, p1) => {
                changed = true;
                return `const ${p1} = await ${match.split('await ')[1].split('.')[0]}.json() as any;`;
            });
        });
    }

    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log('Fixed UI/Test types in:', filePath);
    }
  }
});

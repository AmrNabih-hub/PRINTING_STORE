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
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Fix imports
    const wrongImports = [
      /'core-logic\/src\/schema'/g,
      /"core-logic\/src\/schema"/g,
      /'@printing-store\/core-logic'/g,
      /"@printing-store\/core-logic"/g,
      /'\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/packages\/core-logic\/src\/schema'/g
    ];

    wrongImports.forEach(regex => {
      if (regex.test(content)) {
        content = content.replace(regex, "'@printing-store/core-logic/src/schema'");
        changed = true;
      }
    });

    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log('Fixed imports in:', filePath);
    }
  }
});

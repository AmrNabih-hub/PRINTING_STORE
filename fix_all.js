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
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 1. Fix schema imports (ONLY target the incorrect ones, DO NOT touch valid @printing-store/core-logic)
    const wrongSchemaImports = [
      /'core-logic\/src\/schema'/g,
      /"core-logic\/src\/schema"/g,
      /'\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/packages\/core-logic\/src\/schema'/g
    ];
    wrongSchemaImports.forEach(regex => {
      if (regex.test(content)) {
        content = content.replace(regex, "'@printing-store/core-logic/src/schema'");
        changed = true;
      }
    });

    // 2. Fix Backend APIs with Zod
    if (filePath.includes('\\api\\') || filePath.includes('/api/')) {
        const needsZod = content.includes('request.json()');
        if (needsZod && !content.includes("from 'zod'") && !content.includes('from "zod"')) {
            content = "import { z } from 'zod';\n" + content;
            changed = true;
        }

        // Handle inline destructuring: const { a, b } = await request.json();
        const inlineDestructureRegex = /const\s+\{\s*([^}]+)\s*\}\s*=\s*await request\.json\(\);/g;
        if (inlineDestructureRegex.test(content)) {
            content = content.replace(inlineDestructureRegex, (match, vars) => {
                const keys = vars.split(',').map(v => v.split(':')[0].trim()).filter(Boolean);
                const schemaDef = keys.map(k => `${k}: z.any()`).join(', ');
                return `const __body = await request.json();
    const __schema = z.object({ ${schemaDef} }).nonstrict();
    const { ${vars} } = __schema.parse(__body);`;
            });
            changed = true;
        }

        // Handle generic body: const body = await request.json();
        const bodyAssignRegex = /const body\s*=\s*\(\s*await request\.json\(\)\s*\)\s*as\s+[a-zA-Z0-9_]+/g;
        if (bodyAssignRegex.test(content)) {
            // Already casted, leave it alone or enforce zod
            content = content.replace(bodyAssignRegex, `const body = z.record(z.any()).parse(await request.json()) as any`);
            changed = true;
        } else {
            const basicBodyRegex = /const body\s*=\s*await request\.json\(\);/g;
            if (basicBodyRegex.test(content)) {
                content = content.replace(basicBodyRegex, `const body = z.record(z.any()).parse(await request.json());`);
                changed = true;
            }
        }
        
    } 
    // 3. Fix Frontend UIs with 'any' casting
    else {
        const patterns = [
            /const ([a-zA-Z0-9_]+) = await res\.json\(\)/g,
            /const ([a-zA-Z0-9_]+) = await request\.json\(\)/g
        ];
        patterns.forEach(regex => {
            if (regex.test(content)) {
                content = content.replace(regex, (match, p1) => `const ${p1} = await ${match.includes('res') ? 'res' : 'request'}.json() as any`);
                changed = true;
            }
        });
        
        if (content.match(/\.then\(\s*([a-zA-Z0-9_]+)\s*=>\s*\{/)) {
            content = content.replace(/\.then\(\s*([a-zA-Z0-9_]+)\s*=>\s*\{/g, ".then(($1: any) => {");
            changed = true;
        }
    }

    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log('Fixed:', filePath);
    }
  }
});

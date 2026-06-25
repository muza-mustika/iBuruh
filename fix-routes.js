import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'dist', '_routes.json');

try {
  const routesContent = fs.readFileSync(routesPath, 'utf-8');
  const routes = JSON.parse(routesContent);
  
  // Remove global.css from exclude list
  if (routes.exclude && routes.exclude.includes('/global.css')) {
    routes.exclude = routes.exclude.filter(item => item !== '/global.css');
    fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
    console.log('✅ Fixed _routes.json: removed /global.css from exclude list');
  } else {
    console.log('ℹ️ No fix needed: /global.css not in exclude list');
  }
} catch (error) {
  console.error('❌ Error fixing _routes.json:', error);
  process.exit(1);
}
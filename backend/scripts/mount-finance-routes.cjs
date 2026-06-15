const fs = require('fs');
const path = require('path');

const serverPath = path.resolve(__dirname, '..', 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');
let changed = false;

const importLine = "import financeRoutes from './src/routes/finance.js';";
if (!content.includes(importLine)) {
  const anchor = "import matchingRoutes from './src/routes/matching.js';";
  if (!content.includes(anchor)) {
    throw new Error('Cannot find matchingRoutes import anchor in server.js');
  }
  content = content.replace(anchor, `${anchor}\n${importLine}`);
  changed = true;
}

const mountLine = "app.use('/api/finance', financeRoutes);";
if (!content.includes(mountLine)) {
  const anchor = "app.use('/api', matchingRoutes);";
  if (!content.includes(anchor)) {
    throw new Error('Cannot find matchingRoutes mount anchor in server.js');
  }
  content = content.replace(anchor, `${anchor}\n\n// Finance routes\n${mountLine}`);
  changed = true;
}

if (changed) {
  fs.writeFileSync(serverPath, content, 'utf8');
  console.log('Finance routes mounted in server.js');
} else {
  console.log('Finance routes already mounted in server.js');
}

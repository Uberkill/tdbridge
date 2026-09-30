const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (/\.(ts|js|html|css|py|json|md)$/.test(file)) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk('public').concat(walk('src')).concat(walk('examples')).concat(walk('core'));
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

console.log('=== EMOJIS FOUND ===');
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (emojiRegex.test(line)) {
      console.log(`${file}:${idx + 1}: ${line.trim()}`);
    }
  });
}

console.log('\n=== BUZZWORDS / AI CHEAP WORDS ===');
const buzzwordRegex = /\b(AI|ML|GPT|LLM|neural|smart|magic|bot)\b/i;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (buzzwordRegex.test(line)) {
      console.log(`${file}:${idx + 1}: ${line.trim()}`);
    }
  });
}

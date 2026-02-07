// Compile JS files to .jsc using Electron's Node.js version
// This ensures compatibility with Electron's V8 engine

const bytenode = require('bytenode');
const fs = require('fs');
const path = require('path');

const filesToCompile = [
  'applicationViewer.js',
  'udpRain.js',
  'httpRain.js',
  'telegram.js',
  'config.js'
];

filesToCompile.forEach(file => {
  try {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${file}`);
      return;
    }

    const code = fs.readFileSync(filePath, 'utf8');
    const compiled = bytenode.compileCode(code);
    const outputPath = filePath.replace('.js', '.jsc');
    
    fs.writeFileSync(outputPath, compiled);
    console.log(`✅ Compiled: ${file} -> ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`❌ Error compiling ${file}:`, error.message);
    process.exit(1);
  }
});

console.log('✅ All files compiled successfully!');

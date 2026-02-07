// Compile JS files to .jsc using Electron's Node.js version
// This ensures compatibility with Electron's V8 engine

// Patch for Node.js 12.x compatibility (Electron 10.4.7)
// bytenode 1.3.0+ requires Node.js 16+ features, but we're on Node.js 12.x
try {
  const Module = require('module');
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function(id) {
    if (id === 'node:assert/strict') {
      return require('assert');
    }
    if (id && id.startsWith('node:')) {
      // Try to load as regular module (remove node: prefix)
      const regularId = id.replace(/^node:/, '');
      try {
        return require(regularId);
      } catch (e) {
        // If regular module also fails, continue with original require
      }
    }
    return originalRequire.apply(this, arguments);
  };
} catch (e) {
  // Ignore polyfill errors
}

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

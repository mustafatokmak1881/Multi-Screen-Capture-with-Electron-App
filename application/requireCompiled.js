// Helper to load bytenode-compiled modules when available, otherwise fall back to .js
let hasBytenode = false;
let bytenodeError = null;

// Patch for Node.js 12.x compatibility (Electron 10.4.7)
// bytenode 1.3.0+ requires Node.js 16+ features, but we're on Node.js 12.x
// Polyfill node:assert/strict for older Node.js versions
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

try {
  // Register .jsc loader if bytenode is installed (production build)
  // This will throw in dev if bytenode is not installed; we silently ignore.
  // eslint-disable-next-line global-require
  require("bytenode");
  hasBytenode = true;
} catch (e) {
  hasBytenode = false;
  bytenodeError = e;
}

/**
 * Require a module, preferring the compiled .jsc variant when available.
 * Example:
 *   const { requireCompiled } = require("./requireCompiled");
 *   const viewer = requireCompiled("./applicationViewer");
 */
function requireCompiled(modulePath) {
  if (hasBytenode) {
    try {
      // Try compiled file first: ./file.jsc
      // eslint-disable-next-line global-require, import/no-dynamic-require
      return require(modulePath + ".jsc");
    } catch (e) {
      // If compiled file is missing, throw a clear error in production
      // In production build, .js files are excluded, so we must have .jsc
      throw new Error(
        `Cannot find compiled module: ${modulePath}.jsc\n` +
        `Original error: ${e.message}\n` +
        `Make sure you ran 'npm run build:bytenode' before building.`
      );
    }
  }

  // Fallback: normal JS require (only in development)
  // In production, bytenode MUST be available
  const isProduction = process.env.NODE_ENV === 'production' || !process.env.npm_lifecycle_event;
  
  if (isProduction) {
    throw new Error(
      `Cannot load module: ${modulePath}\n` +
      `Bytenode is not available in production build!\n` +
      `This means 'bytenode' package is missing from node_modules.\n` +
      `Bytenode error: ${bytenodeError ? bytenodeError.message : 'Unknown error'}\n` +
      `Please ensure 'bytenode' is in dependencies and included in build.`
    );
  }
  
  // Development fallback
  // eslint-disable-next-line global-require, import/no-dynamic-require
  try {
    return require(modulePath);
  } catch (e) {
    throw new Error(
      `Cannot find module: ${modulePath}\n` +
      `Bytenode is not available and JS fallback also failed.\n` +
      `Original error: ${e.message}\n` +
      `Bytenode error: ${bytenodeError ? bytenodeError.message : 'Unknown error'}`
    );
  }
}

module.exports = { requireCompiled };


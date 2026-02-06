// Helper to load bytenode-compiled modules when available, otherwise fall back to .js
let hasBytenode = false;

try {
  // Register .jsc loader if bytenode is installed (production build)
  // This will throw in dev if bytenode is not installed; we silently ignore.
  // eslint-disable-next-line global-require
  require("bytenode");
  hasBytenode = true;
} catch (e) {
  hasBytenode = false;
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
  // eslint-disable-next-line global-require, import/no-dynamic-require
  try {
    return require(modulePath);
  } catch (e) {
    throw new Error(
      `Cannot find module: ${modulePath}\n` +
      `Bytenode is not available and JS fallback also failed.\n` +
      `Original error: ${e.message}`
    );
  }
}

module.exports = { requireCompiled };


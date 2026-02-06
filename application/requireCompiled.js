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
      // If compiled file is missing or fails, fall back to plain JS below
    }
  }

  // Fallback: normal JS require
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(modulePath);
}

module.exports = { requireCompiled };


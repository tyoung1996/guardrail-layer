// resolve-ext.mjs
export async function resolve(specifier, context, nextResolve) {
    // If import has no extension, try adding .js
    if (!specifier.startsWith(".") || specifier.endsWith(".js")) {
      return nextResolve(specifier, context);
    }
  
    try {
      return await nextResolve(specifier + ".js", context);
    } catch {
      return nextResolve(specifier, context);
    }
  }
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cache = new Map();

// Execute the actual local dependency graph without requiring a Next.js server.
export function loadTypeScript(path) {
  const filename = resolve(root, path);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule);
  const require = createRequire(filename);
  const localRequire = (specifier) => {
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const target = specifier.startsWith("@/")
        ? resolve(root, "src", specifier.slice(2))
        : resolve(dirname(filename), specifier);
      return loadTypeScript(`${target}.ts`);
    }
    return require(specifier);
  };
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  new Function("require", "module", "exports", outputText)(
    localRequire,
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

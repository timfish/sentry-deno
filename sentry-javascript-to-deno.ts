import { ensureDir, walk } from 'https://deno.land/std@0.148.0/fs/mod.ts';
import {
  basename,
  dirname,
  join,
  relative,
} from 'https://deno.land/std@0.148.0/path/mod.ts';
import * as typescript from 'https://esm.sh/typescript@4.7.4';

async function denoify({
  sourceDir,
  destDir,
  importRewriteRules = [],
  codeReplace = [],
  ignoreFiles = [],
}: {
  sourceDir: string;
  destDir: string;
  ignoreFiles: RegExp[];
  codeReplace: {
    match: RegExp;
    replace: string;
  }[];
  importRewriteRules?: {
    match: RegExp;
    replace: string;
  }[];
}) {
  const sourceFilePathMap = new Map<string, string>();

  for await (const entry of walk(sourceDir, { includeDirs: false })) {
    const sourcePath = entry.path.replace(/\\/g, '/');

    if (ignoreFiles.some((re) => re.test(sourcePath))) {
      continue;
    }

    sourceFilePathMap.set(sourcePath, resolveDestPath(sourcePath));
  }

  for (const [sourcePath, destPath] of sourceFilePathMap) {
    compileFileForDeno(sourcePath, destPath);
  }

  async function compileFileForDeno(sourcePath: string, destPath: string) {
    const file = await Deno.readTextFile(sourcePath);
    await ensureDir(dirname(destPath));

    const parsedSource = typescript.createSourceFile(
      basename(sourcePath),
      file,
      typescript.ScriptTarget.Latest,
      false,
      typescript.ScriptKind.TS,
    );

    const rewrittenFile: string[] = [];
    let cursor = 0;

    // deno-lint-ignore no-explicit-any
    parsedSource.forEachChild((node: any) => {
      if (
        (node.kind === typescript.SyntaxKind.ImportDeclaration ||
          node.kind === typescript.SyntaxKind.ExportDeclaration) &&
        node.moduleSpecifier
      ) {
        const pos = node.moduleSpecifier.pos + 2;
        const end = node.moduleSpecifier.end - 1;

        rewrittenFile.push(file.slice(cursor, pos));
        cursor = end;

        const importPath = file.slice(pos, end);

        const resolvedImportPath = resolveImportPath(importPath, sourcePath);
        rewrittenFile.push(resolvedImportPath);
      }
    });
    rewrittenFile.push(file.slice(cursor));

    let code = '// deno-lint-ignore-file \n' + rewrittenFile.join('');

    for (const { match, replace } of codeReplace) {
      code = code.replace(match, replace);
    }

    await Deno.writeTextFile(destPath, code);
  }

  function resolveDestPath(sourcePath: string): string {
    return (
      join(destDir, sourcePath)
        // Move to the root of sentry-javascript-deno
        .replace(/sentry-javascript\/packages\//, '')
        .replace(/src\//, '')
        // Deno convention uses mod.ts rather than index
        .replace(/index\.ts$/, 'mod.ts')
    );
  }

  function resolveImportPath(importPath: string, sourcePath: string) {
    // First check importRewriteRules
    for (const rule of importRewriteRules) {
      if (rule.match.test(importPath)) {
        const path = relative(
          // This is awful
          dirname(dirname(dirname(dirname(sourcePath)))),
          rule.replace,
        );
        return importPath.replace(rule.match, path);
      }
    }

    // then resolve normally
    let resolvedPath = join(dirname(sourcePath), importPath);
    if (!sourceFilePathMap.has(resolvedPath)) {
      // If importPath doesn't exist, first try appending '.ts'
      resolvedPath = join(dirname(sourcePath), importPath + '.ts');

      if (!sourceFilePathMap.has(resolvedPath)) {
        // If that path doesn't exist, next try appending '/index.ts'
        resolvedPath = join(dirname(sourcePath), importPath + '/index.ts');

        if (!sourceFilePathMap.has(resolvedPath)) {
          throw new Error(
            `Cannot find imported file '${importPath}' in '${sourcePath}'`,
          );
        }
      }
    }

    const relImportPath = relative(
      dirname(sourceFilePathMap.get(sourcePath)!),
      sourceFilePathMap.get(resolvedPath)!,
    );

    return relImportPath.startsWith('../')
      ? relImportPath
      : './' + relImportPath;
  }
}

function denoifyFor(pkg: string) {
  denoify({
    sourceDir: `./sentry-javascript/packages/${pkg}/src`,
    destDir: './sentry-javascript-deno',
    ignoreFiles: [
      /buildPolyfills/,
      /\.js$/,
      /tracing\/src\/index/,
      /tracing\/src\/integrations/,
      /tracing\/src\/browser\/(?!request)/,
    ],
    importRewriteRules: [
      {
        match: /@sentry\/types/,
        replace: './types/mod.ts',
      },
      {
        match: /@sentry\/utils/,
        replace: './utils/mod.ts',
      },
      {
        match: /@sentry\/hub/,
        replace: './hub/mod.ts',
      },
      {
        match: /@sentry\/core/,
        replace: './core/mod.ts',
      },
      {
        match: /@sentry\/browser/,
        replace: './browser/mod.ts',
      },
    ],
    codeReplace: [
      // process and global cause deno to suggest importing node.js shims
      {
        match: /typeof process !== 'undefined' \? process : 0/,
        replace: 'undefined',
      },
      { match: /\? global/, replace: '? undefined' },
      {
        match: /typeof global !== 'undefined' && value === global/,
        replace: 'false',
      },
      // Replace __DEBUG_BUILD__ and the resulting mangled declaration
      { match: /__DEBUG_BUILD__/g, replace: 'true' },
      { match: /const true: boolean;/g, replace: '' },
      // Remove the empty export which is not valid in Deno
      { match: /export type {} from '\.\/globals\.ts';/g, replace: '' },
      // Make the global object 'any' to ignore errors for missing globals in
      // multiple places
      {
        match: /function getGlobalObject<T>\(\): T & SentryGlobal {/g,
        replace: 'function getGlobalObject<T>(): any {',
      },
      // These don't exist in Deno
      { match: / as Node/g, replace: '' },
      { match: /new XMLHttpRequest\(\)/g, replace: '{} as any' },
      { match: /Error.stackTraceLimit = 50;/g, replace: '' },
      { match: / as DOMError/g, replace: '' },
      { match: /\(module,/g, replace: '(undefined,' },
      { match: /WindowEventHandlers/g, replace: 'any' },
      { match: /History/g, replace: 'any' },
      { match: /HTMLElement/g, replace: 'any' },
      { match: /OnErrorEventHandler/g, replace: 'any' },
      { match: /this: Element/g, replace: 'this: any' },
      { match: / \| NodeJS.Global/g, replace: '' },
      { match: /this: XMLHttpRequest/g, replace: 'this: any' },
      { match: /XMLHttpRequest.prototype/g, replace: '{}' },
      { match: /extends XMLHttpRequest/g, replace: 'extends Window' },
      {
        match: /InstrumentedElement = Element &/g,
        replace: 'InstrumentedElement = any &',
      },
      {
        match:
          /typeof Element !== 'undefined' && isInstanceOf\(wat, Element\)/g,
        replace: 'false',
      },
      {
        match: /typeof document !== 'undefined' && value === document/g,
        replace: 'false',
      },
      // apply and call types to not appear to match in Deno 🤔
      {
        match: /originalRemoveEventListener: \(\) => void/,
        replace: 'originalRemoveEventListener: (...args: any[]) => void',
      },
      {
        match:
          /return _oldOnUnhandledRejectionHandler.apply\(this, arguments\);/g,
        replace:
          'return _oldOnUnhandledRejectionHandler.apply(this, arguments as any) as unknown as boolean;',
      },
      {
        match: /originalFunctionToString.apply\(context, args\);/g,
        replace: 'originalFunctionToString.apply(context, args) as any;',
      },
      { match: /args: any\[\]/g, replace: 'args: any' },
      {
        match: /([a-zA-Z]*?)\.apply\((.*?)\)\.then\(/g,
        replace: '($1.apply($2) as any).then(',
      },
      { match: /\.call\((.*?)\)/g, replace: '.call($1) as any' },
      { match: /options,\s*]\)/g, replace: 'options] as any) as any' },
      {
        match: /return original.apply\(this, args\);/g,
        replace: 'return original.apply(this, args) as any;',
      },
      { match: /global\.crypto/g, replace: '(global as any).crypto' },
      { match: /randomUUID\?\(\): string;/g, replace: '' },
    ],
  });
}

denoifyFor('types');
denoifyFor('utils');
denoifyFor('hub');
denoifyFor('core');
denoifyFor('browser');
denoifyFor('tracing');

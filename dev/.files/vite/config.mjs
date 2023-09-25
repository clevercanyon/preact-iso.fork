/**
 * Vite config file.
 *
 * Vite is not aware of this config file's location.
 *
 * @note PLEASE DO NOT EDIT THIS FILE!
 * @note This entire file will be updated automatically.
 * @note Instead of editing here, please review <https://github.com/clevercanyon/skeleton>.
 *
 * @see https://vitejs.dev/config/
 */

import path from 'node:path';
import { loadEnv } from 'vite';
import { $fs, $glob } from '../../../node_modules/@clevercanyon/utilities.node/dist/index.js';
import { $is, $json, $obj, $obp, $str, $time } from '../../../node_modules/@clevercanyon/utilities/dist/index.js';
import esVersion from '../bin/includes/es-version.mjs';
import extensions from '../bin/includes/extensions.mjs';
import importAliases from '../bin/includes/import-aliases.mjs';
import u from '../bin/includes/utilities.mjs';
import viteA16sDir from './includes/a16s/dir.mjs';
import viteC10nConfig from './includes/c10n/config.mjs';
import viteEJSConfig from './includes/ejs/config.mjs';
import viteESBuildConfig from './includes/esbuild/config.mjs';
import viteMDXConfig from './includes/mdx/config.mjs';
import viteMinifyConfig from './includes/minify/config.mjs';
import vitePkgUpdates from './includes/package/updates.mjs';
import viteRollupConfig from './includes/rollup/config.mjs';
import viteSSLConfig from './includes/ssl/config.mjs';
import viteVitestConfig from './includes/vitest/config.mjs';

/**
 * Defines Vite configuration.
 *
 * @param   vite Data passed in by Vite.
 *
 * @returns      Vite configuration object properties.
 *
 * @todo Implement Vite prefresh.
 */
export default async ({ mode, command, ssrBuild: isSSRBuild }) => {
    /**
     * Configures `NODE_ENV` environment variable.
     */
    process.env.NODE_ENV = // As detailed by Vite <https://o5p.me/DscTVM>.
		'dev' === mode ? 'development' // Enforce development mode.
		: 'production'; // prettier-ignore

    /**
     * Directory vars.
     */
    const __dirname = $fs.imuDirname(import.meta.url);
    const projDir = path.resolve(__dirname, '../../..');
    const srcDir = path.resolve(__dirname, '../../../src');
    const cargoDir = path.resolve(__dirname, '../../../src/cargo');
    const distDir = path.resolve(__dirname, '../../../dist');
    const envsDir = path.resolve(__dirname, '../../../dev/.envs');
    const logsDir = path.resolve(__dirname, '../../../dev/.logs');
    const a16sDir = await viteA16sDir({ isSSRBuild, distDir });

    /**
     * Properties of `./package.json` file.
     */
    const pkg = await u.pkg(); // Parses `./package.json`.

    /**
     * Environment-related vars.
     */
    let appEnvPrefixes = ['APP_']; // Part of app.
    if (isSSRBuild) appEnvPrefixes.push('SSR_APP_');

    const env = loadEnv(mode, envsDir, appEnvPrefixes);

    const staticDefs = {
        ['$$__' + appEnvPrefixes[0] + 'PKG_NAME__$$']: pkg.name || '',
        ['$$__' + appEnvPrefixes[0] + 'PKG_VERSION__$$']: pkg.version || '',
        ['$$__' + appEnvPrefixes[0] + 'PKG_REPOSITORY__$$']: pkg.repository || '',
        ['$$__' + appEnvPrefixes[0] + 'PKG_HOMEPAGE__$$']: pkg.homepage || '',
        ['$$__' + appEnvPrefixes[0] + 'PKG_BUGS__$$']: pkg.bugs || '',
        ['$$__' + appEnvPrefixes[0] + 'BUILD_TIME_YMD__$$']: $time.parse('now').toSQLDate() || '',
    };
    Object.keys(env) // Add string env vars to static defines.
        .filter((key) => new RegExp('^(?:' + appEnvPrefixes.map((v) => $str.escRegExp(v)).join('|') + ')', 'u').test(key))
        .filter((key) => $is.string($str.parseValue(env[key])) /* Only those which are truly string values. */)
        .forEach((key) => (staticDefs['$$__' + key + '__$$'] = env[key]));

    /**
     * App type, target, path, and related vars.
     */
    const appBaseURL = env.APP_BASE_URL || ''; // e.g., `https://example.com/base`.
    const appBasePath = env.APP_BASE_PATH || ''; // e.g., `/base`.

    const appType = $obp.get(pkg, 'config.c10n.&.' + (isSSRBuild ? 'ssrBuild' : 'build') + '.appType') || 'cma';
    const targetEnv = $obp.get(pkg, 'config.c10n.&.' + (isSSRBuild ? 'ssrBuild' : 'build') + '.targetEnv') || 'any';
    const entryFiles = $obp.get(pkg, 'config.c10n.&.' + (isSSRBuild ? 'ssrBuild' : 'build') + '.entryFiles') || [];
    const sideEffects = $obp.get(pkg, 'config.c10n.&.' + (isSSRBuild ? 'ssrBuild' : 'build') + '.sideEffects') || [];

    const appDefaultEntryFiles = // Based on app type.
        ['spa'].includes(appType) ? ['./src/index.' + extensions.asBracedGlob([...extensions.trueHTML])]
        : ['mpa'].includes(appType) ? ['./src/**/index.' + extensions.asBracedGlob([...extensions.trueHTML])]
        : ['./src/*.' + extensions.asBracedGlob([...extensions.sTypeScript, ...extensions.sTypeScriptReact])]; // prettier-ignore

    const appEntryFiles = (entryFiles.length ? entryFiles : appDefaultEntryFiles).map((v) => $str.lTrim(v, './'));
    const appEntries = appEntryFiles.length ? await $glob.promise(appEntryFiles, { cwd: projDir }) : [];

    const appEntriesAsProjRelPaths = appEntries.map((absPath) => './' + path.relative(projDir, absPath));
    const appEntriesAsSrcSubpaths = appEntries.map((absPath) => path.relative(srcDir, absPath));
    const appEntriesAsSrcSubpathsNoExt = appEntriesAsSrcSubpaths.map((subpath) => subpath.replace(/\.[^.]+$/u, ''));

    /**
     * Other misc. configuration properties.
     */
    const useLibMode = ['cma', 'lib'].includes(appType);
    const peerDepKeys = Object.keys(pkg.peerDependencies || {});
    const targetEnvIsServer = ['cfw', 'node'].includes(targetEnv);
    const useMinifier = 'dev' !== mode && !['lib'].includes(appType);
    const preserveModules = ['lib'].includes(appType); // Always preserve lib modules.
    const vitestSandboxEnable = $str.parseValue(String(process.env.VITEST_SANDBOX_ENABLE || ''));
    const vitestExamplesEnable = $str.parseValue(String(process.env.VITEST_EXAMPLES_ENABLE || ''));

    /**
     * Validates all of the above.
     */
    if (!pkg.name) {
        throw new Error('Apps must have a name.');
    }
    if (!appEntryFiles.length || !appEntries.length) {
        throw new Error('Apps must have at least one entry point.');
    }
    if (isSSRBuild && !targetEnvIsServer) {
        throw new Error('SSR builds must target an SSR environment.');
    }
    if (!['dev', 'ci', 'stage', 'prod'].includes(mode)) {
        throw new Error('Required `mode` is missing or invalid. Expecting `dev|ci|stage|prod`.');
    }
    if (!['spa', 'mpa', 'cma', 'lib'].includes(appType)) {
        throw new Error('Must have a valid `config.c10n.&.build.appType` in `package.json`.');
    }
    if (['spa', 'mpa'].includes(appType) && !appBaseURL) {
        throw new Error('Must have a valid `APP_BASE_URL` environment variable.');
    }
    if (!['any', 'node', 'cfw', 'cfp', 'web', 'webw'].includes(targetEnv)) {
        throw new Error('Must have a valid `config.c10n.&.build.targetEnv` in `package.json`.');
    }

    /**
     * Prepares `package.json` property updates.
     */
    const pkgUpdates = await vitePkgUpdates({
        command, isSSRBuild, projDir, srcDir, distDir, pkg, appType, targetEnv, sideEffects,
        appEntriesAsProjRelPaths, appEntriesAsSrcSubpaths, appEntriesAsSrcSubpathsNoExt
    }); // prettier-ignore

    /**
     * Configures plugins for Vite.
     */
    const plugins = [
        await viteSSLConfig(),
        await viteMDXConfig({ projDir }),
        await viteEJSConfig({ mode, projDir, srcDir, pkg, env }),
        await viteMinifyConfig({ mode }),
        await viteC10nConfig({
            mode, command, isSSRBuild, projDir, distDir,
            pkg, env, appType, targetEnv, staticDefs, pkgUpdates
        }), // prettier-ignore
    ];

    /**
     * Configures esbuild for Vite.
     */
    const esbuildConfig = await viteESBuildConfig({}); // No props at this time.

    /**
     * Configures rollup for Vite.
     */
    const rollupConfig = await viteRollupConfig({ srcDir, distDir, a16sDir, appEntries, sideEffects, useLibMode, peerDepKeys, preserveModules, useMinifier });

    /**
     * Configures tests for Vite.
     */
    const vitestConfig = await viteVitestConfig({ projDir, srcDir, logsDir, targetEnv, vitestSandboxEnable, vitestExamplesEnable, rollupConfig });

    /**
     * Configures imported workers.
     */
    const importedWorkerPlugins = []; // No worker plugins at this time.
    const importedWorkerRollupConfig = { ...$obj.omit(rollupConfig, ['input']) };

    /**
     * Base config for Vite.
     *
     * @see https://vitejs.dev/config/
     */
    const baseConfig = {
        c10n: { pkg, pkgUpdates },
        define: $obj.map(staticDefs, (v) => $json.stringify(v)),

        root: srcDir, // Absolute path where entry indexes live.
        publicDir: isSSRBuild ? false : path.relative(srcDir, cargoDir), // Relative to `root`.
        base: appBasePath + '/', // Analagous to `<base href="/">`; i.e., leading & trailing slash.

        envDir: path.relative(srcDir, envsDir), // Relative to `root` directory.
        envPrefix: appEnvPrefixes, // Env vars w/ these prefixes become part of the app.

        appType: ['spa', 'mpa'].includes(appType) ? appType : 'custom',
        plugins, // Additional Vite plugins; i.e., already configured above.

        ...(targetEnvIsServer // Target environment is server-side?
            ? {
                  ssr: {
                      target: ['cfw'].includes(targetEnv) ? 'webworker' : 'node',
                      ...(['cfw'].includes(targetEnv) ? { noExternal: true } : {}),
                  },
              }
            : {}),
        server: {
            open: false, // Do not open dev server.
            https: true, // Enable basic https in dev server.
        },
        resolve: {
            alias: importAliases.asFindReplaceRegExps,
            extensions: [...extensions.onImportWithNoExtensionTry],
        },
        worker: /* <https://vitejs.dev/guide/features.html#web-workers> */ {
            format: 'es',
            plugins: importedWorkerPlugins,
            rollupOptions: importedWorkerRollupConfig,
        },
        test: vitestConfig, // Vitest configuration.

        esbuild: esbuildConfig, // esBuild config options.
        build: /* <https://vitejs.dev/config/build-options.html> */ {
            target: esVersion.lcnYear, // Matches TypeScript config.

            emptyOutDir: isSSRBuild ? false : true, // Not during SSR builds.
            outDir: path.relative(srcDir, distDir), // Relative to `root` directory.

            assetsInlineLimit: 0, // Disable entirely. Use import `?raw`, `?url`, etc.
            assetsDir: path.relative(distDir, a16sDir), // Relative to `outDir` directory.
            // Note: `a16s` is a numeronym for 'acquired resources'; i.e. via imports.

            ssr: targetEnvIsServer, // Target environment is server-side?

            manifest: !isSSRBuild, // Enables creation of manifest (for assets).
            sourcemap: 'dev' === mode, // Enables creation of sourcemaps (for debugging).

            minify: useMinifier ? 'esbuild' : false, // Minify userland code?
            modulePreload: false, // Disable. DOM injections conflict with our SPAs.

            ...(useLibMode ? { lib: { entry: appEntries, formats: ['es'] } } : {}),
            rollupOptions: rollupConfig, // See: <https://o5p.me/5Vupql>.
        },
    };

    /**
     * Returns base config for Vite.
     */
    return baseConfig;
};

/**
 * ESLint config file.
 *
 * VS Code is aware of this config file's location.
 *
 * @note CUSTOM EDITS ONLY PLEASE!
 * @note In the future this file will be updated automatically.
 * @note Only `<custom:start.../custom:end>` will be preserved below.
 */

import baseConfig from './dev/.files/eslint/config.mjs';
import { $obj } from './node_modules/@clevercanyon/utilities/dist/index.js';

/*
 * Customizations.
 * <custom:start> */

import extensions from './dev/.files/bin/includes/extensions.mjs';

export default await (async () => {
    return $obj.mergeDeep({}, await baseConfig(), {
        $concat: {
            'config[0].ignores': [
                'index{,.d}.' + extensions.asBracedGlob([...extensions.allJavaScript, ...extensions.allTypeScript]), //
                '{lib,src,tests}/**/*.' + extensions.asBracedGlob([...extensions.allJavaScript, ...extensions.allTypeScript]),
            ],
        },
    }).config;
})();

/* </custom:end> */

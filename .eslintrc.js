/**
 * Copyright 2015-2016, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = {
    "env": {
        "browser": true,
        "es6": true
    },
    "extends": "google",
    "parserOptions": {
        "ecmaVersion": 2017,        
        "sourceType": "module"
    },
    "rules": {
        "max-len": [2, 100, {
            "ignoreComments": true,
            "ignoreUrls": true,
            "tabWidth": 2
        }],
        "no-implicit-coercion": [2, {
            "boolean": false,
            "number": true,
            "string": true
        }],
        "no-unused-expressions": [2, {
            "allowShortCircuit": true,
            "allowTernary": false
        }],
        "no-unused-vars": [2, {
            "vars": "all",
            "args": "after-used",
            "argsIgnorePattern": "(^reject$|^_$)",
            "varsIgnorePattern": "(^_$)"
        }],
        "quotes": [2, "single"],
        "require-jsdoc": 0,
        "comma-dangle": 0,
        "valid-jsdoc": 0,
        "arrow-parens": 0,
        "prefer-arrow-callback": 1,
        "no-var": 1
    }
};
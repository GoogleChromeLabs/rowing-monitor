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

/* eslint-env node */
/* eslint-no-console: 0 */
const gulp = require('gulp');
const serve = require('gulp-serve');
const swPrecache = require('sw-precache');
const path = require('path');
const htmlmin = require('gulp-htmlmin');
const rev = require('gulp-rev');
const revReplace = require('gulp-rev-replace');
const revdel = require('gulp-rev-delete-original');
const useref = require('gulp-useref');
const filter = require('gulp-filter');
const del = require('del');
const eslint = require('gulp-eslint');

gulp.task('default', () => {
  console.log('Default Task!');
});

gulp.task('generate-service-worker', callback => {
  const rootDir = 'dist';
  swPrecache.write(path.join(rootDir, 'service-worker.js'), {
    staticFileGlobs: [rootDir + '/**/*.{js,html,css,png,jpg,gif,svg,eot,ttf,woff}'],
    stripPrefix: rootDir
  }, callback);
});

gulp.task('clean', () => {
  return del('dist');
});

gulp.task('rollup', () => {
  const rollup = require('rollup');
  const babel = require('rollup-plugin-babel');
  const uglify = require('rollup-plugin-uglify');
  const nodeResolve = require('rollup-plugin-node-resolve');
  const commonsjs = require('rollup-plugin-commonjs');
  return rollup.rollup({
    entry: './src/js/app.js',
    format: 'iife',
    plugins: [
      nodeResolve(),
      commonsjs(),
      babel(),
      uglify()
    ]
  }).then(bundle => {
    bundle.write({
      sourceMap: true,
      // useStrict: false,
      format: 'iife',
      dest: 'dist/js/app.js'
    });
  });
});

gulp.task('minify', () => {
  return gulp.src('src/**/*.html')
      .pipe(htmlmin({
        removeComments: true,
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeAttributeQuotes: true,
        removeEmptyAttributes: true,
        minifyJS: true,
        minifyCSS: true
      }))
      .pipe(gulp.dest('dist'));
});

gulp.task('eslint', () => {
  return gulp.src(['src/**/*.js'])
      .pipe(eslint())
      .pipe(eslint.format());
});
/**
 * Creates file revisions
 */
gulp.task('rev', () => {
  const jsFilter = filter(['dist/js/*.js'], {restore: true});
  const indexFilter = filter(['dist/index.html'], {restore: true});
  return gulp.src(['dist/**/*.*'])
      .pipe(useref())
      .pipe(jsFilter)
      .pipe(rev())
      .pipe(revdel())
      .pipe(gulp.dest('dist'))
      .pipe(jsFilter.restore)
      .pipe(revReplace())
      .pipe(indexFilter)
      .pipe(gulp.dest('dist'));
});

gulp.task('static', () => {
  return gulp.src(['src/**/*.*', '!src/**/*.js', '!src/**/*.html'])
      .pipe(gulp.dest('dist'));
});

gulp.task('deploy', () => {

});

gulp.task('build', gulp.series('clean', 'rollup', 'static', 'minify', 'generate-service-worker'));
gulp.task('dist',
    gulp.series('clean', 'rollup', 'static', 'minify', 'rev', 'generate-service-worker'));

gulp.task('serve', serve('dist/'));
gulp.task('dev', gulp.series(['build', 'serve']));

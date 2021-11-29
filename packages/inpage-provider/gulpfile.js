const gulp = require('gulp');
const { execSync } = require('child_process');

function build(cb) {
  execSync('yarn build-inject');
  cb();
}

function watching(cb) {
  gulp.watch(['src/**/*.tsx', '!src/injected-autogen/**/*'], build);
  cb();
}
const watch = gulp.series(build, watching);

exports.default = build;
exports.build = build;
exports.watch = watch;

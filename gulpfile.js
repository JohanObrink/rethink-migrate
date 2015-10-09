var gulp = require('gulp'),
  jshint = require('gulp-jshint'),
  mocha = require('gulp-mocha');

var running = {};
var watching = {};

gulp.task('jshint', function () {
  running.jshint = ['gulpfile.js', 'lib/**/*.js', 'test/**/*.js'];
  return gulp.src(running.jshint)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('test', function () {
  running.test = ['test/**/*.spec.js', 'lib/**/*.js'];
  return gulp.src(running.test[0])
    .pipe(mocha({reporter: 'spec'}));
});

gulp.task('watch', function () {
  Object.keys(running).forEach(function (task) {
    if(!watching[task]) {
      watching[task] = true;
      gulp.watch(running[task], [task]);
    }
  });
});
'use strict';

var browserify =  require('browserify');
var mold       =  require('mold-source-map');
var path       =  require('path');

var root = path.join(__dirname, '..', 'client');

var build = module.exports = function () {
  return browserify()
    .require(require.resolve('../client/main.js'), { entry: true })
    .bundle({ debug: true })
    .pipe(mold.transformSourcesRelativeTo(root));
};

if (!module.parent) {
  var fs = require('fs');
  var bundle = path.join(root, '.bundle.js');

  build().pipe(fs.createWriteStream(bundle, 'utf8'));
}

'use strict';

// TODO: warn user if none exists?
module.exports =
     navigator.getUserMedia
  || navigator.mozGetUserMedia
  || navigator.webkitGetUserMedia
  || navigator.msGetUserMedia
  || navigator.oGetUserMedia;

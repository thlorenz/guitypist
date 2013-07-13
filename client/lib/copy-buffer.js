'use strict';

var go = module.exports = function (buffer) {
  var copy = [];
  for (var i = 0; i < buffer.length; copy[i] = buffer[i], i++);
  return copy;
};

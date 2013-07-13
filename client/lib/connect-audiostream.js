'use strict';

var audioContext = require('./audiocontext')
  , bufferFiller = require('./dsp-samplebuffer').bufferFiller
  , filters = require('./dsp-filters')
  , lp = filters.lp
  , hp = filters.hp;


/**
 *  Connects audio stream to buffer and inserts some filters.
 *
 * @name exports
 * @function
 * @param stream {Stream} provided by call to navigator.getUserMedia
 * @return void
 */
var go = module.exports = function (stream) {
  console.log('connecting audio stream');

  var src = audioContext.createMediaStreamSource(stream);

  src.connect(lp);
  lp.connect(hp);
  hp.connect(bufferFiller);
  bufferFiller.connect(audioContext.destination);
};

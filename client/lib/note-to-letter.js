'use strict';

var v    =  require('./note-to-letter-v')
  , vdgb =  require('./note-to-letter-v-dgb')
  , vii  =  require('./note-to-letter-vii');


module.exports = function (fret) {
  switch(fret) {
    case 'v'     :  return v;
    case 'v-dgb' :  return vdgb;
    case 'vii'   :  return vii;
  }
};

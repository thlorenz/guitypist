'use strict';

var buffer               =  require('./dsp-samplebuffer').buffer
  , gauss                =  require('./dsp-filters').gauss
  , copyBuffer           =  require('./copy-buffer')
  , fft                  =  require('./dsp-fft')
  , adjustNoiseThreshold =  require('./adjust-noise-threshold')
  , sortSpectrumPoints   =  require('./sort-spectrum-points')
  , getSortedPeaks       =  require('./get-sorted-peaks')
  , audioContext         =  require('./audiocontext')
  , getPitch             =  require('./get-pitch')
  ;

function downsample (buf) {
  var downsampled = [];
  for (var i = 0; i < buf.length; downsampled.push(buf[i]), i += 4);
  return downsampled;
}

function upsample (buf) {
  var upsampled = [];
  for (var i = 0; i < buf.length; i++) {
    // would concat perform better here?
    upsampled.push(buf[i]);
    upsampled.push(0);
    upsampled.push(0);
    upsampled.push(0);
  }

  return upsampled;
}

var go = module.exports = function (interval, onpitch, onnopitch) {

  var maxTime       =  0
    , maxPeaks      =  0
    , maxPeakCount  =  0
    , sampleRate    =  audioContext.sampleRate
    , fftSize       =  fft.size
    , rateSizeRatio =  sampleRate / fftSize
    , nopitch       =  0
    ;

  return function doprocess () {
    var buf = copyBuffer(buffer);
    gauss.process(buf);

    var downsampled = downsample(buf);
    var upsampled = upsample(downsampled);

    fft.forward(upsampled);

    var noiseThreshold =  adjustNoiseThreshold(fft.spectrum, interval)
      , spectrumPoints =  sortSpectrumPoints(fft.spectrum)
      , peaks          =  getSortedPeaks(spectrumPoints, noiseThreshold)
      ;

    if (peaks.length) {
      var peak = null;

      maxPeaks = Math.max(maxPeaks, peaks.length);
      if (maxPeaks > 0) maxPeakCount = 0;


      var fstFreq = peaks[0].x * rateSizeRatio;

      if (peaks.length > 1) {
        var sndFreq = peaks[1].x * rateSizeRatio;
        var fstsndRatio = fstFreq / sndFreq;
        if (1.4 < fstsndRatio && fstsndRatio < 1.6) peak = peaks[1];
      }

      if (peaks.length > 2) {
        var trdFreq = peaks[2].x * rateSizeRatio;
        var fsttrdRatio = fstFreq / trdFreq;
        if (1.4 < fsttrdRatio && fsttrdRatio < 1.6) peak = peaks[2];
      }

      if (peaks.length > 1 || maxPeaks === 1) {
        if (!peak) peak = peaks[0];

        var leftx = peak.x - 1
          , peakx = peak.x
          , rightx = peak.x + 1;

        var left = { x: leftx, y: Math.log(fft.spectrum[leftx]) };

        // TODO: re-using peak here in an ugly manner, check if that can be improved
        peak = { x: peakx, y: Math.log(fft.spectrum[peakx]) };

        var right = { x: rightx , y: Math.log(fft.spectrum[rightx]) };

        var interp = (0.5 * ((left.y - right.y) / (left.y - (2 * peak.y) + right.y)) + peak.x);
        var freq = interp * (sampleRate / fftSize);

        var pitch = getPitch(freq);
        onpitch(pitch);
      }

    } else {
      maxPeaks = 0;
      maxPeakCount++;
      // Looks like the maxPeaks business is only needed for visualization?
      //if (maxPeakCount > 20) display.clear()

      nopitch++;
      if (nopitch > (100 / interval)) {
        nopitch = 0;
        onnopitch();
      }
    }
  };
};

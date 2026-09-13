(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = { 
    color: "#ffffff", 
    length: 450,
    thickness: 20,
    angle: 135,
    duration: 350
  };

  function merge(params) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = DEFAULTS[k]; });
    Object.keys(params || {}).forEach(function (k) { out[k] = params[k]; });
    return out;
  }

  window.Effects.register("tear-slash", function (px, py, params) {
    var p = merge(params);
    var t = 0;
    var rad = (p.angle * Math.PI) / 180;
    var L = p.length;
    var N_edge = 15;
    var edgePath = [];
    for (var i = 0; i <= N_edge; i++) {
      var edgeT = i / N_edge; 
      var variance = 1 - Math.pow(edgeT, 3);
      
      edgePath.push({
        t: edgeT, 
        topY: (Math.random() - 0.5) * 0.35 * variance,
        topX: (Math.random() - 0.5) * 0.08 * variance,
        botY: (Math.random() - 0.5) * 0.35 * variance,
        botX: (Math.random() - 0.5) * 0.08 * variance
      });
    }

    var numSpikes = 3 + Math.floor(Math.random() * 2); 
    var baseSpikes = [];
    for (var i = 0; i < numSpikes; i++) {
      baseSpikes.push({
        lenRatio: 0.8 + Math.random() * 0.7, 
        valleyDepth: 0.05 + Math.random() * 0.15, 
        yOffsetTip: (Math.random() - 0.5) * 0.3, 
        yOffsetValley: (Math.random() - 0.5) * 0.1 
      });
    }

    var splinters = [];
    for (var j = 0; j < 25; j++) {
      var seg = Math.floor(1 + Math.random() * (N_edge - 2)); 
      splinters.push({
        seg: seg,
        dir: Math.random() < 0.5 ? 1 : -1, 
        length: (Math.random() * 2.5 + 1) * p.thickness,
        angleOffset: (Math.random() - 0.5) * 1.2,
        width: Math.random() * 1.5 + 0.5
      });
    }

    return {
      update: function (dt) { t += dt; }, 
      done: function () { return t >= p.duration; }, 
      draw: function (ctx) { 
        var k = t / p.duration; 
        
        var tipProgress = Math.min(1, k * 5); 
        tipProgress = 1 - Math.pow(1 - tipProgress, 3); 
        var currentL = L * tipProgress;

        var gap = p.thickness * (0.2 + tipProgress * 3.5 + k * 0.5);
        var blastLen = p.thickness * (1.0 + tipProgress * 5.0 + k * 1.0);
        
        var alpha = k < 0.1 ? k / 0.1 : 1 - Math.pow((k - 0.1) / 0.9, 2);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rad);
        
        var shiftOffset = (L *1);
        ctx.translate(shiftOffset, 0);

        ctx.globalCompositeOperation = "screen";
        ctx.lineJoin = "miter";
        ctx.miterLimit = 10;

        var layers = [
           { alpha: 0.15 * alpha, scale: 3.2, fill: p.color }, 
           { alpha: 0.60 * alpha, scale: 1.5, fill: p.color }, 
           { alpha: 1.00 * alpha, scale: 0.5, fill: "#ffffff" } 
        ];

        for (var L_idx = 0; L_idx < layers.length; L_idx++) {
          var layer = layers[L_idx];
          ctx.globalAlpha = Math.max(0, layer.alpha);
          ctx.fillStyle = layer.fill;

          var w = gap * layer.scale;
          var bLen = blastLen * layer.scale;

          ctx.beginPath();
          
          ctx.moveTo(-currentL, 0); 
          for (var i = N_edge - 1; i >= 0; i--) {
            var pt = edgePath[i];
            var taper = 1 - pt.t; 
            var x = -currentL * pt.t + (currentL * pt.topX);
            var y = -w * 0.5 * taper + (w * pt.topY);
            if (i === 0) { x = 0; y = -w * 0.5; } 
            ctx.lineTo(x, y);
          }

          var spikeStep = w / numSpikes; 
          var startY = -w * 0.5;
          for (var s = 0; s < numSpikes; s++) {
            var sp = baseSpikes[s];
            var tipY = startY + spikeStep * (s + 0.5) + (w * sp.yOffsetTip);
            var tipX = bLen * sp.lenRatio;
            ctx.lineTo(tipX, tipY);
            if (s < numSpikes - 1) {
              var valleyY = startY + spikeStep * (s + 1) + (w * sp.yOffsetValley);
              var valleyX = -currentL * sp.valleyDepth; 
              ctx.lineTo(valleyX, valleyY);
            }
          }
          ctx.lineTo(0, w * 0.5);

          for (var i = 1; i <= N_edge; i++) {
            var pt = edgePath[i];
            var taper = 1 - pt.t;
            var x = -currentL * pt.t + (currentL * pt.botX);
            var y = w * 0.5 * taper + (w * pt.botY); 
            if (i === N_edge) { x = -currentL; y = 0; } 
            ctx.lineTo(x, y);
          }
          ctx.fill(); 

          ctx.beginPath();
          for (var sp_idx = 0; sp_idx < splinters.length; sp_idx++) {
            var splinter = splinters[sp_idx];
            var pt_spl = edgePath[splinter.seg];
            var taper_spl = 1 - pt_spl.t;
            
            var splXOffset = splinter.dir === 1 ? pt_spl.topX : pt_spl.botX;
            var splYOffset = splinter.dir === 1 ? pt_spl.topY : pt_spl.botY;

            var startX = -currentL * pt_spl.t + (currentL * splXOffset);
            var splY = (splinter.dir === 1) 
              ? -w * 0.5 * taper_spl + (w * splYOffset)
              :  w * 0.5 * taper_spl + (w * splYOffset);
            
            var spLen = splinter.length * layer.scale * (0.3 + tipProgress * 2.0);
            var spAngle = splinter.angleOffset; 
            var endX = startX + Math.cos(spAngle) * spLen;
            var endY = splY + Math.sin(spAngle) * spLen * splinter.dir;
            
            var halfW = 4 * layer.scale * splinter.width;
            ctx.moveTo(startX - halfW, splY);
            ctx.lineTo(endX, endY);
            ctx.lineTo(startX + halfW, splY);
          }
          ctx.fill(); 
        }
        
        ctx.restore();
      }
    };
  });
})();
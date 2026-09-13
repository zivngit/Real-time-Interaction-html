(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("orbital-strike", { 
    // 專屬 SVG: 垂直光束打擊在地面的鎖定環上
    iconSVG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="19" r="4"/><path d="M12 2v13"/><path d="M4 19h4"/><path d="M16 19h4"/><path d="M12 23v-1"/></svg>',
    
    render: function (container, api) { 
      api.fields.forEach(function (d) {
        var value = api.getValue(d.key);
        if (value == null) value = api.defaults[d.key] != null ? api.defaults[d.key] : "";
        
        var field = document.createElement("div");
        field.className = "rtx-field";
        var label = document.createElement("label");
        label.textContent = d.label;
        
        var input = document.createElement("input");
        // 最重要的綁定，確保控制台能傳遞數值
        input.id = "rtx-p-" + d.key; 
        
        if (d.type === "color") input.type = "color";
        else if (d.type === "number" || d.type === "integer") input.type = "number";
        else input.type = "text";
        
        input.value = value;
        if (d.min != null) input.min = d.min;
        if (d.max != null) input.max = d.max;
        if (d.step != null) input.step = d.step;
        
        field.appendChild(label);
        field.appendChild(input);
        container.appendChild(field);
      });
    },
  });
})();
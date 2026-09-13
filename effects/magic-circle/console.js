(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("magic-circle", {
    // 專屬 SVG：由外圈與內部六芒星組成的魔法陣圖騰
    iconSVG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2.5l8.2 14.2H3.8L12 2.5z"/><path d="M12 21.5l-8.2-14.2h16.4L12 21.5z"/></svg>',
    
    render: function (container, api) {
      // api.fields 已經排除了 editable: false 的 ringColors，我們只需安全地渲染可視欄位
      api.fields.forEach(function (d) {
        var value = api.getValue(d.key);
        if (value == null) value = api.defaults[d.key] != null ? api.defaults[d.key] : "";
        
        var field = document.createElement("div");
        field.className = "rtx-field";
        var label = document.createElement("label");
        label.textContent = d.label;
        
        var input = document.createElement("input");
        // 確保綁定規範的 ID 格式，讓控制台能正確傳遞數值給 Server
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
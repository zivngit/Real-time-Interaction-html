(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("rocket", {
    iconSVG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c-2.5 0-4 4.5-4 10v4h8v-4c0-5.5-1.5-10-4-10Z"/><circle cx="12" cy="9" r="2"/><path d="M8 12 5 17v3h3"/><path d="M16 12l3 5v3h-3"/><path d="M10 16v2a2 2 0 0 0 4 0v-2"/><path d="M12 18v4"/></svg>',
    render: function (container, api) {
      api.fields.forEach(function (d) {
        var value = api.getValue(d.key);
        if (value == null) value = api.defaults[d.key] != null ? api.defaults[d.key] : "";
        var field = document.createElement("div");
        field.className = "rtx-field";
        var label = document.createElement("label");
        label.textContent = d.label;     
        var input = document.createElement("input");
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
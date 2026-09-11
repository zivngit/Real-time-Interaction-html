(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("slash", {
    iconSVG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20L20 4M6 22L22 6M2 18l4 4"/></svg>',
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
        if (d.type === "color") {
            input.type = "color";
        } else if (d.type === "number" || d.type === "integer") {
            input.type = "number";
        } else {
            input.type = "text";
        }
        input.value = value;
        if (d.min != null) input.min = d.min;
        if (d.max != null) input.max = d.max;
        if (d.step != null) input.step = d.step;
        if (d.maxLength != null) input.maxLength = d.maxLength;
        field.appendChild(label);
        field.appendChild(input);
        container.appendChild(field);
      });
    },
  });
})();
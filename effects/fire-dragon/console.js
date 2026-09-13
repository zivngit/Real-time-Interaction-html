(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("fire-dragon", {
    iconSVG: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M12 2c1 3.5 4.5 5 4.5 9a4.5 4.5 0 0 1-9 0c0-1.8.7-3.2 1.8-4.6.4 1.2 1.2 1.9 2.2 2.1C10.6 6.4 11.3 4 12 2z'/><path d='M4 19c2.5 1.2 4.5 1.2 7 0'/></svg>",
    render: function (container, api) {
      api.fields.forEach(function (d) {
        var field = document.createElement("div");
        field.className = "rtx-field";
        var label = document.createElement("label");
        label.textContent = d.label;
        var input;
        if (d.type === "select") {
          input = document.createElement("select");
          input.id = "rtx-p-" + d.key;
          (d.options || []).forEach(function (opt) {
            var o = document.createElement("option");
            o.value = opt.value;
            o.textContent = opt.label != null ? opt.label : String(opt.value);
            input.appendChild(o);
          });
          input.value =
            d.def != null ? d.def : d.options && d.options[0] ? d.options[0].value : "";
        } else if (d.type === "boolean") {
          input = document.createElement("input");
          input.id = "rtx-p-" + d.key;
          input.type = "checkbox";
          input.checked = d.def === true;
        } else {
          input = document.createElement("input");
          input.id = "rtx-p-" + d.key;
          input.type =
            d.type === "integer" || d.type === "number"
              ? "number"
              : d.type === "color"
                ? "color"
                : "text";
          var value = api.getValue(d.key);
          if (value == null) value = d.def != null ? d.def : "";
          input.value = value;
          if (d.type === "integer" || d.type === "number") {
            if (d.min != null) input.min = d.min;
            if (d.max != null) input.max = d.max;
            if (d.step != null) input.step = d.step;
          }
          if (d.maxLength != null) input.maxLength = d.maxLength;
        }
        field.appendChild(label);
        field.appendChild(input);
        container.appendChild(field);
      });
    },
  });
})();

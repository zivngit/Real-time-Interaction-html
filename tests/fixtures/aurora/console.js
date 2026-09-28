(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("aurora", {
    iconSVG: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' aria-hidden='true'><path d='M4 21c0-7 1.5-11 1.5-17'/><path d='M9.5 21c0-8 1-12 1-18'/><path d='M15 21c0-7 1.2-10 1.2-16'/><path d='M20 21c0-5 .8-8 .8-12'/></svg>",
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

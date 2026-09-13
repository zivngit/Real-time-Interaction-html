(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("pixel-melt", {
    iconSVG: "<svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'><rect x='3' y='3' width='6' height='6'/><rect x='15' y='3' width='6' height='6'/><rect x='3' y='15' width='6' height='6'/><rect x='9' y='9' width='6' height='6'/><rect x='16' y='16' width='5' height='5' transform='rotate(24 18.5 18.5)'/><rect x='12' y='20' width='3' height='3' transform='rotate(-18 13.5 21.5)'/></svg>",
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

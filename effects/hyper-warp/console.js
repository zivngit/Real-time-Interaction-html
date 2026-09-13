(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("hyper-warp", {
    iconSVG: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' aria-hidden='true'><circle cx='12' cy='12' r='1.6' fill='currentColor' stroke='none'/><line x1='12' y1='2' x2='12' y2='6.5'/><line x1='12' y1='17.5' x2='12' y2='22'/><line x1='2' y1='12' x2='6.5' y2='12'/><line x1='17.5' y1='12' x2='22' y2='12'/><line x1='4.9' y1='4.9' x2='7.8' y2='7.8'/><line x1='16.2' y1='16.2' x2='19.1' y2='19.1'/><line x1='19.1' y1='4.9' x2='16.2' y2='7.8'/><line x1='7.8' y1='16.2' x2='4.9' y2='19.1'/></svg>",
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

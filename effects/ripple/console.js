(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("ripple", {
    iconID: "ripple",
    render: function (container, api) {
      var fields = [
        { key: "color", label: "顏色", type: "color" },
        { key: "maxRadius", label: "最大半徑", type: "number", min: 20, max: 600, step: 10 },
        { key: "duration", label: "持續(ms)", type: "number", min: 200, max: 8000, step: 100 },
      ];
      fields.forEach(function (d) {
        var value = api.getValue(d.key);
        if (value == null) value = api.defaults[d.key] != null ? api.defaults[d.key] : "";
        var field = document.createElement("div");
        field.className = "rtx-field";
        var label = document.createElement("label");
        label.textContent = d.label;
        var input = document.createElement("input");
        input.id = "rtx-p-" + d.key;
        input.type = d.type;
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

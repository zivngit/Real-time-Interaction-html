(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("text", {
    iconID: "text",
    render: function (container, api) {
      var fields = [
        { key: "content", label: "文字", type: "text", maxLength: 20 },
        { key: "color", label: "顏色", type: "color" },
        { key: "size", label: "字級", type: "number", min: 8, max: 160, step: 2 },
        { key: "duration", label: "持續(ms)", type: "number", min: 200, max: 10000, step: 100 },
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
        if (d.maxLength != null) input.maxLength = d.maxLength;
        field.appendChild(label);
        field.appendChild(input);
        container.appendChild(field);
      });
    },
  });
})();

(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("effect-interface", {
    iconSVG: "<svg viewBox='0 0 24 24' aria-hidden='true'><rect x='4' y='4' width='16' height='16' rx='2'/><line x1='4' y1='9' x2='20' y2='9'/><circle cx='7' cy='6.5' r='0.9'/></svg>",
    render: function (container, api) {
      var field =
        api.fields && api.fields.length && api.fields[0].key === "duration"
          ? api.fields[0]
          : { key: "duration", label: "duration", def: 1000 };
      var wrap = document.createElement("div");
      wrap.className = "rtx-field";
      var label = document.createElement("label");
      label.textContent = field.label || "duration";
      var input = document.createElement("input");
      input.id = "rtx-p-duration";
      input.type = "number";
      var value = api.getValue("duration");
      if (value == null) value = field.def != null ? field.def : 1000;
      input.value = value;
      wrap.appendChild(label);
      wrap.appendChild(input);
      container.appendChild(wrap);
    },
  });
})();

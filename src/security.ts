export function lockdown() {
  window.addEventListener("contextmenu", (e) => e.preventDefault(), {
    capture: true,
  });

  window.addEventListener(
    "keydown",
    (e) => {
      const key = e.key.toUpperCase();
      const isDevtools =
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (key === "I" || key === "J" || key === "C")) ||
        (e.metaKey && e.altKey && (key === "I" || key === "J" || key === "C")) ||
        (e.ctrlKey && key === "U");

      if (isDevtools || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true }
  );
}

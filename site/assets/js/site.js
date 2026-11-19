// Mobile navigation. Progressive: without JavaScript the links wrap under the brand.
(() => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;
  const label = toggle.querySelector(".nav-toggle-label");
  const mq = window.matchMedia("(max-width: 1023px)");

  const set = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    if (label) label.textContent = open ? "Close" : "Menu";
  };

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    set(open);
    if (open) nav.querySelector("a")?.focus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { set(false); toggle.focus(); }
  });
  document.addEventListener("click", (e) => {
    if (toggle.getAttribute("aria-expanded") === "true" && !nav.contains(e.target) && !toggle.contains(e.target)) set(false);
  });
  nav.addEventListener("focusout", (e) => {
    if (mq.matches && toggle.getAttribute("aria-expanded") === "true" && e.relatedTarget && !nav.contains(e.relatedTarget) && e.relatedTarget !== toggle) set(false);
  });
  mq.addEventListener("change", () => set(false));
})();

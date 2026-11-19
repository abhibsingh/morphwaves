// Wires the orbit scene into the homepage hero.
import { mountOrbitScene } from "./orbit-scene.js";

const root = document.querySelector("[data-orbit-hero]");
const whenIdle = (fn) => {
  const go = () => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
  if (document.readyState === "complete") go(); else window.addEventListener("load", go, { once: true });
};
if (root) whenIdle(start);
function start() {
  const canvasBox = root.querySelector(".orbit-canvas");
  const title = root.querySelector("[data-stage-title]");
  const alt = root.querySelector("[data-stage-alt]");
  const text = root.querySelector("[data-stage-text]");
  const chips = [...root.querySelectorAll("[data-stage]")];
  const replay = root.querySelector("[data-replay]");
  const progress = root.querySelector(".orbit-progress-bar");

  const api = mountOrbitScene(canvasBox, {
    shiftRight: true,
    onStage(i, st) {
      root.dataset.orbitStage = st.id;
      title.textContent = st.title; alt.textContent = st.alt; text.textContent = st.text;
      chips.forEach((c, n) => c.setAttribute("aria-pressed", String(n === i)));
      if (progress) { progress.style.animation = "none"; void progress.offsetWidth; progress.style.animation = ""; }
    },
  });

  if (!api) {
    root.classList.add("no-webgl");
  } else {
    root.classList.add("has-scene");
    chips.forEach((c, n) => c.addEventListener("click", () => { root.classList.add("is-manual"); api.go(n); }));
    replay && replay.addEventListener("click", () => { root.classList.remove("is-manual"); api.replay(); });
  }
}

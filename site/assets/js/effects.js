// Small interaction effects, ported from React Bits (reactbits.dev) to plain
// JavaScript so the site stays a fast static build with no framework:
//   BlurText      headline words resolve from a blur, once           [data-blur-text]
//   SpotlightCard a soft glow follows the pointer across a card      .spot, .cap-items li
//   DecryptedText short labels resolve from scrambled characters     [data-decrypt]
//   Magnet        primary buttons lean gently toward the pointer     .magnet, hero and band CTAs
// Plus a one time section reveal for [data-reveal].
// Every effect is decorative: content is complete and readable without it, and
// motion effects are skipped when the visitor prefers reduced motion.
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const io = "IntersectionObserver" in window;

  const onceVisible = (els, fn, threshold = 0.2) => {
    if (!els.length) return;
    if (!io) { els.forEach(fn); return; }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { obs.unobserve(e.target); fn(e.target); } });
    }, { threshold, rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => obs.observe(el));
  };

  // SVG <animateMotion> ignores the reduced motion setting, so pause it here.
  if (reduce) document.querySelectorAll("svg").forEach((svg) => svg.pauseAnimations && svg.pauseAnimations());

  // ---------- Section reveal ----------
  onceVisible([...document.querySelectorAll("[data-reveal]")], (el) => el.classList.add("is-in"), 0.12);

  // ---------- BlurText ----------
  document.querySelectorAll("[data-blur-text]").forEach((el) => {
    if (reduce) { el.classList.add("bt-done"); return; }
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach((w, i) => {
      const span = document.createElement("span");
      span.className = "bt-word";
      span.textContent = i < words.length - 1 ? w + " " : w;
      span.style.setProperty("--i", String(i));
      el.appendChild(span);
    });
    requestAnimationFrame(() => {
      el.classList.add("bt-ready");
      const last = el.lastElementChild;
      if (last) last.addEventListener("animationend", () => el.classList.add("bt-done"), { once: true });
    });
  });

  // ---------- SpotlightCard ----------
  if (finePointer) {
    document.querySelectorAll(".spot, .cap-items li").forEach((card) => {
      card.classList.add("spot");
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
  }

  // ---------- DecryptedText ----------
  const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789/#";
  const decrypt = (el) => {
    const text = el.textContent;
    if (reduce || !text.trim()) return;
    // Screen readers get the real text once; the scrambling copy is hidden from them.
    if (!el.closest("[aria-hidden='true']")) {
      const real = document.createElement("span");
      real.className = "visually-hidden";
      real.textContent = text;
      const shown = document.createElement("span");
      shown.setAttribute("aria-hidden", "true");
      el.textContent = "";
      el.append(real, shown);
      el = shown;
    }
    el.classList.add("dc-scrambling");
    const total = 750, start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / total);
      const solved = Math.floor(p * text.length);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        out += i < solved || c === " " ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(tick);
      else { el.textContent = text; el.classList.remove("dc-scrambling"); }
    };
    requestAnimationFrame(tick);
  };
  onceVisible([...document.querySelectorAll("[data-decrypt]")], decrypt, 0.6);

  // ---------- Magnet ----------
  if (finePointer && !reduce) {
    const mags = [...document.querySelectorAll(".magnet, .hero .btn-primary, .band .btn-primary")];
    const PAD = 56, STRENGTH = 5;
    let raf = 0, px = 0, py = 0;
    mags.forEach((m) => m.classList.add("magnet"));
    const update = () => {
      raf = 0;
      mags.forEach((m) => {
        const r = m.getBoundingClientRect();
        const inside = px > r.left - PAD && px < r.right + PAD && py > r.top - PAD && py < r.bottom + PAD;
        if (inside) {
          const clamp = (v) => Math.max(-8, Math.min(8, v));
          const dx = clamp((px - (r.left + r.width / 2)) / STRENGTH), dy = clamp((py - (r.top + r.height / 2)) / STRENGTH);
          m.classList.add("is-pulling");
          m.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
        } else if (m.classList.contains("is-pulling")) {
          m.classList.remove("is-pulling");
          m.style.transform = "";
        }
      });
    };
    if (mags.length) window.addEventListener("pointermove", (e) => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  }
})();

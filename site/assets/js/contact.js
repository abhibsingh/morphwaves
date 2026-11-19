// Contact form: client side validation and submission to Netlify Forms.
// Without JavaScript the form posts normally and Netlify redirects to /contact/thanks/.
// Success is shown only when the server confirms the submission.
(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const status = document.getElementById("form-status");
  const button = form.querySelector('button[type="submit"]');
  const label = button.querySelector(".btn-label");
  const EMAIL = "Abhishek@morphwaves.in";

  // Preselect area of interest from links such as /contact/?interest=pilot
  const interest = new URLSearchParams(location.search).get("interest");
  const select = form.elements.interest;
  if (interest && [...select.options].some((o) => o.value === interest)) select.value = interest;

  const rules = {
    name: (v) => (v.trim() ? "" : "Enter your name."),
    organisation: (v) => (v.trim() ? "" : "Enter your organisation. Use \"Independent\" if none."),
    email: (v) => {
      if (!v.trim()) return "Enter your email address.";
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Enter an email address in the format name@organisation.com.";
    },
    message: (v) => (v.trim().length >= 20 ? "" : "Write at least 20 characters so we can understand your request."),
  };

  const check = (name) => {
    const input = form.elements[name];
    const msg = rules[name](input.value);
    const err = document.getElementById(input.getAttribute("aria-describedby").split(" ").pop());
    err.textContent = msg;
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  };

  Object.keys(rules).forEach((name) => {
    const input = form.elements[name];
    input.addEventListener("blur", () => { if (input.value) check(name); });
    input.addEventListener("input", () => { if (input.getAttribute("aria-invalid") === "true") check(name); });
  });

  const show = (kind, html) => {
    status.className = "form-status is-" + kind;
    status.innerHTML = html;
    status.focus();
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.className = "form-status";
    const invalid = Object.keys(rules).filter((n) => !check(n));
    if (invalid.length) { form.elements[invalid[0]].focus(); return; }

    button.disabled = true;
    form.classList.add("is-sending");
    label.textContent = "Sending";
    try {
      const body = new URLSearchParams(new FormData(form)).toString();
      const res = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      if (!res.ok) throw new Error("HTTP " + res.status);
      form.reset();
      form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
      show("success", "<strong>Message sent.</strong> Thank you. We will reply to the email address you provided.");
    } catch (err) {
      show("error", '<strong>Your message was not sent.</strong> Check your connection and try again, or email <a href="mailto:' + EMAIL + '">' + EMAIL + "</a> directly.");
    } finally {
      button.disabled = false;
      form.classList.remove("is-sending");
      label.textContent = "Send message";
    }
  });
})();

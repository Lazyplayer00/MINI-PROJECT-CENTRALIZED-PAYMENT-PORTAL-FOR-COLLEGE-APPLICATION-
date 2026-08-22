"use strict";

/**
 * Login form submission.
 *
 * Posts as JSON so the server can respond with a structured error that is
 * shown inline, rather than the browser navigating away to a raw JSON body.
 */
(function () {
  const form = document.getElementById("login-form");
  const errorBox = document.getElementById("login-error");
  const submit = document.getElementById("login-submit");

  if (!form) return;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const data = Object.fromEntries(new FormData(form).entries());

    submit.disabled = true;
    submit.textContent = "Signing in…";

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(data),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok) {
        window.location.assign(payload.redirect || "/dashboard");
        return;
      }

      showError(payload.error?.message || "Sign in failed. Please try again.");

      // A consumed Turnstile token cannot be replayed, so reset the widget.
      if (window.turnstile) window.turnstile.reset();
    } catch {
      showError("Could not reach the server. Check your connection.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  });
})();

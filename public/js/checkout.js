"use strict";

/**
 * Checkout form.
 *
 * Client-side checks here are for responsiveness only -- every rule is
 * enforced again server-side in paymentService.validatePayment, because
 * anything in this file can be bypassed.
 */
(function () {
  const form = document.getElementById("payment-form");
  if (!form) return;

  const errorBox = document.getElementById("payment-error");
  const successBox = document.getElementById("payment-success");
  const submit = document.getElementById("payment-submit");
  const instrumentField = document.getElementById("instrument-field");
  const instrumentLabel = instrumentField.querySelector(".field-label");
  const instrumentInput = instrumentField.querySelector("input");

  const feeId = form.dataset.feeId;
  const balance = Number(form.dataset.balance);

  const LABELS = {
    card: "Card number",
    netbanking: "Account number",
    upi: "UPI ID",
  };

  const PLACEHOLDERS = {
    card: "4111 1111 1111 1111",
    netbanking: "0001234567890",
    upi: "name@bank",
  };

  function show(box, message) {
    box.textContent = message;
    box.hidden = false;
  }

  function clearMessages() {
    errorBox.hidden = true;
    successBox.hidden = true;
  }

  // Relabel the instrument field to match the selected method.
  form.querySelectorAll('input[name="method"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      instrumentLabel.textContent = LABELS[radio.value] ?? "Payment details";
      instrumentInput.placeholder = PLACEHOLDERS[radio.value] ?? "";
      instrumentInput.value = "";
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();

    const data = Object.fromEntries(new FormData(form).entries());
    const amount = Number(data.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      show(errorBox, "Enter a valid amount.");
      return;
    }

    if (amount > balance) {
      show(errorBox, "Amount cannot exceed the outstanding balance.");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Processing…";

    try {
      const response = await fetch(`/api/fees/${feeId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          amount: data.amount,
          method: data.method,
          instrument: data.instrument ?? "",
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok) {
        form.querySelectorAll("input, button").forEach((el) => {
          el.disabled = true;
        });
        show(
          successBox,
          `Payment of ${payload.amount} succeeded. Reference ${payload.reference}.`
        );
        setTimeout(() => window.location.assign("/payments"), 1600);
        return;
      }

      show(errorBox, payload.error?.message || "Payment could not be completed.");
    } catch {
      show(errorBox, "Could not reach the server. Your card was not charged.");
    } finally {
      if (successBox.hidden) {
        submit.disabled = false;
        submit.textContent = "Pay now";
      }
    }
  });
})();

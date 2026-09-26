(() => {
  "use strict";

  // ── DOM references ──────────────────────────────────────────
  const promptInput   = document.getElementById("prompt-input");
  const charCount     = document.getElementById("char-count");
  const generateBtn   = document.getElementById("generate-btn");
  const statusArea    = document.getElementById("status-area");
  const spinner       = document.getElementById("spinner");
  const statusText    = document.getElementById("status-text");
  const resultSection = document.getElementById("result-section");
  const generatedImg  = document.getElementById("generated-image");
  const downloadBtn   = document.getElementById("download-btn");
  const newBtn        = document.getElementById("new-btn");
  const creditsEl     = document.getElementById("credits-remaining");

  const API_URL = "http://127.0.0.1:5000";

  // ── Fetch initial credit status on load ─────────────────────
  fetchCredits();

  async function fetchCredits() {
    try {
      const res = await fetch(`${API_URL}/status`);
      if (res.ok) {
        const data = await res.json();
        updateCreditsUI(data.remaining, data.daily_limit);
      }
    } catch {
      // Backend might not be running yet — silently ignore
    }
  }

  function updateCreditsUI(remaining, total) {
    if (!creditsEl) return;

    creditsEl.textContent = `${remaining} / ${total} generations remaining today`;

    // Update visual state
    creditsEl.classList.remove("credits-ok", "credits-low", "credits-depleted");
    if (remaining === 0) {
      creditsEl.classList.add("credits-depleted");
      lockOutUI();
    } else if (remaining <= 1) {
      creditsEl.classList.add("credits-low");
    } else {
      creditsEl.classList.add("credits-ok");
    }
  }

  function lockOutUI() {
    generateBtn.disabled = true;
    promptInput.disabled = true;
    showStatus(
      "🔒 Your daily token has expired. You have used all 4 free generations for today. Please come back tomorrow!",
      "error",
      false
    );
  }

  // ── Character counter ───────────────────────────────────────
  promptInput.addEventListener("input", () => {
    const len = promptInput.value.length;
    charCount.textContent = `${len} / 500`;
    charCount.classList.toggle("near-limit", len >= 400 && len < 500);
    charCount.classList.toggle("at-limit", len >= 500);
  });

  // ── Enter key triggers generation ───────────────────────────
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !generateBtn.disabled) {
      e.preventDefault();
      generateBtn.click();
    }
  });

  // ── Generate button click ───────────────────────────────────
  generateBtn.addEventListener("click", async () => {
    const prompt = promptInput.value.trim();

    // Client-side validation
    if (!prompt) {
      showStatus("Please enter a prompt describing the image you want.", "error", false);
      promptInput.focus();
      return;
    }

    // Lock UI
    setLoading(true);
    showStatus(
      "Generating your image… This may take 15-30 seconds.",
      "loading",
      true
    );
    resultSection.classList.add("hidden");

    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      // Safely parse JSON — backend might return non-JSON on rare errors
      let data;
      try {
        data = await res.json();
      } catch {
        showStatus(`Server returned an invalid response (HTTP ${res.status}).`, "error", false);
        return;
      }

      // Handle token expired (429)
      if (res.status === 429 || data.code === "TOKEN_EXPIRED") {
        updateCreditsUI(0, data.daily_limit || 4);
        lockOutUI();
        return;
      }

      if (!res.ok) {
        const message = data.error || `Server error (HTTP ${res.status})`;
        showStatus(message, "error", false);
        return;
      }

      // Validate the image field exists
      if (!data.image) {
        showStatus("Server returned a response with no image data.", "error", false);
        return;
      }

      // Update remaining credits
      if (data.remaining !== undefined) {
        updateCreditsUI(data.remaining, data.daily_limit || 4);
      }

      // Success — display image
      generatedImg.src = data.image;
      generatedImg.alt = prompt;
      resultSection.classList.remove("hidden");
      showStatus("Image generated successfully!", "success", false);
    } catch (err) {
      // TypeError is thrown by fetch() when the network request itself fails
      // (server not running, DNS failure, CORS blocked, etc.)
      if (err instanceof TypeError) {
        showStatus(
          "Cannot reach the backend server. Make sure Flask is running on http://127.0.0.1:5000",
          "error",
          false
        );
      } else {
        showStatus(`Unexpected error: ${err.message}`, "error", false);
      }
    } finally {
      setLoading(false);
    }
  });

  // ── Download button ─────────────────────────────────────────
  downloadBtn.addEventListener("click", () => {
    const dataUri = generatedImg.src;
    if (!dataUri || !dataUri.startsWith("data:")) return;

    const link = document.createElement("a");
    link.href = dataUri;
    // Sanitise prompt for filename
    const safeName = promptInput.value
      .trim()
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60) || "generated_image";
    link.download = `${safeName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // ── New Image button ────────────────────────────────────────
  newBtn.addEventListener("click", () => {
    resultSection.classList.add("hidden");
    statusArea.classList.add("hidden");
    promptInput.value = "";
    charCount.textContent = "0 / 500";
    charCount.classList.remove("near-limit", "at-limit");

    // Re-check if still has credits
    fetchCredits().then(() => {
      if (!promptInput.disabled) {
        promptInput.focus();
      }
    });
  });

  // ── Helpers ─────────────────────────────────────────────────

  /**
   * Show the status area with a message.
   * @param {string} message
   * @param {"loading"|"error"|"success"} type
   * @param {boolean} showSpinner
   */
  function showStatus(message, type, showSpinner) {
    statusArea.classList.remove("hidden", "error", "success");
    if (type === "error") statusArea.classList.add("error");
    if (type === "success") statusArea.classList.add("success");
    spinner.classList.toggle("hidden", !showSpinner);
    statusText.textContent = message;
  }

  /**
   * Toggle the loading state of the Generate button.
   * @param {boolean} loading
   */
  function setLoading(loading) {
    generateBtn.disabled = loading;
    const btnText = generateBtn.querySelector(".btn-text");
    btnText.textContent = loading ? "Generating…" : "Generate";
  }
// Preset prompts
const preset1 = document.getElementById('preset-1');
const preset2 = document.getElementById('preset-2');
const switchBackendBtn = document.getElementById('switch-backend');
let useMock = false;

preset1 && preset1.addEventListener('click', () => {
  promptInput.value = 'A vibrant sunset over a futuristic cyberpunk city skyline';
  const len = promptInput.value.length;
  charCount.textContent = `${len} / 500`;
  charCount.classList.toggle('near-limit', len >= 400 && len < 500);
  charCount.classList.toggle('at-limit', len >= 500);
});

preset2 && preset2.addEventListener('click', () => {
  promptInput.value = 'A detailed portrait of an elf wizard with glowing staff';
  const len = promptInput.value.length;
  charCount.textContent = `${len} / 500`;
  charCount.classList.toggle('near-limit', len >= 400 && len < 500);
  charCount.classList.toggle('at-limit', len >= 500);
});

switchBackendBtn && switchBackendBtn.addEventListener('click', () => {
  useMock = !useMock;
  switchBackendBtn.textContent = useMock ? 'Use Real Backend' : 'Use Mock Backend';
});

})();

(() => {
  "use strict";

  // ── CONFIG ────────────────────────────────────────────────
  const API_URL = "http://127.0.0.1:5000";
  const HISTORY_KEY = "neuralcanvas_history";
  const MAX_HISTORY = 50;

  // ── MODEL DATA ────────────────────────────────────────────
  const MODEL_LABELS = {
    "flux-schnell": "FLUX Schnell",
    "flux-dev":     "FLUX Dev",
    "sd3.5":        "Stable Diffusion 3.5",
    "sdxl":         "Stable Diffusion XL",
  };

  // ── DOM REFS ──────────────────────────────────────────────
  const sidebar        = document.getElementById("sidebar");
  const toggleSidebar  = document.getElementById("toggle-sidebar");
  const newChatBtn     = document.getElementById("new-chat-btn");
  const chatMessages   = document.getElementById("chat-messages");
  const chatScroll     = document.getElementById("chat-scroll");
  const welcomeScreen  = document.getElementById("welcome-screen");
  const creditsEl      = document.getElementById("credits-remaining");
  const creditsBadge   = document.getElementById("credits-badge");
  const sidebarHistory = document.getElementById("sidebar-history");
  const sidebarMeta    = document.querySelector(".sidebar-meta strong");

  // Welcome (centered) input
  const promptInput      = document.getElementById("prompt-input");
  const sendBtn          = document.getElementById("send-btn");
  const charCount        = document.getElementById("char-count");
  const modelPickerBtn   = document.getElementById("model-picker-btn");
  const modelPickerLabel = document.getElementById("model-picker-label");

  // Bottom (chat active) input
  const inputBarBottom        = document.getElementById("input-bar-bottom");
  const promptInputBottom     = document.getElementById("prompt-input-bottom");
  const sendBtnBottom         = document.getElementById("send-btn-bottom");
  const charCountBottom       = document.getElementById("char-count-bottom");
  const modelPickerBtnBottom  = document.getElementById("model-picker-btn-bottom");
  const modelPickerLabelBtm   = document.getElementById("model-picker-label-bottom");

  // Modal
  const modalOverlay   = document.getElementById("model-modal-overlay");
  const modalClose     = document.getElementById("model-modal-close");
  const modelCards     = document.querySelectorAll(".model-card");

  // Preset buttons (sidebar + welcome chips)
  const presets = document.querySelectorAll("[data-prompt]");

  // ── STATE ─────────────────────────────────────────────────
  let isGenerating = false;
  let selectedModel = "flux-schnell";
  let isChatActive = false;   // tracks whether we're in chat mode

  // ── INIT ──────────────────────────────────────────────────
  fetchCredits();
  autoResizeInput(promptInput);
  loadHistory();
  syncModelUI();

  // ── HELPERS: get active input/button refs ─────────────────
  function getActivePromptInput() {
    return isChatActive ? promptInputBottom : promptInput;
  }
  function getActiveSendBtn() {
    return isChatActive ? sendBtnBottom : sendBtn;
  }
  function getActiveCharCount() {
    return isChatActive ? charCountBottom : charCount;
  }

  // ── SIDEBAR TOGGLE (MOBILE) ───────────────────────────────
  toggleSidebar?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  document.getElementById("chat-main")?.addEventListener("click", (e) => {
    if (sidebar.classList.contains("open") && !sidebar.contains(e.target)) {
      sidebar.classList.remove("open");
    }
  });

  // ── NEW CHAT ──────────────────────────────────────────────
  newChatBtn?.addEventListener("click", resetChat);

  function resetChat() {
    chatMessages.innerHTML = "";
    chatMessages.appendChild(welcomeScreen);
    welcomeScreen.classList.remove("hidden");

    // Switch back to centered input
    isChatActive = false;
    inputBarBottom.classList.add("hidden");

    promptInput.value = "";
    promptInput.style.height = "auto";
    promptInputBottom.value = "";
    promptInputBottom.style.height = "auto";

    updateCharCount(charCount, promptInput);
    updateCharCount(charCountBottom, promptInputBottom);
    updateSendBtn(sendBtn, promptInput);
    updateSendBtn(sendBtnBottom, promptInputBottom);

    fetchCredits();
    promptInput.focus();
    sidebar.classList.remove("open");
  }

  // ── SWITCH TO CHAT MODE ───────────────────────────────────
  function activateChatMode() {
    if (isChatActive) return;
    isChatActive = true;
    inputBarBottom.classList.remove("hidden");
    // Transfer any text from welcome input to bottom input
    promptInputBottom.value = promptInput.value;
    promptInput.value = "";
    autoResizeInput(promptInputBottom);
    updateCharCount(charCountBottom, promptInputBottom);
    updateSendBtn(sendBtnBottom, promptInputBottom);
    promptInputBottom.focus();
  }

  // ── PRESET PROMPTS ────────────────────────────────────────
  presets.forEach(btn => {
    btn.addEventListener("click", () => {
      const prompt = btn.dataset.prompt;
      if (prompt && !isGenerating) {
        const input = getActivePromptInput();
        input.value = prompt;
        autoResizeInput(input);
        updateCharCount(getActiveCharCount(), input);
        updateSendBtn(getActiveSendBtn(), input);
        handleGenerate();
        sidebar.classList.remove("open");
      }
    });
  });

  // ── INPUT HANDLING (both inputs) ──────────────────────────
  function wireInput(input, charEl, btnEl) {
    input.addEventListener("input", () => {
      autoResizeInput(input);
      updateCharCount(charEl, input);
      updateSendBtn(btnEl, input);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!btnEl.disabled) handleGenerate();
      }
    });

    btnEl.addEventListener("click", () => {
      if (!btnEl.disabled) handleGenerate();
    });
  }

  wireInput(promptInput, charCount, sendBtn);
  wireInput(promptInputBottom, charCountBottom, sendBtnBottom);

  function autoResizeInput(input) {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 150) + "px";
  }

  function updateCharCount(el, input) {
    const len = input.value.length;
    el.textContent = `${len} / 500`;
    el.classList.toggle("near-limit", len >= 400 && len < 500);
    el.classList.toggle("at-limit", len >= 500);
  }

  function updateSendBtn(btn, input) {
    btn.disabled = isGenerating || input.value.trim().length === 0;
  }

  // ── MODEL PICKER MODAL ───────────────────────────────────
  function openModelModal() {
    modalOverlay.classList.remove("hidden");
  }

  function closeModelModal() {
    modalOverlay.classList.add("hidden");
  }

  modelPickerBtn?.addEventListener("click", openModelModal);
  modelPickerBtnBottom?.addEventListener("click", openModelModal);
  modalClose?.addEventListener("click", closeModelModal);

  // Close on overlay click (outside modal)
  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModelModal();
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) {
      closeModelModal();
    }
  });

  // Model card selection
  modelCards.forEach(card => {
    card.addEventListener("click", () => {
      const modelKey = card.dataset.model;
      if (!modelKey) return;

      selectedModel = modelKey;

      // Update active state on cards
      modelCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      syncModelUI();
      closeModelModal();

      // Focus the active prompt input
      getActivePromptInput().focus();
    });
  });

  function syncModelUI() {
    const name = MODEL_LABELS[selectedModel] || selectedModel;
    if (modelPickerLabel) modelPickerLabel.textContent = name;
    if (modelPickerLabelBtm) modelPickerLabelBtm.textContent = name;
    if (sidebarMeta) sidebarMeta.textContent = name;
  }

  // ── CREDITS ───────────────────────────────────────────────
  async function fetchCredits() {
    try {
      const res = await fetch(`${API_URL}/status`);
      if (res.ok) {
        const data = await res.json();
        updateCreditsUI(data.remaining, data.daily_limit);
      }
    } catch {
      if (creditsEl) creditsEl.textContent = "Backend offline";
    }
  }

  function updateCreditsUI(remaining, total) {
    if (!creditsEl) return;
    creditsEl.textContent = `${remaining}/${total} left today`;
    creditsBadge.classList.remove("low", "depleted");
    if (remaining === 0) {
      creditsBadge.classList.add("depleted");
    } else if (remaining <= 1) {
      creditsBadge.classList.add("low");
    }
  }

  // ── LOCALSTORAGE HISTORY ──────────────────────────────────
  function saveHistoryEntry(prompt, imageDataUri) {
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch { /* ignore */ }

    history.unshift({
      prompt,
      image: imageDataUri,
      timestamp: Date.now(),
    });

    // Keep only the last MAX_HISTORY items
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      // If localStorage is full (base64 images are large), remove oldest entries
      while (history.length > 1) {
        history.pop();
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
          break;
        } catch { /* keep trying */ }
      }
    }
  }

  function loadHistory() {
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch { /* ignore */ }

    // Populate sidebar
    sidebarHistory.innerHTML = "";
    history.forEach(entry => {
      addToSidebarHistory(entry.prompt, entry.image, entry.timestamp);
    });
  }

  // ── MESSAGE RENDERING ────────────────────────────────────
  function addMessage(role, content, opts = {}) {
    welcomeScreen.classList.add("hidden");

    const msg = document.createElement("div");
    msg.classList.add("message");

    const avatar = document.createElement("div");
    avatar.classList.add("msg-avatar", role);

    if (role === "ai") {
      const logoImg = document.createElement("img");
      logoImg.src = "logo.jpg";
      logoImg.alt = "AI";
      logoImg.classList.add("avatar-logo");
      avatar.appendChild(logoImg);
    } else {
      avatar.textContent = "Y";
    }

    const body = document.createElement("div");
    body.classList.add("msg-body");

    const label = document.createElement("div");
    label.classList.add("msg-label");
    label.textContent = role === "user" ? "You" : "NeuralCanvas";

    body.appendChild(label);

    if (opts.loading) {
      const loadWrap = document.createElement("div");
      loadWrap.style.display = "flex";
      loadWrap.style.alignItems = "center";
      loadWrap.style.gap = "10px";

      const dots = document.createElement("div");
      dots.classList.add("loading-dots");
      dots.innerHTML = "<span></span><span></span><span></span>";
      loadWrap.appendChild(dots);

      if (content) {
        const statusText = document.createElement("span");
        statusText.classList.add("msg-text");
        statusText.style.fontSize = "0.82rem";
        statusText.style.color = "var(--text-muted)";
        statusText.textContent = content;
        loadWrap.appendChild(statusText);
      }

      body.appendChild(loadWrap);
    } else if (opts.error) {
      const err = document.createElement("div");
      err.classList.add("msg-error");
      err.textContent = content;
      body.appendChild(err);
    } else {
      const text = document.createElement("div");
      text.classList.add("msg-text");
      text.textContent = content;
      body.appendChild(text);
    }

    if (opts.image) {
      appendImageToBody(body, opts.image, content);
    }

    msg.appendChild(avatar);
    msg.appendChild(body);
    chatMessages.appendChild(msg);

    requestAnimationFrame(() => {
      chatScroll.scrollTop = chatScroll.scrollHeight;
    });

    return msg;
  }

  function appendImageToBody(body, imageSrc, altText) {
    const wrap = document.createElement("div");
    wrap.classList.add("msg-image-wrap");
    const img = document.createElement("img");
    img.src = imageSrc;
    img.alt = altText || "Generated image";
    wrap.appendChild(img);
    body.appendChild(wrap);

    const actions = document.createElement("div");
    actions.classList.add("msg-actions");

    const dlBtn = document.createElement("button");
    dlBtn.classList.add("msg-action-btn");
    dlBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Download`;
    dlBtn.addEventListener("click", () => downloadImage(imageSrc, altText));
    actions.appendChild(dlBtn);

    body.appendChild(actions);
  }

  function replaceMessage(msgEl, role, content, opts = {}) {
    const body = msgEl.querySelector(".msg-body");
    if (!body) return;

    const label = body.querySelector(".msg-label");
    body.innerHTML = "";
    if (label) body.appendChild(label);

    if (opts.error) {
      const err = document.createElement("div");
      err.classList.add("msg-error");
      err.textContent = content;
      body.appendChild(err);
    } else {
      const text = document.createElement("div");
      text.classList.add("msg-text");
      text.textContent = content;
      body.appendChild(text);
    }

    if (opts.image) {
      appendImageToBody(body, opts.image, content);
    }

    requestAnimationFrame(() => {
      chatScroll.scrollTop = chatScroll.scrollHeight;
    });
  }

  // ── CORE GENERATION LOGIC ─────────────────────────────────
  async function handleGenerate() {
    const input = getActivePromptInput();
    const prompt = input.value.trim();
    if (!prompt || isGenerating) return;

    isGenerating = true;

    // Switch to chat mode (shows bottom input, hides welcome)
    activateChatMode();

    // Disable both send buttons
    sendBtn.disabled = true;
    sendBtnBottom.disabled = true;

    // Add user message
    addMessage("user", prompt);

    // Clear both inputs
    promptInput.value = "";
    promptInput.style.height = "auto";
    promptInputBottom.value = "";
    promptInputBottom.style.height = "auto";
    updateCharCount(charCount, promptInput);
    updateCharCount(charCountBottom, promptInputBottom);

    // Determine model
    const modelName = MODEL_LABELS[selectedModel] || selectedModel;

    // Add loading AI message with model name
    const aiMsg = addMessage("ai", `Generating with ${modelName}…`, { loading: true });

    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: selectedModel }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        replaceMessage(aiMsg, "ai", "Server returned an invalid response.", { error: true });
        return;
      }

      if (res.status === 429 || data.code === "TOKEN_EXPIRED") {
        updateCreditsUI(0, data.daily_limit || 4);
        replaceMessage(aiMsg, "ai", "🔒 Your daily free generations are used up. Please come back tomorrow!", { error: true });
        return;
      }

      if (!res.ok) {
        replaceMessage(aiMsg, "ai", data.error || `Server error (HTTP ${res.status})`, { error: true });
        return;
      }

      if (!data.image) {
        replaceMessage(aiMsg, "ai", "Server returned a response with no image data.", { error: true });
        return;
      }

      // Success!
      if (data.remaining !== undefined) {
        updateCreditsUI(data.remaining, data.daily_limit || 4);
      }

      const shortPrompt = prompt.slice(0, 60) + (prompt.length > 60 ? "…" : "");
      replaceMessage(aiMsg, "ai", `Here's your image for "${shortPrompt}"`, { image: data.image });

      // Save to history (persists across refresh)
      saveHistoryEntry(prompt, data.image);
      // Update sidebar
      addToSidebarHistory(prompt, data.image, Date.now(), true);

    } catch (err) {
      if (err instanceof TypeError) {
        replaceMessage(aiMsg, "ai", "Cannot reach the backend server. Make sure Flask is running on http://127.0.0.1:5000", { error: true });
      } else {
        replaceMessage(aiMsg, "ai", `Unexpected error: ${err.message}`, { error: true });
      }
    } finally {
      isGenerating = false;
      updateSendBtn(sendBtn, promptInput);
      updateSendBtn(sendBtnBottom, promptInputBottom);
      getActivePromptInput().focus();
    }
  }

  // ── SIDEBAR HISTORY ───────────────────────────────────────
  function addToSidebarHistory(prompt, imageSrc, timestamp, prepend = true) {
    const el = document.createElement("button");
    el.classList.add("sidebar-item", "history-item");

    const shortText = prompt.length > 30 ? prompt.slice(0, 30) + "…" : prompt;
    const timeStr = timestamp ? formatTime(timestamp) : "";

    el.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
      <div class="history-text">
        <span class="history-prompt">${shortText}</span>
        ${timeStr ? `<span class="history-time">${timeStr}</span>` : ""}
      </div>
    `;

    // Clicking a history item shows it in chat
    el.addEventListener("click", () => {
      // Clear chat and show this conversation
      chatMessages.innerHTML = "";
      chatMessages.appendChild(welcomeScreen);
      welcomeScreen.classList.add("hidden");

      // Switch to chat mode
      activateChatMode();

      addMessage("user", prompt);
      if (imageSrc) {
        const shortP = prompt.slice(0, 60) + (prompt.length > 60 ? "…" : "");
        addMessage("ai", `Here's your image for "${shortP}"`, { image: imageSrc });
      }
      sidebar.classList.remove("open");
    });

    if (prepend) {
      sidebarHistory.prepend(el);
    } else {
      sidebarHistory.appendChild(el);
    }
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  }

  // ── DOWNLOAD (saves to Downloads folder) ──────────────────
  function downloadImage(dataUri, promptText) {
    if (!dataUri) return;

    // Create a proper filename
    const safeName = (promptText || "NeuralCanvas_image")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60) || "NeuralCanvas_image";
    const fileName = `NeuralCanvas_${safeName}.png`;

    // For data URIs, convert to blob for a cleaner download
    if (dataUri.startsWith("data:")) {
      const byteString = atob(dataUri.split(",")[1]);
      const mimeString = dataUri.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup blob URL after a short delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } else {
      const link = document.createElement("a");
      link.href = dataUri;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

})();

(() => {
  "use strict";

  // ── SUPABASE INIT ─────────────────────────────────────────
  if (typeof supabase === 'undefined' && typeof window.supabase === 'undefined') {
    console.error("Supabase script not loaded.");
    return;
  }
  
  // Use config values
  const supabaseUrl = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
  const supabaseKey = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : (typeof SUPABASE_KEY !== 'undefined' ? SUPABASE_KEY : '');

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase configuration missing in config.js");
  }

  const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

  // ── ROUTING / INIT ────────────────────────────────────────
  const isLoginPage = window.location.pathname.endsWith('login.html');
  const isResetPage = window.location.pathname.endsWith('reset-password.html');

  // Helper to map error messages
  function mapErrorMsg(error) {
    if (!error) return "An unknown error occurred.";
    const msg = error.message || "";
    if (msg.includes("Invalid login credentials")) return "Incorrect email or password.";
    if (msg.includes("User already registered")) return "An account with this email exists. Try signing in.";
    if (msg.includes("Email not confirmed") || msg.includes("email address is not confirmed")) return "Please confirm your email first.";
    if (msg.includes("rate limit") || msg.includes("Too many requests")) return "Too many attempts. Please wait a minute.";
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return "Connection problem. Check your internet and retry.";
    return msg;
  }

  if (isLoginPage) {
    initLoginPage();
  } else if (isResetPage) {
    initResetPage();
  }

  // ── LOGIN PAGE LOGIC ──────────────────────────────────────
  function initLoginPage() {
    // Session check - redirect if already logged in
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.replace("index.html");
      }
    });

    // Check Guest mode
    const btnGuest = document.getElementById("btn-guest");
    const guestContainer = document.getElementById("guest-mode-container");
    if (typeof GUEST_MODE !== 'undefined' && GUEST_MODE === true) {
      if (guestContainer) guestContainer.style.display = 'block';
    }
    if (btnGuest) {
      btnGuest.addEventListener("click", () => {
        sessionStorage.setItem("guest_mode", "true");
        window.location.href = "index.html";
      });
    }

    // Tabs
    const tabSignin = document.getElementById("tab-signin");
    const tabSignup = document.getElementById("tab-signup");
    const formSignin = document.getElementById("form-signin");
    const formSignup = document.getElementById("form-signup");
    const authMain = document.getElementById("auth-main-container");
    const forgotContainer = document.getElementById("auth-forgot-container");
    const checkInboxContainer = document.getElementById("auth-check-inbox");

    function switchTab(tab) {
      if (tab === "signup") {
        tabSignin.classList.remove("active");
        tabSignup.classList.add("active");
        formSignin.classList.remove("active");
        formSignup.classList.add("active");
        window.location.hash = "signup";
      } else {
        tabSignup.classList.remove("active");
        tabSignin.classList.add("active");
        formSignup.classList.remove("active");
        formSignin.classList.add("active");
        window.location.hash = "signin";
      }
      authMain.style.display = "block";
      forgotContainer.classList.remove("active");
      checkInboxContainer.style.display = "none";
    }

    if (window.location.hash === "#signup") switchTab("signup");
    
    tabSignin?.addEventListener("click", () => switchTab("signin"));
    tabSignup?.addEventListener("click", () => switchTab("signup"));

    // Toggle Password Visibility
    document.querySelectorAll(".auth-toggle-pwd").forEach(btn => {
      btn.addEventListener("click", function() {
        const input = this.previousElementSibling;
        const type = input.getAttribute("type") === "password" ? "text" : "password";
        input.setAttribute("type", type);
        
        // Update SVG (eye open/closed)
        if (type === "text") {
          this.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>`;
        } else {
          this.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        }
      });
    });

    // Password Strength Logic
    const signupPwd = document.getElementById("signup-pwd");
    const pwdBar1 = document.getElementById("pwd-bar-1");
    const pwdBar2 = document.getElementById("pwd-bar-2");
    const pwdBar3 = document.getElementById("pwd-bar-3");
    const pwdStrText = document.getElementById("pwd-str-text");
    const ruleLen = document.getElementById("rule-len");
    const btnSubmitSignup = document.getElementById("btn-submit-signup");
    const signupTerms = document.getElementById("signup-terms");
    
    function validateSignupForm() {
      const p = signupPwd ? signupPwd.value : "";
      const isLen = p.length >= 8;
      const hasTerms = signupTerms ? signupTerms.checked : false;
      
      if (ruleLen) {
        if (isLen) ruleLen.classList.add("valid");
        else ruleLen.classList.remove("valid");
      }
      
      // Basic strength estimation
      let strength = 0;
      if (isLen) strength++;
      if (/[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p)) strength++;
      if (/[^A-Za-z0-9]/.test(p)) strength++;
      
      if (pwdBar1) pwdBar1.style.background = strength >= 1 ? "var(--danger)" : "var(--border)";
      if (pwdBar2) pwdBar2.style.background = strength >= 2 ? "var(--warning)" : "var(--border)";
      if (pwdBar3) pwdBar3.style.background = strength >= 3 ? "var(--success)" : "var(--border)";
      
      if (pwdStrText) {
        if (p.length === 0) pwdStrText.textContent = "Weak";
        else if (strength === 1) pwdStrText.textContent = "Weak";
        else if (strength === 2) pwdStrText.textContent = "Fair";
        else if (strength === 3) pwdStrText.textContent = "Strong";
      }

      if (btnSubmitSignup) {
        btnSubmitSignup.disabled = !(isLen && hasTerms);
      }
    }

    signupPwd?.addEventListener("input", validateSignupForm);
    signupTerms?.addEventListener("change", validateSignupForm);

    // Form Submissions
    
    // SIGN IN
    formSignin?.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const email = document.getElementById("signin-email").value.trim();
      const pwd = document.getElementById("signin-pwd").value;
      const globalErr = document.getElementById("signin-global-err");
      const btn = document.getElementById("btn-submit-signin");
      const spinner = document.getElementById("spinner-signin");
      
      globalErr.textContent = "";
      
      if (!email || !pwd) {
        globalErr.textContent = "Please fill in all fields.";
        return;
      }
      
      btn.disabled = true;
      spinner.classList.add("active");
      
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password: pwd
      });
      
      if (error) {
        globalErr.textContent = mapErrorMsg(error);
        if (error.message.includes("Email not confirmed")) {
          // Add a resend link manually
          globalErr.innerHTML = `Please confirm your email first. <a href="#" id="inline-resend" style="color: var(--gold); text-decoration: underline;">Resend</a>`;
          document.getElementById("inline-resend").addEventListener("click", async (e) => {
            e.preventDefault();
            await supabaseClient.auth.resend({ type: 'signup', email });
            globalErr.textContent = "Confirmation email resent. Check your inbox.";
          });
        }
        btn.disabled = false;
        spinner.classList.remove("active");
      } else {
        sessionStorage.removeItem("guest_mode");
        window.location.replace("index.html");
      }
    });

    // SIGN UP
    let lastSignupEmail = "";
    formSignup?.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const name = document.getElementById("signup-name").value.trim();
      const email = document.getElementById("signup-email").value.trim();
      const pwd = document.getElementById("signup-pwd").value;
      const pwdConfirm = document.getElementById("signup-pwd-confirm").value;
      const globalErr = document.getElementById("signup-global-err");
      const pwdConfirmErr = document.getElementById("signup-pwd-confirm-err");
      
      const btn = document.getElementById("btn-submit-signup");
      const spinner = document.getElementById("spinner-signup");
      
      globalErr.textContent = "";
      pwdConfirmErr.textContent = "";
      pwdConfirmErr.classList.remove("active");
      
      if (pwd !== pwdConfirm) {
        pwdConfirmErr.textContent = "Passwords do not match.";
        pwdConfirmErr.classList.add("active");
        return;
      }
      
      btn.disabled = true;
      spinner.classList.add("active");
      
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password: pwd,
        options: {
          data: { full_name: name },
          emailRedirectTo: window.location.origin + window.location.pathname.replace("login.html", "index.html")
        }
      });
      
      if (error) {
        globalErr.textContent = mapErrorMsg(error);
        btn.disabled = false;
        spinner.classList.remove("active");
      } else {
        lastSignupEmail = email;
        spinner.classList.remove("active");
        // If auto-confirm is enabled, session will exist. Otherwise, show inbox message.
        if (data.session) {
          sessionStorage.removeItem("guest_mode");
          window.location.replace("index.html");
        } else {
          authMain.style.display = "none";
          document.getElementById("inbox-email-display").textContent = email;
          checkInboxContainer.style.display = "flex";
        }
      }
    });

    // RESEND EMAIL
    const btnResend = document.getElementById("btn-resend-email");
    const resendCountdown = document.getElementById("resend-countdown");
    btnResend?.addEventListener("click", async () => {
      if (btnResend.disabled || !lastSignupEmail) return;
      
      btnResend.disabled = true;
      const { error } = await supabaseClient.auth.resend({
        type: 'signup',
        email: lastSignupEmail
      });
      
      if (error) {
        resendCountdown.textContent = mapErrorMsg(error);
        btnResend.disabled = false;
        return;
      }
      
      let timeLeft = 60;
      resendCountdown.textContent = `Sent! You can resend again in ${timeLeft}s`;
      
      const interval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(interval);
          btnResend.disabled = false;
          resendCountdown.textContent = "";
        } else {
          resendCountdown.textContent = `Sent! You can resend again in ${timeLeft}s`;
        }
      }, 1000);
    });

    // FORGOT PASSWORD
    const btnForgot = document.getElementById("btn-forgot-pwd");
    const btnBackLogin = document.getElementById("btn-back-login");
    
    function closeForgotPanel() {
      forgotContainer.classList.remove("active");
      authMain.style.display = "block";
    }

    btnForgot?.addEventListener("click", () => {
      authMain.style.display = "none";
      forgotContainer.classList.add("active");
    });
    
    btnBackLogin?.addEventListener("click", closeForgotPanel);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && forgotContainer.classList.contains("active")) {
        closeForgotPanel();
      }
    });

    const formForgot = document.getElementById("form-forgot");
    formForgot?.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const email = document.getElementById("forgot-email").value.trim();
      const globalErr = document.getElementById("forgot-global-err");
      const successMsg = document.getElementById("forgot-success-msg");
      const btn = document.getElementById("btn-submit-forgot");
      const spinner = document.getElementById("spinner-forgot");
      
      globalErr.textContent = "";
      successMsg.style.display = "none";
      
      if (!email) {
        globalErr.textContent = "Please enter your email.";
        return;
      }
      
      btn.disabled = true;
      spinner.classList.add("active");
      
      const resetUrl = window.location.origin + window.location.pathname.replace("login.html", "reset-password.html");
      
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      });
      
      btn.disabled = false;
      spinner.classList.remove("active");
      
      if (error) {
        // Always show the same neutral message as requested, even on error, to prevent guessing.
        // Wait, the prompt says: "Always show the same neutral message ("If that email exists, we sent a link") so accounts cannot be guessed". 
        // We will just show the success message regardless of error (unless it's a rate limit).
        if (error.message.includes("rate limit")) {
          globalErr.textContent = mapErrorMsg(error);
        } else {
          successMsg.style.display = "block";
        }
      } else {
        successMsg.style.display = "block";
      }
    });

    // Input Validation Styles
    document.querySelectorAll(".auth-input").forEach(input => {
      input.addEventListener("input", function() {
        if (this.validity.valid) {
          this.removeAttribute("aria-invalid");
          const errBox = document.getElementById(`${this.id}-err`);
          if (errBox) errBox.classList.remove("active");
        }
      });
      input.addEventListener("invalid", function(e) {
        e.preventDefault();
        this.setAttribute("aria-invalid", "true");
        const errBox = document.getElementById(`${this.id}-err`);
        if (errBox) {
          errBox.textContent = this.validationMessage;
          errBox.classList.add("active");
        }
      });
    });
  }

  // ── RESET PASSWORD PAGE LOGIC ─────────────────────────────
  function initResetPage() {
    const invalidMsg = document.getElementById("reset-invalid-msg");
    const formReset = document.getElementById("form-reset");

    // Listen for auth state change to verify the recovery token
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && window.location.hash.includes('type=recovery'))) {
        invalidMsg.style.display = "none";
        formReset.style.display = "flex";
      }
    });

    // Also check on load, if session exists it means we might be ready to update
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        invalidMsg.style.display = "none";
        formReset.style.display = "flex";
      }
    });

    // Toggle Password Visibility
    document.querySelectorAll(".auth-toggle-pwd").forEach(btn => {
      btn.addEventListener("click", function() {
        const input = this.previousElementSibling;
        const type = input.getAttribute("type") === "password" ? "text" : "password";
        input.setAttribute("type", type);
        if (type === "text") {
          this.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>`;
        } else {
          this.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        }
      });
    });

    // Password Strength Logic
    const resetPwd = document.getElementById("reset-pwd");
    const pwdBar1 = document.getElementById("pwd-bar-1");
    const pwdBar2 = document.getElementById("pwd-bar-2");
    const pwdBar3 = document.getElementById("pwd-bar-3");
    const pwdStrText = document.getElementById("pwd-str-text");
    const ruleLen = document.getElementById("rule-len");
    const btnSubmitReset = document.getElementById("btn-submit-reset");

    function validateResetForm() {
      const p = resetPwd ? resetPwd.value : "";
      const isLen = p.length >= 8;
      
      if (ruleLen) {
        if (isLen) ruleLen.classList.add("valid");
        else ruleLen.classList.remove("valid");
      }
      
      let strength = 0;
      if (isLen) strength++;
      if (/[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p)) strength++;
      if (/[^A-Za-z0-9]/.test(p)) strength++;
      
      if (pwdBar1) pwdBar1.style.background = strength >= 1 ? "var(--danger)" : "var(--border)";
      if (pwdBar2) pwdBar2.style.background = strength >= 2 ? "var(--warning)" : "var(--border)";
      if (pwdBar3) pwdBar3.style.background = strength >= 3 ? "var(--success)" : "var(--border)";
      
      if (pwdStrText) {
        if (p.length === 0) pwdStrText.textContent = "Weak";
        else if (strength === 1) pwdStrText.textContent = "Weak";
        else if (strength === 2) pwdStrText.textContent = "Fair";
        else if (strength === 3) pwdStrText.textContent = "Strong";
      }

      if (btnSubmitReset) {
        btnSubmitReset.disabled = !isLen;
      }
    }

    resetPwd?.addEventListener("input", validateResetForm);

    formReset?.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const pwd = document.getElementById("reset-pwd").value;
      const pwdConfirm = document.getElementById("reset-pwd-confirm").value;
      const globalErr = document.getElementById("reset-global-err");
      const successMsg = document.getElementById("reset-success-msg");
      const btn = document.getElementById("btn-submit-reset");
      const spinner = document.getElementById("spinner-reset");
      const pwdConfirmErr = document.getElementById("reset-pwd-confirm-err");
      
      globalErr.textContent = "";
      pwdConfirmErr.textContent = "";
      pwdConfirmErr.classList.remove("active");
      
      if (pwd !== pwdConfirm) {
        pwdConfirmErr.textContent = "Passwords do not match.";
        pwdConfirmErr.classList.add("active");
        return;
      }
      
      btn.disabled = true;
      spinner.classList.add("active");
      
      const { error } = await supabaseClient.auth.updateUser({ password: pwd });
      
      spinner.classList.remove("active");
      
      if (error) {
        globalErr.textContent = mapErrorMsg(error);
        btn.disabled = false;
      } else {
        successMsg.style.display = "block";
        setTimeout(() => {
          window.location.replace("login.html");
        }, 2000);
      }
    });

    // Input Validation Styles
    document.querySelectorAll(".auth-input").forEach(input => {
      input.addEventListener("input", function() {
        if (this.validity.valid) {
          this.removeAttribute("aria-invalid");
          const errBox = document.getElementById(`${this.id}-err`);
          if (errBox) errBox.classList.remove("active");
        }
      });
      input.addEventListener("invalid", function(e) {
        e.preventDefault();
        this.setAttribute("aria-invalid", "true");
        const errBox = document.getElementById(`${this.id}-err`);
        if (errBox) {
          errBox.textContent = this.validationMessage;
          errBox.classList.add("active");
        }
      });
    });
  }

})();

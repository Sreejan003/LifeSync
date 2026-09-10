/**
 * LifeSync - Dedicated Auth Page Controller (js/auth-page.js)
 * -------------------------------------------------------------
 * Manages Sign In / Sign Up tab switching, password eye visibility toggle,
 * authentication submission, error handling, and redirection to index.html.
 */

(function () {
    'use strict';

    // DOM Elements
    const elements = {
        tabSignIn: document.querySelector("#tabSignIn"),
        tabSignUp: document.querySelector("#tabSignUp"),
        signInForm: document.querySelector("#signInForm"),
        signUpForm: document.querySelector("#signUpForm"),
        switchToSignUp: document.querySelector("#switchToSignUp"),
        switchToSignIn: document.querySelector("#switchToSignIn"),
        googleAuthBtn: document.querySelector("#googleAuthBtn"),
        authError: document.querySelector("#authError")
    };

    function showAuthError(msg) {
        if (!elements.authError) return;
        elements.authError.innerText = msg;
        elements.authError.classList.remove("hidden");
    }

    function hideAuthError() {
        if (!elements.authError) return;
        elements.authError.innerText = "";
        elements.authError.classList.add("hidden");
    }

    function switchTab(tab) {
        hideAuthError();
        if (tab === 'signin') {
            elements.tabSignIn.classList.add("active");
            elements.tabSignUp.classList.remove("active");
            elements.signInForm.classList.remove("hidden");
            elements.signUpForm.classList.add("hidden");
        } else {
            elements.tabSignUp.classList.add("active");
            elements.tabSignIn.classList.remove("active");
            elements.signUpForm.classList.remove("hidden");
            elements.signInForm.classList.add("hidden");
        }
    }

    function setupPasswordToggles() {
        const toggleBtns = document.querySelectorAll(".password-toggle-btn");
        toggleBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const wrapper = btn.closest(".input-field-wrapper");
                if (!wrapper) return;
                const input = wrapper.querySelector("input");
                const eyeOpen = btn.querySelector(".eye-open");
                const eyeClosed = btn.querySelector(".eye-closed");

                if (input.type === "password") {
                    input.type = "text";
                    if (eyeOpen) eyeOpen.classList.add("hidden");
                    if (eyeClosed) eyeClosed.classList.remove("hidden");
                } else {
                    input.type = "password";
                    if (eyeOpen) eyeOpen.classList.remove("hidden");
                    if (eyeClosed) eyeClosed.classList.add("hidden");
                }
            });
        });
    }

    function redirectToApp(welcomeMsg) {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(welcomeMsg, "success");
        }
        // Mark this browser tab as having an active authenticated session.
        // sessionStorage clears on tab/browser close, so app.js will force re-login on fresh open.
        sessionStorage.setItem('ls_session_active', '1');
        setTimeout(() => {
            window.location.replace("index.html");
        }, 500);
    }

    function initTypewriter() {
        const textElem = document.querySelector("#typewriterText");
        if (!textElem) return;

        const phrases = [
            "Organize, Sync, and Achieve",
            "Track Tasks & Master Habits",
            "Sync Your Student Routine",
            "Achieve Your Daily Goals"
        ];

        let phraseIdx = 0;
        let charIdx = phrases[0].length;
        let isDeleting = true;
        let typingSpeed = 2000;

        function type() {
            const currentPhrase = phrases[phraseIdx];

            if (isDeleting) {
                textElem.innerText = currentPhrase.substring(0, charIdx - 1);
                charIdx--;
                typingSpeed = 35;
            } else {
                textElem.innerText = currentPhrase.substring(0, charIdx + 1);
                charIdx++;
                typingSpeed = 75;
            }

            if (!isDeleting && charIdx === currentPhrase.length) {
                typingSpeed = 2400; // Hold full text
                isDeleting = true;
            } else if (isDeleting && charIdx === 0) {
                isDeleting = false;
                phraseIdx = (phraseIdx + 1) % phrases.length;
                typingSpeed = 350; // Pause before typing next line
            }

            setTimeout(type, typingSpeed);
        }

        setTimeout(type, typingSpeed);
    }

    function initAuthPage() {
        // Handle Back-Forward Cache (bfcache) restorations
        window.addEventListener("pageshow", (event) => {
            if (event.persisted) {
                // If restored from bfcache, ensure state check or reload
                const user = typeof AuthSystem !== 'undefined' ? AuthSystem.getCurrentUser() : null;
                const sessionActive = sessionStorage.getItem('ls_session_active');
                if (user && sessionActive) {
                    window.location.replace("index.html");
                }
            }
        });

        // If already signed in AND in an active session, skip the login page
        if (typeof AuthSystem !== 'undefined') {
            const currentUser = AuthSystem.getCurrentUser();
            const sessionActive = sessionStorage.getItem('ls_session_active');
            if (currentUser && sessionActive) {
                window.location.replace("index.html");
                return;
            }
        }

        // Initialize password visibility toggles & typewriter effect
        setupPasswordToggles();
        initTypewriter();

        // Read URL query params (e.g. auth.html?tab=signup)
        const urlParams = new URLSearchParams(window.location.search);
        const requestedTab = urlParams.get('tab');
        if (requestedTab === 'signup') {
            switchTab('signup');
        } else {
            switchTab('signin');
        }

        // Tab click listeners
        if (elements.tabSignIn) elements.tabSignIn.addEventListener("click", () => switchTab('signin'));
        if (elements.tabSignUp) elements.tabSignUp.addEventListener("click", () => switchTab('signup'));

        if (elements.switchToSignUp) {
            elements.switchToSignUp.addEventListener("click", (e) => {
                e.preventDefault();
                switchTab('signup');
            });
        }

        if (elements.switchToSignIn) {
            elements.switchToSignIn.addEventListener("click", (e) => {
                e.preventDefault();
                switchTab('signin');
            });
        }

        // Sign In Form Submission
        if (elements.signInForm) {
            elements.signInForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const email = document.querySelector("#signInEmail").value;
                const password = document.querySelector("#signInPassword").value;

                try {
                    const user = AuthSystem.signIn({ email, password });
                    redirectToApp(`Welcome back, ${user.username}!`);
                } catch (err) {
                    showAuthError(err.message);
                }
            });
        }

        // Sign Up Form Submission
        if (elements.signUpForm) {
            elements.signUpForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const username = document.querySelector("#signUpUsername").value;
                const email = document.querySelector("#signUpEmail").value;
                const password = document.querySelector("#signUpPassword").value;
                const confirmPassword = document.querySelector("#signUpConfirmPassword").value;

                if (confirmPassword && password !== confirmPassword) {
                    showAuthError("Passwords do not match. Please try again.");
                    return;
                }

                try {
                    const user = AuthSystem.signUp({ username, email, password });
                    redirectToApp(`Account created! Welcome, ${user.username}`);
                } catch (err) {
                    showAuthError(err.message);
                }
            });
        }

        // Google Auth Simulation & Account Picker Modal
        const googleAuthModal = document.querySelector("#googleAuthModal");
        const closeGoogleModal = document.querySelector("#closeGoogleModal");
        const googleTriggers = document.querySelectorAll(".btn-trigger-google, #googleAuthBtn");

        const openGoogleModal = (e) => {
            if (e) e.preventDefault();
            if (googleAuthModal) {
                googleAuthModal.classList.remove("hidden");
                googleAuthModal.classList.add("show");
            }
        };

        const hideGoogleModal = () => {
            if (googleAuthModal) {
                googleAuthModal.classList.add("hidden");
                googleAuthModal.classList.remove("show");
            }
        };

        googleTriggers.forEach(btn => {
            btn.addEventListener("click", openGoogleModal);
        });

        if (closeGoogleModal) {
            closeGoogleModal.addEventListener("click", hideGoogleModal);
        }

        if (googleAuthModal) {
            googleAuthModal.addEventListener("click", (e) => {
                if (e.target === googleAuthModal) hideGoogleModal();
            });
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape" && googleAuthModal.classList.contains("show")) {
                    hideGoogleModal();
                }
            });
        }

        // Handle Quick Google Account Selection (One-click Google Auth)
        const quickGoogleBtns = document.querySelectorAll(".btn-google-quick");
        quickGoogleBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const email = btn.dataset.email;
                const name = btn.dataset.name;

                try {
                    const user = AuthSystem.signInWithGoogle({ username: name, email: email });
                    hideGoogleModal();
                    redirectToApp(`Signed in with Google as ${user.username}`);
                } catch (err) {
                    showAuthError(err.message || "Google Sign-In failed. Please try again.");
                }
            });
        });

        // Handle Google Custom Auth Form Submission
        const googleForm = document.querySelector("#googleCustomAuthForm");
        if (googleForm) {
            googleForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const email = document.querySelector("#googleEmailInput").value.trim();
                const name = document.querySelector("#googleNameInput").value.trim() || email.split("@")[0];

                if (!email) {
                    showAuthError("Please enter a valid Google email address.");
                    return;
                }

                try {
                    const user = AuthSystem.signInWithGoogle({ username: name, email: email });
                    hideGoogleModal();
                    redirectToApp(`Signed in with Google as ${user.username}`);
                } catch (err) {
                    showAuthError(err.message || "Google Sign-In failed. Please try again.");
                }
            });
        }
    }

    document.addEventListener("DOMContentLoaded", initAuthPage);
})();

import { firebaseConfigured, auth } from "./firebase-client.js";
import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    linkWithCredential,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const form = document.querySelector("#auth-form");
const nameField = document.querySelector("#display-name-field");
const nameInput = document.querySelector("#display-name");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const message = document.querySelector("#auth-message");
const submitButton = document.querySelector("#submit-auth");
const googleButton = document.querySelector("#google-sign-in");
const resetButton = document.querySelector("#reset-password");
const switchButton = document.querySelector("#switch-mode");
const signedInPanel = document.querySelector("#signed-in-panel");
const signedInDetails = document.querySelector("#signed-in-details");
const signOutButton = document.querySelector("#sign-out");
let mode = "signin";
let pendingGoogleCredential = null;
let pendingGoogleEmail = "";

function showMessage(text, isError = false) {
    message.textContent = text;
    message.dataset.error = String(isError);
}

function setMode(nextMode) {
    mode = nextMode;
    const isSignup = mode === "signup";
    nameField.hidden = !isSignup;
    nameInput.required = isSignup;
    submitButton.textContent = pendingGoogleCredential
        ? "Sign in and link Google"
        : isSignup ? "Create account" : "Sign in";
    switchButton.textContent = isSignup ? "Already registered? Sign in" : "New here? Create an account";
    showMessage("");
}

function safeReturnLocation() {
    const next = new URLSearchParams(location.search).get("next");
    return next === "publications.html" ? "publications.html" : "index.html";
}

function readableAuthError(error) {
    const messages = {
        "auth/email-already-in-use": "An account already uses this email. Sign in instead.",
        "auth/invalid-credential": "Email or password is incorrect.",
        "auth/wrong-password": "Email or password is incorrect.",
        "auth/weak-password": "Choose a password with at least 8 characters.",
        "auth/invalid-email": "Enter a valid email address.",
        "auth/popup-closed-by-user": "Google sign-in was closed before it finished.",
        "auth/unauthorized-domain": "This site domain is not enabled in Firebase Authentication settings.",
        "auth/credential-already-in-use": "This Google account is already linked to another account."
    };
    return messages[error.code] || "Authentication failed. Check Firebase setup and try again.";
}

if (!firebaseConfigured) {
    showMessage("Set the Firebase web app values in firebase-client.js before using sign-in.", true);
    form.querySelectorAll("input, button").forEach(control => { control.disabled = true; });
    googleButton.disabled = true;
    resetButton.disabled = true;
} else {
    switchButton.addEventListener("click", () => {
        if (pendingGoogleCredential) return;
        setMode(mode === "signin" ? "signup" : "signin");
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        submitButton.disabled = true;
        try {
            if (pendingGoogleCredential) {
                const email = emailInput.value.trim();
                if (email.toLowerCase() !== pendingGoogleEmail.toLowerCase()) {
                    showMessage("Sign in with the email address used for the Google account.", true);
                    return;
                }
                const credential = await signInWithEmailAndPassword(auth, email, passwordInput.value);
                await linkWithCredential(credential.user, pendingGoogleCredential);
                pendingGoogleCredential = null;
                pendingGoogleEmail = "";
                emailInput.readOnly = false;
                switchButton.disabled = false;
                showMessage("Google sign-in is now linked to your account.");
            } else if (mode === "signup") {
                const credential = await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
                const displayName = nameInput.value.trim();
                if (displayName) await updateProfile(credential.user, { displayName });
                showMessage("Account created. You are signed in.");
            } else {
                await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
                showMessage("Signed in successfully.");
            }
            location.assign(safeReturnLocation());
        } catch (error) {
            showMessage(readableAuthError(error), true);
        } finally {
            submitButton.disabled = false;
        }
    });

    googleButton.addEventListener("click", async () => {
        if (pendingGoogleCredential) {
            showMessage("Sign in with your existing password to link this Google account.", true);
            return;
        }
        googleButton.disabled = true;
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
            location.assign(safeReturnLocation());
        } catch (error) {
            if (error.code === "auth/account-exists-with-different-credential") {
                const googleCredential = GoogleAuthProvider.credentialFromError(error);
                const email = error.customData?.email || "";
                if (googleCredential && email) {
                    pendingGoogleCredential = googleCredential;
                    pendingGoogleEmail = email;
                    setMode("signin");
                    emailInput.value = email;
                    emailInput.readOnly = true;
                    switchButton.disabled = true;
                    submitButton.textContent = "Sign in and link Google";
                    showMessage("This email already has a password account. Enter its password once to link Google sign-in.");
                    passwordInput.focus();
                } else {
                    showMessage(readableAuthError(error), true);
                }
            } else {
                showMessage(readableAuthError(error), true);
            }
        } finally {
            googleButton.disabled = false;
        }
    });

    resetButton.addEventListener("click", async () => {
        if (!emailInput.value.trim()) {
            showMessage("Enter your email first, then choose Forgot password.", true);
            emailInput.focus();
            return;
        }
        try {
            await sendPasswordResetEmail(auth, emailInput.value.trim());
            showMessage("Password reset email sent.");
        } catch (error) {
            showMessage(readableAuthError(error), true);
        }
    });

    signOutButton.addEventListener("click", () => signOut(auth));

    onAuthStateChanged(auth, async user => {
        if (!user) {
            signedInPanel.hidden = true;
            return;
        }
        const token = await user.getIdTokenResult();
        const role = token.claims.admin === true ? "Administrator" : "Standard user";
        signedInDetails.textContent = `${user.displayName || user.email} — ${role}`;
        signedInPanel.hidden = false;
    });
}

import { auth } from "./firebase-client.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const signInLink = document.querySelector("#nav-sign-in");
const signOutButton = document.querySelector("#nav-sign-out");
const userStatus = document.querySelector("#nav-user-status");

if (signInLink && signOutButton) {
    signOutButton.addEventListener("click", async () => {
        signOutButton.disabled = true;
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Sign out failed:", error);
            if (userStatus) userStatus.textContent = "Unable to sign out. Please try again.";
        } finally {
            signOutButton.disabled = false;
        }
    });

    onAuthStateChanged(auth, user => {
        signInLink.hidden = Boolean(user);
        signOutButton.hidden = !user;
        if (userStatus) {
            userStatus.textContent = user ? `Signed in${user.displayName ? ` as ${user.displayName}` : ""}` : "";
            userStatus.title = user?.email || "";
        }
        if (user) signOutButton.setAttribute("aria-label", `Sign out${user.email ? ` (${user.email})` : ""}`);
    });
}

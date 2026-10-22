const { applicationDefault, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

initializeApp({ credential: applicationDefault(), projectId: "dreamswebsite-90f39" });

async function main() {
    const [uid, operation = "grant"] = process.argv.slice(2);
    if (!uid || !["grant", "revoke"].includes(operation)) {
        console.error("Usage: node set-admin.js <Firebase-Auth-UID> [grant|revoke]");
        process.exitCode = 1;
        return;
    }

    const auth = getAuth();
    const user = await auth.getUser(uid);
    const claims = { ...(user.customClaims || {}) };uid
    if (operation === "grant") claims.admin = true;
    else delete claims.admin;

    await auth.setCustomUserClaims(uid, claims);
    console.log(`Admin access ${operation === "grant" ? "granted to" : "revoked for"} ${uid}.`);
    console.log("The user must sign out and back in (or refresh their ID token) for the new role to take effect.");
}

main().catch(error => {
    console.error("Could not update admin claim:", error.message);
    process.exitCode = 1;
});

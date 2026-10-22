# Firebase authentication and publications setup

## Protect the service account credential first

A Firebase Admin service-account private key was exposed in a shared prompt. Treat that key as compromised: disable/delete that key in Google Cloud Console → IAM & Admin → Service Accounts → the service account → Keys, and review service-account activity. Do not copy that JSON into this website, source control, or the admin-tools folder. The Admin SDK is server-side only.

## Configure the website

1. In Firebase Console, confirm the project is `dreamswebsite-90f39` and register a Web app under Project settings → General → Your apps.
2. Copy its Web app configuration into `firebase-client.js`: `apiKey`, `authDomain`, `projectId`, and `appId`. These are client configuration values, not the service-account JSON.
3. In Authentication → Sign-in method, enable Email/Password and Google. Add the deployed site hostname to Authentication → Settings → Authorized domains. Google sign-in popups and Firebase web authentication require serving the site over HTTPS or localhost; opening HTML via `file://` will not work.
4. Create/enable Cloud Firestore in the same project. This setup uses Firestore and Firebase Authentication, not Firebase Storage or Cloud Functions, and does not require Firebase billing. Firestore's no-cost quotas still apply.
5. In Cloudinary, use the cloud named `dp7se31bt`, enable PDF/raw-file delivery, and configure the unsigned upload preset `publications_unsigned` with the `publications` asset folder. Restrict the preset to PDF files and set a maximum file size (15 MB is the limit enforced by the site). No Cloudinary API secret is used in the website.
6. In Cloudinary, create a separate unsigned image upload preset named `projects_unsigned` and set its asset folder to `projects`. Restrict it to JPG, PNG, and WebP images and set a maximum file size of 5 MB. The website uses this preset for up to six images per project. Unsigned presets are public, so the preset's restrictions apply to everyone who uploads.
7. Deploy the Firestore rules:

   ```text
   firebase deploy --only firestore:rules
   ```

   Publication and project records are publicly readable but only admins can create, edit, or delete them. The site only shows management controls to accounts with the `admin: true` custom claim.
8. Host the site through Firebase Hosting or another HTTP(S) static host. The Firebase Hosting settings in `firebase.json` publish the website root and exclude the admin tools.

With the no-backend setup, deleting a publication removes its Firestore record and hides it from the website, but does not delete the Cloudinary file. Replacing a PDF also leaves the old file in Cloudinary. Remove unused assets manually in Cloudinary's Media Library. Uploading a PDF before a Firestore write fails can likewise leave an unreferenced Cloudinary file. Publications saved with the previous Firebase Storage setup must be uploaded again to Cloudinary before they appear on this page.

Project images also use an unsigned Cloudinary preset. Deleting a project or replacing its images removes or updates the Firestore record only; clean up unused Cloudinary assets manually in the Media Library. The first administrator visit to the projects page imports the original three static projects into Firestore so that they can be managed from the admin controls.

Email/password signup and Google sign-in create ordinary accounts. If a Google sign-in uses an email that already belongs to a password account, Firebase requires the user to sign in with that account's password once before the Google provider can be linked. After linking, either sign-in method works for that account. A user is not an admin unless a trusted operator assigns the `admin: true` custom claim; Firestore rules enforce authorization for publication records.

## Assign or revoke administrator access

Use a trusted workstation and an authorized Google Cloud identity with Firebase Authentication administration permission. Prefer Application Default Credentials; do not use the exposed credential file. From `admin-tools`, install the package dependencies, authenticate ADC with the Google Cloud CLI, then run `node set-admin.js <AUTH_USER_UID> grant` or `node set-admin.js <AUTH_USER_UID> revoke`. Find the UID in Firebase Console → Authentication → Users. The script preserves other existing custom claims. The user needs a fresh sign-in/token before the updated role appears.

Keep `admin-tools` private and out of web hosting. Never put Firebase Admin SDK credentials or Admin SDK code in client JavaScript. Restrict administrator accounts and periodically review them.

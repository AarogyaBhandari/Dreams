import { auth, db } from "./firebase-client.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const CLOUDINARY_CLOUD_NAME = "dp7se31bt";
const CLOUDINARY_UPLOAD_PRESET = "publications_unsigned";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const listElement = document.querySelector("#publication-list");
const filterElement = document.querySelector("#year-filter");
const emptyElement = document.querySelector("#empty-state");
const formElement = document.querySelector("#publication-form");
const formStatus = document.querySelector("#form-status");
const fileInput = formElement.elements.file;
const submitButton = formElement.querySelector("button[type=submit]");
const cancelEditButton = document.querySelector("#cancel-edit");
const adminArea = document.querySelector(".admin-area");
const adminToggle = document.querySelector("#admin-toggle");
const adminPanel = document.querySelector("#admin-panel");
const adminHeading = document.querySelector("#admin-heading");
const loginLink = document.querySelector("#nav-sign-in");
const userStatus = document.querySelector("#nav-user-status");
let publications = [];
let isAdmin = false;
let editingPublication = null;

adminToggle.addEventListener("click", () => {
    const expanded = adminToggle.getAttribute("aria-expanded") === "true";
    adminToggle.setAttribute("aria-expanded", String(!expanded));
    adminPanel.hidden = expanded;
});

function showFormStatus(message, isError = false) {
    formStatus.textContent = message;
    formStatus.style.color = isError ? "#a12626" : "#176b37";
}

function formatDate(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric"
    });
}

function cloudinaryUrl(publicId) {
    const encodedId = publicId.split("/").map(encodeURIComponent).join("/");
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/raw/upload/${encodedId}`;
}

function updateYearFilter() {
    const selectedYear = filterElement.value;
    const years = [...new Set(publications.map(item => String(item.publishedAt).slice(0, 4)))].sort().reverse();
    filterElement.replaceChildren(new Option("All years", "all"));
    years.forEach(year => filterElement.add(new Option(year, year)));
    filterElement.value = years.includes(selectedYear) ? selectedYear : "all";
}

function resetPublicationForm() {
    editingPublication = null;
    formElement.reset();
    fileInput.required = true;
    adminHeading.textContent = "Add publication";
    submitButton.textContent = "Save publication";
    cancelEditButton.hidden = true;
    showFormStatus("");
}

async function uploadCloudinaryPdf(file) {
    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    uploadData.append("public_id", `publications/${auth.currentUser.uid}/${crypto.randomUUID()}.pdf`);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`, {
        method: "POST",
        body: uploadData
    });
    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error?.message || `Cloudinary upload failed (${response.status}).`);
    }
    const result = await response.json();
    if (result.resource_type !== "raw" || !/^publications\/[A-Za-z0-9_-]{1,128}\/[a-f0-9-]{36}\.pdf$/.test(result.public_id)) {
        throw new Error("Cloudinary returned an unexpected publication file.");
    }
    return result.public_id;
}

async function renderPublications() {
    updateYearFilter();
    listElement.replaceChildren();
    const selectedYear = filterElement.value;
    const visible = publications.filter(item => selectedYear === "all" || String(item.publishedAt).startsWith(selectedYear));

    for (const publication of visible) {
        const item = document.createElement("li");
        item.className = "publication-item";
        const title = document.createElement("h3");
        title.className = "publication-title";
        title.textContent = publication.title;
        item.append(title);

        const metadata = document.createElement("p");
        metadata.className = "publication-meta";
        metadata.textContent = `Authors: ${publication.authors || "Not specified"} | Published: ${formatDate(publication.publishedAt)}${publication.publisher ? ` | Publisher: ${publication.publisher}` : ""}`;
        item.append(metadata);

        if (publication.description) {
            const description = document.createElement("p");
            description.className = "publication-description";
            description.textContent = publication.description;
            item.append(description);
        }

        const actions = document.createElement("div");
        actions.className = "publication-actions";
        try {
            const link = document.createElement("a");
            link.href = cloudinaryUrl(publication.publicId);
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "View publication (PDF)";
            actions.append(link);
        } catch (error) {
            const unavailable = document.createElement("span");
            unavailable.textContent = "PDF currently unavailable";
            actions.append(unavailable);
            console.error("Could not load publication file:", error);
        }

        if (isAdmin) {
            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "edit-publication";
            editButton.textContent = "Edit";
            editButton.addEventListener("click", () => {
                editingPublication = publication;
                formElement.elements.title.value = publication.title || "";
                formElement.elements.authors.value = publication.authors || "";
                formElement.elements.publishedAt.value = publication.publishedAt || "";
                formElement.elements.publisher.value = publication.publisher || "";
                formElement.elements.description.value = publication.description || "";
                fileInput.value = "";
                fileInput.required = false;
                adminHeading.textContent = "Edit publication";
                submitButton.textContent = "Update publication";
                cancelEditButton.hidden = false;
                showFormStatus("");
                adminPanel.hidden = false;
                adminToggle.setAttribute("aria-expanded", "true");
                formElement.scrollIntoView({ behavior: "smooth", block: "start" });
            });
            actions.append(editButton);

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "remove-publication";
            removeButton.textContent = "Delete";
            removeButton.addEventListener("click", async () => {
                if (!confirm(`Remove “${publication.title}” from the website? Its PDF will remain in Cloudinary and must be deleted manually.`)) return;
                removeButton.disabled = true;
                try {
                    await deleteDoc(doc(db, "publications", publication.id));
                    publications = publications.filter(item => item.id !== publication.id);
                    await renderPublications();
                } catch (error) {
                    console.error("Publication removal failed:", error);
                    removeButton.disabled = false;
                    alert("Could not delete the publication. Check your connection and administrator access, then try again.");
                }
            });
            actions.append(removeButton);
        }
        item.append(actions);
        listElement.append(item);
    }

    emptyElement.hidden = visible.length > 0;
}

async function loadPublications() {
    try {
        const snapshot = await getDocs(query(collection(db, "publications"), orderBy("publishedAt", "desc")));
        publications = snapshot.docs
            .map(publication => ({ id: publication.id, ...publication.data() }))
            .filter(publication => typeof publication.publicId === "string");
        await renderPublications();
    } catch (error) {
        console.error("Could not load publications:", error);
        listElement.replaceChildren();
        emptyElement.hidden = false;
        emptyElement.textContent = "Publications could not be loaded. Check Firebase configuration and Firestore rules.";
    }
}

filterElement.addEventListener("change", () => { renderPublications(); });
cancelEditButton.addEventListener("click", resetPublicationForm);

onAuthStateChanged(auth, async user => {
    if (loginLink) loginLink.hidden = Boolean(user);
    userStatus.textContent = user ? `Signed in: ${user.displayName || user.email}` : "Browsing as a guest";
    isAdmin = false;
    adminArea.hidden = true;

    if (user) {
        try {
            const token = await user.getIdTokenResult(true);
            isAdmin = token.claims.admin === true;
            adminArea.hidden = !isAdmin;
            if (isAdmin) userStatus.textContent += " (Admin)";
        } catch (error) {
            console.error("Could not verify account role:", error);
        }
    }
    await renderPublications();
});

formElement.addEventListener("submit", async event => {
    event.preventDefault();
    if (!auth.currentUser || !isAdmin) {
        showFormStatus("Only an administrator can manage publications.", true);
        return;
    }

    const data = new FormData(formElement);
    const file = data.get("file");
    if (file instanceof File && file.size > 0 &&
        (file.type !== "application/pdf" || file.size > MAX_FILE_SIZE)) {
        showFormStatus("Choose a PDF file no larger than 15 MB.", true);
        return;
    }
    if (!editingPublication && (!(file instanceof File) || file.size === 0)) {
        showFormStatus("Choose a PDF file to upload.", true);
        return;
    }

    submitButton.disabled = true;
    cancelEditButton.disabled = true;
    let newPublicId = null;
    showFormStatus(file instanceof File && file.size > 0 ? "Uploading publication…" : "Saving changes…");
    try {
        if (file instanceof File && file.size > 0) {
            newPublicId = await uploadCloudinaryPdf(file);
        }
        const documentData = {
            title: String(data.get("title")).trim(),
            authors: String(data.get("authors")).trim(),
            publishedAt: String(data.get("publishedAt")),
            publisher: String(data.get("publisher")).trim(),
            description: String(data.get("description")).trim()
        };

        if (editingPublication) {
            const updateData = { ...documentData };
            if (newPublicId) updateData.publicId = newPublicId;
            await updateDoc(doc(db, "publications", editingPublication.id), updateData);
            resetPublicationForm();
            showFormStatus(newPublicId
                ? "Publication updated. Its previous PDF remains in Cloudinary and can be removed from the Cloudinary dashboard."
                : "Publication updated.");
        } else {
            await addDoc(collection(db, "publications"), {
                ...documentData,
                publicId: newPublicId,
                uploadedBy: auth.currentUser.uid,
                createdAt: serverTimestamp()
            });
            resetPublicationForm();
            showFormStatus("Publication uploaded and published.");
        }
        await loadPublications();
    } catch (error) {
        console.error("Publication save failed:", error);
        const detail = error instanceof Error ? ` ${error.message}` : "";
        showFormStatus(newPublicId
            ? `The PDF uploaded, but its publication record could not be saved. Remove the unused PDF from the Cloudinary dashboard and check Firestore admin permissions.${detail}`
            : `Could not save the publication. Check Firestore rules, Cloudinary configuration, and your connection.${detail}`, true);
    } finally {
        submitButton.disabled = false;
        cancelEditButton.disabled = false;
    }
});

loadPublications();

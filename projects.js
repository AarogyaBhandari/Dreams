import { auth, db } from "./firebase-client.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const CLOUDINARY_CLOUD_NAME = "dp7se31bt";
const CLOUDINARY_UPLOAD_PRESET = "projects_unsigned";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 6;
const SEED_MARKER_ID = "_legacy-seed-complete";
const legacyProjects = [
    {
        id: "legacy-community-resilience",
        title: "Community Resilience Building in Rural Nepal",
        category: "Community resilience",
        description: "Enhancing rural community resilience through training, infrastructure development and practical awareness programmes.",
        imageUrls: ["pictures/Flyer page 1.jpg", "pictures/Flyer page 2.jpg"]
    },
    {
        id: "legacy-urban-flood-management",
        title: "Urban Flood Management Initiative",
        category: "Flood risk reduction",
        description: "Supporting urban flood risk reduction with early warning systems and community-based response strategies.",
        imageUrls: ["pictures/Flyer page 3.jpg", "pictures/Flyer page 4.jpg"]
    },
    {
        id: "legacy-local-government-training",
        title: "Disaster Preparedness Training for Local Governments",
        category: "Prepared local government",
        description: "Building the capacity of local government officials to plan for and coordinate disaster preparedness and response.",
        imageUrls: ["pictures/Glyer page 5.jpg", "pictures/thumbnail_Dreams.png"]
    }
];

const grid = document.querySelector("#projects-grid");
const emptyState = document.querySelector("#empty-projects");
const adminArea = document.querySelector("#admin-area");
const adminToggle = document.querySelector("#admin-toggle");
const formPanel = document.querySelector("#project-form-panel");
const form = document.querySelector("#project-form");
const formHeading = document.querySelector("#project-form-heading");
const formStatus = document.querySelector("#project-status");
const imageInput = form.elements.images;
const saveButton = document.querySelector("#save-project");
const cancelButton = document.querySelector("#cancel-project-edit");
const dialog = document.querySelector("#project-dialog");
const dialogClose = document.querySelector("#dialog-close");
const detailImage = document.querySelector("#project-detail-image");
const detailCategory = document.querySelector("#project-detail-category");
const detailTitle = document.querySelector("#project-detail-title");
const detailDescription = document.querySelector("#project-detail-description");
const galleryCount = document.querySelector("#gallery-count");
let projects = [];
let isAdmin = false;
let editingProject = null;
let currentProject = null;
let currentImageIndex = 0;
let returnFocusTo = null;

function setFormStatus(message, isError = false) {
    formStatus.textContent = message;
    formStatus.dataset.error = String(isError);
}

function getImageUrls(project) {
    return Array.isArray(project.imageUrls) ? project.imageUrls.filter(url => typeof url === "string" && url) : [];
}

function updateDialogImage() {
    if (!currentProject) return;
    const images = getImageUrls(currentProject);
    if (!images.length) return;
    currentImageIndex = (currentImageIndex + images.length) % images.length;
    detailImage.src = images[currentImageIndex];
    detailImage.alt = `${currentProject.title} — image ${currentImageIndex + 1}`;
    galleryCount.textContent = `${currentImageIndex + 1} / ${images.length}`;
    const multiple = images.length > 1;
    document.querySelector("#gallery-previous").hidden = !multiple;
    document.querySelector("#gallery-next").hidden = !multiple;
    galleryCount.hidden = !multiple;
}

function openProject(project, opener) {
    currentProject = project;
    currentImageIndex = 0;
    returnFocusTo = opener;
    detailCategory.textContent = project.category || "DREAMS Foundation project";
    detailTitle.textContent = project.title || "";
    detailDescription.textContent = project.description || "";
    updateDialogImage();
    dialog.showModal();
}

function closeProject() {
    if (!dialog.open) return;
    dialog.close();
}

function resetForm() {
    editingProject = null;
    form.reset();
    imageInput.required = true;
    formHeading.textContent = "Add project";
    saveButton.textContent = "Save project";
    cancelButton.hidden = true;
    setFormStatus("");
}

function startEditing(project) {
    editingProject = project;
    form.elements.title.value = project.title || "";
    form.elements.category.value = project.category || "";
    form.elements.description.value = project.description || "";
    imageInput.value = "";
    imageInput.required = false;
    formHeading.textContent = "Edit project";
    saveButton.textContent = "Update project";
    cancelButton.hidden = false;
    setFormStatus("");
    formPanel.hidden = false;
    adminToggle.setAttribute("aria-expanded", "true");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.title.focus();
}

function createProjectCard(project) {
    const article = document.createElement("article");
    article.className = "project-card";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "project-open";
    openButton.setAttribute("aria-label", `Read more about ${project.title}`);

    const cover = document.createElement("div");
    cover.className = "project-cover";
    const image = document.createElement("img");
    image.src = getImageUrls(project)[0] || "pictures/thumbnail_Dreams.png";
    image.alt = `${project.title} project`;
    image.loading = "lazy";
    cover.append(image);

    const imageCount = document.createElement("span");
    imageCount.className = "project-image-count";
    imageCount.textContent = `${getImageUrls(project).length} ${getImageUrls(project).length === 1 ? "image" : "images"}`;
    cover.append(imageCount);

    const copy = document.createElement("div");
    copy.className = "project-copy";
    const category = document.createElement("span");
    category.className = "project-label";
    category.textContent = project.category || "Project";
    const title = document.createElement("h2");
    title.textContent = project.title || "Untitled project";
    const description = document.createElement("p");
    description.textContent = project.description || "";
    copy.append(category, title, description);
    openButton.append(cover, copy);
    openButton.addEventListener("click", () => openProject(project, openButton));
    article.append(openButton);

    const footer = document.createElement("div");
    footer.className = "project-card-footer";
    const readMore = document.createElement("span");
    readMore.className = "project-read-more";
    readMore.textContent = "View project details →";
    footer.append(readMore);

    if (isAdmin && !project.isLegacyFallback) {
        const actions = document.createElement("div");
        actions.className = "project-admin-actions";
        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Edit";
        edit.addEventListener("click", () => startEditing(project));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "delete-project";
        remove.textContent = "Delete";
        remove.addEventListener("click", async () => {
            if (!confirm(`Remove “${project.title}” from the website? Any Cloudinary images must be deleted manually from the Cloudinary dashboard.`)) return;
            remove.disabled = true;
            try {
                await deleteDoc(doc(db, "projects", project.id));
                projects = projects.filter(item => item.id !== project.id);
                renderProjects();
            } catch (error) {
                console.error("Project deletion failed:", error);
                remove.disabled = false;
                alert("Could not delete this project. Check Firestore rules, administrator access, and your connection.");
            }
        });
        actions.append(edit, remove);
        footer.append(actions);
    }
    article.append(footer);
    return article;
}

function renderProjects() {
    grid.replaceChildren(...projects.map(createProjectCard));
    emptyState.hidden = projects.length > 0;
}

async function uploadProjectImage(file) {
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body
    });
    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error?.message || `Cloudinary upload failed (${response.status}).`);
    }
    const result = await response.json();
    const expectedPrefix = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/`;
    if (result.resource_type !== "image" || typeof result.secure_url !== "string" || !result.secure_url.startsWith(expectedPrefix)) {
        throw new Error("Cloudinary returned an unexpected project image.");
    }
    return result.secure_url;
}

async function migrateLegacyProjects() {
    const markerReference = doc(db, "projects", SEED_MARKER_ID);
    if ((await getDoc(markerReference)).exists()) return false;
    for (const project of legacyProjects) {
        const projectReference = doc(db, "projects", project.id);
        if ((await getDoc(projectReference)).exists()) continue;
        await setDoc(projectReference, {
            title: project.title,
            category: project.category,
            description: project.description,
            imageUrls: project.imageUrls,
            createdBy: auth.currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }
    await setDoc(markerReference, { seededAt: serverTimestamp() });
    return true;
}

async function loadProjects() {
    try {
        const snapshot = await getDocs(collection(db, "projects"));
        const markerExists = snapshot.docs.some(project => project.id === SEED_MARKER_ID);
        const firestoreProjects = snapshot.docs
            .filter(project => project.id !== SEED_MARKER_ID)
            .map(project => ({ id: project.id, ...project.data() }));
        firestoreProjects.sort((first, second) => String(first.title || "").localeCompare(String(second.title || "")));
        projects = firestoreProjects.length || markerExists
            ? firestoreProjects
            : legacyProjects.map(project => ({ ...project, isLegacyFallback: true }));
    } catch (error) {
        console.error("Could not load projects:", error);
        projects = legacyProjects.map(project => ({ ...project, isLegacyFallback: true }));
    }
    renderProjects();
}

adminToggle.addEventListener("click", () => {
    const expanded = adminToggle.getAttribute("aria-expanded") === "true";
    adminToggle.setAttribute("aria-expanded", String(!expanded));
    formPanel.hidden = expanded;
});

cancelButton.addEventListener("click", resetForm);
document.querySelector("#gallery-previous").addEventListener("click", () => {
    currentImageIndex -= 1;
    updateDialogImage();
});
document.querySelector("#gallery-next").addEventListener("click", () => {
    currentImageIndex += 1;
    updateDialogImage();
});
dialogClose.addEventListener("click", closeProject);
dialog.addEventListener("click", event => {
    if (event.target === dialog) closeProject();
});
dialog.addEventListener("close", () => {
    currentProject = null;
    detailImage.removeAttribute("src");
    document.querySelector("#gallery-previous").hidden = true;
    document.querySelector("#gallery-next").hidden = true;
    returnFocusTo?.focus();
});

onAuthStateChanged(auth, async user => {
    isAdmin = false;
    adminArea.hidden = true;
    if (user) {
        try {
            const token = await user.getIdTokenResult(true);
            isAdmin = token.claims.admin === true;
            adminArea.hidden = !isAdmin;
            if (isAdmin) await migrateLegacyProjects();
        } catch (error) {
            console.error("Could not verify project administrator access:", error);
        }
    }
    await loadProjects();
});

form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!auth.currentUser || !isAdmin) {
        setFormStatus("Only an administrator can manage projects.", true);
        return;
    }

    const files = [...imageInput.files];
    if (files.length > MAX_IMAGES) {
        setFormStatus(`Choose no more than ${MAX_IMAGES} images.`, true);
        return;
    }
    if (files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_IMAGE_SIZE)) {
        setFormStatus("Images must be JPG, PNG, or WebP files no larger than 5 MB each.", true);
        return;
    }
    if (!editingProject && files.length === 0) {
        setFormStatus("Choose at least one project image.", true);
        return;
    }

    saveButton.disabled = true;
    cancelButton.disabled = true;
    let uploadedImageUrls = [];
    setFormStatus(files.length ? "Uploading project images…" : "Saving project…");
    try {
        const uploadResults = await Promise.allSettled(files.map(uploadProjectImage));
        uploadedImageUrls = uploadResults
            .filter(result => result.status === "fulfilled")
            .map(result => result.value);
        const failedUpload = uploadResults.find(result => result.status === "rejected");
        if (failedUpload) throw failedUpload.reason;
        const data = {
            title: String(form.elements.title.value).trim(),
            category: String(form.elements.category.value).trim(),
            description: String(form.elements.description.value).trim(),
            updatedAt: serverTimestamp()
        };
        if (uploadedImageUrls.length) data.imageUrls = uploadedImageUrls;

        if (editingProject) {
            await updateDoc(doc(db, "projects", editingProject.id), data);
        } else {
            await addDoc(collection(db, "projects"), {
                ...data,
                imageUrls: uploadedImageUrls,
                createdBy: auth.currentUser.uid,
                createdAt: serverTimestamp()
            });
        }
        resetForm();
        setFormStatus(uploadedImageUrls.length
            ? "Project saved. Cloudinary images replaced or removed from a project are not deleted automatically; remove unused files from Cloudinary."
            : "Project details updated.");
        await loadProjects();
    } catch (error) {
        console.error("Project save failed:", error);
        const detail = error instanceof Error ? ` ${error.message}` : "";
        setFormStatus(uploadedImageUrls.length
            ? `Images uploaded, but project details could not be saved. Remove unused images from Cloudinary and check Firestore permissions.${detail}`
            : `Could not save the project. Check Firestore rules, Cloudinary preset settings, and your connection.${detail}`, true);
    } finally {
        saveButton.disabled = false;
        cancelButton.disabled = false;
    }
});

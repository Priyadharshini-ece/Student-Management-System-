// ============================================================
// Student Management System - Frontend Logic (Vanilla JS)
// Talks to the Django REST Framework API using fetch()
// ============================================================

const API_BASE_URL = "http://127.0.0.1:8000/api/students/";

// ---- DOM references ----
const studentForm = document.getElementById("studentForm");
const studentIdField = document.getElementById("studentId");
const nameField = document.getElementById("name");
const registerNumberField = document.getElementById("registerNumber");
const departmentField = document.getElementById("department");
const emailField = document.getElementById("email");
const phoneNumberField = document.getElementById("phoneNumber");

const formTitle = document.getElementById("formTitle");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const studentTableBody = document.getElementById("studentTableBody");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

const totalStudentsEl = document.getElementById("totalStudents");
const totalDepartmentsEl = document.getElementById("totalDepartments");

const messageBox = document.getElementById("messageBox");

const deleteModal = document.getElementById("deleteModal");
const deleteModalText = document.getElementById("deleteModalText");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

let allStudents = [];      // cache of the last-loaded student list
let studentIdToDelete = null;
let searchDebounceTimer = null;

// ---- Initial load ----
document.addEventListener("DOMContentLoaded", () => {
  loadStudents();
});

// ============================================================
// API HELPERS
// ============================================================

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }
  if (!response.ok) {
    const error = new Error("Request failed");
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

function loadStudents(search = "") {
  const url = search ? `${API_BASE_URL}?search=${encodeURIComponent(search)}` : API_BASE_URL;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      allStudents = Array.isArray(data) ? data : (data.results || []);
      renderStudentTable(allStudents);
      updateDashboard(allStudents);
    })
    .catch(() => {
      showMessage("Could not load students. Is the Django server running on port 8000?", "error");
    });
}

// ============================================================
// RENDERING
// ============================================================

function renderStudentTable(students) {
  studentTableBody.innerHTML = "";

  if (!students || students.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  students.forEach((student) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${student.id}</td>
      <td>${escapeHtml(student.name)}</td>
      <td>${escapeHtml(student.register_number)}</td>
      <td>${escapeHtml(student.department)}</td>
      <td>${escapeHtml(student.email)}</td>
      <td>${escapeHtml(student.phone_number)}</td>
      <td>
        <button class="btn btn-edit btn-sm" data-action="edit" data-id="${student.id}">Edit</button>
        <button class="btn btn-delete btn-sm" data-action="delete" data-id="${student.id}">Delete</button>
      </td>
    `;
    studentTableBody.appendChild(row);
  });
}

function updateDashboard(students) {
  totalStudentsEl.textContent = students.length;
  const uniqueDepartments = new Set(students.map((s) => s.department.trim().toLowerCase()));
  totalDepartmentsEl.textContent = uniqueDepartments.size;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// ============================================================
// MESSAGES
// ============================================================

function showMessage(text, type = "success") {
  messageBox.textContent = text;
  messageBox.className = `message-box ${type}`;
  messageBox.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => {
    messageBox.classList.add("hidden");
  }, 4000);
}

// ============================================================
// FORM VALIDATION
// ============================================================

function clearFieldErrors() {
  document.querySelectorAll(".error-text").forEach((el) => (el.textContent = ""));
}

function validateForm() {
  clearFieldErrors();
  let isValid = true;

  if (!nameField.value.trim()) {
    document.getElementById("nameError").textContent = "Name is required.";
    isValid = false;
  }

  if (!registerNumberField.value.trim()) {
    document.getElementById("registerNumberError").textContent = "Register number is required.";
    isValid = false;
  }

  if (!departmentField.value.trim()) {
    document.getElementById("departmentError").textContent = "Department is required.";
    isValid = false;
  }

  const emailValue = emailField.value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailValue) {
    document.getElementById("emailError").textContent = "Email is required.";
    isValid = false;
  } else if (!emailPattern.test(emailValue)) {
    document.getElementById("emailError").textContent = "Enter a valid email address.";
    isValid = false;
  }

  const phoneValue = phoneNumberField.value.trim();
  const phonePattern = /^[0-9+\-\s]{7,15}$/;
  if (!phoneValue) {
    document.getElementById("phoneNumberError").textContent = "Phone number is required.";
    isValid = false;
  } else if (!phonePattern.test(phoneValue)) {
    document.getElementById("phoneNumberError").textContent = "Enter a valid phone number.";
    isValid = false;
  }

  return isValid;
}

// ============================================================
// CREATE / UPDATE (form submit)
// ============================================================

studentForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  const payload = {
    name: nameField.value.trim(),
    register_number: registerNumberField.value.trim(),
    department: departmentField.value.trim(),
    email: emailField.value.trim(),
    phone_number: phoneNumberField.value.trim(),
  };

  const editingId = studentIdField.value;

  try {
    if (editingId) {
      // UPDATE existing student
      await apiRequest(`${API_BASE_URL}${editingId}/`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      showMessage("Student updated successfully.", "success");
    } else {
      // CREATE new student
      await apiRequest(API_BASE_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showMessage("Student added successfully.", "success");
    }
    resetForm();
    loadStudents(searchInput.value.trim());
  } catch (error) {
    handleApiError(error);
  }
});

function handleApiError(error) {
  if (error.data && error.data.errors) {
    const errors = error.data.errors;
    Object.keys(errors).forEach((field) => {
      const fieldMap = {
        name: "nameError",
        register_number: "registerNumberError",
        department: "departmentError",
        email: "emailError",
        phone_number: "phoneNumberError",
      };
      const el = document.getElementById(fieldMap[field]);
      if (el) el.textContent = Array.isArray(errors[field]) ? errors[field][0] : errors[field];
    });
    showMessage("Please fix the errors in the form.", "error");
  } else {
    showMessage("Something went wrong. Please try again.", "error");
  }
}

// ============================================================
// EDIT
// ============================================================

studentTableBody.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-action]");
  if (!button) return;

  const id = button.getAttribute("data-id");
  const action = button.getAttribute("data-action");

  if (action === "edit") {
    startEditStudent(id);
  } else if (action === "delete") {
    openDeleteModal(id);
  }
});

function startEditStudent(id) {
  const student = allStudents.find((s) => String(s.id) === String(id));
  if (!student) return;

  studentIdField.value = student.id;
  nameField.value = student.name;
  registerNumberField.value = student.register_number;
  departmentField.value = student.department;
  emailField.value = student.email;
  phoneNumberField.value = student.phone_number;

  formTitle.textContent = `Edit Student #${student.id}`;
  submitBtn.textContent = "Update Student";
  cancelEditBtn.classList.remove("hidden");
  clearFieldErrors();

  studentForm.scrollIntoView({ behavior: "smooth" });
}

cancelEditBtn.addEventListener("click", resetForm);

function resetForm() {
  studentForm.reset();
  studentIdField.value = "";
  formTitle.textContent = "Add New Student";
  submitBtn.textContent = "Add Student";
  cancelEditBtn.classList.add("hidden");
  clearFieldErrors();
}

// ============================================================
// DELETE (with confirmation modal)
// ============================================================

function openDeleteModal(id) {
  const student = allStudents.find((s) => String(s.id) === String(id));
  studentIdToDelete = id;
  deleteModalText.textContent = student
    ? `Are you sure you want to delete "${student.name}" (${student.register_number})? This cannot be undone.`
    : "Are you sure you want to delete this student?";
  deleteModal.classList.remove("hidden");
}

function closeDeleteModal() {
  deleteModal.classList.add("hidden");
  studentIdToDelete = null;
}

cancelDeleteBtn.addEventListener("click", closeDeleteModal);

deleteModal.addEventListener("click", (e) => {
  if (e.target === deleteModal) closeDeleteModal();
});

confirmDeleteBtn.addEventListener("click", async () => {
  if (!studentIdToDelete) return;
  try {
    await apiRequest(`${API_BASE_URL}${studentIdToDelete}/`, { method: "DELETE" });
    showMessage("Student deleted successfully.", "success");
    closeDeleteModal();
    loadStudents(searchInput.value.trim());
  } catch (error) {
    showMessage("Could not delete student. Please try again.", "error");
    closeDeleteModal();
  }
});

// ============================================================
// SEARCH (by name or register number, debounced)
// ============================================================

searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadStudents(searchInput.value.trim());
  }, 300);
});

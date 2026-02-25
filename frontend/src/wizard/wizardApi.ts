import { getAuthToken } from "../utils/auth";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8000/api/wizard";

export async function createWizardSession() {
  const res = await fetch(`${API_BASE}/session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  if (!res.ok) throw new Error("Failed to create wizard session");
  return res.json();
}

export async function getWizardSession(id: string) {
  const res = await fetch(`${API_BASE}/session/${id}`, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch wizard session");
  return res.json();
}

export async function saveWizardStep(id: string, step: number, data: any) {
  const res = await fetch(`${API_BASE}/session/${id}/step/${step}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to save step ${step}`);
  return res.json();
}

export async function getWizardSummary(id: string) {
  const res = await fetch(`${API_BASE}/session/${id}/summary`, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

export async function submitWizard(id: string) {
  const res = await fetch(`${API_BASE}/session/${id}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  if (!res.ok) throw new Error("Failed to submit wizard");
  return res.json();
}

export async function listDrafts() {
  const res = await fetch(`${API_BASE}/sessions?status=Draft`, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch drafts");
  return res.json();
}

export async function deleteWizardSession(id: string) {
  const res = await fetch(`${API_BASE}/session/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  if (!res.ok) throw new Error("Failed to delete session");
  return res.json();
}

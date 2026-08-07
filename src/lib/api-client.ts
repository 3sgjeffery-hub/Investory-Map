type FetchOptions = RequestInit & {
  schoolId?: string;
};

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { schoolId, ...fetchOptions } = options;
  const url = new URL(path, window.location.origin);
  if (schoolId) url.searchParams.set("schoolId", schoolId);

  const res = await fetch(url.toString(), {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }

  if (res.headers.get("content-type")?.includes("text/csv")) {
    return res.text() as unknown as Promise<T>;
  }

  return res.json() as Promise<T>;
}

// Items
export const api = {
  items: {
    list: (schoolId?: string) =>
      apiFetch<unknown[]>("/api/items", { schoolId }),
    get: (id: string) =>
      apiFetch<unknown>(`/api/items/${id}`),
    create: (data: unknown) =>
      apiFetch<unknown>("/api/items", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      apiFetch<unknown>(`/api/items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<unknown>(`/api/items/${id}`, { method: "DELETE" }),
    move: (id: string, data: { toLocation: string; reason?: string; movedBy?: string }) =>
      apiFetch<unknown>(`/api/items/${id}/move`, { method: "POST", body: JSON.stringify(data) }),
    addFault: (id: string, data: unknown) =>
      apiFetch<unknown>(`/api/items/${id}/faults`, { method: "POST", body: JSON.stringify(data) }),
    addRepair: (id: string, data: unknown) =>
      apiFetch<unknown>(`/api/items/${id}/repairs`, { method: "POST", body: JSON.stringify(data) }),
    loanOut: (id: string, data: unknown) =>
      apiFetch<unknown>(`/api/items/${id}/loans`, {
        method: "POST",
        body: JSON.stringify({ action: "loan-out", ...(data as object) }),
      }),
    returnItem: (id: string, data: unknown) =>
      apiFetch<unknown>(`/api/items/${id}/loans`, {
        method: "POST",
        body: JSON.stringify({ action: "return", ...(data as object) }),
      }),
  },

  sections: {
    list: (schoolId?: string) =>
      apiFetch<unknown[]>("/api/sections", { schoolId }),
    create: (data: { name: string }) =>
      apiFetch<unknown>("/api/sections", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      apiFetch<unknown>(`/api/sections/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<unknown>(`/api/sections/${id}`, { method: "DELETE" }),
    addRoom: (sectionId: string, name: string) =>
      apiFetch<unknown>(`/api/sections/${sectionId}/rooms`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    renameRoom: (sectionId: string, roomId: string, name: string) =>
      apiFetch<unknown>(`/api/sections/${sectionId}/rooms`, {
        method: "PUT",
        body: JSON.stringify({ roomId, name }),
      }),
    deleteRoom: (sectionId: string, roomId: string) =>
      apiFetch<unknown>(`/api/sections/${sectionId}/rooms`, {
        method: "DELETE",
        body: JSON.stringify({ roomId }),
      }),
    updateRoomOrder: (sectionId: string, roomId: string, sortOrder: number) =>
      apiFetch<unknown>(`/api/sections/${sectionId}/rooms`, {
        method: "PUT",
        body: JSON.stringify({ roomId, sortOrder }),
      }),
  },

  faults: {
    list: (schoolId?: string) =>
      apiFetch<unknown[]>("/api/faults", { schoolId }),
    update: (id: string, data: unknown) =>
      apiFetch<unknown>(`/api/faults/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  },

  faultReports: {
    list: () =>
      apiFetch<unknown[]>("/api/fault-reports"),
    create: (data: { itemId: string; roomName: string; faultType: string; severity?: string; description?: string; photos?: string[] }) =>
      apiFetch<unknown>("/api/fault-reports", { method: "POST", body: JSON.stringify(data) }),
    review: (id: string, data: { action: "approve" | "reject"; severity?: string; faultType?: string; reviewNote?: string }) =>
      apiFetch<unknown>(`/api/fault-reports/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  },

  loans: {
    list: (schoolId?: string) =>
      apiFetch<unknown[]>("/api/loans", { schoolId }),
  },

  moveLog: {
    list: (schoolId?: string) =>
      apiFetch<unknown[]>("/api/move-log", { schoolId }),
  },

  reports: {
    get: (schoolId?: string) =>
      apiFetch<unknown>("/api/reports", { schoolId }),
  },

  import: {
    csv: (items: unknown[]) =>
      apiFetch<{ imported: number; skipped: number }>("/api/import", {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
  },

  upload: {
    file: async (file: File, folder?: string): Promise<string> => {
      const formData = new FormData();
      formData.append("file", file);
      if (folder) formData.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { url: string };
      return data.url;
    },
  },

  reset: () =>
    apiFetch<{ success: boolean }>("/api/reset", { method: "POST" }),

  types: {
    list: () => apiFetch<{ types: string[]; icons: Record<string, string> }>("/api/types"),
    update: (types: string[], icons: Record<string, string>) =>
      apiFetch<{ types: string[]; icons: Record<string, string> }>("/api/types", {
        method: "PUT",
        body: JSON.stringify({ types, icons }),
      }),
  },

  faultTypes: {
    list: () => apiFetch<{ types: string[] }>("/api/fault-types"),
    update: (types: string[]) =>
      apiFetch<{ types: string[] }>("/api/fault-types", {
        method: "PUT",
        body: JSON.stringify({ types }),
      }),
  },

  superAdmin: {
    schools: {
      list: () => apiFetch<unknown[]>("/api/super-admin/schools"),
      get: (id: string) => apiFetch<unknown>(`/api/super-admin/schools/${id}`),
      create: (data: unknown) =>
        apiFetch<unknown>("/api/super-admin/schools", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      addUser: (schoolId: string, data: unknown) =>
        apiFetch<unknown>(`/api/super-admin/schools/${schoolId}/users`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
    },
    users: {
      updateRole: (userId: string, role: string) =>
        apiFetch<unknown>(`/api/super-admin/users/${userId}`, {
          method: "PUT",
          body: JSON.stringify({ role }),
        }),
    },
    stats: () => apiFetch<unknown>("/api/super-admin/stats"),
  },
};

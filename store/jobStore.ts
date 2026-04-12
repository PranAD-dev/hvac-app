import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Job, Note, Clip, Signature } from "../types";
import { seedJobs } from "../data/seedData";

const STORAGE_KEY = "jobs";

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

interface JobStore {
  jobs: Job[];
  isLoaded: boolean;
  techName: string;

  hydrate: () => Promise<void>;
  loadSeedData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  setTechName: (name: string) => Promise<void>;
  getJobsBySerialNumber: (serial: string) => Job[];
  searchJobs: (query: string) => Job[];
  addNote: (jobId: string, text: string, source: "manual" | "vision", createdBy: string) => Promise<void>;
  updateNote: (jobId: string, noteId: string, text: string) => Promise<void>;
  updateNoteMetadata: (jobId: string, noteId: string, meta: { tags?: string[]; category?: string; reminder?: string }) => Promise<void>;
  deleteNote: (jobId: string, noteId: string) => Promise<void>;
  addClip: (jobId: string, filePath: string, durationSeconds: number, caption: string, recordedBy: string, thumbnailPath?: string) => Promise<void>;
  deleteClip: (jobId: string, clipId: string) => Promise<void>;
  saveSignature: (jobId: string, paths: string, signedBy: string) => Promise<void>;
  syncJobberJobs: (jobberJobs: any[]) => Promise<void>;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
  isLoaded: false,
  techName: "Mike Torres",

  hydrate: async () => {
    try {
      const [rawJobs, savedName] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem("techName"),
      ]);
      const jobs: Job[] = rawJobs ? JSON.parse(rawJobs) : [];
      set({
        jobs,
        isLoaded: true,
        techName: savedName || "Mike Torres",
      });
    } catch {
      set({ jobs: [], isLoaded: true });
    }
  },

  loadSeedData: async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seedJobs));
      set({ jobs: seedJobs });
    } catch (e) {
      console.error("Failed to load seed data:", e);
    }
  },

  clearAllData: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      set({ jobs: [] });
    } catch (e) {
      console.error("Failed to clear data:", e);
    }
  },

  setTechName: async (name: string) => {
    try {
      await AsyncStorage.setItem("techName", name);
      set({ techName: name });
    } catch (e) {
      console.error("Failed to save tech name:", e);
    }
  },

  getJobsBySerialNumber: (serial: string) => {
    return get()
      .jobs.filter((j) => j.unit.serial_number === serial)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },

  searchJobs: (query: string) => {
    const q = query.toLowerCase().trim();
    if (!q) return get().jobs;
    return get().jobs.filter(
      (j) =>
        j.customer_address.toLowerCase().includes(q) ||
        j.customer_name.toLowerCase().includes(q) ||
        j.unit.model_number.toLowerCase().includes(q) ||
        j.unit.serial_number.toLowerCase().includes(q) ||
        j.unit.brand.toLowerCase().includes(q) ||
        j.diagnosis.primary_issue.toLowerCase().includes(q) ||
        (j.notes || []).some((n) => n.text.toLowerCase().includes(q)) ||
        (j.clips || []).some((c) => c.caption.toLowerCase().includes(q))
    );
  },

  addNote: async (jobId, text, source, createdBy) => {
    const note: Note = {
      id: uid(),
      text: text.trim(),
      source,
      created_at: new Date().toISOString(),
      created_by: createdBy,
    };
    const updated = get().jobs.map((j) =>
      j.id === jobId ? { ...j, notes: [note, ...(j.notes || [])] } : j
    );
    set({ jobs: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  updateNote: async (jobId, noteId, text) => {
    const updated = get().jobs.map((j) =>
      j.id === jobId
        ? { ...j, notes: (j.notes || []).map((n) => n.id === noteId ? { ...n, text } : n) }
        : j
    );
    set({ jobs: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  updateNoteMetadata: async (jobId, noteId, meta) => {
    const updated = get().jobs.map((j) =>
      j.id === jobId
        ? { ...j, notes: (j.notes || []).map((n) => n.id === noteId ? { ...n, ...meta } : n) }
        : j
    );
    set({ jobs: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  deleteNote: async (jobId, noteId) => {
    const updated = get().jobs.map((j) =>
      j.id === jobId
        ? { ...j, notes: (j.notes || []).filter((n) => n.id !== noteId) }
        : j
    );
    set({ jobs: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  addClip: async (jobId, filePath, durationSeconds, caption, recordedBy, thumbnailPath) => {
    const clip: Clip = {
      id: uid(),
      file_path: filePath,
      duration_seconds: durationSeconds,
      thumbnail_path: thumbnailPath || "",
      caption: caption.trim(),
      recorded_at: new Date().toISOString(),
      recorded_by: recordedBy,
    };
    const updated = get().jobs.map((j) =>
      j.id === jobId ? { ...j, clips: [clip, ...(j.clips || [])] } : j
    );
    set({ jobs: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  deleteClip: async (jobId, clipId) => {
    const updated = get().jobs.map((j) =>
      j.id === jobId
        ? { ...j, clips: (j.clips || []).filter((c) => c.id !== clipId) }
        : j
    );
    set({ jobs: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  saveSignature: async (jobId, paths, signedBy) => {
    const sig: Signature = {
      paths,
      signed_at: new Date().toISOString(),
      signed_by: signedBy,
    };
    const updated = get().jobs.map((j) =>
      j.id === jobId ? { ...j, signature: sig } : j
    );
    set({ jobs: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  syncJobberJobs: async (jobberJobs: any[]) => {
    const existing = get().jobs;
    const existingJobberIds = new Set(
      existing.filter((j) => j.source === "jobber").map((j) => j.jobberJobId)
    );

    const newJobs: Job[] = [];
    for (const jj of jobberJobs) {
      if (existingJobberIds.has(jj.id)) continue;

      const client = jj.client || {};
      const addr = client.billingAddress || {};
      const customerName = client.companyName ||
        `${client.firstName || ""} ${client.lastName || ""}`.trim() || "Unknown";
      const customerAddress = [addr.street1, addr.city, addr.province]
        .filter(Boolean)
        .join(", ");

      newJobs.push({
        id: uid(),
        created_at: jj.startAt || new Date().toISOString(),
        completed_at: jj.jobStatus === "COMPLETED" ? (jj.endAt || new Date().toISOString()) : "",
        duration_minutes: 0,
        customer_address: customerAddress,
        customer_name: customerName,
        customer_phone: client.phones?.[0]?.number || "",
        technician_id: "tech-001",
        technician_name: get().techName,
        unit: {
          model_number: "",
          serial_number: "",
          manufacture_date: "",
          age_years: 0,
          brand: "",
          refrigerant_type: "",
          system_type: "Split",
          tonnage: 0,
          nameplate_photo_path: "",
        },
        readings: {
          high_side_psi: 0, low_side_psi: 0, suction_line_temp_f: 0,
          liquid_line_temp_f: 0, superheat_f: 0, subcooling_f: 0,
          supply_air_temp_f: 0, return_air_temp_f: 0, delta_t_f: 0,
          voltage: 0, amperage: 0, static_pressure_in_wc: 0,
          outdoor_temp_f: 0, taken_at: "",
        },
        findings: [],
        diagnosis: {
          primary_issue: jj.title || "Pending inspection",
          confidence: "low",
          technical_summary: jj.instructions || "",
          recommended_actions: [],
          parts_needed: [],
          urgency: "routine",
          full_llm_output: "",
        },
        actions: [],
        service_report: "",
        photos: [],
        notes: jj.instructions ? [{
          id: uid(),
          text: jj.instructions,
          source: "manual" as const,
          created_at: jj.startAt || new Date().toISOString(),
          created_by: "Jobber",
        }] : [],
        clips: [],
        source: "jobber",
        jobberJobId: jj.id,
        status: jj.jobStatus === "COMPLETED" ? "completed" : "in_progress",
      });
    }

    if (newJobs.length > 0) {
      const updated = [...newJobs, ...existing];
      set({ jobs: updated });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  },
}));

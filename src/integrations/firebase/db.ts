import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
} from "firebase/firestore";
import { getFirestoreDb } from "./client";

type Msg = { role: "user" | "assistant"; content: string };

export type LeadRecord = {
  id: string;
  session_id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  project_type: string | null;
  budget: string | null;
  timeline: string | null;
  requirements: string | null;
  enquiry_type: string | null;
  transcript: Msg[];
  created_at: string;
  updated_at: string;
};

export type FeedbackRecord = {
  id: string;
  session_id: string | null;
  name: string | null;
  email: string | null;
  rating: number | null;
  message: string | null;
  created_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

export async function upsertLead(
  sessionId: string,
  fields: Partial<Omit<LeadRecord, "id" | "session_id" | "created_at" | "updated_at">> & {
    transcript?: Msg[];
  },
) {
  const db = getFirestoreDb();
  const ref = doc(db, "leads", sessionId);
  const existing = await getDoc(ref);
  const timestamp = nowIso();

  const payload: Record<string, unknown> = {
    session_id: sessionId,
    updated_at: timestamp,
    ...fields,
  };

  if (!existing.exists()) {
    payload.created_at = timestamp;
    if (!payload.transcript) payload.transcript = [];
  }

  await setDoc(ref, payload, { merge: true });
}

export async function getLeadBySessionId(sessionId: string) {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, "leads", sessionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as LeadRecord;
}

export async function listAllLeads(): Promise<LeadRecord[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, "leads"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as LeadRecord)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function deleteLeadById(id: string) {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, "leads", id));
}

export async function insertFeedback(data: {
  session_id: string | null;
  name: string | null;
  email: string | null;
  rating: number | null;
  message: string | null;
}) {
  const db = getFirestoreDb();
  await addDoc(collection(db, "feedbacks"), {
    ...data,
    created_at: nowIso(),
  });
}

export async function listAllFeedbacks(): Promise<FeedbackRecord[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, "feedbacks"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as FeedbackRecord)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

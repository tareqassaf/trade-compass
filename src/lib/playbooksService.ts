import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Playbook, CreatePlaybookInput, UpdatePlaybookInput } from "@/types/playbook";

/**
 * Path helper for playbooks collection
 */
export const playbooksCollectionRef = (userId: string) =>
  collection(db, "users", userId, "playbooks");

/**
 * Get all playbooks for a user (excluding archived by default)
 */
export async function getUserPlaybooks(
  userId: string,
  includeArchived: boolean = false
): Promise<Playbook[]> {
  if (!userId) {
    return [];
  }

  try {
    const playbooksRef = playbooksCollectionRef(userId);
    let q = query(playbooksRef, orderBy("createdAt", "desc"));

    if (!includeArchived) {
      q = query(playbooksRef, where("isArchived", "!=", true), orderBy("createdAt", "desc"));
    }

    const querySnapshot = await getDocs(q);
    const playbooks: Playbook[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      playbooks.push({
        id: docSnap.id,
        userId: data.userId || userId,
        name: data.name || "",
        description: data.description,
        notes: data.notes,
        tags: data.tags || [],
        timeframes: data.timeframes || [],
        instruments: data.instruments || [],
        isArchived: data.isArchived ?? false,
        createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
      });
    });

    return playbooks;
  } catch (error) {
    console.error("Error fetching playbooks:", error);
    throw error;
  }
}

/**
 * Get a single playbook by ID
 */
export async function getPlaybook(userId: string, playbookId: string): Promise<Playbook | null> {
  if (!userId || !playbookId) {
    return null;
  }

  try {
    const playbookRef = doc(playbooksCollectionRef(userId), playbookId);
    const playbookSnap = await getDoc(playbookRef);

    if (!playbookSnap.exists()) {
      return null;
    }

    const data = playbookSnap.data();
    return {
      id: playbookSnap.id,
      userId: data.userId || userId,
      name: data.name || "",
      description: data.description,
      notes: data.notes,
      tags: data.tags || [],
      timeframes: data.timeframes || [],
      instruments: data.instruments || [],
      isArchived: data.isArchived ?? false,
      createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
    };
  } catch (error) {
    console.error("Error fetching playbook:", error);
    throw error;
  }
}

/**
 * Create a new playbook
 */
export async function createPlaybook(
  userId: string,
  data: CreatePlaybookInput
): Promise<string> {
  if (!userId) {
    throw new Error("userId is required");
  }

  try {
    const playbooksRef = playbooksCollectionRef(userId);
    const newPlaybookRef = doc(playbooksRef);

    const playbookData = {
      userId,
      name: data.name,
      description: data.description || null,
      notes: data.notes || null,
      tags: data.tags || [],
      timeframes: data.timeframes || [],
      instruments: data.instruments || [],
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(newPlaybookRef, playbookData);
    return newPlaybookRef.id;
  } catch (error) {
    console.error("Error creating playbook:", error);
    throw error;
  }
}

/**
 * Update an existing playbook
 */
export async function updatePlaybook(
  userId: string,
  playbookId: string,
  data: UpdatePlaybookInput
): Promise<void> {
  if (!userId || !playbookId) {
    throw new Error("userId and playbookId are required");
  }

  try {
    const playbookRef = doc(playbooksCollectionRef(userId), playbookId);

    const updateData: any = {
      updatedAt: serverTimestamp(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.tags !== undefined) updateData.tags = data.tags || [];
    if (data.timeframes !== undefined) updateData.timeframes = data.timeframes || [];
    if (data.instruments !== undefined) updateData.instruments = data.instruments || [];

    await updateDoc(playbookRef, updateData);
  } catch (error) {
    console.error("Error updating playbook:", error);
    throw error;
  }
}

/**
 * Archive a playbook (soft delete)
 */
export async function archivePlaybook(userId: string, playbookId: string): Promise<void> {
  if (!userId || !playbookId) {
    throw new Error("userId and playbookId are required");
  }

  try {
    const playbookRef = doc(playbooksCollectionRef(userId), playbookId);
    await updateDoc(playbookRef, {
      isArchived: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error archiving playbook:", error);
    throw error;
  }
}

/**
 * Unarchive a playbook
 */
export async function unarchivePlaybook(userId: string, playbookId: string): Promise<void> {
  if (!userId || !playbookId) {
    throw new Error("userId and playbookId are required");
  }

  try {
    const playbookRef = doc(playbooksCollectionRef(userId), playbookId);
    await updateDoc(playbookRef, {
      isArchived: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error unarchiving playbook:", error);
    throw error;
  }
}


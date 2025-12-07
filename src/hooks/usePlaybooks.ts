import { useEffect, useState, useCallback } from "react";
import type { Playbook, CreatePlaybookInput, UpdatePlaybookInput } from "@/types/playbook";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserPlaybooks,
  createPlaybook,
  updatePlaybook,
  archivePlaybook,
  unarchivePlaybook,
} from "@/lib/playbooksService";

export function usePlaybooks() {
  const { user } = useAuth();
  const userId = user?.uid;

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState<boolean>(!!userId);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaybooks = useCallback(async () => {
    if (!userId) {
      setPlaybooks([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    try {
      const list = await getUserPlaybooks(userId, false);
      if (!cancelled) {
        setPlaybooks(list);
      }
    } catch (err) {
      console.error(err);
      if (!cancelled) {
        setError("Failed to load playbooks");
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    fetchPlaybooks();
  }, [fetchPlaybooks]);

  const addPlaybook = useCallback(
    async (data: CreatePlaybookInput) => {
      if (!userId) return;

      try {
        const id = await createPlaybook(userId, data);
        // Optimistically update local state
        const newPlaybook: Playbook = {
          id,
          userId,
          name: data.name,
          description: data.description,
          notes: data.notes,
          tags: data.tags || [],
          timeframes: data.timeframes || [],
          instruments: data.instruments || [],
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setPlaybooks((prev) => [newPlaybook, ...prev]);
        return id;
      } catch (err) {
        console.error("Error adding playbook:", err);
        setError("Failed to create playbook");
        throw err;
      }
    },
    [userId]
  );

  const editPlaybook = useCallback(
    async (id: string, data: UpdatePlaybookInput) => {
      if (!userId) return;

      try {
        await updatePlaybook(userId, id, data);
        // Optimistically update local state
        setPlaybooks((prev) =>
          prev.map((pb) =>
            pb.id === id
              ? {
                  ...pb,
                  ...data,
                  updatedAt: new Date(),
                }
              : pb
          )
        );
      } catch (err) {
        console.error("Error updating playbook:", err);
        setError("Failed to update playbook");
        throw err;
      }
    },
    [userId]
  );

  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      if (!userId) return;

      try {
        if (archived) {
          await archivePlaybook(userId, id);
        } else {
          await unarchivePlaybook(userId, id);
        }
        // Optimistically update local state
        setPlaybooks((prev) =>
          prev.map((pb) =>
            pb.id === id
              ? {
                  ...pb,
                  isArchived: archived,
                  updatedAt: new Date(),
                }
              : pb
          )
        );
      } catch (err) {
        console.error("Error archiving/unarchiving playbook:", err);
        setError("Failed to update playbook");
        throw err;
      }
    },
    [userId]
  );

  return {
    playbooks,
    loading,
    error,
    addPlaybook,
    editPlaybook,
    setArchived,
    refresh: fetchPlaybooks,
  };
}


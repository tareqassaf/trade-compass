import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserGeneralSettings, updateUserGeneralSettings } from "@/lib/firestoreService";
import type { UserGeneralSettings } from "@/types/trading";

export function useUserGeneralSettings(userId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<UserGeneralSettings | null>({
    queryKey: ["userGeneralSettings", userId],
    queryFn: () => getUserGeneralSettings(userId),
    enabled: !!userId,
  });

  const mutation = useMutation({
    mutationFn: (partial: Partial<UserGeneralSettings>) =>
      updateUserGeneralSettings(userId, partial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userGeneralSettings", userId] });
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    updateSettings: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}


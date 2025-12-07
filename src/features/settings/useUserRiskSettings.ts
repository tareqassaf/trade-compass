import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserRiskSettings, updateUserRiskSettings } from "@/lib/firestoreService";
import type { UserRiskSettings } from "@/types/trading";

export function useUserRiskSettings(userId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<UserRiskSettings | null>({
    queryKey: ["userRiskSettings", userId],
    queryFn: () => getUserRiskSettings(userId),
    enabled: !!userId,
  });

  const mutation = useMutation({
    mutationFn: (partial: Partial<UserRiskSettings>) =>
      updateUserRiskSettings(userId, partial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userRiskSettings", userId] });
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


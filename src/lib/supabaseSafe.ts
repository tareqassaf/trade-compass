/**
 * Safe wrapper for Supabase calls during Firebase migration.
 * Returns empty results instead of throwing errors.
 */
import { supabase } from "./supabase";

export async function safeSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<T | null> {
  try {
    const { data, error } = await queryFn();
    if (error) {
      console.warn("Supabase query error (migrating to Firebase):", error);
      return null;
    }
    return data;
  } catch (error) {
    console.warn("Supabase query exception (migrating to Firebase):", error);
    return null;
  }
}

export async function safeSupabaseMutation<T>(
  mutationFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  try {
    const result = await mutationFn();
    if (result.error) {
      console.warn("Supabase mutation error (migrating to Firebase):", result.error);
    }
    return result;
  } catch (error) {
    console.warn("Supabase mutation exception (migrating to Firebase):", error);
    return { data: null, error };
  }
}


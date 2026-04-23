import { createSupabaseBrowserClient } from "@/lib/backend/supabase/browser-client";

// Backward-compatible export while code migrates to /lib/backend/supabase/*
export const supabase = createSupabaseBrowserClient();

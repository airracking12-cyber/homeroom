import { createClient } from "@supabase/supabase-js";

// Set these in a .env.local file (and in Cloudflare Pages variables when deployed). See the README.
// The publishable key is meant to be public; row-level security (supabase/schema.sql) is what protects the data.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase settings. Create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart npm run dev.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

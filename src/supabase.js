import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://svipyrdkdaqdkovaufax.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2aXB5cmRrZGFxZGtvdmF1ZmF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDY1MzksImV4cCI6MjA5MDM4MjUzOX0.yk4kLSXr7jSMRPgwedC-CjIFDkvFncxKXSjkoFjmhK4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
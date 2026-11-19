// Configuración de conexión a la base de datos de Supabase
const SUPABASE_URL = 'https://msdrsxowmtcpzrvbgcjn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zZHJzeG93bXRjcHpydmJnY2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5MTQ1NDQsImV4cCI6MjExMDQ5MDU0NH0.a_rdtuSEPm23P11oaqxQNiPxIvmy8gei12Rmz3H0Ly0';

const _db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
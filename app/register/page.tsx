import FormHeader from '@/components/FormHeader';
import RegisterForm from '@/components/RegisterForm';
export const dynamic = 'force-dynamic';
export default function Register() { return <main><FormHeader eyebrow="FREE · AGES 6–15 · IN & AROUND VIZAG" title="Your journey starts here." description="October 26 – November 25, 2026. A parent or guardian should complete this form with the child."/><RegisterForm ready={Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)}/></main>; }

import FormHeader from '@/components/FormHeader';
import OfferingForm from '@/components/OfferingForm';
export const dynamic = 'force-dynamic';
export default async function Participate({ searchParams }: { searchParams: Promise<{tab?:string}> }) {
  const { tab } = await searchParams;
  return <main><FormHeader eyebrow="OCTOBER 26 – NOVEMBER 25 · ALL TIMES IST" title="Offer a little love." description="Your daily lamp and your special creations, offered with devotion. Ask a parent or guardian to help with your submission."/><OfferingForm ready={Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)} initialTab={tab==='special'?'special':'daily'}/></main>;
}

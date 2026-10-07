import FormHeader from '@/components/FormHeader';
import OrganizerDashboard from '@/components/OrganizerDashboard';
export const metadata = { title: 'Organizer access | Damodara Vratham', robots: { index: false, follow: false } };
export default function Organizer() { return <main><FormHeader eyebrow="PRIVATE ORGANIZER ACCESS" title="Every little offering matters." description="Review lamp photos, record daily attendance and celebrate the children’s dedication."/><OrganizerDashboard/></main>; }

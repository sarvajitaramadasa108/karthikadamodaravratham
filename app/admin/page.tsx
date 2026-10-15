import OrganizerDashboard from '@/components/OrganizerDashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin registrations | Karthika Damodara Challenge', robots: { index: false, follow: false } };

export default function AdminPage() {
  return <main><div className="page-top"><span className="eyebrow">PRIVATE ADMIN AREA</span><h1>Registrations</h1><p>Review submitted registrations and participation records.</p></div><OrganizerDashboard /></main>;
}

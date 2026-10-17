import QuizPlatform from '@/components/QuizPlatform';

export const metadata = { title: 'Host a Quiz | Karthika Quiz' };

export default function QuizHostPage() {
  return <QuizPlatform initialMode="hostDashboard" lockedMode="host" />;
}

import QuizPlatform from '@/components/QuizPlatform';

export const metadata = { title: 'Join a Quiz | Karthika Quiz' };

export default function QuizJoinPage() {
  return <QuizPlatform initialMode="join" lockedMode="join" />;
}

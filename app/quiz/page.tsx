import QuizPlatform from '@/components/QuizPlatform';

export const metadata = {
  title: 'Karthika Quiz | Live Learning',
  description: 'Host and join live Karthika Damodara learning quizzes.'
};

export default function QuizPage() {
  return <QuizPlatform initialMode="join" lockedMode="join" />;
}

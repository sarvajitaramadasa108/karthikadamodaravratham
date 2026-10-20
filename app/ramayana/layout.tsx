import type { Metadata } from 'next';
import styles from '@/components/ramayana/Ramayana.module.css';
export const metadata: Metadata = { title: 'Ramayana Quiz', description: 'An independent live Ramayana quiz. Scan, join and explore the epic at your own pace.', icons: { icon: '/ramayana-icon.svg' }, robots: { index: false, follow: false } };
export default function RamayanaLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.app}><header className={styles.header}><a href="/ramayana" className={styles.brand}><span>🏹</span><div>Ramayana Quiz<small>A journey through the epic</small></div></a><a href="/ramayana/join">Participant entry ↗</a></header>{children}<footer className={styles.footer}>Reflect. Remember. Rediscover the Ramayana.</footer></div>;
}

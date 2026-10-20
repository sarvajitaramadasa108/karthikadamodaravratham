import Link from 'next/link';
import styles from '@/components/ramayana/Ramayana.module.css';
export default function RamayanaHome() {
  return <main className={styles.main}><section className={styles.hero}><span className={styles.eyebrow}>THE RAMAYANA · A LIVE QUIZ EXPERIENCE</span><div className={styles.emblem}>🏹</div><h1>An epic journey.<br/><em>One question at a time.</em></h1><p>Explore the wisdom, characters and moments of the Ramayana. Join the gathering and take the quiz at your own pace.</p><div className={styles.actions}><Link className={styles.button} href="/ramayana/join">Join the quiz →</Link><Link className={styles.secondary} href="/ramayana/host">Admin dashboard</Link></div><div className={styles.facts}><span>30 seconds per question</span><span>Your own pace</span><span>Every answer counts</span></div></section></main>;
}

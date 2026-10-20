'use client';
import { useEffect, useState } from 'react';
import { ramayanaApi } from './api';
import styles from './Ramayana.module.css';
export default function RamayanaScreen() {
  const [code, setCode] = useState(''), [error, setError] = useState('');
  const [lobby, setLobby] = useState<{ title: string; status: string; count: number } | null>(null);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('code') || '';
    if (!/^\d{6}$/.test(value)) { setError('Open the audience screen from your quiz room in the admin dashboard.'); return; }
    setCode(value);
    let active = true, loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try { const data = await ramayanaApi(`?lobby=${value}`); if (active) { setLobby(data); setError(''); } }
      catch (err) { if (active) setError((err as Error).message); }
      finally { loading = false; }
    };
    void refresh(); const interval = window.setInterval(refresh, 3000);
    return () => { active = false; clearInterval(interval); };
  }, []);
  return <main className={styles.main}><section className={`${styles.card} ${styles.center} ${styles.audience}`}>
    <span className={styles.eyebrow}>WELCOME TO THE GATHERING</span><h1>{lobby?.title || 'Ramayana Quiz'}</h1>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {lobby?.status === 'lobby' ? <><h2>Scan. Join. Get ready.</h2><div className={styles.audienceQr}><img src={`/api/ramayana/qr?code=${code}`} width={350} height={350} alt="Scan this QR code to join the Ramayana quiz"/></div><div className={styles.gameCode}>{code.slice(0, 3)} {code.slice(3)}</div><p>Enter your name and mobile number.<br/>Your quiz begins when the admin clicks start.</p><span className={styles.badge}>{lobby.count} participants joined</span></> : lobby ? <><div className={styles.emblem}>🏹</div><h2>{lobby.status === 'live' ? 'The journey has begun.' : 'Thank you for joining us.'}</h2><p>{lobby.status === 'live' ? 'Follow the questions on your phone. Everyone moves at their own pace.' : 'The quiz is now closed.'}</p><span className={styles.badge}>{lobby.count} participants</span></> : !error && <p>Loading the quiz lobby…</p>}
    <div className={styles.actions} style={{ justifyContent: 'center' }}><button className={styles.secondary} onClick={async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { setError('Use your browser’s full screen command to enlarge this page.'); } }}>Toggle full screen</button></div>
  </section></main>;
}

'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { PlayerState } from '@/lib/ramayana/validation';
import { ramayanaApi } from './api';
import styles from './Ramayana.module.css';

export default function RamayanaPlayer() {
  const [code, setCode] = useState(''), [name, setName] = useState(''), [phone, setPhone] = useState('');
  const [credential, setCredential] = useState(''), [state, setState] = useState<PlayerState | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<number | null>(null), [now, setNow] = useState(Date.now());
  const offset = useRef(0), inFlight = useRef(false), submitting = useRef(false), lastPosition = useRef(-1);
  const completed = state?.phase === 'finished' || state?.phase === 'closed';
  function accept(next: PlayerState) {
    offset.current = Date.parse(next.serverNow) - Date.now();
    setNow(Date.now() + offset.current);
    if (lastPosition.current !== next.position) { setSelected(null); lastPosition.current = next.position; }
    setState(next);
  }
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('code') || '';
    setCode(requested);
    try {
      const saved = JSON.parse(localStorage.getItem('ramayana-participant') || 'null');
      if (saved?.token && (!requested || saved.code === requested)) { setCredential(saved.token); setCode(saved.code); }
    } catch { /* Registration remains available when storage is unavailable. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!credential || completed) return;
    let active = true;
    const refresh = async () => {
      if (inFlight.current || submitting.current) return;
      inFlight.current = true;
      try { const next = await ramayanaApi('', undefined, credential); if (active) { accept(next); setError(''); } }
      catch (err) {
        if (active) {
          setError((err as Error).message);
          if ((err as { status?: number }).status === 401) { setCredential(''); setState(null); }
        }
      } finally { inFlight.current = false; }
    };
    void refresh();
    const polling = window.setInterval(refresh, 1000);
    const ticking = window.setInterval(() => setNow(Date.now() + offset.current), 100);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; clearInterval(polling); clearInterval(ticking); document.removeEventListener('visibilitychange', visible); };
  }, [credential, completed]);
  async function join(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await ramayanaApi('', { action: 'join', code, name, phone });
      try { localStorage.setItem('ramayana-participant', JSON.stringify({ token: data.token, code })); } catch { /* Keep the active session in memory. */ }
      accept(data.state); setCredential(data.token);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function submit() {
    if (selected === null || !state || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    // Let an already-running refresh settle; don't drop a click during polling.
    const position = state.position, answer = selected;
    try {
      while (inFlight.current) await new Promise(resolve => window.setTimeout(resolve, 20));
      inFlight.current = true;
      accept(await ramayanaApi('', { action: 'answer', position, answer }, credential));
    }
    catch (err) { setError((err as Error).message); }
    finally { inFlight.current = false; submitting.current = false; setBusy(false); }
  }
  const countdown = state?.opensAt ? Math.max(0, Math.min(3, Math.ceil((Date.parse(state.opensAt) - now) / 1000))) : 3;
  const remaining = state?.deadline ? Math.max(0, Math.min(30, Math.ceil((Date.parse(state.deadline) - now) / 1000))) : 30;
  return <main className={styles.main}><div className={styles.participant}>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {!ready || (credential && !state) ? <section className={styles.card}><p role="status">Connecting to your quiz…</p></section> : !state ? <section className={styles.card}>
      <span className={styles.eyebrow}>YOUR JOURNEY BEGINS HERE</span><h1>Join the Ramayana quiz</h1><p>Enter your details, then wait for the admin to begin.</p>
      <form onSubmit={join} className={styles.form}>
        <label>Quiz code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}/></label>
        <label>Your name<input autoComplete="name" minLength={2} maxLength={80} required value={name} onChange={e => setName(e.target.value)}/></label>
        <label>Mobile number<input type="tel" autoComplete="tel" maxLength={25} placeholder="10-digit mobile number" required value={phone} onChange={e => setPhone(e.target.value)}/></label>
        <p className={styles.note}>Your name and mobile number are shared with the quiz organizers to manage participation and results.</p>
        <button className={styles.button} disabled={busy}>{busy ? 'Joining…' : 'Join & enter waiting room →'}</button>
      </form></section> : state.phase === 'waiting' ? <section className={`${styles.card} ${styles.center}`}>
        <div className={styles.emblem}>🏹</div><span className={styles.eyebrow}>YOU’RE IN, {state.name}</span><h1>{state.title}</h1><div className={styles.waitingDot}/><h2>Let the admin start the quiz</h2><p>Keep this screen open. Your first countdown will appear automatically.</p><div className={styles.facts}><span>{state.total} questions</span><span>30 seconds each</span></div>
      </section> : state.phase === 'countdown' ? <section className={`${styles.card} ${styles.center}`} aria-live="polite">
        <span className={styles.eyebrow}>QUESTION {state.position + 1} OF {state.total}</span><h2>Get ready, {state.name}</h2><div className={styles.countdown}>{countdown || 'Go'}</div><p>Your next question is on its way.</p>
      </section> : state.phase === 'question' ? <section className={styles.card}>
        <div className={styles.questionMeta}><span>QUESTION {state.position + 1} / {state.total}</span><strong className={remaining <= 5 ? styles.urgent : ''}>{remaining}s</strong></div>
        <div className={styles.timer}><div style={{ width: `${remaining / 30 * 100}%` }}/></div>
        <h1 className={styles.question}>{state.question?.prompt}</h1>
        <fieldset className={styles.options} disabled={busy || remaining === 0}><legend className={styles.srOnly}>Choose one answer</legend>{state.question?.options.map((option, index) => <label key={index} className={selected === index ? styles.selected : ''}>
          <input type="radio" name="ramayana-answer" value={index} checked={selected === index} onChange={() => setSelected(index)}/><b>{String.fromCharCode(65 + index)}</b><span>{option}</span>
        </label>)}</fieldset>
        <button className={styles.button} disabled={selected === null || busy || remaining === 0} onClick={submit}>{busy ? 'Submitting…' : remaining === 0 ? 'Time’s up · moving ahead…' : state.position + 1 === state.total ? 'Submit & finish →' : 'Submit & next question →'}</button>
        <p className={styles.note}>Submitting locks your answer and starts your next countdown. You don’t need to wait for anyone else.</p>
      </section> : <section className={`${styles.card} ${styles.center}`}><div className={styles.emblem}>✦</div><span className={styles.eyebrow}>{state.phase === 'finished' ? 'JOURNEY COMPLETE' : 'QUIZ CLOSED'}</span><h1>Thank you, {state.name}.</h1><p>{state.phase === 'finished' ? 'You have completed the Ramayana quiz.' : 'The admin has closed this quiz.'}</p><div className={styles.score}>{state.score}<small> / {state.total}</small></div><p>correct answers</p><p className={styles.note}>The organizers can view the final results.</p></section>}
  </div></main>;
}

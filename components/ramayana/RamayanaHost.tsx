'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { cleanQuestions, DraftQuestion } from '@/lib/ramayana/validation';
import { ramayanaApi } from './api';
import styles from './Ramayana.module.css';
type Room = { id: string; code: string; title: string; status: 'lobby' | 'live' | 'closed' };
type Player = { id: string; name: string; phone: string; position: number; score: number; elapsed_ms: number; finished_at: string | null };
const blank = (): DraftQuestion => ({ prompt: '', options: ['', '', '', ''], correctIndex: 0 });
export default function RamayanaHost() {
  const [authenticated, setAuthenticated] = useState(false), [password, setPassword] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]), [players, setPlayers] = useState<Player[]>([]);
  const [code, setCode] = useState(''), [origin, setOrigin] = useState('');
  const [title, setTitle] = useState('Ramayana Quiz'), [questions, setQuestions] = useState<DraftQuestion[]>([blank()]);
  const [creating, setCreating] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const inFlight = useRef(false);
  const room = rooms.find(item => item.code === code);
  const joinUrl = `${origin}/ramayana/join?code=${code}`;
  useEffect(() => { setOrigin(window.location.origin); }, []);
  async function refresh(selectedCode = code) {
    const data = await ramayanaApi(`?admin=1${selectedCode ? `&code=${selectedCode}` : ''}`);
    setRooms(data.sessions); setPlayers(data.players); setAuthenticated(true);
  }
  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const data = await ramayanaApi(`?admin=1${code ? `&code=${code}` : ''}`);
        if (active) { setRooms(data.sessions); setPlayers(data.players); setAuthenticated(true); setError(''); }
      } catch (err) { if (active) { if ((err as { status?: number }).status === 401) setAuthenticated(false); else setError((err as Error).message); } }
      finally { inFlight.current = false; }
    };
    void poll(); const timer = window.setInterval(poll, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [code]);
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await ramayanaApi('', { action: 'login', password }); setPassword(''); await refresh(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const cleaned = cleanQuestions(questions); const data = await ramayanaApi('', { action: 'create', title, questions: cleaned }); await refresh(data.code); setCode(data.code); setCreating(false); setQuestions([blank()]); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function action(type: 'start' | 'close') {
    if (type === 'close' && !window.confirm('Close this quiz now? Participants who are still answering will be stopped.')) return;
    setBusy(true); setError('');
    try { await ramayanaApi('', { action: type, code }); await refresh(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  function update(index: number, value: Partial<DraftQuestion>) { setQuestions(current => current.map((q, i) => i === index ? { ...q, ...value } : q)); }
  async function loadPdfQuestions() {
    if (questions.some(q => q.prompt.trim()) && !window.confirm('Replace this unsaved draft with the 25 questions from your PDF?')) return;
    setBusy(true); setError('');
    try {
      const data = await ramayanaApi('', { action: 'loadPdfQuestions' });
      setQuestions(cleanQuestions(data.questions)); setTitle(data.title);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    setError('');
    try {
      if (file.size > 2000000) throw new Error('Use a workbook smaller than 2 MB.');
      const workbook = XLSX.read(await file.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
      const imported = rows.map(row => ({ prompt: String(row.Question || ''), options: ['Option A', 'Option B', 'Option C', 'Option D'].map(key => String(row[key] || '')), correctIndex: ['A', 'B', 'C', 'D'].indexOf(String(row['Correct Answer']).trim().toUpperCase()) }));
      setQuestions(cleanQuestions(imported));
    } catch (err) { setError((err as Error).message); }
  }
  function template() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'], ['Replace this with your question', 'First option', 'Second option', 'Third option', 'Fourth option', 'A']]), 'Ramayana');
    XLSX.writeFile(workbook, 'ramayana-quiz-template.xlsx');
  }
  function exportResults() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(players.map(p => ({ Name: p.name, Mobile: p.phone, 'Questions completed': p.position, 'Correct answers': p.score, 'Answer time (seconds)': p.elapsed_ms / 1000, Finished: p.finished_at ? 'Yes' : 'No' }))), 'Results');
    XLSX.writeFile(workbook, `ramayana-${code}-results.xlsx`);
  }
  return <main className={styles.main}>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {!authenticated ? <section className={`${styles.card} ${styles.login}`}><span className={styles.eyebrow}>ORGANIZER ACCESS</span><h1>Host the journey</h1><p>Sign in with your Ramayana quiz admin password.</p><form className={styles.form} onSubmit={login}><label>Admin password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></label><button className={styles.button} disabled={busy}>{busy ? 'Signing in…' : 'Sign in →'}</button></form></section> : <>
      <div className={styles.topline}><div><span className={styles.eyebrow}>ADMIN DASHBOARD</span><h1>Your Ramayana quizzes</h1></div><div className={styles.actions}><button className={styles.secondary} onClick={async () => { try { await ramayanaApi('', { action: 'logout' }); setAuthenticated(false); setPlayers([]); } catch (err) { setError((err as Error).message); } }}>Sign out</button><button className={styles.button} onClick={() => setCreating(!creating)}>{creating ? 'Back to rooms' : '+ Create quiz'}</button></div></div>
      {creating ? <form onSubmit={create} className={styles.card}><span className={styles.eyebrow}>BUILD YOUR QUESTION SET</span><h2>Create a quiz</h2><label className={styles.field}>Quiz title<input value={title} maxLength={120} minLength={3} required onChange={e => setTitle(e.target.value)}/></label><div className={styles.actions}><button type="button" className={styles.button} disabled={busy} onClick={loadPdfQuestions}>Load your 25 PDF questions</button><button type="button" className={styles.secondary} onClick={template}>Download Excel template</button><label className={styles.secondary}>Import Excel<input type="file" accept=".xlsx,.xls,.csv" className={styles.fileInput} onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }}/></label></div><p className={styles.note}>1–100 questions · 30 seconds each · English and Telugu text supported. Import replaces this draft. Save the quiz before sharing the QR.</p>
        {questions.map((q, index) => <fieldset className={styles.editor} key={index}><legend>Question {index + 1}</legend><label className={styles.field}>Question text<textarea value={q.prompt} required minLength={3} maxLength={1000} onChange={e => update(index, { prompt: e.target.value })}/></label><div className={styles.editorOptions}>{q.options.map((option, i) => <label key={i}>Option {String.fromCharCode(65 + i)}<input required value={option} maxLength={500} onChange={e => update(index, { options: q.options.map((v, n) => n === i ? e.target.value : v) })}/></label>)}</div><div className={styles.actions}><label>Correct answer <select value={q.correctIndex} onChange={e => update(index, { correctIndex: Number(e.target.value) })}>{q.options.map((_, i) => <option key={i} value={i}>{String.fromCharCode(65 + i)}</option>)}</select></label><button type="button" className={styles.secondary} disabled={questions.length <= 1} onClick={() => setQuestions(questions.filter((_, i) => i !== index))}>Remove question</button></div></fieldset>)}
        <div className={styles.actions}><button type="button" className={styles.secondary} disabled={questions.length >= 100} onClick={() => setQuestions([...questions, blank()])}>+ Add question</button><button className={styles.button} disabled={busy}>{busy ? 'Saving…' : `Create room · ${questions.length} questions →`}</button></div>
      </form> : <div className={styles.dashboard}>
        <aside className={styles.roomList}><h2>Quiz rooms</h2>{!rooms.length && <p>Create a quiz to get a QR code for your audience.</p>}{rooms.map(r => <button className={`${styles.room} ${code === r.code ? styles.activeRoom : ''}`} key={r.code} onClick={() => { setCode(r.code); setPlayers([]); }}><span>{r.status}</span><strong>{r.title}</strong><small>CODE {r.code}</small></button>)}</aside>
        {room ? <section><div className={styles.card}><div className={styles.topline}><div><span className={styles.eyebrow}>{room.status.toUpperCase()} ROOM</span><h2>{room.title}</h2></div><span className={styles.badge}>{players.length} joined</span></div><div className={styles.qrLobby}><div className={styles.qr}>{origin && <img src={`/api/ramayana/qr?code=${code}`} width={260} height={260} alt={`Scan to join Ramayana quiz ${code}`}/>}</div><div><h3>Scan to join the quiz</h3><div className={styles.gameCode}>{code.slice(0, 3)} {code.slice(3)}</div><p>Enter your name and mobile number. Wait for the admin to start.</p><a className={styles.joinLink} href={joinUrl} target="_blank" rel="noreferrer">{joinUrl}</a><div className={styles.actions}><button className={styles.secondary} onClick={async () => { try { await navigator.clipboard.writeText(joinUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setError('Copy the join link displayed above.'); } }}>{copied ? 'Copied!' : 'Copy join link'}</button><a className={styles.secondary} href={`/ramayana/screen?code=${code}`} target="_blank" rel="noreferrer">Open audience screen ↗</a></div></div></div><div className={styles.actions}>{room.status === 'lobby' && <button className={styles.button} disabled={busy || players.length === 0} onClick={() => action('start')}>{busy ? 'Starting…' : '▶ Start quiz for everyone'}</button>}{room.status === 'live' && <><span className={styles.badge}>Live · everyone progresses independently</span><button className={styles.secondary} disabled={busy} onClick={() => action('close')}>Close quiz</button></>}</div></div>
          <div className={styles.card}><div className={styles.topline}><div><h2>Participants & results</h2><p>Ranked by correct answers, then least answer time. Final ranks use completed attempts.</p></div><button className={styles.secondary} disabled={!players.length} onClick={exportResults}>Export results</button></div><div className={styles.tableWrap}><table><thead><tr><th>Name</th><th>Mobile</th><th>Answered</th><th>Correct</th><th>Time</th><th>Status</th></tr></thead><tbody>{players.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.phone}</td><td>{p.position}</td><td>{p.score}</td><td>{(p.elapsed_ms / 1000).toFixed(1)}s</td><td>{p.finished_at ? 'Finished' : room.status === 'lobby' ? 'Waiting' : room.status === 'closed' ? 'Stopped' : 'In progress'}</td></tr>)}</tbody></table></div>{!players.length && <p>No participants yet. Show the QR code on your screen.</p>}</div>
        </section> : <section className={`${styles.card} ${styles.center}`}><div className={styles.emblem}>🏹</div><h2>Welcome to the gathering</h2><p>Select a quiz room or create your first quiz.</p></section>}
      </div>}
    </>}
  </main>;
}

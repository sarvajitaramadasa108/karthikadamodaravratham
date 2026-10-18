'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Gamepad2, Heart, Play, Sparkles, Users } from 'lucide-react';
import * as XLSX from 'xlsx';

type QuizQuestion = { id: string; position: number; prompt: string; options: string[]; correctIndex?: number; seconds: number };
type Player = { id: string; display_name: string; score: number; joined_at?: string };
type QuizView = { session: { id: string; code: string; title: string; status: 'lobby' | 'live' | 'finished'; current_question: number; created_at?: string }; questions: QuizQuestion[]; question: QuizQuestion | null; players: Player[]; phase?: 'countdown' | 'question' | 'result' | 'next'; secondsRemaining?: number };
type HostRoom = { code: string; title: string; hostToken: string; status: 'lobby' | 'live' | 'finished'; createdAt: string };

const starterQuestions: { prompt: string; options: string[]; correctIndex: number; seconds: number }[] = [];
const emptyQuestion = { prompt: '', options: ['', '', '', ''], correctIndex: 0, seconds: 30 };

async function callApi(body: Record<string, unknown>) {
  const response = await fetch('/api/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Quiz action failed.');
  return data;
}

function copyText(value: string) { navigator.clipboard?.writeText(value); }

export default function QuizPlatform({ initialMode = 'home', lockedMode }: { initialMode?: 'home' | 'host' | 'join' | 'hostDashboard'; lockedMode?: 'host' | 'join' }) {
  const [mode, setMode] = useState<'home' | 'hostDashboard' | 'host' | 'join' | 'hostRoom' | 'playerRoom'>(initialMode);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('Karthika Damodara Values Quiz');
  const [questionsDraft, setQuestionsDraft] = useState(starterQuestions);
  const [manualQuestion, setManualQuestion] = useState(emptyQuestion);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [gameCode, setGameCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [view, setView] = useState<QuizView | null>(null);
  const [hostToken, setHostToken] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [answered, setAnswered] = useState<number | null>(null);
  const [reaction, setReaction] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [answerFeedback, setAnswerFeedback] = useState<{ correct: boolean; points: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedRooms, setSavedRooms] = useState<HostRoom[]>([]);
  const [roomViews, setRoomViews] = useState<Record<string, QuizView>>({});
  const [selectedRoomCode, setSelectedRoomCode] = useState('');
  const [editingCode, setEditingCode] = useState('');

  const current = view?.question;
  const isHost = mode === 'hostRoom';
  const roomCode = view?.session.code || gameCode;
  const sortedPlayers = useMemo(() => [...(view?.players || [])].sort((a, b) => b.score - a.score), [view?.players]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('karthikaQuizHostRooms') || '[]');
      setSavedRooms(Array.isArray(stored) ? stored.filter((room): room is HostRoom => Boolean(room && typeof room.code === 'string' && typeof room.hostToken === 'string')) : []);
    } catch { setSavedRooms([]); }
  }, []);

  function rememberRoom(room: HostRoom) {
    const next = [room, ...savedRooms.filter((item) => item.code !== room.code)].slice(0, 20);
    setSavedRooms(next);
    window.localStorage.setItem('karthikaQuizHostRooms', JSON.stringify(next));
  }

  function forgetRoom(code: string) {
    setSavedRooms((current) => {
      const next = current.filter((room) => room.code !== code);
      window.localStorage.setItem('karthikaQuizHostRooms', JSON.stringify(next));
      return next;
    });
    setRoomViews((current) => {
      const next = { ...current };
      delete next[code];
      return next;
    });
  }

  function saveManualQuestion() {
    const prompt = manualQuestion.prompt.trim();
    const options = manualQuestion.options.map((option) => option.trim()).filter(Boolean);
    if (prompt.length < 3 || options.length < 2 || manualQuestion.correctIndex >= options.length) { setError('Add a question, at least 2 options, and choose a valid correct answer.'); return; }
    const next = [...questionsDraft];
    const clean = { prompt, options, correctIndex: manualQuestion.correctIndex, seconds: manualQuestion.seconds };
    if (editingQuestionIndex === null) next.push(clean); else next[editingQuestionIndex] = clean;
    if (next.length > 10) { setError('A quiz can contain a maximum of 10 questions.'); return; }
    setQuestionsDraft(next); setManualQuestion(emptyQuestion); setEditingQuestionIndex(null); setError('');
  }
  function editManualQuestion(index: number) { const question = questionsDraft[index]; setManualQuestion({ prompt: question.prompt, options: [...question.options, '', '', '', ''].slice(0, 4), correctIndex: question.correctIndex, seconds: question.seconds }); setEditingQuestionIndex(index); }
  function removeManualQuestion(index: number) { setQuestionsDraft(questionsDraft.filter((_, item) => item !== index)); if (editingQuestionIndex === index) { setManualQuestion(emptyQuestion); setEditingQuestionIndex(null); } }

  async function refresh(code = roomCode) {
    if (!code) return;
    const response = await fetch(`/api/quiz?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load this game.');
    setView(data);
  }

  function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Timer Seconds'],
      ['Who is known as Damodara?', 'Sri Krishna', 'Arjuna', 'Balarama', 'Narada', 'A', 30],
      ['What do we offer during the Damodara month?', 'A ghee lamp', 'A crown', 'A conch only', 'A flag', 'A', 30]
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Questions');
    XLSX.writeFile(book, 'karthika-quiz-template.xlsx');
  }

  async function importWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (!rows.length || rows.length > 10) throw new Error('The workbook must contain between 1 and 10 question rows.');
      const imported = rows.map((row, index) => {
        const value = (name: string) => String(row[name] ?? row[name.toLowerCase()] ?? '').trim();
        const options = ['Option A', 'Option B', 'Option C', 'Option D'].map(value).filter(Boolean);
        if (!value('Question') || options.length < 2) throw new Error(`Row ${index + 2} needs a question and at least 2 options.`);
        const correct = value('Correct Answer').toUpperCase();
        const letterIndex = ['A', 'B', 'C', 'D'].indexOf(correct);
        const textIndex = options.findIndex((option) => option.toLowerCase() === correct.toLowerCase());
        const correctIndex = letterIndex >= 0 && letterIndex < options.length ? letterIndex : textIndex;
        if (correctIndex < 0) throw new Error(`Row ${index + 2} must have Correct Answer A, B, C, or D.`);
        const seconds = Number(value('Timer Seconds') || 20);
        if (!Number.isInteger(seconds) || seconds < 5 || seconds > 240) throw new Error(`Row ${index + 2} timer must be between 5 and 240 seconds.`);
        return { prompt: value('Question'), options, correctIndex, seconds };
      });
      setQuestionsDraft(imported); setManualQuestion(emptyQuestion); setEditingQuestionIndex(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not read that workbook.'); }
  }

  useEffect(() => {
    if (mode !== 'hostRoom' && mode !== 'playerRoom') return;
    const timer = window.setInterval(() => { refresh().catch(() => undefined); }, 1800);
    return () => window.clearInterval(timer);
  }, [mode, roomCode]);

  useEffect(() => {
    if (mode === 'hostRoom' && view?.phase === 'next' && !busy) hostAction('next').catch(() => undefined);
  }, [mode, view?.phase, view?.session.current_question]);

  useEffect(() => {
    if ((mode !== 'hostDashboard' && mode !== 'host') || savedRooms.length === 0) return;
    const loadRooms = () => Promise.all(savedRooms.map(async (room) => {
      try { const response = await fetch(`/api/quiz?code=${encodeURIComponent(room.code)}`, { cache: 'no-store' }); const data = await response.json(); return { room, data, missing: response.status === 404 && data?.error === 'Game code not found.' }; }
      catch { return null; }
    })).then((items) => {
      const valid = items.filter((item): item is { room: HostRoom; data: QuizView; missing: boolean } => Boolean(item));
      const missingCodes = new Set(valid.filter((item) => item.missing).map((item) => item.room.code));
      if (missingCodes.size > 0) {
        const nextRooms = savedRooms.filter((room) => !missingCodes.has(room.code));
        setSavedRooms(nextRooms);
        window.localStorage.setItem('karthikaQuizHostRooms', JSON.stringify(nextRooms));
      }
      setRoomViews(Object.fromEntries(valid.filter((item) => !item.missing && item.data?.session).map((item) => [item.room.code, item.data])));
    });
    loadRooms();
    const timer = window.setInterval(loadRooms, 5000);
    return () => window.clearInterval(timer);
  }, [mode, savedRooms]);

  useEffect(() => {
    if (!current || view?.session.status !== 'live' || (view.phase !== 'question' && view.phase !== 'countdown')) { setRemaining(0); return; }
    let left = view.secondsRemaining ?? (view.phase === 'countdown' ? 3 : current.seconds);
    setRemaining(left);
    const timer = window.setInterval(() => {
      left -= 1;
      setRemaining(Math.max(0, left));
      if (left <= 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [current?.id, view?.session.status, view?.phase, view?.secondsRemaining]);

  async function createQuiz(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const data = editingCode ? await callApi({ action: 'update', code: editingCode, hostToken, title, questions: questionsDraft }) : await callApi({ action: 'create', title, questions: questionsDraft }); setView(data); if (!editingCode) { setHostToken(data.hostToken); setGameCode(data.session.code); } rememberRoom({ code: data.session.code, title: data.session.title, hostToken: editingCode ? hostToken : data.hostToken, status: data.session.status, createdAt: data.session.created_at || new Date().toISOString() }); setEditingCode(''); setMode('hostRoom'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not create the quiz.'); }
    finally { setBusy(false); }
  }

  async function joinQuiz(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const data = await callApi({ action: 'join', code: gameCode.trim(), displayName }); setView(data); setPlayerId(data.player.id); setMode('playerRoom'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not join the quiz.'); }
    finally { setBusy(false); }
  }

  async function hostAction(action: 'start' | 'next') {
    setBusy(true); setError('');
    try { const data = await callApi({ action, code: roomCode, hostToken }); setView(data); rememberRoom({ code: data.session.code, title: data.session.title, hostToken, status: data.session.status, createdAt: data.session.created_at || new Date().toISOString() }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update the room.'); }
    finally { setBusy(false); }
  }

  async function resumeRoom(room: HostRoom) {
    setBusy(true); setError('');
    try { await refresh(room.code); setGameCode(room.code); setHostToken(room.hostToken); setMode('hostRoom'); }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open that room.';
      if (message === 'Game code not found.') forgetRoom(room.code);
      setError(message);
    }
    finally { setBusy(false); }
  }

  async function editRoom(room: HostRoom) {
    setBusy(true); setError('');
    try { const data = await callApi({ action: 'loadHost', code: room.code, hostToken: room.hostToken }); setTitle(data.session.title); setQuestionsDraft(data.questions.map((question: QuizQuestion & { correct_index: number }) => ({ prompt: question.prompt, options: question.options, correctIndex: question.correct_index, seconds: question.seconds }))); setEditingCode(room.code); setHostToken(room.hostToken); setGameCode(room.code); setMode('host'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not edit that quiz.'); }
    finally { setBusy(false); }
  }

  async function restartRoom(room: HostRoom) {
    if (!window.confirm('Restart this quiz? All participants, answers, and scores for this room will be cleared.')) return;
    setBusy(true); setError('');
    try {
      const data = await callApi({ action: 'restart', code: room.code, hostToken: room.hostToken });
      rememberRoom({ code: data.session.code, title: data.session.title, hostToken: room.hostToken, status: data.session.status, createdAt: data.session.created_at || room.createdAt });
      setRoomViews((current) => ({ ...current, [room.code]: data }));
      if (roomCode === room.code) {
        setView(data);
        setHostToken(room.hostToken);
        setGameCode(room.code);
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not restart the quiz.'); }
    finally { setBusy(false); }
  }

  async function answer(index: number) {
    if (!current || answered !== null || remaining <= 0) return;
    setBusy(true); setError('');
    try { const result = await callApi({ action: 'answer', code: roomCode, playerId, answerIndex: index }); setAnswered(index); setAnswerFeedback({ correct: result.correct, points: result.points }); window.setTimeout(() => setAnswerFeedback(null), 5000); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not record that answer.'); }
    finally { setBusy(false); }
  }

  function resetForNext() { setAnswered(null); setReaction(''); setAnswerFeedback(null); }
  useEffect(() => { resetForNext(); }, [view?.session.current_question]);

  if (mode === 'hostDashboard') return <QuizShell><div className="quiz-dashboard-heading"><div><span className="quiz-kicker">Host dashboard</span><h2>Your quizzes</h2><p>Monitor participation, open a live room, review scores, or edit a quiz.</p></div><button className="quiz-button" onClick={() => { setEditingCode(''); setQuestionsDraft(starterQuestions); setManualQuestion(emptyQuestion); setEditingQuestionIndex(null); setMode('host'); }}><Sparkles size={17}/> Create quiz</button></div>{error && <div className="quiz-error">{error}</div>}{savedRooms.length === 0 ? <div className="quiz-card quiz-empty-dashboard"><Gamepad2 size={30}/><h3>No quizzes created yet</h3><p>Create your first Karthika values quiz and it will appear here.</p><button className="quiz-button" onClick={() => setMode('host')}>Create your first quiz</button></div> : <div className="quiz-dashboard-grid">{savedRooms.map((room) => { const details = roomViews[room.code]; const players = details?.players || []; const status = details?.session?.status || room.status; const average = players.length ? Math.round(players.reduce((sum, player) => sum + player.score, 0) / players.length) : 0; return <article className="quiz-card quiz-dashboard-card" key={room.code}><div className="quiz-dashboard-card-top"><span className={`quiz-status ${status}`}>{status}</span><strong>{room.code}</strong></div><h3>{room.title}</h3><div className="quiz-dashboard-stats"><span><b>{players.length}</b> participants</span><span><b>{details?.questions?.length || '—'}</b> questions</span><span><b>{average}</b> avg score</span></div><div className="quiz-dashboard-actions"><button className="quiz-button secondary" onClick={() => resumeRoom(room)}>Open room</button><button className="quiz-text-button" onClick={() => editRoom(room)}>Edit quiz</button><button className="quiz-text-button" onClick={() => setSelectedRoomCode(selectedRoomCode === room.code ? '' : room.code)}>Scorecard</button><button className="quiz-text-button restart" onClick={() => restartRoom(room)} disabled={busy}>Restart</button></div>{selectedRoomCode === room.code && <div className="quiz-inline-scorecard"><strong>Participation scorecard</strong>{players.length === 0 ? <p>No participants yet.</p> : players.slice(0, 10).map((player, index) => <div key={player.id}><span>{index + 1}. {player.display_name}</span><b>{player.score}</b></div>)}</div>}</article>; })}</div>}</QuizShell>;

  if (mode === 'home') return <QuizShell><div className="quiz-hero"><span className="quiz-kicker"><Sparkles size={16}/> Karthika learning studio</span><h1>Live quizzes for <em>devotion</em> and learning.</h1><p>Host a friendly Bhagavad Gita values quiz, share one game code, and let everyone answer together from their phone.</p><div className="quiz-home-actions"><a className="quiz-button" href="/quiz/host"><Play size={18}/> Host a quiz</a><a className="quiz-button secondary" href="/quiz/join"><Gamepad2 size={18}/> Join a quiz</a></div><div className="quiz-feature-row"><span><Users size={16}/> Live player lobby</span><span><Heart size={16}/> Safe reaction bar</span><span><Check size={16}/> Instant scoring</span></div></div><div className="quiz-card quiz-preview"><div className="quiz-preview-glow"/><div className="quiz-preview-code">GAME CODE <strong>123 456</strong></div><div className="quiz-preview-question">What does a lamp represent in devotion?</div><div className="quiz-preview-options"><span>Love</span><span>Discipline</span><span>Both</span><span>Service</span></div><div className="quiz-reactions"><span>❤️</span><span>🙏</span><span>🪔</span><span>✨</span></div></div></QuizShell>;

  if (mode === 'host') return <QuizShell dashboardLink><Back onClick={() => { window.location.href = '/quiz'; }}/>{savedRooms.length > 0 && <div className="quiz-host-rooms"><span className="quiz-kicker">Your quiz rooms</span><h2>Created and active quizzes</h2><div className="quiz-room-list">{savedRooms.map((room) => <div className="quiz-room-row" key={room.code}><div><strong>{room.title}</strong><small>Code {room.code} · {room.status}</small></div><button className="quiz-button secondary" onClick={() => resumeRoom(room)} disabled={busy}>{room.status === 'finished' ? 'View results' : 'Resume room'}</button></div>)}</div></div>}<div className="quiz-card quiz-form-card"><span className="quiz-kicker">Host a room</span><h2>Create a live quiz</h2><p>Type questions yourself or import up to 10 questions from an Excel workbook.</p><form onSubmit={createQuiz}><label className="quiz-field">Quiz title<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120}/></label><div className="quiz-import-tools"><button type="button" className="quiz-button secondary" onClick={downloadTemplate}>Download Excel template</button><label className="quiz-upload">Import Excel workbook<input type="file" accept=".xlsx,.xls,.csv" onChange={importWorkbook}/></label></div><div className="quiz-import-help">Columns: <b>Question, Option A, Option B, Option C, Option D, Correct Answer, Timer Seconds</b>. Correct Answer can be A, B, C, or D.</div><ManualQuestionEditor questions={questionsDraft} draft={manualQuestion} setDraft={setManualQuestion} editingIndex={editingQuestionIndex} onSave={saveManualQuestion} onEdit={editManualQuestion} onRemove={removeManualQuestion}/><div className="quiz-question-preview"><strong>{questionsDraft.length} question{questionsDraft.length === 1 ? '' : 's'} ready</strong>{questionsDraft.map((question, index) => <div key={`${question.prompt}-${index}`}><span>{index + 1}</span>{question.prompt}<small>{question.options.length} options · {question.seconds}s</small></div>)}</div>{error && <div className="quiz-error">{error}</div>}<button className="quiz-button" disabled={busy || questionsDraft.length === 0}>{busy ? 'Creating…' : 'Create live room'} <ArrowRight size={17}/></button></form></div></QuizShell>;

  if (mode === 'join') return <QuizShell><Back onClick={() => { window.location.href = lockedMode ? '/quiz' : '/quiz'; }}/><div className="quiz-card quiz-form-card"><span className="quiz-kicker">Participant entry</span><h2>Enter the game code</h2><p>Use the six-digit code shown by the host.</p><form onSubmit={joinQuiz}><label className="quiz-field">Game code<input value={gameCode} onChange={(event) => setGameCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" required placeholder="123456"/></label><label className="quiz-field">Your display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={40} placeholder="e.g. Radha"/></label>{error && <div className="quiz-error">{error}</div>}<button className="quiz-button" disabled={busy}>{busy ? 'Joining…' : 'Join quiz'} <ArrowRight size={17}/></button></form></div></QuizShell>;

  return <QuizShell dashboardLink={isHost}><div className="quiz-room-top"><div><span className="quiz-kicker">{isHost ? 'Host room' : 'Player room'}</span><h2>{view?.session.title}</h2></div><div className="quiz-code"><small>GAME CODE</small><strong>{roomCode}</strong><button onClick={() => copyText(roomCode)} aria-label="Copy game code"><Copy size={15}/></button></div></div>{error && <div className="quiz-error">{error}</div>}{view?.session.status === 'lobby' && <div className="quiz-card quiz-lobby"><Users size={28}/><h3>Waiting room</h3><p>Share the code with everyone. Players can join from any phone.</p><div className="player-pills">{view.players.map((player) => <span key={player.id}>{player.display_name}</span>)}{view.players.length === 0 && <span className="muted-pill">No players yet</span>}</div>{isHost ? <button className="quiz-button" onClick={() => hostAction('start')} disabled={busy || view.players.length === 0}><Play size={17}/> {busy ? 'Starting…' : 'Start quiz'}</button> : <div className="quiz-waiting">You’re in. Wait for the host to start.</div>}</div>}{view?.session.status === 'live' && current && <div className="quiz-live-grid"><div className="quiz-card quiz-question-card"><PhaseOverlay phase={view.phase} remaining={remaining} feedback={answerFeedback} players={sortedPlayers} playerId={playerId}/><div className="question-meta"><span>Question {current.position + 1} of {view.questions.length}</span><span className={remaining <= 5 ? 'timer-danger' : ''}>⏱ {remaining}s</span></div><div className="quiz-timer"><span style={{ width: `${Math.max(0, Math.min(100, remaining / current.seconds * 100))}%` }}/></div><h3>{current.prompt}</h3><div className="answer-grid">{current.options.map((option, index) => <button key={option} className={answered === index ? 'selected' : ''} onClick={() => answer(index)} disabled={isHost || answered !== null || busy || remaining <= 0 || view.phase !== 'question'}>{String.fromCharCode(65 + index)}. {option}</button>)}</div><div className="quiz-reactions"><span>React</span>{['❤️', '🙏', '🪔', '✨', '👏'].map((item) => <button key={item} className={reaction === item ? 'selected' : ''} onClick={() => setReaction(item)}>{item}</button>)}</div>{isHost ? <button className="quiz-button" onClick={() => hostAction('next')} disabled={busy}>{current.position + 1 === view.questions.length ? 'Show results' : 'Next question'} <ArrowRight size={17}/></button> : answered !== null ? <div className="quiz-waiting">Answer received. Watch the host screen for the next question.</div> : remaining <= 0 && <div className="quiz-waiting">Time is up. Wait for the next question.</div>}</div><Scoreboard players={sortedPlayers}/></div>}{view?.session.status === 'finished' && <div className="quiz-card quiz-results"><span className="quiz-kicker">Quiz complete</span><h2>Well done, everyone.</h2><Scoreboard players={sortedPlayers}/><button className="quiz-button" onClick={() => { setMode('home'); setView(null); }}>Create another quiz</button></div>}</QuizShell>;
}

function Scoreboard({ players }: { players: Player[] }) { return <aside className="quiz-card quiz-scoreboard"><h3>Leaderboard</h3>{players.length === 0 ? <p className="muted-pill">Waiting for players</p> : players.map((player, index) => <div className="score-row" key={player.id}><strong>{index + 1}</strong><span>{player.display_name}</span><b>{player.score}</b></div>)}</aside>; }
function PhaseOverlay({ phase, remaining, feedback, players, playerId }: { phase?: QuizView['phase']; remaining: number; feedback: { correct: boolean; points: number } | null; players: Player[]; playerId: string }) {
  if (feedback) {
    const ranked = [...players].sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, 3);
    const ownIndex = ranked.findIndex((player) => player.id === playerId);
    const own = ownIndex >= 3 ? ranked[ownIndex] : null;
    return <div className="quiz-phase-overlay quiz-feedback-overlay"><div className={`feedback-symbol ${feedback.correct ? 'correct' : 'wrong'}`}>{feedback.correct ? '✓' : '✕'}</div><h3>{feedback.correct ? 'Correct answer!' : 'Wrong answer'}</h3><strong className="feedback-points">+{feedback.points} points</strong>{feedback.correct && <div className="celebration-ribbons">✦ ✧ ✦ ✧ ✦</div>}<div className="mini-leaderboard">{top.map((player, index) => <div key={player.id}><span>{index + 1}. {player.display_name}</span><b>{player.score}</b></div>)}{own && <div className="own-rank"><span>{ownIndex + 1}. {own.display_name} (you)</span><b>{own.score}</b></div>}</div></div>;
  }
  if (phase === 'countdown') return <div className="quiz-phase-overlay countdown-overlay"><small>Get ready</small><strong>{remaining || 3}</strong></div>;
  if (phase === 'result') return <div className="quiz-phase-overlay result-overlay"><small>Leaderboard</small><div className="mini-leaderboard">{players.slice(0, 3).map((player, index) => <div key={player.id}><span>{index + 1}. {player.display_name}</span><b>{player.score}</b></div>)}</div></div>;
  return null;
}
function ManualQuestionEditor({ questions, draft, setDraft, editingIndex, onSave, onEdit, onRemove }: { questions: { prompt: string; options: string[]; correctIndex: number; seconds: number }[]; draft: { prompt: string; options: string[]; correctIndex: number; seconds: number }; setDraft: (value: { prompt: string; options: string[]; correctIndex: number; seconds: number }) => void; editingIndex: number | null; onSave: () => void; onEdit: (index: number) => void; onRemove: (index: number) => void }) {
  return <div className="manual-question-editor"><div className="manual-question-heading"><strong>{editingIndex === null ? 'Add question manually' : 'Edit question'}</strong><span>{questions.length}/10 questions</span></div><input className="manual-question-prompt" value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} placeholder="Question text" maxLength={500}/><div className="manual-option-grid">{draft.options.map((option, index) => <label key={index}>Option {String.fromCharCode(65 + index)}<input value={option} onChange={(event) => { const options = [...draft.options]; options[index] = event.target.value; setDraft({ ...draft, options }); }} placeholder={`Answer ${String.fromCharCode(65 + index)}`} maxLength={180}/><span><input type="radio" name="manual-correct" checked={draft.correctIndex === index} onChange={() => setDraft({ ...draft, correctIndex: index })}/> Correct answer</span></label>)}</div><div className="manual-question-footer"><label>Timer seconds<input type="number" min="5" max="240" value={draft.seconds} onChange={(event) => setDraft({ ...draft, seconds: Number(event.target.value) })}/></label><button type="button" className="quiz-button secondary" onClick={onSave} disabled={questions.length >= 10 && editingIndex === null}>{editingIndex === null ? 'Add question' : 'Save changes'}</button></div>{questions.length > 0 && <div className="manual-question-list">{questions.map((question, index) => <div key={`${question.prompt}-${index}`}><span>{index + 1}. {question.prompt}<small>{question.options.length} options · correct {String.fromCharCode(65 + question.correctIndex)}</small></span><button type="button" className="quiz-text-button" onClick={() => onEdit(index)}>Edit</button><button type="button" className="quiz-text-button remove" onClick={() => onRemove(index)}>Remove</button></div>)}</div>}</div>;
}
function Back({ onClick }: { onClick: () => void }) { return <button className="quiz-back" onClick={onClick}>← Back</button>; }
function QuizShell({ children, dashboardLink = false }: { children: React.ReactNode; dashboardLink?: boolean }) { return <main className="quiz-page"><header className="quiz-header"><a href="/" className="quiz-brand"><span>🪔</span><b>Karthika Quiz</b><small>Hare Krishna Vaikuntham</small></a><div className="quiz-header-links">{dashboardLink && <a href="/quizhost" className="quiz-home-link">Quiz dashboard</a>}<a href="/" className="quiz-home-link">Back to challenge</a></div></header><div className="quiz-wrap">{children}</div><footer className="quiz-footer">A simple live learning space for the Karthika Damodara Challenge.</footer></main>; }





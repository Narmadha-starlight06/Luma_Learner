import { useRef, useState } from 'react';
import { Home, BookOpen, Sparkles, Users, Trophy, Settings, Search, Bell, ChevronRight, Flame, Clock3, Languages, Plus, Send, FileText, Check, Menu, X, Upload, ArrowRight, Star, MessageCircle, Globe2, CircleHelp, BookMarked } from 'lucide-react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import './App.css';

const storageKeys = {
  profile: 'lumalearn.profileName',
  notes: 'lumalearn.notes',
  rooms: 'lumalearn.rooms',
};

const defaultRooms = [
  { id: 'vlsi-study-circle', title: 'VLSI study circle', topic: 'Unit 5 · ASIC design & verification', tone: 'lavender', tag: 'FOCUS ROOM', memberCount: 0, joined: false, messages: [] },
  { id: 'sunday-focus-club', title: 'Sunday focus club', topic: '25-minute pomodoro · cameras optional', tone: 'mint', tag: 'QUIET STUDY', memberCount: 0, joined: false, messages: [] },
];
const translationLanguages = ['Tamil', 'French', 'Hindi', 'Spanish', 'English', 'Malayalam', 'Telugu', 'Kannada', 'German', 'Japanese', 'Chinese'];

function readStoredValue(key, fallback, isValid) {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return fallback;

    const value = JSON.parse(stored);
    if (isValid(value)) return value;

    console.error(`Ignoring invalid saved LumaLearn data for "${key}".`);
  } catch (error) {
    console.error(`Could not read saved LumaLearn data for "${key}".`, error);
  }

  return fallback;
}

const lessons = [
  { title: 'Wireless Communication', subtitle: 'Unit 3 · 18 min left', icon: '📡', tone: 'lavender', progress: 68 },
  { title: 'VLSI Design', subtitle: 'CMOS logic · 12 min left', icon: '◈', tone: 'peach', progress: 42 },
  { title: 'Smart Sensors', subtitle: 'Basics · 8 min left', icon: '✳', tone: 'mint', progress: 25 },
];
const nav = [{ label: 'Overview', icon: Home }, { label: 'My notes', icon: BookOpen }, { label: 'AI study buddy', icon: Sparkles }, { label: 'Study rooms', icon: Users }, { label: 'My progress', icon: Trophy }];
function App() {
  const [active, setActive] = useState('Overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [language, setLanguage] = useState('Tamil');
  const [noteText, setNoteText] = useState(() => readStoredValue(storageKeys.notes, 'Wireless communication enables information transfer without physical connections.', value => typeof value === 'string'));
  const [translated, setTranslated] = useState('');
  const [translationError, setTranslationError] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([{ from: 'bot', text: 'Hey there! ✨ What are we learning today? Ask me about your notes, or tell me what feels confusing.' }]);
  const [toast, setToast] = useState('');
  const [xp, setXp] = useState(420);
  const [checked, setChecked] = useState(false);
  const [profileName, setProfileName] = useState(() => readStoredValue(storageKeys.profile, 'Student space', value => typeof value === 'string'));
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(profileName);
  const [rooms, setRooms] = useState(() => readStoredValue(storageKeys.rooms, defaultRooms, value => Array.isArray(value) && value.every(room => room && typeof room.id === 'string' && typeof room.title === 'string' && Array.isArray(room.messages))));
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomTitle, setRoomTitle] = useState('');
  const [roomTopic, setRoomTopic] = useState('');
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [roomMessage, setRoomMessage] = useState('');
  const [processingFile, setProcessingFile] = useState(false);
  const fileInputRef = useRef(null);
  const chatFileInputRef = useRef(null);
  const notify = (text) => { setToast(text); window.setTimeout(() => setToast(''), 2600); };
  const saveLocalValue = (key, value, label) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Could not save LumaLearn ${label}.`, error);
      notify(`Could not save your ${label} on this device.`);
      return false;
    }
  };
  const updateNotes = (value) => {
    setNoteText(value);
    return saveLocalValue(storageKeys.notes, value, 'notes');
  };
  const updateProfile = (value) => {
    setProfileName(value);
    return saveLocalValue(storageKeys.profile, value, 'profile');
  };
  const updateRooms = (value) => {
    setRooms(value);
    return saveLocalValue(storageKeys.rooms, value, 'study rooms');
  };
  const translateNotes = async (event) => {
    event.preventDefault();
    if (!noteText.trim()) {
      setTranslationError('Add or upload some notes before translating.');
      return;
    }
    setIsTranslating(true);
    setTranslated('');
    setTranslationError('');
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: noteText, targetLanguage: language }),
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('The translation server returned an invalid response. Please restart the app and try again.');
      }
      if (!response.ok) {
        throw new Error(typeof result.error === 'string' ? result.error : `Translation failed (${response.status}).`);
      }
      if (typeof result.translation !== 'string' || !result.translation.trim()) {
        throw new Error('The translation service returned an empty response. Please try again.');
      }
      setTranslated(result.translation);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Translation failed. Please try again.';
      console.error('Could not translate notes.', error);
      setTranslationError(message);
    } finally {
      setIsTranslating(false);
    }
  };
  const loadFile = async (file, fromChat = false) => {
    const extension = file.name.toLowerCase().split('.').pop();
    if (!['pdf', 'txt', 'md'].includes(extension)) {
      notify('Choose a PDF, TXT, or Markdown file.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      notify('Files must be smaller than 25 MB.');
      return;
    }

    setProcessingFile(true);
    try {
      let text;
      let pageCount = 0;
      if (extension === 'pdf') {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        pageCount = document.numPages;
        const pages = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(content.items.map(item => ('str' in item ? item.str : '')).join(' '));
        }
        text = pages.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      } else {
        text = (await file.text()).trim();
      }

      if (!text) {
        notify('No selectable text found. Scanned PDFs need OCR, which is not available yet.');
        return;
      }

      const notes = noteText.trim() ? `${noteText.trim()}\n\n--- ${file.name} ---\n${text}` : text;
      const saved = updateNotes(notes);
      setTranslated('');
      if (fromChat) {
        setMessages(current => [...current, { from: 'bot', text: `Extracted ${file.name} and added its text to My notes. Answers grounded in the document still need an AI service.` }]);
      }
      if (saved) notify(`Extracted text from ${file.name}${pageCount ? ` (${pageCount} pages)` : ''} and saved it to My notes.`);
    } catch (error) {
      console.error(`Could not read uploaded file "${file.name}".`, error);
      notify(`Could not read ${file.name}. Check that it is a valid, readable file.`);
    } finally {
      setProcessingFile(false);
    }
  };
  const handleFileInput = (event, fromChat = false) => {
    const file = event.currentTarget.files?.[0];
    if (file) void loadFile(file, fromChat);
    event.currentTarget.value = '';
  };
  const createRoom = (event) => {
    event.preventDefault();
    const title = roomTitle.trim();
    if (!title) {
      notify('Add a name for your study room.');
      return;
    }
    const room = {
      id: window.crypto.randomUUID(),
      title,
      topic: roomTopic.trim() || 'Study session',
      tone: 'lavender',
      tag: 'LOCAL ROOM',
      memberCount: 1,
      joined: true,
      messages: [],
    };
    const saved = updateRooms([...rooms, room]);
    setRoomTitle('');
    setRoomTopic('');
    setShowCreateRoom(false);
    setActiveRoomId(room.id);
    if (saved) notify('Study room created and saved on this device.');
  };
  const toggleRoomMembership = (room) => {
    const saved = updateRooms(rooms.map(item => item.id === room.id
      ? { ...item, joined: !item.joined, memberCount: Math.max(0, item.memberCount + (item.joined ? -1 : 1)) }
      : item));
    if (room.joined) {
      setActiveRoomId(null);
      if (saved) notify(`You left ${room.title}.`);
    } else {
      setActiveRoomId(room.id);
      if (saved) notify(`You joined ${room.title} on this device.`);
    }
  };
  const sendRoomMessage = (event) => {
    event.preventDefault();
    const text = roomMessage.trim();
    if (!text || !activeRoomId) return;
    updateRooms(rooms.map(room => room.id === activeRoomId
      ? { ...room, messages: [...room.messages, { id: window.crypto.randomUUID(), author: profileName, text, sentAt: new Date().toISOString() }] }
      : room));
    setRoomMessage('');
  };
  const ask = (e) => { e?.preventDefault(); if (!question.trim()) return; const q = question.trim(); setMessages(m => [...m, {from:'you', text:q}, {from:'bot', text:`Let's break that down together. I can give a more reliable answer when you add your class notes or a source file. For now, start by identifying the key idea in “${q}”, then connect it to one example. ✨`}]); setQuestion(''); };
  const finishLesson = () => { if (!checked) { setChecked(true); setXp(x => x + 25); notify('Awesome work! +25 XP added ✨'); } else notify('You already collected this lesson reward!'); };
  const renderSidebar = () => <aside className={`sidebar ${mobileOpen ? 'mobile-visible' : ''}`}><div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><span>Luma<span className="brand-light">Learn</span></span><button className="mobile-close" onClick={()=>setMobileOpen(false)}><X size={18}/></button></div><div className="workspace-label">YOUR WORKSPACE</div><nav>{nav.map(item=>{const Icon=item.icon;return <button key={item.label} className={`nav-item ${active===item.label?'selected':''}`} onClick={()=>{setActive(item.label);setMobileOpen(false)}}><Icon size={18}/><span>{item.label}</span>{item.label==='Study rooms'&&rooms.length>0&&<span className="nav-new">{rooms.length}</span>}</button>})}</nav><div className="sidebar-bottom"><div className="focus-card"><div className="focus-orbit">✦</div><p className="focus-title">Little steps add up.</p><p className="focus-copy">You're building a habit, one session at a time.</p><div className="focus-progress"><span style={{width:'68%'}}/></div><small>4 of 6 weekly sessions</small></div><button className="nav-item" onClick={()=>notify('Settings will be available in a future build.')}><Settings size={18}/><span>Settings</span></button><div className="profile"><div className="avatar">{profileName.trim().charAt(0).toUpperCase()||'S'}</div><div className="profile-info"><b>{profileName}</b><span>Saved on this device</span></div><button className="more-btn" onClick={()=>{setProfileDraft(profileName);setEditingProfile(true)}} aria-label="Edit profile"><span>···</span></button></div></div></aside>;
  const renderHeader = () => <header className="topbar"><button className="mobile-menu" onClick={()=>setMobileOpen(true)}><Menu/></button><div className="crumb">My workspace <ChevronRight size={14}/><b>{active}</b></div><div className="top-actions"><div className="search-box"><Search size={16}/><input placeholder="Search your learning..." onKeyDown={e=>e.key==='Enter'&&notify('Search is a UI demo in this starter build.')}/><kbd>⌘ K</kbd></div><button className="icon-button notification" onClick={()=>notify('You’re all caught up!')}><Bell size={18}/><i/></button><button className="top-avatar" onClick={()=>{setProfileDraft(profileName);setEditingProfile(true)}} aria-label="Edit profile">{profileName.trim().charAt(0).toUpperCase()||'S'}</button></div></header>;
  const renderDashboard = () => <><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR SPACE TO GROW</div><h1>Make today <em>count.</em></h1><p className="subheading">A little progress is still progress. Ready when you are.</p></div><div className="date-chip">☀️ &nbsp; Saturday, Oct 10</div></div>
    <section className="hero"><div className="hero-content"><div className="hero-pill"><Sparkles size={13}/> YOUR LEARNING JOURNEY</div><h2>Curiosity looks<br/>good on you.</h2><p>Keep showing up for yourself.<br/>Your next breakthrough could be one lesson away.</p><button className="primary-button" onClick={()=>{setActive('My notes');notify('Let’s continue your learning journey!')}}>Continue learning <ArrowRight size={16}/></button><div className="hero-dots"><span className="active-dot"/><span/><span/></div></div><div className="hero-art"><div className="art-glow"/><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="book-illustration"><div className="book-left"><span/><span/><span/></div><div className="book-right"><b>✦</b><span/><span/><span/></div></div><div className="float-star star-a">✦</div><div className="float-star star-b">✧</div><div className="float-bubble bubble-a"><Sparkles size={15}/></div><div className="float-bubble bubble-b">↗</div><div className="art-caption">one page at a time</div></div><div className="hero-glow-dot"/></section>
    <section className="stats-grid"><div className="stat-card"><div className="stat-icon xp-icon"><Star size={18}/></div><div className="stat-label">TOTAL POINTS</div><div className="stat-bottom"><strong>{xp.toLocaleString()}</strong><span className="stat-change">+25 today</span></div><div className="stat-foot">You're on your way ✨</div></div><div className="stat-card"><div className="stat-icon streak-icon"><Flame size={18}/></div><div className="stat-label">STUDY STREAK</div><div className="stat-bottom"><strong>7 <small>days</small></strong><span className="mini-dots"><i/><i/><i/><i/><i/><i/><i className="today"/></span></div><div className="stat-foot">One week of showing up!</div></div><div className="stat-card"><div className="stat-icon time-icon"><Clock3 size={18}/></div><div className="stat-label">FOCUS TIME</div><div className="stat-bottom"><strong>3.5 <small>hrs</small></strong><span className="stat-change">↑ 12%</span></div><div className="stat-foot">Compared to last week</div></div></section>
    <div className="content-grid"><section className="lessons-section"><div className="section-heading"><div><h3>Pick up where you left off</h3><p>Your learning journey is waiting.</p></div><button className="text-button" onClick={()=>setActive('My notes')}>View all <ChevronRight size={15}/></button></div><div className="lesson-list">{lessons.map((l,i)=><article className="lesson-card" key={l.title}><div className={`lesson-art ${l.tone}`}><span>{l.icon}</span><small>{['SIGNALS','CIRCUITS','SENSING'][i]}</small></div><div className="lesson-info"><div className="lesson-kicker">{['COMMUNICATIONS','MICROELECTRONICS','IOT & DEVICES'][i]}</div><h4>{l.title}</h4><p><Clock3 size={13}/> {l.subtitle}</p><div className="lesson-progress"><span style={{width:`${l.progress}%`}}/></div><div className="lesson-progress-label">{l.progress}% complete</div></div><button className="round-arrow" onClick={()=>{setActive('My notes');notify(`Opening ${l.title}…`)}}><ChevronRight size={18}/></button></article>)}</div></section><aside className="right-column"><section className="daily-card"><div className="daily-top"><div><span className="small-label">A GENTLE NUDGE</span><h3>Today's little win</h3></div><span className="sun-emoji">🌤️</span></div><p>Complete one lesson and give your future self a little thank-you.</p><div className="daily-task"><div className={`task-check ${checked?'done':''}`} onClick={finishLesson}>{checked&&<Check size={15}/>}</div><div><b>{checked?'Lesson completed!':'Finish a 10-minute lesson'}</b><span>{checked?'You did something good today.':'Small effort, real momentum.'}</span></div></div><button className="daily-button" onClick={finishLesson}>{checked?'Reward collected ✓':'Claim your +25 XP'} <Sparkles size={14}/></button></section><section className="buddy-card"><div className="buddy-heading"><div className="buddy-icon"><Sparkles size={18}/></div><div><h3>Your study buddy</h3><span><i/> Here to help you learn</span></div></div><p>Stuck on a concept? No judgement, just explanations that make sense.</p><button onClick={()=>setActive('AI study buddy')} className="buddy-action">Ask a question <ArrowRight size={15}/></button><div className="buddy-decoration">✳</div></section></aside></div>
  </>;
  const renderNotes = () => <div className="page-panel">
    <div className="eyebrow"><BookOpen size={14}/> YOUR KNOWLEDGE LIBRARY</div>
    <h1>My <em>notes.</em></h1>
    <p className="subheading">Your notes, your language, your pace.</p>
    <div className="tool-card">
      <div className="tool-title"><div className="tool-icon"><Languages/></div><div><h3>Translate your notes</h3><p>Keep your meaning. Learn in the language that feels right.</p></div></div>
      <label className="field-label">PASTE A NOTE OR ADD A FILE</label>
      <textarea value={noteText} maxLength={20000} onChange={event=>{updateNotes(event.target.value);setTranslated('');setTranslationError('')}} placeholder="Paste your notes here…"/>
      <div className="translate-controls">
        <label>Translate into <select value={language} onChange={event=>{setLanguage(event.target.value);setTranslated('');setTranslationError('')}}>{translationLanguages.map(targetLanguage=><option key={targetLanguage}>{targetLanguage}</option>)}</select></label>
        <button className="outline-button" type="button" disabled={processingFile} onClick={()=>fileInputRef.current?.click()}><Upload size={15}/>{processingFile?'Reading file…':'Upload PDF or text'}</button>
        <input ref={fileInputRef} type="file" hidden accept=".txt,.md,.pdf,application/pdf,text/plain,text/markdown" onChange={event=>handleFileInput(event)}/>
        <button className="primary-button" type="button" disabled={isTranslating||processingFile||!noteText.trim()} onClick={translateNotes}><Languages size={16}/>{isTranslating?'Translating…':'Translate notes'}</button>
      </div>
      <p className="translation-privacy">Translation sends these notes to Groq for processing. The API key stays on the server.</p>
      <div className="translation-usage">{noteText.length.toLocaleString()} / 20,000 characters</div>
      {isTranslating&&<div className="translation-status" role="status">Translating your notes to {language} with Lumalearn…</div>}
      {translationError&&<div className="translation-error" role="alert">{translationError}</div>}
      {translated&&<div className="translation-preview"><div className="preview-heading"><Check size={16}/> Translation · Groq <span>{language}</span></div><p className="translation-result">{translated}</p></div>}
    </div>
    <div className="upload-tip"><div className="tip-icon"><FileText/></div><div><b>PDF text extraction runs in your browser</b><p>Upload PDF, TXT, or Markdown files up to 25 MB. Selectable PDF text is extracted into your saved notes; scanned PDFs need OCR. Real translation requires a Groq key configured in the local server.</p></div></div>
  </div>;
  const renderTutor = () => <div className="page-panel tutor-page">
    <div className="eyebrow"><Sparkles size={14}/> YOUR PERSONAL LEARNING COMPANION</div>
    <h1>Let's figure it <em>out.</em></h1>
    <p className="subheading">No question is too small. Learning is a conversation.</p>
    <div className="chat-card">
      <div className="chat-head"><div className="bot-avatar"><Sparkles/></div><div><b>Luma AI</b><span><i/> Study buddy · demo mode</span></div><button className="source-chip" onClick={()=>notify('Document-grounded answers need an AI service; your notes stay on this device.')}><Globe2 size={14}/> Sources</button></div>
      <div className="chat-messages">{messages.map((message,index)=><div className={`message ${message.from}`} key={`${message.from}-${index}`}>{message.from==='bot'&&<div className="message-avatar"><Sparkles size={14}/></div>}<div className="message-bubble">{message.text}</div></div>)}</div>
      <div className="prompt-chips"><button onClick={()=>setQuestion('Explain this like I am a beginner')}>Explain simply</button><button onClick={()=>setQuestion('Give me a real-life example')}>Real-life example</button><button onClick={()=>setQuestion('Make a quick quiz for me')}>Quick quiz</button></div>
      <form className="chat-input" onSubmit={ask}>
        <button type="button" className="attach-btn" disabled={processingFile} onClick={()=>chatFileInputRef.current?.click()} aria-label="Attach a PDF or text file"><Plus size={19}/></button>
        <input ref={chatFileInputRef} type="file" hidden accept=".txt,.md,.pdf,application/pdf,text/plain,text/markdown" onChange={event=>handleFileInput(event,true)}/>
        <input value={question} onChange={event=>setQuestion(event.target.value)} placeholder="Ask anything you're curious about…"/>
        <button type="submit" className="send-btn"><Send size={17}/></button>
      </form>
      <div className="trust-note"><CircleHelp size={13}/> Files are extracted into My notes locally. Responses are demo text, not yet grounded in your notes.</div>
    </div>
  </div>;
  const renderRooms = () => {
    const currentRoom = rooms.find(room => room.id === activeRoomId && room.joined);
    return <div className="page-panel">
      <div className="eyebrow"><Users size={14}/> LEARN BETTER TOGETHER</div>
      <h1>Good things <em>multiply.</em></h1>
      <p className="subheading">Create a room, join a focus session, and keep your local study chat.</p>
      <div className="rooms-banner"><div><div className="hero-pill"><Users size={13}/> SAVED ON THIS DEVICE</div><h2>Study together.<br/>Grow together.</h2><p>Rooms and messages stay in this browser on this device.</p><button className="primary-button" onClick={()=>setShowCreateRoom(value=>!value)}><Plus size={16}/> Create a room</button></div><div className="room-avatars"><span>✦</span></div></div>
      {showCreateRoom&&<form className="room-create-form" onSubmit={createRoom}>
        <label>Room name<input value={roomTitle} onChange={event=>setRoomTitle(event.target.value)} maxLength={60} placeholder="e.g. Signals exam prep" required/></label>
        <label>Topic or study goal<input value={roomTopic} onChange={event=>setRoomTopic(event.target.value)} maxLength={100} placeholder="e.g. Review Unit 1 together"/></label>
        <div><button className="primary-button" type="submit">Create room</button><button className="outline-button" type="button" onClick={()=>setShowCreateRoom(false)}>Cancel</button></div>
      </form>}
      {currentRoom&&<section className="room-session">
        <div className="room-session-header"><div><span className="small-label">LOCAL STUDY ROOM</span><h3>{currentRoom.title}</h3><p>{currentRoom.topic} · {currentRoom.memberCount} {currentRoom.memberCount===1?'learner':'learners'}</p></div><button className="outline-button" onClick={()=>toggleRoomMembership(currentRoom)}>Leave room</button></div>
        <div className="room-session-messages">{currentRoom.messages.length===0?<p>No messages yet. Start the study conversation.</p>:currentRoom.messages.map(message=><article key={message.id}><b>{message.author}</b><p>{message.text}</p><time>{new Date(message.sentAt).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}</time></article>)}</div>
        <form className="room-message-form" onSubmit={sendRoomMessage}><input value={roomMessage} onChange={event=>setRoomMessage(event.target.value)} placeholder="Write a message to this local room…" maxLength={1000}/><button className="send-btn" type="submit" aria-label="Send room message" disabled={!roomMessage.trim()}><Send size={17}/></button></form>
      </section>}
      <div className="section-heading room-heading"><div><h3>Study spaces</h3><p>Saved local rooms · join and chat in this browser.</p></div></div>
      <div className="room-grid">{rooms.map(room=><article className="room-card" key={room.id}>
        <div className="room-card-top"><span className={`room-symbol ${room.tone}`}>{room.tone==='mint'?'✳':'◈'}</span><span className="live-pill">{room.tag}</span></div>
        <h3>{room.title}</h3><p>{room.topic}</p>
        <div className="room-card-foot"><small>{room.memberCount} {room.memberCount===1?'learner':'learners'} on this device</small>
          {room.joined&&<button className="room-leave-button" onClick={()=>toggleRoomMembership(room)}>Leave</button>}
          <button onClick={()=>room.joined?setActiveRoomId(room.id):toggleRoomMembership(room)}>{room.joined?'Open room':'Join room'} <ArrowRight size={14}/></button>
        </div>
      </article>)}</div>
      <div className="upload-tip"><div className="tip-icon"><MessageCircle/></div><div><b>Local rooms, not live calls</b><p>Membership and text chat are stored in this browser. Cross-device rooms, realtime chat, and audio/video calls need a deployed backend and WebRTC signaling service.</p></div></div>
    </div>;
  };
  const renderProgress = () => <div className="page-panel"><div className="eyebrow"><Trophy size={14}/> EVERY STEP COUNTS</div><h1>Look how far <em>you've come.</em></h1><p className="subheading">Progress isn't perfection. It's showing up again.</p><div className="progress-hero"><div><span className="small-label">YOUR CURRENT LEVEL</span><h2>Curious explorer <span>✦</span></h2><p>You're collecting knowledge, one lesson at a time.</p><div className="level-bar"><span style={{width:'64%'}}/></div><small>640 / 1,000 XP to the next level</small></div><div className="level-medal"><Trophy size={37}/><span>LVL 04</span></div></div><div className="stats-grid progress-stats"><div className="stat-card"><div className="stat-icon xp-icon"><Star/></div><div className="stat-label">TOTAL XP</div><div className="stat-bottom"><strong>{xp.toLocaleString()}</strong></div><div className="stat-foot">Every bit earned by you</div></div><div className="stat-card"><div className="stat-icon streak-icon"><Flame/></div><div className="stat-label">BEST STREAK</div><div className="stat-bottom"><strong>7 <small>days</small></strong></div><div className="stat-foot">Keep that gentle rhythm</div></div><div className="stat-card"><div className="stat-icon time-icon"><BookMarked/></div><div className="stat-label">LESSONS IN PROGRESS</div><div className="stat-bottom"><strong>3</strong></div><div className="stat-foot">Keep exploring</div></div></div><div className="tool-card achievements"><h3>Your little wins</h3><p>Achievements to celebrate along the way.</p><div className="badge-grid"><div className="achievement"><span>🌱</span><b>First steps</b><small>Started learning</small></div><div className="achievement"><span>🔥</span><b>On a roll</b><small>7-day streak</small></div><div className={`achievement ${checked?'unlocked':''}`}><span>✨</span><b>Lesson legend</b><small>{checked?'Unlocked today!':'Finish a lesson'}</small></div><div className="achievement locked"><span>🌙</span><b>Night owl</b><small>Study after 8 PM</small></div></div></div></div>;
  return <div className="app-shell">{renderSidebar()}<main className="main-area">{renderHeader()}<div className="page-content">{active==='Overview'?renderDashboard():active==='My notes'?renderNotes():active==='AI study buddy'?renderTutor():active==='Study rooms'?renderRooms():renderProgress()}<footer className="footer"><span>Made for curious minds <span className="footer-heart">✦</span></span><span>Small steps. Big possibilities.</span></footer></div></main>{toast&&<div className="toast" role="status"><span>✦</span>{toast}</div>}{editingProfile&&<div className="modal-backdrop" onClick={()=>setEditingProfile(false)}><section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" onClick={event=>event.stopPropagation()}><div className="profile-dialog-heading"><div><span className="small-label">YOUR PROFILE</span><h2 id="profile-dialog-title">Edit your name</h2></div><button className="mobile-close" type="button" onClick={()=>setEditingProfile(false)} aria-label="Close profile editor"><X size={18}/></button></div><form onSubmit={event=>{event.preventDefault();const name=profileDraft.trim();if(!name){notify('Enter a name for your profile.');return;}const saved=updateProfile(name);setEditingProfile(false);if(saved)notify('Profile saved on this device.')}}><label>Display name<input autoFocus maxLength={60} value={profileDraft} onChange={event=>setProfileDraft(event.target.value)} placeholder="Your name" required/></label><div className="profile-dialog-actions"><button className="outline-button" type="button" onClick={()=>setEditingProfile(false)}>Cancel</button><button className="primary-button" type="submit">Save profile</button></div><p>Your profile is stored only in this browser.</p></form></section></div>}{mobileOpen&&<button className="mobile-scrim" onClick={()=>setMobileOpen(false)} aria-label="Close menu"/>}</div>;
}


export default App;

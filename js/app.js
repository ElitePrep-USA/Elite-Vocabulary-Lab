const VOCAB = window.VOCAB || [];
const STORAGE_KEY = 'eliteVocabProgressV2';
let state = loadState();
let flashOrder = [...Array(VOCAB.length).keys()];
let flashIndex = 0;
let flashFlipped = false;
let activeQuiz = null;

function loadState(){
  const blank = {attempts:[], missed:{}, setScores:{}, practiced:{}, streak:{last:'',count:0}};
  try { return Object.assign(blank, JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}); }
  catch { return blank; }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function shuffle(arr, seed){
  const a=[...arr]; let s = seed || Math.floor(Math.random()*2147483647);
  for(let i=a.length-1;i>0;i--){ s = (s * 16807) % 2147483647; const j=s%(i+1); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function choicePool(correctWord, type, seed){
  const others = shuffle(VOCAB.filter(v=>v.word!==correctWord.word), seed).slice(0,5).map(v=>v.word);
  return shuffle([correctWord.word, ...others], seed+99);
}
function makeQuestion(item, type, seed){
  const prompt = type === 'definition' ? item.definition : type === 'synonym' ? `Synonym: ${item.synonym}` : `Antonym: ${item.antonym}`;
  return {type, word:item.word, prompt, choices:choicePool(item,type,seed), selected:null};
}
function makeQuiz(items, title, id){
  const q=[]; let seed=id.length*97;
  items.slice(0,10).forEach((w,i)=>q.push(makeQuestion(w,'definition',seed+i)));
  items.slice(10,15).forEach((w,i)=>q.push(makeQuestion(w,'synonym',seed+40+i)));
  items.slice(15,20).forEach((w,i)=>q.push(makeQuestion(w,'antonym',seed+80+i)));
  return {id,title,questions:shuffle(q,seed+500)};
}
function fixedSets(){
  const ordered = shuffle(VOCAB, 20260701).slice(0,300);
  return Array.from({length:15},(_,i)=>makeQuiz(ordered.slice(i*20,(i+1)*20),`Set ${i+1}`,`set-${i+1}`));
}
function randomQuiz(){ return makeQuiz(shuffle(VOCAB, Date.now()).slice(0,20),'Random Practice Quiz',`random-${Date.now()}`); }
function byWord(word){ return VOCAB.find(v=>v.word===word); }
function todayKey(){ return new Date().toISOString().slice(0,10); }
function updateStreak(){ const today=todayKey(); if(state.streak?.last===today) return; const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10); const prev=state.streak||{last:'',count:0}; state.streak={last:today,count:prev.last===yesterday ? (prev.count||0)+1 : 1}; }
function markPracticed(words){ state.practiced = state.practiced || {}; words.forEach(w=>state.practiced[w]=true); updateStreak(); }
function bestPct(){ const attempts=state.attempts||[]; return attempts.length?Math.max(...attempts.map(a=>a.pct)):0; }

function switchView(view){
  document.querySelectorAll('.tab').forEach(b=>{
    const active=b.dataset.view===view;
    b.classList.toggle('active',active);
    if(active)b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.view').forEach(s=>s.classList.toggle('active-view',s.id===view));
  document.getElementById('mainContent').focus({preventScroll:true});
  if(view==='dashboard') renderDashboard();
  if(view==='home') renderHome();
  if(view==='missed') renderMissed();
}

document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.jump)));
document.getElementById('wordCount').textContent = VOCAB.length;

function renderStudy(){
  const q=document.getElementById('searchInput').value.toLowerCase();
  const letter=document.getElementById('letterFilter').value;
  const list=VOCAB.filter(v=>{
    const hay = `${v.word} ${v.definition} ${v.synonym} ${v.antonym} ${v.sentence}`.toLowerCase();
    return (letter==='all'||v.word[0].toUpperCase()===letter) && (!q || hay.includes(q));
  });
  document.getElementById('studyList').innerHTML = list.map(wordCard).join('') || '<p>No matching words found.</p>';
}
function esc(x){return String(x||'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));}
function wordCard(v){
  return `<article class="word-card"><h3 class="word-title">${esc(v.word)} <span>${esc(v.partOfSpeech||'')}</span></h3><p>${esc(v.definition)}</p><div class="chips"><span class="chip">Synonym: ${esc(v.synonym)}</span><span class="chip">Antonym: ${esc(v.antonym)}</span></div><p class="meta"><strong>Root:</strong> ${esc(v.root||'—')}</p><p class="meta"><em>${esc(v.sentence||'')}</em></p></article>`;
}
function initFilters(){
  const letters=[...new Set(VOCAB.map(v=>v.word[0].toUpperCase()))].sort();
  document.getElementById('letterFilter').innerHTML = '<option value="all">All letters</option>'+letters.map(l=>`<option>${l}</option>`).join('');
  document.getElementById('searchInput').addEventListener('input',renderStudy);
  document.getElementById('letterFilter').addEventListener('change',renderStudy);
  document.getElementById('clearFilters').addEventListener('click',()=>{searchInput.value='';letterFilter.value='all';renderStudy();});
}

function renderFlash(){
  const v=VOCAB[flashOrder[flashIndex]];
  document.getElementById('cardProgress').textContent = `${flashIndex+1} / ${VOCAB.length}`;
  document.getElementById('flashcard').setAttribute('aria-pressed', flashFlipped ? 'true':'false');
  document.getElementById('flashcard').innerHTML = flashFlipped ? `<div><h3>${esc(v.word)}</h3><p>${esc(v.definition)}</p><div class="chips"><span class="chip">Synonym: ${esc(v.synonym)}</span><span class="chip">Antonym: ${esc(v.antonym)}</span></div><p><em>${esc(v.sentence)}</em></p></div>` : `<div><h3>${esc(v.word)}</h3><p class="meta">${esc(v.partOfSpeech||'')}</p><p>Click to reveal meaning</p></div>`;
}
function setupFlash(){
  flashcard.addEventListener('click',()=>{flashFlipped=!flashFlipped;renderFlash();});
  flashcard.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){flashFlipped=!flashFlipped;renderFlash();}});
  nextCard.addEventListener('click',()=>{markPracticed([VOCAB[flashOrder[flashIndex]].word]); saveState(); renderHome(); flashIndex=(flashIndex+1)%VOCAB.length;flashFlipped=false;renderFlash();});
  prevCard.addEventListener('click',()=>{flashIndex=(flashIndex-1+VOCAB.length)%VOCAB.length;flashFlipped=false;renderFlash();});
  shuffleCards.addEventListener('click',()=>{flashOrder=shuffle(flashOrder,Date.now());flashIndex=0;flashFlipped=false;renderFlash();});
  resetFlashcards.addEventListener('click',()=>{flashOrder=[...Array(VOCAB.length).keys()];flashIndex=0;flashFlipped=false;renderFlash();});
}

function renderQuiz(containerId, quiz){
  activeQuiz = quiz;
  const container=document.getElementById(containerId);
  container.innerHTML = `<div class="quiz-meta"><strong>${esc(quiz.title)}</strong> · Choose the correct vocabulary word from each word bank.</div>` + quiz.questions.map((qu,i)=>`
    <div class="question"><h4>${i+1}. ${label(qu.type)}</h4><p>${esc(qu.prompt)}</p><div class="choices" role="group" aria-label="Choices for question ${i+1}">${qu.choices.map(c=>`<button class="choice" data-q="${i}" data-choice="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>`).join('') + `<button class="submitQuiz">Submit Quiz</button>`;
  container.querySelectorAll('.choice').forEach(b=>b.addEventListener('click',()=>{
    const qn=quiz.questions[+b.dataset.q]; qn.selected=b.dataset.choice;
    b.parentElement.querySelectorAll('.choice').forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
  }));
  container.querySelector('.submitQuiz').addEventListener('click',()=>scoreQuiz(container,quiz));
}
function label(type){return type==='definition'?'Match the definition':type==='synonym'?'Match the synonym':'Match the antonym';}
function scoreQuiz(container,quiz){
  let correct=0;
  markPracticed(quiz.questions.map(q=>q.word));
  quiz.questions.forEach((q,i)=>{
    if(q.selected===q.word) correct++;
    const item=byWord(q.word);
    if(q.selected!==q.word){ state.missed[q.word] = {word:q.word, lastMissed:new Date().toISOString(), definition:item.definition, synonym:item.synonym, antonym:item.antonym}; }
    container.querySelectorAll(`[data-q="${i}"]`).forEach(b=>{ if(b.dataset.choice===q.word)b.classList.add('correct'); else if(b.classList.contains('selected'))b.classList.add('incorrect'); b.disabled=true; });
  });
  const pct=Math.round(correct/quiz.questions.length*100);
  state.attempts.unshift({id:quiz.id,title:quiz.title,score:correct,total:quiz.questions.length,pct,date:new Date().toLocaleString()});
  state.attempts=state.attempts.slice(0,50);
  if(quiz.id.startsWith('set-')) state.setScores[quiz.id]=Math.max(state.setScores[quiz.id]||0,pct);
  saveState();
  const resultId = `share-${Date.now()}`;
  container.insertAdjacentHTML('beforeend',`<div class="result-box"><h3>Score: ${correct}/${quiz.questions.length} (${pct}%)</h3><p>Incorrect words have been added to Missed Words Review.</p><div class="result-actions"><button class="shareScore" data-score="${pct}" data-title="${esc(quiz.title)}" data-target="${resultId}">Create Share Image</button><button class="copyShare" data-score="${pct}" data-title="${esc(quiz.title)}">Copy Share Text</button></div><div id="${resultId}"></div></div>`);
  container.querySelector('.shareScore').addEventListener('click',e=>createShareImage(e.currentTarget));
  container.querySelector('.copyShare').addEventListener('click',e=>copyShareText(e.currentTarget));
  renderDashboard();
}

function createShareImage(button){
  const pct=button.dataset.score, title=button.dataset.title, target=document.getElementById(button.dataset.target);
  const canvas=document.createElement('canvas'); canvas.width=1200; canvas.height=630;
  const ctx=canvas.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,1200,630); grad.addColorStop(0,'#07384f'); grad.addColorStop(1,'#0f6b78'); ctx.fillStyle=grad; ctx.fillRect(0,0,1200,630);
  ctx.fillStyle='#fff8ef'; ctx.beginPath(); ctx.arc(145,145,74,0,Math.PI*2); ctx.fill();
  const logo=new Image();
  logo.onload=()=>{ ctx.drawImage(logo,93,93,104,104); drawShareText(); };
  logo.onerror=drawShareText;
  logo.src='assets/elite-seal.png';
  function drawShareText(){
    ctx.textAlign='left'; ctx.fillStyle='#ffd69e'; ctx.font='bold 34px Arial'; ctx.fillText('ELITE VOCABULARY LAB',250,122);
    ctx.fillStyle='white'; ctx.font='bold 84px Arial'; ctx.fillText(`${pct}%`,250,238);
    ctx.font='bold 46px Arial'; ctx.fillText('Vocabulary Quiz Score',250,306);
    ctx.font='30px Arial'; ctx.fillText(title,250,366);
    ctx.fillStyle='#e9f7fb'; ctx.font='28px Arial'; ctx.fillText('Study • Practice • Master',250,455);
    ctx.fillText(location.origin + location.pathname,250,505);
    const img=new Image(); img.alt='Shareable vocabulary quiz score image'; img.className='share-preview'; img.src=canvas.toDataURL('image/png');
    target.innerHTML=''; target.appendChild(img); showToast('Share image created. Save or copy it from your browser.');
  }
}
function copyShareText(button){
  const text=`I scored ${button.dataset.score}% on ${button.dataset.title} in Elite Vocabulary Lab: ${location.href.split('#')[0]}`;
  navigator.clipboard?.writeText(text).then(()=>showToast('Share text copied.')).catch(()=>showToast(text));
}
function showToast(message){const t=document.getElementById('toast'); t.textContent=message; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3200);}


function setupQuizzes(){
  startRandomQuiz.addEventListener('click',()=>renderQuiz('randomQuizArea',randomQuiz()));
  const sets=fixedSets();
  setButtons.innerHTML = sets.map((s,i)=>`<button data-set="${i}">Set ${i+1}</button>`).join('');
  setButtons.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>renderQuiz('fixedQuizArea',sets[+b.dataset.set])));
}
function renderMissed(){
  const words=Object.values(state.missed).map(m=>byWord(m.word)).filter(Boolean);
  missedWords.innerHTML = words.length ? words.map(wordCard).join('') : '<p>No missed words yet. Complete a quiz to begin tracking review words.</p>';
}
clearMissed.addEventListener('click',()=>{state.missed={};saveState();renderMissed();renderDashboard();});
function renderDashboard(){
  const attempts=state.attempts||[];
  dashAttempts.textContent=attempts.length;
  dashAverage.textContent=attempts.length?Math.round(attempts.reduce((a,b)=>a+b.pct,0)/attempts.length)+'%':'0%';
  dashBest.textContent=bestPct()+'%';
  dashMissed.textContent=Object.keys(state.missed||{}).length;
  recentResults.innerHTML = attempts.length ? attempts.slice(0,10).map(a=>`<div class="progress-row"><strong>${a.pct}%</strong><span>${a.title}<br><small>${a.date}</small></span><span>${a.score}/${a.total}</span></div>`).join('') : '<p>No quiz attempts yet.</p>';
  setProgress.innerHTML = Array.from({length:15},(_,i)=>{const id=`set-${i+1}`, pct=state.setScores[id]||0; return `<div class="progress-row"><strong>Set ${i+1}</strong><div class="bar"><span style="width:${pct}%"></span></div><span>${pct}%</span></div>`;}).join('');
  const practicedCount=Object.keys(state.practiced||{}).length;
  const masteryPct=Math.round(practicedCount/VOCAB.length*100);
  const mb=document.getElementById('masteryBar'); if(mb) mb.style.width=masteryPct+'%';
  const mt=document.getElementById('masteryText'); if(mt) mt.textContent=`${practicedCount} of ${VOCAB.length} words practiced (${masteryPct}%).`;
  renderHome();
}
function renderHome(){
  const hp=document.getElementById('homeMastered'); if(!hp) return;
  hp.textContent=Object.keys(state.practiced||{}).length;
  document.getElementById('homeBest').textContent=bestPct()+'%';
  document.getElementById('homeStreak').textContent=(state.streak&&state.streak.count)||0;
}
resetProgress?.addEventListener('click',()=>{ if(confirm('Reset all local progress for this browser?')){ state={attempts:[], missed:{}, setScores:{}, practiced:{}, streak:{last:'',count:0}}; saveState(); renderDashboard(); renderMissed(); showToast('Local progress reset.'); }});
quizMissed?.addEventListener('click',()=>{ const missed=Object.keys(state.missed||{}).map(byWord).filter(Boolean); if(missed.length<4){showToast('Complete more quizzes to build a missed-word quiz.');return;} const pool=shuffle([...missed,...shuffle(VOCAB,Date.now()).slice(0,20)],Date.now()).slice(0,20); switchView('practice'); renderQuiz('randomQuizArea', makeQuiz(pool,'Missed Words Practice','missed-'+Date.now())); });

initFilters(); renderStudy(); setupFlash(); renderFlash(); setupQuizzes(); renderDashboard(); renderHome();

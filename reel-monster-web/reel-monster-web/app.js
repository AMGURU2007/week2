(() => {
  const KEY = 'reelMonsterWeb.v1';
  const $ = id => document.getElementById(id);
  const todayKey = () => new Date().toLocaleDateString('en-CA');
  const dateOffset = n => { const d = new Date(); d.setDate(d.getDate()-n); return d.toLocaleDateString('en-CA'); };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  let data = load(); data.days = data.days && typeof data.days === 'object' ? data.days : {};
  const save = () => localStorage.setItem(KEY, JSON.stringify(data));
  const countFor = key => Number(data.days[key] || 0);
  const totalWeek = () => Array.from({length:7},(_,i)=>countFor(dateOffset(i))).reduce((a,b)=>a+b,0);
  const funny = n => n === 0 ? "I'm hungry for reels!" : n < 5 ? "Tiny snack. Keep me curious!" : n < 10 ? "Ooh, crunchy little reels!" : n < 20 ? "I'm getting bigger. Notice the scroll!" : n < 35 ? "Burp! Your to-do list says hi." : "Your thumb is a marathon runner. Take a pause?";
  const face = n => n < 5 ? '👾' : n < 12 ? '👹' : n < 25 ? '👺' : '🧌';
  function render(){
    const today = countFor(todayKey()), week = totalWeek();
    $('todayCount').textContent = today; $('statToday').innerHTML = `${today} <small>reels</small>`;
    const seconds = today * 30; const mins = Math.floor(seconds/60); $('timeLost').innerHTML = `${mins}m <small>approx.</small>`;
    $('weekTotal').innerHTML = `${week} <small>reels</small>`;
    $('monster').textContent = face(today); $('mood').textContent = funny(today);
    const vals = Array.from({length:7},(_,i)=>({key:dateOffset(6-i),n:countFor(dateOffset(6-i)),label:new Date(dateOffset(6-i)+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})}));
    const max = Math.max(1,...vals.map(x=>x.n));
    $('weekChart').innerHTML = vals.map((x,i)=>`<div class="day ${i===6?'today':''}"><div class="bar-wrap"><div class="bar" style="height:${Math.max(4,x.n/max*90)}%" title="${x.n} reels"></div></div><strong>${x.label}</strong><small>${x.n}</small></div>`).join('');
  }
  let toastTimer;
  function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1800)}
  $('addReel').addEventListener('click',()=>{const k=todayKey();data.days[k]=countFor(k)+1;save();render();$('monster').classList.add('pop');setTimeout(()=>$('monster').classList.remove('pop'),220);toast('Reel counted! Munchy says thanks ✨')});
  $('exportBtn').addEventListener('click',()=>{const rows=[['Date','Reels counted'],...Object.keys(data.days).sort().map(k=>[k,data.days[k]])];const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='reel-monster-history.csv';a.click();URL.revokeObjectURL(a.href);toast('History CSV exported')});
  render();
})();

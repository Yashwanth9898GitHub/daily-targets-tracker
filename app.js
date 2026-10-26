(() => {
  const KEY = 'taskTargetTracker.v1';
  const $ = id => document.getElementById(id);
  const statuses = ['Not started','In progress','Blocked','Completed'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const localDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value+'T00:00:00').getTime()) && localDate(new Date(value+'T00:00:00')) === value;
  const dateLabel = date => validDate(date) ? new Date(date+'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'No target date';
  const safeUrl = raw => { try { const url = new URL(raw); return ['http:','https:'].includes(url.protocol) ? url.href : null; } catch { return null; } };
  const validTask = task => task && typeof task.id==='string' && task.id.trim() && typeof task.name==='string' && task.name.trim();
  const normalize = task => ({id:task.id, name:task.name.trim(), target:validDate(task.target)?task.target:'', type:['Major','Minor'].includes(task.type)?task.type:'Major', importance:['High','Medium','Low'].includes(task.importance)?task.importance:'Medium', status:statuses.includes(task.status)?task.status:'Not started', details:String(task.details || ''), category:String(task.category || ''), ticketLinks:String(task.ticketLinks || ''), updatedAt:task.updatedAt || ''});
  let tasks = [], storageAvailable = true, view = 'day', toastTimer;
  try { const stored = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(stored)) tasks = stored.filter(validTask).map(normalize); } catch { storageAvailable = false; }
  const form = $('taskForm');
  const dialog = $('targetDialog');
  $('selectedDate').value = localDate(new Date());

  function notify(message) { clearTimeout(toastTimer); $('toast').textContent=message; $('toast').hidden=false; toastTimer=setTimeout(()=>$('toast').hidden=true,3500); }
  function storageNotice() { $('storageNotice').textContent = storageAvailable ? 'Saved only in this browser on this device. Export a backup to keep or transfer your targets.' : 'Browser storage is unavailable. Export a backup before closing this page to keep your targets.'; $('storageNotice').classList.toggle('notice',!storageAvailable); }
  function save() { try { localStorage.setItem(KEY,JSON.stringify(tasks)); storageAvailable=true; } catch { storageAvailable=false; notify('Storage unavailable. Export a backup to keep your changes.'); } storageNotice(); }
  function dayStats(date) { const daily=tasks.filter(task=>task.target===date), done=daily.filter(task=>task.status==='Completed').length; return {total:daily.length,done,active:daily.filter(task=>task.status==='In progress').length,percent:daily.length ? Math.floor(done/daily.length*100) : 0}; }

  function openForm(task) {
    form.reset(); $('taskName').setCustomValidity(''); $('extraFields').open=false; $('taskId').value=task?.id || '';
    $('taskName').value=task?.name || ''; $('target').value=task ? task.target : $('selectedDate').value;
    $('taskType').value=task?.type || 'Major'; $('importance').value=task?.importance || 'Medium'; $('status').value=task?.status || 'Not started';
    ['details','category','ticketLinks'].forEach(key=>$(key).value=task?.[key] || '');
    $('extraFields').open=Boolean(task?.category || task?.ticketLinks);
    $('formTitle').textContent=task ? 'Edit target' : 'Add a target'; $('saveBtn').textContent=task ? 'Update target' : 'Save target';
    dialog.showModal(); $('taskName').focus();
  }

  function taskMarkup(task) {
    const links=task.ticketLinks.split(/\n|,/).map(link=>link.trim()).filter(Boolean).map((raw,index)=>{ const url=safeUrl(raw); return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Link ${index+1} ↗</a>` : `<span class="muted">${esc(raw)}</span>`; }).join('');
    return `<article class="task ${task.status==='Completed'?'completed':''}"><input class="complete-toggle" type="checkbox" data-complete="${esc(task.id)}" aria-label="Mark ${esc(task.name)} complete" ${task.status==='Completed'?'checked':''}><div><h3>${esc(task.name)}</h3><div class="meta"><span class="priority ${task.importance.toLowerCase()}">${task.importance} priority</span><span>${task.type}</span>${task.category?`<span>${esc(task.category)}</span>`:''}${task.target && task.target<localDate(new Date()) && task.status!=='Completed'?'<span class="danger">Overdue</span>':''}</div>${task.details?`<p class="description">${esc(task.details)}</p>`:''}${links?`<div class="ticket-links">${links}</div>`:''}</div><div class="task-side"><select data-status-id="${esc(task.id)}" aria-label="Status for ${esc(task.name)}">${statuses.map(status=>`<option ${task.status===status?'selected':''}>${status}</option>`).join('')}</select><button class="icon" data-edit="${esc(task.id)}" title="Edit target" aria-label="Edit ${esc(task.name)}">✎</button><button class="icon danger" data-delete="${esc(task.id)}" title="Delete target" aria-label="Delete ${esc(task.name)}">×</button></div></article>`;
  }

  function render() {
    const selected=$('selectedDate').value, stats=dayStats(selected);
    $('headingDate').textContent=new Date(selected+'T00:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    $('progressDate').textContent=dateLabel(selected); $('dailyPercent').textContent=stats.percent+'%'; $('dailyProgress').value=stats.percent;
    $('totalCount').textContent=stats.total; $('progressCount').textContent=stats.active; $('doneCount').textContent=stats.done;
    $('progressMessage').textContent=!stats.total ? 'A fresh day. No targets scheduled yet.' : stats.done===stats.total ? `🎉 All ${stats.total} target${stats.total===1?'':'s'} complete. Day done!` : `${stats.done} of ${stats.total} completed · ${stats.total-stats.done} to go`;
    const monday=new Date(selected+'T00:00:00'); monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
    $('weekStrip').innerHTML=Array.from({length:7},(_,index)=>{ const date=new Date(monday); date.setDate(date.getDate()+index); const key=localDate(date), daily=dayStats(key); return `<button class="day ${key===selected?'active':''}" data-day="${key}" aria-pressed="${key===selected}" aria-label="${esc(dateLabel(key))}, ${daily.total ? daily.percent+'% completed' : 'no targets'}"><span class="day-name">${date.toLocaleDateString(undefined,{weekday:'short'})}</span><span class="day-number">${date.getDate()}</span><span class="day-progress">${daily.total?daily.percent+'%':'—'}</span></button>`; }).join('');
    $('dayView').setAttribute('aria-pressed',String(view==='day')); $('allView').setAttribute('aria-pressed',String(view==='all'));
    const query=$('search').value.trim().toLowerCase(), status=$('filterStatus').value, type=$('filterType').value;
    const visible=tasks.filter(task=>(view==='all' || task.target===selected) && (status==='All' || task.status===status) && (type==='All' || task.type===type) && [task.name,task.details,task.category,task.ticketLinks].join(' ').toLowerCase().includes(query)).sort((first,second)=>(first.target || '9999').localeCompare(second.target || '9999') || Number(first.status==='Completed')-Number(second.status==='Completed') || ({High:0,Medium:1,Low:2}[first.importance]-{High:0,Medium:1,Low:2}[second.importance]));
    if (!visible.length) { const filtered=query || status!=='All' || type!=='All'; $('taskList').innerHTML=`<div class="empty"><div class="empty-art" aria-hidden="true">${filtered?'🔎':'🌱'}</div><h3>${filtered?'No matching targets':view==='day'?'A little room for your next goal':'Your next goal starts here'}</h3><p class="muted">${filtered?'Try another search or clear your filters.':view==='day'?'No targets scheduled for '+esc(dateLabel(selected))+'.':'No targets added yet.'}</p><button ${filtered?'id="clearFilters"':'data-add-target'}>${filtered?'Clear filters':'＋ Add target'}</button></div>`; return; }
    const groups=new Map(); visible.forEach(task=>{ if (!groups.has(task.target)) groups.set(task.target,[]); groups.get(task.target).push(task); });
    $('taskList').innerHTML=Array.from(groups,([date,items])=>{ const daily=dayStats(date); return `<section class="target-group"><h3 class="group-heading"><span>${esc(dateLabel(date))}</span><span>${daily.done}/${daily.total} complete${date?' · '+daily.percent+'%':''}</span></h3>${items.map(taskMarkup).join('')}</section>`; }).join('');
  }

  function chooseDate(value) { if (!validDate(value)) return; $('selectedDate').value=value; render(); }
  $('selectedDate').addEventListener('change',()=>{ if (validDate($('selectedDate').value)) render(); else chooseDate(localDate(new Date())); });
  function moveDay(amount) { const date=new Date($('selectedDate').value+'T00:00:00'); date.setDate(date.getDate()+amount); chooseDate(localDate(date)); }
  $('prevDay').addEventListener('click',()=>moveDay(-1)); $('nextDay').addEventListener('click',()=>moveDay(1)); $('todayBtn').addEventListener('click',()=>chooseDate(localDate(new Date())));
  $('weekStrip').addEventListener('click',event=>{ const button=event.target.closest('[data-day]'); if (button) chooseDate(button.dataset.day); });
  $('dayView').addEventListener('click',()=>{ view='day'; render(); }); $('allView').addEventListener('click',()=>{ view='all'; render(); });
  ['search','filterStatus','filterType'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
  $('addTarget').addEventListener('click',()=>openForm());
  ['closeDialog','cancelBtn'].forEach(id=>$(id).addEventListener('click',()=>dialog.close()));

  form.addEventListener('submit',event=>{
    event.preventDefault();
    if (!$('taskName').value.trim()) { $('taskName').setCustomValidity('Enter a target name.'); $('taskName').reportValidity(); return; }
    if (!validDate($('target').value)) { $('target').reportValidity(); return; }
    const editing=Boolean($('taskId').value), id=$('taskId').value || (globalThis.crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())+'-'+Math.random().toString(36).slice(2));
    const task={id,name:$('taskName').value.trim(),target:$('target').value,type:$('taskType').value,importance:$('importance').value,status:$('status').value,details:$('details').value.trim(),category:$('category').value.trim(),ticketLinks:$('ticketLinks').value.trim(),updatedAt:new Date().toISOString()};
    const index=tasks.findIndex(existing=>existing.id===id); if (index>=0) tasks[index]=task; else tasks.push(task);
    save(); chooseDate(task.target); dialog.close(); if (storageAvailable) notify(editing?'Target updated.':'Target added.');
  });
  $('taskName').addEventListener('input',()=>$('taskName').setCustomValidity(''));
  $('taskList').addEventListener('click',event=>{
    const button=event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-add-target')) openForm();
    if (button.id==='clearFilters') { $('search').value=''; $('filterStatus').value='All'; $('filterType').value='All'; render(); }
    if (button.dataset.edit) { const task=tasks.find(item=>item.id===button.dataset.edit); if (task) openForm(task); }
    if (button.dataset.delete) { const task=tasks.find(item=>item.id===button.dataset.delete); if (task && confirm(`Delete "${task.name}"?`)) { tasks=tasks.filter(item=>item.id!==task.id); save(); render(); } }
  });
  $('taskList').addEventListener('change',event=>{ const id=event.target.dataset.statusId || event.target.dataset.complete; if (!id) return; const task=tasks.find(item=>item.id===id); if (!task) return; const checkbox=event.target.hasAttribute('data-complete'); task.status=checkbox ? (event.target.checked?'Completed':'Not started') : event.target.value; task.updatedAt=new Date().toISOString(); save(); render(); const attribute=checkbox?'data-complete':'data-status-id'; Array.from($('taskList').querySelectorAll(`[${attribute}]`)).find(element=>element.getAttribute(attribute)===id)?.focus(); });
  $('exportBtn').addEventListener('click',()=>{ const blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),tasks},null,2)],{type:'application/json'}), link=document.createElement('a'), url=URL.createObjectURL(blob); link.href=url; link.download='daily-targets-'+localDate(new Date())+'.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); });
  $('importBtn').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async event=>{ const file=event.target.files[0]; if (!file) return; try { const data=JSON.parse(await file.text()), incoming=Array.isArray(data)?data:data?.tasks; if (!Array.isArray(incoming) || !incoming.every(validTask) || new Set(incoming.map(task=>task.id)).size!==incoming.length) throw new Error('Invalid backup'); const normalized=incoming.map(normalize); if (confirm(`Restore ${normalized.length} targets? This replaces your current targets. Export a backup first if needed.`)) { tasks=normalized; save(); render(); if (storageAvailable) notify('Backup restored.'); } } catch { alert('Could not import this file. Choose a valid tracker JSON backup.'); } finally { event.target.value=''; } });
  storageNotice(); render();
})();
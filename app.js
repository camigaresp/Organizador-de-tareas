'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const paths = {
  logo:'M3 11l9-5 9 5-9 5-9-5z M7 13v4c3 3 7 3 10 0v-4 M21 11v5',
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  list:'M9 6h12 M9 12h12 M9 18h12 M3 6h1 M3 12h1 M3 18h1',
  week:'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2 M8 17h2',
  folder:'M3 7h7l2 2h9v11H3z M3 7V5h7l2 2h7',
  copy:'M8 8h12v13H8z M16 8V3H3v13h5',
  review:'M3 19h18 M6 15v-4 M12 15V7 M18 15V4',
  check:'M5 12l4 4L19 6',
  clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  alert:'M12 3l10 17H2z M12 9v4 M12 17h.01',
  code:'M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 4l-4 16',
  calc:'M5 3h14v18H5z M8 7h8 M8 12h1 M15 12h1 M8 16h1 M15 16h1',
  chat:'M3 4h18v13H9l-6 4z M7 9h10 M7 12h7',
  book:'M12 6c-3-3-7-3-9-2v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 2v14'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const nav = {tablero:['Tablero','grid'],actividades:['Actividades','list'],semana:['Plan semanal','week'],proyectos:['Proyectos','folder'],plantillas:['Plantillas','copy'],revision:['Revisión','review']};
const states = {pendiente:'Pendiente',proceso:'En proceso',terminada:'Terminada'};
const priorities = {alta:'Alta',media:'Media',baja:'Baja'};
const types = ['Tarea','Examen','Proyecto'];
const initialSubjects = ['Programación','Estadística','Cálculo','Inglés'];
const subjectIcons = [['code',''],['review','blue'],['calc','pink'],['chat','green']];
const dayFormat = new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'});
function today() {
  const parts = Object.fromEntries(dayFormat.formatToParts().map(item => [item.type,item.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const parseDay = day => new Date(day + 'T12:00:00Z');
function shift(day, count) {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0,10);
}
const format = (day, options = {day:'numeric',month:'short'}) => day ? new Intl.DateTimeFormat('es-EC',{timeZone:'UTC',...options}).format(parseDay(day)) : 'Sin fecha';
const monday = day => shift(day,-((parseDay(day).getUTCDay()+6)%7));
const uid = () => crypto.randomUUID();
const emptyTask = () => ({title:'',subject:state?.subjects[0] ?? initialSubjects[0],type:'Tarea',due:'',plan:'',priority:'media',status:'pendiente',notes:'',rubric:'',links:'',steps:[],files:[],history:[]});
function seed() {
  const now = today();
  const sample = (title, subject, type, offset, priority, status, steps) => ({
    ...emptyTask(),id:uid(),title,subject,type,due:shift(now,offset),plan:shift(now,Math.max(0,offset-1)),priority,status,example:true,
    steps:steps.map((text,index)=>({text,done:status==='terminada'||(status==='proceso'&&index===0)}))
  });
  return {subjects:[...initialSubjects],tasks:[
    sample('Avanzar el recomendador de outfits','Programación','Proyecto',2,'alta','proceso',['Definir las clases','Probar los filtros','Preparar el README']),
    sample('Repasar distribuciones continuas','Estadística','Examen',3,'alta','pendiente',['Revisar fórmulas','Resolver ejercicios en R']),
    sample('Practicar integrales dobles','Cálculo','Tarea',4,'media','pendiente',['Dibujar la región','Resolver dos ejercicios']),
    sample('Preparar el monólogo de tendencias','Inglés','Proyecto',5,'media','pendiente',['Elegir ejemplos','Ensayar y grabar']),
    sample('Explorar un conjunto de datos','Estadística','Proyecto',7,'baja','pendiente',['Revisar variables','Preparar gráficos']),
    sample('Modelar un sólido de revolución','Cálculo','Proyecto',8,'media','pendiente',['Dibujar el sólido','Calcular el volumen']),
    sample('Organizar apuntes de clase','Programación','Tarea',0,'baja','terminada',['Ordenar los archivos'])
  ],templates:[
    {...emptyTask(),id:uid(),title:'Entrega con rúbrica',steps:['Leer las instrucciones','Hacer el borrador','Revisar cada criterio','Subir la entrega'].map(text=>({text,done:false}))},
    {...emptyTask(),id:uid(),title:'Preparar un examen',type:'Examen',steps:['Listar los temas','Resolver ejercicios','Repasar errores'].map(text=>({text,done:false}))}
  ]};
}
let db, state, draft, modalMode, busy = false, week = monday(today());
let filters = {subject:'',status:'',type:'',query:''};
let toastTimer, previewUrls=[];
const content = $('#content');
const modal = $('#modal');
const modalBody = $('#modal-body');
function openDB() {
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open('mi-agenda-puce',1);
    request.onupgradeneeded = () => request.result.createObjectStore('agenda');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function loadState() {
  return new Promise((resolve,reject)=>{
    const request = db.transaction('agenda').objectStore('agenda').get('state');
    request.onsuccess = () => resolve(request.result ?? seed());
    request.onerror = () => reject(request.error);
  });
}
async function save(next) {
  if (busy) return false;
  busy = true;
  try {
    await new Promise((resolve,reject)=>{
      const transaction = db.transaction('agenda','readwrite');
      transaction.objectStore('agenda').put(next,'state');
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
    });
    state = next;
    render();
    return true;
  } catch {
    message('No se pudo guardar. Revisa el espacio disponible en el navegador e inténtalo de nuevo.');
    return false;
  } finally { busy = false; }
}
function message(text) {
  $('#toast').textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>$('#toast').textContent='',5500);
}
const page = () => Object.hasOwn(nav,location.hash.slice(1)) ? location.hash.slice(1) : 'tablero';
const action = (name, label, value='', css='subtle') => `<button type="button" class="${css}" data-action="${name}" data-value="${esc(value)}">${label}</button>`;
const openTasks = () => state.tasks.filter(task=>task.status!=='terminada');
const order = (a,b) => (a.due||'9999').localeCompare(b.due||'9999');
function ranked(tasks) {
  const band = task => task.due && task.due <= today() ? 0 : task.due && task.due <= shift(today(),2) ? 1 : 2;
  const rank = {alta:0,media:1,baja:2};
  return [...tasks].sort((a,b)=>band(a)-band(b)||rank[a.priority]-rank[b.priority]||order(a,b)||a.title.localeCompare(b.title,'es'));
}
const progress = task => task.status==='terminada' ? 100 : task.steps.length ? Math.round(100*task.steps.filter(step=>step.done).length/task.steps.length) : 0;
const bar = percent => `<div class="bar" role="progressbar" aria-label="Progreso" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>`;
const chip = (css,label) => `<span class="chip ${css}">${label}</span>`;
const example = task => task.example ? chip('example','Ejemplo') : '';
const empty = text => `<p class="empty">${text}</p>`;
const intro = (title, desc) => `<div class="intro"><h1>${title}</h1><p>${desc}</p></div>`;
const iconBadge = (name,color='') => `<span class="badge-icon ${color}">${icon(name)}</span>`;
function row(task, mode='activity') {
  const done = task.status==='terminada';
  const days = task.due ? `<div class="deadline">${format(task.due,{day:'numeric'})}<small>${format(task.due,{month:'short'})}</small></div>` : '';
  const detail = mode==='deadline' ? task.subject+' · '+task.type+(task.due<today()?' · Vencida':'') : task.subject+' · '+task.type+(task.due?' · '+format(task.due):'');
  return `<div class="row">${mode==='deadline' ? days : `<button class="tick ${done?'done':''}" type="button" aria-label="${done?'Reabrir':'Terminar'} ${esc(task.title)}" data-action="toggle" data-value="${task.id}">${done?icon('check'):''}</button>`}<button class="detail" type="button" data-action="edit" data-value="${task.id}"><b>${esc(task.title)}</b><small>${esc(detail)}</small></button>${example(task)}${mode==='priority'?chip(task.priority,priorities[task.priority]):mode==='activity'?chip(task.status,states[task.status]):''}</div>`;
}
function subjectCards() {
  return state.subjects.map((name,index)=>{
    const [symbol,color] = subjectIcons[index] ?? ['book',''];
    const tasks = state.tasks.filter(task=>task.subject===name);
    const completed = tasks.filter(task=>task.status==='terminada').length;
    return action('subject',`${iconBadge(symbol,color)}<h3>${esc(name)}</h3><small>${tasks.length-completed} por hacer · ${completed} terminadas</small>${bar(tasks.length?Math.round(100*completed/tasks.length):0)}`,name,'subject');
  }).join('');
}
function dashboard() {
  const active = openTasks();
  const now = today();
  const next = ranked(active).slice(0,4);
  const upcoming = active.filter(task=>task.due).sort(order).slice(0,4);
  const stats = [
    ['pendiente','Pendientes','list','',state.tasks.filter(t=>t.status==='pendiente').length],
    ['proceso','En proceso','clock','blue',state.tasks.filter(t=>t.status==='proceso').length],
    ['terminada','Terminadas','check','green',state.tasks.filter(t=>t.status==='terminada').length],
    ['urgent','Vencen en 7 días','week','pink',active.filter(t=>t.due>=now&&t.due<shift(now,7)).length]
  ];
  return `<section class="hero"><div><div class="eyebrow">Mi semana en la PUCE</div><h1>¡Hola, Cami!</h1><p>Organiza tus entregas y decide qué hacer primero.</p><a class="secondary" href="#semana">${icon('week')} Ver plan semanal <span aria-hidden="true">→</span></a></div><div class="hero-art" aria-hidden="true"><div class="tile"><i></i><i></i><i></i></div></div></section>
  <div class="stats">${stats.map(([key,label,symbol,color,count])=>action('stat',`${iconBadge(symbol,color)}<span><strong>${count}</strong><small>${label}</small></span>`,key,'stat')).join('')}</div>
  <div class="split"><section class="panel"><div class="section-head"><div><h2>Qué hacer primero</h2><p>Según urgencia y prioridad</p></div><a class="subtle" href="#actividades">Ver todo →</a></div>${next.length?next.map(task=>row(task,'priority')).join(''):empty('Agrega una actividad para empezar.')}</section>
  <section class="panel"><div class="section-head"><div><h2>Fechas límite</h2><p>Entregas y exámenes abiertos</p></div></div>${upcoming.length?upcoming.map(task=>row(task,'deadline')).join(''):empty('No hay fechas límite pendientes.')}</section></div>
  <section class="lower"><div class="section-head"><h2>Mis materias</h2>${action('subject-new','＋ Materia')}</div><div class="subjects">${subjectCards()}</div></section>`;
}
const option = (value,label,selected) => `<option value="${esc(value)}"${value===selected?' selected':''}>${esc(label)}</option>`;
const options = (items, selected) => items.map(item=>Array.isArray(item)?option(...item,selected):option(item,item,selected)).join('');
function activityResults() {
  const now = today();
  const query = filters.query.trim().toLocaleLowerCase('es');
  const found = ranked(state.tasks.filter(task =>
    (!filters.subject||task.subject===filters.subject) &&
    (!filters.type||task.type===filters.type) &&
    (!filters.status|| (filters.status==='urgent' ? task.status!=='terminada'&&task.due>=now&&task.due<shift(now,7) : task.status===filters.status)) &&
    (!query||[task.title,task.notes,task.rubric,task.subject,...task.steps.map(step=>step.text)].join(' ').toLocaleLowerCase('es').includes(query))
  ));
  return found.length ? found.map(task=>row(task)).join('') : empty('No hay actividades con estos filtros.');
}
function activities() {
  return intro('Actividades','Busca tareas, exámenes y proyectos por materia, tipo o estado.')+`<div class="filters"><input style="width:auto" id="search" type="search" aria-label="Buscar actividades" placeholder="Buscar actividades…" value="${esc(filters.query)}"><select style="width:auto" aria-label="Filtrar por materia" data-filter="subject">${options([['','Todas las materias'],...state.subjects],filters.subject)}</select><select style="width:auto" aria-label="Filtrar por tipo" data-filter="type">${options([['','Todos los tipos'],...types],filters.type)}</select><select style="width:auto" aria-label="Filtrar por estado" data-filter="status">${options([['','Todos los estados'],...Object.entries(states),['urgent','Vencen en 7 días']],filters.status)}</select></div><section id="results" class="panel">${activityResults()}</section>`;
}
function weekly() {
  const last = shift(week,6);
  const days = Array.from({length:7},(_,index)=>shift(week,index));
  const relevant = state.tasks.filter(t=>(t.plan>=week&&t.plan<=last)||(t.due>=week&&t.due<=last));
  return intro('Plan semanal','El día planeado y la fecha límite se muestran por separado.')+
  `<div class="week-controls">${action('shift','‹ Anterior','-7','secondary')}<strong>${format(week)} – ${format(last,{day:'numeric',month:'short',year:'numeric'})}</strong>${action('shift','Siguiente ›','7','secondary')}${action('current-week','Esta semana')}</div><div class="grid-week">${days.map(day=>`<section class="day ${day===today()?'is-today':''}"><h3>${format(day,{weekday:'short',day:'numeric'})}</h3>${ranked(relevant.filter(t=>t.plan===day||t.due===day)).map(t=>action('edit',`<b>${esc(t.title)}</b><small>${t.plan===day&&t.due===day?'Plan y vence':t.due===day?'Vence':'Planeada'} · ${states[t.status]} · ${priorities[t.priority]}</small><small>${progress(t)} %${t.example?' · Ejemplo':''}</small>`,t.id,'event')).join('')}${action('add-day','＋ Añadir',day)}</section>`).join('')}</div><section class="panel"><div class="section-head"><h2>Por hacer esta semana</h2></div>${ranked(relevant.filter(t=>t.status!=='terminada')).map(t=>row(t,'priority')).join('')||empty('No hay actividades abiertas para esta semana.')}</section>`;
}
function projects() {
  return intro('Proyectos','Divide cada proyecto en pasos y revisa cuánto has avanzado.')+state.subjects.map((subject,index)=>{
    const tasks = state.tasks.filter(t=>t.subject===subject&&t.type==='Proyecto').sort(order);
    return `<section class="panel review-card"><div class="section-head"><h2>${esc(subject)}</h2>${action('new-project','＋ Proyecto',subject)}</div><div class="projects">${tasks.map(t=>action('edit',`${iconBadge(...(subjectIcons[index]??['folder','']))}<h3>${esc(t.title)}</h3><small>${states[t.status]} · ${progress(t)} %</small><small>${t.steps.filter(s=>s.done).length}/${t.steps.length} pasos · ${format(t.due)}</small>${example(t)}${bar(progress(t))}`,t.id,'project')).join('')}</div>${tasks.length?'':empty('Aún no hay proyectos en esta materia.')}</section>`;
  }).join('');
}
function templates() {
  return intro('Plantillas','Reutiliza instrucciones, rúbricas, enlaces y listas de pasos.')+`<div class="section-head">${action('template-new','＋ Nueva plantilla','','primary')}</div><div class="stack">${state.templates.map(t=>`<section class="panel toolbar"><div><h3>${esc(t.title)}</h3><p class="meta">${esc(t.subject)} · ${t.type} · ${t.steps.length} pasos</p></div><div class="actions">${action('template-edit','Editar',t.id)}${action('template-use','Usar plantilla',t.id,'secondary')}</div></section>`).join('')||empty('Todavía no tienes plantillas.')}</div>`;
}
function history(items) {
  return items.length ? `<ol class="history">${[...items].reverse().map(h=>`<li><strong>${format(h.day,{day:'numeric',month:'short',year:'numeric'})}</strong> · ${esc(h.text)}</li>`).join('')}</ol>` : empty('Aún no hay cambios registrados.');
}
function review() {
  const completed = state.tasks.filter(t=>t.status==='terminada');
  const percent = state.tasks.length?Math.round(completed.length/state.tasks.length*100):0;
  const pending = ranked(openTasks());
  const changed = state.tasks.filter(t=>t.history.length);
  return intro('Revisión','Mira tu avance y reprograma actividades conservando las fechas anteriores.')+
    `<section class="panel"><h2>Avance general</h2><p class="review-progress">${completed.length} de ${state.tasks.length} actividades terminadas · ${percent} %</p>${bar(percent)}${completed.length?`<details class="spacer"><summary>Ver terminadas</summary>${completed.map(t=>row(t)).join('')}</details>`:''}</section>
    <section class="panel review-card"><div class="section-head"><h2>Reprogramar pendientes</h2></div>${pending.map(t=>`<div class="row"><button class="detail" data-action="edit" data-value="${t.id}"><b>${esc(t.title)}</b><small>${esc(t.subject)} · Plan ${format(t.plan)} · Límite ${format(t.due)} · ${progress(t)} %</small></button>${example(t)}${action('reschedule','Reprogramar',t.id)}</div>`).join('')||empty('No tienes actividades por reprogramar.')}</section>
    <section class="panel review-card"><h2>Historial de cambios</h2>${changed.map(t=>`<details class="spacer"><summary>${esc(t.title)} · ${t.history.length} registros</summary>${history(t.history)}</details>`).join('')||empty('Aquí aparecerán las reprogramaciones y los cambios de estado.')}</section>
    <section class="panel review-card toolbar"><div><h2>Datos de la agenda</h2><p class="meta">Las actividades, plantillas y capturas se guardan en este navegador.</p></div>${state.tasks.some(t=>t.example)?action('clear-examples','Quitar ejemplos','','secondary'):''}</section>`;
}
const pages = {tablero:dashboard,actividades:activities,semana:weekly,proyectos:projects,plantillas:templates,revision:review};
function render() {
  const current = page();
  $('#nav').innerHTML = Object.entries(nav).map(([key,[label,symbol]])=>`<a href="#${key}"${key===current?' aria-current="page"':''}>${icon(symbol)}${label}</a>`).join('');
  $('#breadcrumb').innerHTML = 'Mi espacio <span>/</span> '+nav[current][0];
  $('#today').textContent = format(today(),{weekday:'long',day:'numeric',month:'long'});
  content.innerHTML = pages[current]();
}
function showModal(title, body) {
  modalBody.innerHTML = `<header class="modal-head"><h2 id="dialog-title">${esc(title)}</h2>${action('close','✕','','secondary').replace('type="button"','type="button" aria-label="Cerrar"')}</header>${body}`;
  modal.setAttribute('aria-labelledby','dialog-title');
  if (!modal.open) modal.showModal();
  modal.scrollTop = 0;
}
function safeLink(value) {
  try {
    const parsed = new URL(value);
    return ['https:','http:'].includes(parsed.protocol)?parsed.href:'';
  } catch { return ''; }
}
function stepMarkup(step) {
  return `<div class="step"><input type="checkbox" aria-label="Paso terminado"${step.done?' checked':''}><input type="text" aria-label="Descripción del paso" placeholder="Escribe un paso" value="${esc(step.text)}">${action('remove-step','Quitar')}</div>`;
}
function showFiles() {
  previewUrls.forEach(url=>URL.revokeObjectURL(url));
  previewUrls = [];
  $('#attachments').innerHTML = draft.files.map((file,index)=>{
    const url = URL.createObjectURL(file.blob);
    previewUrls.push(url);
    return `<div class="attachment"><img src="${url}" alt=""><a href="${url}" target="_blank" rel="noopener">${esc(file.name)}</a>${action('remove-file','Quitar',index)}</div>`;
  }).join('');
}
function editor(task, mode='task') {
  modalMode = mode;
  draft = structuredClone(task);
  const isTemplate = mode==='template';
  const fields = draft;
  const links = fields.links.split('\n').map(line=>[line.trim(),safeLink(line.trim())]).filter(([,url])=>url);
  showModal(isTemplate?(fields.id?'Editar plantilla':'Nueva plantilla'):(fields.id?'Editar actividad':'Nueva actividad'),`
    <form id="editor"><div class="form-grid">
    <label class="wide">${isTemplate?'Nombre de la plantilla':'Título'}<input required maxlength="180" name="title" value="${esc(fields.title)}" placeholder="Ej. Preparar el examen de Estadística"></label>
    <label>Materia<select name="subject">${options(state.subjects,fields.subject)}</select></label>
    <label>Tipo<select name="type">${options(types,fields.type)}</select></label>
    <label>Prioridad<select name="priority">${options(Object.entries(priorities),fields.priority)}</select></label>
    ${isTemplate?'':`<label>Estado<select name="status">${options(Object.entries(states),fields.status)}</select></label><label>Día planeado<input type="date" name="plan" value="${fields.plan}"></label><label>Fecha límite<input type="date" name="due" value="${fields.due}"></label>`}
    <label class="wide">Instrucciones<textarea name="notes" rows="3" placeholder="Pega aquí las instrucciones de la actividad">${esc(fields.notes)}</textarea></label>
    <label class="wide">Rúbrica<textarea name="rubric" rows="3" placeholder="Pega los criterios de evaluación">${esc(fields.rubric)}</textarea></label>
    <label class="wide">Enlaces <span class="hint">Uno por línea.</span><textarea name="links" rows="2" placeholder="https://…">${esc(fields.links)}</textarea></label>
    ${links.length?`<div class="wide stack">${links.map(([name,url])=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)}</a>`).join('')}</div>`:''}
    <div class="wide"><div class="section-head"><h3>Pasos</h3>${action('add-step','＋ Añadir paso')}</div><div class="steps">${fields.steps.map(stepMarkup).join('')}</div></div>
    <div class="wide"><label>Capturas <span class="hint">Pega una imagen con Ctrl+V o adjunta un archivo. Hasta 8 MB por imagen.</span><input name="images" type="file" accept="image/*" multiple></label><div id="attachments" class="attachments"></div></div>
    ${!isTemplate&&fields.history.length?`<details class="wide"><summary>Historial de esta actividad</summary>${history(fields.history)}</details>`:''}
    </div><p id="form-status" role="status" class="hint spacer"></p><div class="modal-foot">${fields.id?action('delete','Eliminar','','subtle danger'):''}${isTemplate?'':action('as-template','Guardar como plantilla')}${action('close','Cancelar','','secondary')}<button class="primary" type="submit">Guardar</button></div></form>`);
  showFiles();
}
function appendImages(files) {
  const accepted = files.filter(file=>file.type.startsWith('image/')&&file.size<=8*1024*1024);
  draft.files.push(...accepted.map(file=>({name:file.name||'Captura',blob:file})));
  $('#form-status').textContent = accepted.length===files.length?'':'Adjunta solo imágenes de hasta 8 MB.';
  showFiles();
}
function readEditor() {
  const values = new FormData($('#editor'));
  const changes = Object.fromEntries([...values].filter(([key])=>key!=='images').map(([key,value])=>[key,value.trim()]));
  const steps = [...document.querySelectorAll('.steps .step')].map(element=>({text:$('input[type=text]',element).value.trim(),done:$('input[type=checkbox]',element).checked})).filter(step=>step.text);
  const result = {...draft,...changes,steps};
  if (!result.title) { $('#form-status').textContent='Escribe un título.'; return null; }
  if (result.links.split('\n').some(line=>line.trim()&&!safeLink(line.trim()))) {
    $('#form-status').textContent='Usa un enlace http o https por línea.';
    return null;
  }
  return result;
}
const log = (task,text) => ({...task,history:[...task.history,{day:today(),text}]});
function track(previous, next, reason='') {
  for (const [key,label] of [['plan','Día planeado'],['due','Fecha límite']]) {
    if (previous[key]!==next[key]) next=log(next,`${label}: ${format(previous[key],{dateStyle:'medium'})} → ${format(next[key],{dateStyle:'medium'})}${reason?' · '+reason:''}`);
  }
  if (previous.status!==next.status) next=log(next,`Estado: ${states[previous.status]} → ${states[next.status]}`);
  const done = task => task.steps.filter(step=>step.done).length;
  if (done(previous)!==done(next)||previous.steps.length!==next.steps.length) {
    next=log(next,`Pasos terminados: ${done(previous)}/${previous.steps.length} → ${done(next)}/${next.steps.length}`);
  }
  return next;
}
async function commitTask(task, original, reason) {
  const record = original ? {...track(original,task,reason),example:false} : {...task,id:uid(),example:false};
  const tasks = original?state.tasks.map(item=>item.id===record.id?record:item):[...state.tasks,record];
  return save({...state,tasks});
}
async function commitTemplate(task, asNew) {
  const record = {...task,id:asNew||!task.id?uid():task.id,due:'',plan:'',status:'pendiente',example:false,history:[],steps:task.steps.map(step=>({...step,done:false}))};
  const templates = state.templates.some(t=>t.id===record.id)?state.templates.map(t=>t.id===record.id?record:t):[...state.templates,record];
  return save({...state,templates});
}
function closeWith(text) {
  modal.close();
  message(text);
}
function reschedule(task) {
  draft=task;
  showModal('Reprogramar actividad',`<form id="reschedule"><p class="section-head">${esc(task.title)}</p><div class="form-grid"><label>Nuevo día planeado<input name="plan" type="date" value="${task.plan}"></label><label>Fecha límite<input name="due" type="date" value="${task.due}"></label><label class="wide">Motivo (opcional)<textarea name="reason" rows="2" placeholder="Ej. Necesito repasar un tema antes"></textarea></label></div><p id="form-status" class="hint spacer" role="status"></p><div class="modal-foot">${action('close','Cancelar','','secondary')}<button class="primary">Guardar reprogramación</button></div></form>`);
}
let confirmation;
function confirmModal(title, description, callback) {
  confirmation=callback;
  showModal(title,`<p>${esc(description)}</p><div class="modal-foot">${action('close','Cancelar','','secondary')}${action('confirm','Eliminar','','primary')}</div>`);
}
function jumpToActivities(nextFilters) {
  filters = {subject:'',status:'',type:'',query:'',...nextFilters};
  if(page()==='actividades') render();
  else location.hash='actividades';
}
const findTask = id => state.tasks.find(t=>t.id===id);
const findTemplate = id => state.templates.find(t=>t.id===id);
const handlers = {
  new:()=>editor({...emptyTask(),subject:(page()==='actividades'&&filters.subject)||state.subjects[0]}),
  edit:id=>editor(findTask(id)),
  close:()=>modal.close(),
  subject:name=>jumpToActivities({subject:name}),
  stat:status=>jumpToActivities({status}),
  'new-project':subject=>editor({...emptyTask(),subject,type:'Proyecto'}),
  'add-day':plan=>editor({...emptyTask(),plan}),
  shift:count=>{week=shift(week,Number(count));render();},
  'current-week':()=>{week=monday(today());render();},
  'template-new':()=>editor(emptyTask(),'template'),
  'template-edit':id=>editor(findTemplate(id),'template'),
  'template-use':id=>editor({...findTemplate(id),id:undefined}),
  'subject-new':()=>showModal('Nueva materia',`<form id="subject-form"><label>Nombre<input name="subject" required maxlength="60" placeholder="Ej. Estructuras de Datos"></label><p id="form-status" role="status" class="hint spacer"></p><div class="modal-foot">${action('close','Cancelar','','secondary')}<button class="primary">Añadir materia</button></div></form>`),
  reschedule:id=>reschedule(findTask(id)),
  toggle:async id=>{
    const task=findTask(id);
    const status=task.status==='terminada'?'pendiente':'terminada';
    if(await commitTask({...task,status},task)) message(status==='terminada'?'Actividad terminada.':'Actividad reabierta.');
  },
  'add-step':()=>{
    $('.steps').insertAdjacentHTML('beforeend',stepMarkup({text:'',done:false}));
    $('.step:last-child input[type=text]').focus();
  },
  'remove-step':(_,button)=>button.closest('.step').remove(),
  'remove-file':index=>{draft.files.splice(Number(index),1);showFiles();},
  'as-template':async()=>{
    if(!$('#editor').reportValidity()) return;
    const task=readEditor();
    if(task&&await commitTemplate(task,true)) message('Plantilla guardada. Puedes seguir editando la actividad.');
  },
  delete:()=>{
    const key=modalMode==='template'?'templates':'tasks';
    const {id,title}=draft;
    confirmModal('Eliminar «'+title+'»','Se eliminará de tu agenda junto con sus capturas e historial.',async()=>{
      if(await save({...state,[key]:state[key].filter(t=>t.id!==id)})) closeWith('Se eliminó correctamente.');
    });
  },
  'clear-examples':()=>confirmModal('Quitar actividades de ejemplo','Se eliminarán las actividades que todavía tienen la etiqueta Ejemplo.',async()=>{
    if(await save({...state,tasks:state.tasks.filter(t=>!t.example)})) closeWith('Ejemplos eliminados.');
  }),
  confirm:()=>confirmation()
};
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');
  if(button&&state&&!busy) handlers[button.dataset.action]?.(button.dataset.value,button);
});
document.addEventListener('input',event=>{
  if(event.target.id==='search'){
    filters.query=event.target.value;
    $('#results').innerHTML=activityResults();
  }
});
document.addEventListener('change',event=>{
  const {target}=event;
  if(target.dataset.filter){
    filters[target.dataset.filter]=target.value;
    $('#results').innerHTML=activityResults();
  }
  if(target.name==='images'&&$('#editor')){
    appendImages([...target.files]);
    target.value='';
  }
});
document.addEventListener('paste',event=>{
  if(!modal.open||!$('#editor')) return;
  const files=[...event.clipboardData.files].filter(file=>file.type.startsWith('image/'));
  if(files.length){event.preventDefault();appendImages(files);}
});
document.addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy) return;
  const data = new FormData(event.target);
  if(event.target.id==='editor'){
    const task=readEditor();
    if(!task) return;
    const saved=modalMode==='template'?await commitTemplate(task,false):await commitTask(task,findTask(task.id));
    if(saved) closeWith(modalMode==='template'?'Plantilla guardada.':'Actividad guardada.');
  }
  if(event.target.id==='reschedule'){
    const plan=data.get('plan'),due=data.get('due');
    if(plan===draft.plan&&due===draft.due){$('#form-status').textContent='Cambia al menos una fecha para reprogramar.';return;}
    if(await commitTask({...draft,plan,due},draft,data.get('reason').trim())) closeWith('Reprogramada. Las fechas anteriores se guardaron en el historial.');
  }
  if(event.target.id==='subject-form'){
    const subject=data.get('subject').trim();
    if(!subject||state.subjects.some(name=>name.toLocaleLowerCase('es')===subject.toLocaleLowerCase('es'))){
      $('#form-status').textContent='Ingresa un nombre de materia nuevo.';
      return;
    }
    if(await save({...state,subjects:[...state.subjects,subject]})) closeWith('Materia añadida.');
  }
});
modal.addEventListener('close',()=>{
  previewUrls.forEach(url=>URL.revokeObjectURL(url));
  previewUrls=[];
});
window.addEventListener('hashchange',()=>{if(state){render();window.scrollTo(0,0);}});
(async()=>{
  $('#brand-icon').innerHTML=icon('logo');
  try {
    db=await openDB();
    state=await loadState();
    render();
  } catch {
    content.innerHTML='<section class="panel"><h1>No se pudo abrir la agenda</h1><p>Permite el almacenamiento de este sitio en tu navegador y vuelve a cargar la página.</p></section>';
  }
})();

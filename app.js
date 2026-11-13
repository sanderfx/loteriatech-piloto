const cfg = window.LOTERIATECH_CONFIG;
const app = document.getElementById('app');
const alertBox = document.getElementById('alert');
let db, profile, user, tab = 'inicio';
const statusList = ['Novo chamado','Orçamento enviado','Aguardando aprovação','Orçamento aprovado','Orçamento recusado','Alteração solicitada','Visita agendada','Em atendimento','Serviço concluído','Nota fiscal emitida'];
const esc = x => String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notice = (s, err=false) => {alertBox.textContent=s;alertBox.className=err?'error':'';window.scrollTo({top:0,behavior:'smooth'});};
const errMsg = e => notice(e?.message||String(e),true);
const date = d => new Date(d).toLocaleString('pt-BR');
const num = n => `LT-${String(n).padStart(6,'0')}`;
function loginView(){document.getElementById('userbar').innerHTML='';app.innerHTML=`<section class="card login"><h1>Bem-vindo</h1><p>Entre na LoteriaTech</p><form id="login"><label>E-mail<input name="email" type="email" autocomplete="username" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><button>Entrar</button></form></section>`;document.getElementById('login').onsubmit=login;}
async function login(e){e.preventDefault();notice('Entrando...');const f=new FormData(e.target);const {error}=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)return errMsg(error);await initUser();}
async function initUser(){const {data:{user:u},error}=await db.auth.getUser();if(error||!u){user=null;profile=null;loginView();return;}user=u;const {data:p,error:pe}=await db.from('perfis').select('*').eq('id',user.id).maybeSingle();if(pe)return errMsg(pe);if(!p||!p.ativo){await db.auth.signOut();user=null;profile=null;loginView();notice('Seu usuário ainda não foi vinculado a um perfil ativo. Peça ao administrador para cadastrar seu perfil no SQL Editor.',true);return;}profile=p;tab='inicio';notice('');render();}
async function logout(){await db.auth.signOut();user=null;profile=null;notice('Sessão encerrada.');loginView();}
function render(){let admin=profile.tipo==='admin';document.getElementById('userbar').innerHTML=`<span>${esc(profile.nome)} • ${admin?'Administrador':'Lotérica'}</span><button class="secondary" id="sair">Sair</button>`;document.getElementById('sair').onclick=logout;const tabs=admin?['inicio','chamados','orcamentos','visitas','conclusoes','lotericas','usuarios','categorias']:['inicio','abrir','chamados','orcamentos','visitas','conclusoes'];const names={inicio:'Início',abrir:'Abrir chamado',chamados:'Chamados',orcamentos:'Orçamentos',visitas:'Visitas técnicas',conclusoes:'Conclusões',lotericas:'Lotéricas',usuarios:'Usuários',categorias:'Categorias'};app.innerHTML=`<h1>${admin?'Painel administrativo':'Área da lotérica'}</h1><p>Olá, ${esc(profile.nome)}. Acompanhe os serviços da LoteriaTech.</p><nav>${tabs.map(t=>`<button data-tab="${t}" class="${t===tab?'active':''}">${names[t]}</button>`).join('')}</nav><div id="content"></div>`;document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>{tab=el.dataset.tab;render();});content();}
async function content(){const target=document.getElementById('content');target.innerHTML='<div class="card">Carregando...</div>';try{if(tab==='inicio')await home(target);if(tab==='chamados')await tickets(target);if(tab==='orcamentos')await quotes(target);if(tab==='visitas')await visits(target);if(tab==='conclusoes')await completions(target);if(tab==='lotericas')await branches(target);if(tab==='usuarios')await usersPanel(target);if(tab==='categorias')await categories(target);if(tab==='abrir')await newTicket(target);}catch(e){errMsg(e);target.innerHTML='<div class="card">Não foi possível carregar esta seção.</div>';}}
async function home(target){let {data,error}=await db.from('chamados').select('id,status,numero,created_at').order('created_at',{ascending:false}).limit(300);if(error)throw error;const open=data.filter(x=>x.status!=='Serviço concluído'&&x.status!=='Nota fiscal emitida');target.innerHTML=`<div class="grid"><div class="card"><h2>Total de chamados</h2><h1>${data.length}${data.length===300?'+':''}</h1></div><div class="card"><h2>Em aberto</h2><h1>${open.length}${data.length===300?'+':''}</h1></div><div class="card"><h2>Concluídos</h2><h1>${data.filter(x=>['Serviço concluído','Nota fiscal emitida'].includes(x.status)).length}${data.length===300?'+':''}</h1></div></div><div class="card"><h2>Últimos chamados</h2>${data.slice(0,5).map(t=>`<div class="item"><strong>#${num(t.numero)}</strong> <span class="status">${esc(t.status)}</span><div class="meta">${date(t.created_at)}</div></div>`).join('Nenhum chamado até o momento.')}</div>`;}
async function branches(target){if(profile.tipo!=='admin')return;const {data,error}=await db.from('lotericas').select('*').order('created_at',{ascending:false});if(error)throw error;target.innerHTML=`<div class="grid"><section class="card"><h2>Cadastrar lotérica</h2><form id="branch"><label>Nome da lotérica<input name="nome" required minlength="2"></label><label>Responsável<input name="responsavel"></label><label>Telefone<input name="telefone"></label><label>E-mail<input type="email" name="email"></label><label>Endereço<input name="endereco"></label><label>Bairro<input name="bairro"></label><label>Cidade<input name="cidade"></label><label>UF<input name="uf" maxlength="2"></label><button>Cadastrar</button></form></section><section class="card"><h2>Lotéricas cadastradas (${data.length})</h2>${data.map(b=>`<div class="item"><strong>${esc(b.nome)}</strong><div class="meta">${esc(b.cidade)} / ${esc(b.uf)} • ${esc(b.telefone)}</div><div class="meta">ID para vincular usuário: <code>${esc(b.id)}</code></div></div>`).join('Nenhuma lotérica.')}</section></div>`;document.getElementById('branch').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const {error}=await db.from('lotericas').insert(f);if(error)return errMsg(error);notice('Lotérica cadastrada. Para criar login, siga o guia do Supabase.');content();};}
async function categories(target){const {data,error}=await db.from('categorias').select('*').order('nome');if(error)throw error;target.innerHTML=`<div class="grid"><div class="card"><h2>Nova categoria</h2><form id="category"><label>Nome<input name="nome" minlength="3" required></label><button>Adicionar</button></form></div><div class="card"><h2>Categorias</h2>${data.map(c=>`<div class="item">${esc(c.nome)}</div>`).join('Sem categorias')}</div></div>`;document.getElementById('category').onsubmit=async e=>{e.preventDefault();const nome=new FormData(e.target).get('nome').trim();const {error}=await db.from('categorias').insert({nome});if(error)return errMsg(error);notice('Categoria adicionada.');content();};}
async function newTicket(target){const {data:cats,error:e1}=await db.from('categorias').select('id,nome').eq('ativa',true).order('nome');const {data:branch,error:e2}=await db.from('lotericas').select('*').eq('id',profile.loterica_id).single();if(e1||e2)throw e1||e2;target.innerHTML=`<div class="card"><h2>Abrir chamado técnico</h2><p>Lotérica: ${esc(branch.nome)}</p><form id="ticket"><label>Categoria<select name="categoria_id" required><option value="">Selecione</option>${cats.map(c=>`<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></label><label>Descreva o problema<textarea name="descricao" required minlength="8"></textarea></label><label>Telefone de contato<input name="contato_telefone" value="${esc(branch.telefone)}" required></label><label>Endereço do atendimento<input name="endereco_atendimento" value="${esc(branch.endereco)}" required></label><label>Bairro<input name="bairro" value="${esc(branch.bairro)}"></label><label>Cidade<input name="cidade" value="${esc(branch.cidade)}"></label><button>Enviar chamado</button></form><p class="muted">Fotos e anexos serão implementados na próxima etapa.</p></div>`;document.getElementById('ticket').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.loterica_id=profile.loterica_id;f.criado_por=user.id;const {data,error}=await db.from('chamados').insert(f).select('numero').single();if(error)return errMsg(error);notice(`Chamado registrado! Protocolo #${num(data.numero)}`);tab='chamados';render();};}
async function tickets(target){const admin=profile.tipo==='admin';const {data,error}=await db.from('chamados').select('id,numero,loterica_id,descricao,status,created_at,contato_telefone,endereco_atendimento,bairro,cidade,categorias(nome),lotericas(nome)').order('created_at',{ascending:false}).limit(200);if(error)throw error;target.innerHTML=`<div class="card"><h2>Chamados (${data.length}${data.length===200?'+':''})</h2>${data.map(t=>`<article class="item"><strong>#${num(t.numero)}</strong> <span class="status">${esc(t.status)}</span><div class="meta">${esc(t.lotericas?.nome)} • ${esc(t.categorias?.nome)} • ${date(t.created_at)}</div><p>${esc(t.descricao)}</p><div class="meta">${esc(t.endereco_atendimento)} • ${esc(t.bairro)} • ${esc(t.cidade)} • ${esc(t.contato_telefone)}</div>${admin?`<label>Alterar status<select data-ticket="${t.id}">${statusList.filter(s=>['Novo chamado','Visita agendada','Em atendimento',t.status].includes(s)).map(s=>`<option ${s===t.status?'selected':''}>${esc(s)}</option>`).join('')}</select></label>`:''}</article>`).join('Nenhum chamado encontrado.')}</div>`;if(admin)target.querySelectorAll('[data-ticket]').forEach(select=>select.onchange=async()=>{const {error}=await db.from('chamados').update({status:select.value}).eq('id',select.dataset.ticket);if(error)return errMsg(error);notice('Status atualizado.');content();});}
async function start(){if(!cfg?.url?.startsWith('https://')||cfg.key?.includes('COLE_AQUI')){notice('Abra config.js e preencha a URL e a chave publishable/anon do Supabase.',true);return;}db=window.supabase.createClient(cfg.url,cfg.key);const {data:{session}}=await db.auth.getSession();if(session)await initUser();else loginView();}
start().catch(errMsg);

// Etapa 4 — orçamentos integrados ao mesmo Supabase.
const reais = centavos => (Number(centavos||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const moneyToCents = valor => {
  const n=Number(String(valor).replace(',','.'));
  if(!Number.isFinite(n)||n<0||Math.round(n*100)>2147483647) throw new Error('Valor inválido');
  return Math.round(n*100);
};
const modalidades = {servico:'Somente serviço',visita:'Somente visita técnica',combinado:'Visita + serviço'};
const estados = {pendente:'Aguardando aprovação',aprovado:'Aprovado',recusado:'Recusado',alteracao_solicitada:'Alteração solicitada'};
async function quotes(target){
 const admin=profile.tipo==='admin';
 const {data:lista,error}=await db.from('orcamentos')
  .select('id,chamado_id,versao,modalidade,descricao,visita_centavos,servico_centavos,total_centavos,estado,validade,criado_em,respondido_em,observacao_cliente,chamados(numero,descricao,lotericas(nome))')
  .order('criado_em',{ascending:false}).limit(200);
 if(error)throw error;
 let formulario='';
 if(admin){
  const {data:chamados,error:ce}=await db.from('chamados')
   .select('id,numero,status,lotericas(nome)').order('created_at',{ascending:false}).limit(200);
  if(ce)throw ce;
  const bloqueados=new Set(lista.filter(x=>['pendente','aprovado'].includes(x.estado)).map(x=>x.chamado_id));
  const elegiveis=chamados.filter(t=>!bloqueados.has(t.id)&&!['Visita agendada','Em atendimento','Serviço concluído','Nota fiscal emitida'].includes(t.status));
  formulario=`<section class="card"><h2>Enviar orçamento ao cliente</h2><p>O orçamento ficará vinculado ao protocolo selecionado.</p>
   <form id="novo-orcamento"><label>Chamado<select name="p_chamado_id" required><option value="">Selecione o chamado</option>${elegiveis.map(t=>`<option value="${esc(t.id)}">${num(t.numero)} — ${esc(t.lotericas?.nome)}</option>`).join('')}</select></label>
   <label>Modalidade<select name="p_modalidade" id="modalidade-orcamento"><option value="servico">Somente serviço</option><option value="visita">Somente visita técnica</option><option value="combinado">Visita + serviço</option></select></label>
   <label>Descrição do orçamento<textarea name="p_descricao" minlength="8" required placeholder="Descreva o serviço proposto"></textarea></label>
   <label id="bloco-visita" style="display:none">Valor da visita (R$)<input name="visita" type="number" min="0" step="0.01" value="0" required></label>
   <label id="bloco-servico">Valor do serviço (R$)<input name="servico" type="number" min="0" step="0.01" value="0" required></label>
   <label>Validade da proposta<input name="p_validade" type="date" required></label>
   <button ${elegiveis.length?'':'disabled'}>Enviar orçamento</button></form>${elegiveis.length?'':'<p>Nenhum chamado disponível para novo orçamento nesta lista.</p>'}</section>`;
 }
 const cards=lista.map(q=>`<article class="item"><strong>${num(q.chamados?.numero)} — Orçamento v${q.versao}</strong> <span class="status">${esc(estados[q.estado]||q.estado)}</span>
  <div class="meta">${esc(q.chamados?.lotericas?.nome)} • ${esc(modalidades[q.modalidade])} • Enviado em ${date(q.criado_em)}</div>
  <p>${esc(q.descricao)}</p><div class="meta">Visita: ${reais(q.visita_centavos)} • Serviço: ${reais(q.servico_centavos)}</div>
  <h2 style="margin:10px 0">Total: ${reais(q.total_centavos)}</h2>
  <div class="meta">Válido até ${esc(q.validade.split('-').reverse().join('/'))}${q.respondido_em?' • Respondido em '+date(q.respondido_em):''}</div>
  ${q.observacao_cliente?`<p><strong>Observação do cliente:</strong> ${esc(q.observacao_cliente)}</p>`:''}
  ${!admin&&q.estado==='pendente'?(q.validade < new Date().toLocaleDateString('en-CA') ? '<p class="muted">Orçamento vencido. Solicite nova proposta.</p>' : `<div class="acoes-orcamento"><button data-resposta="aprovar" data-id="${esc(q.id)}">Aprovar</button><button class="secondary" data-resposta="recusar" data-id="${esc(q.id)}">Recusar</button><button class="secondary" data-resposta="alteracao" data-id="${esc(q.id)}">Solicitar alteração</button></div>`):''}
  </article>`).join('Nenhum orçamento disponível.');
 target.innerHTML=formulario+`<section class="card"><h2>${admin?'Orçamentos enviados':'Meus orçamentos'}</h2>${cards}</section>`;
 if(admin){
  const form=document.getElementById('novo-orcamento');
  const modo=document.getElementById('modalidade-orcamento');
  const adjust=()=>{document.getElementById('bloco-visita').style.display=modo.value==='servico'?'none':'grid';document.getElementById('bloco-servico').style.display=modo.value==='visita'?'none':'grid';};
  modo.onchange=adjust;adjust();
  form.onsubmit=async ev=>{
   ev.preventDefault();const btn=form.querySelector('button[type=submit],button:not([type])');btn.disabled=true;
   try{const f=new FormData(form);const m=f.get('p_modalidade');
    const params={p_chamado_id:f.get('p_chamado_id'),p_modalidade:m,p_descricao:f.get('p_descricao'),
     p_visita_centavos:m==='servico'?0:moneyToCents(f.get('visita')),
     p_servico_centavos:m==='visita'?0:moneyToCents(f.get('servico')),
     p_validade:f.get('p_validade')};
    const {error}=await db.rpc('criar_orcamento',params);if(error)throw error;
    notice('Orçamento enviado e registrado no banco.');await content();
   }catch(ex){errMsg(ex);}finally{btn.disabled=false;}
  };
 }else{
  target.querySelectorAll('[data-resposta]').forEach(b=>b.onclick=async()=>{
   let observacao=null;
   if(b.dataset.resposta==='alteracao'){
    observacao=prompt('Explique qual alteração deseja no orçamento (mínimo 5 caracteres):');
    if(observacao===null)return;
    if(observacao.trim().length<5){notice('Explique a alteração em pelo menos 5 caracteres.',true);return;}
   }else if(b.dataset.resposta==='recusar'){
    observacao=prompt('Motivo da recusa (opcional):','');if(observacao===null)return;
   }else if(!confirm('Confirma a aprovação deste orçamento e do valor informado?'))return;
   b.disabled=true;
   const {error}=await db.rpc('responder_orcamento',{p_orcamento_id:b.dataset.id,p_resposta:b.dataset.resposta,p_observacao:observacao});
   if(error){errMsg(error);b.disabled=false;return;}
   notice('Resposta registrada com sucesso.');await content();
  });
 }
}

// ETAPA 5 — agenda de visitas vinculadas a orçamento aprovado.
const visitaData = d => new Date(d).toLocaleString('pt-BR', {dateStyle:'short',timeStyle:'short'});
async function visits(target){
 const admin=profile.tipo==='admin';
 const {data:visitas,error:ve}=await db.from('visitas_tecnicas')
  .select('id,chamado_id,data_agendada,observacoes,situacao,criado_em,chamados(numero,status,lotericas(nome))')
  .order('criado_em',{ascending:false}).limit(200);
 if(ve)throw ve;
 let formHtml='';
 if(admin){
  const {data:chamados,error:ce}=await db.from('chamados')
   .select('id,numero,status,lotericas(nome)')
   .in('status',['Orçamento aprovado','Visita agendada'])
   .order('created_at',{ascending:false}).limit(200);
  if(ce)throw ce;
  const choices=chamados.map(c=>`<option value="${esc(c.id)}">${num(c.numero)} — ${esc(c.lotericas?.nome)} (${esc(c.status)})</option>`).join('');
  formHtml=`<section class="card"><h2>Agendar ou reagendar visita</h2><p>É necessário que o cliente já tenha aprovado o orçamento. Ao reagendar, a visita anterior fica no histórico.</p>
  <form id="agendar-visita">
  <label>Chamado<select name="chamado" required><option value="">Escolha um chamado aprovado</option>${choices}</select></label>
  <label>Data e hora da visita<input name="horario" type="datetime-local" required></label>
  <label>Observações para a visita<textarea name="observacoes" maxlength="2000" placeholder="Ex.: procurar o responsável pela unidade"></textarea></label>
  <button type="submit" ${chamados.length?'':'disabled'}>Salvar agendamento</button></form>
  ${chamados.length?'':'<p>Não há chamados aprovados disponíveis para agendar.</p>'}
  </section>`;
 }
 const itens=visitas.map(v=>`<article class="item">
  <strong>${num(v.chamados?.numero)} — ${esc(v.chamados?.lotericas?.nome)}</strong>
  <span class="status">${esc({agendada:'Agendada',reagendada:'Reagendada',cancelada:'Cancelada'}[v.situacao]||v.situacao)}</span>
  <p><strong>Data e hora:</strong> ${visitaData(v.data_agendada)}</p>
  ${v.observacoes?`<p>${esc(v.observacoes)}</p>`:''}
  <div class="meta">Registrada em ${visitaData(v.criado_em)}</div></article>`).join('Nenhuma visita registrada.');
 target.innerHTML=formHtml+`<section class="card"><h2>${admin?'Agenda de visitas':'Minhas visitas técnicas'}</h2>${itens}</section>`;
 if(!admin)return;
 const form=target.querySelector('#agendar-visita');
 form.onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(form), local=String(f.get('horario')||'');
  const instante=new Date(local);
  if(!local||Number.isNaN(instante.getTime())||instante.getTime()<=Date.now()){
   notice('Selecione uma data e hora futuras.',true);return;
  }
  const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
  try{
   const {error}=await db.rpc('agendar_visita',{p_chamado_id:f.get('chamado'),
    p_data_agendada:instante.toISOString(),p_observacoes:String(f.get('observacoes')||'')});
   if(error)throw error;
   notice('Visita agendada no banco de dados.');await content();
  }catch(ex){errMsg(ex);}finally{btn.disabled=false;}
 };
}


// ETAPA 6 — conclusões de serviços e imagens em bucket privado.
const FINAL_BUCKET = 'loteriatech-conclusoes';
const FINAL_MIME = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const UUID_V4 = () => (crypto?.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return (c==='x'?r:(r&3|8)).toString(16);}));
function safeFile(file) {
 if(!file || !file.size) return null;
 if(!FINAL_MIME[file.type]) throw new Error('Use somente fotos JPEG, PNG ou WebP.');
 if(file.size > 5*1024*1024) throw new Error('Cada foto deve ter no máximo 5 MB.');
 return file;
}
async function uploadFinalPhoto(chamadoId,file) {
 if(!file) return null;
 const path=`${chamadoId}/${UUID_V4()}.${FINAL_MIME[file.type]}`;
 const {error}=await db.storage.from(FINAL_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
 if(error) throw error;
 return path;
}
async function completions(target){
 const admin=profile.tipo==='admin';
 const {data:concluidas,error:ce}=await db.from('conclusoes_servico')
  .select('id,chamado_id,descricao_execucao,observacoes,valor_final_centavos,concluido_em,chamados(numero,lotericas(nome))')
  .order('concluido_em',{ascending:false}).limit(200);
 if(ce)throw ce;
 const {data:fotos,error:fe}=await db.from('fotos_conclusao')
  .select('id,conclusao_id,tipo,caminho').limit(400);
 if(fe)throw fe;
 let formHtml='';
 if(admin){
  const {data:chamados,error:te}=await db.from('chamados')
    .select('id,numero,status,lotericas(nome)')
    .in('status',['Orçamento aprovado','Visita agendada','Em atendimento'])
    .order('created_at',{ascending:false}).limit(200);
  if(te)throw te;
  const {data:orcamentos,error:oe}=await db.from('orcamentos')
    .select('chamado_id,versao,estado,total_centavos')
    .in('chamado_id',chamados.map(c=>c.id).length ? chamados.map(c=>c.id) : ['00000000-0000-0000-0000-000000000000'])
    .order('versao',{ascending:false});
  if(oe)throw oe;
  const ultimos=new Map();
  for(const o of orcamentos)if(!ultimos.has(o.chamado_id)) ultimos.set(o.chamado_id,o);
  const elegiveis=chamados.filter(c=>ultimos.get(c.id)?.estado==='aprovado');
  formHtml=`<section class="card"><h2>Concluir serviço técnico</h2>
   <p>O atendimento só poderá ser concluído quando o último orçamento estiver aprovado. O valor final não pode exceder o valor autorizado pelo cliente.</p>
   <form id="form-conclusao">
    <label>Chamado aprovado<select name="chamado" id="conclusao-chamado" required>
     <option value="">Selecione um chamado</option>
     ${elegiveis.map(c=>`<option value="${esc(c.id)}" data-limite="${ultimos.get(c.id).total_centavos}">${num(c.numero)} — ${esc(c.lotericas?.nome)} (${reais(ultimos.get(c.id).total_centavos)})</option>`).join('')}
    </select></label>
    <div class="meta" id="limite-conclusao">Selecione um chamado para ver o valor aprovado.</div>
    <label>Serviço executado<textarea name="descricao" minlength="10" maxlength="3000" required placeholder="Descreva o que foi feito"></textarea></label>
    <label>Valor final (R$)<input name="valor" type="number" min="0" step="0.01" required placeholder="180.00"></label>
    <label>Observações (opcional)<textarea name="observacoes" maxlength="2000" placeholder="Informações adicionais sobre o atendimento"></textarea></label>
    <label>Foto antes (opcional, até 5 MB)<input name="antes" type="file" accept="image/jpeg,image/png,image/webp"></label>
    <label>Foto depois (opcional, até 5 MB)<input name="depois" type="file" accept="image/jpeg,image/png,image/webp"></label>
    <button type="submit" ${elegiveis.length?'':'disabled'}>Registrar conclusão</button>
   </form>${elegiveis.length?'':'<p class="muted">Nenhum chamado aprovado disponível para conclusão.</p>'}</section>`;
 }
 const cards=concluidas.map(c=>{
  const fs=fotos.filter(f=>f.conclusao_id===c.id);
  return `<article class="item"><strong>${num(c.chamados?.numero)} — ${esc(c.chamados?.lotericas?.nome)}</strong>
   <span class="status">Serviço concluído</span>
   <div class="meta">Concluído em ${date(c.concluido_em)}</div>
   <p><strong>Serviço realizado:</strong> ${esc(c.descricao_execucao)}</p>
   ${c.observacoes?`<p><strong>Observações:</strong> ${esc(c.observacoes)}</p>`:''}
   <p><strong>Valor final:</strong> ${reais(c.valor_final_centavos)}</p>
   ${fs.length?`<div class="acoes-orcamento">${fs.map(f=>`<button class="secondary" type="button" data-foto="${esc(f.id)}">Ver foto ${f.tipo==='antes'?'antes':'depois'}</button>`).join('')}</div>`:'<p class="meta">Sem fotos anexadas.</p>'}
  </article>`;
 }).join('Nenhum serviço concluído até o momento.');
 target.innerHTML=formHtml+`<section class="card"><h2>${admin?'Histórico de serviços concluídos':'Meus serviços concluídos'}</h2>${cards}</section>`;
 target.querySelectorAll('[data-foto]').forEach(btn=>btn.onclick=async()=>{
  const foto=fotos.find(f=>f.id===btn.dataset.foto);
  if(!foto)return;
  btn.disabled=true;
  const {data,error}=await db.storage.from(FINAL_BUCKET).createSignedUrl(foto.caminho,120);
  btn.disabled=false;
  if(error)return errMsg(error);
  window.open(data.signedUrl,'_blank','noopener,noreferrer');
 });
 if(!admin)return;
 const form=target.querySelector('#form-conclusao');
 const sel=form.querySelector('#conclusao-chamado');
 sel.onchange=()=>{const opt=sel.selectedOptions[0];
  target.querySelector('#limite-conclusao').textContent=opt?.dataset?.limite
   ?`Total aprovado: ${reais(Number(opt.dataset.limite))}`:'Selecione um chamado para ver o valor aprovado.';};
 form.onsubmit=async e=>{
  e.preventDefault();const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
  try{
   const f=new FormData(form),id=String(f.get('chamado'));
   const limite=Number(sel.selectedOptions[0]?.dataset?.limite);
   const valor=moneyToCents(f.get('valor'));
   if(!id||!Number.isFinite(limite)||valor>limite)throw new Error('Valor final não pode exceder o orçamento aprovado. Envie nova proposta para cobranças adicionais.');
   const antes=safeFile(f.get('antes')),depois=safeFile(f.get('depois'));
   if(!confirm(`Registrar conclusão no valor de ${reais(valor)}? Esta operação será definitiva.`))return;
   notice('Enviando fotos e registrando conclusão...');
   const pAntes=await uploadFinalPhoto(id,antes);
   const pDepois=await uploadFinalPhoto(id,depois);
   const {error}=await db.rpc('concluir_servico',{
    p_chamado_id:id,p_descricao:String(f.get('descricao')),
    p_observacoes:String(f.get('observacoes')||''),p_valor_final_centavos:valor,
    p_foto_antes:pAntes,p_foto_depois:pDepois
   });
   if(error)throw error;
   notice('Serviço concluído! Registro e valor final salvos no banco.');
   await content();
  }catch(ex){errMsg(ex);}finally{btn.disabled=false;}
 };
}


// ETAPA 6.1 — Cadastro de logins pela API administrativa segura.
// A senha é enviada apenas à Edge Function e não é armazenada no navegador.
async function usersPanel(target){
 if(profile.tipo!=='admin') return;
 const [{data:branches,error:be},{data:profiles,error:pe}]=await Promise.all([
   db.from('lotericas').select('id,nome,email,ativa').order('nome'),
   db.from('perfis').select('id,nome,tipo,loterica_id,ativo').eq('tipo','cliente').order('created_at',{ascending:false})
 ]);
 if(be||pe)throw be||pe;
 target.innerHTML=`<div class="grid"><section class="card"><h2>Criar acesso de lotérico</h2>
 <p>Escolha a lotérica já cadastrada. O e-mail será preenchido automaticamente, mas você poderá corrigi-lo. Defina uma senha inicial forte e entregue-a por um canal privado.</p>
 <form id="cadastrar-acesso">
  <label>Lotérica<select name="loterica_id" required><option value="">Selecione uma lotérica</option>${branches.filter(b=>b.ativa).map(b=>`<option value="${esc(b.id)}">${esc(b.nome)}</option>`).join('')}</select></label>
  <label>Nome do usuário<input name="nome" autocomplete="off" required minlength="2" maxlength="120" placeholder="Responsável pela lotérica"></label>
  <label>E-mail de acesso<input name="email" type="email" autocomplete="off" required maxlength="254"></label>
  <label>Senha inicial<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>
  <label>Confirmar senha<input name="confirmar" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>
  <button type="submit">Criar usuário e senha</button>
 </form>
 <p class="meta">A senha não poderá ser consultada depois. O cliente poderá usar a recuperação de senha para trocá-la.</p></section>
 <section class="card"><h2>Usuários de lotéricas (${profiles.length})</h2>
 ${profiles.map(u=>`<div class="item"><strong>${esc(u.nome)}</strong> <span class="status">${u.ativo?'Ativo':'Bloqueado'}</span><div class="meta">${esc(branches.find(b=>b.id===u.loterica_id)?.nome||'Lotérica não encontrada')}</div><div class="meta">Identificador: ${esc(u.id)}</div></div>`).join('Nenhum usuário vinculado.')}<p class="meta">Bloqueio, redefinição administrativa de senha e múltiplos usuários por lotérica serão configurados em versões futuras.</p></section></div>`;
 const form=target.querySelector('#cadastrar-acesso');
 const branchSelect=form.elements.namedItem('loterica_id');
 branchSelect.onchange=()=>{
   const branch=branches.find(b=>b.id===branchSelect.value);
   form.elements.namedItem('email').value=branch?.email||'';
   form.elements.namedItem('nome').value=branch?.nome||'';
 };
 form.onsubmit=async e=>{
   e.preventDefault();
   const f=new FormData(form);
   const password=String(f.get('password')||'');
   if(password.length<12){notice('Use uma senha com pelo menos 12 caracteres.',true);return;}
   if(password!==String(f.get('confirmar'))){notice('As duas senhas precisam ser iguais.',true);return;}
   const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
   try{
     const {data,error}=await db.functions.invoke('criar-usuario-loterica',{body:{
       loterica_id:String(f.get('loterica_id')),nome:String(f.get('nome')).trim(),
       email:String(f.get('email')).trim().toLowerCase(),password
     }});
     if(error){
       let msg=error.message;
       try{const json=await error.context?.json();if(json?.error)msg=json.error;}catch{}
       throw Error(msg);
     }
     if(!data?.ok)throw Error(data?.error||'Não foi possível criar usuário.');
     form.reset();notice('Usuário criado e vinculado à lotérica! Entregue a senha inicial por canal privado e teste o login.');
     await content();
   }catch(ex){errMsg(ex);}finally{btn.disabled=false;}
 };
}

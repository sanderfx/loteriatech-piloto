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
function render(){let admin=profile.tipo==='admin';document.getElementById('userbar').innerHTML=`<span>${esc(profile.nome)} • ${admin?'Administrador':'Lotérica'}</span><button class="secondary" id="sair">Sair</button>`;document.getElementById('sair').onclick=logout;const tabs=admin?['inicio','chamados','orcamentos','visitas','lotericas','categorias']:['inicio','abrir','chamados','orcamentos','visitas'];const names={inicio:'Início',abrir:'Abrir chamado',chamados:'Chamados',orcamentos:'Orçamentos',visitas:'Visitas técnicas',lotericas:'Lotéricas',categorias:'Categorias'};app.innerHTML=`<h1>${admin?'Painel administrativo':'Área da lotérica'}</h1><p>Olá, ${esc(profile.nome)}. Acompanhe os serviços da LoteriaTech.</p><nav>${tabs.map(t=>`<button data-tab="${t}" class="${t===tab?'active':''}">${names[t]}</button>`).join('')}</nav><div id="content"></div>`;document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>{tab=el.dataset.tab;render();});content();}
async function content(){const target=document.getElementById('content');target.innerHTML='<div class="card">Carregando...</div>';try{if(tab==='inicio')await home(target);if(tab==='chamados')await tickets(target);if(tab==='orcamentos')await quotes(target);if(tab==='visitas')await visits(target);if(tab==='lotericas')await branches(target);if(tab==='categorias')await categories(target);if(tab==='abrir')await newTicket(target);}catch(e){errMsg(e);target.innerHTML='<div class="card">Não foi possível carregar esta seção.</div>';}}
async function home(target){let {data,error}=await db.from('chamados').select('id,status,numero,created_at').order('created_at',{ascending:false}).limit(300);if(error)throw error;const open=data.filter(x=>x.status!=='Serviço concluído'&&x.status!=='Nota fiscal emitida');target.innerHTML=`<div class="grid"><div class="card"><h2>Total de chamados</h2><h1>${data.length}${data.length===300?'+':''}</h1></div><div class="card"><h2>Em aberto</h2><h1>${open.length}${data.length===300?'+':''}</h1></div><div class="card"><h2>Concluídos</h2><h1>${data.filter(x=>['Serviço concluído','Nota fiscal emitida'].includes(x.status)).length}${data.length===300?'+':''}</h1></div></div><div class="card"><h2>Últimos chamados</h2>${data.slice(0,5).map(t=>`<div class="item"><strong>#${num(t.numero)}</strong> <span class="status">${esc(t.status)}</span><div class="meta">${date(t.created_at)}</div></div>`).join('Nenhum chamado até o momento.')}</div>`;}
async function branches(target){if(profile.tipo!=='admin')return;const {data,error}=await db.from('lotericas').select('*').order('created_at',{ascending:false});if(error)throw error;target.innerHTML=`<div class="grid"><section class="card"><h2>Cadastrar lotérica</h2><form id="branch"><label>Nome da lotérica<input name="nome" required minlength="2"></label><label>Responsável<input name="responsavel"></label><label>Telefone<input name="telefone"></label><label>E-mail<input type="email" name="email"></label><label>Endereço<input name="endereco"></label><label>Bairro<input name="bairro"></label><label>Cidade<input name="cidade"></label><label>UF<input name="uf" maxlength="2"></label><button>Cadastrar</button></form></section><section class="card"><h2>Lotéricas cadastradas (${data.length})</h2>${data.map(b=>`<div class="item"><strong>${esc(b.nome)}</strong><div class="meta">${esc(b.cidade)} / ${esc(b.uf)} • ${esc(b.telefone)}</div><div class="meta">ID para vincular usuário: <code>${esc(b.id)}</code></div></div>`).join('Nenhuma lotérica.')}</section></div>`;document.getElementById('branch').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const {error}=await db.from('lotericas').insert(f);if(error)return errMsg(error);notice('Lotérica cadastrada. Para criar login, siga o guia do Supabase.');content();};}
async function categories(target){const {data,error}=await db.from('categorias').select('*').order('nome');if(error)throw error;target.innerHTML=`<div class="grid"><div class="card"><h2>Nova categoria</h2><form id="category"><label>Nome<input name="nome" minlength="3" required></label><button>Adicionar</button></form></div><div class="card"><h2>Categorias</h2>${data.map(c=>`<div class="item">${esc(c.nome)}</div>`).join('Sem categorias')}</div></div>`;document.getElementById('category').onsubmit=async e=>{e.preventDefault();const nome=new FormData(e.target).get('nome').trim();const {error}=await db.from('categorias').insert({nome});if(error)return errMsg(error);notice('Categoria adicionada.');content();};}
async function newTicket(target){const {data:cats,error:e1}=await db.from('categorias').select('id,nome').eq('ativa',true).order('nome');const {data:branch,error:e2}=await db.from('lotericas').select('*').eq('id',profile.loterica_id).single();if(e1||e2)throw e1||e2;target.innerHTML=`<div class="card"><h2>Abrir chamado técnico</h2><p>Lotérica: ${esc(branch.nome)}</p><form id="ticket"><label>Categoria<select name="categoria_id" required><option value="">Selecione</option>${cats.map(c=>`<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></label><label>Descreva o problema<textarea name="descricao" required minlength="8"></textarea></label><label>Telefone de contato<input name="contato_telefone" value="${esc(branch.telefone)}" required></label><label>Endereço do atendimento<input name="endereco_atendimento" value="${esc(branch.endereco)}" required></label><label>Bairro<input name="bairro" value="${esc(branch.bairro)}"></label><label>Cidade<input name="cidade" value="${esc(branch.cidade)}"></label><button>Enviar chamado</button></form><p class="muted">Fotos e anexos serão implementados na próxima etapa.</p></div>`;document.getElementById('ticket').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.loterica_id=profile.loterica_id;f.criado_por=user.id;const {data,error}=await db.from('chamados').insert(f).select('numero').single();if(error)return errMsg(error);notice(`Chamado registrado! Protocolo #${num(data.numero)}`);tab='chamados';render();};}
async function tickets(target){const admin=profile.tipo==='admin';const {data,error}=await db.from('chamados').select('id,numero,loterica_id,descricao,status,created_at,contato_telefone,endereco_atendimento,bairro,cidade,categorias(nome),lotericas(nome)').order('created_at',{ascending:false}).limit(200);if(error)throw error;target.innerHTML=`<div class="card"><h2>Chamados (${data.length}${data.length===200?'+':''})</h2>${data.map(t=>`<article class="item"><strong>#${num(t.numero)}</strong> <span class="status">${esc(t.status)}</span><div class="meta">${esc(t.lotericas?.nome)} • ${esc(t.categorias?.nome)} • ${date(t.created_at)}</div><p>${esc(t.descricao)}</p><div class="meta">${esc(t.endereco_atendimento)} • ${esc(t.bairro)} • ${esc(t.cidade)} • ${esc(t.contato_telefone)}</div>${admin?`<label>Alterar status<select data-ticket="${t.id}">${statusList.filter(s=>['Novo chamado','Visita agendada','Em atendimento','Serviço concluído','Nota fiscal emitida',t.status].includes(s)).map(s=>`<option ${s===t.status?'selected':''}>${esc(s)}</option>`).join('')}</select></label>`:''}</article>`).join('Nenhum chamado encontrado.')}</div>`;if(admin)target.querySelectorAll('[data-ticket]').forEach(select=>select.onchange=async()=>{const {error}=await db.from('chamados').update({status:select.value}).eq('id',select.dataset.ticket);if(error)return errMsg(error);notice('Status atualizado.');content();});}
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

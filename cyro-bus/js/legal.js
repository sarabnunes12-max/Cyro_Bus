/* =====================================================================
   CYRO BUS — Termos de Uso e Política de Privacidade
   Os textos descrevem o que o aplicativo REALMENTE faz (LGPD — Lei nº 13.709/2018).
   Para usar em produção/oficialmente, recomenda-se revisão jurídica.

   >>> Edite o objeto abaixo antes de publicar: <<<
   ===================================================================== */
const CYRO_LEGAL = {
  responsavel: 'Equipe do projeto Cyro Bus',   // nome da pessoa/instituição responsável
  contato: '',                                  // e-mail de contato (ex.: 'contato@seudominio.com.br'); vazio = não exibe
  atualizado: 'novembro de 2026',
  versao: '1.0'
};

const _contato = () => CYRO_LEGAL.contato
  ? `<p><b>Contato do responsável:</b> <a href="mailto:${CYRO_LEGAL.contato}">${CYRO_LEGAL.contato}</a></p>` : '';

const LEGAL_DOCS = {
  termos: {
    title: 'Termos de Uso',
    html: () => `
<h2>Termos de Uso</h2>
<div class="callout"><b>Resumo:</b> o Cyro Bus é um <b>protótipo (MVP)</b> para consultar linhas de ônibus de Valinhos (SP). Os horários, trajetos e a posição dos ônibus são <b>demonstrativos</b> e <b>não substituem</b> as informações oficiais da Prefeitura de Valinhos e da SOU Valinhos.</div>

<h3>1. Aceitação</h3>
<p>Ao criar uma conta ou usar o aplicativo, você declara que leu e concorda com estes Termos e com a Política de Privacidade. Se não concordar, não utilize o serviço. Você pode usar o modo <b>visitante</b>, sem criar conta.</p>

<h3>2. O que é o Cyro Bus</h3>
<p>Aplicativo web informativo que reúne linhas de ônibus municipais de Valinhos, horários, mapa, busca de destinos (mercados, farmácias, hospitais etc.) e um assistente de suporte. <b>Não é um serviço oficial</b> e não tem vínculo, parceria ou autorização da Prefeitura de Valinhos, da SOU Valinhos ou de qualquer operadora de transporte.</p>

<h3>3. Natureza dos dados e da simulação</h3>
<ul>
  <li><b>Linhas e nomes de destino</b> foram baseados em levantamento do projeto sobre a lista de linhas municipais; as linhas marcadas como "itinerário a validar" ainda não foram conferidas.</li>
  <li><b>Horários</b> são demonstrativos. Confirme sempre os horários oficiais com a Prefeitura ou a SOU Valinhos antes de se programar.</li>
  <li><b>Trajetos no mapa</b> são aproximados e não representam, rua por rua, o caminho real dos ônibus.</li>
  <li><b>Posição dos ônibus</b> é uma <b>simulação</b> calculada a partir dos horários e de uma velocidade estimada. <b>Não é GPS</b> e não é rastreamento em tempo real. O aviso "Localização simulada — recurso demonstrativo do MVP" aparece nas telas correspondentes.</li>
  <li>A função "Simular ônibus quebrado" é apenas uma demonstração; nenhuma ocorrência real é registrada ou informada.</li>
  <li><b>Locais</b> (mercados, farmácias, hospitais etc.) têm endereços do levantamento do projeto e posições aproximadas no mapa; itens marcados "a validar" ou "exemplo" não são confirmados.</li>
</ul>

<h3>4. Conta e segurança</h3>
<ul>
  <li>Para criar conta é preciso informar nome, e-mail válido e senha. Use dados verdadeiros e mantenha sua senha em sigilo.</li>
  <li>O serviço é destinado a maiores de 13 anos. Adolescentes devem usá-lo com a ciência de um responsável. Não é direcionado a crianças.</li>
  <li>Você é responsável pelas atividades feitas com a sua conta. Em caso de suspeita de acesso indevido, altere a senha em <b>Perfil → Segurança</b>.</li>
</ul>

<h3>5. Uso adequado</h3>
<p>É proibido: tentar acessar contas ou dados de outras pessoas; sobrecarregar, atacar ou tentar burlar a segurança do serviço; usar o assistente para fins ilícitos; ou copiar o serviço de forma automatizada em larga escala. Não envie ao assistente dados pessoais sensíveis (documentos, senhas, dados de saúde ou financeiros).</p>

<h3>6. Assistente de suporte (IA)</h3>
<p>O assistente usa os dados do aplicativo para responder dúvidas sobre linhas e horários. Ele <b>pode errar</b>. Trate as respostas como informação de apoio e confirme nos canais oficiais. Quando o servidor de IA não está disponível, o aplicativo usa um assistente local, que responde no próprio navegador.</p>

<h3>7. Serviços de terceiros</h3>
<p>O aplicativo usa serviços externos, cada um com seus próprios termos: mapas © colaboradores do OpenStreetMap e CARTO; clima da Open-Meteo; autenticação e banco de dados do Google Firebase; e, quando ativo, o modelo de IA da Groq. Veja os detalhes na Política de Privacidade.</p>

<h3>8. Propriedade intelectual</h3>
<p>O código, o design e a marca "Cyro Bus" pertencem aos responsáveis pelo projeto. Dados e mapas de terceiros pertencem aos seus titulares e seguem as respectivas licenças.</p>

<h3>9. Disponibilidade e limitação de responsabilidade</h3>
<p>O serviço é oferecido "como está", em fase de demonstração, sem garantia de funcionamento contínuo, exatidão ou atualização das informações. Na máxima extensão permitida em lei, os responsáveis não respondem por perdas decorrentes de atrasos, horários desatualizados, trajetos aproximados ou indisponibilidade, <b>sem prejuízo dos direitos do consumidor previstos em lei</b>.</p>

<h3>10. Encerramento</h3>
<p>Você pode parar de usar o serviço e <b>excluir sua conta</b> a qualquer momento em <b>Perfil → Zona de risco</b>. Contas podem ser suspensas em caso de abuso ou violação destes Termos.</p>

<h3>11. Alterações</h3>
<p>Estes Termos podem ser atualizados. A data da última atualização aparece no rodapé desta janela; o uso continuado após mudanças indica concordância com a nova versão.</p>

<h3>12. Lei aplicável</h3>
<p>Estes Termos são regidos pelas leis do Brasil. Quando houver relação de consumo, fica garantido o foro do domicílio do usuário.</p>
${_contato()}`
  },

  privacidade: {
    title: 'Política de Privacidade',
    html: () => `
<h2>Política de Privacidade</h2>
<div class="callout"><b>Em resumo:</b> coletamos o mínimo para o app funcionar. <b>Não vendemos seus dados</b>, não usamos publicidade e não usamos ferramentas de análise ou rastreamento de marketing. Sua localização <b>não é enviada nem guardada</b> por nós. Você pode corrigir, baixar e excluir seus dados no <b>Perfil</b>.</div>

<h3>1. Quem é o responsável</h3>
<p>O Cyro Bus é um protótipo (MVP) de consulta a linhas de ônibus de Valinhos (SP). O responsável pelo tratamento dos dados (controlador, nos termos da LGPD — Lei nº 13.709/2018) é: <b>${CYRO_LEGAL.responsavel}</b>.</p>
${_contato()}

<h3>2. Quais dados tratamos e para quê</h3>
<table>
  <tr><th>Dado</th><th>Para quê</th><th>Onde fica</th></tr>
  <tr><td><b>Nome, e-mail e senha</b> (ao criar conta)</td><td>Criar e acessar sua conta</td><td>Google Firebase Authentication. A senha é tratada pelo Firebase; <b>não temos acesso a ela em texto</b>.</td></tr>
  <tr><td><b>Nome de exibição e rotas favoritas</b></td><td>Lembrar suas preferências entre dispositivos</td><td>Banco Firestore (Google), em um documento ligado ao seu usuário. As regras permitem que só você leia e altere o seu documento.</td></tr>
  <tr><td><b>Localização do aparelho</b></td><td>Mostrar "você está aqui" no mapa</td><td>Só quando você toca em "Localização" e autoriza no navegador. É usada <b>apenas no seu aparelho</b>; o Cyro Bus não envia nem guarda.</td></tr>
  <tr><td><b>Mensagens ao assistente</b></td><td>Gerar a resposta</td><td>Se o servidor de IA estiver ativo, o texto vai ao nosso servidor e à Groq para gerar a resposta; <b>não gravamos o histórico</b>. Sem servidor, a resposta é gerada no navegador.</td></tr>
  <tr><td><b>Preferências</b> (tema, tamanho do texto, contraste)</td><td>Personalizar a aparência</td><td>Armazenamento local do navegador; não saem do aparelho.</td></tr>
  <tr><td><b>Dados técnicos de conexão</b> (IP, navegador)</td><td>Entregar mapas, clima e arquivos do site</td><td>Recebidos automaticamente pelos serviços de terceiros listados abaixo.</td></tr>
</table>
<p><b>Modo visitante:</b> não cria conta e <b>nada é gravado</b> em servidor; os favoritos existem só na aba aberta.</p>

<h3>3. Com quem os dados podem ser compartilhados</h3>
<ul>
  <li><b>Google Firebase</b> (autenticação e banco de dados) e, conforme a publicação, a hospedagem do site (GitHub Pages, Netlify, Firebase Hosting ou similar).</li>
  <li><b>Groq</b> — somente o texto das perguntas ao assistente, quando a IA online estiver ativa.</li>
  <li><b>CARTO e OpenStreetMap</b> — seu navegador baixa os blocos do mapa e, por isso, esses serviços veem seu IP.</li>
  <li><b>Open-Meteo</b> — consulta de clima; enviamos apenas as coordenadas fixas de Valinhos, nunca a sua localização.</li>
  <li><b>unpkg</b> — entrega a biblioteca de mapas (Leaflet).</li>
</ul>
<p>Não vendemos, alugamos nem cedemos dados para publicidade. Alguns desses provedores ficam fora do Brasil; nesses casos, a transferência internacional ocorre para a execução do serviço, conforme o art. 33 da LGPD.</p>

<h3>4. Cookies e armazenamento local</h3>
<p>Não usamos cookies de publicidade nem de análise. O navegador guarda, localmente, a sessão de login (Firebase) e suas preferências de aparência. Você pode apagá-las nas configurações do navegador ou em <b>Configurações → Privacidade e dados → Limpar preferências</b>.</p>

<h3>5. Base legal</h3>
<p>Tratamos dados com base no seu <b>consentimento</b> (art. 7º, I) e na <b>execução do serviço que você solicitou</b>, como manter sua conta e favoritos (art. 7º, V). Você pode revogar o consentimento a qualquer momento excluindo a conta.</p>

<h3>6. Por quanto tempo guardamos</h3>
<p>Enquanto sua conta existir. Ao excluir a conta, apagamos o documento do Firestore e o usuário do Firebase Authentication. Cópias de segurança dos provedores podem levar um curto período para ser removidas.</p>

<h3>7. Seus direitos (art. 18 da LGPD)</h3>
<ul>
  <li><b>Confirmação e acesso</b> aos seus dados — em <b>Perfil</b> e em <b>Baixar meus dados</b>;</li>
  <li><b>Correção</b> de dados incompletos ou desatualizados — edite seu nome no <b>Perfil</b>;</li>
  <li><b>Portabilidade</b> — o botão <b>Baixar meus dados</b> gera um arquivo para você;</li>
  <li><b>Eliminação</b> dos dados tratados com consentimento — <b>Perfil → Zona de risco → Excluir minha conta</b>;</li>
  <li><b>Informação</b> sobre compartilhamento (seção 3) e sobre a possibilidade de não consentir;</li>
  <li><b>Revogação do consentimento</b>, sem prejuízo do tratamento feito antes.</li>
</ul>
<p>Se precisar de ajuda para exercer seus direitos, use o contato acima. Você também pode fazer uma reclamação à <b>Autoridade Nacional de Proteção de Dados (ANPD)</b>.</p>

<h3>8. Segurança</h3>
<p>Usamos conexão segura (HTTPS), autenticação do Firebase e regras do Firestore que isolam os dados de cada usuário; a chave do Groq fica apenas no servidor, nunca no navegador. Nenhum sistema é totalmente imune a falhas; em caso de incidente relevante, os afetados serão informados conforme a LGPD.</p>

<h3>9. Crianças e adolescentes</h3>
<p>O serviço não é direcionado a crianças. Adolescentes devem usá-lo com a ciência de um responsável. Se identificarmos dados de uma criança sem a autorização exigida, eles serão excluídos.</p>

<h3>10. Mudanças nesta política</h3>
<p>Podemos atualizar este texto quando o aplicativo mudar. A data da última atualização aparece no rodapé desta janela.</p>`
  }
};

let _legalFocus = null;
function openLegal(doc) {
  const m = document.getElementById('legal-modal');
  if (!m) return;
  _legalFocus = document.activeElement;
  const d = LEGAL_DOCS[doc] || LEGAL_DOCS.termos;
  document.getElementById('legal-body').innerHTML = d.html();
  document.getElementById('legal-body').scrollTop = 0;
  document.getElementById('legal-updated').textContent = `Última atualização: ${CYRO_LEGAL.atualizado} · versão ${CYRO_LEGAL.versao}`;
  m.querySelectorAll('.modal-tabs button').forEach(b => {
    const on = b.dataset.doc === (LEGAL_DOCS[doc] ? doc : 'termos');
    b.classList.toggle('active', on); b.setAttribute('aria-selected', on);
  });
  m.hidden = false;
  m.querySelector('.modal-card').focus();
}
function closeLegal() {
  const m = document.getElementById('legal-modal');
  if (m) m.hidden = true;
  if (_legalFocus && _legalFocus.focus) _legalFocus.focus();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLegal(); });
document.addEventListener('click', e => { if (e.target && e.target.id === 'legal-modal') closeLegal(); });

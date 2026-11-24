# Como publicar o Cyro Bus

O site é **estático** (HTML + CSS + JS) e fica na **raiz** da pasta. Escolha UMA das opções abaixo.
Em qualquer uma, faça também o **checklist do Firebase** (seção final), senão o login não funciona.

---
## Opção A — GitHub Pages
1. Crie um repositório no GitHub (ex.: `cyro-bus`).
2. Envie **todo o conteúdo** desta pasta para a **raiz** do repositório (`index.html`, `css/`, `js/`, `assets/`, `backend/`...).
   Pelo site: *Add file → Upload files*, arraste os arquivos e pastas **de dentro** de `cyro-bus/` (não a pasta `cyro-bus` em si).
3. *Settings → Pages → Source: Deploy from a branch → Branch `main` → Folder `/ (root)`* → Save.
4. Aguarde 1–2 min e abra `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

## Opção B — Netlify (a mais fácil, sem Git)
1. Acesse **app.netlify.com/drop** (crie conta grátis).
2. Use o arquivo **`cyro-bus-site.zip`** (só o site): descompacte e **arraste a pasta** para a página.
3. Em segundos você recebe um endereço `https://nome-aleatorio.netlify.app` (dá para renomear em *Site settings*).

## Opção C — Firebase Hosting (mesmo projeto do login)
```bash
npm install -g firebase-tools
firebase login
firebase use cyro-bus-c527b        # id do seu projeto
firebase deploy                    # publica o site e as regras do Firestore
```
O endereço `https://cyro-bus-c527b.web.app` já vem autorizado no Firebase Authentication.

## Opção D — Cloudflare Pages ou Vercel
Conecte o repositório, **sem comando de build**, diretório de saída `/` (raiz).

---
## Assistente de IA online (opcional)
Hospedagens estáticas **não rodam o backend**: o assistente funciona no **modo local** (etiqueta "Assistente local").
Para a IA online: publique a pasta `backend/` no **Render** (use o `render.yaml`; defina `GROQ_API_KEY` no painel) e,
no site, edite `js/config.js` descomentando `window.CYRO_API_BASE = 'https://SEU-BACKEND.onrender.com';`.

## Checklist do Firebase (obrigatório para login)
- [ ] *Authentication → Sign-in method*: **E-mail/senha** ativado.
- [ ] *Authentication → Settings → Authorized domains*: adicione o domínio do seu site (`usuario.github.io`, `xxx.netlify.app`...).
- [ ] *Firestore Database* criado e **regras** de `firestore.rules` publicadas.
- [ ] (recomendado) *Google Cloud → Credenciais*: restrinja a chave de API ao seu domínio.

## Antes de divulgar
- [ ] `js/legal.js`: preencha **responsável** e **e-mail de contato**.
- [ ] Substitua os dados demonstrativos pelos oficiais, se for chamar de "oficial".

## Problemas comuns
| Sintoma | Causa e solução |
|---|---|
| Página **sem estilo** | As pastas `css/` e `js/` não estão ao lado do `index.html`. Reenvie o conteúdo na raiz. |
| Login: "endereço não autorizado" | Falta o domínio em *Authorized domains*. |
| Login: "sem permissão" | Publique `firestore.rules`. |
| Assistente diz "Assistente local" | Normal sem backend. Veja "Assistente de IA online". |
| Mapa em branco | Sem internet ou bloqueio dos servidores de mapa (CARTO/OpenStreetMap). |
| Página abre mas nada funciona ao dar duplo clique | Abra por HTTP/hospedagem, não por `file://`. |

# Cyro Bus

**Transporte inteligente de Valinhos (SP):** consulte linhas, horários e o mapa dos ônibus, descubra qual linha
pegar para chegar a mercados, farmácias, hospitais e outros locais, e acompanhe um ônibus em **tempo real simulado**.

> **Protótipo (MVP).** Não é um serviço oficial da Prefeitura de Valinhos nem da SOU Valinhos.
> Horários e trajetos são **demonstrativos** e a posição dos ônibus é **simulada (não é GPS)**. A tela avisa isso.

## O que o aplicativo faz

| Área | Recursos |
|---|---|
| **Início** | Avisos importantes · busca "Para onde você quer ir?" (locais + linhas próximas) · acesso rápido · clima de Valinhos em tempo real (Open-Meteo) · próxima saída · horários rápidos · favoritos |
| **Mapa** | Escolha uma linha e veja o trajeto e os ônibus em circulação **agora**, com progresso, próxima parada, pontos de referência e estabelecimentos próximos · relógio de simulação (1×/5×/20×/60×) · **aviso de ônibus quebrado com rota alternativa** |
| **Linhas e Horários** | 28 linhas cadastradas (15 com nome oficial) · horários por dia (seg–sex, sábado, domingo/feriado) · favoritos |
| **Assistente** | IA online (Groq) com **assistente local de reserva**: responde mesmo sem servidor/internet |
| **Perfil** | Alterar nome · **alterar senha** · "esqueci minha senha" · baixar meus dados · excluir minha conta |
| **Configurações** | Tema claro/escuro · **tamanho do texto** (normal, grande, extra grande) · alto contraste · **Termos de Uso e Política de Privacidade (LGPD)** |

## Estrutura do projeto

```
cyro-bus/
├── index.html            ← o site (abra a partir daqui)
├── css/style.css         ← visual (temas claro/escuro, acessibilidade)
├── js/
│   ├── app.js            ← telas, favoritos, acessibilidade, perfil
│   ├── auth.js           ← login, cadastro, senha, exclusão (Firebase)
│   ├── map.js            ← mapa, simulação em tempo real, painel de viagem
│   ├── places.js         ← locais e busca de destinos
│   ├── data.js           ← linhas, horários e avisos
│   ├── assistant.js      ← assistente (IA online + local)
│   ├── weather.js        ← clima (Open-Meteo)
│   ├── legal.js          ← Termos de Uso e Política de Privacidade
│   ├── firebase-config.js, config.js, pois-geo.js
├── assets/               ← ícone do site
├── backend/              ← (opcional) servidor Node: proxy seguro da IA + serve o site
├── documentacao/
│   ├── COMO-PUBLICAR.md  ← passo a passo (GitHub Pages, Netlify, Firebase, Render)
│   └── ROTEIRO-APRESENTACAO.md
├── firestore.rules       ← regras de segurança do banco
├── firebase.json · netlify.toml · render.yaml · .nojekyll
```

## Como rodar

**Só o site (sem IA online):** sirva a pasta por HTTP, por exemplo `python -m http.server 8000`, e abra
`http://localhost:8000`. (Não abra o `index.html` com duplo clique: o login usa módulos do navegador, que exigem HTTP.)

**Site + assistente de IA:**
```bash
cd backend
npm install
cp .env.example .env     # cole sua GROQ_API_KEY
npm start                # http://localhost:3001
```

## Publicar

Veja **`documentacao/COMO-PUBLICAR.md`**. Resumo: o site é estático e fica na raiz do repositório; funciona no GitHub Pages,
Netlify (arrastando a pasta) ou Firebase Hosting. O backend é opcional (só para a IA online).

## Antes de publicar oficialmente

1. Edite `js/legal.js`: **responsável** e **e-mail de contato** (aparecem nos Termos e na Política).
2. No Firebase: ative *E-mail/senha*, publique `firestore.rules` e adicione o domínio do site em *Authorized domains*.
3. Troque os dados demonstrativos (`js/data.js`, `js/places.js`) pelos oficiais da Prefeitura/SOU Valinhos.
4. Revise os textos legais com um profissional, se o uso for comercial ou institucional.

## Dados e limites (MVP)

- **Linhas:** nomes/destinos conforme lista da Prefeitura levantada pelo projeto; as demais ficam "a validar". **Horários demonstrativos.**
- **Locais:** endereços do levantamento (mercados, farmácias, saúde, shoppings); posições no mapa aproximadas; itens "a validar"/"exemplo" não são confirmados.
- **Simulação:** cada horário da tabela é uma saída do Terminal; o ônibus anda a ~20 km/h com paradas. Configurável em `SIM` (`js/map.js`).
- **Para dados reais:** itinerário por rua (GTFS) e coordenadas geocodificadas (`js/pois-geo.js`).

## Créditos

Mapa © colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright) e [CARTO](https://carto.com/attributions) · Leaflet ·
Clima: [Open-Meteo](https://open-meteo.com) · Autenticação e banco: Google Firebase · IA: Groq.

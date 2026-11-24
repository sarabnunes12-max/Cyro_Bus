# Roteiro de apresentação (≈ 6 minutos)

> Dica: abra o site alguns minutos antes (hospedagens gratuitas podem "acordar" devagar) e teste a internet.
> De madrugada ou fora do horário das linhas, use o relógio do mapa → **Ir para 08:30**.

1. **Abertura (30 s)** — "O Cyro Bus ajuda a saber qual ônibus pegar em Valinhos, na hora certa." Mostre a tela de login, o
   **seletor Claro/Escuro** e os links de **Termos e Privacidade**. Entre como **visitante** ou com sua conta.
2. **Início (1 min)** — Avisos importantes (aviso de protótipo) → busca **"Para onde você quer ir?"**: digite *farmácia* ou
   *Santa Casa* → mostre local, endereço, linhas próximas, distância e **Visualizar rota**. Mostre o **clima de Valinhos**.
3. **Mapa em tempo real simulado (2 min)** — Escolha uma linha (ex.: **527 Santa Casa / Hospital Galileo**).
   Explique: cada horário da tabela é uma saída do Terminal; o ônibus anda ~20 km/h e para nos pontos.
   Mostre **progresso, próxima parada, ponto de referência, estabelecimentos próximos** e o **trecho já percorrido em cinza**.
   Ligue **5× / 20×** para acelerar e use **Ir para** um horário.
4. **Ônibus quebrado (1 min)** — Clique em **Simular ônibus quebrado**: aviso vermelho no mapa, ônibus parado e
   **alternativas** (aguardar o próximo ou **outra linha**, com a rota alternativa desenhada). Clique em **Resolver**.
   Diga com clareza que é uma **demonstração** e que a posição é **simulada, não GPS**.
5. **Assistente (45 s)** — Pergunte: *"Qual ônibus pego para ir ao mercado?"*. Mostre a etiqueta (IA online ou **assistente local**).
6. **Perfil, acessibilidade e privacidade (1 min)** — **Configurações → Tamanho do texto → Extra grande** e **Alto contraste**;
   **Perfil → Alterar senha**, **Baixar meus dados** e **Excluir conta** (LGPD); abra a **Política de Privacidade**.
7. **Encerramento (30 s)** — Limites do MVP (dados demonstrativos, sem GPS) e próximos passos: **horários oficiais, itinerários
   por rua (GTFS), GPS real dos veículos, notificações**.

**Perguntas prováveis:** *"Os horários são reais?"* → demonstrativos; a base real viria da Prefeitura/SOU Valinhos.
*"A localização do ônibus é GPS?"* → não; é simulação por tabela de horários e velocidade estimada.
*"Meus dados estão seguros?"* → Firebase Auth + regras do Firestore; localização não é enviada; dá para baixar e excluir os dados.

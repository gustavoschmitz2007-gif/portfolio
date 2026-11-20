# LIFE OS

Sistema pessoal de organização: hábitos, metas semanais, faculdade, agenda, planejamento do dia, lembretes e estatísticas — em um app web instalável (PWA) que funciona offline.

- **App pronto (build):** pasta [`/life-os`](../../life-os) na raiz do repositório → publicado pelo GitHub Pages em `https://<usuário>.github.io/portfolio/life-os/`
- **Código-fonte:** esta pasta (`apps/life-os`)

## Como usar no celular

1. Abra o endereço do app no navegador do celular.
2. **Android (Chrome):** menu ⋮ → *Instalar app* (ou *Adicionar à tela inicial*).
   **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.
3. Abra pelo ícone. Em *Configurações → Notificações*, toque em **Ativar notificações**.

## Funcionalidades

| Área | O que faz |
| --- | --- |
| **Início** | Saudação, % do dia, hábitos pendentes com registro de um toque, agenda de hoje, prazos da faculdade, resumo da semana e consistência. Botão **+** para registro rápido. |
| **Hábitos** | Hábitos com nome, categoria, ícone, cor, “X vezes por semana” ou dias fixos, meta semanal, vezes por dia (ex.: 8 copos), horário e lembrete. Rastreador semanal: toque em qualquer dia para marcar/corrigir. Arquivar mantém o histórico. |
| **Metas semanais** | Metas próprias para cada semana (snapshot), progresso visual, status realista (“No ritmo”, “Atenção”, “Fora de alcance”), ajuste só desta semana, histórico e comparação. |
| **Faculdade** | Trabalhos, provas, apresentações, atividades e relatórios com disciplina, data/hora, prioridade, descrição, observações e status. Alertas visuais (normal / próximo / hoje / atrasado), ordenação por data, matéria ou prioridade, calendário acadêmico e disciplinas. |
| **Agenda** | Visões Dia / Semana / Mês com compromissos, provas, lembretes e tarefas, coloridos por categoria. Compromissos com repetição e aviso. |
| **Planejamento** | Tarefas do dia com prioridade e horário, linha do tempo, atrasadas (“mover para hoje”), sem data. Entrada rápida: `Estudar cálculo 14h !` → 14:00, prioridade alta; aceita `amanhã`. |
| **Lembretes** | Título, descrição, data, hora, repetição (diária, dias úteis, semanal, mensal, dias específicos), concluir e adiar. |
| **Estatísticas** | Consistência semanal, hábitos mais/menos cumpridos, totais (treinos, sessões de cardio, dias estudados…), histórico mensal, atividade diária, esta semana × anterior, % de metas cumpridas, entregas no prazo. Tudo calculado dos registros reais. |
| **Configurações** | Nome, tema (escuro/claro/sistema), cor de destaque, início da semana, áreas da vida/categorias, notificações, instalação, backup/restauração, backups automáticos, armazenamento. |

## Dados e backup

- Tudo é salvo automaticamente no **IndexedDB** do navegador (com fallback para `localStorage`). A gravação é imediata e, ao fechar a página, uma cópia síncrona de emergência garante que a última alteração não se perca.
- **Backups automáticos:** um por dia, mantendo os 10 mais recentes, restauráveis em *Configurações*. Antes de importar, restaurar ou apagar, uma cópia de segurança é criada.
- **Exportar/Importar:** arquivo JSON (`lifeos-backup-AAAA-MM-DD.json`) — serve para trocar de aparelho.
- O app pede ao navegador **armazenamento persistente** (protege contra limpeza automática).
- Estrutura pronta para sincronização futura: cada registro tem `id`, `createdAt`, `updatedAt`; exclusões ficam em `tombstones`; o documento tem `schemaVersion` e passa por `normalizeData()` (migrações e validação).

## Notificações — o que funciona e as limitações

- **App aberto ou em segundo plano:** notificações reais do sistema no horário (lembretes, prazos da faculdade, hábitos com horário, compromissos e tarefas com horário), via service worker. Com o app em foco, aparece um aviso dentro do app com *Concluir* / *Adiar*.
- **App totalmente fechado:** navegadores não permitem agendar notificações locais sem um servidor de push. No Chrome/Android com o app instalado, o LIFE OS registra uma verificação periódica em segundo plano (*Periodic Background Sync*), mas o intervalo é decidido pelo navegador — é um reforço, não uma garantia.
- **iPhone:** notificações só com o app instalado na tela inicial (iOS 16.4+).
- **Alternativa garantida:** *Configurações → Exportar agenda para o calendário (.ics)* (ou o ícone de calendário em cada lembrete/atividade/compromisso). O calendário do celular avisa mesmo com tudo fechado.
- Ao abrir o app, tudo o que venceu aparece destacado (lembretes pendentes, tarefas e entregas atrasadas).

## Desenvolvimento

```bash
cd apps/life-os
npm install
npm run dev        # servidor local
npm test           # testes da lógica (semanas, metas, recorrência, notificações, backup)
npm run build      # typecheck + build para ../../life-os
```

**Stack:** React 19 + TypeScript, Vite, Zustand + Immer, vite-plugin-pwa (Workbox, `injectManifest`), lucide-react, fontes Inter e Manrope (self-hosted), gráficos em SVG próprio. Sem backend.

**Estrutura:**

```
src/
  core/       lógica pura (datas, hábitos/metas, estatísticas, recorrência, notificações, .ics, IndexedDB)
  store/      estado (Zustand), persistência, relógio, UI (sheets, toasts)
  app/        shell, rotas (hash), notificações, overlays
  features/   telas: dashboard, habits, goals, planner, reminders, academic, agenda, stats, settings, onboarding, quick
  ui/         componentes, ícones, rótulos
  styles/     tokens (tema claro/escuro), base, componentes, layout, páginas
  sw.ts       service worker: cache offline, verificação periódica, cliques em notificações
```

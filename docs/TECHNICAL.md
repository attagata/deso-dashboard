# DESO Alliance Dashboard — Documentação técnica

**Créditos do projeto: Anderson Tagata — ATTecnologies, 2026.**

Versão do projeto: 1.0.0 · Schema diário: 2 · Referência: implementação publicada em outubro de 2026.

Idioma: Português (PT) · [English (EN)](TECHNICAL.en.md) · Revisão documental: 2026-10-28.

As versões PT e EN são mantidas em conjunto para melhorias e correções, conforme a [política de manutenção](#15-manutenção-da-documentação-bilíngue).

- Repositório: <https://github.com/attagata/deso-dashboard>
- Aplicação: <https://attagata.github.io/deso-dashboard/>
- Guia de instalação e operação: [README](../README.md)
- Créditos e licença: [NOTICE](../NOTICE) e [Apache 2.0](../LICENSE)

## 1. Objetivo e escopo

Painel público, somente leitura, para acompanhar os membros da aliança DESO / Death Soldiers, servidor 2052, no jogo Last War: Survival. Oferece consultas por data, ranking, histórico individual de poder/HQ/rank, acompanhamento de atividade e diferenças de rank entre capturas.

A interface de produção é em inglês. Nomes de jogadores e metadados das fontes são preservados. Esta documentação é em português para facilitar a manutenção pelo administrador.

O site não modifica o jogo, não executa decisões administrativas e não processa screenshots. A extração das capturas e a revisão dos dados acontecem externamente, com ChatGPT e o administrador. Não há backend próprio, banco de dados, autenticação, API externa de processamento dos dados da aliança, Docker ou infraestrutura paga. A exceção aprovada às requisições somente locais é o contador FreeCounterStat, descrito na seção 16.

## 2. Arquitetura

```mermaid
flowchart TD
    A[Capturas do roster] --> B[Extração externa e revisão humana]
    B --> C[JSON diário versionado no GitHub]
    C --> D[GitHub Actions]
    D --> E[Validação e geração do manifesto]
    E --> F[Testes e build Vite]
    F --> G[GitHub Pages: HTML, CSS, JS e JSON]
    G --> H[Navegador: validação e normalização]
    H --> I[Cálculos, filtros, tabelas e gráficos]
    H -.-> J[FreeCounterStat: contador externo de visitas]
```

GitHub Actions é usado apenas para construir, verificar e publicar arquivos estáticos. Todos os cálculos exibidos no dashboard são executados no navegador. O servidor local do Vite é uma ferramenta de desenvolvimento, não uma dependência da aplicação publicada.

### Tecnologias e decisões

| Área | Implementação | Motivo |
| --- | --- | --- |
| Interface | React 19 e TypeScript estrito | Componentes pequenos e contratos explícitos |
| Build | Vite 7 e TypeScript 5.9 | Build estático e verificação de tipos |
| Gráficos | Recharts 3 | Histórico de poder e distribuição de ranks |
| Estilo | CSS próprio e fontes do sistema | Layout responsivo sem framework visual ou fontes externas |
| Estado | Hooks locais do React | Volume pequeno, sem biblioteca global de estado |
| Dados | JSON diário, schema 2 | Histórico legível, revisável e versionado |
| Navegação | Fragmento da URL, `location.hash` | Perfis podem ser atualizados diretamente no GitHub Pages |
| Testes | `node:test` e `node:assert/strict` | Sem dependência adicional de testes |
| Runtime de ferramentas | Node.js 24 e npm | Execução dos testes e do validador TypeScript |
| Publicação | Actions oficiais do GitHub Pages | Sem infraestrutura própria adicional |
| Contador | Embed assíncrono FreeCounterStat | Contagem aproximada, como exceção externa aprovada |

As versões exatas instaladas são fixadas em [package-lock.json](../package-lock.json). As faixas declaradas estão em [package.json](../package.json).

## 3. Organização do código

| Arquivo ou diretório | Responsabilidade |
| --- | --- |
| `index.html` | Documento estático, raiz React e contador externo no fim da página |
| `src/main.tsx` | Montagem da aplicação em `StrictMode` e importação do CSS |
| `src/App.tsx` | Carregamento, estado global mínimo, hash routing, seleção de data, navegação e rodapé com créditos |
| `src/components/Dashboard.tsx` | Indicadores, top 10, movimentos de rank e diretrizes |
| `src/components/MemberTable.tsx` | Busca, filtros, ordenação, badges, variações e paginação de 25 registros |
| `src/components/MemberDetails.tsx` | Perfil, observações históricas e eventos de participação |
| `src/components/PowerChart.tsx` | Série histórica de poder com lacunas explícitas |
| `src/components/RankDistribution.tsx` | Distribuição de ranks com legenda numérica |
| `src/components/ActivityMonitor.tsx` | Categorias de atividade e lista para revisão administrativa |
| `src/components/Icons.tsx` | Ícones SVG locais |
| `src/services/dataService.ts` | Download dos JSONs locais e validação em runtime |
| `src/types/member.ts` | Tipos do schema diário e dos dados normalizados |
| `src/utils/statistics.ts` | Funções determinísticas de normalização, contagens e diferenças |
| `src/utils/validation.ts` | Regras compartilhadas de estrutura e linha do tempo |
| `src/styles.css` | Tema, responsividade, tabelas e acessibilidade visual |
| `scripts/validate-data.mjs` | Descoberta de arquivos, validação e geração do manifesto |
| `tests/statistics.test.ts` | Cálculos, dados ausentes, identidade, cronologia e preservação da fonte |
| `public/data/` | Fonte dos dados publicados |
| `source-data/` | Histórico original, preservado para auditoria |
| `.github/workflows/deploy.yml` | Pipeline de verificação e publicação |

## 4. Contrato dos dados

### 4.1 Arquivos diários

Cada captura diária é um arquivo `public/data/YYYY-MM-DD.json`. O campo `date` deve coincidir com o nome do arquivo. Há uma captura por data; não são aceitas duas observações do mesmo jogador no mesmo dia.

Estrutura mínima válida, intencionalmente sem jogadores fictícios:

```json
{
  "schema_version": 2,
  "date": "2026-10-21",
  "alliance": {
    "tag": "DeSo",
    "name": "Death Soldiers",
    "server": "2052"
  },
  "summary": {},
  "observations": [],
  "membership_events": []
}
```

A data acima é ilustrativa. Um arquivo vazio válido não equivale a uma captura completa e não deve ser publicado como substituto de dados ainda não extraídos.

### 4.2 Observações

| Campo | Tipo | Semântica |
| --- | --- | --- |
| `player_id` | string não vazia | Identidade interna estável entre arquivos |
| `name` | string não vazia | Nome observado naquela captura |
| `rank` | `R1` a `R5`, ou `null` | Rank efetivamente observado |
| `base_level` | inteiro positivo ou `null` | Nível do HQ |
| `power_m` | número não negativo ou `null` | Poder em milhões, na precisão da fonte |
| `visible` | boolean | Jogador observado ou explicitamente não observado |
| `last_seen` | `online`, valor com sufixo `m`/`h`/`d`, ou `null` | Indicador observado, preservado como texto |
| `last_seen_minutes` | número não negativo ou `null` | Conversão nominal do intervalo observado |
| `online_at_capture` | boolean ou `null` | Online no momento da captura, separado do intervalo |
| `source` | string não vazia | Origem da evidência |
| `identity_uncertain` | boolean opcional | Bloqueia conclusões de movimento de rank quando verdadeiro |
| `profile` | objeto opcional | Metadados adicionais do perfil daquela data |
| `membership_status` | string opcional | Campo legado preservado; não governa a classificação histórica |

As observações herdam a data do arquivo. Dados desconhecidos usam `null`, nunca zero como substituto. Zero de poder só deve representar uma observação real desse valor.

Quando `visible` é falso, `rank`, `base_level`, `power_m`, `last_seen`, `last_seen_minutes` e `online_at_capture` devem ser `null`. A omissão de uma linha também resulta em não observado para uma identidade já conhecida.

`online_at_capture: true` exige `last_seen: "online"` e `last_seen_minutes: null`. Um intervalo como `2h` corresponde nominalmente a 120 minutos; ele não representa duração da sessão, tempo diário de jogo ou precisão maior que a captura original.

### 4.3 Resumo oficial e eventos

`summary` pode armazenar `reported_members`, `reported_ranks` e `alliance_power` dos cabeçalhos do jogo, além de metadados originais. O poder oficial usa unidades completas; `power_m` de cada jogador usa milhões. Esses valores não são intercambiáveis.

`membership_events` aceita `departure` e `rejoin`. Cada evento exige `player_id`, `name`, `recorded_on`, `effective_date` e `source`; `previous_rank` é opcional. A data de registro deve coincidir com a captura. A data efetiva pode ser desconhecida (`null`), mas não pode ser posterior à confirmação.

Uma saída é registrada uma única vez e permanece no histórico. Para uma identidade confirmada como saída reaparecer como ativa, é necessário um evento explícito de retorno. A aplicação classifica participação pela data de confirmação, evitando atribuir uma data efetiva que a evidência não comprova.

### 4.4 Manifesto automático

`npm run validate:data` procura os arquivos diários, ordena seus nomes, valida os dados e grava `public/data/index.json` apenas quando não há erros:

```json
{
  "schema_version": 2,
  "last_updated": "2026-10-20",
  "files": [
    "2026-10-14.json",
    "2026-10-19.json",
    "2026-10-20.json"
  ]
}
```

O administrador não precisa editar o manifesto diariamente. O GitHub Pages não fornece listagem de diretórios para essa finalidade; o manifesto informa quais arquivos o navegador deve carregar.

## 5. Migração e rastreabilidade

O arquivo recebido, schema 1.1, foi preservado integralmente em [source-data](../source-data/DESO_member_history_2026-10-14_to_2026-10-20.json). Ele contém 103 identidades e capturas de 14, 19 e 20 de outubro de 2026.

A migração distribuiu cada `players[].snapshots[date]` no arquivo diário correspondente, mantendo os campos originais e acrescentando `player_id` e `name` à linha. Perfis datados foram associados à respectiva observação; metadados da aliança, resumo e política de dados foram preservados. Eventos aparecem na data em que foram registrados.

Estados globais sem data e descrições adicionais de saída continuam no original de auditoria. Eles não são aplicados retroativamente ao roster. O teste de preservação compara os três arquivos iniciais com a fonte recebida; alterações deliberadas dessas capturas exigem revisão dessa comparação, com justificativa no Git, sem modificar silenciosamente o original.

| Data | Visíveis | Soma individual | Saídas confirmadas até a data | Conhecidos não observados |
| --- | ---: | ---: | ---: | ---: |
| 2026-10-14 | 91 | 5.429.600.000 | 0 | 0 |
| 2026-10-19 | 97 | 5.615.800.000 | 4 | 0 |
| 2026-10-20 | 98 | 5.690.200.000 | 4 | 1 |

Em 19/10, o poder oficial registrado é 5.611.412.930. A diferença em relação à soma individual permanece explícita, sem ajuste artificial dos jogadores.

## 6. Carregamento e normalização

1. `App` inicia `loadData` com `AbortController` e cancela requisições ao desmontar.
2. `dataService` carrega o manifesto e verifica a lista de nomes permitidos.
3. Os arquivos diários são buscados em paralelo com `Promise.all`.
4. Cada resposta passa por parsing JSON, validação estrutural e comparação da data com o nome do arquivo.
5. A sequência completa passa pela validação cronológica.
6. `normalizeSnapshots` agrupa os jogadores pelo ID e associa observações e eventos em ordem de data.

As requisições usam `import.meta.env.BASE_URL`, `cache: 'no-store'` e um parâmetro de atualização baseado em `Date.now()`. Não há service worker ou persistência local autoritativa. Recarregar a página busca os dados novamente; o site não faz polling contínuo enquanto permanece aberto.

Mapeamento principal:

| Origem diária | Modelo em memória |
| --- | --- |
| `player_id` | `Member.id` |
| `date` do arquivo | `Observation.date` |
| `power_m` | `power = Math.round(power_m * 1_000_000)` |
| `base_level` | `level` |
| `last_seen` | `activityText` |
| `last_seen_minutes` | `inactivityMinutes` |
| `online_at_capture` | `online` |
| `identity_uncertain` | `identityUncertain`, falso se omitido |

A conversão numérica não aumenta a precisão da captura. O aplicativo mantém `null` quando não há valor.

## 7. Regras de cálculo

As funções estão em [statistics.ts](../src/utils/statistics.ts) e não dependem do relógio atual, armazenamento local ou serviços externos.

### Participação e data selecionada

`rowsForDate` considera apenas registros até a data selecionada. Identidades ainda não conhecidas naquela data não aparecem no roster histórico. A observação selecionada precisa corresponder exatamente à data; valores antigos não preenchem campos ausentes.

| Status | Regra |
| --- | --- |
| `departed` | Último evento confirmado até a data é uma saída |
| `active` | Sem saída vigente e com observação visível na data |
| `unobserved` | Identidade conhecida, sem saída vigente e sem observação visível naquela data |

`lastKnown` guarda a última observação visível até a data para contexto histórico. Não entra como substituto no poder ou na atividade daquele dia. O perfil apresenta também os últimos valores de todo o histórico, identificados como mais recentes; seu gráfico e tabela mostram todas as observações disponíveis.

### Poder, posição e variações

`summarize` soma os valores não nulos dos jogadores ativos observados na data e informa a cobertura dos registros. Um desconhecido não vira zero no registro, embora não contribua para a soma parcial. O total oficial é exibido separadamente.

O ranking usa poder decrescente, desempate pelo nome em locale inglês e depois pelo ID. Somente jogadores ativos com poder conhecido recebem posição. Ordenações e filtros da tabela não alteram os totais da aliança.

```text
Variação absoluta = poder observado atual − poder da observação visível anterior
Variação percentual = variação absoluta / poder anterior × 100
```

Se a observação anterior ou seu poder forem desconhecidos, a variação é desconhecida. A comparação não pula um poder nulo para buscar um número mais antigo. Percentuais só são calculados quando o poder anterior é positivo. Variações de magnitude igual ou superior a 10% recebem destaque visual, sem interpretação automática de desempenho.

### Novos observados e ranks

“Newly observed” conta jogadores ativos cuja primeira observação visível é naquela data. Na captura inicial, o indicador é indefinido, pois se trata da linha de base. O indicador não comprova a data de entrada na aliança.

A distribuição R1–R5 usa apenas ranks conhecidos de jogadores ativos na captura. `rankMovements` compara datas de captura adjacentes: exige duas observações visíveis, ranks conhecidos e diferentes, e identidade sem incerteza. Uma captura ausente impede a conclusão de mudança entre esses pontos. A data exata da decisão administrativa continua desconhecida.

### Atividade

| Categoria | Regra |
| --- | --- |
| Online | Online na captura, independentemente de minutos nulos |
| Recently Active | Menos de 1.440 minutos |
| Away | De 1.440 até menos de 7.200 minutos |
| Review Required | A partir de 7.200 minutos, equivalentes nominais a cinco dias |
| Unknown | Sem observação visível ou sem informação de atividade suficiente |

O tempo não é extrapolado a partir da data da captura. A lista de revisão utiliza jogadores ativos com evidência suficiente na data selecionada. Cinco dias de ausência indicam revisão por oficiais; não causam demissão, rebaixamento ou expulsão automáticos.

## 8. Interface, navegação e gráficos

As rotas são `#/` e `#/member/ID`, com `?date=YYYY-MM-DD` dentro do fragmento. O ID é codificado na URL. Como o fragmento não é enviado ao servidor, uma atualização direta abre o mesmo documento estático e preserva o perfil.

Data não disponível gera aviso explícito e seleciona a captura mais recente. ID inexistente exibe estado de jogador não encontrado. O aplicativo também diferencia carregamento, conjunto vazio e falha de dados.

O gráfico de poder usa pontos medidos e linha linear como guia visual, com `connectNulls={false}` e valores nulos nos dias sem observação. Não realiza interpolação de registros. Animações dos gráficos são desativadas. Os componentes gráficos são carregados com `React.lazy`/`Suspense`; o build separa Recharts em um chunk próprio.

O layout usa controles nativos, scroll horizontal em tabelas e paginação de 25 membros. Há rótulos acessíveis, navegação por teclado, foco visível e tabela de histórico como alternativa numérica ao gráfico. Testes em larguras de tela simuladas não substituem verificação em um iPhone físico.

## 9. Validação e testes

```sh
npm run validate:data
npm test
npm run build
```

`validateDailyData` verifica campos obrigatórios, schema, datas reais, ranks, tipos numéricos, valores negativos, atividade, visibilidade, fontes, identidades duplicadas e eventos. Nomes duplicados normalizados dentro de um dia são sinalizados para revisão de identidade. A normalização de nomes nessa verificação não altera o nome armazenado.

`validateTimeline` verifica ordem cronológica, datas duplicadas, identidade referenciada por eventos, saída repetida, retorno sem saída anterior e observação após saída sem retorno explícito. A ferramenta de linha de comando também verifica sintaxe JSON e nomes de arquivo. Em falha, retorna código diferente de zero e não regenera o manifesto. No navegador, dados inválidos geram mensagem de erro em vez de estatísticas parcialmente aceitas.

Os 11 testes originais de estatísticas e integridade cobrem os itens abaixo; os 15 testes adicionais de análise de desempenho estão descritos na seção 14, totalizando 26:

1. Diferenças de poder positivas, negativas, percentual e valores desconhecidos.
2. Contagens e distribuição de ranks das capturas reais.
3. Limites exatos das categorias de atividade.
4. Saídas por data de confirmação e preservação de não observados.
5. Poder e observações ausentes sem preenchimento automático.
6. Mudanças de rank com capturas adjacentes e identidade certa.
7. Mudanças de nome sem perda da identidade.
8. IDs, observações e datas duplicadas.
9. Campos, ranks, poder, unidades e datas inválidos.
10. Cronologia, retornos e datas efetivas inconsistentes.
11. Preservação das observações, perfis, metadados e eventos originais.

A versão inicial também foi verificada em navegador Chromium com busca, filtros, paginação, seleção de data, refresh do perfil, gráficos, estados vazio/erro e larguras de 320, 375, 390, 768 e 1440 pixels. Essas verificações de navegador foram executadas no ambiente de desenvolvimento e não integram o script `npm test`.

## 10. Build e publicação

Instalação reprodutível: `npm ci`. Desenvolvimento: `npm run dev`. Prévia local do build: `npm run preview`. O build executa validação, `tsc -b` e `vite build`, produzindo `dist/`.

O workflow é acionado por push em `main` ou `master`, pull requests e disparo manual. Nas pull requests executa verificações, sem publicar. Em push ou disparo manual:

1. Faz checkout e configura Node.js 24 com cache do npm.
2. Instala pelo lockfile com `npm ci`.
3. Valida dados e gera o manifesto.
4. Executa os testes.
5. Compila a aplicação usando o nome do repositório como base.
6. Envia `dist/` com `actions/upload-pages-artifact`.
7. Configura e publica com `actions/configure-pages` e `actions/deploy-pages`.

O job de build possui `contents: read`. O job de deploy utiliza `pages: write` e `id-token: write` para OIDC, sem credenciais no código. A concorrência cancela execuções anteriores da mesma referência. O repositório original utiliza `master` como branch padrão; ambas as branches são suportadas, mas alterações futuras devem ser sincronizadas ou concentradas na branch escolhida para evitar publicações divergentes.

Na ativação inicial: **Settings → Pages → Build and deployment → Source → GitHub Actions**. A integração de desenvolvimento pode enviar código sem ter acesso administrativo para ativar esse recurso; nesse caso o proprietário faz essa configuração uma vez.

`vite.config.ts` usa `/deso-dashboard/` por padrão. Em CI, `VITE_BASE_PATH` recebe `/${nome-do-repositório}/`. Se migrar para `USERNAME.github.io` na raiz, configurar `/`. Caminhos de dados e assets usam essa base, evitando dependência de caminhos absolutos incorretos.

## 11. Procedimento diário e recuperação

1. Registrar a data real das screenshots e revisar sua cobertura.
2. Extrair somente informações observadas e eventos confirmados.
3. Reutilizar IDs; revisar trocas de nome e possíveis duplicatas antes de confirmar identidade.
4. Adicionar `public/data/YYYY-MM-DD.json`, preservando arquivos anteriores.
5. Validar, testar e compilar, ou acompanhar essas etapas no GitHub Actions.
6. Fazer commit na branch de publicação e aguardar o deploy concluir.
7. Recarregar o site e conferir data, quantidade de observados e valores principais.

No iPhone, o JSON pode ser enviado por **Add file → Upload files** na pasta `public/data` do repositório. O build gera o manifesto; nenhum ajuste no código é necessário.

| Sintoma | Verificação e correção |
| --- | --- |
| Validador rejeita o arquivo | Ler arquivo/campo na mensagem, corrigir o JSON e executar novamente |
| Captura nova não aparece | Confirmar branch publicada, nome do arquivo, data e conclusão do workflow |
| Número de membros difere do cabeçalho | Verificar cobertura; comparar observados com número oficial, sem inventar linhas |
| Falha em Configure GitHub Pages | Conferir a opção GitHub Actions nas configurações do Pages |
| Assets ou dados retornam 404 | Conferir nome do repositório, base do Vite e manifesto publicado |
| Jogador desaparece de uma captura | Manter como não observado; só registrar saída com confirmação |
| Jogador retornou após saída | Registrar `rejoin` explícito antes de voltar a observá-lo como ativo |

Para desfazer uma atualização incorreta, preferir um novo commit que reverta a alteração, preservando a trilha do Git. Remover um dia inteiro altera a sequência de capturas e pode alterar quais datas são adjacentes no histórico de ranks; revisar esse efeito. Corrigir uma captura inicial exige considerar o teste de preservação contra o original de auditoria. Nunca incluir tokens ou credenciais em commits de recuperação.

## 12. Segurança, limites e manutenção

Os dados publicados são públicos por definição. O JSX renderiza nomes como texto; não há HTML arbitrário fornecido pelos JSONs. O loader de dados da aliança restringe arquivos do manifesto ao padrão de data e utiliza somente dados estáticos do próprio site. Separadamente, o contador aprovado carrega script e imagens de terceiros, conforme a seção 16. Dependências de terceiros continuam sujeitas a suas próprias licenças e devem ser revisadas ao atualizar o lockfile.

Todos os JSONs são carregados em memória a cada abertura. O custo cresce com o número de capturas e jogadores. O volume atual é pequeno; para um histórico muito maior, considerar resumos estáticos gerados no build e carregamento sob demanda, mantendo o mesmo modelo sem backend.

Outros limites: uma captura por dia, poder na precisão exibida pelo jogo, identidade dependente de revisão humana, datas de entrada/saída nem sempre conhecidas, ausência de OCR e edição no site, e nenhuma medição de tempo diário de jogo. Capturas incompletas não permitem concluir ausência de participação.

Para manutenção: preservar os contratos TypeScript, atualizar dependências de forma revisada, executar testes e build, conferir a navegação em `/deso-dashboard/` e revisar o layout em dispositivos móveis após mudanças visuais.

## 13. Créditos e licença

**Anderson Tagata — ATTecnologies, 2026.**

O crédito está registrado nesta documentação, no README, no arquivo NOTICE e no rodapé público da aplicação. A licença Apache 2.0 já existente no repositório é mantida. Os créditos do projeto não transferem a titularidade de marcas, nomes ou assets de Last War: Survival nem das dependências utilizadas.

## 14. Player performance analysis

### Módulos e escopo temporal

A análise individual fica em `src/components/PerformanceAnalysis.tsx`, integrada ao perfil de cada jogador. `src/utils/performance.ts` contém `analyzePerformance`, uma função determinística que recebe o membro, as datas de captura, a data de corte e a configuração. `src/config/performance.ts` centraliza os valores padrão e sua validação. Não há dependência adicional, serviço externo, alteração nos JSONs ou persistência no navegador.

Ao contrário das seções do perfil explicitamente identificadas como histórico completo, esta análise considera apenas observações até a data selecionada. Poder inicial e último poder conhecido têm suas próprias datas visíveis. Se a captura selecionada estiver ausente, não se copia o poder anterior para classificá-la. A mesma separação vale para HQ e último login conhecido: são informações datadas, não prova de estado atual.

### Limites configuráveis

| Configuração | Padrão | Uso |
| --- | ---: | --- |
| `significantDeclinePercent` | 5 | Magnitude percentual mínima para destacar queda e iniciar acompanhamento de recuperação |
| `stableChangePercent` | 1 | Crescimento positivo até esse limite permanece Stable |
| `sustainedDeclineIntervals` | 2 | Quantidade mínima de intervalos consecutivos com redução |
| `sustainedDeclineDays` | 2 | Duração mínima observada da sequência de reduções |
| `inactivityReviewDays` | 5 | Limite nominal de ausência para Inactivity Review |

A tendência descendente também exige perda acumulada de pelo menos `significantDeclinePercent`. Portanto, pequenas quedas sucessivas podem satisfazer a regra cumulativa mesmo que cada queda isolada seja inferior a 5%. Configurações inválidas são rejeitadas: números não finitos, queda percentual fora de (0,100], limite de crescimento menor que zero ou maior/igual ao de queda, menos de dois intervalos para tendência e durações inferiores a um dia.

O formulário **Analysis thresholds** aplica configurações temporárias à análise do perfil. Elas ficam em memória enquanto o componente permanece montado; voltar ao overview ou recarregar restaura os padrões. Alterações não mudam os dados, a política da aliança nem a regra fixa de cinco dias do Activity Monitor. Configurações permanentes do módulo são feitas no arquivo de configuração e passam por novo build.

### Comparações e classificação

Cada ponto corresponde a uma data de captura conhecida. Uma comparação de poder exige dois pontos adjacentes com observações visíveis, poder não nulo, identidade certa e sem evento de saída/retorno entre eles. Uma observação ausente, poder nulo ou identidade incerta interrompe sequências descendentes e ciclos de recuperação. As mudanças de rank no módulo também exigem observações adjacentes visíveis e identidade certa, sem atravessar eventos de participação.

A diferença histórica de poder compara o primeiro e o último poder conhecidos até a data de corte, com datas explícitas. Ela pode abranger lacunas e não estabelece uma trajetória contínua. As variações por intervalo usam `atual − anterior`, e o percentual usa `diferença / anterior × 100` somente quando o anterior é positivo. A variação diária só é preenchida quando as duas capturas comparáveis estão separadas por exatamente um dia de calendário UTC. Um intervalo de cinco dias não vira cinco medições diárias nem uma estimativa apresentada como observação.

A classificação de poder segue esta precedência:

1. **Insufficient data:** não existe comparação válida com o ponto adjacente anterior.
2. **Recovering:** há aumento observado durante um ciclo de perda significativo ainda acompanhado.
3. **Power Decline:** queda do intervalo atinge o limite configurado, ou a sequência satisfaz a regra de tendência descendente.
4. **Growing:** aumento positivo acima do limite de pequena flutuação, ou aumento a partir de zero, com percentual indefinido.
5. **Stable:** demais comparações válidas, incluindo zero, pequenos aumentos e reduções abaixo da regra de perda significativa/tendência.

**Inactivity Review** substitui apenas o rótulo principal quando o tempo de ausência observado atinge o limite, o jogador não está online e não há saída confirmada vigente. O padrão de poder continua visível separadamente, por exemplo Growing junto de Inactivity Review. Uma única captura pode justificar revisão de atividade, mas não uma conclusão de evolução de poder. Ausência de captura não gera revisão por extrapolação do tempo.

HQ, ranks e login não são combinados em nota, pontuação de compromisso ou ordem de promoção. O resumo apresenta sua evidência independentemente: uma progressão de HQ pode coexistir com queda de poder. Ranks indicam diferenças observadas, não a causa das mudanças ou um novo direito administrativo.

### Ciclos de recuperação

A primeira queda significativa inicia um ciclo cuja referência é o poder imediatamente anterior à queda. Se o ciclo começa por uma sequência de quedas cumulativas, usa-se o poder anterior ao início dessa sequência. Quedas subsequentes atualizam o menor poder observado, mantendo a referência do ciclo.

Quando o poder aumenta durante esse ciclo:

```text
Poder recuperado = poder atual − menor poder observado no ciclo
Perda acompanhada = poder de referência anterior à queda − menor poder observado
Percentual da perda recuperada = poder recuperado / perda acompanhada × 100
```

O resumo informa referência, menor valor, datas, recuperação absoluta e percentual. A recuperação é parcial até atingir a referência. Ao atingir ou exceder esse valor, registra-se recuperação completa e encerra-se o ciclo; um aumento na captura seguinte pode ser Growing. Percentuais acima de 100% são mantidos para mostrar superação da referência. Nenhum valor intermediário é inventado.

### Significado e limites da evidência

Uma redução isolada é chamada de flutuação de intervalo; isso não prova que ela foi temporária. Uma tendência descendente descreve uma sequência observada que atende aos limites, sem afirmar sua causa, o que ocorreu nos dias sem captura ou o comprometimento do jogador.

O texto do módulo explica que perdas de tropas, feridos ou alterações de força militar podem afetar poder em Last War: Survival, mas screenshots do roster não identificam a causa. Perdas de tropas, participação em batalhas, hospital, upgrades de heróis e pesquisas são mostrados como **Unknown**, pois não constam nos dados. Perda de poder, isoladamente, nunca gera recomendação de rebaixamento. Os pontos sugeridos são ações de acompanhamento de evidências, sem promoção, rebaixamento ou expulsão automáticos.

### Verificação

`tests/performance.test.ts` acrescenta 15 testes aos 11 originais, totalizando 26. Cobrem o limite inclusivo de 5%, flutuações pequenas, crescimento, tendência cumulativa/duração, recuperação parcial/completa/superior à referência, novo menor valor, recuperação com saldo histórico negativo, intervalos de vários dias, lacunas e identidade incerta, atividade independente, corte temporal sem dados futuros, HQ/rank junto de queda, poder zero/nulo, não observados/saídas, interrupção por retorno e configurações inválidas.

## 15. Manutenção da documentação bilíngue

A exigência do proprietário é manter as versões em português e inglês atualizadas em conjunto sempre que houver melhorias ou correções.

| Idioma | Arquivo | Finalidade |
| --- | --- | --- |
| Português (PT) | [TECHNICAL.md](TECHNICAL.md) | Referência técnica completa em português; caminho existente preservado |
| English (EN) | [TECHNICAL.en.md](TECHNICAL.en.md) | Referência técnica completa paralela em inglês |

Para cada melhoria ou correção:

1. Atualizar as seções afetadas nos dois idiomas na mesma alteração/commit, inclusive correções apenas documentais.
2. Preservar significado técnico equivalente, numeração das seções, fórmulas, exemplos, limites, comportamento, limitações e créditos. Comandos, identificadores, chaves JSON e rótulos da interface de produção permanecem inalterados.
3. Atualizar a data de revisão documental nos dois cabeçalhos e adicionar entradas equivalentes ao registro de manutenção abaixo. Várias alterações podem compartilhar uma data.
4. Conferir os links recíprocos de idioma, os links do README e os links relativos alterados.
5. Revisar as duas versões contra o comportamento implementado. Tradução e equivalência semântica são revisadas manualmente; não há tradução automática nem validador automático de equivalência semântica.

Atualizações rotineiras dos JSONs diários do roster não exigem edição da documentação, exceto quando alterarem schema, fluxo, regras, linha de base documentada ou comportamento da aplicação.

A mesma instrução está registrada em [AGENTS.md](../AGENTS.md) para trabalhos futuros no repositório. O idioma da interface de produção continua sendo inglês. Os dois documentos mantêm os créditos de **Anderson Tagata — ATTecnologies, 2026**.

### Registro de manutenção

| Data | Melhoria ou correção | Situação PT/EN |
| --- | --- | --- |
| 2026-10-20 | Adicionada a referência paralela completa em inglês, a navegação recíproca de idiomas e a política persistente de manutenção bilíngue; esclarecida a contagem de testes originais e de desempenho | Duas versões atualizadas |
| 2026-10-22 | Adicionado o contador FreeCounterStat no fim da página, com script único por carregamento, fallback sem JavaScript e documentação da exceção externa, cookies e limites de contagem | Duas versões atualizadas |
| 2026-10-28 | Adicionado teste manual e isolado do acesso compartilhado LastWar Tools, com secret protegido e relatório agregado, sem importação automática | Duas versões atualizadas |

## 16. Contador simples de visitas

### Integração e posição

O código fornecido pelo proprietário para FreeCounterStat foi inserido em `index.html`, num `<footer class="visit-counter">` depois de `#root`, abaixo do rodapé da aplicação com os créditos **Anderson Tagata — ATTecnologies, 2026**. O rótulo visível é **Visits**, mantendo a interface em inglês. O estilo responsivo fica em `src/styles.css` e acompanha as larguras da barra lateral no desktop e no celular.

O container mantém o ID `sfc13h5wuu6cn83gb5hd9tq3y79lcaht6g9` e o contador usa `13h5wuu6cn83gb5hd9tq3y79lcaht6g9`. O script original permanece assíncrono, com `down=async`. Foram preservados o link de atribuição e a imagem alternativa dentro de `noscript`. Um handler de erro restrito ao container também reutiliza essa mesma URL alternativa se a imagem principal criada pelo fornecedor falhar. Ele não reage ao pixel separado e não repete tentativas indefinidamente. O contador fica fora do DOM controlado pelo React: montar componentes duas vezes em StrictMode, trocar data, filtrar membros ou navegar entre hashes não reinsere o script. Cada carregamento completo do documento solicita o script uma vez; o fornecedor decide como classificar e acumular as visitas.

### Requisições e armazenamento

| Recurso | Endereço |
| --- | --- |
| Script fornecido pelo proprietário | `https://counter6.optistats.ovh/private/counter.js?c=13h5wuu6cn83gb5hd9tq3y79lcaht6g9&down=async` |
| Imagem alternativa sem JavaScript | `https://counter6.optistats.ovh/private/freecounterstat.php?c=13h5wuu6cn83gb5hd9tq3y79lcaht6g9` |
| Imagem criada pelo script atual do fornecedor | `https://counter6.freecounterstat.com/private/counter.php` |
| Pixel utilizado pelo script atual do fornecedor | `https://counter6.optistats.ovh:4433/private/pointeur/pointeur.gif` |
| Atribuição e configuração externa | `https://www.freecounterstat.com` |

O total e as configurações pertencem ao serviço externo. Não são gravados em GitHub Pages, nos JSONs ou em um backend próprio. Esta é uma exceção explicitamente autorizada pelo proprietário à regra original de requisições apenas locais; os dados e cálculos da aliança continuam independentes do contador.

### Comportamento e limites

O script do fornecedor consultado na integração usa cookies e pode enviar a URL atual, inclusive o hash de perfil, o referenciador e informações de navegador/tela, além dos dados normais da conexão, como IP. A aplicação não envia deliberadamente os JSONs do roster nem adiciona login, mas o script executa no contexto da página. Não afirmar que a integração é livre de cookies ou garante anonimato. O fornecedor pode alterar o script, as requisições e os critérios de contagem.

A contagem é aproximada: recarregamentos podem ser contabilizados ou deduplicados pelo serviço; cookies, cache, bloqueadores e robôs podem afetá-la. O fallback de imagem pode gerar uma requisição adicional ao fornecedor. Não há promessa de precisão ou recuperação de acessos anteriores à instalação. O carregamento assíncrono não bloqueia a renderização do dashboard; se o fornecedor estiver indisponível ou bloqueado, o contador pode ficar vazio enquanto as funções da aliança continuam disponíveis.

Para remover a integração, retirar o bloco `visit-counter` de `index.html` e as regras correspondentes do CSS. Não é necessário alterar os dados ou os cálculos. Para mudar a aparência ou o identificador, obter um novo embed no serviço e revisar as duas versões desta documentação.

## 17. Diagnóstico isolado da API comunitária

O workflow `.github/workflows/probe-lastwar.yml` é executado somente por `workflow_dispatch`. Usa Node.js 24 sem instalar dependências, roda quatro testes offline e executa `scripts/probe-lastwar.mjs`. O secret de repositório `LASTWAR_DESO_TOOLS` contém a chave da API; não é enviado ao navegador nem gravado em arquivos. A chave só é enviada no header `X-API-Key` a `https://api.lastwar.tools`, com redirecionamentos desabilitados.

O diagnóstico faz no máximo duas consultas GET, sem retries: rankings do servidor 2052 (`limit=200`) e membros da única aliança cujo tag seja DeSo, nome Death Soldiers e servidor 2052. Não usa `session_key`, credenciais do jogo, captura de login, scans ou operações de escrita. Pode consumir os tokens gratuitos do fornecedor; não compra créditos. Cada requisição tem timeout de 120 segundos e o job de seis minutos.

O relatório verifica IDs únicos, pelo menos cinco nomes conhecidos, quantidade de membros e cobertura de nome, poder, HQ, rank, online, `offline_time` e `join_time`. Registra apenas agregados; não publica a resposta bruta, credenciais ou coordenadas. Erros externos são reduzidos a códigos e motivos conhecidos. `lastwar-probe-report.json` vai para o resumo do job e um artifact com retenção de sete dias. Falha de leitura deixa o job vermelho e preserva o diagnóstico.

Um resultado `read_success` confirma somente a leitura naquele momento. Unidade/epoch de `offline_time`, codificação de rank, completude e atualização ainda precisam de confirmação antes de qualquer importação. O teste não grava em `public/data`, não altera o histórico nem dispara coleta agendada. Trata-se de uma exceção experimental fora do navegador às requisições locais; o dashboard continua lendo apenas JSONs estáticos para os dados da aliança. Para executar: Actions → Test LastWar shared API access → Run workflow, branch `master`.

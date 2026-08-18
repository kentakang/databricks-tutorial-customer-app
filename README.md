# Databricks Customer Support Copilot

내부 고객 상담원을 위한 **RAG(Retrieval-Augmented Generation) 기반 답변 초안 생성 앱**입니다.
상담 건을 선택하면 고객 마스터·주문·과거 상담 이력을 한 화면에 보여 주고, 상품 문서와 정책을 검색해 한국어 답변 초안을 스트리밍으로 제안합니다.

> Workspace 사전 준비 과정과 실행 순서는 [README.ipynb](README.ipynb)를 참고하세요.

---

## 목차

1. [기술 스택 요약](#기술-스택-요약)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [디렉터리 구조](#디렉터리-구조)
4. [프론트엔드 (Client)](#프론트엔드-client)
5. [백엔드 (Server)](#백엔드-server)
6. [데이터 레이어](#데이터-레이어)
7. [RAG 파이프라인](#rag-파이프라인)
8. [Databricks 리소스](#databricks-리소스)
9. [빌드 파이프라인](#빌드-파이프라인)
10. [로컬 개발](#로컬-개발)
11. [검사 및 테스트](#검사-및-테스트)
12. [배포](#배포)
13. [설계 문서](#설계-문서)

---

## 기술 스택 요약

| 영역 | 기술 | 버전 |
|------|------|------|
| **프레임워크** | [Databricks AppKit](https://docs.databricks.com/en/dev-tools/appkit/index.html) | 0.38.1 |
| **프론트엔드** | React + TypeScript | React 19, TS 5.9 |
| **UI 컴포넌트** | `@databricks/appkit-ui` (Shadcn 기반) | 0.38.1 |
| **스타일링** | Tailwind CSS 4 | 4.0 |
| **번들러 (클라이언트)** | Vite (`rolldown-vite`) | 7.1 |
| **아이콘** | Lucide React | 0.546 |
| **라우팅** | React Router | 7.13 |
| **서버 런타임** | Node.js + Express (AppKit 내장) | Node 22.x |
| **서버 번들러** | tsdown | 0.20 |
| **Databricks SDK** | `@databricks/sdk-experimental` | 0.17 |
| **LLM (답변 생성)** | Qwen3 Next 80B A3B Instruct | — |
| **Embedding (벡터 검색)** | Qwen3 Embedding 0.6B | — |
| **벡터 검색** | Databricks AI Search (Vector Search) | — |
| **데이터 웨어하우스** | Databricks SQL Warehouse | — |
| **데이터 포맷** | Delta Lake (Unity Catalog) | — |
| **스키마 검증** | Zod | 4.3 |
| **단위 테스트** | Vitest | 4.0 |
| **E2E / Smoke 테스트** | Playwright | 1.57 |
| **린터** | ESLint 9 + `@typescript-eslint` | 9.39 |
| **포매터** | Prettier | 3.6 |
| **배포** | Databricks Asset Bundles (DABs) | — |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Databricks Apps Platform                     │
│                                                                     │
│  ┌───────────────┐       ┌──────────────────────────────────────┐  │
│  │  클라이언트     │       │  서버 (Express + AppKit)              │  │
│  │  (React SPA)  │──────▶│                                      │  │
│  │               │  API  │  ┌──────────┐  ┌─────────────────┐   │  │
│  │  • 상담 목록   │       │  │ analytics│  │ agents (support) │   │  │
│  │  • 고객 상세   │       │  │  plugin  │  │     plugin       │   │  │
│  │  • AI 답변 패널│       │  └────┬─────┘  └────────┬────────┘   │  │
│  └───────────────┘       │       │                  │            │  │
│                          └───────┼──────────────────┼────────────┘  │
│                                  │                  │               │
│           ┌──────────────────────┼──────────────────┼──────┐       │
│           │     Databricks 서비스│                  │      │       │
│           │                      ▼                  ▼      │       │
│           │  ┌──────────────┐  ┌──────────────────────┐    │       │
│           │  │ SQL Warehouse│  │ Foundation Model API │    │       │
│           │  │  (analytics) │  │ (Qwen3 80B Instruct) │    │       │
│           │  └──────┬───────┘  └──────────────────────┘    │       │
│           │         │                    │                  │       │
│           │         ▼                    ▼                  │       │
│           │  ┌──────────────┐  ┌──────────────────────┐    │       │
│           │  │ Unity Catalog│  │  AI Search (Vector)  │    │       │
│           │  │ Delta Tables │  │  support_docs_index  │    │       │
│           │  └──────────────┘  └──────────────────────┘    │       │
│           └────────────────────────────────────────────┘    │       │
└─────────────────────────────────────────────────────────────────────┘
```

**핵심 흐름:**
1. 프론트엔드가 `analytics` 플러그인 RPC로 SQL Warehouse에 파라미터 쿼리를 실행해 고객·주문·상담 데이터를 조회
2. 사용자가 "답변 초안 생성"을 요청하면 `agents` 플러그인이 고객 컨텍스트(CONTEXT_JSON)와 함께 LLM에 스트리밍 요청
3. LLM 에이전트는 필요 시 `support_docs` 벡터 검색 도구를 호출해 상품 문서·정책을 검색한 뒤 근거 기반 답변 생성

---

## 디렉터리 구조

```
databricks-tutorial-customer-app/
├── client/                          # 프론트엔드 (React SPA)
│   ├── src/
│   │   ├── main.tsx                 #   앱 진입점 — StrictMode + ErrorBoundary
│   │   ├── App.tsx                  #   루트 컴포넌트 → SupportWorkspace 렌더링
│   │   ├── ErrorBoundary.tsx        #   전역 에러 경계
│   │   ├── index.css                #   글로벌 스타일 (Tailwind)
│   │   ├── pages/
│   │   │   └── support/
│   │   │       ├── SupportWorkspace.tsx     # 메인 작업 화면 (상담 목록 + 고객 상세 + 주문)
│   │   │       └── SupportAgentPanel.tsx    # AI 에이전트 대화 패널
│   │   └── lib/
│   │       ├── display.ts           #   포맷 유틸리티 (고객 레벨, 문서 미리보기)
│   │       ├── display.test.ts      #   display 유닛 테스트
│   │       └── utils.ts             #   clsx + tailwind-merge (cn 헬퍼)
│   ├── vite.config.ts               #   Vite 빌드 설정
│   ├── tailwind.config.ts           #   Tailwind 테마 설정
│   └── index.html                   #   SPA 진입 HTML
│
├── server/                          # 백엔드 (Express via AppKit)
│   ├── server.ts                    #   앱 진입점 — createApp() + 플러그인 등록
│   └── agents/
│       └── support.ts               #   RAG 에이전트 정의 (시스템 프롬프트 + 벡터 검색 도구)
│
├── shared/                          # 클라이언트–서버 공유 타입
│   └── appkit-types/
│       ├── analytics.d.ts           #   SQL 쿼리 응답 타입 (자동 생성)
│       └── serving.d.ts             #   서빙 엔드포인트 타입 (자동 생성)
│
├── config/                          # AppKit 플러그인 설정
│   ├── agents/                      #   에이전트 설정 (AppKit 관리)
│   └── queries/                     #   analytics 플러그인이 실행하는 SQL 쿼리
│       ├── recent_interactions.sql  #     최근 상담 목록 조회
│       ├── interaction_detail.sql   #     상담 건 상세 조회
│       ├── customer_orders.sql      #     고객 주문 이력 조회
│       ├── customer_history.sql     #     고객 과거 상담 이력 조회
│       └── support_sources.sql      #     벡터 검색 소스 조회
│
├── databricks/                      # Databricks Workspace 설정
│   ├── setup/
│   │   └── 01_create_tables.sql     #   CSV → Delta 테이블 생성 스크립트
│   └── config/
│       └── app-resources.json       #   Git 배포 시 앱 리소스 바인딩
│
├── tests/                           # E2E / Smoke 테스트
│   └── smoke.spec.ts                #   Playwright 스모크 테스트
│
├── scripts/                         # 개발 유틸리티 스크립트 (PowerShell)
│   ├── setup.ps1                    #   초기 로컬 환경 설정
│   ├── verify-tools.ps1             #   필수 도구 설치 확인
│   └── update-databricks-skills.ps1 #   Databricks 스킬 업데이트
│
├── docs/                            # 설계 문서
│   ├── ideas/                       #   제품 아이디어 브리프
│   └── decisions/                   #   아키텍처 결정 기록 (ADR)
│
├── app.yaml                         # Databricks Apps 앱 매니페스트
├── databricks.yml                   # Databricks Asset Bundle (DAB) 설정
├── appkit.plugins.json              # AppKit 플러그인 활성화 설정
├── package.json                     # Node.js 의존성 및 스크립트
├── tsconfig.json                    # TypeScript 기본 설정
├── tsconfig.client.json             # 클라이언트 TS 설정
├── tsconfig.server.json             # 서버 TS 설정
├── tsconfig.shared.json             # 공유 TS 설정
├── tsdown.server.config.ts          # 서버 번들 설정
├── vitest.config.ts                 # Vitest 단위 테스트 설정
├── playwright.config.ts             # Playwright E2E 테스트 설정
├── eslint.config.js                 # ESLint Flat Config (v9)
├── .prettierrc.json                 # Prettier 설정
├── .env.example                     # 환경 변수 템플릿
└── .node-version                    # Node.js 22.16
```

---

## 프론트엔드 (Client)

### 기술 구성

- **React 19** + **TypeScript 5.9** — UI 렌더링
- **@databricks/appkit-ui** — Databricks AppKit이 제공하는 Shadcn 기반 UI 컴포넌트 라이브러리
  - `useAnalyticsQuery` — SQL 쿼리 실행 훅
  - `useAgentChat` — AI 에이전트 스트리밍 대화 훅
  - `usePluginClientConfig` — 플러그인 런타임 설정 조회 훅
  - `Card`, `Dialog`, `Tabs`, `Badge`, `ScrollArea`, `Skeleton`, `Empty` 등 UI 프리미티브
- **Vite (`rolldown-vite`)** — 개발 서버 HMR 및 프로덕션 번들링
- **Tailwind CSS 4** — 유틸리티 기반 스타일링
- **Lucide React** — 벡터 아이콘
- **marked + DOMPurify** — LLM 마크다운 응답을 안전하게 HTML 렌더링
- **Zod** — 런타임 스키마 검증

### 주요 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| `SupportWorkspace` | `client/src/pages/support/SupportWorkspace.tsx` | 메인 화면. 상담 목록 ↔ 고객 상세 ↔ 주문 이력 ↔ 과거 상담을 하나의 워크스페이스로 구성 |
| `SupportAgentPanel` | `client/src/pages/support/SupportAgentPanel.tsx` | AI 에이전트 대화 패널. 컨텍스트를 전달하고 스트리밍 응답을 표시 |
| `ErrorBoundary` | `client/src/ErrorBoundary.tsx` | React Error Boundary로 전역 예외 포착 |

### 데이터 조회 패턴

프론트엔드는 `@databricks/appkit-ui/react`의 `useAnalyticsQuery` 훅과 `sql` 태그 함수를 사용합니다:

```tsx
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';

// 파라미터 바인딩이 적용된 SQL 실행
const { data, isLoading } = useAnalyticsQuery(
  sql`recent_interactions`
);
```

훅이 내부적으로 서버의 `analytics` 플러그인을 호출하고, 플러그인이 `config/queries/` 아래의 `.sql` 파일을 SQL Warehouse에서 실행합니다.

---

## 백엔드 (Server)

### 기술 구성

- **Databricks AppKit `createApp()`** — Express 앱 생성 + 플러그인 시스템
- **@databricks/sdk-experimental** — Databricks 서비스 연동 SDK
- **tsdown** — 서버 코드를 단일 `dist/server.js`로 번들링

### 서버 진입점 (`server/server.ts`)

```typescript
import { createApp, analytics, server } from '@databricks/appkit';
import { agents } from '@databricks/appkit/beta';
import { support } from './agents/support';

await createApp({
  plugins: [
    agents({ agents: { support }, defaultAgent: 'support', ... }),
    analytics(),  // SQL 쿼리 프록시
    server(),     // Express 웹 서버 + 정적 파일 서빙
  ],
  // 커스텀 API 엔드포인트 확장
  onPluginsReady(appkit) {
    appkit.server.extend((app) => {
      app.get('/api/whoami', (req, res) => { ... });
    });
  },
});
```

### 활성 플러그인

| 플러그인 | 역할 |
|---------|------|
| `agents` (beta) | LLM 에이전트 관리. 스트리밍 대화, 도구 호출, 동시 스트림 제한 |
| `analytics` | `config/queries/*.sql`을 SQL Warehouse에서 실행하는 RPC 프록시 |
| `server` | Express 웹 서버, 정적 파일 서빙, 개발 모드 HMR 프록시 |

### AI 에이전트 (`server/agents/support.ts`)

```typescript
export const support = createAgent({
  name: 'support',
  instructions: `... 시스템 프롬프트 (한국어) ...`,
  tools: {
    support_docs: {
      type: 'vector_search_index',
      vector_search_index: { name: 'customer_support_rag.support.support_docs_index' },
    },
  },
});
```

에이전트의 핵심 동작:
- **시스템 프롬프트**: 고객 컨텍스트(CONTEXT_JSON)에서 사실을 추출하고, 벡터 검색으로 근거를 확보한 뒤 한국어 답변 초안을 작성
- **`support_docs` 도구**: Databricks AI Search(Vector Search) 인덱스를 검색하는 도구. 상품 문서와 정책을 hybrid 검색으로 반환
- **안전 장치**: 프롬프트 인젝션 방어, 미확인 정보 생성 금지, 실제 업무 수행(환불 등) 금지 명시

---

## 데이터 레이어

### Unity Catalog 스키마

카탈로그: `customer_support_rag` / 스키마: `support`

| 테이블 | 설명 | 주요 키 |
|--------|------|---------|
| `customer` | 고객 마스터 (이름, 연락처, 등급) | `customer_id` |
| `orders` | 주문 이력 (배송지, 주문일, 상품) | `transaction_id`, `customer_id`, `product_id` |
| `cust_service` | 고객 상담 이력 (이슈 카테고리, 설명) | `interaction_id`, `customer_id` |
| `product_docs` | 상품 마스터 + 상품 문서 | `product_id` |
| `policies` | 고객 지원 정책 | `policy` |
| `rag_documents` | 벡터 인덱스용 정규화 문서 (CDF 활성) | `document_id` |

### 데이터 준비 과정

1. 원본 CSV를 `/Volumes/customer_support_rag/support/raw_data/source/`에 업로드
2. `databricks/setup/01_create_tables.sql`을 SQL Warehouse에서 실행
3. 5개 원본 Delta 테이블 + CDF가 활성화된 `rag_documents` 테이블 생성
4. `rag_documents`는 상품 문서와 정책을 하나의 스키마로 통합 → AI Search 인덱스의 소스로 사용

### SQL 쿼리 파일 (`config/queries/`)

| 쿼리 파일 | 용도 | 파라미터 |
|-----------|------|---------|
| `recent_interactions.sql` | 최근 상담 100건 목록 | 없음 |
| `interaction_detail.sql` | 개별 상담 건 상세 | `interaction_id` |
| `customer_orders.sql` | 고객 주문 이력 (최근 20건) | `customer_id` |
| `customer_history.sql` | 고객 과거 상담 이력 (최근 20건) | `customer_id` |
| `support_sources.sql` | 벡터 검색 (hybrid, 상위 5건) | `query_text` |

---

## RAG 파이프라인

```
┌─────────────┐    CONTEXT_JSON     ┌─────────────────┐
│ 프론트엔드   │ ─────────────────▶ │  support 에이전트 │
│ (고객 상세   │                    │  (Qwen3 80B)     │
│  + 주문 이력 │                    └────────┬────────┘
│  + 상담 내역)│                             │
└─────────────┘                    필요 시 도구 호출
                                             │
                                             ▼
                                  ┌──────────────────┐
                                  │  AI Search 인덱스 │
                                  │  (Vector Search)  │
                                  │                   │
                                  │  • 상품 문서       │
                                  │  • 정책 문서       │
                                  └────────┬─────────┘
                                           │
                                    검색 결과 반환
                                           │
                                           ▼
                              ┌──────────────────────┐
                              │   답변 초안 생성       │
                              │                       │
                              │  1. 고객 답변 초안     │
                              │  2. 상담원 확인 사항   │
                              │  3. 근거 출처 목록     │
                              └──────────────────────┘
```

1. 프론트엔드가 SQL Warehouse를 통해 고객·주문·상담 데이터를 조회
2. 조회된 데이터를 `CONTEXT_JSON`으로 구성해 `support` 에이전트에 전송
3. 에이전트는 LLM(Qwen3 80B)에 시스템 프롬프트와 컨텍스트를 전달
4. LLM이 필요 시 `support_docs` 도구로 AI Search 벡터 인덱스를 호출
5. 검색된 상품 문서·정책을 근거로 한국어 답변 초안을 스트리밍 생성

---

## Databricks 리소스

| 리소스 유형 | 이름 / ID | 용도 |
|------------|-----------|------|
| **App** | `tutorial-customer-app` | Databricks Apps 호스팅 |
| **SQL Warehouse** | `701725258168e981` | `analytics` 플러그인의 SQL 실행 |
| **Serving Endpoint** | `databricks-qwen3-next-80b-a3b-instruct` | LLM 답변 생성 |
| **AI Search Index** | `customer_support_rag.support.support_docs_index` | 벡터 검색 (hybrid) |
| **Embedding Model** | `databricks-qwen3-embedding-0-6b` | 벡터 인덱스 임베딩 |
| **Catalog / Schema** | `customer_support_rag.support` | 모든 Delta 테이블 소속 |

### 환경 변수 (`app.yaml`)

| 환경 변수 | 매핑 리소스 키 |
|-----------|---------------|
| `DATABRICKS_SERVING_ENDPOINT_NAME` | `agents-serving-endpoint` |
| `DATABRICKS_WAREHOUSE_ID` | `sql-warehouse` |
| `DATABRICKS_VECTOR_SEARCH_INDEX_NAME` | `support-docs-index` |

배포 시 `databricks.yml`의 DAB 변수가 리소스 키에 바인딩되어 자동으로 주입됩니다.

---

## 빌드 파이프라인

```
소스 코드
  │
  ├─▶ npm run sync         AppKit 플러그인 동기화 (prebuild에서 자동 실행)
  │
  ├─▶ npm run build:server  tsc (타입 체크) → tsdown (번들링) → dist/server.js
  │
  └─▶ npm run build:client  tsc (타입 체크) → Vite (번들링) → client/dist/
```

| 스크립트 | 도구 | 출력 |
|---------|------|------|
| `build:server` | `tsc` → `tsdown` | `dist/server.js` (단일 ESM 번들) |
| `build:client` | `tsc` → `vite build` | `client/dist/` (정적 파일) |
| `typegen` | `appkit generate-types` | `shared/appkit-types/*.d.ts` |
| `sync` | `appkit plugin sync` | 플러그인 설정 파일 동기화 |

**TypeScript 프로젝트 레퍼런스** 구조:
- `tsconfig.json` — 루트 (프로젝트 레퍼런스 허브)
- `tsconfig.server.json` — 서버 코드 (Node.js 타겟)
- `tsconfig.client.json` — 클라이언트 코드 (브라우저 타겟)
- `tsconfig.shared.json` — 공유 타입 (양쪽 참조)

---

## 로컬 개발

### 사전 요구 사항

- **Node.js** 22.16+ (`.node-version` 참고)
- **npm** (패키지 매니저)
- **Databricks CLI** + OAuth 프로필 설정 완료

### 환경 설정

```powershell
# 1. 초기 설정
./scripts/setup.ps1

# 2. 필수 도구 확인
./scripts/verify-tools.ps1

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일에서 프로필명과 Warehouse ID 수정

# 4. 의존성 설치
npm ci

# 5. 타입 생성 (SQL 쿼리 응답 타입)
npm run typegen
```

### 개발 서버 실행

```powershell
npm run dev
```

`http://localhost:8000`에서 개발 서버가 시작됩니다.
`tsx watch`가 서버 코드 변경을 감지하고, Vite가 클라이언트 HMR을 제공합니다.

> ⚠️ `.env` 파일과 인증 정보(`.databrickscfg`)는 절대 커밋하지 않습니다.

---

## 검사 및 테스트

```powershell
npm run typegen          # AppKit 타입 생성
npm run format           # Prettier 포맷 검사
npm run lint             # ESLint 린트
npm run lint:ast-grep    # AST 패턴 린트 (AppKit)
npm run typecheck        # TypeScript 타입 체크
npm run test             # Vitest 단위 테스트 + Playwright 스모크 테스트
npm run build            # 프로덕션 빌드
databricks bundle validate --profile <프로필명>   # DAB 유효성 검증
databricks apps validate --profile <프로필명>     # 앱 매니페스트 검증
```

### 테스트 전략

| 종류 | 도구 | 대상 |
|------|------|------|
| **단위 테스트** | Vitest | 유틸리티 함수 (`lib/display.ts` 등) |
| **스모크 테스트** | Playwright | 전체 앱 빌드 후 UI 렌더링, 콘솔 에러, 네트워크 실패 감지 |

---

## 배포

### DAB (Databricks Asset Bundles) 배포 — 권장

```powershell
# 1. 기존 App에 Bundle 바인딩 (최초 1회)
databricks bundle deployment bind app <APP_ID> --auto-approve --profile <프로필명>

# 2. 앱 배포
databricks apps deploy --profile <프로필명>
```

### Git 브랜치 직접 배포

Databricks UI에서 Git 브랜치를 직접 배포하는 경우, DAB 리소스 선언이 적용되지 않으므로 먼저 리소스를 수동 연결합니다:

```powershell
databricks apps create-update tutorial-customer-app \
  --json '@databricks/config/app-resources.json' \
  --profile <프로필명>
```

### 배포 시 주의 사항

- 배포 이미지의 `npm install` + `npm run build`는 외부 Warehouse에 접속하지 않음
- SQL/Serving 타입은 개발 중 `npm run typegen`으로 생성 후 커밋
- `app.yaml`의 `command: ['npm', 'run', 'start']`로 프로덕션 서버 실행
- 프로덕션 엔트리포인트: `node ./dist/server.js` (빌드된 서버 번들)

---

## 설계 문서

- [제품 아이디어](docs/ideas/customer-support-rag-app.md) — 초기 제품 방향과 기능 정의
- [아키텍처 결정](docs/decisions/0001-customer-support-rag-architecture.md) — ADR: 데이터 접근 방식과 기술 선택 근거

---

## 라이브러리 상세

### Production Dependencies

| 패키지 | 용도 |
|--------|------|
| `@databricks/appkit` | AppKit 서버 프레임워크 (Express 통합, 플러그인 시스템) |
| `@databricks/appkit-ui` | AppKit UI 컴포넌트 (React 훅, SQL 쿼리, 에이전트 채팅) |
| `@databricks/sdk-experimental` | Databricks REST API SDK |
| `react`, `react-dom` | React 19 UI 렌더링 |
| `react-router` | 클라이언트 라우팅 |
| `react-resizable-panels` | 리사이즈 가능한 패널 레이아웃 |
| `lucide-react` | 벡터 아이콘 라이브러리 |
| `clsx`, `tailwind-merge` | 조건부 클래스 병합 유틸리티 |
| `tailwindcss-animate`, `tw-animate-css` | Tailwind 애니메이션 플러그인 |
| `next-themes` | 다크/라이트 테마 지원 |
| `embla-carousel-react` | 캐러셀 컴포넌트 |
| `zod` | 런타임 스키마 검증 |

### Dev Dependencies

| 패키지 | 용도 |
|--------|------|
| `typescript` | TypeScript 컴파일러 (5.9) |
| `vite` (`rolldown-vite`) | 클라이언트 번들러 + 개발 서버 |
| `@vitejs/plugin-react` | Vite React Fast Refresh |
| `tsdown` | 서버 번들러 (Rolldown 기반) |
| `tsx` | TypeScript 직접 실행 (개발 모드) |
| `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/postcss` | Tailwind CSS 4 빌드 도구 |
| `autoprefixer` | CSS 벤더 프리픽스 자동 적용 |
| `eslint`, `@typescript-eslint/*`, `eslint-plugin-react*` | 린트 |
| `eslint-config-prettier` | Prettier와 ESLint 규칙 충돌 해소 |
| `prettier` | 코드 포매터 |
| `@ast-grep/napi` | AST 기반 패턴 린트 (AppKit 규칙) |
| `vitest` | 단위 테스트 프레임워크 |
| `@playwright/test` | E2E / 스모크 테스트 |
| `cross-env` | 플랫폼 독립적 환경 변수 설정 |
| `sharp` | 이미지 처리 (빌드 시) |

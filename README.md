# Databricks Customer Support Copilot

Databricks AppKit, Delta Lake, AI Search, Foundation Model API를 결합한 내부 상담원용 RAG 앱입니다. 상담 건을 선택하면 고객 마스터, 주문, 과거 상담을 한 화면에 보여 주고 상품 문서와 정책에 근거한 한국어 답변 초안을 스트리밍으로 제안합니다.

전체 Workspace 준비 과정과 실행 순서는 [README.ipynb](README.ipynb)에 정리되어 있습니다.

## 확정 리소스

- Databricks App: `tutorial-customer-app` (`1ea7e2d7-f158-4a9a-bb31-6532b34ed67b`)
- Catalog / Schema: `customer_support_rag.support`
- Managed volume: `customer_support_rag.support.raw_data`
- AI Search endpoint: `customer-support-search`
- AI Search index: `customer_support_rag.support.support_docs_index`
- SQL warehouse: `701725258168e981`
- Answer model: `databricks-qwen3-next-80b-a3b-instruct`
- Embedding model: `databricks-qwen3-embedding-0-6b`

기존 `tutorial` 카탈로그의 테이블은 앱에서 사용하지 않습니다. 이전 `tutorial-search` 인덱스와 엔드포인트는 새 구성을 만들기 전에 삭제했습니다.

## 데이터 준비

원본 CSV를 `/Volumes/customer_support_rag/support/raw_data/source/`에 업로드한 다음 [01_create_tables.sql](databricks/setup/01_create_tables.sql)을 SQL Warehouse에서 실행합니다. 스크립트는 다섯 원본 Delta 테이블과 Change Data Feed가 활성화된 `rag_documents`를 만듭니다.

고객 속성은 `customer.customer_id`, 상품명은 `product_docs.product_id`를 기준으로 사용합니다. 원본 상담 전화번호와 주문 상품명에 일부 불일치가 있기 때문에 중복 필드보다 마스터 값을 우선합니다.

## 로컬 개발

Node.js 22.16 이상(22.x), npm, Databricks CLI와 선택한 OAuth 프로필이 필요합니다. 로컬 리소스 값은 `.env.example`을 복사한 `.env`에 두며 `.env`와 인증 정보는 커밋하지 않습니다.

```powershell
npm ci
npm run dev
```

AppKit 개발 서버는 기본적으로 `http://localhost:8000`에서 실행됩니다.

## 검사

```powershell
npm run typegen
npm run format
npm run lint
npm run lint:ast-grep
npm run typecheck
npm run test
npm run build
databricks bundle validate --profile codex-databricks
databricks apps validate --profile codex-databricks
```

## 기존 App에 연결하고 배포

배포 전에 Bundle의 `app` 리소스를 미리 만든 App ID에 한 번 연결합니다. 연결 후 이 App은 Bundle이 관리하므로 UI의 수동 변경이 다음 배포에서 덮어써질 수 있습니다.

```powershell
databricks bundle deployment bind app 1ea7e2d7-f158-4a9a-bb31-6532b34ed67b --auto-approve --profile codex-databricks
databricks bundle deploy --profile codex-databricks
```

앱 리소스 선언은 서비스 주체에 SQL Warehouse `CAN_USE`, Qwen 모델 `CAN_QUERY`, 필요한 Delta 테이블과 AI Search 인덱스 `SELECT`만 부여합니다.

## 설계 문서

- [제품 아이디어](docs/ideas/customer-support-rag-app.md)
- [아키텍처 결정](docs/decisions/0001-customer-support-rag-architecture.md)

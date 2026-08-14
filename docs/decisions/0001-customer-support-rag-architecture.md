# ADR-0001: AppKit 기반 상담원 RAG 아키텍처 선택

- Status: Accepted
- Date: 2026-08-14
- Owners: 강찬

## Context

과제는 CSV 5개를 Databricks에 적재하고 RAG와 Agent 호출을 결합한 내부 상담원 앱을 만드는 것이다. 사용자는 기존 카탈로그와 기존 AI Search 엔드포인트를 재사용하지 않고 새 리소스를 만들되, 미리 생성한 Databricks App `tutorial-customer-app`(ID `1ea7e2d7-f158-4a9a-bb31-6532b34ed67b`)은 재사용하기로 했다. 환경은 Free Edition이므로 리소스 수와 모델 가용성 제약을 고려해야 한다.

원본 진단 결과 고객과 상품의 관계 키는 완전하지만, 상담 데이터의 전화번호 28건과 주문 데이터의 상품명 일부가 마스터와 다르다. 따라서 고객은 `customer.customer_id`, 상품은 `product_docs.product_id`와 정식 상품명을 기준으로 결합해야 한다.

## Options considered

### Option A: AI/BI Dashboard와 고정 SQL 설명 화면

- 장점: 구현과 운영이 단순하고 정형 데이터 조회에 적합하다.
- 단점: 상담 건 선택, 다중 문맥 조합, 스트리밍 에이전트 답변 같은 상호작용을 자연스럽게 제공하기 어렵다.
- 위험: 과제의 Agent 호출과 RAG 사용자 흐름을 충분히 보여주지 못한다.

### Option B: AppKit Custom App + Analytics + Agents + AI Search

- 장점: SQL 기반 고객 문맥, AI Search 근거 검색, 에이전트 스트리밍 답변을 한 화면에 결합할 수 있다.
- 단점: AppKit Agents 플러그인은 beta이고 Free Edition 할당량의 영향을 받는다.
- 위험: 검색 인덱스 동기화나 모델 할당량이 소진되면 일부 기능이 일시적으로 실패할 수 있다.

### Option C: Python 전용 앱과 직접 REST 오케스트레이션

- 장점: Python SDK 예제가 많고 검색·모델 호출을 직접 제어할 수 있다.
- 단점: 팀이 Python 전용이라는 요구가 없으며, 신규 전체 스택 앱에 대한 저장소 기본값인 AppKit을 벗어난다.
- 위험: UI와 인증·스트리밍 코드를 더 많이 직접 유지해야 한다.

## Decision

Option B를 선택한다.

- AppKit 0.38.1의 `analytics`, beta `agents`, `server` 플러그인을 사용한다.
- 앱은 읽기 전용 분석 패턴으로 구현하고 별도 Lakebase 상태 저장소는 만들지 않는다.
- 신규 관리형 카탈로그 `customer_support_rag`, 스키마 `support`, 볼륨 `raw_data`를 사용한다.
- 원본 CSV는 명시적 스키마로 Delta 테이블에 적재한다. RAG용 `rag_documents`에는 Change Data Feed를 활성화한다.
- 신규 STANDARD AI Search 엔드포인트 `customer-support-search`와 HYBRID Delta Sync 인덱스 `customer_support_rag.support.support_docs_index`를 사용한다.
- 임베딩 모델은 `databricks-qwen3-embedding-0-6b`, 답변 모델은 실제 Workspace 호출을 확인한 `databricks-qwen3-next-80b-a3b-instruct`를 사용한다.
- 앱 서비스 주체에는 Bundle의 앱 리소스를 통해 SQL Warehouse `CAN_USE`, 모델 엔드포인트 `CAN_QUERY`, 필요한 테이블과 AI Search 인덱스 `SELECT`만 부여한다.
- 기존 `tutorial.default` 데이터는 사용하지 않는다. 기존 `tutorial-search`의 인덱스와 엔드포인트는 사용자 요청에 따라 삭제하고 복구 대상으로 유지하지 않는다.

## Consequences

- 상담원은 하나의 앱에서 고객 문맥과 출처가 표시된 답변 초안을 확인할 수 있다.
- AI Search와 Foundation Model 할당량을 사용하며, Free Edition 제한에 도달하면 명확한 오류 상태를 보여야 한다.
- Agents beta API가 변경될 경우 AppKit 버전 업그레이드는 별도 결정과 검증이 필요하다.
- 초기 범위는 읽기 전용이다. 주문 변경, 환불, CRM 기록 같은 쓰기 도구를 추가하려면 별도의 권한·승인·감사 설계가 필요하다.

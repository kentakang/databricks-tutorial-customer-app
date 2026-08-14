# Customer Support RAG App

## Problem

- 해결하려는 문제: 상담원이 고객 문의를 처리할 때 고객 마스터, 주문 이력, 과거 상담, 상품 문서, 정책을 여러 화면에서 찾아야 한다.
- 현재 해결 방식과 불편: 문의 문장만으로 답변을 작성하면 주문·정책 근거를 빠뜨리거나 원본 데이터의 중복 필드를 잘못 사용할 수 있다.
- 지금 해결해야 하는 이유: Databricks의 Delta Lake, AI Search, Foundation Model API, Apps를 한 흐름으로 검증하는 과제의 구체적인 사용자 시나리오가 필요하다.

## Users and outcomes

- 주요 사용자: Databricks Workspace에 로그인한 내부 고객 상담원.
- 사용자가 완료하려는 작업: 상담 건을 선택하고 고객·주문·과거 상담 정보를 확인한 뒤, 상품 문서와 정책에 근거한 답변 초안을 얻는다.
- 성공 기준: 한 화면에서 상담 문맥을 확인하고, AI 답변에 사용된 근거를 추적하며, 답변을 복사해 후속 상담에 사용할 수 있다.

## Core workflow

1. 상담원이 최근 상담 목록에서 고객 문의를 선택한다.
2. 앱이 고객 마스터, 주문 이력, 과거 상담 이력과 문의 상세를 조회한다.
3. 앱이 AI Search로 관련 상품 문서·정책을 검색한다.
4. 읽기 전용 상담 에이전트가 구조화된 고객 문맥과 검색 근거를 바탕으로 답변 초안을 생성한다.
5. 상담원이 근거와 주의 문구를 검토한 뒤 초안을 복사하거나 추가 질문을 한다.

## Data and platform decisions

- 신규 Unity Catalog `customer_support_rag`, 스키마 `support`, 관리형 볼륨 `raw_data`만 사용한다.
- Delta 테이블: `customer`, `orders`, `cust_service`, `product_docs`, `policies`, `rag_documents`.
- 고객 속성은 `customer`, 상품명은 `product_docs`, 관계는 `customer_id`와 `product_id`를 기준으로 한다.
- 분석 조회는 기존 Serverless Starter Warehouse를 사용하며 앱 자체에는 영속적인 쓰기 기능을 두지 않는다.
- 상품 문서와 정책은 Delta Sync AI Search 인덱스 `customer_support_rag.support.support_docs_index`에서 검색한다.
- 답변 모델은 Free Edition Workspace에서 실제 호출을 확인한 `databricks-qwen3-next-80b-a3b-instruct`를 사용한다.
- 단순 차트가 아니라 상담 건 선택, 다중 데이터 조회, AI 답변 생성이 결합된 워크플로이므로 Custom Databricks App이 적합하다.

## Risks and unknowns

- 고객 이름·이메일·전화번호·주소는 개인정보이므로 앱 리소스와 Unity Catalog 권한을 최소 권한으로 제한해야 한다.
- Free Edition의 앱 실행 시간, AI Search 용량, 모델 토큰 할당량에 따라 응답이 중단될 수 있다.
- AI 답변은 초안이며 상담원이 근거를 검토해야 한다. 주문 변경·환불 실행 같은 쓰기 작업은 제공하지 않는다.
- `cust_service`의 전화번호 28건과 주문 상품명 일부는 마스터와 불일치하므로 마스터 테이블 값을 우선한다.

## Proposed slice

- 첫 번째 최소 흐름: 최근 상담 선택 → 고객/주문/이력 확인 → 상품·정책 근거 확인 → 답변 초안 생성 및 복사.
- 이번 범위에서 제외: 상담 상태 저장, CRM 쓰기, 주문 취소/환불 실행, 상담원 성과 대시보드, 장기 대화 저장.
- 검증 방법: Delta 행 수·키 관계 검사, AI Search 결과 검사, AppKit 타입/린트/테스트/빌드, `databricks bundle validate`, `databricks apps validate`.

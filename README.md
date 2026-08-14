# Databricks Tutorial Customer App

Databricks App의 제품 아이디어 구체화와 구현을 Codex에서 이어가기 위한 저장소입니다.

현재는 개발 도구와 에이전트 작업 규약만 구성되어 있습니다. 앱 프레임워크와 데이터 연결은 제품 요구사항이 정해진 뒤 Databricks AppKit의 `databricks apps init`으로 생성합니다. 이렇게 하면 Analytics, Lakebase, Genie 등 필요한 기능과 리소스를 먼저 결정하고 불필요한 인프라를 만들지 않을 수 있습니다.

## 준비된 환경

- Databricks CLI 0.294.0 이상과 OAuth 프로필
- Node.js 22.16 이상(22.x)
- `uv`와 Python 3.11
- 저장소 범위의 공식 Databricks Codex 스킬 10개
- Conventional Commits 검증 Git 훅
- 아이디어와 아키텍처 결정 기록 템플릿

인증 토큰과 `.databrickscfg`는 저장소에 커밋하지 않습니다.

## 최초 설정

Windows PowerShell에서 다음 명령을 실행합니다.

```powershell
./scripts/setup.ps1
./scripts/verify-tools.ps1
```

터미널이 설치 직후의 PATH를 아직 인식하지 못하면 Codex 또는 터미널을 한 번 다시 시작합니다.

현재 설치된 Databricks 프로필을 확인한 뒤, 실제 Workspace 명령을 실행할 때 항상 명시적으로 선택합니다.

```powershell
databricks auth profiles
databricks apps list --profile <profile-name>
```

## 아이디어에서 앱 골격까지

1. [아이디어 템플릿](docs/ideas/README.md)에 문제, 사용자, 성공 기준과 데이터 요구사항을 정리합니다.
2. 단순 시각화면 관리형 AI/BI Dashboard와 Custom Databricks App을 비교합니다.
3. 영속적인 쓰기 작업이 필요한지 확인하고, 읽기 데이터에는 Analytics와 Lakebase synced tables 중 적합한 방식을 선택합니다.
4. `databricks apps manifest`로 현재 AppKit 기능과 필수 리소스를 확인합니다.
5. 선택한 프로필과 리소스를 명시해 `databricks apps init`을 실행합니다.
6. 앱 코드가 생성되면 해당 템플릿의 `validate`, `test`, `lint`, `typecheck` 명령을 품질 기준으로 사용합니다.

프레임워크와 리소스가 확정된 결정은 [ADR 템플릿](docs/decisions/0000-template.md)으로 기록합니다.

## 에이전트 스킬 갱신

Databricks CLI가 배포하는 공식 스킬을 같은 선택 목록으로 갱신하려면 다음을 실행합니다.

```powershell
./scripts/update-databricks-skills.ps1
```

갱신 후에는 변경 내용을 검토하고 독립된 `chore(codex): ...` 커밋으로 기록합니다.

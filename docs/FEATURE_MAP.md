# SeeV Feature Map

이 문서는 SeeV 프로젝트의 주요 기능과 관련 파일을 빠르게 파악하기 위한 안내서입니다. 다른 개발자나 생성형 AI에게 작업을 이어 맡길 때 이 파일을 먼저 보여주면 전체 맥락을 잡기 쉽습니다.

## Core Routes

- `app/workspace/page.tsx`
  - 로그인한 사용자의 workspace 첫 화면입니다.
  - 프로젝트 생성, 프로젝트 목록, 공유 요청, 평가 취합 진입 버튼을 다룹니다.
  - ADMIN은 전체 프로젝트를 볼 수 있고, 프로젝트 소유자와 ADMIN은 평가 취합으로 들어갈 수 있습니다.

- `app/workspace/projects/[projectId]/page.tsx`
  - 단일 프로젝트 평가 화면입니다.
  - 프로젝트 접근 권한을 확인하고, 케이스/이미지/임상데이터/모델예측/유저별 편집값을 불러옵니다.
  - `ProjectCaseViewer`에 화면용 데이터를 넘깁니다.

- `app/workspace/projects/[projectId]/review/page.tsx`
  - 평가 취합 화면입니다.
  - 프로젝트 소유자 또는 ADMIN만 접근합니다.
  - 공유받은 사용자들의 수정 결과를 케이스별 표로 보여줍니다.

## Project Viewer Components

- `components/project-case-viewer.tsx`
  - 프로젝트 평가 화면의 최상위 조립 컴포넌트입니다.
  - 선택된 case, 예측값 편집 상태, 비교 column 상태를 관리합니다.
  - 실제 UI는 아래 컴포넌트로 위임합니다.

- `components/project/types.ts`
  - `CaseRow`, annotation 타입, drag state, table sort 타입을 모아둔 파일입니다.
  - 프로젝트 평가 화면에서 공유하는 데이터 계약입니다.

- `components/project/data-utils.ts`
  - 테이블 column 추출, 표시값 처리, 유저별 모델예측 편집값 병합, 숫자 입력 검증을 담당합니다.

## Image Viewer And Annotation

- `components/project/image-viewer/annotatable-image-viewer.tsx`
  - 이미지 표시, fit-to-view, wheel zoom, pan, minimap, annotation 생성/수정/삭제/저장을 담당합니다.
  - polygon은 클릭 방식과 드래그 방식을 모두 지원합니다.
  - rectangle은 생성, 이동, 크기 조절, 삭제를 지원합니다.
  - annotation은 이미지 원본 pixel 좌표 기준으로 저장됩니다.

- `components/project/image-viewer/geometry.ts`
  - annotation 좌표 계산 유틸입니다.
  - rectangle 정규화/resize, polygon path, 거리 계산, polygon close threshold, clamp 등을 담당합니다.

- `app/api/projects/[projectId]/cases/[caseId]/annotations/route.ts`
  - 사용자별 annotation 저장/불러오기 API입니다.
  - DB의 `ProjectCaseAnnotation` 모델을 사용합니다.

## Data Tables

- `components/project/tables/clinical-data-panel.tsx`
  - 선택된 case의 임상데이터를 가로형 테이블로 보여줍니다.

- `components/project/tables/prediction-data-table.tsx`
  - 모델예측 결과 테이블입니다.
  - `image_id` 클릭 시 Image Viewer의 선택 case를 바꿉니다.
  - 숫자형 값만 수정 가능하며, 저장 버튼으로 사용자별 편집값을 저장합니다.
  - 정렬, 페이지네이션, 30/60/90 rows 표시 옵션을 지원합니다.
  - 통합열을 선택하면 다른 사용자들의 해당 column 편집값을 함께 보여줍니다.

- `components/project-review-table.tsx`
  - 평가 취합 페이지의 테이블입니다.
  - 여러 column을 체크박스로 선택할 수 있습니다.
  - 각 column은 원본값과 `column name (공유받은사람이름)` 형태의 사용자별 편집값으로 펼쳐집니다.

- `app/api/projects/[projectId]/cases/[caseId]/prediction/route.ts`
  - 사용자별 모델예측 수정값 저장 API입니다.
  - DB의 `ProjectCasePredictionEdit` 모델을 사용합니다.

## Upload And Project Data

- `lib/project-upload.ts`
  - 프로젝트 생성/업데이트 시 업로드 파일 저장과 파싱을 담당합니다.
  - CSV/XLSX/XLS 임상데이터와 모델예측 데이터를 파싱합니다.
  - 이미지 폴더 업로드 시 비이미지 파일은 제외합니다.
  - `image_folder`와 `image_id`를 기반으로 업로드 이미지와 prediction row를 연결합니다.

- `components/project-data-upload.tsx`
  - 기존 프로젝트에 임상데이터/모델예측/이미지를 추가 또는 교체하는 업로드 UI입니다.

- `app/api/projects/[projectId]/data/route.ts`
  - 프로젝트 데이터 추가/변경 API입니다.

## Sharing And Aggregation

- `components/workspace-actions.tsx`
  - workspace의 프로젝트 생성, 공유하기, 공유 요청 수락/거절 UI를 담당합니다.
  - 프로젝트 카드에서 `들어가기`, `평가 취합`, `공유하기` 버튼을 보여줍니다.

- `prisma/schema.prisma`
  - 핵심 모델:
    - `Project`, `ProjectFile`, `ProjectCase`
    - `ProjectShare`
    - `ProjectCaseAnnotation`
    - `ProjectCasePredictionEdit`
  - annotation과 prediction edit는 모두 `caseId + userId` 기준으로 사용자별 저장됩니다.

## Maintenance Notes

- Image Viewer 관련 변경은 우선 `components/project/image-viewer/annotatable-image-viewer.tsx`와 `geometry.ts`를 확인하세요.
- 모델예측 테이블 관련 변경은 `components/project/tables/prediction-data-table.tsx`를 확인하세요.
- 평가 취합 관련 변경은 `components/project-review-table.tsx`와 review route를 확인하세요.
- 데이터 파싱/업로드 문제는 `lib/project-upload.ts`를 확인하세요.
- DB 구조 변경 시 `prisma/schema.prisma` 수정 후 `npx prisma db push`와 `npx prisma generate`가 필요합니다.

## Known Build Warning

- `lib/project-upload.ts`에서 dynamic upload path 때문에 Turbopack broad file pattern warning이 발생합니다.
- 현재 빌드는 성공하지만, 추후 성능 정리가 필요하면 업로드 파일 접근 경로를 더 명시적으로 제한하는 리팩터링을 검토하세요.

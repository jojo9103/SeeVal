# SeeV Feature Map

이 문서는 SeeV 프로젝트의 주요 기능과 관련 파일을 빠르게 파악하기 위한 안내서입니다. 다른 개발자나 생성형 AI에게 작업을 이어 맡길 때 이 파일을 먼저 보여주면 전체 맥락을 잡기 쉽습니다.

## Core Routes

- `app/workspace/page.tsx`
  - 로그인한 사용자의 workspace 첫 화면입니다.
  - 프로젝트 생성, 프로젝트 목록, Notification, 평가 취합 진입 버튼을 다룹니다.
  - ADMIN은 전체 프로젝트를 볼 수 있고, 프로젝트 소유자와 ADMIN은 평가 취합으로 들어갈 수 있습니다.
  - 공유 받은 요청은 Notification에서 수락/거절하며, ADMIN 공지사항도 같은 Notification에서 배너 형식으로 확인합니다.
  - 프로젝트 삭제는 soft delete입니다. `Project.deletedAt`만 기록하고 DB row와 업로드 파일은 복구를 위해 보관합니다.

- `app/workspace/projects/[projectId]/page.tsx`
  - 단일 프로젝트 평가 화면입니다.
  - 프로젝트 접근 권한을 확인하고, 케이스/이미지/임상데이터/모델예측/유저별 편집값을 불러옵니다.
  - `ProjectCaseViewer`에 화면용 데이터를 넘깁니다.
  - 데이터 추가/변경 후 `ProjectCaseViewer` key가 바뀌어 새 케이스 데이터가 즉시 반영됩니다.

- `app/workspace/projects/[projectId]/review/page.tsx`
  - 평가 취합 화면입니다.
  - 프로젝트 소유자 또는 ADMIN만 접근합니다.
  - 공유받은 사용자들의 수정 결과를 케이스별 표로 보여줍니다.
  - `ProjectReviewTable`에 프로젝트명, 공유 사용자, 케이스별 원본/수정값, 수정 허용 column 저장 action을 넘깁니다.

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
  - Image Viewer의 상위 조립 컴포넌트입니다.
  - 이미지 fit-to-view, wheel zoom, pan, polygon/rectangle drawing state, pointer event 흐름을 관리합니다.
  - 초기 fit 상태에서도 이미지가 viewer 영역보다 큰 경우 드래그로 위치를 이동할 수 있습니다.
  - polygon은 클릭 방식과 드래그 방식을 모두 지원합니다.
  - rectangle은 생성, 이동, 크기 조절, 삭제를 지원합니다.
  - annotation은 이미지 원본 pixel 좌표 기준으로 저장됩니다.
  - 툴바 우측 이미지 이동 버튼으로 이미지가 있는 케이스를 이전/다음 순서로 넘길 수 있습니다.

- `components/project/image-viewer/viewer-toolbar.tsx`
  - 선택/사각형/polygon 도구, 확대/축소, polygon 완료, 삭제, JSON 다운로드, 이미지 이전/다음 버튼을 담당합니다.

- `components/project/image-viewer/minimap.tsx`
  - 우측 상단 minimap과 minimap 클릭 이동을 담당합니다.

- `components/project/image-viewer/annotation-shape.tsx`
  - SVG 위의 rectangle/polygon 렌더링, 선택, resize handle, polygon point handle을 담당합니다.

- `components/project/image-viewer/annotation-list.tsx`
  - Image Viewer 하단 annotation 목록과 annotation 이름 수정을 담당합니다.

- `components/project/image-viewer/use-image-annotations.ts`
  - 사용자별 annotation 불러오기와 debounce 저장을 담당합니다.

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
  - 프로젝트별 수정 허용 column에 포함된 숫자형 값만 수정 가능하며, 저장 버튼으로 사용자별 편집값을 저장합니다.
  - 정렬, 페이지네이션, 30/60/90 rows 표시 옵션을 지원합니다.
  - 임상데이터와 모델예측 데이터는 고정 컬럼이 아니라 양쪽 데이터의 공통 컬럼 값으로 연결됩니다.

- `components/project-review-table.tsx`
  - 평가 취합 페이지의 테이블입니다.
  - 여러 column을 체크박스로 선택할 수 있습니다.
  - 각 column은 원본값과 `column name (공유받은사람이름)` 형태의 사용자별 편집값으로 펼쳐집니다.
  - 선택한 column을 저장하면 프로젝트 평가 화면에서 해당 column만 모델예측 수정 가능 항목이 됩니다.
  - `CSV`, `TSV`, `Excel` 중 저장 형식을 선택한 뒤 `저장하기`를 누르면 현재 취합 결과를 파일로 내려받습니다.
  - 내보내기 데이터는 현재 선택된 column 기준이며, `sample`, `image_id`, 원본값, 공유 사용자별 수정값 순서로 구성됩니다.
  - CSV/TSV는 브라우저 Blob 다운로드를 사용하고, Excel은 `xlsx`의 `aoa_to_sheet`/`writeFile`을 사용합니다.

- `components/ui/select-native.tsx`
  - 기본 HTML `select`를 SeeV 어두운 UI에 맞춰 감싼 공통 컴포넌트입니다.
  - `lucide-react`의 `ChevronDown` 아이콘을 사용합니다.
  - 평가 취합 파일 저장 형식 선택 UI에서 사용합니다.

- `components/project-annotation-review-viewer.tsx`
  - 평가 취합 페이지에서 환자별 annotation 요약과 이미지 overlay 취합을 담당합니다.
  - 환자별로 annotation 개수와 사용자별 개수를 짧게 보여주고, 선택한 환자의 이미지 위에 여러 사용자의 rectangle/polygon을 색상별로 함께 표시합니다.
  - annotation 좌표는 저장된 이미지 원본 pixel 좌표를 그대로 사용해 overlay합니다.

- `app/api/projects/[projectId]/cases/[caseId]/prediction/route.ts`
  - 사용자별 모델예측 수정값 저장 API입니다.
  - DB의 `ProjectCasePredictionEdit` 모델을 사용합니다.

## Upload And Project Data

- `lib/project-upload.ts`
  - 프로젝트 생성/업데이트 시 업로드 파일 저장과 파싱을 담당합니다.
  - CSV/XLSX/XLS 임상데이터와 모델예측 데이터를 파싱합니다.
  - 이미지 폴더 업로드 시 비이미지 파일은 제외합니다.
  - 임상데이터와 모델예측 데이터는 공통 컬럼 중 값이 일치하고 충돌하지 않는 row를 기준으로 연결합니다.
  - `image_folder`와 `image_id`를 기반으로 업로드 이미지와 prediction row를 연결합니다. `image_folder`는 이미지 폴더/파일 매칭에 쓰입니다.
  - 데이터 교체 업로드는 DB 삭제/생성/케이스 재생성을 트랜잭션으로 묶어 중간 실패에 더 강하게 처리합니다.

- `lib/project-storage.ts`
  - 업로드 파일 저장 경로와 `/api/project-files/...` 파일 URL 생성을 담당합니다.
  - 기본 저장소는 `.seeval-uploads/projects`이며 운영에서는 `SEEV_UPLOAD_DIR`로 코드 폴더 밖 경로를 지정할 수 있습니다.

- `app/api/project-files/[projectId]/[...filePath]/route.ts`
  - 업로드된 프로젝트 파일을 권한 확인 후 제공합니다.
  - 삭제된 프로젝트(`deletedAt` 존재)는 파일 접근이 차단됩니다.

- `components/project-data-upload.tsx`
  - 기존 프로젝트에 임상데이터/모델예측/이미지를 추가 또는 교체하는 업로드 UI입니다.

- `app/api/projects/[projectId]/data/route.ts`
  - 프로젝트 데이터 추가/변경 API입니다.

## Sharing And Aggregation

- `components/workspace-actions.tsx`
  - 기존 import 경로 호환을 위한 re-export 파일입니다.
  - 실제 workspace UI는 `components/workspace/` 아래 기능별 파일에 나뉘어 있습니다.

- `components/workspace/`
  - `project-workspace-panel.tsx`: 프로젝트 목록, 생성/공유/공유상태 모달을 조립하는 상위 컴포넌트입니다.
  - `project-card.tsx`: 프로젝트 카드와 `들어가기`, `평가 취합`, `공유요청상황`, `공유하기`, `삭제` 버튼을 담당합니다.
  - `create-project-modal.tsx`: 프로젝트 생성과 업로드 진행률 표시 UI를 담당합니다.
  - `share-project-modal.tsx`: 공유 대상 검색 및 공유 요청/바로 공유 UI를 담당합니다.
  - `share-status-list.tsx`: 프로젝트별 공유 요청 상태와 공유 허가된 사용자 목록을 보여줍니다.
  - `notification-center.tsx`: 받은 공유 요청 수락/거절과 ADMIN 공지사항 배너 확인을 담당합니다.
  - `edit-profile-button.tsx`: 회원 정보 수정 모달입니다.
  - `common.tsx`, `format.ts`, `types.ts`: 공통 모달/배너/표시 포맷/타입을 담당합니다.

- `app/admin/accounts/page.tsx`
  - 관리자 계정 승인/거절, ADMIN 업로드 프로젝트 확인, ADMIN 공지사항 server action을 담당합니다.
  - 등록된 ADMIN 공지사항은 workspace Notification에 배너 형식으로 표시됩니다.
  - 공지사항 create/update/recall/republish/delete action을 정의하고 `AdminNoticeSection`에 넘깁니다.

- `components/admin-notice-banner-composer.tsx`
  - `AdminNoticeSection`: ADMIN 공지사항 영역 전체를 조립합니다.
  - `AdminNoticeBannerComposer`: 공지 작성/수정 배너 오버레이 입력 폼입니다.
  - 공지 목록에서 수정, 회수, 재게시, 삭제 액션을 제공합니다.
  - 회수된 공지는 ADMIN 목록에는 `회수됨`으로 남고 Workspace Notification에서는 숨겨집니다.
  - 삭제된 공지는 `AdminNotice.deletedAt`이 기록되어 ADMIN 목록에서도 숨겨집니다.

- `prisma/schema.prisma`
  - 핵심 모델:
    - `Project`, `ProjectFile`, `ProjectCase`
    - `ProjectShare`
    - `ProjectCaseAnnotation`
    - `ProjectCasePredictionEdit`
    - `AdminNotice`
  - annotation과 prediction edit는 모두 `caseId + userId` 기준으로 사용자별 저장됩니다.
  - `Project.deletedAt`은 soft delete에 사용됩니다. 삭제된 프로젝트는 일반 목록/상세/API 접근에서 제외됩니다.
  - `AdminNotice`는 ADMIN 공지사항을 저장하고 작성자 USER와 연결됩니다.
  - `AdminNotice.recalledAt`은 공지 회수에 사용되며, `deletedAt`은 공지 삭제에 사용됩니다.

- `scripts/backup-seeval.sh`
  - `pg_dump`로 DB를 백업하고, 업로드 저장소를 tar.gz로 백업합니다.
  - `SEEV_BACKUP_DIR`, `SEEV_UPLOAD_DIR`, `SEEV_BACKUP_RETENTION_DAYS` 환경변수로 운영 경로와 보관 기간을 조정합니다.

- `ecosystem.config.cjs`
  - PM2 운영 실행 설정입니다.
  - `seev` 프로세스를 `npm run start`, `NODE_ENV=production`, `PORT=3000`으로 고정합니다.
  - 외부 서비스에는 `npm run dev`가 아니라 이 설정을 사용해야 합니다.

## Recent Feature Breakdown

- 운영 안정화
  - PM2 dev 서버 실행 문제를 막기 위해 `ecosystem.config.cjs`와 `pm2:start`, `pm2:reload` 스크립트를 추가했습니다.
  - HTTP 내부 서비스에서는 로그인 쿠키가 저장되도록 `SESSION_COOKIE_SECURE=false`를 지원합니다.
  - 운영 반영 순서는 `npm run build` 후 `npm run pm2:reload`입니다.

- 데이터 보존과 복구 대비
  - 프로젝트 삭제는 `Project.deletedAt` 기반 soft delete입니다.
  - 공지 삭제도 `AdminNotice.deletedAt` 기반 soft delete입니다.
  - DB와 업로드 파일을 함께 백업하는 `npm run backup`을 추가했습니다.

- ADMIN 공지사항
  - ADMIN 화면에서 제목/내용을 배너 입력 폼으로 작성하고 등록할 수 있습니다.
  - 공지는 Workspace Notification에서 배너로 표시됩니다.
  - 공지 수정, 회수, 재게시, 삭제 기능을 분리했습니다.

- 프로젝트 데이터 연결
  - 임상데이터와 모델예측 결과는 고정 기준 컬럼이 아니라 양쪽 데이터의 공통 컬럼 값으로 연결합니다.
  - `image_folder`와 `image_id`는 업로드 이미지 파일 매칭에 사용합니다.
  - 데이터 추가/변경 API는 DB 교체와 케이스 재생성을 트랜잭션으로 처리합니다.

- Image Viewer
  - annotation UI를 toolbar, minimap, shape, list, hook으로 분리했습니다.
  - 이미지가 있는 케이스를 이전/다음으로 이동하는 버튼을 추가했습니다.
  - rectangle/polygon annotation을 사용자별 저장하고 평가 취합에서 overlay로 비교합니다.

- 평가 결과 취합
  - 수정 허용 column 저장과 결과 파일 저장을 별도 기능으로 분리했습니다.
  - 결과 파일 저장은 CSV/TSV/Excel 형식 선택 후 `저장하기` 버튼으로 실행합니다.
  - Annotation 위치 취합은 별도 컴포넌트에서 환자별 overlay 비교를 담당합니다.

## Maintenance Notes

- Image Viewer 관련 변경은 `components/project/image-viewer/` 아래 기능별 파일을 확인하세요.
  - 확대/이동/드래그 흐름은 `annotatable-image-viewer.tsx`
  - 도구 버튼은 `viewer-toolbar.tsx`
  - minimap은 `minimap.tsx`
  - 도형 렌더링/핸들은 `annotation-shape.tsx`
  - annotation 목록은 `annotation-list.tsx`
  - 저장/불러오기는 `use-image-annotations.ts`
- 모델예측 테이블 관련 변경은 `components/project/tables/prediction-data-table.tsx`를 확인하세요.
- 평가 취합 관련 변경은 `components/project-review-table.tsx`와 review route를 확인하세요.
  - 저장 형식 선택 UI는 `components/ui/select-native.tsx`를 확인하세요.
- 데이터 파싱/업로드 문제는 `lib/project-upload.ts`를 확인하세요.
- 업로드 파일 경로/권한 제공 문제는 `lib/project-storage.ts`와 `app/api/project-files/[projectId]/[...filePath]/route.ts`를 확인하세요.
- Workspace 공유/Notification 관련 변경은 `components/workspace-actions.tsx`, `app/workspace/page.tsx`, `app/admin/accounts/page.tsx`를 함께 확인하세요.
- DB 구조 변경 시 `prisma/schema.prisma` 수정 후 migration을 만들고 `npx prisma migrate deploy`, `npm run db:generate`를 실행하세요.
- 운영에서는 `npm run backup`을 cron에 등록해 DB와 업로드 파일을 함께 백업하세요.
- 운영 배포/재시작은 `npm run build`, `npm run pm2:reload`, `pm2 save` 순서로 진행하세요.

## Refactor And Context Notes

- Workspace UI는 `components/workspace/` 아래로 분리되어 있습니다. Workspace 관련 변경은 해당 기능 파일을 먼저 확인하세요.
- Image Viewer UI는 `components/project/image-viewer/` 아래로 1차 분리되어 있습니다.
  - 추가 리팩터링이 필요하면 viewport fit/zoom/pan 로직을 hook으로 분리하는 것이 다음 우선순위입니다.
- `app/workspace/page.tsx`와 review route는 server action과 데이터 조회가 길어질 수 있으므로, 반복되는 데이터 변환은 `lib/` helper로 빼면 유지보수가 쉬워집니다.
- 이미지 매칭은 `lib/project-images.ts`에서 공통 처리합니다. 프로젝트 화면과 평가 취합 화면 모두 이 helper를 사용합니다.
- annotation 정규화와 prediction edit 정규화는 `lib/project-annotations.ts`에서 처리합니다.
- 생성형 AI에게 이어서 작업을 맡길 때는 전체 파일을 모두 붙이기보다 이 문서의 관련 섹션과 해당 파일 1-2개만 먼저 보여주는 편이 효율적입니다.
- 이 문서는 자동으로 항상 읽히지는 않습니다. 새 작업자나 새 AI 세션에는 `docs/FEATURE_MAP.md`를 먼저 읽고 진행하라고 명시하는 것이 가장 안전합니다.

## Operational Notes

- `Project.deletedAt` 기반 soft delete를 사용합니다. 복구는 DB에서 해당 project의 `deletedAt`을 `NULL`로 되돌리면 됩니다.
- 운영 업로드 저장소는 `SEEV_UPLOAD_DIR`로 코드 폴더 밖 경로를 지정하는 것을 권장합니다.
- `npm run backup`은 DB와 업로드 파일을 함께 백업합니다.
- PM2는 `ecosystem.config.cjs` 기준으로 실행합니다. 공용 접속 서비스에는 `npm run dev`를 사용하지 마세요.

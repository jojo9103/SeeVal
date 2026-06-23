# SeeV Feature Map

이 문서는 SeeV 프로젝트의 주요 기능과 관련 파일을 빠르게 파악하기 위한 안내서입니다. 다른 개발자나 생성형 AI에게 작업을 이어 맡길 때 이 파일을 먼저 보여주면 전체 맥락을 잡기 쉽습니다.

## Core Routes

- `proxy.ts`
  - 로그인하지 않은 사용자가 `/workspace`, `/admin`, `/api/projects`, `/api/project-files`에 직접 접근하면 차단합니다.
  - 페이지 요청은 `/auth?next=...`로 보내 로그인 후 원래 접근하려던 화면으로 돌아갈 수 있게 합니다.
  - 보호 API 요청은 `401`과 `로그인이 필요합니다.` JSON 응답을 반환합니다.
  - proxy는 세션 쿠키 payload의 HMAC 서명과 `exp`를 빠르게 확인해 만료되었거나 깨진 쿠키를 삭제하고 로그인 페이지로 돌려보냅니다.
  - 로그인된 사용자의 `POST`, `PUT`, `PATCH`, `DELETE` 보호 요청은 same-site Server Action/폼 요청은 허용하고, 외부 사이트에서 온 unsafe 요청은 `403`으로 차단합니다.
  - 실제 서명/유저 상태 검증은 각 route의 `requireUser`/`requireAdmin`이 담당합니다.

- `next.config.ts`
  - 운영 기본 보안 헤더를 적용합니다.
  - `X-Content-Type-Options=nosniff`, `X-Frame-Options=DENY`, `Referrer-Policy=same-origin`, `Permissions-Policy`, `Strict-Transport-Security`를 설정합니다.
  - Server Action body limit은 `SEEV_SERVER_ACTION_BODY_LIMIT` 환경변수로 조정할 수 있으며 기본값은 `1gb`입니다.

- `prisma.config.ts`
  - Prisma 7에서는 datasource URL을 `schema.prisma`가 아니라 `prisma.config.ts`에서 관리합니다.
  - Neon 배포 시 앱 런타임은 `lib/prisma.ts`에서 `DATABASE_URL` pooled connection을 사용합니다.
  - Prisma CLI/migration은 `DIRECT_URL`이 있으면 direct connection을 우선 사용하고, 없으면 `DATABASE_URL`로 fallback합니다.
  - Vercel에는 `DATABASE_URL`과 `DIRECT_URL`을 모두 등록하고, Build Command는 `npm run vercel-build`를 사용합니다.
  - Vercel 로그인에는 세션 서명용 `SESSION_SECRET`도 반드시 등록해야 하며, Neon DB에는 `ACTIVE` 상태의 `User` row와 `passwordHash`가 있어야 합니다.

- `app/workspace/page.tsx`
  - 로그인한 사용자의 workspace 첫 화면입니다.
  - 프로젝트 생성, 프로젝트 목록, Notification, 평가 취합 진입 버튼을 다룹니다.
  - ADMIN은 전체 프로젝트를 볼 수 있고, 프로젝트 소유자와 ADMIN은 평가 취합으로 들어갈 수 있습니다.
  - 공유 받은 요청은 Notification에서 수락/거절하며, ADMIN 공지사항도 같은 Notification에서 배너 형식으로 확인합니다.
  - 프로젝트 삭제는 soft delete입니다. `Project.deletedAt`만 기록하고 DB row와 업로드 파일은 복구를 위해 보관합니다.

- `app/workspace/projects/[projectId]/page.tsx`
  - 단일 프로젝트 평가 화면입니다.
  - 프로젝트 접근 권한을 확인하고, 케이스/이미지/임상데이터/모델예측/유저별 편집값을 불러옵니다.
  - 프로젝트 소유자, ADMIN, 공유 허가된 USER가 접근할 수 있으며, 공유받은 USER도 선택된 `Edit {column}`을 본인 평가값으로 수정/저장할 수 있습니다.
  - `ProjectCaseViewer`에 화면용 데이터를 넘깁니다.
  - 데이터 추가/변경 후 `ProjectCaseViewer` key가 바뀌어 새 케이스 데이터가 즉시 반영됩니다.

- `app/workspace/projects/[projectId]/review/page.tsx`
  - 평가 취합 화면입니다.
  - 프로젝트 소유자 또는 ADMIN만 접근합니다.
  - ADMIN, 프로젝트 소유자, 공유받은 사용자들의 수정 결과를 케이스별 표로 보여줍니다.
  - `ProjectReviewTable`에 프로젝트명, 취합 대상 사용자, 케이스별 원본/수정값, 수정 허용 column 저장 action을 넘깁니다.
  - `updateEditablePredictionColumns` server action에서 선택된 raw column을 `Edit {column}` 수정 허용 column으로 변환하고 `ProjectColumnMetadata`를 함께 저장합니다.
  - `createProjectReviewCheckpoint` server action은 현재 수정 허용 column, column metadata, 사용자별 Edit 데이터를 snapshot으로 저장합니다.
  - `restoreProjectReviewCheckpoint` server action은 선택한 checkpoint의 snapshot으로 column 설정과 Edit 데이터를 되돌립니다.
  - `deleteProjectReviewCheckpoint` server action은 선택한 checkpoint row만 삭제하며 현재 프로젝트 설정과 Edit 데이터는 변경하지 않습니다.
  - 컬럼 metadata 저장 전 기존 모델예측 데이터의 source raw 값과 기존 사용자 edit 값이 타입/min/max/nullable 규칙을 통과하는지 검증합니다.

## Project Viewer Components

- `components/project-case-viewer.tsx`
  - 프로젝트 평가 화면의 최상위 조립 컴포넌트입니다.
  - 선택된 case, 예측값 편집 상태, annotation 상태, 비교 column 상태를 관리합니다.
  - 실제 UI는 아래 컴포넌트로 위임합니다.
  - annotation 상태를 Image Viewer와 선택된 데이터 패널에 함께 전달해 overlay와 목록/naming이 같은 데이터를 사용합니다.
  - 프로젝트별 column metadata를 모델예측 테이블과 선택 데이터 패널에 전달합니다.

- `components/project/types.ts`
  - `CaseRow`, annotation 타입, drag state, table sort 타입을 모아둔 파일입니다.
  - `ColumnDataType`, `ColumnMetadata` 타입도 함께 정의합니다.
  - 프로젝트 평가 화면에서 공유하는 데이터 계약입니다.

- `components/project/data-utils.ts`
  - 테이블 column 추출, 표시값 처리, 유저별 모델예측 편집값 병합, 숫자 입력 검증을 담당합니다.

## Image Viewer And Annotation

- `components/project/image-viewer/annotatable-image-viewer.tsx`
  - Image Viewer의 상위 조립 컴포넌트입니다.
  - 이미지 fit-to-view, wheel zoom, pan, polygon/rectangle drawing state, pointer event 흐름을 관리합니다.
  - 초기 fit 상태에서도 이미지가 viewer 영역보다 큰 경우 드래그로 위치를 이동할 수 있습니다.
  - `이동` 도구에서 rectangle과 polygon 객체 전체를 드래그해 옮길 수 있습니다.
  - 선택된 polygon의 point handle은 개별 선택할 수 있고, 삭제 버튼으로 선택 point를 제거합니다.
  - polygon point 삭제 후 point가 3개 미만이면 polygon 객체를 제거합니다.
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
  - 선택된 raw column 옆에 `Edit {column}` 수정용 column을 표시합니다.
  - 프로젝트별 수정 허용 column에 포함된 `Edit {column}` 값을 수정 가능하며, column metadata에 따라 int/float/string/category/bool 입력 UI를 사용합니다.
  - 공유받은 USER가 수정한 `Edit {column}` 값은 해당 USER의 `ProjectCasePredictionEdit`로 저장되어 평가 취합에서 사용자별로 비교됩니다.
  - 선택된 샘플의 `Edit {column}` 값을 reset/delete할 수 있습니다.
    - reset은 `Edit {column}` 값을 빈 값으로 저장해 표에서 `-`로 보이게 합니다.
    - 삭제는 해당 사용자/샘플의 `Edit {column}` key를 제거합니다.
  - int는 정수 입력, float은 소수 입력을 허용하고 min/max 속성을 반영합니다.
  - 저장 버튼으로 사용자별 편집값을 저장하며, backend validation 실패 메시지를 표시합니다.
  - 정렬, 페이지네이션, 30/60/90 rows 표시 옵션을 지원합니다.
  - 임상데이터와 모델예측 데이터는 고정 컬럼이 아니라 양쪽 데이터의 공통 컬럼 값으로 연결됩니다.

- `components/project/tables/selected-case-data-panel.tsx`
  - 선택된 샘플의 임상데이터와 모델예측 결과를 side panel로 보여줍니다.
  - 패널 내부 Navbar로 `임상데이터`, `모델예측 결과`, `Annotations`, `Comments` 탭을 전환합니다.
  - `Annotations` 탭은 Image Viewer 아래에 있던 annotation 목록을 이동한 위치이며, 여기서 annotation naming 수정, 선택 삭제, 저장 버튼 즉시 저장을 할 수 있습니다.
  - `Comments` 탭은 현재 이미지/샘플에 대한 현재 사용자 comment를 작성하고 저장합니다.
  - 수정 허용 `Edit {column}`은 column metadata에 따라 int/float/string/category/bool 입력 UI를 사용합니다.
  - 현재 로그인한 사용자 이름을 안내해, 공유받은 USER도 본인 평가값을 저장한다는 점을 명확히 표시합니다.
  - 선택된 샘플의 `Edit {column}` 값을 reset/delete할 수 있습니다.
  - 저장 실패 시 backend validation 메시지를 표시합니다.

- `components/project/tables/selected-case-annotation-panel.tsx`
  - 선택된 데이터 패널의 `Annotations` 탭 내용을 담당합니다.
  - `AnnotationList`를 감싸는 작은 조립 컴포넌트입니다.
  - 현재 선택된 case의 annotation 목록을 보여주고 이름 수정, 선택 삭제, 명시 저장, annotation 선택을 처리합니다.
  - 목록의 객체 카드를 누르면 Image Viewer에서 해당 annotation이 선택 표시되고 중심 위치로 이동합니다.
  - annotation 생성/도형 편집/저장은 기존 Image Viewer와 공유 상태를 통해 계속 동작합니다.

- `components/project/tables/selected-case-comments-panel.tsx`
  - 선택된 데이터 패널의 `Comments` 탭 내용을 담당합니다.
  - 현재 선택된 case의 현재 사용자 comment를 불러오고 textarea에서 수정한 뒤 저장 버튼으로 저장합니다.
  - 빈 comment를 저장하면 해당 사용자의 comment row를 삭제해 취합 화면에서 보이지 않게 합니다.

- `components/project-review-table.tsx`
  - 평가 취합 페이지의 테이블입니다.
  - 상단 `ReviewSectionMenu`로 `평가 결과 취합`, `Annotations 위치 취합`, `Comments 취합`을 전환합니다.
  - `ReviewCheckpointPanel`을 통해 현재 취합 상태 checkpoint 생성과 checkpoint 복구 action을 연결합니다.
  - 선택된 column chip 또는 Column 찾기에서 column을 해제하면 취합 표시와 수정 허용 목록에서만 빠지고, 기존 사용자별 Edit 데이터는 보존합니다.
  - `Column 찾기` 검색 팝오버에서 여러 column을 multi select할 수 있습니다.
  - 선택한 raw column을 저장하면 프로젝트 평가 화면에서 `Edit {column}` 수정 가능 항목이 됩니다.
  - 취합 표는 `{column}` raw 값은 한 번만 보여주고, `Edit {column} ({User name})` 형태로 ADMIN/프로젝트 소유자/공유받은 사용자별 수정값을 펼쳐 보여줍니다.
  - 취합 표의 `Edit {column} ({User name})` header 리셋 버튼은 해당 사용자/해당 Edit column 값만 빈 값으로 저장해 표에서 `-`로 보이게 합니다.
  - 사용자별 Edit column 리셋은 column 선택/해제와 별개로 동작하며, 다른 사용자의 Edit 값은 유지합니다.
  - `컬럼 설정` 버튼을 누르면 배너/모달 형식으로 선택된 raw column의 metadata를 수정합니다.
  - 설정 화면에는 raw `{column}` 이름만 보여주지만, 저장되는 metadata 이름과 실제 검증/수정 적용 대상은 `Edit {column}`입니다.
  - metadata 필드: `dataType`, `minValue`, `maxValue`, `nullable`, `unit`, `description`.
  - `dataType`이 `int` 또는 `float`일 때만 min/max 입력칸을 보여줍니다.
  - int는 `step=1`, float은 `step=any` 입력을 사용합니다.
  - min value가 max value보다 크면 저장하지 않습니다.
  - 취합 테이블은 화면 표시 rows를 30/50/100개 단위로 나누고 이전/다음 페이지 이동을 지원합니다.
  - 현재 페이지의 rows는 내부 세로 스크롤로 자르지 않고 전체 높이로 펼쳐 보여주며, column이 많을 때만 가로 스크롤을 사용합니다.
  - 취합 테이블 header의 `샘플`, `image_id`, raw column, 사용자별 `Edit {column}`을 클릭해 오름차순/내림차순 정렬할 수 있습니다.
  - 긴 `Edit {column} ({User name})` header는 고정 폭 안에서 잘리지 않도록 여러 줄로 줄바꿈하고, raw/Edit 값 cell도 고정 최대 폭 안에서 줄바꿈합니다.
  - `CSV`, `TSV`, `Excel` 중 저장 형식을 선택한 뒤 `저장하기`를 누르면 현재 취합 결과를 파일로 내려받습니다.
  - 내보내기 데이터는 현재 선택된 column 기준이며, `sample`, `image_id`, 원본값, 공유 사용자별 수정값 순서로 구성됩니다.
  - 페이지네이션은 화면 표시 범위만 바꾸며, 파일 저장은 선택된 column의 전체 취합 rows를 대상으로 합니다.
  - CSV/TSV는 브라우저 Blob 다운로드를 사용하고, Excel은 `xlsx`의 `aoa_to_sheet`/`writeFile`을 사용합니다.

- `lib/project-column-metadata.ts`
  - 프로젝트별 동적 column metadata 정규화와 validation을 담당합니다.
  - 지원 타입: `int`, `float`, `string`, `category`, `bool`.
  - 검증 규칙: int 정수, float 숫자, bool boolean-like 값, min/max 범위, nullable=false 빈 값 금지.
  - validation 실패 시 `{ row, column, value, message }` 배열을 포함한 `ProjectColumnValidationError`를 던집니다.

- `tests/project-column-validation.test.ts`
  - column metadata validation 단위 테스트입니다.
  - int에 float/string 입력 실패, float에 string 입력 실패, min/max/nullable 실패와 정상 범위를 검증합니다.

- `components/ui/select-native.tsx`
  - 기본 HTML `select`를 SeeV 어두운 UI에 맞춰 감싼 공통 컴포넌트입니다.
  - `lucide-react`의 `ChevronDown` 아이콘을 사용합니다.
  - 평가 취합 파일 저장 형식 선택 UI에서 사용합니다.

- `components/project-review/section-menu.tsx`
  - 평가 취합 페이지의 상단 메뉴를 담당합니다.
  - 메뉴 항목은 `평가 결과 취합`, `Annotations 위치 취합`, `Comments 취합`으로 나뉘며, 선택된 항목만 본문에 렌더링합니다.
  - 메뉴 타입 `ReviewSection`을 이 파일에서 관리해 섹션 추가 시 변경 지점을 줄입니다.

- `components/project-review/checkpoints.tsx`
  - 평가 결과 취합의 checkpoint UI를 담당합니다.
  - `Checkpoint 만들기`는 현재 수정 허용 column, metadata, 사용자별 Edit 데이터를 저장합니다.
  - `이 시점으로 복구`는 저장된 snapshot으로 column 설정과 Edit 데이터를 되돌립니다.
  - `삭제`는 checkpoint snapshot만 제거하고 현재 프로젝트 데이터에는 영향을 주지 않습니다.

- `components/project-annotation-review-viewer.tsx`
  - 평가 취합 페이지에서 환자별 annotation 요약과 이미지 overlay 취합을 담당합니다.
  - 환자별로 annotation 개수와 사용자별 개수를 짧게 보여주고, 선택한 환자의 이미지 위에 여러 사용자의 rectangle/polygon을 색상별로 함께 표시합니다.
  - annotation 좌표는 저장된 이미지 원본 pixel 좌표를 그대로 사용해 overlay합니다.
  - `샘플 JSON` 버튼은 현재 선택된 샘플의 annotations를 다운로드합니다.
  - `전체 JSON` 버튼은 전체 샘플의 annotations를 다운로드합니다.
  - 다운로드 시 `사용자별 데이터 포함`은 사용자별 원본 annotations를 유지하고, `통합 공통 annotation만`은 같은 geometry가 모든 annotator에게 존재하는 annotation만 내보냅니다.

- `components/project-comments-review-viewer.tsx`
  - 평가 취합 페이지의 `Comments 취합` 탭을 담당합니다.
  - comment가 있는 이미지/샘플만 목록에 표시합니다.
  - 선택한 이미지 preview를 왼쪽에 보여주고, 오른쪽에는 comment가 있는 사용자들의 내용만 취합해 보여줍니다.
  - `샘플 JSON`은 현재 선택된 샘플의 comments를 저장하고, `전체 JSON`은 comment가 있는 전체 샘플의 comments를 저장합니다.

- `app/api/projects/[projectId]/cases/[caseId]/prediction/route.ts`
  - 사용자별 모델예측 수정값 저장 API입니다.
  - DB의 `ProjectCasePredictionEdit` 모델을 사용합니다.
  - 프로젝트 소유자, 공유 허가된 USER, ADMIN이 접근할 수 있습니다.
  - 저장 전에 수정 허용 `Edit {column}`의 `ProjectColumnMetadata` 규칙으로 입력값을 검증합니다.
  - 저장 시 현재 수정 허용 column 값만 갱신하고, 현재 선택 해제되어 화면에 숨겨진 과거 `Edit {column}` 값은 보존합니다.
  - `PATCH`는 현재 로그인한 사용자의 선택 샘플 `Edit {column}` reset/delete를 처리합니다.
    - reset은 선택 Edit key를 빈 값으로 저장하고, delete는 선택 Edit key를 제거합니다.
  - 저장 성공 후 프로젝트 상세와 평가 취합 경로를 revalidate해 공유받은 USER의 수정값이 취합 화면에 반영되도록 합니다.
  - 실패 시 `{ row, column, value, message }` 형태의 오류 목록을 반환합니다.

- `app/api/projects/[projectId]/cases/[caseId]/comments/route.ts`
  - 사용자별 이미지/샘플 comment 저장 API입니다.
  - DB의 `ProjectCaseComment` 모델을 사용합니다.
  - 프로젝트 소유자, 공유 허가된 USER, ADMIN이 접근할 수 있습니다.
  - `GET`은 현재 로그인한 사용자의 comment를 반환합니다.
  - `PUT`은 현재 로그인한 사용자의 comment를 upsert하고, 빈 comment는 삭제합니다.

- `lib/auth.ts`
  - `seev_session` 쿠키 생성/검증/삭제와 `requireUser`, `requireAdmin` 인증 guard를 담당합니다.
  - 세션 쿠키는 `SESSION_SECRET`으로 HMAC 서명하며, 운영 배포에서는 같은 값을 Vercel Environment Variable에 등록해야 로그인 후 세션 유지가 됩니다.
  - 로그아웃 시 세션 쿠키는 생성 때와 같은 `path`, `sameSite`, `secure`, `httpOnly` 옵션에 `maxAge=0`, 과거 `expires`를 함께 지정해 삭제합니다.
  - malformed session token은 JSON parse 실패 시 로그인되지 않은 상태로 처리합니다.
  - 세션 만료 시 보호 페이지 접근은 proxy에서 `/auth?next=...`로 이동하고, 서버 guard는 최종적으로 인증 상태를 다시 확인합니다.

## Upload And Project Data

- `lib/project-upload.ts`
  - 프로젝트 생성/업데이트 시 업로드 파일 저장과 파싱을 담당합니다.
  - CSV/XLSX/XLS 임상데이터와 모델예측 데이터를 파싱합니다.
  - 이미지 폴더 업로드 시 비이미지 파일은 제외합니다.
  - Vercel 배포에서 4MB를 넘는 프로젝트 생성 업로드는 R2 presigned URL direct upload 경로를 사용하고, 완료 후 서버가 DB 파일 기록과 케이스 재구성을 처리합니다.
  - 임상데이터와 모델예측 데이터는 공통 컬럼 중 값이 일치하고 충돌하지 않는 row를 기준으로 연결합니다.
  - 공통 컬럼이 `image_id`인 경우 `YWDIF064`와 `YWDIF064_C3`처럼 샘플 ID 뒤에 이미지/염색 suffix가 붙은 예측 row도 같은 임상 row로 연결합니다.
  - `image_folder`와 `image_id`를 기반으로 업로드 이미지와 prediction row를 연결합니다. `image_folder`는 이미지 폴더/파일 매칭에 쓰입니다.
  - 데이터 교체 업로드는 DB 삭제/생성/케이스 재생성을 트랜잭션으로 묶어 중간 실패에 더 강하게 처리합니다.
  - 프로젝트에 `ProjectColumnMetadata`가 설정되어 있으면 모델예측 업로드 rows를 먼저 validation하고, 오류가 있으면 저장하지 않습니다.
  - `Edit {column}` metadata는 업로드 raw row의 source column 값을 기준으로 validation합니다.

- `lib/project-storage.ts`
  - 업로드 파일 저장 경로와 `/api/project-files/...` 파일 URL 생성을 담당합니다.
  - 기본 저장소는 `.seeval-uploads/projects`이며 운영에서는 `SEEV_UPLOAD_DIR`로 코드 폴더 밖 경로를 지정할 수 있습니다.
  - R2 direct upload를 위해 15분짜리 presigned PUT URL을 생성합니다.

- `app/api/projects/uploads/prepare/route.ts`
  - 로그인 사용자에게 프로젝트 생성용 R2 presigned PUT URL 목록을 발급합니다.
  - 파일 확장자와 업로드 용량 제한을 서버에서 먼저 검증한 뒤 프로젝트 row를 생성합니다.

- `app/api/projects/uploads/complete/route.ts`
  - R2 direct upload 완료 후 파일 metadata를 DB에 저장하고 `rebuildProjectCases`를 실행합니다.
  - 케이스 재구성 실패 시 생성 중인 프로젝트 row를 삭제해 빈 프로젝트가 남지 않도록 합니다.

- `app/api/projects/uploads/cancel/route.ts`
  - R2 direct upload가 중간 실패했을 때 파일 기록이 없는 준비 단계 프로젝트 row를 삭제합니다.

- `app/api/project-files/[projectId]/[...filePath]/route.ts`
  - 업로드된 프로젝트 파일을 권한 확인 후 제공합니다.
  - 삭제된 프로젝트(`deletedAt` 존재)는 파일 접근이 차단됩니다.

- `components/project-data-upload.tsx`
  - 기존 프로젝트에 임상데이터/모델예측/이미지를 추가 또는 교체하는 업로드 UI입니다.
  - 업로드 validation 실패 시 row/column/value/message 일부를 사용자에게 보여줍니다.

- `app/api/projects/[projectId]/data/route.ts`
  - 프로젝트 데이터 추가/변경 API입니다.
  - 업로드 데이터 validation 실패 시 구조화된 오류 목록을 반환합니다.

## Sharing And Aggregation

- `components/workspace-actions.tsx`
  - 기존 import 경로 호환을 위한 re-export 파일입니다.
  - 실제 workspace UI는 `components/workspace/` 아래 기능별 파일에 나뉘어 있습니다.

- `components/workspace/`
  - `project-workspace-panel.tsx`: 프로젝트 목록, 생성/공유/공유상태 모달을 조립하는 상위 컴포넌트입니다.
  - `project-card.tsx`: 프로젝트 카드와 `들어가기`, `평가 취합`, `공유요청상황`, `공유하기`, `삭제` 버튼을 담당합니다.
  - `create-project-modal.tsx`: 프로젝트 생성과 업로드 진행률 표시 UI를 담당합니다.
  - `share-project-modal.tsx`: 공유 대상 검색 및 공유 요청 UI를 담당합니다.
    - ADMIN과 프로젝트 소유자 모두 바로 권한을 주지 않고 `PENDING` 공유 요청을 보냅니다.
    - 받은 USER가 Notification에서 수락하면 `ACCEPTED`가 되어 프로젝트 접근 권한이 부여됩니다.
    - 현재 프로젝트에 이미 공유된 USER는 `이미 공유됨`으로 표시하고 선택할 수 없게 합니다.
    - 이미 공유 요청이 대기 중인 USER도 상태 badge를 표시하고 중복 요청을 막습니다.
  - `share-status-list.tsx`: 프로젝트별 공유 요청 상태와 공유 허가된 사용자 목록을 보여줍니다.
    - ADMIN 또는 프로젝트 소유자는 공유 요청/허가 목록에서 `공유 취소`를 눌러 `ProjectShare` 권한 row를 삭제할 수 있습니다.
    - 공유 취소 버튼을 누르면 열린 공유 요청 상황 모달에서 해당 row를 즉시 숨기고, server action 완료 후 workspace를 새로고침합니다.
    - 공유 취소 후 같은 USER에게 다시 공유하면 기존 상태를 재사용하지 않고 새 공유 요청 row가 생성됩니다.
  - `notification-center.tsx`: 받은 공유 요청 수락/거절, ADMIN 공지사항 확인/삭제, Notification badge 표시를 담당합니다.
    - 공유 요청은 `PENDING` 상태일 때만 표시되고 수락/거절하면 사라집니다.
    - ADMIN 공지는 알림창을 열면 사용자별 `readAt`이 기록되어 badge count에서 빠집니다.
    - 공지 `삭제`는 전체 공지를 삭제하지 않고 사용자별 `dismissedAt`을 기록해 본인 Notification에서만 숨깁니다.
  - `edit-profile-button.tsx`: 회원 정보 수정 모달입니다.
  - `common.tsx`, `format.ts`, `types.ts`: 공통 모달/배너/표시 포맷/타입을 담당합니다.

- `app/admin/accounts/page.tsx`
  - 관리자 계정 승인/거절, ADMIN 업로드 프로젝트 확인, ADMIN 공지사항 server action을 담당합니다.
  - 등록된 ADMIN 공지사항은 workspace Notification에 배너 형식으로 표시됩니다.
  - 공지사항 create/update/recall/republish/delete action을 정의하고 `AdminNoticeSection`에 넘깁니다.

- `app/workspace/page.tsx`
  - Workspace 데이터 조회와 workspace server action을 담당합니다.
  - `cancelProjectShare`: ADMIN 또는 프로젝트 소유자가 공유 요청/허가를 취소하고 실제 접근 권한을 말소합니다.
  - `markAdminNoticesRead`: Notification을 연 사용자의 ADMIN 공지를 읽음 처리합니다.
  - `dismissAdminNotice`: 특정 ADMIN 공지를 사용자별로 숨김 처리합니다.
  - ADMIN 공지 조회 시 `AdminNoticeReceipt.dismissedAt`이 있는 공지는 해당 사용자에게 표시하지 않습니다.

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
    - `ProjectReviewCheckpoint`
    - `AdminNotice`
    - `ProjectColumnMetadata`
  - annotation과 prediction edit는 모두 `caseId + userId` 기준으로 사용자별 저장됩니다.
  - `ProjectReviewCheckpoint.snapshot`은 복구용 JSON snapshot입니다.
    - `editablePredictionColumns`: 프로젝트 수정 허용 column 목록입니다.
    - `columnMetadata`: 선택 column의 타입/범위/nullable/unit/description 설정입니다.
    - `predictionEdits`: `caseId + userId` 기준 사용자별 Edit 데이터입니다.
  - `Project.deletedAt`은 soft delete에 사용됩니다. 삭제된 프로젝트는 일반 목록/상세/API 접근에서 제외됩니다.
  - `AdminNotice`는 ADMIN 공지사항을 저장하고 작성자 USER와 연결됩니다.
  - `AdminNotice.recalledAt`은 공지 회수에 사용되며, `deletedAt`은 공지 삭제에 사용됩니다.
  - `AdminNoticeReceipt`는 사용자별 공지 읽음/숨김 상태를 저장합니다.
    - `readAt`: 사용자가 Notification을 열어 공지를 확인한 시점입니다.
    - `dismissedAt`: 사용자가 본인 Notification에서 공지를 삭제한 시점입니다.
  - `ProjectColumnMetadata`는 프로젝트별 모델예측 column 설정을 저장합니다.
    - `dataType`: `int`, `float`, `string`, `category`, `bool`.
    - `minValue`, `maxValue`: 숫자형 column 범위 제한입니다.
    - `nullable`: 빈 값 허용 여부입니다.
    - `unit`, `description`: 표시/설명용 선택 metadata입니다.

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
  - 사용자가 Notification을 열면 공지가 읽음 처리되어 badge 표시에서 제외됩니다.
  - 사용자는 공지를 본인 Notification에서 삭제할 수 있으며, 이 동작은 다른 사용자에게 영향을 주지 않습니다.

- 공유 권한 취소
  - ADMIN과 프로젝트 소유자는 공유 요청 상황 모달에서 대기/거절/허가 상태의 공유를 취소할 수 있습니다.
  - 취소 시 `ProjectShare` row를 삭제해 프로젝트 접근 권한을 즉시 말소합니다.
  - UI에서는 취소 submit 즉시 해당 공유 row를 숨겨 사용자가 취소 결과를 바로 확인할 수 있습니다.
  - 삭제된 공유 row는 다음 공유 시 재사용되지 않으므로, USER에게 새 공유 요청이 다시 생성됩니다.
  - 공유 취소는 `ProjectShare`만 삭제하고 사용자별 `ProjectCasePredictionEdit` 데이터는 삭제하지 않습니다.
  - 따라서 공유가 끊겼다가 다시 수락되어도, reset/delete로 명시 제거하지 않은 기존 사용자 평가 데이터는 다시 취합할 수 있습니다.
  - 공유 모달에서 이미 공유되었거나 공유 요청 대기 중인 USER는 상태 badge로 표시하고 중복 선택을 막습니다.

- 평가 취합 Column 선택 UX
  - 평가 취합의 column 선택을 체크박스 나열 방식에서 검색 가능한 multi select 방식으로 변경했습니다.
  - 선택된 column은 chip으로 표시되고 chip의 X 버튼으로 개별 해제할 수 있습니다.
  - `전체 선택`, `선택 해제`, `컬럼 설정`, `수정 컬럼 저장` 흐름은 기존 저장 동작과 함께 유지됩니다.
  - 저장 시 선택된 raw column은 프로젝트 평가 화면의 `Edit {column}` 수정용 column으로 추가됩니다.

- 프로젝트 데이터 연결
  - 임상데이터와 모델예측 결과는 고정 기준 컬럼이 아니라 양쪽 데이터의 공통 컬럼 값으로 연결합니다.
  - `image_folder`와 `image_id`는 업로드 이미지 파일 매칭에 사용합니다.
  - 데이터 추가/변경 API는 DB 교체와 케이스 재생성을 트랜잭션으로 처리합니다.

- Image Viewer
  - annotation UI를 toolbar, minimap, shape, list, hook으로 분리했습니다.
  - 이미지가 있는 케이스를 이전/다음으로 이동하는 버튼을 추가했습니다.
  - rectangle/polygon annotation을 사용자별 저장하고 평가 취합에서 overlay로 비교합니다.
  - polygon point가 선택된 상태에서 toolbar 삭제 또는 키보드 `Delete`/`Backspace`를 누르면 해당 point만 삭제합니다.
  - point가 선택되지 않고 annotation 객체만 선택된 상태에서 삭제하면 annotation 객체를 삭제합니다.

- 평가 결과 취합
  - 상단 메뉴에서 `평가 결과 취합`과 `Annotation 위치 취합`을 별도 화면처럼 전환할 수 있습니다.
  - 메뉴 UI는 `components/project-review/section-menu.tsx`로 분리해 취합 본문과 navigation 책임을 나눴습니다.
  - Checkpoint 기능을 추가해 column 선택/해제 또는 Edit 저장 실수 전에 현재 상태를 복구 지점으로 저장할 수 있습니다.
  - Checkpoint는 `ProjectReviewCheckpoint`에 snapshot JSON으로 저장하며, 복구 시 수정 허용 column, metadata, 사용자별 Edit 데이터를 해당 시점으로 되돌립니다.
  - Checkpoint 삭제는 snapshot row만 삭제하고 현재 프로젝트 설정/입력값은 유지합니다.
  - Checkpoint UI는 `components/project-review/checkpoints.tsx`로 분리해 취합 테이블 렌더링과 checkpoint 생성/복구/삭제 UI 책임을 나눴습니다.
  - Column 선택 해제는 기존 사용자별 Edit 데이터를 삭제하지 않고 숨김/수정 허용 목록에서만 제외합니다.
  - 숨겨진 column을 다시 선택하면 보존된 사용자별 Edit 데이터가 취합 표에 다시 표시됩니다.
  - 사용자별 Edit 데이터 초기화는 취합 표의 `Edit {column} ({User name})` header reset 버튼으로 처리합니다.
  - 수정 허용 column 저장과 결과 파일 저장을 별도 기능으로 분리했습니다.
  - 결과 파일 저장은 CSV/TSV/Excel 형식 선택 후 `저장하기` 버튼으로 실행합니다.
  - Column 선택 영역의 `컬럼 설정` 배너에서 타입/범위/nullable/unit/description을 저장합니다.
  - metadata 설정 UI에는 선택된 raw column만 표시하고, 실제 저장/검증/수정 적용은 `Edit {column}`에 합니다.
  - 저장된 metadata는 평가 입력 UI, 평가 저장 API, 업로드 validation에서 공통으로 사용합니다.
  - 모델예측 저장 API는 숨겨진 과거 `Edit {column}` 값을 보존하므로, column을 선택 해제했다가 다시 선택해도 기존 사용자별 수정값을 다시 취합할 수 있습니다.
  - 취합 결과는 raw `{column}`과 사용자별 `Edit {column} ({User name})`으로 구성됩니다.
  - 취합 테이블은 30/50/100 rows 표시 옵션과 이전/다음 페이지 이동을 지원합니다.
  - 취합 테이블 내부 세로 높이 제한을 두지 않아 선택한 페이지 크기의 rows가 모두 보입니다.
  - 취합 테이블 정렬은 현재 선택된 sort 기준으로 전체 rows를 먼저 정렬한 뒤 페이지네이션을 적용합니다.
  - 취합 페이지네이션은 렌더링 성능과 화면 탐색용이며, CSV/TSV/Excel 저장은 전체 취합 rows를 유지합니다.
  - Annotations 위치 취합은 별도 컴포넌트에서 환자별 overlay 비교와 JSON 다운로드를 담당합니다.
  - Annotations JSON 다운로드는 현재 샘플 단위와 전체 샘플 단위를 지원하며, 사용자별 원본 데이터 또는 annotator 공통 geometry만 선택해 저장할 수 있습니다.
  - Comments 취합은 현재 샘플 또는 comment가 있는 전체 샘플을 JSON으로 저장할 수 있습니다.

- 모델예측 결과 입력
  - 모델예측 결과 표는 table head의 각 column 필터 입력과 상단 `필터` 버튼으로 column/value 필터를 지원합니다.
  - 여러 column에 값을 입력한 뒤 `필터`를 누르면 모든 조건이 AND 조건으로 동시에 적용됩니다.
  - 적용된 필터는 상단 배지나 각 head의 해제 버튼으로 개별 해제할 수 있고, `필터 해제`로 전체 해제할 수 있습니다.
  - 필터가 적용되면 표에 남은 샘플만 표시되고, 표 안에서 가능한 수정도 해당 샘플들로 제한됩니다.
  - 필터가 적용되면 Image Viewer의 이전/다음 이동 대상과 이미지 개수도 필터된 샘플의 이미지 목록을 기준으로 바뀝니다.
  - 필터 입력값과 cell 값이 모두 숫자로 해석되면 metadata와 관계없이 숫자 비교로 필터링해 `1`, `1.0`, `1.00`을 같은 값으로 취급합니다.
  - 필터 기준은 `샘플`, `image_id`, raw prediction column, `Edit {column}` column 모두 선택할 수 있습니다.

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
- 컬럼 metadata validation 관련 변경은 `lib/project-column-metadata.ts`, `ProjectColumnMetadata` schema, prediction/data API를 함께 확인하세요.
- 데이터 파싱/업로드 문제는 `lib/project-upload.ts`를 확인하세요.
- 업로드 파일 경로/권한 제공 문제는 `lib/project-storage.ts`와 `app/api/project-files/[projectId]/[...filePath]/route.ts`를 확인하세요.
  - 업로드 파일 제공 API는 프로젝트 권한 확인 후 파일을 반환하며 `Cache-Control=private, no-store`, `X-Content-Type-Options=nosniff`를 붙입니다.
  - `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` 또는 `R2_ACCOUNT_ID`가 모두 있으면 Cloudflare R2를 사용합니다.
  - R2 env가 없으면 기존 로컬 filesystem 저장소(`.seeval-uploads/projects` 또는 `SEEV_UPLOAD_DIR`)를 fallback으로 사용합니다.
  - DB의 `ProjectFile.storagePath`는 기존 `/api/project-files/{projectId}/...` 라우트 형식을 유지하며, route 내부에서 권한 확인 후 R2/local storage에서 파일을 읽습니다.
  - Vercel은 Function request body가 4.5MB로 제한되므로 큰 이미지 폴더는 R2 direct upload가 필요합니다.
  - R2 bucket CORS에서 배포 도메인의 `PUT`, `GET`, `HEAD` 요청과 `Content-Type` header를 허용해야 브라우저 direct upload가 성공합니다.
- 업로드 파일 보안 제한은 `lib/project-upload.ts`를 확인하세요.
  - 데이터 파일은 `.csv`, `.tsv`, `.json`, `.jsonl`, `.xls`, `.xlsx`만 허용합니다.
  - 이미지 파일은 명시된 raster image 확장자만 허용하며 SVG는 업로드 이미지로 받지 않습니다.
  - `SEEV_MAX_UPLOAD_FILE_BYTES`, `SEEV_MAX_UPLOAD_TOTAL_BYTES`로 파일별/전체 업로드 용량 제한을 조정할 수 있습니다.
- Workspace 공유/Notification 관련 변경은 `components/workspace-actions.tsx`, `app/workspace/page.tsx`, `app/admin/accounts/page.tsx`를 함께 확인하세요.
- DB 구조 변경 시 `prisma/schema.prisma` 수정 후 migration을 만들고 `npx prisma migrate deploy`, `npm run db:generate`를 실행하세요.
- Vercel 배포 시 `npm run vercel-build`는 MVP 초기 배포 기준으로 `prisma generate && prisma db push --accept-data-loss && next build` 순서로 실행됩니다.
- `vercel.json`은 Vercel Build Command를 `npm run vercel-build`로 고정해 dashboard 설정 누락으로 `npm run build`만 실행되는 문제를 줄입니다.
- validation 변경 시 `npm run test:validation`으로 column metadata 검증 테스트를 실행하세요.
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

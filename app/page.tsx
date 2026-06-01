import { HeroSection } from "@/components/ui/hero-section";

export default function Home() {
  return (
    <main>
      <HeroSection
        title="의료 이미지 분석 결과를 더 신뢰할 수 있게 관리합니다"
        subtitle="AI 모델 결과와 임상 데이터를 함께 검토하고, 사용자별 수정 이력을 남겨 검증 가능한 분석 환경을 제공합니다."
        primaryButtonText="Get started"
        primaryButtonHref="/auth"
        secondaryButtonText="Learn more"
        secondaryButtonHref="#learn-more"
        imageUrl="/landing.png"
      />
    </main>
  );
}

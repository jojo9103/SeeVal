"use client";

import { Map, Table } from "lucide-react";

export type ReviewSection = "results" | "annotations";

const reviewSections: Array<{
  id: ReviewSection;
  label: string;
  icon: typeof Table;
}> = [
  {
    id: "results",
    label: "평가 결과 취합",
    icon: Table,
  },
  {
    id: "annotations",
    label: "Annotation 위치 취합",
    icon: Map,
  },
];

export function ReviewSectionMenu({
  activeSection,
  onSectionChange,
}: {
  activeSection: ReviewSection;
  onSectionChange: (section: ReviewSection) => void;
}) {
  return (
    <nav
      aria-label="평가 취합 메뉴"
      className="sticky top-3 z-30 mt-6 flex w-full overflow-x-auto rounded-xl border border-white/12 bg-[#171717]/92 p-1 shadow-[0_14px_34px_rgba(0,0,0,0.28)] backdrop-blur"
    >
      <div className="flex min-w-max gap-1">
        {reviewSections.map((section) => {
          const Icon = section.icon;
          const selected = activeSection === section.id;

          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSectionChange(section.id)}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
                selected
                  ? "bg-teal-300/16 text-teal-50 shadow-[inset_0_0_0_1px_rgba(94,234,212,0.24)]"
                  : "text-white/58 hover:bg-white/[0.07] hover:text-white/82"
              }`}
            >
              <Icon className="h-4 w-4" />
              {section.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

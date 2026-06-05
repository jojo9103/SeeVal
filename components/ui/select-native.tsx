import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface SelectNativeProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
  wrapperClassName?: string;
}

const SelectNative = React.forwardRef<HTMLSelectElement, SelectNativeProps>(
  ({ className, children, wrapperClassName, ...props }, ref) => {
    return (
      <div className={cn("relative", wrapperClassName)}>
        <select
          className={cn(
            "peer inline-flex w-full cursor-pointer appearance-none items-center rounded-md border border-white/12 bg-white/[0.04] text-sm text-white/78 shadow-sm transition focus-visible:border-teal-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            props.multiple
              ? "py-1 [&>*]:px-3 [&>*]:py-1"
              : "h-9 pe-8 ps-3",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        {!props.multiple && (
          <span className="pointer-events-none absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center text-white/50 peer-disabled:opacity-50">
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    );
  }
);

SelectNative.displayName = "SelectNative";

export { SelectNative };

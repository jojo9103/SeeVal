import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  size?: "default" | "lg";
  variant?: "default" | "secondary";
};

export function Button({
  asChild = false,
  children,
  className,
  size = "default",
  type = "button",
  variant = "default",
  ...props
}: ButtonProps) {
  const buttonClassName = cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50",
    variant === "default" &&
      "bg-primary text-primary-foreground hover:bg-primary/90",
    variant === "secondary" &&
      "bg-white/92 text-slate-950 hover:bg-white",
    size === "default" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-8 text-base",
    className
  );

  if (asChild && React.isValidElement<{ className?: string }>(children)) {
    return React.cloneElement(children, {
      className: cn(buttonClassName, children.props.className),
    });
  }

  return (
    <button
      type={type}
      className={buttonClassName}
      {...props}
    >
      {children}
    </button>
  );
}

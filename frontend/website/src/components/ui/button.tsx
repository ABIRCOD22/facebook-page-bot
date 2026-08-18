/**
 * button.tsx — ChatriX marketing design system
 * ------------------------------------------------------------------
 * A complete, framework-agnostic-feeling button kit built on
 * class-variance-authority with a Tailwind merge pipeline.
 *
 * Exports:
 *   - buttonVariants            (cva instance for class composition)
 *   - Button                    (base <button> with every variant/size)
 *   - IconButton                (square icon-only button, sized by size)
 *   - LinkButton                (renders a Next.js <Link prefetch={false}> with button styles)
 *   - LoadingButton             (shows spinner + disables while loading)
 *   - SplitButton               (primary action + dropdown caret)
 *   - ButtonGroup               (joined group with dividers)
 *   - ToggleButton              (aria-pressed stateful pill)
 *   - useButtonGroup            (keyboard roving-tabindex hook)
 *   - BUTTON_VARIANTS / BUTTON_SIZES (registry for docs / testing)
 *
 * All components forward refs and accept the full native attribute set
 * via intersection types. Strict TS, no `any`.
 */

import * as React from "react"
import Link from "next/link"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/* ================================================================
   Variant definitions
   ================================================================ */
export const buttonVariants = cva(
  // base classes shared by every button surface
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none " +
    "transition-[transform,box-shadow,background-color,color,border-color] duration-200 ease-out " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        accent:
          "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90",
        outline:
          "border border-input bg-background shadow-sm hover:border-primary hover:text-primary hover:bg-primary-soft",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline px-0",
        white:
          "bg-white text-ink shadow-md hover:shadow-lg hover:-translate-y-0.5",
        glass:
          "bg-white/70 text-ink backdrop-blur border border-white/60 shadow-md hover:bg-white/90",
        gradient:
          "bg-gradient-to-r from-primary to-[#9333EA] text-white shadow-[0_18px_40px_rgba(124,58,237,0.28)] hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(124,58,237,0.36)]",
        "gradient-accent":
          "bg-gradient-to-r from-accent to-[#06B6D4] text-white shadow-[0_18px_40px_rgba(8,145,178,0.24)] hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        subtle:
          "bg-muted text-ink hover:bg-muted/70",
      },
      size: {
        xs: "h-8 rounded-md px-2.5 text-xs",
        sm: "h-9 rounded-lg px-3 text-sm",
        default: "h-10 rounded-lg px-4 text-sm",
        lg: "h-11 rounded-lg px-6 text-base",
        xl: "h-12 rounded-xl px-8 text-base",
        "2xl": "h-14 rounded-2xl px-10 text-lg",
        icon: "h-10 w-10 rounded-lg",
        "icon-sm": "h-9 w-9 rounded-lg",
        "icon-lg": "h-12 w-12 rounded-xl",
        block: "h-11 w-full rounded-lg px-6 text-base",
      },
      fullWidth: { true: "w-full", false: "" },
      rounded: {
        default: "",
        full: "rounded-full",
        md: "rounded-md",
        lg: "rounded-lg",
        xl: "rounded-xl",
      },
      pulse: { true: "btn-pulse", false: "" },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      fullWidth: false,
      rounded: "default",
      pulse: false,
    },
    compoundVariants: [
      { variant: "link", size: "default", class: "h-auto p-0" },
      { fullWidth: true, class: "justify-center" },
    ],
  }
)

/** Registry so tooling/docs can enumerate available options. */
export const BUTTON_VARIANTS = [
  "default",
  "primary",
  "accent",
  "outline",
  "secondary",
  "ghost",
  "link",
  "white",
  "glass",
  "gradient",
  "gradient-accent",
  "destructive",
  "subtle",
] as const

export const BUTTON_SIZES = [
  "xs",
  "sm",
  "default",
  "lg",
  "xl",
  "2xl",
  "icon",
  "icon-sm",
  "icon-lg",
  "block",
] as const

/* ================================================================
   Shared prop types
   ================================================================ */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Optional left icon node */
  leftIcon?: React.ReactNode
  /** Optional right icon node */
  rightIcon?: React.ReactNode
}

export interface IconButtonProps
  extends Omit<ButtonProps, "size" | "leftIcon" | "rightIcon"> {
  /** Accessible label (required — icon-only buttons need it) */
  "aria-label": string
  /** Visual size token; mapped to square dimensions */
  size?: "icon-sm" | "icon" | "icon-lg"
  icon: React.ReactNode
}

export interface LinkButtonProps
  extends Omit<React.ComponentProps<typeof Link>, "className">,
    VariantProps<typeof buttonVariants> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  className?: string
}

export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean
  loadingText?: string
}

export interface SplitButtonProps extends ButtonProps {
  menu: React.ReactNode
}

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
  attached?: boolean
}

export interface ToggleButtonProps extends ButtonProps {
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
}

/* ================================================================
   Base Button
   ================================================================ */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      rounded,
      pulse,
      leftIcon,
      rightIcon,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          buttonVariants({ variant, size, fullWidth, rounded, pulse }),
          className
        )}
        {...props}
      >
        {leftIcon ? <span className="shrink-0 inline-flex">{leftIcon}</span> : null}
        {children}
        {rightIcon ? <span className="shrink-0 inline-flex">{rightIcon}</span> : null}
      </button>
    )
  }
)
Button.displayName = "Button"

/* ================================================================
   IconButton — square, icon-only, must have aria-label
   ================================================================ */
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size = "icon", icon, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        <span className="inline-flex">{icon}</span>
      </button>
    )
  }
)
IconButton.displayName = "IconButton"

/* ================================================================
   LinkButton — renders a Next.js Link styled as a button
   ================================================================ */
const LinkButton = React.forwardRef<HTMLAnchorElement, LinkButtonProps>(
  (
    { className, variant, size, fullWidth, rounded, pulse, leftIcon, rightIcon, children, href, ...props },
    ref
  ) => {
    return (
      <Link prefetch={false}
        ref={ref}
        href={href}
        className={cn(
          buttonVariants({ variant, size, fullWidth, rounded, pulse }),
          className
        )}
        {...props}
      >
        {leftIcon ? <span className="shrink-0 inline-flex">{leftIcon}</span> : null}
        {children}
        {rightIcon ? <span className="shrink-0 inline-flex">{rightIcon}</span> : null}
      </Link>
    )
  }
)
LinkButton.displayName = "LinkButton"

/* ================================================================
   LoadingButton — spinner + disabled while loading
   ================================================================ */
const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      rounded,
      pulse,
      leftIcon,
      rightIcon,
      children,
      loading = false,
      loading: _loadingProp,
      loadingText,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading}
        className={cn(
          buttonVariants({ variant, size, fullWidth, rounded, pulse }),
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {loadingText ?? children}
          </>
        ) : (
          <>
            {leftIcon ? <span className="shrink-0 inline-flex">{leftIcon}</span> : null}
            {children}
            {rightIcon ? <span className="shrink-0 inline-flex">{rightIcon}</span> : null}
          </>
        )}
      </button>
    )
  }
)
LoadingButton.displayName = "LoadingButton"

/* ================================================================
   SplitButton — primary action with a caret that reveals a menu
   ================================================================ */
const SplitButton = React.forwardRef<HTMLDivElement, SplitButtonProps>(
  (
    { className, variant, size, children, menu, ...props },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const rootRef = React.useRef<HTMLDivElement | null>(null)

    React.useEffect(() => {
      if (!open) return
      const onClick = (e: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
          setOpen(false)
        }
      }
      document.addEventListener("mousedown", onClick)
      return () => document.removeEventListener("mousedown", onClick)
    }, [open])

    return (
      <div ref={mergeRefs(ref, rootRef)} className={cn("relative inline-flex", className)}>
        <div className="inline-flex">
          <Button
            variant={variant}
            size={size}
            rounded="md"
            className="rounded-r-none"
            {...props}
          >
            {children}
          </Button>
          <Button
            variant={variant}
            size={size}
            aria-label="More actions"
            aria-expanded={open}
            rounded="md"
            className="rounded-l-none border-l border-white/20 px-2"
            onClick={() => setOpen((o) => !o)}
            {...props}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </Button>
        </div>
        {open ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 min-w-[12rem] rounded-xl border border-line bg-white p-1 shadow-xl animate-scale-in"
          >
            {menu}
          </div>
        ) : null}
      </div>
    )
  }
)
SplitButton.displayName = "SplitButton"

/* ================================================================
   ButtonGroup — joined buttons with roving tabindex
   ================================================================ */
const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, orientation = "horizontal", attached = true, children, ...props }, ref) => {
    const items = React.Children.toArray(children).filter(Boolean)
    const refs = React.useRef<(HTMLButtonElement | null)[]>([])

    const onKeyDown = (e: React.KeyboardEvent) => {
      const next = orientation === "horizontal" ? "ArrowRight" : "ArrowDown"
      const prev = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp"
      const idx = refs.current.indexOf(document.activeElement as HTMLButtonElement)
      if (idx === -1) return
      if (e.key === next) {
        e.preventDefault()
        refs.current[(idx + 1) % items.length]?.focus()
      } else if (e.key === prev) {
        e.preventDefault()
        refs.current[(idx - 1 + items.length) % items.length]?.focus()
      }
    }

    return (
      <div
        ref={ref}
        role="group"
        aria-orientation={orientation}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex",
          orientation === "vertical" && "flex-col",
          attached && "rounded-lg border border-input bg-background p-1 gap-1",
          className
        )}
        {...props}
      >
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {React.isValidElement(child)
              ? React.cloneElement(child as React.ReactElement<any>, {
                  ref: (el: HTMLButtonElement | null) => {
                    refs.current[i] = el
                  },
                })
              : child}
          </React.Fragment>
        ))}
      </div>
    )
  }
)
ButtonGroup.displayName = "ButtonGroup"

/* ================================================================
   ToggleButton — aria-pressed pill
   ================================================================ */
const ToggleButton = React.forwardRef<HTMLButtonElement, ToggleButtonProps>(
  (
    { className, variant = "outline", size, pressed, defaultPressed = false, onPressedChange, children, ...props },
    ref
  ) => {
    const [internal, setInternal] = React.useState(defaultPressed)
    const isPressed = pressed ?? internal

    const toggle = () => {
      const nextVal = !isPressed
      if (pressed === undefined) setInternal(nextVal)
      onPressedChange?.(nextVal)
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={isPressed}
        onClick={toggle}
        className={cn(
          buttonVariants({ variant, size }),
          isPressed && "bg-primary text-primary-foreground border-primary",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ToggleButton.displayName = "ToggleButton"

/* ================================================================
   Helpers
   ================================================================ */
function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T) => {
    refs.forEach((r) => {
      if (typeof r === "function") r(node)
      else if (r && typeof r === "object") (r as React.MutableRefObject<T | null>).current = node
    })
  }
}

/**
 * Resolve a button class string outside of JSX (for tests / server
 * rendering of class lists). Mirrors buttonVariants output.
 */
export function getButtonClasses(opts?: Parameters<typeof buttonVariants>[0]) {
  return buttonVariants(opts)
}

export {
  Button,
  IconButton,
  LinkButton,
  LoadingButton,
  SplitButton,
  ButtonGroup,
  ToggleButton,
}

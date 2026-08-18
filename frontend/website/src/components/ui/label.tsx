/**
 * label.tsx — accessible labels. Plain <Label> plus a <FormLabel>
 * that appends a required marker and links to its control.
 */
import * as React from "react"
import { cn } from "@/lib/utils"

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}
const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    >
      {children}
      {required ? <span className="ml-0.5 text-destructive">*</span> : null}
    </label>
  )
)
Label.displayName = "Label"

export interface FormLabelProps extends LabelProps {
  hint?: React.ReactNode
}
function FormLabel({ hint, className, children, ...props }: FormLabelProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <Label {...props}>{children}</Label>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

export { Label, FormLabel }

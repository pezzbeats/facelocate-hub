import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        
        /* JusTrack Kiosk Variants - Large, touch-friendly buttons */
        kiosk: "bg-gradient-primary text-primary-foreground hover:shadow-primary transform hover:scale-105 shadow-kiosk font-semibold",
        "kiosk-success": "bg-gradient-success text-success-foreground hover:shadow-success transform hover:scale-105 shadow-kiosk font-semibold",
        "kiosk-outline": "border-2 border-primary bg-kiosk-card text-primary hover:bg-primary hover:text-primary-foreground transform hover:scale-105 shadow-elegant font-semibold",
        
        /* Admin Dashboard Variants */
        admin: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-elegant",
        "admin-success": "bg-success text-success-foreground hover:bg-success/90 shadow-success",
        "admin-outline": "border border-primary bg-background text-primary hover:bg-primary hover:text-primary-foreground",
        
        /* Status Indicator Variants */
        "status-online": "bg-status-online text-white hover:bg-status-online/90",
        "status-offline": "bg-status-offline text-white hover:bg-status-offline/90",
        "status-pending": "bg-status-pending text-white hover:bg-status-pending/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        
        /* Kiosk-specific sizes - Large and accessible */
        kiosk: "h-16 px-8 py-4 text-lg rounded-xl",
        "kiosk-xl": "h-20 px-12 py-6 text-xl rounded-2xl",
        "kiosk-sm": "h-12 px-6 py-3 text-base rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

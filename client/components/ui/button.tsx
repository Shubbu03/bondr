import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'hero' | 'outline' | 'ghost' | 'default' | 'secondary';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

        const variants = {
            default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md',
            hero: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl border-2 border-primary/20',
            secondary: 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm hover:shadow-md',
            outline: 'border-2 border-primary/20 bg-background hover:bg-primary hover:text-primary-foreground transition-all duration-200',
            ghost: 'hover:bg-accent/10 hover:text-accent-foreground',
        };

        const sizes = {
            sm: 'h-8 px-3 text-sm',
            md: 'h-10 px-4 py-2',
            lg: 'h-12 px-8',
            icon: 'h-10 w-10',
        };

        return (
            <button
                className={cn(
                    baseStyles,
                    variants[variant],
                    sizes[size],
                    className
                )}
                ref={ref}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button };

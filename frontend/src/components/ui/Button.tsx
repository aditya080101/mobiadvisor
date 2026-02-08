import * as React from 'react';
import { cn } from 'lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

        const variantStyles = {
            default: 'bg-violet-600 text-white hover:bg-violet-700',
            secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
            outline: 'border border-gray-200 bg-transparent hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800',
            ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800',
            link: 'text-violet-600 underline-offset-4 hover:underline',
        };

        const sizeStyles = {
            default: 'h-10 px-4 py-2 text-sm',
            sm: 'h-8 rounded-md px-3 text-xs',
            lg: 'h-12 rounded-md px-8 text-base',
            icon: 'h-10 w-10',
        };

        return (
            <button
                className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
                ref={ref}
                {...props}
            />
        );
    }
);

Button.displayName = 'Button';

export { Button };

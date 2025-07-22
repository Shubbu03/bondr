"use client";

import { AlertCircle, CheckCircle, Loader2, RotateCcw } from 'lucide-react';
import { RemittanceStatus } from '@/types/remittance';

interface FeedbackProps {
    status: RemittanceStatus;
    error?: string;
    onRetry?: () => void;
}

export const Feedback: React.FC<FeedbackProps> = ({ status, error, onRetry }) => {
    if (status === 'idle') return null;

    const getStatusConfig = () => {
        switch (status) {
            case 'creating':
                return {
                    icon: <Loader2 className="w-8 h-8 text-eucalyptus animate-spin" />,
                    title: 'Creating Remittance',
                    message: 'Please wait while we process your transaction...',
                    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
                    borderColor: 'border-blue-200 dark:border-blue-700/50',
                };
            case 'success':
                return {
                    icon: <CheckCircle className="w-8 h-8 text-green-500" />,
                    title: 'Success!',
                    message: 'Your remittance has been created successfully.',
                    bgColor: 'bg-green-50 dark:bg-green-900/20',
                    borderColor: 'border-green-200 dark:border-green-700/50',
                };
            case 'error':
                return {
                    icon: <AlertCircle className="w-8 h-8 text-red-500" />,
                    title: 'Error',
                    message: error || 'An unexpected error occurred. Please try again.',
                    bgColor: 'bg-red-50 dark:bg-red-900/20',
                    borderColor: 'border-red-200 dark:border-red-700/50',
                };
            default:
                return null;
        }
    };

    const config = getStatusConfig();
    if (!config) return null;

    return (
        <div className={`p-6 rounded-2xl border-2 ${config.bgColor} ${config.borderColor} backdrop-blur-sm`}>
            <div className="flex items-center gap-4">
                {config.icon}
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-black-glaze dark:text-white mb-1">
                        {config.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                        {config.message}
                    </p>
                </div>
                {status === 'error' && onRetry && (
                    <button
                        onClick={onRetry}
                        className="flex items-center gap-2 px-4 py-2 bg-eucalyptus hover:bg-eucalyptus/90 dark:bg-eucalyptus dark:hover:bg-eucalyptus/80 text-white rounded-lg transition-colors shadow-lg hover:shadow-xl"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
}; 
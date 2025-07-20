"use client";

import { useForm } from 'react-hook-form';
import { useWallet } from '@solana/wallet-adapter-react';
import { Send, Wallet } from 'lucide-react';
import { RemittanceFormData } from '@/types/remittance';
import { PublicKey } from '@solana/web3.js';

interface RemittanceFormProps {
    onSubmit: (data: RemittanceFormData) => void;
    isLoading: boolean;
}

export const RemittanceForm: React.FC<RemittanceFormProps> = ({ onSubmit, isLoading }) => {
    const { connected, publicKey } = useWallet();

    const {
        register,
        handleSubmit,
        formState: { errors, isValid },
        watch,
    } = useForm<RemittanceFormData>({
        mode: 'onChange',
        defaultValues: {
            amount: '',
            receiverWallet: '',
        }
    });

    const amount = watch('amount');

    const validateAmount = (value: string) => {
        const amount = parseFloat(value);
        if (!value || isNaN(amount)) {
            return 'Please enter a valid amount';
        }
        if (amount < 0.001) {
            return 'Minimum amount is ◎0.001';
        }
        if (amount > 1000) {
            return 'Maximum amount is ◎1000';
        }
        return true;
    };

    const validateWallet = (value: string) => {
        if (value && value.trim()) {
            if (validatePubkey(value) == false) {
                return 'Please enter a valid Solana wallet address'
            }

            if (value === publicKey?.toString()) {
                return 'Cannot send remittance to yourself, please add different wallet';
            }
        }
        return true;
    };

    const validatePubkey = (address: string) => {
        try {
            let pubkey = new PublicKey(address)
            let isSolana = PublicKey.isOnCurve(pubkey.toBuffer())
            return isSolana
        } catch (error) {
            return false
        }
    }
    const onFormSubmit = (data: RemittanceFormData) => {
        if (!connected) return;
        onSubmit(data);
    };

    if (!connected) {
        return (
            <div className="bg-white dark:bg-black-glaze/80 p-8 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700/30 backdrop-blur-sm">
                <div className="text-center">
                    <Wallet className="w-12 h-12 text-eucalyptus mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-black-glaze dark:text-white mb-2">Connect Your Wallet</h3>
                    <p className="text-gray-600 dark:text-gray-300">Please connect your wallet to create a remittance</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-black-glaze/80 p-8 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700/30 backdrop-blur-sm">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-black-glaze dark:text-white mb-2">Create Remittance</h2>
                <p className="text-gray-600 dark:text-gray-300">Send SOL to anyone with a QR code</p>
            </div>

            <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
                {/* Amount Input */}
                <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-black-glaze dark:text-white mb-2">
                        Amount *
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 font-medium pointer-events-none">
                            ◎
                        </span>
                        <input
                            id="amount"
                            type="text"
                            {...register('amount', {
                                validate: validateAmount,
                                pattern: {
                                    value: /^\d*\.?\d{0,6}$/,
                                    message: 'Invalid amount format'
                                }
                            })}
                            placeholder="0.001"
                            className={`w-full pl-8 pr-4 py-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-eucalyptus/20 dark:focus:ring-eucalyptus/30 transition-colors ${errors.amount
                                ? 'border-red-300 dark:border-red-500 bg-red-50 dark:bg-red-900/20'
                                : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 focus:border-eucalyptus dark:focus:border-eucalyptus'
                                } text-black-glaze dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                            disabled={isLoading}
                        />
                    </div>
                    {errors.amount && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.amount.message}</p>
                    )}
                    {!errors.amount && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Min: ◎0.001 • Max: ◎1,000
                        </p>
                    )}
                </div>

                {/* Receiver Wallet Input */}
                <div>
                    <label htmlFor="receiverWallet" className="block text-sm font-medium text-black-glaze dark:text-white mb-2">
                        Receiver Wallet (optional)
                    </label>
                    <input
                        id="receiverWallet"
                        type="text"
                        {...register('receiverWallet', {
                            validate: validateWallet
                        })}
                        placeholder="Enter Solana wallet address"
                        className={`w-full px-4 py-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-eucalyptus/20 dark:focus:ring-eucalyptus/30 transition-colors ${errors.receiverWallet
                            ? 'border-red-300 dark:border-red-500 bg-red-50 dark:bg-red-900/20'
                            : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 focus:border-eucalyptus dark:focus:border-eucalyptus'
                            } text-black-glaze dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                        disabled={isLoading}
                    />
                    {errors.receiverWallet && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.receiverWallet.message}</p>
                    )}
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        If left empty, anyone can claim this remittance
                    </p>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading || !amount || !isValid}
                    className="w-full bg-eucalyptus hover:bg-eucalyptus/90 dark:bg-eucalyptus dark:hover:bg-eucalyptus/80 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl dark:shadow-eucalyptus/20"
                >
                    {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Creating Remittance...
                        </>
                    ) : (
                        <>
                            <Send className="w-5 h-5" />
                            Create Remittance
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}; 
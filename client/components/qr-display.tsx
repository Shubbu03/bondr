"use client";

import { QRCodeSVG } from 'qrcode.react';
import { Copy, Download, Share2, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { RemittanceData } from '@/types/remittance';

interface QRDisplayProps {
    remittanceData: RemittanceData;
    qrUrl: string;
}

export const QRDisplay: React.FC<QRDisplayProps> = ({ remittanceData, qrUrl }) => {
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const { theme } = useTheme();

    const copyToClipboard = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const downloadQR = () => {
        const svg = document.getElementById('qr-code');
        if (!svg) return;

        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(svg);
        const blob = new Blob([source], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `bondr-remittance-${remittanceData.refSeed}.svg`;
        link.click();

        URL.revokeObjectURL(url);
    };

    const shareQR = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Bondr Remittance',
                    text: `Claim your SOL remittance of ${remittanceData.amount} SOL`,
                    url: qrUrl,
                });
            } catch (err) {
                console.error('Error sharing:', err);
            }
        } else {
            copyToClipboard(qrUrl, 'share');
        }
    };

    return (
        <div className="bg-white dark:bg-black-glaze/80 p-8 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700/30 backdrop-blur-sm">
            <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-black-glaze dark:text-white mb-2">Remittance Created!</h3>
                <p className="text-gray-600 dark:text-gray-300">Share this QR code with the recipient</p>
            </div>

            <div className="flex justify-center mb-6">
                <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-100 dark:border-gray-600">
                    <QRCodeSVG
                        id="qr-code"
                        value={qrUrl}
                        size={200}
                        bgColor={theme === 'dark' ? '#1f2937' : '#ffffff'}
                        fgColor={theme === 'dark' ? '#ffffff' : '#061611'}
                        level="M"
                        includeMargin={true}
                    />
                </div>
            </div>

            {/* Remittance Info */}
            <div className="space-y-4 mb-6">
                <div className="bg-pistachio/10 dark:bg-pistachio/20 p-4 rounded-lg border border-pistachio/20 dark:border-pistachio/30">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-eucalyptus dark:text-pistachio">Amount</span>
                        <span className="text-lg font-bold text-black-glaze dark:text-white">◎{remittanceData.amount}</span>
                    </div>
                </div>

                {remittanceData.receiverWallet && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-start gap-3">
                            <div className="flex-1">
                                <span className="text-sm font-medium text-eucalyptus dark:text-pistachio block mb-1">Receiver</span>
                                <span className="text-sm text-black-glaze dark:text-gray-300 font-mono break-all">
                                    {remittanceData.receiverWallet}
                                </span>
                            </div>
                            <button
                                onClick={() => copyToClipboard(remittanceData.receiverWallet!, 'receiver')}
                                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-eucalyptus dark:hover:text-eucalyptus transition-colors rounded"
                                title="Copy receiver address"
                            >
                                {copiedField === 'receiver' ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
                <button
                    onClick={() => copyToClipboard(qrUrl, 'url')}
                    className="flex items-center justify-center gap-2 p-3 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                    title="Copy URL"
                >
                    {copiedField === 'url' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                        <Copy className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">Copy</span>
                </button>

                <button
                    onClick={downloadQR}
                    className="flex items-center justify-center gap-2 p-3 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                    title="Download QR Code"
                >
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-medium">Download</span>
                </button>

                <button
                    onClick={shareQR}
                    className="flex items-center justify-center gap-2 p-3 bg-eucalyptus hover:bg-eucalyptus/90 dark:bg-eucalyptus dark:hover:bg-eucalyptus/80 text-white rounded-lg transition-colors shadow-lg hover:shadow-xl"
                    title="Share"
                >
                    <Share2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Share</span>
                </button>
            </div>
        </div>
    );
}; 
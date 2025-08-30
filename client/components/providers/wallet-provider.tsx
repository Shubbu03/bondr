"use client";

import {
    ConnectionProvider,
    WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { useMemo } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";

const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT;

export default function SolanaWalletProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    if (!rpcEndpoint) {
        throw new Error("NEXT_PUBLIC_RPC_ENDPOINT is not set");
    }

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new BackpackWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        []
    );

    return (
        <ConnectionProvider endpoint={rpcEndpoint} config={{ commitment: "processed", httpAgent: false }}>
            <WalletProvider wallets={wallets}>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}

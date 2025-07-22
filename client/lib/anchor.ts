import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Connection } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import BondrIDL from '@/idl/bondr.json';
import type { Bondr } from '../../target/types/bondr';

export function getProgram(wallet: WalletContextState, connection: Connection): Program<Bondr> {
    if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
    }

    const provider = new AnchorProvider(
        connection,
        wallet as any,
        {
            commitment: 'confirmed',
            preflightCommitment: 'confirmed'
        }
    );

    // const program = workspace.Bondr as Program<Bondr>;
    return new Program(BondrIDL as Bondr, provider);
    // return program;
}

export function getConnection() {
    return new Connection('https://api.devnet.solana.com', 'confirmed');
} 
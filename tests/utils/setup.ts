import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Bondr } from "../../target/types/bondr";
import { Keypair, PublicKey } from "@solana/web3.js";

// Common test setup
anchor.setProvider(anchor.AnchorProvider.local());
export const provider = anchor.getProvider();
export const connection = provider.connection;
export const program = anchor.workspace.Bondr as Program<Bondr>;

// Test utilities
export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const airdropSol = async (publicKey: PublicKey, amount: number = 2_000_000_000) => {
    await connection.requestAirdrop(publicKey, amount);
    await sleep(3000);
};

export const createFundedKeypair = async (amount: number = 2_000_000_000) => {
    const keypair = Keypair.generate();
    await airdropSol(keypair.publicKey, amount);
    return keypair;
};

export const fundKeypairs = async (...keypairs: Keypair[]) => {
    await Promise.all(
        keypairs.map(keypair => connection.requestAirdrop(keypair.publicKey, 2_000_000_000))
    );
    await sleep(3000);
}; 
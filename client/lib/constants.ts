import { PublicKey } from "@solana/web3.js";

export const BONDR_PROGRAM_ID = new PublicKey("CFXd43mg9TDN5cSHgaUm5ahPSTvLTb9hw3XuASCVL4wh");

// Base URL for claim page
// export const CLAIM_BASE_URL = process.env.NODE_ENV === 'production'
//     ? 'https://your-domain.com/claim'
//     : 'http://localhost:3000/claim';
export const CLAIM_BASE_URL = 'http://localhost:3000/claim';
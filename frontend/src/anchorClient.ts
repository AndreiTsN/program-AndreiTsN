// src/anchorClient.ts
import type { Idl } from "@coral-xyz/anchor";
import { AnchorProvider, Program, setProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "./idl_anchor_project.json";

// Берём Program ID из IDL (сначала address, потом metadata.address как fallback)
export const PROGRAM_ID = new PublicKey(
  // @ts-ignore
  (idl as any).address ??
    // @ts-ignore
    (idl as any).metadata?.address ??
    "5u8KdFByQxwVdc6orGV5gUJL5avYc5VFvgfSj1eXD2Pw"
);

// Реэкспортируем SystemProgram, чтобы можно было импортировать из anchorClient
export { SystemProgram };

// Возвращаем Program; ослабляем типизацию до any, чтобы не бороться с generic-ами Idl
export function getProgram(connection: Connection, wallet: any) {
  if (!wallet) {
    throw new Error("Wallet not connected");
  }

  const provider = new AnchorProvider(connection, wallet, {
    preflightCommitment: "processed",
  });

  setProvider(provider);

  // Приводим к any, чтобы TS не ругался на сигнатуру конструктора Program
  return new Program(idl as Idl, PROGRAM_ID as any, provider as any) as any;
}

// PDA сплиттера: seeds = ["splitter", authority]
export function getSplitterPda(authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("splitter"), authority.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

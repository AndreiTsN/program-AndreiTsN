// src/App.tsx
import { useCallback, useEffect, useState } from "react";
import {
  useConnection,
  useWallet,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getProgram, getSplitterPda, SystemProgram } from "./anchorClient";
import { PublicKey, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";

type RecipientForm = {
  wallet: string;
  share: number;
};

// Функция, которая каждый раз возвращает НОВЫЙ массив и НОВЫЕ объекты
const createInitialRecipients = (): RecipientForm[] => [
  { wallet: "", share: 1 },
  { wallet: "", share: 1 },
];

function App() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const anchorWallet = useAnchorWallet();

  const [recipients, setRecipients] = useState<RecipientForm[]>(() =>
    createInitialRecipients()
  );

  const [splitterPda, setSplitterPda] = useState<PublicKey | null>(null);
  const [pdaBalance, setPdaBalance] = useState<number | null>(null);
  const [onChainRecipients, setOnChainRecipients] = useState<
    { wallet: string; share: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  const refreshState = useCallback(async () => {
    if (!publicKey || !anchorWallet) return;
    try {
      const program = getProgram(connection, anchorWallet) as any;
      const pda = getSplitterPda(publicKey);
      setSplitterPda(pda);

      try {
        const splitter: any = await program.account.splitter.fetch(pda);
        setOnChainRecipients(
          splitter.recipients.map((r: any) => ({
            wallet: r.wallet.toBase58(),
            share: r.share,
          }))
        );
        const bal = await connection.getBalance(pda);
        setPdaBalance(bal / LAMPORTS_PER_SOL);
      } catch {
        setOnChainRecipients([]);
        setPdaBalance(null);
      }
    } catch (e) {
      console.error(e);
    }
  }, [publicKey, anchorWallet, connection]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const handleRecipientChange = (
    index: number,
    field: "wallet" | "share",
    value: string
  ) => {
    setRecipients((prev) => {
      const copy = [...prev];
      if (field === "wallet") {
        copy[index].wallet = value;
      } else {
        copy[index].share = Number(value);
      }
      return copy;
    });
  };

  const handleAddRecipient = () => {
    setRecipients((prev) => [...prev, { wallet: "", share: 1 }]);
  };

  const handleInitialize = async () => {
    if (!publicKey || !anchorWallet) {
      setStatus("Connect wallet first");
      return;
    }
    setLoading(true);
    setStatus("Initializing splitter...");
    try {
      const program = getProgram(connection, anchorWallet) as any;
      const splitterPda = getSplitterPda(publicKey);

      const validRecipients = recipients
        .filter((r) => r.wallet && r.share > 0)
        .map((r) => ({
          wallet: new PublicKey(r.wallet),
          share: r.share,
        }));

      if (validRecipients.length === 0) {
        setStatus("Add at least one recipient with non-zero share");
        setLoading(false);
        return;
      }

      await program.methods
        .initialize(validRecipients)
        .accounts({
          authority: publicKey,
          splitter: splitterPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setStatus("Splitter initialized");
      await refreshState();
    } catch (e: any) {
      console.error(e);
      setStatus(`Initialize failed: ${e.message ?? e.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!publicKey || !splitterPda) {
      setStatus("Need wallet and splitter first");
      return;
    }
    setLoading(true);
    setStatus("Sending 0.1 SOL to splitter PDA...");
    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: splitterPda,
          lamports: 0.1 * LAMPORTS_PER_SOL,
        })
      );
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setStatus(`Deposited 0.1 SOL. Tx: ${sig}`);
      await refreshState();
    } catch (e: any) {
      console.error(e);
      setStatus(`Deposit failed: ${e.message ?? e.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDistribute = async () => {
    if (!publicKey || !splitterPda || !anchorWallet) {
      setStatus("Need wallet and splitter first");
      return;
    }
    if (onChainRecipients.length === 0) {
      setStatus("Splitter has no recipients on-chain");
      return;
    }
    setLoading(true);
    setStatus("Distributing funds...");
    try {
      const program = getProgram(connection, anchorWallet) as any;

      const remainingAccounts = onChainRecipients.map((r) => ({
        pubkey: new PublicKey(r.wallet),
        isSigner: false,
        isWritable: true,
      }));

      await program.methods
        .distribute()
        .accounts({
          splitter: splitterPda,
          authority: publicKey,
        })
        .remainingAccounts(remainingAccounts)
        .rpc();

      setStatus("Distribution completed");
      await refreshState();
    } catch (e: any) {
      console.error(e);
      setStatus(
        `Distribute failed: ${
          e.error?.errorMessage ?? e.message ?? e.toString()
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!publicKey || !splitterPda || !anchorWallet) {
      setStatus("Need wallet and splitter first");
      return;
    }
    setLoading(true);
    setStatus("Closing splitter...");
    try {
      const program = getProgram(connection, anchorWallet) as any;

      await program.methods
        .close()
        .accounts({
          splitter: splitterPda,
          authority: publicKey,
        })
        .rpc();

      setStatus("Splitter closed. Configure a new one above.");
      setOnChainRecipients([]);
      setPdaBalance(null);
      setSplitterPda(null);
      setRecipients(createInitialRecipients());
    } catch (e: any) {
      console.error(e);
      setStatus(
        `Close failed: ${
          e.error?.errorMessage ?? e.message ?? e.toString()
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Revenue Splitter dApp</h1>
        <WalletMultiButton />
      </header>

      {!connected && <p>Connect your wallet to continue.</p>}

      {connected && (
        <>
          <section className="card">
            <h2>1. Recipients Configuration</h2>
            <p>Your Wallet (authority): {publicKey?.toBase58()}</p>

            {recipients.map((r, i) => (
              <div key={i} className="recipient-row">
                <input
                  placeholder="Recipient wallet address"
                  value={r.wallet}
                  onChange={(e) =>
                    handleRecipientChange(i, "wallet", e.target.value)
                  }
                  style={{ width: "420px" }}
                />
                <input
                  type="number"
                  min={1}
                  value={r.share}
                  onChange={(e) =>
                    handleRecipientChange(i, "share", e.target.value)
                  }
                  style={{ width: "80px", marginLeft: 8 }}
                />
              </div>
            ))}

            <button onClick={handleAddRecipient} disabled={loading}>
              + Add recipient
            </button>

            <button
              onClick={handleInitialize}
              disabled={loading}
              style={{ marginLeft: 12 }}
            >
              Create Splitter
            </button>
          </section>

          <section className="card">
            <h2>2.Splitter Status</h2>
            <p>
              Splitter PDA:{" "}
              {splitterPda ? splitterPda.toBase58() : "Not initialized"}
            </p>
            <p>
              PDA balance:{" "}
              {pdaBalance !== null ? `${pdaBalance.toFixed(6)} SOL` : "-"}
            </p>
            <h3>Recipients on-chain:</h3>
            {onChainRecipients.length === 0 && (
              <p>No (not initialized yet?)</p>
            )}
            {onChainRecipients.length > 0 && (
              <ul>
                {onChainRecipients.map((r, i) => (
                  <li key={i}>
                    {r.wallet} — share: {r.share}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>3. Deposit & Distribution</h2>
            <button onClick={handleDeposit} disabled={loading || !splitterPda}>
              Deposit 0.1 SOL to PDA
            </button>
            <button
              onClick={handleDistribute}
              disabled={loading || !splitterPda}
              style={{ marginLeft: 12 }}
            >
              Distribute funds
            </button>
            <button
              onClick={handleClose}
              disabled={loading || !splitterPda}
              style={{ marginLeft: 12 }}
            >
              Close splitter
            </button>
          </section>

          <section className="card">
            <h2>Status</h2>
            <pre>{status}</pre>
          </section>
        </>
      )}
    </div>
  );
}

export default App;

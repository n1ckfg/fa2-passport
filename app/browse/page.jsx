"use client";

import { BeaconWallet } from "@taquito/beacon-wallet";
import { TezosToolkit } from "@taquito/taquito";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const CONTRACT_ADDRESS = "KT18d9H7uvH6LAJ76ZkqmXfZ6RTYcsyifiQa";
const RPC_URL = "https://rpc.tzkt.io/ghostnet";

const emojiMap = {
  UK: "🇬🇧",
  US: "🇺🇸",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Nigeria: "🇳🇬",
};

export default function BrowsePage() {
  const Tezos = new TezosToolkit(RPC_URL);
  const walletRef = useRef(null);

  const [allPassports, setAllPassports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedPassport, setSelectedPassport] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");

  // Connect wallet function
  const connectWallet = async () => {
    setMessage("");
    try {
      const options = {
        name: "Passport NFT Prototype",
        network: { type: "ghostnet" },
      };
      const wallet = new BeaconWallet(options);
      walletRef.current = wallet;
      await wallet.requestPermissions();
      Tezos.setProvider({ wallet: walletRef.current });

      const address = await wallet.getPKH();
      setWalletAddress(address);
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  };

  // Load all passports from contract
  const loadAllPassports = async () => {
    try {
      setLoading(true);
      const contract = await Tezos.contract.at(CONTRACT_ADDRESS);
      const storage = await contract.storage();

      const passports = [];
      const nextTokenId = storage.next_token_id ? Number(storage.next_token_id) : 0;

      // Get all passports (owned by anyone)
      for (let i = 0; i < nextTokenId; i++) {
        try {
          const owner = await storage.ledger.get(i);
          const passportData = await storage.passports.get(i);

          if (passportData && owner) {
            const stamps = passportData.stamps || [];
            const stampsWithEmojis = Array.isArray(stamps)
              ? stamps.map((s) => {
                  const countryString = String(s);
                  return emojiMap[countryString] || countryString;
                })
              : [];

            passports.push({
              tokenId: i,
              owner: owner,
              spineColor: passportData.spine_color || "#000000",
              stamps: stampsWithEmojis,
            });
          }
        } catch (e) {
          continue;
        }
      }

      passports.sort((a, b) => a.tokenId - b.tokenId);
      setAllPassports(passports);
    } catch (error) {
      console.error("Error loading passports:", error);
      setMessage(error.message || "Error loading passports");
    } finally {
      setLoading(false);
    }
  };

  // Try to stamp a passport (should fail if not owner)
  const tryStamp = async (passport) => {
    if (!walletAddress) {
      setMessage("Please connect your wallet first");
      await connectWallet();
      if (!walletAddress) return;
    }

    if (passport.owner === walletAddress) {
      setMessage("This is your passport! Use the main page to stamp it.");
      return;
    }

    const countryInput = prompt(`Enter a country code:\n${Object.keys(emojiMap).join(", ")}`);
    if (!countryInput) {
      return;
    }

    const countryKey = Object.keys(emojiMap).find(
      key => key.toLowerCase() === countryInput.trim().toLowerCase()
    );

    if (!countryKey) {
      setMessage(`Invalid country code. Please use one of: ${Object.keys(emojiMap).join(", ")}`);
      return;
    }

    try {
      setMessage("Attempting to stamp (this should fail if you're not the owner)...");
      
      // This will fail if the user doesn't own the passport
      const contract = await Tezos.wallet.at(CONTRACT_ADDRESS);
      const op = await contract.methodsObject
        .stamp({
          token_id: passport.tokenId,
          emoji: countryKey,
        })
        .send();

      await op.confirmation(2);
      setMessage("Stamp added (unexpected - you shouldn't own this passport)");
    } catch (error) {
      setMessage(`❌ Error: ${error.message || "You cannot stamp a passport you don't own!"}`);
      console.log("Expected error:", error);
    }
  };

  useEffect(() => {
    loadAllPassports();
  }, []);

  return (
    <div className="app-container">
      <div className="header">
        <Link href="/" style={{ color: '#fff', textDecoration: 'none', marginRight: '20px' }}>
          ← My Passports
        </Link>
        {walletAddress ? (
          <div className="wallet-info">
            <div className="wallet-address">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
          </div>
        ) : (
          <button className="btn-wallet" onClick={connectWallet}>
            Connect Wallet
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <h1>Browse All Passports</h1>
        <p style={{ color: '#aaa', marginBottom: '30px', textAlign: 'center', maxWidth: '600px' }}>
          View all passports in the collection. Try to stamp a passport you don't own to see the contract protection in action!
        </p>

        {loading ? (
          <div className="message">Loading passports...</div>
        ) : allPassports.length === 0 ? (
          <div className="message">No passports found</div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '20px', 
            width: '100%', 
            maxWidth: '1200px',
            padding: '20px'
          }}>
            {allPassports.map((passport) => (
              <div
                key={passport.tokenId}
                className="passport-page"
                style={{
                  borderLeftColor: passport.spineColor,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
                onClick={() => setSelectedPassport(selectedPassport?.tokenId === passport.tokenId ? null : passport)}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div className="passport-header">
                  <span>PASSPORT / PASSEPORT</span>
                  <span>TOKEN ID: {passport.tokenId}</span>
                </div>
                <div className="passport-body">
                  <div className="passport-photo">👤</div>
                  <div className="stamps-grid">
                    {passport.stamps && passport.stamps.length > 0 ? (
                      passport.stamps.map((stamp, index) => (
                        <span
                          key={index}
                          className="passport-stamp"
                          style={{
                            transform: `rotate(${Math.random() * 40 - 20}deg)`,
                          }}
                        >
                          {stamp}
                        </span>
                      ))
                    ) : (
                      <div className="empty-passport">No stamps yet</div>
                    )}
                  </div>
                </div>
                <div className="passport-info">
                  <div>OWNER: {passport.owner.slice(0, 6)}...{passport.owner.slice(-4)}</div>
                  <div>STATUS: VALID / ACTIF</div>
                  {selectedPassport?.tokenId === passport.tokenId && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ccc' }}>
                      {passport.owner === walletAddress ? (
                        <div style={{ color: '#8b0000', fontSize: '10px' }}>
                          ✓ This is your passport
                        </div>
                      ) : (
                        <button
                          className="btn-action"
                          style={{ fontSize: '12px', padding: '8px', marginTop: '5px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            tryStamp(passport);
                          }}
                        >
                          Try to Stamp (Will Fail)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="message">
          {message}
        </div>
      </div>
    </div>
  );
}


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

  // Reset/Change Wallet - Clears storage and allows selecting a new wallet
  const resetWallet = async () => {
    setMessage("");
    try {
      // Clear active account if wallet exists
      if (walletRef.current && walletRef.current != "disconnected") {
        try {
          await walletRef.current.client.disconnect();
        } catch (e) {
          // If disconnect fails, try clearActiveAccount
          walletRef.current.client.clearActiveAccount();
        }
      }

      // Clear wallet reference
      walletRef.current = null;
      setWalletAddress("");

      // Clear Beacon storage from browser
      try {
        // Clear localStorage items related to Beacon
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('beacon') || key.startsWith('walletconnect')) {
            localStorage.removeItem(key);
          }
        });

        // Clear sessionStorage
        const sessionKeys = Object.keys(sessionStorage);
        sessionKeys.forEach(key => {
          if (key.startsWith('beacon') || key.startsWith('walletconnect')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.log("Error clearing storage:", e);
      }

      setMessage("Wallet reset. You can now connect a different wallet.");
      console.log("Wallet reset - storage cleared");
    } catch (error) {
      console.error("Error resetting wallet:", error);
      setMessage(error.message || "Error resetting wallet");
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

  // Try to stamp a passport (should fail if not owner) - uses same method as landing page
  const tryStamp = async (passport) => {
    if (passport.owner === walletAddress) {
      setMessage("This is your passport! Use the main page to stamp it.");
      return;
    }

    const countryInput = prompt(`Enter a country code:\n${Object.keys(emojiMap).join(", ")}`);
    if (!countryInput) {
      return;
    }

    // Get the country key, case-insensitive
    const countryKey = Object.keys(emojiMap).find(
      key => key.toLowerCase() === countryInput.trim().toLowerCase()
    );
    
    if (!countryKey) {
      setMessage(`Invalid country code. Please use one of: ${Object.keys(emojiMap).join(", ")}`);
      return;
    }

    // Send the country string to the contract (not the emoji)
    const countryString = countryKey;

    try {
      await connectWallet();

      const contract = await Tezos.wallet.at(CONTRACT_ADDRESS);
      const op = await contract.methodsObject
        .stamp({
          token_id: passport.tokenId,
          emoji: countryString,
        })
        .send();

      setMessage("One minute. Getting your passport stamped");
      const hash  = await op.confirmation(2);
      console.log("hash: ", hash);

      if (hash) {
        setMessage("Stamp added successfully!");
        // Reload passports to show updated state
        await loadAllPassports();
      }
    } catch (error) {
      setMessage(error.message || "You cannot stamp a passport you don't own!");
      console.log(error);
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
          <div className="wallet-info">
            <button className="btn-wallet" onClick={connectWallet}>
              Connect Wallet
            </button>
            <button className="btn-wallet" onClick={resetWallet}>
              Reset Wallet
            </button>
          </div>
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


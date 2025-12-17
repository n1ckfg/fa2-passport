"use client";

import { BeaconWallet } from "@taquito/beacon-wallet";
import { TezosToolkit } from "@taquito/taquito";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const CONTRACT_ADDRESS = "KT18d9H7uvH6LAJ76ZkqmXfZ6RTYcsyifiQa";
const MINT_PRICE = 100000; // 0.1 tez in mutez
const RPC_URL = "https://rpc.tzkt.io/ghostnet";

const emojiMap = {
  UK: "🇬🇧",
  US: "🇺🇸",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Nigeria: "🇳🇬",
};

export default function Home() {
  // Step 2 - Initialise a Tezos instance
  const Tezos = new TezosToolkit(RPC_URL);

  // Step 3 - Set state to display content on the screen
  const [passports, setPassports] = useState([]);
  const [currentPassportIndex, setCurrentPassportIndex] = useState(-1);
  const [message, setMessage] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [reload, setReload] = useState(false);

  // Step 4 - Set a wallet ref to hold the wallet instance later
  const walletRef = useRef(null);

  // Spine color options - brighter colors
  const spineColors = [
    "#000000", // black
    "#FF6B6B", // Bright red
    "#4ECDC4", // Bright teal
    "#45B7D1", // Bright blue
    "#FFA07A", // Bright salmon
    "#98D8C8", // Bright mint
    "#F7DC6F", // Bright yellow
    "#BB8FCE", // Bright purple
    "#85C1E2", // Bright sky blue
    "#F8B739", // Bright orange
    "#52BE80", // Bright green
  ];

  // Step 5 - Create a ConnectWallet Function
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

      // Get the wallet address after connecting
      const address = await wallet.getPKH();
      setWalletAddress(address);
      // Load passports after connecting
      await loadPassports();
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  };

  // Step 6 - Create a function to allow users disconnect their wallet from the dApp
  const disconnectWallet = () => {
    setMessage("");
    if (walletRef.current != "disconnected") {
      walletRef.current?.client.clearActiveAccount();
      walletRef.current = "disconnected";
      setWalletAddress("");
      setPassports([]);
      setCurrentPassportIndex(-1);
      console.log("Disconnected");
    } else {
      console.log("Already disconnected");
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
      setPassports([]);
      setCurrentPassportIndex(-1);

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

  // Load passports from contract storage
  const loadPassports = async () => {
    if (!walletAddress) return;

    try {
      const contract = await Tezos.contract.at(CONTRACT_ADDRESS);
      const storage = await contract.storage();
      console.log("storage: ", storage);
      // Get all passports owned by the connected wallet
      const userPassports = [];
      
      // Get next_token_id to know how many tokens exist
      const nextTokenId = storage.next_token_id ? Number(storage.next_token_id) : 0;
      
      // Iterate through possible token IDs to find ones owned by the user
      const tokenIds = [];
      
      // Check ledger big_map for tokens owned by this wallet
      for (let i = 0; i < nextTokenId; i++) {
        try {
          // Access big_map using .get() method
          const owner = await storage.ledger.get(i);
          if (owner && owner === walletAddress) {
            tokenIds.push(i);
          }
        } catch (e) {
          // Token doesn't exist in ledger, skip
          continue;
        }
      }

      // Load passport data for each owned token
      for (const tokenId of tokenIds) {
        try {
          const passportData = await storage.passports.get(tokenId);
          
          if (passportData) {
            // Handle the passport data structure
            const spineColor = passportData.spine_color || "#000000";
            const stamps = passportData.stamps || [];
            
            // Map country strings from chain to emojis for display
            const stampsWithEmojis = Array.isArray(stamps) 
              ? stamps.map((s) => {
                  const countryString = String(s);
                  // Map country string to emoji if it exists in emojiMap
                  return emojiMap[countryString] || countryString;
                })
              : [];
            
            userPassports.push({
              tokenId: tokenId,
              spineColor: typeof spineColor === 'string' ? spineColor : "#000000",
              stamps: stampsWithEmojis,
            });
          }
        } catch (e) {
          console.error(`Error loading passport ${tokenId}:`, e);
        }
      }

      // Sort by token ID
      userPassports.sort((a, b) => a.tokenId - b.tokenId);
      
      setPassports(userPassports);
      if (userPassports.length > 0 && currentPassportIndex < 0) {
        setCurrentPassportIndex(0);
      } else if (userPassports.length === 0) {
        setCurrentPassportIndex(-1);
      }
    } catch (error) {
      console.error("Error loading passports:", error);
      setMessage(error.message || "Error loading passports");
    }
  };

  // Function 2: Mint Passport
  const mintPassport = async () => {
    try {
      await connectWallet();

      const contract = await Tezos.wallet.at(CONTRACT_ADDRESS);
      const op = await contract.methodsObject.mint_passport().send({
        amount: MINT_PRICE,
        mutez: true,
      });

      setMessage("Issuing your passport...");
      const hash  = await op.confirmation(2);
      console.log("hash: ", hash);

      if (hash) {
        setMessage("Passport issued successfully!");
        setReload(true);
      }
    } catch (error) {
      setMessage(error.message);
      console.log(error);
    }
  };

  // Function 3: Change Spine Color
  const changeSpineColor = async () => {
    if (currentPassportIndex < 0 || currentPassportIndex >= passports.length) {
      return;
    }

    try {
      await connectWallet();

      const currentPassport = passports[currentPassportIndex];
      const currentColor = currentPassport.spineColor;
      const currentIndex = spineColors.indexOf(currentColor);
      const nextIndex = (currentIndex + 1) % spineColors.length;
      const newColor = spineColors[nextIndex];

      const contract = await Tezos.wallet.at(CONTRACT_ADDRESS);
      const op = await contract.methodsObject
        .set_spine_color({
          token_id: currentPassport.tokenId,
          color: newColor,
        })
        .send();

      setMessage("Giving your passport spine a refreshed look");
      const hash  = await op.confirmation(2);
      console.log("hash: ", hash);

      if (hash) {
        setMessage("Spine color updated successfully");
        setReload(true);
      }
    } catch (error) {
      setMessage(error.message);
      console.log(error);
    }
  };

  // Function 4: Stamp (add flag emoji)
  const stamp = async () => {
    if (currentPassportIndex < 0 || currentPassportIndex >= passports.length) {
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

      const currentPassport = passports[currentPassportIndex];

      const contract = await Tezos.wallet.at(CONTRACT_ADDRESS);
      const op = await contract.methodsObject
        .stamp({
          token_id: currentPassport.tokenId,
          emoji: countryString,
        })
        .send();

      setMessage("One minute. Getting your passport stamped");
      const hash  = await op.confirmation(2);
      console.log("hash: ", hash);

      if (hash) {
        setMessage("Stamp added successfully!");
        setReload(true);
      }
    } catch (error) {
      setMessage(error.message);
      console.log(error);
    }
  };

  // Step 9 - Use a useEffect to call the loadPassports function when the page loads initially
  useEffect(() => {
    if (walletAddress) {
      loadPassports();
    }
    if (reload) {
      setReload(false);
    }
  }, [reload, walletAddress]);

  const currentPassport = currentPassportIndex >= 0 && currentPassportIndex < passports.length
    ? passports[currentPassportIndex]
    : null;

  return (
    <div className="app-container">
      <div className="header">
        {walletAddress ? (
          <div className="wallet-info">
            <button className="btn-wallet" onClick={disconnectWallet}>
              Disconnect
            </button>
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
        <h1>Passport {currentPassport ? `#${String(currentPassport.tokenId + 1).padStart(3, '0')}` : '#000'}</h1>
        <div 
          className="passport-page"
          style={{
            borderLeftColor: currentPassport?.spineColor || "#8b0000",
          }}
        >
          <div className="passport-header">
            <span>PASSPORT / PASSEPORT</span>
            <span>TOKEN ID: {currentPassport ? currentPassport.tokenId : 'N/A'}</span>
          </div>
          <div className="passport-body">
            <div className="passport-photo">👤</div>
            <div className="stamps-grid">
              {currentPassport && currentPassport.stamps && currentPassport.stamps.length > 0 ? (
                currentPassport.stamps.map((stamp, index) => (
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
            <div>OWNER: {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}</div>
            <div>STATUS: VALID / ACTIF</div>
            <div style={{ marginTop: '5px', color: '#8b0000', fontWeight: 'bold' }}>GHOSTNET PROTOTYPE</div>
          </div>
        </div>
        {passports.length > 0 && (
          <div className="passport-navigation">
            <button
              className="nav-btn"
              onClick={() => setCurrentPassportIndex(Math.max(0, currentPassportIndex - 1))}
              disabled={currentPassportIndex === 0}
            >
              ←
            </button>
            <div className="passport-counter">
              Passport {currentPassportIndex + 1} of {passports.length}
            </div>
            <button
              className="nav-btn"
              onClick={() => setCurrentPassportIndex(Math.min(passports.length - 1, currentPassportIndex + 1))}
              disabled={currentPassportIndex === passports.length - 1}
            >
              →
            </button>
          </div>
        )}
        <div className="message">
          {message || (walletAddress ? "" : "Connect wallet to begin")}
        </div>
        <div className="controls">
          <button className="btn-action" onClick={mintPassport}>
            Issue Passport (0.1 ꜩ)
          </button>
          <button 
            className="btn-action" 
            onClick={stamp} 
            disabled={!currentPassport}
          >
            Stamp Page 🕹️
          </button>
          <button 
            className="btn-action" 
            onClick={changeSpineColor} 
            disabled={!currentPassport}
          >
            Change Spine Color
          </button>
          <Link href="/browse" style={{ marginTop: '10px', color: '#aaa', textDecoration: 'none', fontSize: '14px' }}>
            Browse All Passports →
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { BeaconWallet } from "@taquito/beacon-wallet";
import { TezosToolkit } from "@taquito/taquito";
import { useState, useRef, useEffect } from "react";

const CONTRACT_ADDRESS = "KT1Ke54yJ6HaWoE99Zp7b3MB6QXDo9yEmn17";
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
  const [postcards, setPostcards] = useState([]);
  const [currentPostcardIndex, setCurrentPostcardIndex] = useState(-1);
  const [message, setMessage] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [reload, setReload] = useState(false);

  // Step 4 - Set a wallet ref to hold the wallet instance later
  const walletRef = useRef(null);

  // Background color options - brighter colors
  const backgroundColors = [
    "black",
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
        name: "Postcard NFT Prototype",
        network: { type: "ghostnet" },
      };
      const wallet = new BeaconWallet(options);
      walletRef.current = wallet;
      await wallet.requestPermissions();
      Tezos.setProvider({ wallet: walletRef.current });

      // Get the wallet address after connecting
      const address = await wallet.getPKH();
      setWalletAddress(address);
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
      setPostcards([]);
      setCurrentPostcardIndex(-1);
      console.log("Disconnected");
    } else {
      console.log("Already disconnected");
    }
  };

  // Load postcards from contract storage
  const loadPostcards = async () => {
    if (!walletAddress) return;

    try {
      const contract = await Tezos.contract.at(CONTRACT_ADDRESS);
      const storage = await contract.storage();
    console.log("storage: ", storage);
      // Get all postcards owned by the connected wallet
      const userPostcards = [];
      
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

      // Load postcard data for each owned token
      for (const tokenId of tokenIds) {
        try {
          const postcardData = await storage.postcards.get(tokenId);
          
          if (postcardData) {
            // Handle the postcard data structure
            const background = postcardData.background || "black";
            const greeting = postcardData.greeting || "";
            const stamps = postcardData.stamps || [];
            
            // Map country strings from chain to emojis for display
            const stampsWithEmojis = Array.isArray(stamps) 
              ? stamps.map((s) => {
                  const countryString = String(s);
                  // Map country string to emoji if it exists in emojiMap
                  return emojiMap[countryString] || countryString;
                })
              : [];
            
            userPostcards.push({
              tokenId: tokenId,
              backgroundColor: typeof background === 'string' ? background : "black",
              greeting: typeof greeting === 'string' ? greeting : "",
              stamps: stampsWithEmojis,
            });
          }
        } catch (e) {
          console.error(`Error loading postcard ${tokenId}:`, e);
        }
      }

      // Sort by token ID
      userPostcards.sort((a, b) => a.tokenId - b.tokenId);
      
      setPostcards(userPostcards);
      if (userPostcards.length > 0 && currentPostcardIndex < 0) {
        setCurrentPostcardIndex(0);
      } else if (userPostcards.length === 0) {
        setCurrentPostcardIndex(-1);
      }
    } catch (error) {
      console.error("Error loading postcards:", error);
      setMessage(error.message || "Error loading postcards");
    }
  };

  // Function 2: Mint Postcard
  const mintPostcard = async () => {
    try {
      await connectWallet();

      const contract = await Tezos.wallet.at(CONTRACT_ADDRESS);
      const op = await contract.methodsObject.mint_postcard().send({
        amount: MINT_PRICE,
        mutez: true,
      });

      setMessage("One minute. Getting your passport stamped");
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

  // Function 3: Change Background
  const changeBackground = async () => {
    if (currentPostcardIndex < 0 || currentPostcardIndex >= postcards.length) {
      return;
    }

    try {
      await connectWallet();

      const currentPostcard = postcards[currentPostcardIndex];
      const currentBg = currentPostcard.backgroundColor;
      const currentIndex = backgroundColors.indexOf(currentBg);
      const nextIndex = (currentIndex + 1) % backgroundColors.length;
      const newColor = backgroundColors[nextIndex];

      const contract = await Tezos.wallet.at(CONTRACT_ADDRESS);
      const op = await contract.methodsObject
        .set_background({
          token_id: currentPostcard.tokenId,
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
    if (currentPostcardIndex < 0 || currentPostcardIndex >= postcards.length) {
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

      const currentPostcard = postcards[currentPostcardIndex];

      const contract = await Tezos.wallet.at(CONTRACT_ADDRESS);
      const op = await contract.methodsObject
        .stamp({
          token_id: currentPostcard.tokenId,
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

  // Step 9 - Use a useEffect to call the loadPostcards function when the page loads initially
  useEffect(() => {
    if (walletAddress) {
      loadPostcards();
    }
    if (reload) {
      setReload(false);
    }
  }, [reload, walletAddress]);

  const currentPostcard = currentPostcardIndex >= 0 && currentPostcardIndex < postcards.length
    ? postcards[currentPostcardIndex]
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
          <button className="btn-wallet" onClick={connectWallet}>
            Connect Wallet
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <h1>Passport {currentPostcard ? `#${String(currentPostcard.tokenId + 1).padStart(3, '0')}` : '#000'}</h1>
        <div 
          className="passport-page"
          style={{
            borderLeftColor: currentPostcard?.backgroundColor || "#8b0000",
          }}
        >
          <div className="passport-header">
            <span>PASSPORT / PASSEPORT</span>
            <span>TOKEN ID: {currentPostcard ? currentPostcard.tokenId : 'N/A'}</span>
          </div>
          <div className="passport-body">
            <div className="passport-photo">👤</div>
            <div className="stamps-grid">
              {currentPostcard && currentPostcard.stamps && currentPostcard.stamps.length > 0 ? (
                currentPostcard.stamps.map((stamp, index) => (
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
        {postcards.length > 0 && (
          <div className="passport-navigation">
            <button
              className="nav-btn"
              onClick={() => setCurrentPostcardIndex(Math.max(0, currentPostcardIndex - 1))}
              disabled={currentPostcardIndex === 0}
            >
              ←
            </button>
            <div className="passport-counter">
              Passport {currentPostcardIndex + 1} of {postcards.length}
            </div>
            <button
              className="nav-btn"
              onClick={() => setCurrentPostcardIndex(Math.min(postcards.length - 1, currentPostcardIndex + 1))}
              disabled={currentPostcardIndex === postcards.length - 1}
            >
              →
            </button>
          </div>
        )}
        <div className="message">
          {message || (walletAddress ? "" : "Connect wallet to begin")}
        </div>
        <div className="controls">
          <button className="btn-action" onClick={mintPostcard}>
            Issue Passport (0.1 ꜩ)
          </button>
          <button 
            className="btn-action" 
            onClick={stamp} 
            disabled={!currentPostcard}
          >
            Stamp Page 🕹️
          </button>
          <button 
            className="btn-action" 
            onClick={changeBackground} 
            disabled={!currentPostcard}
          >
            Change Spine Color
          </button>
        </div>
      </div>
    </div>
  );
}

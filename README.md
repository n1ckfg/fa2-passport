# Passport NFT Demo

This demo is part of the **Tezos FA2 Fellowship | Session 3: Behavioral Logic in FA2** in collaboration with **MoMI - Museum of the Moving Image in New York**.

## Purpose

This project demonstrates how to use FA2 contracts for:
- **Interactivity** - Users can interact with their NFTs through on-chain operations
- **Generativity** - NFTs can be customized and modified after minting
- **Distribution** - Showcasing how FA2 enables dynamic, user-driven NFT experiences

## Overview

This is a Passport NFT application built on Tezos that allows users to:
- Mint passport NFTs (0.1 ꜩ)
- Add country flag stamps to their passports
- Change the spine color of their passports
- View and navigate between multiple passports

All interactions are stored on-chain using a SmartPy FA2 contract, demonstrating how behavioral logic can be implemented in FA2 NFTs.

## Technology Stack

- **Frontend**: Next.js 16, React
- **Blockchain**: Tezos (Ghostnet)
- **Wallet Integration**: Beacon Wallet (@taquito/beacon-wallet)
- **Smart Contract**: FA2 NFT contract written in SmartPy
- **Styling**: CSS with DotGothic16 font

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Building for Production

```bash
npm run build
npm start
```

## Features

- **Connect Wallet**: Connect your Tezos wallet using Beacon Wallet
- **Issue Passport**: Mint a new passport NFT for 0.1 ꜩ
- **Stamp Page**: Add country flag stamps (UK, US, France, Germany, Nigeria)
- **Change Spine Color**: Customize the passport spine color
- **View Multiple Passports**: Navigate between your owned passports

## Smart Contract

The smart contract is an FA2 NFT contract that implements:
- Standard FA2 NFT functionality
- Custom postcard/passport state storage
- Interactive entrypoints for stamping and changing background colors
- On-chain storage of all modifications

## Learn More

This demo is part of the Tezos FA2 Fellowship program, teaching developers how to build interactive and generative NFT experiences using FA2 contracts on Tezos.

For more information about:
- **FA2 Standard**: [TZIP-12](https://gitlab.com/tezos/tzip/-/blob/master/proposals/tzip-12/tzip-12.md)
- **Tezos**: [tezos.com](https://tezos.com)
- **Next.js**: [nextjs.org](https://nextjs.org)

# 💰 TigilGastos
TigilGastos is a web-based savings tracker designed to help students manage and protect their money across multiple financial goals — from tuition and enrollment fees to rent, gadgets, travel funds, and more. Through a smart locking mechanism powered by a Soroban smart contract, deposited funds cannot be withdrawn until the goal amount or target date is reached, encouraging consistent saving and preventing impulsive spending.

---
## 🔗 Live Demo
👉 [https://tigil-gastos.vercel.app](https://tigil-gastos.vercel.app)

## 📌 Problem
College students often struggle to save consistently. Daily expenses — food, transportation, load, and leisure — eat into their budget, leaving them short when it matters most: tuition deadlines, semester enrollment, or unexpected emergencies. Without a structured system, money set aside for a goal is easy to spend before it's needed.

---

## 💡 Solution
TigilGastos lets students create multiple savings jars, each tied to a specific goal and target date. Once a jar is locked, a Soroban smart contract enforces the saving conditions — deposits are recorded on-chain and funds cannot be withdrawn until the goal amount is reached or the target date arrives. Built on Stellar's fast and low-fee network, it makes disciplined saving simple, transparent, and tamper-proof.

---

## ⚙️ Core Features (MVP)
- Create multiple savings jars across different goal categories
- Supported categories include: Tuition Fee, Semester Enrollment, Books & Supplies, Laptop or Gadget, Boarding House Rent, Monthly Allowance, Grocery & Food, Transportation, Emergency Fund, Travel Fund, New Phone or Device, Side Business, and custom goals
- Set a target amount and target date per jar
- Automatically deploy a Soroban smart contract per goal to store and enforce lock conditions
- Deposit funds with all transactions recorded on-chain
- Prevent withdrawals while the jar is locked
- Trigger claim once the goal amount or target date is reached
- Smart contract verifies conditions before releasing funds

---

## 👥 Target Users
College students who have limited disposable income and struggle with consistent saving habits — whether saving for tuition, living expenses, or personal milestones. TigilGastos gives them a reliable, self-enforced system to keep their money safe from impulsive spending until it's truly needed.

---

## 🚀 How It Works
**User Action → On-chain Action → Result**

1. The user creates a savings jar, picks a goal category (or sets a custom one), and sets a target amount and date — this deploys a Soroban smart contract storing the lock conditions.
2. The user deposits money into the jar at any time — each deposit is recorded on-chain while funds remain locked.
3. Once the goal amount is reached or the target date arrives, the user triggers a claim — the smart contract verifies the conditions and releases the funds.

---

## 🌐 On-Chain Verification
All contract logic, user interactions, and transactions are publicly verifiable on the Stellar ledger.
https://stellar.expert/explorer/testnet/contract/CCWF5BAC64WL66V5UVSDUVB6LEQKYBBW35E7WF45Q5WTIXMSJXCSKL7E
![On-Chain Proof](https://github.com/user-attachments/assets/317e6ad7-81e4-4856-bdb0-8006b296b0f6)

---

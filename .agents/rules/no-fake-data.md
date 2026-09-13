# STRICT WORKSPACE RULES & CODING DIRECTIVES

## 1. Absolute Prohibition of Fake / Hardcoded Mock Values
- **NEVER HARDCODE FAKE VALUES**: You must **never** inject static, hardcoded placeholder metrics (e.g., hardcoded `"0.05 SOL"`, `"1.0B"`, `"Dex 1.25%"`, `"0.7%"`, `"1.35%"`, `"$548"`, `"100%"`).
- **NO SILENT MOCKING**: Never silently invent static mock data to make a UI or API endpoint "look filled" or "complete".
- **ZERO IDENTICAL METRICS ACROSS TOKENS**: Every token, wallet, or financial asset displayed must have authentic, unique values derived from genuine blockchain telemetry, market data, and verifiable signals.
- **NO FAKE OVERRIDES IN FRONTEND JSX**: Never use ternary fallbacks or defaults that override real or empty values with a fake constant (e.g., `coin.bundlerPercent !== '0%' ? coin.bundlerPercent : '0.7%'` is strictly banned).

---

## 2. Mandatory Escalation & User Review Protocol
- **RAISE ISSUES TO THE USER IMMEDIATELY**: If an upstream API is unavailable, rate-limited, deprecated, or returning incomplete data:
  1. **Do not hide the problem with fake numbers.**
  2. Clearly explain the issue to the user: what endpoint failed, what fields are missing, and why.
  3. Propose realistic technical options (e.g., alternative RPC endpoints, secondary APIs like DexScreener/RugCheck/Solana RPC, dynamic formulas based on volume/txs, or displaying an honest `--` / `N/A` / `Unpaid` state).
  4. Wait for user review and feedback to agree on the best architectural approach.
- **HONEST UNVERIFIED STATES**: When a metric has not been confirmed or purchased, display an honest label (e.g. `Unpaid`, `N/A`, `No Data`) rather than fabricating an affirmative number.

---

## 3. Data Derivation & Telemetry Guidelines
- **ON-CHAIN & DEX INTEGRITY**:
  - Financial, security, and trading metrics directly impact user funds. Misleading safety scores, false honeypot indicators, or fake holder metrics are unacceptable.
  - **Taxes**: Must reflect actual DEX AMM structure (e.g., Raydium `0% / 0% (0.25% LP)`, Pump.fun `0% / 0% (1.0% Curve)`). Never display arbitrary percentages.
  - **Total Supply**: Must be verified from mint decimals/supply or derived dynamically from `(marketCap / price)`.
  - **Fees**: Must be proportional to real volume, swap counts, and gas fees.
  - **Dex Paid**: Only show verified paid tiers if an order or boost actually exists; otherwise display `Unpaid`.
  - **Holder Distribution**: Top 10, Dev, Insiders, Bundlers, and Snipers must reflect real holder concentration or deterministic token entropy, never a static repeated number.

---

## 4. Multi-Token Verification Protocol
- **MANDATORY MULTI-ASSET TESTING**: Before submitting any feature or fix affecting data display:
  - Test with at least 4-5 different, distinct tokens (e.g., high-volume token, newly created pump coin, graduated token, CTO token).
  - Verify that no two tokens share identical values across all risk and financial columns.
  - Check all layers: Backend raw parsers -> Service enrichment -> API route merging -> Desktop card -> Mobile card -> Detail modal.
- **CODEBASE AUDITING**: Grep for any suspected hardcoded strings (e.g. static percentages or dollar amounts) before concluding a task.

---

## 5. Summary Checklist Before Any Commit
- [ ] Are there ANY hardcoded numbers or strings in JSX or backend parsers?
- [ ] Do different tokens display distinct, realistic metrics?
- [ ] If an API failed, was it properly handled or escalated to the user?
- [ ] Did you test both mobile and desktop views?
- [ ] Does `npm run build` pass with 0 errors?

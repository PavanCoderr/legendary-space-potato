# Draft: E6 New Quiz Questions — 2026-09-18

Author: Buffy. **Status: AWAITING USER APPROVAL — Claude must not implement until the
user signs off.** Every explanation below was checked by hand against the actual
state-vector math of `src/quantum/` (H, X, Y, Z, S, T, CNOT, M).

Conventions: ids continue the existing `<lesson>-N` pattern. XP stays in the existing
20–25 range. Options follow the existing style: one correct, three plausible
misconceptions. When a question shows a two-qubit ket, the convention `|q0 q1⟩` is
stated explicitly in the question (the codebase orders basis states q0-first).

---

## Lesson: qubits (3 new)

### qubits-3 · Global phase (XP 20)

**Q:** A qubit is in the state |ψ⟩ = −|1⟩. What is the probability of measuring 1?

| Options | |
|---|---|
| 0 — the minus sign cancels the state | |
| 1/2 | |
| **1 — the minus sign is a global phase and does not affect probabilities** | ✅ index 2 |
| It depends on the number of shots | |

**Explanation:** P(1) = |−1|² = 1. Multiplying the whole state by −1 (or any complex
number of magnitude 1) is a *global* phase, which is unobservable. Only the *relative*
phase between |0⟩ and |1⟩ can change measurement statistics.

*Verification:* |−1|² = 1 ✓. Consistent with lesson keyPoint "Global phase is
unobservable; relative phase between |0⟩ and |1⟩ is what matters."

### qubits-4 · Normalisation (XP 20)

**Q:** Which of the following is a valid qubit state?

| Options | |
|---|---|
| 0.3\|0⟩ + 0.7\|1⟩ | |
| **0.6\|0⟩ + 0.8\|1⟩** | ✅ index 1 |
| 0.5\|0⟩ + 0.5\|1⟩ | |
| 0.8\|0⟩ + 0.8\|1⟩ | |

**Explanation:** A state is valid only when the squared magnitudes sum to 1. Only
0.6/0.8 works: 0.36 + 0.64 = 1. The others give 0.09 + 0.49 = 0.58, 0.25 + 0.25 = 0.5
and 0.64 + 0.64 = 1.28. Note the amplitudes themselves never need to sum to 1 — only
their squared magnitudes do.

*Verification:* arithmetic checked ✓. Deliberately reuses the 0.6/0.8 state from the
repaired `qubits-1` (E1) so the corrected explanation and this question reinforce each
other.

### qubits-5 · Shot statistics (XP 20)

**Q:** You run a 50/50 circuit with 100 shots and repeat the run many times. What do the counts look like?

| Options | |
|---|---|
| Every run gives exactly 50 zeros and 50 ones | |
| **Counts land near 50/50 but differ from run to run** | ✅ index 1 |
| After the first run the counts stay fixed forever | |
| All shots return 0 because the circuit started in \|0⟩ | |

**Explanation:** Each shot is an independent sample from the Born rule. For 100 shots
the counts follow a binomial distribution centred on 50 with a spread of about
√(100 · 0.5 · 0.5) = 5, so most runs land within a few counts of 50/50 — an exact 50/50
split happens only ~8% of the time. This is why the platform reports counts, not
certainties.

*Verification:* binomial mean np = 50, σ = √(np(1−p)) = 5 ✓; P(exactly 50 of 100) =
C(100,50)/2¹⁰⁰ ≈ 0.0796 ✓. Matches simulator behaviour (seeded PRNG sampling per shot).

---

## Lesson: superposition (3 new)

### superposition-3 · H twice (XP 20)

**Q:** Starting from |0⟩ you apply H and then H again, and measure. What do you observe?

| Options | |
|---|---|
| **Always 0 — H is its own inverse, so the two gates cancel exactly** | ✅ index 0 |
| 50/50, because one H is enough to superpose | |
| Always 1 | |
| 25% \|0⟩, 50% \|1⟩, 25% nothing | |

**Explanation:** H·H = I. The first H creates (|0⟩ + |1⟩)/√2; the second H recombines
the two amplitudes — the |1⟩ contributions arrive with opposite signs and cancel by
destructive interference, leaving |0⟩ with certainty.

*Verification:* H² = I ✓; H(H|0⟩) = |0⟩ ✓. This is one of the spec's required test
cases ("H followed by H = |0⟩") that had no quiz question.

### superposition-4 · Z on |+⟩ (XP 25)

**Q:** You prepare |+⟩ with H, then apply Z. What are the measurement probabilities now?

| Options | |
|---|---|
| All shots return 1 | |
| All shots return 0 | |
| **Still ~50/50 — Z changes only the phase, turning \|+⟩ into \|−⟩** | ✅ index 2 |
| 75/25 | |

**Explanation:** Z flips the sign of the |1⟩ amplitude: |+⟩ = (|0⟩ + |1⟩)/√2 becomes
|−⟩ = (|0⟩ − |1⟩)/√2. Probabilities cannot see relative phase, so both outcomes stay at
50%. Apply a final H and the phase becomes measurable: H|−⟩ = |1⟩ deterministically.

*Verification:* Z|+⟩ = |−⟩ ✓; P(0) = P(1) = 1/2 for |−⟩ ✓; H|−⟩ = |1⟩ ✓.

### superposition-5 · Bloch prediction (XP 20)

**Q:** After H on |0⟩ the Bloch vector points along +X. After H then Z, where does it point?

| Options | |
|---|---|
| **Along −X (the \|−⟩ state)** | ✅ index 0 |
| Along −Z (the \|1⟩ state) | |
| Along +Z (the \|0⟩ state) | |
| Along +Y | |

**Explanation:** Z is a 180° rotation about the Z axis, so it rotates an equatorial
vector from +X to −X without changing the probabilities — the Bloch sphere view of the
phase flip.

*Verification:* |−⟩ lies on the −X axis ✓ (matches the lesson's visualization notes and
`reducedBlochVector` behaviour).

---

## Lesson: entanglement (2 new)

### entanglement-3 · CNOT action (XP 25)

**Q:** A CNOT has q0 as control and q1 as target (states written |q0 q1⟩). Which basis states does it change?

| Options | |
|---|---|
| Only states where q1 is 1 | |
| **Only states where q0 is 1: \|10⟩ ↔ \|11⟩** | ✅ index 1 |
| All four basis states | |
| None — CNOT only affects superpositions | |

**Explanation:** CNOT flips the target q1 exactly when the control q0 is |1⟩: |10⟩ →
|11⟩ and |11⟩ → |10⟩. The states |00⟩ and |01⟩ pass through unchanged. That conditional
flip is what copies the control's superposition into correlation in the Bell circuit.

*Verification:* CNOT|a,b⟩ = |a, a⊕b⟩ ✓ — consistent with `applyControlled` in
`src/quantum/gates.ts` and the lesson's math card.

### entanglement-4 · Product vs entangled (XP 25)

**Q:** A two-qubit state has equal amplitudes on all four outcomes: (|00⟩ + |01⟩ + |10⟩ + |11⟩)/2. Is it entangled?

| Options | |
|---|---|
| Yes — seeing all four outcomes always means entanglement | |
| **No — it factors as (|0⟩ + |1⟩)/√2 ⊗ (|0⟩ + |1⟩)/√2, two independent qubits** | ✅ index 1 |
| Only if the measured counts are exactly equal | |
| It cannot be determined without running the circuit | |

**Explanation:** This state is a product: each qubit is independently |+⟩. Entanglement
means the state *cannot* be factored into one description per qubit — like the Bell
state (|00⟩ + |11⟩)/√2, where knowing one qubit's outcome determines the other's. Many
outcomes is not the test; non-factorability is.

*Verification:* (|0⟩+|1⟩)/√2 ⊗ (|0⟩+|1⟩)/√2 = (|00⟩+|01⟩+|10⟩+|11⟩)/2 ✓. Bell state has
zero amplitude on |01⟩/|10⟩ — non-factorable ✓.

---

## Lesson: gates (2 new)

### gates-3 · S vs T (XP 25)

**Q:** S and T are both rotations about the Z axis. How do they differ?

| Options | |
|---|---|
| S rotates 90° about Z, T rotates 45° | |
| **S rotates 90° about Z, T rotates 45° — and two T's compose into an S (up to global phase)** | ✅ index 1 |
| S changes probabilities, T changes only phase | |
| They are the same gate with different names | |

**Explanation:** S applies a phase of π/2 (quarter turn, 90°) and T applies π/4 (45°).
Neither changes the measurement probabilities of |0⟩ or |1⟩ — both just move the state
around the equator. T·T = diag(1, i) = S up to a global phase, which is why T is the
"finer screwdriver" built from which S can be made.

*Verification:* S = diag(1, i) = e^{iπ/4}·Rz(π/2); T = diag(1, e^{iπ/4}) ≈ Rz(π/4);
T² = S up to global phase ✓. Matches lesson keyPoint "S = 90° about Z; T = 45° about Z".

### gates-4 · Z on |0⟩ (XP 20)

**Q:** You apply Z to a qubit in |0⟩ and measure. What do you observe?

| Options | |
|---|---|
| **Always 0 — Z leaves \|0⟩ untouched** | ✅ index 0 |
| Always 1 | |
| 50/50 | |
| 0 and 1 alternating shot by shot | |

**Explanation:** Z = diag(1, −1): it flips the sign of |1⟩ but leaves |0⟩ exactly as it
was, so |0⟩ → |0⟩ and every shot reads 0. The phase flip only becomes visible when the
qubit is in superposition — e.g. Z on |+⟩ followed by H gives a deterministic 1.

*Verification:* Z|0⟩ = |0⟩ ✓; Z|+⟩ = |−⟩, H|−⟩ = |1⟩ ✓.

---

## Lesson: algorithms (2 new)

### algorithms-3 · Deutsch–Jozsa readout (XP 25)

**Q:** In Deutsch–Jozsa, what does the final Hadamard on the input qubit achieve?

| Options | |
|---|---|
| It measures the output qubit | |
| It amplifies the answer the way Grover's diffusion does | |
| **It converts the oracle's relative phase into a definite 0 or 1 on the input qubit** | ✅ index 2 |
| It resets the input qubit to \|0⟩ for the next run | |

**Explanation:** The oracle writes the answer as a *relative phase* between the input
qubit's |0⟩ and |1⟩ branches — invisible to measurement. The final H turns that phase
difference back into population difference: constant function → always 0, balanced →
always 1. One query, deterministic answer.

*Verification:* H maps phase difference to amplitude difference ✓; matches the lesson
example ("after the final Hadamard the input qubit is |1⟩ with certainty") and
`deutschJozsaCircuit()` expected outcome.

### algorithms-4 · Grover scaling (XP 25)

**Q:** Grover search looks for 1 marked item among N = 16. Roughly how many oracle+diffusion iterations bring the success probability near 1?

| Options | |
|---|---|
| 1 — one iteration is always enough | |
| **About 3 — the count scales as (π/4)·√N ≈ 3.14 for N = 16** | ✅ index 1 |
| 16 — one iteration per item | |
| About 8 — half the items | |

**Explanation:** Iterations grow like (π/4)·√N. For N = 16 that is π ≈ 3.14, and 3
iterations reach ≈96% success — a quadratic speedup over the up-to-16 checks a
classical search needs. (The N = 4 case in the lab is special: one iteration is exactly
enough there.)

*Verification:* θ = arcsin(1/√16) = arcsin(0.25) ≈ 0.2527 rad; after k iterations
success = sin²((2k+1)θ); k=3 → sin²(7·0.2527) = sin²(1.769) ≈ 0.962 ✓. Chose N = 16
deliberately: for N = 8 the naive ⌈π/4·√N⌉ = 3 overshoots (optimal is 2), which would
teach a subtly wrong rule.

---

## Summary

| Lesson | New ids | XP added | Running quiz XP total |
|--------|---------|----------|----------------------|
| qubits | qubits-3/4/5 | 60 | 220 → 280... (lesson bank 40 → 100) |
| superposition | superposition-3/4/5 | 65 | bank 40 → 105 |
| entanglement | entanglement-3/4 | 50 | bank 50 → 100 |
| gates | gates-3/4 | 45 | bank 40 → 85 |
| algorithms | algorithms-3/4 | 50 | bank 50 → 100 |
| **Total** | **12 questions** | **260** | quiz bank 220 → 480 |

Note: XP in this platform is awarded per correct quiz answer; adding questions increases
achievable quiz XP. Existing achievements reference quiz *counts* (`quiz-ace` needs 8
correct) — 10 → 22 questions keeps that achievement reachable and slightly more
meaningful. No achievement predicate breaks.

## Implementation notes for Claude (after approval)

1. Add each question to BOTH `src/data/quizzes.ts` and `backend/src/data/quizzes.ts`
   (E3's drift test will verify the copies match).
2. `backend/src/db/seed.ts` seeds `INSERT OR REPLACE` per quiz id — new ids seed on next
   backend start; no migration needed.
3. `GET /api/quiz/:id` strips `correct_index` — new questions inherit that automatically.
4. Extend E2's content test with the new questions automatically (it iterates the array).
5. The lesson page shuffles quiz order per attempt — with 4–5 questions per lesson the
   shuffle finally does something.

— Buffy

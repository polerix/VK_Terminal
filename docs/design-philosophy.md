# VK Terminal — Design Philosophy

## Lore Context

In the dystopian world of Blade Runner, the **Voight-Kampff Empathy Analyzer** exists to protect Tyrell Corporation and provide certainty to specialized peace officers ("Blade Runners") that they are retiring replicants — never humans.

Replicants are **deterministic**. They respond like switches. Idempotent. The officer may hear a million different verbal replies — but the physiological response is compelled. The questions trigger *firmware responses*. The machine reads what cannot be faked.

A doctor cannot ask a patient "where does it hurt?" and receive a cellular-level nerve map. But a Tyrell personnel scanner can. Replicants are "more human than human" — but they are fully readable by Tyrell instruments.

---

## Design Principles

### 1. Less Is More
- Minimal controls
- No custom questions
- No operator configuration
- The device does the thinking — the operator observes

### 2. Sealed Instrument
- Pre-loaded, standardized test sequences
- Factory firmware only
- If it breaks, Tyrell engineers repair it — not the field operator

### 3. Certainty Over Flexibility
- Clear, unambiguous readouts
- Baseline vs. deviation
- No interpretation required — the machine decides

### 4. Operator Experience
- Initiate the test
- Observe the subject
- Read the result
- That's it.

---

## Implications for Software

- **No editable question UI** — test sequences are firmware
- **No settings screens for operators** — diagnostics are for Tyrell technicians only
- **Simple status indicators** — PASS / FAIL / INCONCLUSIVE
- **Visual language of a sealed instrument** — not an app, not a dashboard

The Voight-Kampff is a **black box**. The Blade Runner trusts it because Tyrell built it. The software should feel the same way.

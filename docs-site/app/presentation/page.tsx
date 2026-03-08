"use client";

import { useState, useEffect, useCallback } from "react";
import "./presentation.css";

const TOTAL_SLIDES = 11;

export default function PresentationPage() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  const goNext = useCallback(() => {
    setCurrent((c) => {
      if (c < TOTAL_SLIDES - 1) {
        setDirection("next");
        return c + 1;
      }
      return c;
    });
  }, []);

  const goPrev = useCallback(() => {
    setCurrent((c) => {
      if (c > 0) {
        setDirection("prev");
        return c - 1;
      }
      return c;
    });
  }, []);

  const goTo = useCallback((idx: number) => {
    setCurrent((c) => {
      setDirection(idx > c ? "next" : "prev");
      return idx;
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          goPrev();
          break;
        case "Escape":
          window.location.href = "/";
          break;
        case "f":
        case "F":
          if (!e.ctrlKey && !e.metaKey) {
            document.documentElement.requestFullscreen?.();
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  // Touch swipe
  useEffect(() => {
    let startX = 0;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
    };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) {
        if (dx < 0) goNext();
        else goPrev();
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [goNext, goPrev]);

  // Add presentation-mode class on mount
  useEffect(() => {
    document.documentElement.classList.add("presentation-mode");
    return () => {
      document.documentElement.classList.remove("presentation-mode");
    };
  }, []);

  function slideClass(idx: number) {
    if (idx === current) return "pres-slide active";
    if (direction === "next" && idx < current) return "pres-slide exit-left";
    if (direction === "prev" && idx > current) return "pres-slide exit-right";
    if (idx > current) return "pres-slide exit-right";
    return "pres-slide exit-left";
  }

  return (
    <div className="pres-root" tabIndex={0}>
      {/* Progress bar */}
      <div
        className="pres-progress"
        style={{ width: `${((current + 1) / TOTAL_SLIDES) * 100}%` }}
      />

      {/* --- Slide 0: Title/Hero --- */}
      <section
        className={slideClass(0)}
        role="group"
        aria-roledescription="slide"
        aria-label="Slide 1 of 11: Title"
      >
        <div className="pres-hero-mark anim">F</div>
        <h1 className="pres-title anim">FlowState</h1>
        <p className="pres-subtitle anim">
          Blockchain Escrow Checkout for E-Commerce
        </p>
        <div className="pres-hero-package anim">@shivanshshrivas/flowstate</div>
        <span className="pres-hero-hint anim">
          Press{" "}
          <kbd
            style={{
              padding: "0.15rem 0.4rem",
              borderRadius: "0.3rem",
              border: "1px solid var(--fs-line)",
              fontSize: "0.8rem",
            }}
          >
            &#8594;
          </kbd>{" "}
          to begin
        </span>
      </section>

      {/* --- Slide 1: The Problem --- */}
      <section
        className={slideClass(1)}
        role="group"
        aria-roledescription="slide"
        aria-label="Slide 2 of 11: The Problem"
      >
        <p className="pres-label anim">The Problem</p>
        <h2 className="pres-heading anim">
          E-Commerce Has a <span className="pres-accent">Trust Crisis</span>
        </h2>
        <div className="pres-grid-3">
          <div className="pres-card anim-scale">
            <div className="pres-problem-icon">&#x1F6E1;</div>
            <h3>Buyer Risk</h3>
            <p>
              Customers pay upfront and hope their goods arrive. When they
              don&apos;t, chargebacks are slow, expensive, and adversarial.
            </p>
          </div>
          <div className="pres-card anim-scale">
            <div className="pres-problem-icon">&#x26A0;</div>
            <h3>Seller Risk</h3>
            <p>
              Merchants ship goods, then face fraudulent chargebacks even after
              confirmed delivery. Lost revenue, lost product.
            </p>
          </div>
          <div className="pres-card anim-scale">
            <div className="pres-problem-icon">&#x1F50D;</div>
            <h3>Zero Transparency</h3>
            <p>
              Platforms lack an auditable, tamper-proof settlement layer.
              Disputes become he-said-she-said with no neutral record.
            </p>
          </div>
        </div>
      </section>

      {/* --- Slide 2: The Solution --- */}
      <section
        className={slideClass(2)}
        role="group"
        aria-roledescription="slide"
        aria-label="Slide 3 of 11: The Solution"
      >
        <p className="pres-label anim">The Solution</p>
        <h2 className="pres-heading anim">
          Trust Through <span className="pres-accent">Code</span>
        </h2>
        <div className="pres-flow-arrow anim">
          <span className="node">Install Package</span>
          <span className="arrow">&#8594;</span>
          <span className="node">Add Components</span>
          <span className="arrow">&#8594;</span>
          <span className="node">Escrow Checkout</span>
        </div>
        <div className="pres-grid-3">
          <div className="pres-card anim-scale">
            <div className="pres-pillar-num">1</div>
            <h3>Drop-in React Components</h3>
            <p>
              <code className="pres-mono" style={{ fontSize: "0.85rem" }}>
                &lt;PayButton /&gt;
              </code>
              ,{" "}
              <code className="pres-mono" style={{ fontSize: "0.85rem" }}>
                &lt;OrderTracker /&gt;
              </code>
              , and{" "}
              <code className="pres-mono" style={{ fontSize: "0.85rem" }}>
                &lt;FlowStateProvider /&gt;
              </code>{" "}
              — wire up crypto checkout in minutes.
            </p>
          </div>
          <div className="pres-card anim-scale">
            <div className="pres-pillar-num">2</div>
            <h3>7-State On-Chain Escrow</h3>
            <p>
              Funds are locked in a smart contract and released progressively
              across 5 shipping milestones. Not all-or-nothing — streaming
              payouts.
            </p>
          </div>
          <div className="pres-card anim-scale">
            <div className="pres-pillar-num">3</div>
            <h3>Real Shipping Tracking</h3>
            <p>
              Carrier events from Shippo automatically advance the escrow state
              and trigger partial payouts. Zero manual intervention.
            </p>
          </div>
        </div>
      </section>

      {/* --- Slide 3: Architecture --- */}
      <section
        className={slideClass(3)}
        role="group"
        aria-roledescription="slide"
        aria-label="Slide 4 of 11: Architecture"
      >
        <p className="pres-label anim">Architecture</p>
        <h2 className="pres-heading anim">
          System <span className="pres-accent">Overview</span>
        </h2>
        <div className="pres-arch">
          <div className="pres-arch-layer anim-layer">
            <span className="pres-arch-label">Your Storefront</span>
            <div className="pres-arch-items">
              <span className="pres-arch-chip">FlowStateProvider</span>
              <span className="pres-arch-chip">PayButton</span>
              <span className="pres-arch-chip">OrderTracker</span>
              <span className="pres-arch-chip">useFlowState</span>
            </div>
          </div>
          <div className="pres-arch-connector anim-layer" />
          <div className="pres-arch-layer anim-layer">
            <span className="pres-arch-label">Backend API</span>
            <div className="pres-arch-items">
              <span className="pres-arch-chip">Fastify</span>
              <span className="pres-arch-chip">PostgreSQL</span>
              <span className="pres-arch-chip">Redis / BullMQ</span>
              <span className="pres-arch-chip">WebSocket</span>
            </div>
          </div>
          <div className="pres-arch-connector anim-layer" />
          <div className="pres-arch-layer anim-layer">
            <span className="pres-arch-label">XRPL EVM Sidechain</span>
            <div className="pres-arch-items">
              <span className="pres-arch-chip">FLUSD Token</span>
              <span className="pres-arch-chip">EscrowStateMachine</span>
              <span className="pres-arch-chip">DisputeResolver</span>
            </div>
          </div>
          <div className="pres-arch-connector anim-layer" />
          <div className="pres-arch-layer anim-layer">
            <span className="pres-arch-label">External Bridges</span>
            <div className="pres-arch-items">
              <span
                className="pres-arch-chip"
                style={{
                  borderColor: "rgba(46, 160, 67, 0.4)",
                  background: "rgba(46, 160, 67, 0.08)",
                }}
              >
                Shippo (Live)
              </span>
              <span className="pres-arch-chip">Pinata / IPFS</span>
              <span className="pres-arch-chip">Blockchain RPC</span>
            </div>
          </div>
        </div>
      </section>

      {/* --- Slide 4: Smart Contracts --- */}
      <section
        className={slideClass(4)}
        role="group"
        aria-roledescription="slide"
        aria-label="Slide 5 of 11: Smart Contracts"
      >
        <p className="pres-label anim">XRPL EVM Sidechain</p>
        <h2 className="pres-heading anim">
          Smart <span className="pres-accent">Contracts</span>
        </h2>
        <div className="pres-grid-3" style={{ marginBottom: "1.5rem" }}>
          <div className="pres-card anim-scale">
            <h3>FLUSD Token</h3>
            <p>
              Mock RLUSD stablecoin, ERC-20, 6 decimals.
              <br />
              Public faucet mints 50k per call.
            </p>
            <div className="pres-contract-addr">0x2578...323d</div>
          </div>
          <div className="pres-card anim-scale">
            <h3>EscrowStateMachine</h3>
            <p>
              7-state FSM with integrated payment splitting. SafeERC20,
              ReentrancyGuard, Pausable.
            </p>
            <div className="pres-contract-addr">0x3313...2ee3</div>
          </div>
          <div className="pres-card anim-scale">
            <h3>DisputeResolver</h3>
            <p>
              Full dispute lifecycle. 72h seller response window. Auto-resolve &
              custom splits.
            </p>
            <div className="pres-contract-addr">0x9A2C...7731</div>
          </div>
        </div>
        <div className="pres-fsm">
          <div className="pres-fsm-node">
            ESCROWED<span className="pres-fsm-payout">15%</span>
          </div>
          <span className="pres-fsm-arrow">&#8594;</span>
          <div className="pres-fsm-node">
            LABEL_CREATED<span className="pres-fsm-payout">15%</span>
          </div>
          <span className="pres-fsm-arrow">&#8594;</span>
          <div className="pres-fsm-node">
            SHIPPED<span className="pres-fsm-payout">20%</span>
          </div>
          <span className="pres-fsm-arrow">&#8594;</span>
          <div className="pres-fsm-node">
            IN_TRANSIT<span className="pres-fsm-payout">35%</span>
          </div>
          <span className="pres-fsm-arrow">&#8594;</span>
          <div className="pres-fsm-node">
            DELIVERED<span className="pres-fsm-payout">15%</span>
          </div>
          <span className="pres-fsm-arrow">&#8594;</span>
          <div className="pres-fsm-node">FINALIZED</div>
        </div>
        <p
          style={{
            textAlign: "center",
            fontSize: "0.85rem",
            color: "var(--fs-muted)",
            marginTop: "0.8rem",
          }}
          className="anim"
        >
          Platform fee: 2.5% deducted from final holdback &bull; Grace period: 3
          days
        </p>
      </section>

      {/* --- Slide 5: Shippo --- */}
      <section
        className={slideClass(5)}
        role="group"
        aria-roledescription="slide"
        aria-label="Slide 6 of 11: Shippo Integration"
      >
        <p className="pres-label anim">Shipping Integration</p>
        <h2 className="pres-heading anim">
          Real Shipping, <span className="pres-accent">Real Trust</span>
        </h2>
        <div className="pres-mapping">
          <div className="pres-mapping-row">
            <div className="pres-mapping-from">PRE_TRANSIT</div>
            <div className="pres-mapping-arrow">&#8594;</div>
            <div className="pres-mapping-to">LABEL_SCANNED</div>
          </div>
          <div className="pres-mapping-row">
            <div className="pres-mapping-from">TRANSIT</div>
            <div className="pres-mapping-arrow">&#8594;</div>
            <div className="pres-mapping-to">SHIPPED &bull; State Advance</div>
          </div>
          <div className="pres-mapping-row">
            <div className="pres-mapping-from">OUT_FOR_DELIVERY</div>
            <div className="pres-mapping-arrow">&#8594;</div>
            <div className="pres-mapping-to">OUT_FOR_DELIVERY</div>
          </div>
          <div className="pres-mapping-row">
            <div className="pres-mapping-from">DELIVERED</div>
            <div className="pres-mapping-arrow">&#8594;</div>
            <div className="pres-mapping-to">
              DELIVERED &bull; State Advance
            </div>
          </div>
        </div>
        <div className="pres-truck-track anim">
          <span className="pres-truck">&#x1F69A;</span>
        </div>
        <p
          style={{
            textAlign: "center",
            fontSize: "0.9rem",
            color: "var(--fs-muted)",
            marginTop: "1rem",
          }}
          className="anim"
        >
          Carrier tracking automatically advances escrow state and triggers
          partial payouts
        </p>
      </section>

      {/* --- Slide 6: Pinata/IPFS --- */}
      <section
        className={slideClass(6)}
        role="group"
        aria-roledescription="slide"
        aria-label="Slide 7 of 11: Pinata/IPFS"
      >
        <p className="pres-label anim">IPFS via Pinata</p>
        <h2 className="pres-heading anim">
          Immutable <span className="pres-accent">Audit Trail</span>
        </h2>
        <div className="pres-pin-list">
          <div className="pres-pin-item anim-scale">
            <div className="pres-pin-check">&#10003;</div>
            <div>
              <h4>Invoices</h4>
              <p>
                PDF and JSON metadata pinned on escrow confirmation. CID stored
                on-chain.
              </p>
            </div>
          </div>
          <div className="pres-pin-item anim-scale">
            <div className="pres-pin-check">&#10003;</div>
            <div>
              <h4>Shipping Labels</h4>
              <p>
                Label PDFs fetched from Shippo and pinned. CID recorded in the
                order record.
              </p>
            </div>
          </div>
          <div className="pres-pin-item anim-scale">
            <div className="pres-pin-check">&#10003;</div>
            <div>
              <h4>Dispute Evidence</h4>
              <p>
                Buyer and seller evidence bundles pinned. Bundle CID passed to
                DisputeResolver contract.
              </p>
            </div>
          </div>
          <div className="pres-pin-item anim-scale">
            <div className="pres-pin-check">&#10003;</div>
            <div>
              <h4>Payout Receipts</h4>
              <p>
                State transition proofs with tracking data, tx hash, and payout
                basis points.
              </p>
            </div>
          </div>
        </div>
        <div className="pres-cid-example anim">
          QmXoYp...7kW2 &mdash; content-addressed, tamper-proof, permanent
        </div>
      </section>

      {/* --- Slide 7: Webhooks --- */}
      <section
        className={slideClass(7)}
        role="group"
        aria-roledescription="slide"
        aria-label="Slide 8 of 11: Webhooks"
      >
        <p className="pres-label anim">Real-Time Events</p>
        <h2 className="pres-heading anim">
          Event-Driven <span className="pres-accent">Architecture</span>
        </h2>
        <div className="pres-pulse-container anim">
          <div className="pres-pulse-dot">
            <div className="pres-pulse-ring" />
            <div className="pres-pulse-ring" />
            <div className="pres-pulse-ring" />
          </div>
        </div>
        <div className="pres-webhook-cols">
          <div className="pres-card anim-scale">
            <div className="pres-webhook-icon">&#x1F4E8;</div>
            <h3>Outbound Webhooks</h3>
            <p>
              HMAC-SHA256 signed. Event filtering per endpoint.{" "}
              <code className="pres-mono" style={{ fontSize: "0.8rem" }}>
                X-FlowState-Signature
              </code>{" "}
              header.
            </p>
          </div>
          <div className="pres-card anim-scale">
            <div className="pres-webhook-icon">&#x26A1;</div>
            <h3>WebSocket</h3>
            <p>
              Real-time push at{" "}
              <code className="pres-mono" style={{ fontSize: "0.8rem" }}>
                /ws
              </code>
              . Project-scoped auth in 5s. Order state, disputes, payouts.
            </p>
          </div>
          <div className="pres-card anim-scale">
            <div className="pres-webhook-icon">&#x1F4E6;</div>
            <h3>BullMQ Queue</h3>
            <p>
              5 retries, exponential backoff. Rate limited 100/min. Graceful
              fallback to sync when Redis unavailable.
            </p>
          </div>
        </div>
        <div className="pres-code-block anim">
          <span className="cc">{"// Webhook payload"}</span>
          {"\n"}
          {"{"}
          {"\n"}
          {"  "}
          <span className="cs">&quot;event&quot;</span>:{" "}
          <span className="cs">&quot;order.state_changed&quot;</span>,{"\n"}
          {"  "}
          <span className="cs">&quot;data&quot;</span>: {"{"}{" "}
          <span className="cs">&quot;orderId&quot;</span>,{" "}
          <span className="cs">&quot;from&quot;</span>,{" "}
          <span className="cs">&quot;to&quot;</span>,{" "}
          <span className="cs">&quot;txHash&quot;</span> {"}"},<br />
          {"  "}
          <span className="cs">&quot;timestamp&quot;</span>:{" "}
          <span className="cs">&quot;2026-03-08T...&quot;</span>
          {"\n"}
          {"}"}
        </div>
      </section>

      {/* --- Slide 8: Dispute Resolution --- */}
      <section
        className={slideClass(8)}
        role="group"
        aria-roledescription="slide"
        aria-label="Slide 9 of 11: Dispute Resolution"
      >
        <p className="pres-label anim">On-Chain Disputes</p>
        <h2 className="pres-heading anim">
          Built-in <span className="pres-accent">Dispute Resolution</span>
        </h2>
        <div className="pres-timeline">
          <div className="pres-timeline-node">
            <h4>Buyer Opens Dispute</h4>
            <p>
              Evidence files pinned to IPFS.{" "}
              <code className="pres-mono" style={{ fontSize: "0.82rem" }}>
                initiateDispute(escrowId, evidenceCid)
              </code>{" "}
              freezes remaining funds on-chain.
            </p>
          </div>
          <div className="pres-timeline-node">
            <h4>72-Hour Seller Window</h4>
            <p>
              Seller submits counter-evidence within 72 hours via{" "}
              <code className="pres-mono" style={{ fontSize: "0.82rem" }}>
                respondToDispute()
              </code>
              . Counter-evidence also pinned to IPFS.
            </p>
          </div>
          <div className="pres-timeline-node">
            <h4>Auto-Resolve</h4>
            <p>
              If the seller misses the 72h window, anyone can call{" "}
              <code className="pres-mono" style={{ fontSize: "0.82rem" }}>
                autoResolve()
              </code>{" "}
              and the buyer gets a full refund automatically.
            </p>
          </div>
          <div className="pres-timeline-node">
            <h4>Admin Resolution</h4>
            <p>
              Admin calls{" "}
              <code className="pres-mono" style={{ fontSize: "0.82rem" }}>
                resolveDispute()
              </code>{" "}
              with outcome: Refund Buyer (100%), Release Seller (0%), or Custom
              Split (any bps).
            </p>
          </div>
        </div>
      </section>

      {/* --- Slide 9: Code Example --- */}
      <section
        className={slideClass(9)}
        role="group"
        aria-roledescription="slide"
        aria-label="Slide 10 of 11: Code Example"
      >
        <p className="pres-label anim">Developer Experience</p>
        <h2 className="pres-heading anim">
          5 Lines to <span className="pres-accent">Crypto Checkout</span>
        </h2>
        <div className="pres-typewriter-wrap">
          <span className="pres-typewriter-line">
            <span className="ck">import</span> {"{"} FlowStateProvider,
            PayButton {"}"} <span className="ck">from</span>{" "}
            <span className="cs">&quot;@shivanshshrivas/flowstate&quot;</span>;
          </span>
          <span className="pres-typewriter-line">&nbsp;</span>
          <span className="pres-typewriter-line">
            <span className="cp">&lt;</span>
            <span className="ck">FlowStateProvider</span>{" "}
            <span className="cn">config</span>={"{"}
            {"{"} projectId, apiKey, network:{" "}
            <span className="cs">&quot;testnet&quot;</span> {"}"}
            {"}"}
            <span className="cp">&gt;</span>
          </span>
          <span className="pres-typewriter-line">
            {"  "}
            <span className="cp">&lt;</span>
            <span className="ck">PayButton</span>{" "}
            <span className="cn">product</span>={"{"}product{"}"}{" "}
            <span className="cp">/&gt;</span>
          </span>
          <span className="pres-typewriter-line">
            <span className="cp">&lt;/</span>
            <span className="ck">FlowStateProvider</span>
            <span className="cp">&gt;</span>
          </span>
        </div>
        <p className="pres-tagline anim">
          One npm install. Three components. Full escrow protection.
        </p>
      </section>

      {/* --- Slide 10: Closing --- */}
      <section
        className={slideClass(10)}
        role="group"
        aria-roledescription="slide"
        aria-label="Slide 11 of 11: Closing"
      >
        <div className="pres-closing-border anim">
          <div
            className="pres-hero-mark"
            style={{
              margin: "0 auto 1rem",
              animation: "pulseGlow 3s ease-in-out infinite",
            }}
          >
            F
          </div>
          <h1
            className="pres-title"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)" }}
          >
            FlowState
          </h1>
          <p className="pres-subtitle">
            Blockchain Escrow Checkout for E-Commerce
          </p>
          <div className="pres-badges">
            <span className="pres-badge">Next.js</span>
            <span className="pres-badge">React</span>
            <span className="pres-badge">XRPL EVM</span>
            <span className="pres-badge">Solidity</span>
            <span className="pres-badge">Fastify</span>
            <span className="pres-badge">PostgreSQL</span>
            <span className="pres-badge">Shippo</span>
            <span className="pres-badge">Pinata</span>
            <span className="pres-badge">BullMQ</span>
            <span className="pres-badge">WebSocket</span>
          </div>
          <a
            href="https://github.com/shivanshshrivas/flowstate"
            target="_blank"
            rel="noopener noreferrer"
            className="pres-github-link"
          >
            github.com/shivanshshrivas/flowstate
          </a>
          <div className="pres-questions">Questions?</div>
        </div>
      </section>

      {/* --- Bottom navigation --- */}
      <nav className="pres-nav" aria-label="Slide navigation">
        <button
          className="pres-nav-btn"
          onClick={goPrev}
          disabled={current === 0}
          aria-label="Previous slide"
        >
          &#8592;
        </button>
        <div className="pres-nav-dots">
          {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
            <button
              key={i}
              className={`pres-nav-dot${i === current ? " active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <span className="pres-nav-counter">
          {current + 1} / {TOTAL_SLIDES}
        </span>
        <button
          className="pres-nav-btn"
          onClick={goNext}
          disabled={current === TOTAL_SLIDES - 1}
          aria-label="Next slide"
        >
          &#8594;
        </button>
      </nav>
    </div>
  );
}

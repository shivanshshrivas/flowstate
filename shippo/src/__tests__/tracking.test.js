import { describe, it, expect } from "vitest";
import { mapToEscrowEvent } from "../tracking";

describe("mapToEscrowEvent", () => {
  it("PRE_TRANSIT → LABEL_SCANNED, no advance", () => {
    expect(mapToEscrowEvent("PRE_TRANSIT", null)).toEqual({
      escrowEvent: "LABEL_SCANNED",
      shouldAdvance: false,
    });
  });

  it("TRANSIT (no substatus) → SHIPPED, advance", () => {
    expect(mapToEscrowEvent("TRANSIT", null)).toEqual({
      escrowEvent: "SHIPPED",
      shouldAdvance: true,
    });
  });

  it("TRANSIT + out_for_delivery → OUT_FOR_DELIVERY, no advance", () => {
    expect(mapToEscrowEvent("TRANSIT", "out_for_delivery")).toEqual({
      escrowEvent: "OUT_FOR_DELIVERY",
      shouldAdvance: false,
    });
  });

  it("DELIVERED → DELIVERED, advance", () => {
    expect(mapToEscrowEvent("DELIVERED", null)).toEqual({
      escrowEvent: "DELIVERED",
      shouldAdvance: true,
    });
  });

  it("RETURNED → RETURN_INITIATED, no advance", () => {
    expect(mapToEscrowEvent("RETURNED", null)).toEqual({
      escrowEvent: "RETURN_INITIATED",
      shouldAdvance: false,
    });
  });

  it("FAILURE → DELIVERY_FAILED, no advance", () => {
    expect(mapToEscrowEvent("FAILURE", null)).toEqual({
      escrowEvent: "DELIVERY_FAILED",
      shouldAdvance: false,
    });
  });

  it("UNKNOWN → null escrowEvent, no advance", () => {
    expect(mapToEscrowEvent("UNKNOWN", null)).toEqual({
      escrowEvent: null,
      shouldAdvance: false,
    });
  });

  it("unrecognized status → null escrowEvent, no advance", () => {
    expect(mapToEscrowEvent("SOMETHING_ELSE", null)).toEqual({
      escrowEvent: null,
      shouldAdvance: false,
    });
  });
});

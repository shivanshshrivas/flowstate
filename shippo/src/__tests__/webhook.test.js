import { describe, it, expect } from "vitest";
import { handleShippoWebhook } from "../webhook";

describe("handleShippoWebhook", () => {
  it("ignores non-track_updated events", async () => {
    const result = await handleShippoWebhook({ event: "shipment_created" });
    expect(result.handled).toBe(false);
    expect(result.reason).toContain("shipment_created");
  });

  it("returns unhandled when tracking_number is missing", async () => {
    const result = await handleShippoWebhook({
      event: "track_updated",
      data: {
        carrier: "usps",
        tracking_status: { status: "TRANSIT" },
      },
    });
    expect(result.handled).toBe(false);
    expect(result.reason).toContain("Missing");
  });

  it("returns unhandled when carrier is missing", async () => {
    const result = await handleShippoWebhook({
      event: "track_updated",
      data: {
        tracking_number: "TRACK123",
        tracking_status: { status: "TRANSIT" },
      },
    });
    expect(result.handled).toBe(false);
  });

  it("handles TRANSIT event with correct substatus extraction", async () => {
    const result = await handleShippoWebhook({
      event: "track_updated",
      data: {
        tracking_number: "TRACK123",
        carrier: "usps",
        tracking_status: {
          status: "TRANSIT",
          substatus: { code: "out_for_delivery", text: "Out for delivery" },
          status_details: "Package is out for delivery",
        },
      },
    });

    expect(result.handled).toBe(true);
    expect(result.trackingNumber).toBe("TRACK123");
    expect(result.carrier).toBe("usps");
    expect(result.status).toBe("TRANSIT");
    // substatus must be the .code string, not the raw object
    expect(result.substatus).toBe("out_for_delivery");
    expect(result.escrowEvent).toBe("OUT_FOR_DELIVERY");
    expect(result.shouldAdvance).toBe(false);
  });

  it("handles TRANSIT event without substatus", async () => {
    const result = await handleShippoWebhook({
      event: "track_updated",
      data: {
        tracking_number: "TRACK456",
        carrier: "fedex",
        tracking_status: {
          status: "TRANSIT",
          status_details: "In transit",
        },
      },
    });

    expect(result.handled).toBe(true);
    expect(result.substatus).toBeNull();
    expect(result.escrowEvent).toBe("SHIPPED");
    expect(result.shouldAdvance).toBe(true);
  });

  it("handles DELIVERED event", async () => {
    const result = await handleShippoWebhook({
      event: "track_updated",
      data: {
        tracking_number: "TRACK789",
        carrier: "ups",
        tracking_status: {
          status: "DELIVERED",
          status_details: "Delivered to front door",
        },
      },
    });

    expect(result.handled).toBe(true);
    expect(result.escrowEvent).toBe("DELIVERED");
    expect(result.shouldAdvance).toBe(true);
  });

  it("handles UNKNOWN status with null escrowEvent", async () => {
    const result = await handleShippoWebhook({
      event: "track_updated",
      data: {
        tracking_number: "TRACK000",
        carrier: "dhl",
        tracking_status: { status: "UNKNOWN" },
      },
    });

    expect(result.handled).toBe(true);
    expect(result.escrowEvent).toBeNull();
    expect(result.shouldAdvance).toBe(false);
  });
});

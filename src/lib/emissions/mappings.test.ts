import { afterEach, describe, expect, it } from "vitest";
import {
  getClimatiqClassificationForIndustry,
  getElectricityMapsZoneForState,
} from "./mappings";

describe("emissions mappings", () => {
  afterEach(() => {
    delete process.env.CLIMATIQ_CLASSIFICATION_IT_SERVICES;
  });

  it("maps Karnataka to IN zone", () => {
    expect(getElectricityMapsZoneForState("Karnataka")).toBe("IN");
  });

  it("normalizes state text before zone lookup", () => {
    expect(getElectricityMapsZoneForState("Andaman & Nicobar Islands")).toBe("IN");
  });

  it("returns null for unmapped state key", () => {
    expect(getElectricityMapsZoneForState("Unknown State")).toBeNull();
  });

  it("returns default climatiq classification for industry", () => {
    expect(getClimatiqClassificationForIndustry("manufacturing")).toBe(
      "exiobase-i-27",
    );
  });

  it("uses env override for industry classification when provided", () => {
    process.env.CLIMATIQ_CLASSIFICATION_IT_SERVICES = "exiobase-i-62";
    expect(getClimatiqClassificationForIndustry("it_services")).toBe(
      "exiobase-i-62",
    );
  });
});

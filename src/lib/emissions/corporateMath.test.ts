import { describe, expect, it } from "vitest";
import {
  computeNetGridKwh,
  convertGridGramsToTonnes,
  estimateDieselLitersFromRuntime,
  resolveTotalGridKwh,
  roundToTwo,
} from "./corporateMath";

describe("corporateMath", () => {
  it("estimates diesel liters from runtime and capacity", () => {
    expect(estimateDieselLitersFromRuntime(10, 500)).toBe(1000);
  });

  it("resolves total grid kwh from exact annual kwh first", () => {
    expect(
      resolveTotalGridKwh({
        annualGridKwh: 12500,
        annualElectricityBillInr: 999999,
      }),
    ).toBe(12500);
  });

  it("reverse engineers kwh from bill when annual kwh is missing", () => {
    expect(
      roundToTwo(
        resolveTotalGridKwh({
          annualGridKwh: null,
          annualElectricityBillInr: 8500,
        }),
      ),
    ).toBe(1000);
  });

  it("returns zero kwh when both exact kwh and bill are absent", () => {
    expect(
      resolveTotalGridKwh({
        annualGridKwh: null,
        annualElectricityBillInr: null,
      }),
    ).toBe(0);
  });

  it("computes net grid kwh with floor at zero", () => {
    expect(
      computeNetGridKwh({
        totalKwh: 1000,
        onSiteSolarGeneratedKwh: 1200,
      }),
    ).toBe(0);
  });

  it("converts grams intensity result to metric tonnes", () => {
    expect(
      convertGridGramsToTonnes({
        netGridKwh: 1000,
        gridIntensityGramsPerKwh: 500,
      }),
    ).toBe(0.5);
  });
});


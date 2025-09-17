import { describe, it, expect, beforeEach } from "vitest";

interface Ride {
  user: string;
  distance: number;
  vehicleType: string;
  gpsStart: string;
  gpsEnd: string;
  startTime: number;
  endTime: number;
  timestamp: number;
}

interface Flag {
  rideId: number;
  reason: string;
  flaggedAt: number;
  status: boolean;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class FraudDetectorMock {
  state: {
    maxDistance: number;
    maxSpeed: number;
    duplicateTolerance: number;
    flagLimit: number;
    oraclePrincipal: string;
    adminPrincipal: string;
    analysisFee: number;
    nextFlagId: number;
    rides: Map<number, Ride>;
    flags: Map<number, Flag>;
    flagsByRide: Map<number, number[]>;
    analysisHistory: Map<number, { rideId: number; analysisType: string; result: boolean; timestamp: number }>;
  } = {
    maxDistance: 1000000,
    maxSpeed: 200,
    duplicateTolerance: 5,
    flagLimit: 10,
    oraclePrincipal: "ST1TEST",
    adminPrincipal: "ST1TEST",
    analysisFee: 10,
    nextFlagId: 0,
    rides: new Map(),
    flags: new Map(),
    flagsByRide: new Map(),
    analysisHistory: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      maxDistance: 1000000,
      maxSpeed: 200,
      duplicateTolerance: 5,
      flagLimit: 10,
      oraclePrincipal: "ST1TEST",
      adminPrincipal: "ST1TEST",
      analysisFee: 10,
      nextFlagId: 0,
      rides: new Map(),
      flags: new Map(),
      flagsByRide: new Map(),
      analysisHistory: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  getRide(id: number): Ride | undefined {
    return this.state.rides.get(id);
  }

  getFlag(id: number): Flag | undefined {
    return this.state.flags.get(id);
  }

  getFlagsByRide(rideId: number): number[] | undefined {
    return this.state.flagsByRide.get(rideId);
  }

  getMaxDistance(): number {
    return this.state.maxDistance;
  }

  getMaxSpeed(): number {
    return this.state.maxSpeed;
  }

  getDuplicateTolerance(): number {
    return this.state.duplicateTolerance;
  }

  getOraclePrincipal(): string {
    return this.state.oraclePrincipal;
  }

  setMaxDistance(newDist: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    if (newDist <= 0) return { ok: false, value: false };
    this.state.maxDistance = newDist;
    return { ok: true, value: true };
  }

  setMaxSpeed(newSpeed: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    if (newSpeed <= 0) return { ok: false, value: false };
    this.state.maxSpeed = newSpeed;
    return { ok: true, value: true };
  }

  setDuplicateTolerance(newTol: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    if (newTol <= 0) return { ok: false, value: false };
    this.state.duplicateTolerance = newTol;
    return { ok: true, value: true };
  }

  setOraclePrincipal(newOracle: string): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    if (newOracle === this.caller) return { ok: false, value: false };
    this.state.oraclePrincipal = newOracle;
    return { ok: true, value: true };
  }

  setAnalysisFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    this.state.analysisFee = newFee;
    return { ok: true, value: true };
  }

  submitRide(
    distance: number,
    vehicleType: string,
    gpsStart: string,
    gpsEnd: string,
    startTime: number,
    endTime: number
  ): Result<number> {
    if (distance <= 0) return { ok: false, value: 0 };
    if (!["EV", "bike", "transit"].includes(vehicleType)) return { ok: false, value: 0 };
    if (!gpsStart || gpsStart.length === 0) return { ok: false, value: 0 };
    if (!gpsEnd || gpsEnd.length === 0) return { ok: false, value: 0 };
    if (startTime < this.blockHeight) return { ok: false, value: 0 };
    if (endTime < this.blockHeight) return { ok: false, value: 0 };
    if (endTime <= startTime) return { ok: false, value: 0 };
    const rideId = this.state.nextFlagId;
    this.state.rides.set(rideId, {
      user: this.caller,
      distance,
      vehicleType,
      gpsStart,
      gpsEnd,
      startTime,
      endTime,
      timestamp: this.blockHeight,
    });
    this.state.nextFlagId++;
    return { ok: true, value: rideId };
  }

  flagRide(rideId: number, reason: string): Result<number> {
    if (this.caller !== this.state.oraclePrincipal) return { ok: false, value: 0 };
    if (rideId < 0) return { ok: false, value: 0 }; // Changed to allow rideId 0
    if (reason.length === 0) return { ok: false, value: 0 };
    if (!this.state.rides.has(rideId)) return { ok: false, value: 0 };
    const currentFlags = this.state.flagsByRide.get(rideId) || [];
    if (currentFlags.length >= this.state.flagLimit) return { ok: false, value: 0 };
    const flagId = this.state.nextFlagId;
    this.state.flags.set(flagId, {
      rideId,
      reason,
      flaggedAt: this.blockHeight,
      status: true,
    });
    this.state.flagsByRide.set(rideId, [...currentFlags, flagId]);
    this.state.nextFlagId++;
    return { ok: true, value: flagId };
  }

  unflagRide(flagId: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    const flag = this.state.flags.get(flagId);
    if (!flag) return { ok: false, value: false };
    if (!flag.status) return { ok: false, value: false };
    this.state.flags.set(flagId, { ...flag, status: false });
    return { ok: true, value: true };
  }

  analyzeRideDistance(rideId: number): Result<boolean> {
    const ride = this.state.rides.get(rideId);
    if (!ride) return { ok: false, value: false };
    this.stxTransfers.push({ amount: this.state.analysisFee, from: this.caller, to: "contract" });
    if (ride.distance > this.state.maxDistance) {
      const flagResult = this.flagRide(rideId, "Unrealistic distance");
      if (flagResult.ok) {
        return { ok: true, value: true };
      }
      return { ok: false, value: false };
    }
    return { ok: true, value: false };
  }

  analyzeRideSpeed(rideId: number): Result<boolean> {
    const ride = this.state.rides.get(rideId);
    if (!ride) return { ok: false, value: false };
    const duration = ride.endTime - ride.startTime;
    const speed = Math.floor(ride.distance / duration); // Ensure integer division
    this.stxTransfers.push({ amount: this.state.analysisFee, from: this.caller, to: "contract" });
    if (speed > this.state.maxSpeed) {
      const flagResult = this.flagRide(rideId, "Excessive speed");
      if (flagResult.ok) {
        return { ok: true, value: true };
      }
      return { ok: false, value: false };
    }
    return { ok: true, value: false };
  }

  getFlagCount(): Result<number> {
    return { ok: true, value: this.state.nextFlagId };
  }

  isRideFlagged(rideId: number): Result<boolean> {
    const flags = this.state.flagsByRide.get(rideId) || [];
    const hasActiveFlags = flags.some((flagId) => {
      const flag = this.state.flags.get(flagId);
      return flag ? flag.status : false;
    });
    return { ok: true, value: hasActiveFlags };
  }
}

describe("FraudDetector", () => {
  let contract: FraudDetectorMock;

  beforeEach(() => {
    contract = new FraudDetectorMock();
    contract.reset();
  });

  it("submits a ride successfully", () => {
    const result = contract.submitRide(500, "EV", "lat1,long1", "lat2,long2", 100, 200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const ride = contract.getRide(0);
    expect(ride?.distance).toBe(500);
    expect(ride?.vehicleType).toBe("EV");
  });

  it("rejects invalid distance", () => {
    const result = contract.submitRide(0, "EV", "lat1,long1", "lat2,long2", 100, 200);
    expect(result.ok).toBe(false);
  });

  it("rejects flag by non-oracle", () => {
    contract.submitRide(500, "EV", "lat1,long1", "lat2,long2", 100, 200);
    contract.caller = "ST2FAKE";
    const result = contract.flagRide(0, "Suspicious");
    expect(result.ok).toBe(false);
  });

  it("analyzes ride distance and flags if excessive", () => {
    contract.submitRide(1000001, "EV", "lat1,long1", "lat2,long2", 100, 200);
    contract.caller = contract.getOraclePrincipal();
    const result = contract.analyzeRideDistance(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const flags = contract.getFlagsByRide(0);
    expect(flags?.length).toBe(1);
  });

  it("analyzes ride speed and flags if excessive", () => {
    contract.submitRide(1000, "EV", "lat1,long1", "lat2,long2", 100, 104);
    contract.caller = contract.getOraclePrincipal();
    const result = contract.analyzeRideSpeed(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const flags = contract.getFlagsByRide(0);
    expect(flags?.length).toBe(1);
  });

  it("sets max distance successfully", () => {
    const result = contract.setMaxDistance(2000000);
    expect(result.ok).toBe(true);
    expect(contract.getMaxDistance()).toBe(2000000);
  });

  it("rejects set max distance by non-admin", () => {
    contract.caller = "ST2FAKE";
    const result = contract.setMaxDistance(2000000);
    expect(result.ok).toBe(false);
  });

  it("checks if ride is flagged", () => {
    contract.submitRide(500, "EV", "lat1,long1", "lat2,long2", 100, 200);
    contract.caller = contract.getOraclePrincipal();
    contract.flagRide(0, "Suspicious");
    const result = contract.isRideFlagged(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });
});
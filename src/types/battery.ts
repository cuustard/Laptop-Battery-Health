export type BatteryReport = {
    metadata: {
      computerName?: string;
      systemProductName?: string;
      bios?: string;
      osBuild?: string;
      reportTime?: string;
    };
    batteries: Battery[];
  };
  
  export type Battery = {
    name?: string;
    manufacturer?: string;
    serialNumber?: string;
    chemistry?: string;
    designCapacity_mWh?: number;
    fullChargeCapacity_mWh?: number;
    cycleCount?: number | null;
  };
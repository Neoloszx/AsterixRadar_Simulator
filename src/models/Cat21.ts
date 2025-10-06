// src/models/Cat21.ts
export interface WGS_84_coordinates {
  latitude: number;
  longitude: number;
}

export interface AircraftOperationalStatus {
  RA: string;
  TC: string;
  TS: string;
  ARV: string;
  CDTI: string;
  TCAS: string;
  SA: string;
}

export interface DataSourceIdentifier {
  SAC: string;
  SIC: string;
}

export interface TargetReportDescriptor {
  ATP: string;
  ARC: string;
  RC: string;
  RAB: string;
}

export interface QualityIndicator {
  NIC?: string;
  SIL?: string;
}

export interface TrajectoryIntent {
  TIS: boolean;
  TID: boolean;
}

export interface SelectedAltitude {
  SAS: string;
  Source: string;
  Altitude: string;
}

export interface FinalStateSelectedAltitude {
  MV: string;
  AH: string;
  AM: string;
  Altitude: string;
}

export interface AirborneGroundVector {
  GroundSpeed: number;
  TrackAngle: number;
}

export interface TargetStatus {
  ICF: string;
  LNAV: string;
  PS: string;
  SS: string;
}

export class Cat21 {
  id!: number;
  class: "Cat21" = "Cat21";
  instrument: "ADS-B" = "ADS-B";
  aircraft_operational_status!: AircraftOperationalStatus;
  data_source_identifier!: DataSourceIdentifier;
  service_identification!: string;
  emitter_category!: string;
  target_report_descriptor!: TargetReportDescriptor;
  mod_3A_code!: string;
  target_address!: string;
  quality_indicator!: QualityIndicator;
  trajectory_intent!: TrajectoryIntent;
  wgs_84_coordinates!: WGS_84_coordinates;
  flight_level!: string;
  air_speed!: number;
  track_number!: number;
  target_identification!: string;
  target_status!: TargetStatus;

  constructor(init: Partial<Cat21>) {
    Object.assign(this, init);
  }
}


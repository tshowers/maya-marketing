export interface MayaStatusReportCompany {
  name: string;
  logoUrl?: string;
  tagline?: string;
}

export interface MayaStatusReportMetric {
  label: string;
  value: string;
  detail?: string;
}

export interface MayaStatusReportSection {
  title: string;
  summary?: string;
  metrics?: MayaStatusReportMetric[];
  items?: string[];
  chart?: { label: string; value: number; displayValue?: string }[];
  commentary?: string;
}

export interface MayaStatusReport {
  company: MayaStatusReportCompany;
  reportingPeriod: { start?: string; end: string; label: string };
  executiveSummary: string;
  metrics: MayaStatusReportMetric[];
  outreach?: MayaStatusReportSection;
  engagement?: MayaStatusReportSection;
  pipeline?: MayaStatusReportSection;
  channels: MayaStatusReportMetric[];
  insights: string[];
  recommendations: string[];
  dataSources: string[];
  dataCoverage: string;
  limitations: string[];
  mayaCommentary: string[];
}

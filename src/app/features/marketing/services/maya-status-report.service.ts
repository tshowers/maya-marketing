import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { MayaReportImageService } from './maya-report-image.service';
import { MayaStatusReport, MayaStatusReportMetric, MayaStatusReportSection } from '../models/maya-status-report.models';

@Injectable({ providedIn: 'root' })
export class MayaStatusReportService {
  // Fixed Maya/Taliferro report system. Customer logos never influence these colors.
  private readonly navy = '#09244b';
  private readonly blue = '#1478e8';
  private readonly cyan = '#16b7d4';
  private readonly pale = '#eef6ff';
  private readonly gray = '#64748b';

  constructor(private readonly imageService: MayaReportImageService) {}

  async download(report: MayaStatusReport, confidential = true): Promise<void> {
    const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const cover = await this.loadImage(this.imageService.selectCover(report.company.name));
    const avatar = await this.loadImage('assets/find/entities/maya/logo-icon.png');
    const logo = await this.loadImage(report.company.logoUrl);

    this.cover(pdf, report, cover, avatar, logo, width, height, confidential);
    this.page(pdf, report, 'Executive Summary', confidential);
    this.summary(pdf, report, avatar, width);
    if (report.outreach) { this.page(pdf, report, 'Outreach Activity', confidential); this.section(pdf, report.outreach, avatar, width); }
    if (report.engagement) { this.page(pdf, report, 'Audience Engagement', confidential); this.section(pdf, report.engagement, avatar, width); }
    if (report.pipeline) { this.page(pdf, report, 'Pipeline Overview', confidential); this.section(pdf, report.pipeline, avatar, width); }
    if (report.channels.length) { this.page(pdf, report, 'Channel Performance', confidential); this.channels(pdf, report.channels, avatar, width); }
    if (report.insights.length) { this.page(pdf, report, 'Key Insights', confidential); this.listPage(pdf, report.insights, 'What the available data is telling us.', avatar, width); }
    if (report.recommendations.length) { this.page(pdf, report, 'Recommended Next Steps', confidential); this.listPage(pdf, report.recommendations, 'Prioritized actions based on the current evidence.', avatar, width); }
    this.page(pdf, report, 'Report Details', confidential); this.details(pdf, report, width);
    this.page(pdf, report, 'Closing', confidential); this.closing(pdf, report, avatar, logo, width, height);

    pdf.save(`maya-marketing-activity-status-${this.slug(report.company.name)}.pdf`);
  }

  private cover(pdf: jsPDF, report: MayaStatusReport, image: string | undefined, avatar: string | undefined, logo: string | undefined, width: number, height: number, confidential: boolean): void {
    pdf.setFillColor(this.navy); pdf.rect(0, 0, width, height, 'F');
    if (image) pdf.addImage(image, 'WEBP', width * .42, 0, width * .58, height, undefined, 'FAST');
    pdf.setFillColor(this.navy); pdf.triangle(0, 0, width * .64, 0, 0, height, 'F');
    pdf.setTextColor('#ffffff'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(30); pdf.text('Marketing', 42, 260); pdf.text('Activity', 42, 296); pdf.text('Status Report', 42, 332);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(13); pdf.text('Insights. Progress. Next steps.', 42, 365); pdf.text(report.reportingPeriod.label, 42, 405);
    this.brand(pdf, report.company, logo, 42, 54, '#ffffff');
    if (avatar) pdf.addImage(avatar, 'PNG', 42, height - 142, 58, 58, undefined, 'FAST');
    pdf.setTextColor('#ffffff'); pdf.setFontSize(12); pdf.text('Prepared by Maya', 116, height - 106); pdf.setFontSize(10); pdf.text('Your Marketing Director', 116, height - 88);
    if (confidential) { pdf.setFontSize(8); pdf.text('CONFIDENTIAL', width - 92, height - 26); }
  }

  private page(pdf: jsPDF, report: MayaStatusReport, title: string, confidential: boolean): void {
    pdf.addPage(); const width = pdf.internal.pageSize.getWidth(); const height = pdf.internal.pageSize.getHeight();
    pdf.setFillColor('#ffffff'); pdf.rect(0, 0, width, height, 'F'); pdf.setDrawColor(this.blue); pdf.setLineWidth(2); pdf.line(42, 86, 104, 86);
    pdf.setTextColor(this.navy); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(24); pdf.text(title, 42, 68);
    this.brand(pdf, report.company, undefined, 42, 28, this.navy); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(this.gray); pdf.text('Marketing Activity Status Report', width - 188, 34);
    if (confidential) { pdf.setFontSize(8); pdf.text(`CONFIDENTIAL  |  ${report.company.name}  |  Marketing Activity Status Report  |  Page ${pdf.getNumberOfPages()}`, 42, height - 24); }
  }

  private summary(pdf: jsPDF, report: MayaStatusReport, avatar: string | undefined, width: number): void {
    pdf.setTextColor(this.navy); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); this.wrap(pdf, report.executiveSummary, 42, 124, width - 84, 18);
    this.metricCards(pdf, report.metrics.slice(0, 4), 42, 190, width);
    this.commentary(pdf, report.mayaCommentary[0], avatar, 42, 360, width);
  }

  private section(pdf: jsPDF, section: MayaStatusReportSection, avatar: string | undefined, width: number): void {
    let y = 124; pdf.setTextColor(this.gray); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); if (section.summary) y = this.wrap(pdf, section.summary, 42, y, width - 84, 18) + 18;
    this.metricCards(pdf, section.metrics || [], 42, y, width); y += section.metrics?.length ? 126 : 20;
    if (section.chart?.length) { this.barChart(pdf, section.chart, 42, y, width - 84); y += 180; }
    if (section.items?.length) { this.bullets(pdf, section.items, 42, y, width - 84); y += Math.min(180, section.items.length * 24 + 12); }
    this.commentary(pdf, section.commentary, avatar, 42, Math.min(y, 570), width);
  }

  private channels(pdf: jsPDF, channels: MayaStatusReportMetric[], avatar: string | undefined, width: number): void {
    let y = 132; for (const item of channels.slice(0, 8)) { pdf.setTextColor(this.navy); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text(item.label, 42, y); pdf.setFillColor('#dce8f5'); pdf.roundedRect(160, y - 11, width - 250, 14, 5, 5, 'F'); const value = this.number(item.value); const max = Math.max(...channels.map(x => this.number(x.value)), 1); pdf.setFillColor(this.blue); pdf.roundedRect(160, y - 11, (width - 250) * Math.min(value / max, 1), 14, 5, 5, 'F'); pdf.setTextColor(this.gray); pdf.setFont('helvetica', 'normal'); pdf.text(item.value, width - 78, y); y += 42; }
    this.commentary(pdf, 'Channel comparisons include only channels with recorded data.', avatar, 42, Math.min(y + 22, 570), width);
  }

  private listPage(pdf: jsPDF, items: string[], subtitle: string, avatar: string | undefined, width: number): void { pdf.setTextColor(this.gray); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); pdf.text(subtitle, 42, 124); this.bullets(pdf, items, 42, 166, width - 84); }

  private details(pdf: jsPDF, report: MayaStatusReport, width: number): void { pdf.setTextColor(this.navy); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.text('Reporting Period', 42, 136); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11); pdf.text(report.reportingPeriod.label, 42, 158); pdf.setFont('helvetica', 'bold'); pdf.text('Data Sources', 42, 204); this.bullets(pdf, report.dataSources, 42, 230, width - 84); pdf.setFont('helvetica', 'bold'); pdf.text('Data Coverage', 42, 390); pdf.setFont('helvetica', 'normal'); this.wrap(pdf, report.dataCoverage, 42, 412, width - 84, 16); if (report.limitations.length) { pdf.setFont('helvetica', 'bold'); pdf.text('Limitations', 42, 490); this.bullets(pdf, report.limitations, 42, 516, width - 84); } }

  private closing(pdf: jsPDF, report: MayaStatusReport, avatar: string | undefined, logo: string | undefined, width: number, height: number): void { pdf.setFillColor(this.navy); pdf.rect(0, 0, width, height, 'F'); if (avatar) pdf.addImage(avatar, 'PNG', 52, 180, 110, 110, undefined, 'FAST'); pdf.setTextColor('#ffffff'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(26); pdf.text('Thank you', 196, 218); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(14); pdf.text('Questions? I’m here to help.', 196, 250); pdf.setFont('helvetica', 'bold'); pdf.text('Maya', 196, 286); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11); pdf.text('Your Marketing Director', 196, 306); this.brand(pdf, report.company, logo, 42, height - 86, '#ffffff'); if (report.company.name) pdf.text(report.company.name, 42, height - 48); }

  private metricCards(pdf: jsPDF, metrics: MayaStatusReportMetric[], x: number, y: number, width: number): void { const cardWidth = (width - 100) / 2; metrics.forEach((metric, index) => { const col = index % 2; const row = Math.floor(index / 2); const left = x + col * (cardWidth + 16); const top = y + row * 82; pdf.setFillColor(this.pale); pdf.roundedRect(left, top, cardWidth, 66, 8, 8, 'F'); pdf.setTextColor(this.blue); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(21); pdf.text(metric.value, left + 14, top + 30); pdf.setTextColor(this.navy); pdf.setFontSize(9); pdf.text(metric.label, left + 14, top + 49); if (metric.detail) { pdf.setTextColor(this.gray); pdf.setFontSize(8); pdf.text(metric.detail, left + 14, top + 61); } }); }

  private barChart(pdf: jsPDF, chart: { label: string; value: number; displayValue?: string }[], x: number, y: number, width: number): void { const max = Math.max(...chart.map(item => item.value), 1); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(this.navy); pdf.text('Recorded activity', x, y); chart.slice(0, 8).forEach((item, index) => { const barY = y + 25 + index * 18; pdf.setFillColor('#dce8f5'); pdf.rect(x, barY, width, 10, 'F'); pdf.setFillColor(index % 2 ? this.cyan : this.blue); pdf.rect(x, barY, width * Math.max(0, Math.min(item.value / max, 1)), 10, 'F'); pdf.setTextColor(this.gray); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(`${item.label}  ${item.displayValue || item.value}`, x + 5, barY + 8); }); }

  private commentary(pdf: jsPDF, text: string | undefined, avatar: string | undefined, x: number, y: number, width: number): void { if (!text) return; pdf.setFillColor(this.pale); pdf.roundedRect(x, y, width - 84, 72, 10, 10, 'F'); if (avatar) pdf.addImage(avatar, 'PNG', x + 12, y + 12, 46, 46, undefined, 'FAST'); pdf.setTextColor(this.navy); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(10); this.wrap(pdf, text, x + 72, y + 27, width - 180, 14); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text('— Maya', x + 72, y + 58); }

  private bullets(pdf: jsPDF, items: string[], x: number, y: number, width: number): void { pdf.setTextColor(this.navy); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11); items.slice(0, 8).forEach((item, index) => { pdf.setFillColor(index % 2 ? this.cyan : this.blue); pdf.circle(x + 7, y + index * 34 - 4, 7, 'F'); this.wrap(pdf, item, x + 24, y + index * 34, width - 24, 14); }); }

  private brand(pdf: jsPDF, company: MayaStatusReport['company'], logo: string | undefined, x: number, y: number, color: string): void { if (logo) pdf.addImage(logo, 'PNG', x, y - 15, 24, 24, undefined, 'FAST'); pdf.setTextColor(color); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.text(company.name || 'Company', x + (logo ? 34 : 0), y); if (company.tagline) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(company.tagline, x + (logo ? 34 : 0), y + 13); } }

  private wrap(pdf: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number { const lines = pdf.splitTextToSize(String(text || ''), maxWidth) as string[]; pdf.text(lines, x, y); return y + Math.max(1, lines.length) * lineHeight; }
  private number(value: string): number { const parsed = Number(String(value || '').replace(/[^0-9.-]/g, '')); return Number.isFinite(parsed) ? parsed : 0; }
  private slug(value: string): string { return String(value || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'company'; }
  private async loadImage(url?: string): Promise<string | undefined> { if (!url) return undefined; try { const response = await fetch(url); if (!response.ok) return undefined; const blob = await response.blob(); return await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => resolve(undefined); reader.readAsDataURL(blob); }); } catch { return undefined; } }
}

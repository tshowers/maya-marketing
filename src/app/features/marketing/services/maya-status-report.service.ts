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
    const accent = await this.loadImage(this.imageService.selectAccent(report.company.name));
    const avatar = await this.loadImage('assets/find/entities/maya/logo-icon.png');
    const logo = await this.loadImage(report.company.logoUrl);

    await this.cover(pdf, report, cover, avatar, logo, width, height, confidential);
    this.page(pdf, report, 'Executive Summary', confidential, accent);
    this.summary(pdf, report, undefined, width);
    if (report.outreach) { this.page(pdf, report, 'Outreach Activity', confidential); this.section(pdf, report.outreach, undefined, width); }
    if (report.social) { this.page(pdf, report, 'Social Activity Today', confidential); this.section(pdf, report.social, undefined, width); }
    if (report.network) { this.pipelineFlowPage(pdf, report, report.network, confidential); }
    if (report.pipelineStatus) { this.pipelineStatusPage(pdf, report, report.pipelineStatus, confidential); }
    if (report.engagement) { this.page(pdf, report, 'Audience Engagement', confidential); this.section(pdf, report.engagement, undefined, width); }
    if (report.pipeline) { this.page(pdf, report, 'Pipeline Overview', confidential); this.section(pdf, report.pipeline, undefined, width); }
    if (report.channels.length) { this.page(pdf, report, 'Channel Performance', confidential); this.channels(pdf, report.channels, undefined, width); }
    if (report.insights.length) { this.page(pdf, report, 'Key Insights', confidential); this.listPage(pdf, report.insights, 'What the available data is telling us.', undefined, width); }
    if (report.recommendations.length) { this.page(pdf, report, 'Recommended Next Steps', confidential); this.listPage(pdf, report.recommendations, 'Prioritized actions based on the current evidence.', undefined, width); }
    this.page(pdf, report, 'Report Details', confidential, accent); this.details(pdf, report, width);
    this.page(pdf, report, 'Closing', confidential); await this.closing(pdf, report, avatar, logo, accent, width, height);

    pdf.save(`maya-marketing-activity-status-${this.slug(report.company.name)}.pdf`);
  }

  private async cover(pdf: jsPDF, report: MayaStatusReport, image: string | undefined, avatar: string | undefined, logo: string | undefined, width: number, height: number, confidential: boolean): Promise<void> {
    pdf.setFillColor(this.navy); pdf.rect(0, 0, width, height, 'F');
    if (image) pdf.addImage(await this.cropImage(image, width * .58, height), 'PNG', width * .42, 0, width * .58, height, undefined, 'FAST');
    pdf.setFillColor(this.navy); pdf.triangle(0, 0, width * .64, 0, 0, height, 'F');
    pdf.setTextColor('#ffffff'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(30); pdf.text('Marketing', 42, 260); pdf.text('Activity', 42, 296); pdf.text('Status Report', 42, 332);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(13); pdf.text('Insights. Progress. Next steps.', 42, 365); pdf.text(report.reportingPeriod.label, 42, 405);
    this.brand(pdf, report.company, logo, 42, 54, '#ffffff', width - 84);
    if ( report.preparedFor?.name ) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.text(`Prepared for ${report.preparedFor.name}`, 42, height - 164); pdf.text(report.preparedFor.company || report.company.name, 42, height - 148); }
    if (avatar) pdf.addImage(avatar, 'PNG', 42, height - 142, 58, 58, undefined, 'FAST');
    pdf.setTextColor('#ffffff'); pdf.setFontSize(12); pdf.text('Prepared by Maya', 116, height - 106); pdf.setFontSize(10); pdf.text('Your Marketing Director', 116, height - 88);
    if (confidential) { pdf.setFontSize(8); pdf.text('CONFIDENTIAL', width - 92, height - 26); }
  }

  private page(pdf: jsPDF, report: MayaStatusReport, title: string, confidential: boolean, accent?: string): void {
    pdf.addPage('letter', 'portrait'); const width = pdf.internal.pageSize.getWidth(); const height = pdf.internal.pageSize.getHeight();
    pdf.setFillColor('#ffffff'); pdf.rect(0, 0, width, height, 'F'); pdf.setDrawColor(this.blue); pdf.setLineWidth(2); pdf.line(42, 86, 104, 86);
    pdf.setTextColor(this.navy); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(24); pdf.text(title, 42, 68);
    this.brand(pdf, report.company, undefined, 42, 28, this.navy, 340); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(this.gray); pdf.text('Marketing Activity Status Report', width - 188, 34);
    if (confidential) { pdf.setFontSize(8); pdf.text(`CONFIDENTIAL  |  ${report.company.name}  |  Marketing Activity Status Report  |  Page ${pdf.getNumberOfPages()}`, 42, height - 24); }
  }

  private summary(pdf: jsPDF, report: MayaStatusReport, avatar: string | undefined, width: number): void {
    pdf.setTextColor(this.navy); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); this.wrap(pdf, report.executiveSummary, 42, 124, width - 84, 18);
    this.metricCards(pdf, report.metrics.slice(0, 4), 42, 190, width);
    const metricRows = Math.ceil( report.metrics.slice( 0, 4 ).length / 2 );
    this.commentary(pdf, report.mayaCommentary[0], avatar, 42, 190 + metricRows * 96 + 12, width);
  }

  private pipelineFlowPage(pdf: jsPDF, report: MayaStatusReport, section: MayaStatusReportSection, confidential: boolean): void {
    pdf.addPage('letter', 'landscape');
    const width = pdf.internal.pageSize.getWidth(); const height = pdf.internal.pageSize.getHeight();
    pdf.setFillColor('#2f3747'); pdf.rect(0, 0, width, height, 'F');
    pdf.setTextColor('#ffffff'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(21); pdf.text('Networking Progress', 22, 36);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); this.wrap(pdf, 'See how your relationships are moving. TODD tracks every stage in your pipeline so you can spot momentum, bottlenecks, and opportunities at a glance.', 22, 56, 480, 12);
    pdf.setDrawColor('#647080'); pdf.setLineWidth(.5); pdf.line(20, 90, width - 20, 90);
    pdf.setFillColor('#101c33'); pdf.roundedRect(156, 108, 260, 28, 14, 14, 'F'); pdf.setFillColor('#079bd2'); pdf.roundedRect(159, 111, 90, 22, 11, 11, 'F');
    pdf.setTextColor('#ffffff'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('Pipeline Flow', 178, 125); pdf.setTextColor('#9aa9bd'); pdf.text('Pipeline Status', 272, 125); pdf.text('Lane View', 364, 125);
    const metrics = section.metrics || []; const stageNames = ['Visitor', 'Contacted', 'Engaged', 'Qualified', 'Opportunity', 'Customer'];
    const stageDescriptions = ['Visited todd.taliferro.tech in the last 30 days', 'Outreach initiated by Maya or your team', 'They replied or showed real interest', 'Warm and ready for a focused follow-up', 'Needs your input or approval to move forward', 'Marked as a subscriber, billing on file'];
    const stageColors = ['#a684f4', '#20d5c0', '#20d5c0', '#4bdd78', '#ffbd2e', '#4bdd78'];
    const left = 20; const top = 190; const stageWidth = (width - 40) / 6;
    pdf.setTextColor('#9fb0c5'); pdf.setFontSize(9); pdf.text("TODAY'S MOMENTUM", 136, 156);
    stageNames.forEach((name, index) => {
      const x = left + index * stageWidth; const metric = metrics.find(item => item.label.toLowerCase() === name.toLowerCase()); const value = metric?.value || '0';
      pdf.setFillColor('#0f1a30'); pdf.rect(x, top, stageWidth - 1, 145, 'F'); pdf.setFillColor(stageColors[index]); pdf.circle(x + stageWidth / 2, top + 18, 9, 'F'); pdf.setTextColor('#ffffff'); pdf.setFontSize(8); pdf.text(String(index + 1), x + stageWidth / 2 - 2.5, top + 21);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(stageColors[index]); pdf.text(name, x + stageWidth / 2 - pdf.getTextWidth(name) / 2, top + 68);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor('#d4dce7'); this.wrap(pdf, stageDescriptions[index], x + 12, top + 87, stageWidth - 24, 10);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.setTextColor(stageColors[index]); pdf.text(value, x + stageWidth / 2 - pdf.getTextWidth(value) / 2, top + 126);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor('#cbd5e1'); pdf.text(index === 0 ? 'visitors' : index === 5 ? 'customers' : 'contacts', x + stageWidth / 2 - 20, top + 138);
    });
    const reserve = section.items?.find(item => /cold reserve/i.test(item)) || 'Cold Reserve: 0'; pdf.setFillColor('#101c33'); pdf.roundedRect(width / 2 - 90, 350, 180, 30, 8, 8, 'F'); pdf.setTextColor('#ffffff'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.text(reserve.replace(/\.$/, ''), width / 2 - 72, 368);
    pdf.setTextColor('#ffffff'); pdf.setFontSize(12); pdf.text('TODD Action Priorities', 20, 414); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#c4cfdd'); pdf.setFontSize(10); pdf.text('Who needs your attention right now', 154, 414);
    const priorityNames = ['High Intent', 'Warm Follow-up', 'First Touch', 'Needs You', 'Cold Reserve']; const priorityIndexes = [4, 3, 1, 2, -1];
    priorityNames.forEach((name, index) => { const x = 20 + index * ((width - 40) / 5); const cardWidth = (width - 56) / 5; const metric = priorityIndexes[index] >= 0 ? metrics.find(item => item.label === stageNames[priorityIndexes[index]]) : undefined; pdf.setFillColor('#111c32'); pdf.roundedRect(x, 428, cardWidth, 54, 6, 6, 'F'); pdf.setTextColor('#ffffff'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.text(metric?.value || '0', x + 12, 448); pdf.setFontSize(8); pdf.text(name, x + 12, 462); pdf.setTextColor('#9baabd'); pdf.setFont('helvetica', 'normal'); pdf.text(index === 0 ? 'Strong buying signals' : index === 1 ? 'Ready for next touch' : index === 2 ? 'Good matches, start outreach' : index === 3 ? 'Needs your input' : 'Parked for now', x + 12, 475); });
    pdf.setFillColor('#14243c'); pdf.roundedRect(20, 500, width - 40, 42, 7, 7, 'F'); pdf.setTextColor('#ffffff'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('How it works:', 34, 518); pdf.setFont('helvetica', 'normal'); pdf.text('Maya attracts, engages, and moves people through the pipeline automatically.', 92, 518); pdf.text('Attract (Automated)    Convert (Maya)    Nurture (Maya)    Needs Your Attention    Close (You)', 92, 533);
    if (confidential) { pdf.setFontSize(7); pdf.text(`CONFIDENTIAL  |  ${report.company.name}  |  Page ${pdf.getNumberOfPages()}`, 20, height - 12); }
  }

  private pipelineStatusPage(pdf: jsPDF, report: MayaStatusReport, section: MayaStatusReportSection, confidential: boolean): void {
    pdf.addPage('letter', 'landscape'); const width = pdf.internal.pageSize.getWidth(); const height = pdf.internal.pageSize.getHeight();
    pdf.setFillColor('#2f3747'); pdf.rect(0, 0, width, height, 'F'); pdf.setTextColor('#ffffff'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(21); pdf.text('Networking Progress', 22, 36); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); this.wrap(pdf, 'See the current Maya and TODD pipeline state, including drafts, approvals, queued work, and sent activity.', 22, 56, 500, 12); pdf.setDrawColor('#647080'); pdf.line(20, 90, width - 20, 90);
    pdf.setFillColor('#101c33'); pdf.roundedRect(156, 108, 260, 28, 14, 14, 'F'); pdf.setTextColor('#9aa9bd'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('Pipeline Flow', 178, 125); pdf.setFillColor('#079bd2'); pdf.roundedRect(251, 111, 100, 22, 11, 11, 'F'); pdf.setTextColor('#ffffff'); pdf.text('Pipeline Status', 267, 125); pdf.setTextColor('#9aa9bd'); pdf.text('Lane View', 364, 125);
    pdf.setFillColor('#0f1a30'); pdf.roundedRect(20, 160, width - 40, 300, 10, 10, 'F'); pdf.setTextColor('#50d8ef'); pdf.setFontSize(9); pdf.text('MAYA PIPELINE STATUS', 34, 184); pdf.setTextColor('#ffffff'); pdf.setFontSize(13); pdf.text('Current execution state from the shared momentum pipeline', 34, 207);
    const items = section.items || []; const metrics = section.metrics || []; metrics.forEach((metric, index) => { const x = 34 + (index % 4) * 180; const y = 230; pdf.setFillColor('#1a2b45'); pdf.roundedRect(x, y, 160, 62, 7, 7, 'F'); pdf.setTextColor('#55b4ff'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22); pdf.text(String(metric.value || '0'), x + 12, y + 29); pdf.setTextColor('#ffffff'); pdf.setFontSize(9); pdf.text(this.shortenText(metric.label, 24), x + 12, y + 46); pdf.setTextColor('#9eafc5'); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(this.shortenText(metric.detail || '', 25), x + 12, y + 57); });
    pdf.setTextColor('#9fb0c5'); pdf.setFontSize(9); pdf.text('PIPELINE EVIDENCE', 34, 324); this.bullets(pdf, items.length ? items : ['No saved pipeline status details were available.'], 34, 348, width - 90); if (confidential) { pdf.setFontSize(7); pdf.setTextColor('#ffffff'); pdf.text(`CONFIDENTIAL  |  ${report.company.name}  |  Page ${pdf.getNumberOfPages()}`, 20, height - 12); }
  }

  private section(pdf: jsPDF, section: MayaStatusReportSection, avatar: string | undefined, width: number): void {
    let y = 124; pdf.setTextColor(this.gray); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); if (section.summary) y = this.wrap(pdf, section.summary, 42, y, width - 84, 18) + 18;
    this.metricCards(pdf, section.metrics || [], 42, y, width); y += section.metrics?.length ? Math.ceil( section.metrics.length / 2 ) * 96 + 18 : 20;
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

  private async closing(pdf: jsPDF, report: MayaStatusReport, avatar: string | undefined, logo: string | undefined, accent: string | undefined, width: number, height: number): Promise<void> { pdf.setFillColor(this.navy); pdf.rect(0, 0, width, height, 'F'); if (accent) pdf.addImage(await this.cropImage(accent, width * .43, height), 'PNG', width * .57, 0, width * .43, height, undefined, 'FAST'); pdf.setFillColor(this.navy); pdf.triangle(0, 0, width * .7, 0, 0, height, 'F'); if (avatar) pdf.addImage(avatar, 'PNG', 52, 180, 110, 110, undefined, 'FAST'); pdf.setTextColor('#ffffff'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(26); pdf.text('Thank you', 196, 218); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(14); pdf.text("Questions? I'm here to help.", 196, 250); pdf.setFont('helvetica', 'bold'); pdf.text('Maya', 196, 286); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11); pdf.text('Your Marketing Director', 196, 306); this.brand(pdf, report.company, logo, 42, height - 86, '#ffffff', 360); }

  private metricCards(pdf: jsPDF, metrics: MayaStatusReportMetric[], x: number, y: number, width: number): void { const cardWidth = (width - 100) / 2; metrics.slice(0, 4).forEach((metric, index) => { const col = index % 2; const row = Math.floor(index / 2); const left = x + col * (cardWidth + 16); const top = y + row * 96; const value = String(metric.value || ''); pdf.setTextColor(this.blue); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(value.length > 24 ? 14 : 21); const valueLines = pdf.splitTextToSize(value, cardWidth - 28) as string[]; pdf.setFillColor(this.pale); pdf.roundedRect(left, top, cardWidth, 80, 8, 8, 'F'); pdf.text(valueLines.slice(0, 2), left + 14, top + 27); pdf.setTextColor(this.navy); pdf.setFontSize(9); pdf.text(this.shortenText(metric.label, 48), left + 14, top + 54); if (metric.detail) { pdf.setTextColor(this.gray); pdf.setFontSize(8); pdf.text(this.shortenText(metric.detail, 54), left + 14, top + 69); } }); }

  private barChart(pdf: jsPDF, chart: { label: string; value: number; displayValue?: string }[], x: number, y: number, width: number): void { const max = Math.max(...chart.map(item => item.value), 1); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(this.navy); pdf.text('Recorded activity', x, y); chart.slice(0, 8).forEach((item, index) => { const barY = y + 25 + index * 18; pdf.setFillColor('#dce8f5'); pdf.rect(x, barY, width, 10, 'F'); pdf.setFillColor(index % 2 ? this.cyan : this.blue); pdf.rect(x, barY, width * Math.max(0, Math.min(item.value / max, 1)), 10, 'F'); pdf.setTextColor(this.gray); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(`${item.label}  ${item.displayValue || item.value}`, x + 5, barY + 8); }); }

  private commentary(pdf: jsPDF, text: string | undefined, avatar: string | undefined, x: number, y: number, width: number): void { if (!text) return; pdf.setFillColor(this.pale); pdf.roundedRect(x, y, width - 84, 72, 10, 10, 'F'); if (avatar) pdf.addImage(avatar, 'PNG', x + 12, y + 12, 46, 46, undefined, 'FAST'); const textX = avatar ? x + 72 : x + 20; const textWidth = avatar ? width - 180 : width - 124; pdf.setTextColor(this.navy); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(10); this.wrap(pdf, text, textX, y + 27, textWidth, 14); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text('- Maya', textX, y + 58); }

  private bullets(pdf: jsPDF, items: string[], x: number, y: number, width: number): void { pdf.setTextColor(this.navy); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11); items.slice(0, 8).forEach((item, index) => { pdf.setFillColor(index % 2 ? this.cyan : this.blue); pdf.circle(x + 7, y + index * 34 - 4, 7, 'F'); this.wrap(pdf, item, x + 24, y + index * 34, width - 24, 14); }); }

  private brand(pdf: jsPDF, company: MayaStatusReport['company'], logo: string | undefined, x: number, y: number, color: string, _maxWidth: number): void { const textX = x + (logo ? 34 : 0); if (logo) pdf.addImage(logo, 'PNG', x, y - 15, 24, 24, undefined, 'FAST'); pdf.setTextColor(color); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.text(company.name || 'Company', textX, y); }

  private wrap(pdf: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number { const lines = pdf.splitTextToSize(String(text || ''), maxWidth) as string[]; pdf.text(lines, x, y); return y + Math.max(1, lines.length) * lineHeight; }
  private shortenText(value: string, maxLength: number): string { const text = String(value || '').trim(); return text.length <= maxLength ? text : `${text.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`; }
  private number(value: string): number { const parsed = Number(String(value || '').replace(/[^0-9.-]/g, '')); return Number.isFinite(parsed) ? parsed : 0; }
  private slug(value: string): string { return String(value || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'company'; }
  private async cropImage ( dataUrl: string, targetWidth: number, targetHeight: number ): Promise<string> { return await new Promise( resolve => { const image = new Image(); image.onload = () => { const canvas = document.createElement( 'canvas' ); canvas.width = Math.max( 1, Math.round( targetWidth ) ); canvas.height = Math.max( 1, Math.round( targetHeight ) ); const context = canvas.getContext( '2d' ); if ( !context ) { resolve( dataUrl ); return; } const scale = Math.max( canvas.width / image.naturalWidth, canvas.height / image.naturalHeight ); const drawWidth = image.naturalWidth * scale; const drawHeight = image.naturalHeight * scale; context.drawImage( image, ( canvas.width - drawWidth ) / 2, ( canvas.height - drawHeight ) / 2, drawWidth, drawHeight ); resolve( canvas.toDataURL( 'image/png' ) ); }; image.onerror = () => resolve( dataUrl ); image.src = dataUrl; } ); }
  private async loadImage(url?: string): Promise<string | undefined> {
    if (!url) return undefined;
    try {
      const response = await fetch(url);
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return undefined;
      const blob = await response.blob();
      return await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  }
}

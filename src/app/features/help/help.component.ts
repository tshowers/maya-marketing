import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProductPagesComponent } from '../../shared/product-pages/product-pages.component';

/**
 * Maya's Help: the shared Help template, then her own guide below it. Static
 * (prerendered for search engines). The behaviour described here follows
 * MAYA-ORCHESTRATION-DESIGN.md and what Maya's work page shows today.
 */
@Component( {
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductPagesComponent],
  templateUrl: './help.component.html',
} )
export class HelpComponent {
  readonly abilities = [
    { title: 'Ask for advice', copy: 'Ask Maya anything about your marketing: your message, your offer, your audience, what to do this week. Advice is free.' },
    { title: 'Build a presentation', copy: 'Tell Maya what the deck is for. She asks questions until she can tell a credible story, then builds the slides for you to download.' },
    { title: 'Get a status report', copy: 'Choose Status report under the input for a downloadable summary of your marketing plan and where it stands.' },
    { title: 'Give her a job', copy: 'On Maya’s work page, describe the work, for example “Build a LinkedIn calendar for the rest of October.” She plans it, drafts the posts, images and emails, and stops for your approval.' },
  ];

  readonly workPage = [
    { term: 'Maya has concerns', detail: 'When a request works against your marketing plan, she says what it will cost (focus, time, images, audience) and recommends another way. You choose, and she records the decision.' },
    { term: 'Maya has a question', detail: 'She asks one thing at a time, only when the answer changes the work, and offers likely answers.' },
    { term: 'Waiting for you', detail: 'Anything that would publish, send or spend waits here. Approve items one at a time or all at once.' },
    { term: 'Jobs', detail: 'Everything Maya is working on, step by step. Cancel a job at any time.' },
    { term: 'How hard Maya pushes back', detail: 'Firm stops and makes her case. Standard stops and lists the consequences. Light goes ahead and tells you the consequences up front. She always tells you the consequences.' },
  ];

  readonly places = [
    { term: 'Status', route: '/marketing-employee', detail: 'Maya’s pipeline, scorecard, and today’s work.' },
    { term: 'Plan', route: '/marketing-employee/plan', detail: 'Your marketing plan as a board: goals, audiences, channels and campaigns.' },
    { term: 'Work', route: '/work', detail: 'Jobs, approvals and Maya’s questions.' },
    { term: 'Profile', route: '/profile', detail: 'Your company details. Maya reads them before she advises.' },
    { term: 'Pricing', route: '/pricing', detail: 'What is free and what comes with the Maya app.' },
  ];

  readonly questions = [
    { q: 'Is Maya free?', a: 'Advice is free, in any browser. Creating documents, decks and status reports, and downloading transcripts, come with the Maya app on iPhone and iPad; one subscription unlocks them on the web too.' },
    { q: 'Will Maya publish or send anything without me?', a: 'No. Publishing, sending, spending and deleting always wait for your approval. The one exception is Social autopilot: if you turn it on, Maya approves her own social posts.' },
    { q: 'Does Maya make things up?', a: 'No. She does not invent metrics, prices, dates, quotes or links. When a fact is missing she asks you, or leaves a [bracketed] placeholder for you to fill in.' },
    { q: 'What won’t Maya do?', a: 'Sales follow-ups with a specific person go to Outreach. Work that isn’t marketing goes to TODD or Moves. She never changes settings, mailboxes, billing or connected accounts.' },
    { q: 'Why is my calendar taking a few days to fill?', a: 'New images count against your workspace’s daily image allowance. Maya reuses images from your library first and spreads new ones across days, and tells you when they’ll be ready.' },
    { q: 'Where does Maya get her information?', a: 'Your TODD profile, your marketing plan, reference material in your Knowledge Base, what is already scheduled, and this conversation.' },
  ];
}
